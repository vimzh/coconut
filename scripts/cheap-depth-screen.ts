// Run a separate, bounded screening cohort while retaining every paid authorization and provider outcome.
import { createHash } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ModelMetadata } from "../apps/api/src/discovery";
import type { SelectionResult } from "../apps/api/src/discovery/types";
import { parseOpenAIModel } from "../apps/api/src/discovery/catalog";
import { implementationSha256 } from "../apps/api/src/deep-study/execution";
import { parseInferenceResponse } from "../apps/api/src/inference/adapters";
import type { NormalizedInference } from "../apps/api/src/inference/types";
import { extractAnswer, type AnswerOutcome } from "../apps/api/src/protocol";
import { requestOpenAI } from "../apps/api/src/providers/openai";
import { parseCredential } from "../apps/api/src/providers/policy";
import { classifyHttpFailure, FAILURE_MESSAGES, reflectsCredential } from "../apps/api/src/providers/responses";
import { runProviderTransport, TransportFailure, type ProviderFetch } from "../apps/api/src/providers/transport";
import type { AccessFailureCode } from "../apps/api/src/providers/types";
import { sameData, sha256 } from "../apps/api/src/quality/data";
import { acquireStudyLock, writeArtifact } from "../apps/api/src/randomized/artifacts";
import { buildImportedPrompt } from "../apps/api/src/randomized/pilot";
import { readBoundedFile } from "../apps/api/src/randomized/source";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { scoreClassifications } from "../apps/api/src/scoring/classification";
import { reportAmendment, selectAmendmentCases } from "./deep-study-amendment";

export const MODELS = Object.freeze([
  { modelId: "gpt-4.1-mini", reasoningEffort: null, reportedIds: ["gpt-4.1-mini", "gpt-4.1-mini-2025-04-14"] },
  { modelId: "gpt-4o-mini", reasoningEffort: null, reportedIds: ["gpt-4o-mini", "gpt-4o-mini-2024-07-18"] },
  { modelId: "gpt-5.6-luna", reasoningEffort: "none", reportedIds: ["gpt-5.6-luna"] },
] as const);
export type ModelId = typeof MODELS[number]["modelId"];
// This private execution profile reuses only the canonical none-effort answer extractor.
export const SETTINGS = Object.freeze({ methodId: "cheap-depth-screen-single-v1", profileId: "cheap-depth-screen-8k-180s-v1", maxOutputTokens: 8192,
  inferenceTimeoutMs: 180000, studyTimeoutMs: 1800000, maxRequests: 240, concurrency: 24, retries: 0, extractionProfile: "one-shot-json-v2-none" } as const);
export const ROOT = resolve(import.meta.dir, "../apps/api/data/private/cheap-depth-screen-v1");
const ENDPOINT = "https://api.openai.com/v1/responses", DEPTHS = [5, 10, 20, 40, 80, 160, 320, 512], LABELS = ["convex", "concave", "neither"] as const;
const instant = (value: string) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readBoundedFile(path)) as T;
const model = (id: ModelId) => { const value = MODELS.find(item => item.modelId === id); if (!value) throw new Error("Model outside the frozen screen roster."); return value; };
export const acceptedIdentity = (id: ModelId, reported: string | null): boolean => reported !== null && (model(id).reportedIds as readonly string[]).includes(reported);
export async function operatorSha256() { return createHash("sha256").update(await Bun.file(new URL(import.meta.url)).bytes()).digest("hex"); }

export function selectCases(parentCases: readonly ImportedCase[], selectedParentIds: readonly string[]): ImportedCase[] {
  if (!sameData(selectAmendmentCases(parentCases).map(task => task.id), selectedParentIds)) throw new Error("Screen selection requires the unchanged certified parent 620-case cohort.");
  const parent = parentCases.filter(task => selectedParentIds.includes(task.id)), selected = new Set<string>();
  for (const [ordinal, depth] of DEPTHS.entries()) for (const [index, label] of LABELS.entries()) {
    const candidates = parent.filter(task => task.requestedDepth === depth && task.label === label).slice(0, 3 + Number(index === ordinal % 3));
    if (candidates.length !== 3 + Number(index === ordinal % 3)) throw new Error("The parent lacks a balanced ten-task depth stratum.");
    for (const task of candidates) selected.add(task.id);
  }
  const cases = parent.filter(task => selected.has(task.id));
  if (cases.length !== 80) throw new Error("Screen selection must contain exactly 80 distinct tasks.");
  return cases;
}
export function buildBody(task: ImportedCase, modelId: ModelId) {
  const selected = model(modelId);
  return { model: modelId, input: buildImportedPrompt(task).messages, max_output_tokens: 8192, store: false, truncation: "disabled",
    ...(selected.reasoningEffort === null ? {} : { reasoning: { effort: selected.reasoningEffort } }) } as const;
}
type Failure = { readonly code: AccessFailureCode; readonly remoteOutcome: "not-sent" | "unknown" | "response-received" };
export interface Attempt { readonly methodId: typeof SETTINGS.methodId; readonly startedAt: string; readonly finishedAt: string; readonly inferenceTimeoutMs: 180000;
  readonly inferenceRequests: 0 | 1; readonly httpStatus: number | null; readonly failure: Failure | null; readonly rawResponse: unknown;
  readonly normalized: NormalizedInference | null; readonly outcome: AnswerOutcome }
export interface Receipt { readonly studyId: string; readonly ordinal: number; readonly modelId: ModelId; readonly caseId: string; readonly trialIndex: 0;
  readonly referenceSha256: string; readonly requestBodySha256: string; readonly authorizedAt: string; readonly remoteOutcomeUntilRetained: "unknown" }
export interface Row { readonly modelId: ModelId; readonly caseId: string; readonly trialIndex: 0; dispatch: Receipt | null; result: Attempt | null }
export const createRows = (cases: readonly ImportedCase[]): Row[] => cases.flatMap(task => MODELS.map(selected => ({ modelId: selected.modelId, caseId: task.id, trialIndex: 0, dispatch: null, result: null })));
const context = { selection: { provider: "openai" }, prompt: { responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: 8192 } } } as const;
function configurationFailure(value: NormalizedInference, id: ModelId): AccessFailureCode | null {
  return value.failure ?? (value.effective.maxOutputTokens !== 8192 || value.effective.truncation !== "disabled" || value.reply.text.length > 131072
    || (model(id).reasoningEffort === "none" ? value.effective.reasoningEffort !== "none" : value.effective.reasoningEffort !== null && value.effective.reasoningEffort !== "none") ? "invalid-provider-response" : null);
}
const failureOutcome = (failure: Failure) => extractAnswer(failure.code === "cancelled" ? { status: "cancelled", text: "" }
  : { status: "provider-error", text: "", message: failure.code }, SETTINGS.extractionProfile);
export const hasModelOutcome = (result: Attempt | null): boolean => !!result && result.inferenceRequests === 1 && result.failure === null && ["answer", "invalid", "refused", "truncated"].includes(result.outcome.kind);

export async function executeAttempt(task: ImportedCase, modelId: ModelId, metadata: ModelMetadata, suppliedCredential: string, parentSignal: AbortSignal,
  onDispatch: () => Promise<void>, fetcher: ProviderFetch = fetch): Promise<Attempt> {
  const credential = parseCredential(suppliedCredential), body = buildBody(task, modelId), text = JSON.stringify(body), startedAt = new Date().toISOString();
  if (metadata.modelId !== modelId || metadata.servingProvider !== null || metadata.exactRoute !== true || reflectsCredential(text, credential)) throw new Error("Invalid exact OpenAI metadata or unsafe screen request.");
  let raw: unknown = null, normalized: NormalizedInference | null = null, persistenceFailed = false;
  const transport = await runProviderTransport({ credential, signal: parentSignal, maxAttempts: 1, timeoutMs: 180000, fetcher: async (url, init) => {
    if (url !== ENDPOINT || init.method !== "POST" || typeof init.body !== "string" || !sameData(JSON.parse(init.body), body)) throw new TransportFailure("invalid-provider-response");
    try { await onDispatch(); } catch { persistenceFailed = true; throw new Error("Screen dispatch persistence failed before the wire request."); }
    init.signal?.throwIfAborted();
    return fetcher(url, { ...init, timeout: false } as BunFetchRequestInit);
  } }, async wire => {
    const response = await requestOpenAI({ url: ENDPOINT, method: "POST" }, credential, wire.signal, wire.send, wire.readBody,
      client => client.responses.create(JSON.parse(text), { signal: wire.signal, timeout: 180000, maxRetries: 0 }).asResponse(), 180000);
    const responseText = await wire.readBody(response); raw = responseText;
    try { raw = JSON.parse(responseText); } catch { throw new TransportFailure(response.ok ? "invalid-provider-response" : classifyHttpFailure(response.status, raw, true)); }
    if (!response.ok) throw new TransportFailure(classifyHttpFailure(response.status, raw, true));
    normalized = parseInferenceResponse(raw, context, metadata);
    const failure = configurationFailure(normalized, modelId); if (failure) throw new TransportFailure(failure);
    wire.signal.throwIfAborted();
  });
  if (persistenceFailed) throw new Error("Dispatch evidence could not be retained; no new screen requests are safe.");
  const failure: Failure | null = transport.ok ? null : { code: transport.code, remoteOutcome: transport.remoteOutcome };
  if (failure?.code === "credential-reflection") { raw = null; normalized = null; }
  const result: Attempt = { methodId: SETTINGS.methodId, startedAt, finishedAt: new Date().toISOString(), inferenceTimeoutMs: 180000,
    inferenceRequests: transport.attempts as 0 | 1, httpStatus: transport.httpStatus, failure, rawResponse: raw, normalized,
    outcome: failure ? failureOutcome(failure) : extractAnswer((normalized as NormalizedInference | null)!.reply, SETTINGS.extractionProfile) };
  if (reflectsCredential(JSON.stringify(result), credential)) throw new Error("Unsafe screen evidence was discarded.");
  return result;
}

export function assertAttemptReplay(result: Attempt, modelId: ModelId, metadata: ModelMetadata): void {
  const invalid = () => { throw new Error("Screen attempt cannot be replayed from retained provider evidence."); };
  if (metadata.modelId !== modelId || metadata.servingProvider !== null || metadata.exactRoute !== true || result.methodId !== SETTINGS.methodId || result.inferenceTimeoutMs !== 180000
    || !instant(result.startedAt) || !instant(result.finishedAt) || Date.parse(result.finishedAt) < Date.parse(result.startedAt) || ![0, 1].includes(result.inferenceRequests)
    || result.rawResponse === undefined || result.httpStatus !== null && (!Number.isSafeInteger(result.httpStatus) || result.httpStatus < 200 || result.httpStatus > 599)
    || (result.httpStatus !== null || result.rawResponse !== null || result.normalized !== null) && result.inferenceRequests !== 1
    || (result.rawResponse !== null || result.normalized !== null) && result.httpStatus === null || result.normalized !== null && result.rawResponse === null) invalid();
  const parsed = result.rawResponse === null ? null : parseInferenceResponse(result.rawResponse, context, metadata);
  if (result.normalized !== null && !isDeepStrictEqual(result.normalized, parsed)) invalid();
  if (result.failure === null) {
    if (result.httpStatus === null || result.httpStatus >= 300 || !result.normalized || configurationFailure(result.normalized, modelId)
      || !isDeepStrictEqual(result.outcome, extractAnswer(result.normalized.reply, SETTINGS.extractionProfile))) invalid();
    return;
  }
  const f = result.failure, status = result.httpStatus;
  if (Object.keys(f).length !== 2 || !Object.hasOwn(FAILURE_MESSAGES, f.code) || !["not-sent", "unknown", "response-received"].includes(f.remoteOutcome)
    || f.remoteOutcome !== (result.inferenceRequests === 0 ? "not-sent" : status === null || ["timeout", "cancelled", "network-error"].includes(f.code) ? "unknown" : "response-received")
    || !isDeepStrictEqual(result.outcome, failureOutcome(f))) invalid();
  if (f.code === "cancelled" || f.code === "timeout") { if (f.code === "timeout" && Date.parse(result.finishedAt) - Date.parse(result.startedAt) < 179000 || result.normalized && configurationFailure(result.normalized, modelId)) invalid(); return; }
  if (f.code === "network-error") { if (status !== null || result.rawResponse !== null || result.normalized !== null) invalid(); return; }
  if (["credential-reflection", "response-too-large"].includes(f.code) && result.rawResponse === null && result.normalized === null && status !== null) return;
  if (f.code === "redirect-blocked" && result.rawResponse === null && result.normalized === null && status !== null && status >= 300 && status < 400) return;
  if (result.normalized !== null && status !== null && status < 300 && configurationFailure(result.normalized, modelId) === f.code) return;
  if (status !== null && status >= 400 && result.normalized === null && f.code === classifyHttpFailure(status, result.rawResponse, true)) return;
  if (f.code === "invalid-provider-response" && result.normalized === null && (result.rawResponse === null || typeof result.rawResponse === "string")) return;
  invalid();
}

export interface Control { readonly kind: "model-pin" | "model-stop" | "stop-fresh"; readonly index: number; readonly observedAt: string; readonly reportedModelId: string | null }
export async function scheduleRows(rows: readonly Row[], options: { execute: (index: number) => Promise<Attempt>; persistControl?: (event: Control) => Promise<void>; signal?: AbortSignal; abort?: () => void }) {
  if (rows.length > 240 || rows.some(row => row.dispatch || row.result) || new Set(rows.map(row => `${row.modelId}:${row.caseId}`)).size !== rows.length) throw new Error("Screen scheduling requires fresh unique cells.");
  const pins = Object.fromEntries(MODELS.map(m => [m.modelId, null])) as Record<ModelId, string | null>;
  let stopped = false, failures = 0, fatal: unknown; const first = new Set<number>();
  const control = async (kind: Control["kind"], index: number, reportedModelId: string | null) => options.persistControl?.({ kind, index, reportedModelId, observedAt: new Date().toISOString() });
  async function execute(index: number, initial: boolean) {
    try {
      const row = rows[index], result = await options.execute(index), id = result.normalized?.reportedModelId ?? null;
      row.result = result;
      const valid = hasModelOutcome(result) && acceptedIdentity(row.modelId, id) && (initial || pins[row.modelId] === id);
      if (initial) { if (valid) { pins[row.modelId] = id; await control("model-pin", index, id); } else { failures++; await control("model-stop", index, id); } }
      else if (!valid) { failures++; if (!stopped) { stopped = true; await control("stop-fresh", index, id); } }
    } catch (error) { stopped = true; fatal ??= error; options.abort?.(); }
  }
  for (const selected of MODELS) { const index = rows.findIndex(row => row.modelId === selected.modelId); if (index < 0) throw new Error("A screen model lacks its first scored task."); first.add(index); if (!options.signal?.aborted && !stopped) await execute(index, true); }
  const pending = rows.map((_, index) => index).filter(index => !first.has(index)); let cursor = 0;
  await Promise.all(Array.from({ length: 24 }, async () => { while (!stopped && !options.signal?.aborted && cursor < pending.length) { const index = pending[cursor++]; if (pins[rows[index].modelId] !== null) await execute(index, false); } }));
  if (fatal) throw fatal;
  return { pins, stopped: stopped || !!options.signal?.aborted, failures };
}

// Direct OpenAI Responses normalization consumes no catalog availability or pricing claims.
const replayMetadata = (modelId: ModelId) => parseOpenAIModel({ id: modelId, object: "model" }, { provider: "openai", modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" });
export function reconstructReport(cases: readonly ImportedCase[], rows: readonly Row[], terminal: boolean) {
  if (cases.length !== 80 || new Set(cases.map(task => task.id)).size !== 80 || DEPTHS.some((depth, ordinal) => LABELS.some((label, index) => cases.filter(task => task.requestedDepth === depth && task.label === label).length !== 3 + Number(index === ordinal % 3)))
    || !sameData(rows.map(row => [row.modelId, row.caseId, row.trialIndex]), createRows(cases).map(row => [row.modelId, row.caseId, row.trialIndex]))) throw new Error("Screen scoring requires the exact 80-task/240-cell plan.");
  const tasks = new Map(cases.map(task => [task.id, task])), ordinals = new Set<number>(), studyIds = new Set<string>();
  for (const row of rows) {
    const task = tasks.get(row.caseId)!, receipt = row.dispatch, result = row.result;
    if (receipt) {
      if (receipt.modelId !== row.modelId || receipt.caseId !== row.caseId || receipt.trialIndex !== 0 || receipt.referenceSha256 !== task.referenceSha256
        || receipt.requestBodySha256 !== sha256(buildBody(task, row.modelId)) || receipt.remoteOutcomeUntilRetained !== "unknown" || !instant(receipt.authorizedAt)
        || Date.parse(receipt.authorizedAt) > Date.now() || !Number.isSafeInteger(receipt.ordinal) || receipt.ordinal < 1 || receipt.ordinal > 240 || ordinals.has(receipt.ordinal)) throw new Error("Screen dispatch binding changed or repeated.");
      ordinals.add(receipt.ordinal); studyIds.add(receipt.studyId);
    }
    if (result) {
      assertAttemptReplay(result, row.modelId, replayMetadata(row.modelId));
      if (result.inferenceRequests !== Number(receipt !== null) || Date.parse(result.finishedAt) > Date.now() || receipt && (Date.parse(result.startedAt) > Date.parse(receipt.authorizedAt) || Date.parse(result.finishedAt) < Date.parse(receipt.authorizedAt))) throw new Error("Screen result lacks compatible authorization chronology.");
    }
  }
  if (studyIds.size > 1 || [...ordinals].some(value => value > ordinals.size)) throw new Error("Screen dispatch ordinals have a gap or mixed study identity.");
  const pins = Object.fromEntries(MODELS.map(({ modelId }) => { const first = rows.find(row => row.modelId === modelId)!.result, id = first?.normalized?.reportedModelId ?? null; return [modelId, hasModelOutcome(first) && acceptedIdentity(modelId, id) ? id : null]; })) as Record<ModelId, string | null>;
  const qualified = (row: Row) => hasModelOutcome(row.result) && pins[row.modelId] !== null && row.result!.normalized?.reportedModelId === pins[row.modelId];
  for (const selected of MODELS) if (pins[selected.modelId] === null && rows.filter(row => row.modelId === selected.modelId).slice(1).some(row => row.dispatch || row.result)) throw new Error("A model continued after its first scored compatibility failure.");
  function score(part: readonly Row[]) {
    const classification = scoreClassifications(part.map(row => ({ caseId: row.caseId, depth: tasks.get(row.caseId)!.requestedDepth, trialIndex: 0, referenceLabel: tasks.get(row.caseId)!.label, outcome: qualified(row) ? row.result!.outcome : null })), 1);
    const modelOutcomes = part.filter(qualified).length, correct = classification.population.correctTrials, wrongValid = part.filter(row => qualified(row) && row.result!.outcome.kind === "answer" && row.result!.outcome.label !== tasks.get(row.caseId)!.label).length;
    const missing = part.filter(row => row.dispatch && !row.result).length;
    return { planned: part.length, dispatched: part.filter(row => row.dispatch).length, modelOutcomes, correct, wrongValid, unusable: modelOutcomes - correct - wrongValid,
      providerFailures: part.filter(row => row.result && !qualified(row)).length + (terminal ? missing : 0), identityFailures: part.filter(row => hasModelOutcome(row.result) && !qualified(row)).length,
      unknownRemote: part.filter(row => row.result?.failure?.remoteOutcome === "unknown").length + (terminal ? missing : 0), inFlight: terminal ? 0 : missing,
      unattempted: part.filter(row => !row.dispatch).length, accuracy: classification.accuracy.value, macroF1: classification.macroF1,
      classification: { population: classification.population, classes: classification.classes, confusion: classification.confusion, outcomes: classification.outcomes },
      usage: part.flatMap(row => row.result?.normalized ? [{ caseId: row.caseId, ...row.result.normalized.usage }] : []), cost: { status: "unknown", amount: null } };
  }
  const models = MODELS.map(selected => ({ modelId: selected.modelId, state: pins[selected.modelId] !== null ? "compatible" : rows.find(row => row.modelId === selected.modelId)!.result ? "unavailable" : "unattempted", acceptedReportedModelId: pins[selected.modelId], reportedModelIds: [...new Set(rows.filter(row => row.modelId === selected.modelId).flatMap(row => row.result?.normalized?.reportedModelId ? [row.result.normalized.reportedModelId] : []))],
    settings: { ...SETTINGS, reasoningEffort: selected.reasoningEffort, reasoningParameter: selected.reasoningEffort === null ? "omitted" : "none" },
    overall: score(rows.filter(row => row.modelId === selected.modelId)), byDepth: DEPTHS.map(requestedDepth => ({ requestedDepth, score: score(rows.filter(row => row.modelId === selected.modelId && tasks.get(row.caseId)!.requestedDepth === requestedDepth)) })) }));
  return { version: "1", methodId: SETTINGS.methodId, terminal, state: terminal ? models.every(item => item.overall.modelOutcomes === 80) ? "complete" : "incomplete" : "running",
    rowsSha256: sha256(rows), models, dispatched: ordinals.size, maximumSends: 240, metadataGetsBeforeFreeze: 3 };
}

export interface Manifest { readonly version: "1"; readonly id: string; readonly frozenAt: string; readonly settings: typeof SETTINGS; readonly models: typeof MODELS;
  readonly operatorSha256: string; readonly apiImplementationSha256: string; readonly parentId: string; readonly parentManifestSha256: string; readonly parentReportSha256: string;
  readonly populationSnapshotSha256: string; readonly cases: readonly ImportedCase[]; readonly caseBindingsSha256: string; readonly requestBindingsSha256: string; readonly metadata: readonly SelectionResult[] }
const parentRoot = resolve(ROOT, "../deep-study-amendment-v2");
const requestBindings = (cases: readonly ImportedCase[]) => cases.flatMap(task => MODELS.map(selected => sha256(buildBody(task, selected.modelId))));
function assertMetadata(snapshots: readonly SelectionResult[]) {
  if (snapshots.length !== 3 || snapshots.some((snapshot, index) => snapshot.request.provider !== "openai" || snapshot.request.modelId !== MODELS[index].modelId || snapshot.request.verification !== "metadata"
    || snapshot.httpAttempts !== 1 || snapshot.httpStatus !== 200 || snapshot.failure !== null || snapshot.budget.maxInferenceRequests !== 0
    || snapshot.status !== "needs-verification" || !sameData(snapshot.metadata, replayMetadata(MODELS[index].modelId)))) throw new Error("Screen metadata GET snapshots changed or claim unverified inference permission.");
}
export async function freeze() {
  if (Bun.version !== "1.4.4") throw new Error("Use the pinned Bun 1.4.4 runtime.");
  const parent = await reportAmendment();
  if (!parent.report.terminal) throw new Error("Screen freeze requires the reviewed parent's terminal report.");
  const cases = selectCases(parent.baseline.cases, parent.amendment.selectedCaseIds), metadata = await Promise.all(MODELS.map(selected => read<SelectionResult>(resolve(ROOT, `../cheap-depth-access-v1/${selected.modelId}.json`))));
  assertMetadata(metadata);
  const content = { version: "1" as const, frozenAt: new Date().toISOString(), settings: SETTINGS, models: MODELS, operatorSha256: await operatorSha256(), apiImplementationSha256: await implementationSha256(),
    parentId: parent.amendment.id, parentManifestSha256: sha256(parent.amendment), parentReportSha256: sha256(parent.report), populationSnapshotSha256: parent.amendment.populationSnapshotSha256,
    cases, caseBindingsSha256: sha256(cases), requestBindingsSha256: sha256(requestBindings(cases)), metadata };
  const manifest: Manifest = { ...content, id: `cheap-depth-screen-v1-${sha256(content)}` };
  await mkdir(ROOT, { mode: 0o700 }); await mkdir(join(ROOT, "attempts"), { mode: 0o700 }); await mkdir(join(ROOT, "events"), { mode: 0o700 });
  await writeArtifact(join(ROOT, "manifest.json"), manifest); return manifest;
}
async function loadManifest(): Promise<Manifest> {
  if (Bun.version !== "1.4.4") throw new Error("Use the pinned Bun 1.4.4 runtime.");
  const manifest = await read<Manifest>(join(ROOT, "manifest.json")), { id, ...content } = manifest;
  if (manifest.version !== "1" || id !== `cheap-depth-screen-v1-${sha256(content)}` || !instant(manifest.frozenAt) || Date.parse(manifest.frozenAt) > Date.now()
    || !sameData(manifest.settings, SETTINGS) || !sameData(manifest.models, MODELS) || manifest.operatorSha256 !== await operatorSha256() || manifest.apiImplementationSha256 !== await implementationSha256()
    || manifest.caseBindingsSha256 !== sha256(manifest.cases) || manifest.requestBindingsSha256 !== sha256(requestBindings(manifest.cases))
    || sha256(await read(join(parentRoot, "amendment.json"))) !== manifest.parentManifestSha256 || sha256(await read(join(parentRoot, "report.json"))) !== manifest.parentReportSha256) throw new Error("Frozen screen source, cases, parent or implementation changed.");
  assertMetadata(manifest.metadata); reconstructReport(manifest.cases, createRows(manifest.cases), false); return manifest;
}
const absent = async (path: string) => { try { await stat(path); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; throw error; } };
export async function run(suppliedCredential: string, acceptCharges: boolean) {
  if (!acceptCharges) throw new Error("Explicit charge acceptance is required for the frozen 240-send ceiling.");
  const credential = parseCredential(suppliedCredential), manifest = await loadManifest(), release = await acquireStudyLock(ROOT), rows = createRows(manifest.cases), controller = new AbortController();
  const stop = new AbortController(), signals: { signal: string; observedAt: string }[] = []; let ordinal = 0, event = 0, failed = false, stopped = false;
  const drain = (signal: string) => { signals.push({ signal, observedAt: new Date().toISOString() }); stopped = true; stop.abort(); };
  const interrupt = () => drain("SIGINT"), terminate = () => drain("SIGTERM"); process.on("SIGINT", interrupt); process.on("SIGTERM", terminate);
  const timer = setTimeout(() => { drain("study-deadline"); controller.abort(); }, SETTINGS.studyTimeoutMs);
  async function save(path: string, value: unknown) { try { if (reflectsCredential(JSON.stringify(value), credential)) throw new Error("Unsafe evidence"); await writeArtifact(join(ROOT, path), value); } catch { failed = true; stopped = true; stop.abort(); throw new Error("Screen persistence failed; retain unknown authorizations and stop fresh work."); } }
  try {
    if (!await absent(join(ROOT, "started.json")) || (await readdir(join(ROOT, "attempts"))).length || (await readdir(join(ROOT, "events"))).length) throw new Error("Screen replay/resumption is forbidden; inspect the existing journal.");
    const startedAt = new Date().toISOString(), started = { studyId: manifest.id, startedAt, operatorSha256: manifest.operatorSha256, deadlineAt: new Date(Date.parse(startedAt) + 1800000).toISOString() }; await save("started.json", started);
    let execution: Awaited<ReturnType<typeof scheduleRows>> | null = null;
    try { execution = await scheduleRows(rows, { signal: stop.signal, abort: () => { stopped = true; stop.abort(); }, persistControl: value => save(`events/event-${event++}.json`, value), execute: async index => {
      const row = rows[index], task = manifest.cases[Math.floor(index / 3)];
      const result = await executeAttempt(task, row.modelId, manifest.metadata.find(item => item.request.modelId === row.modelId)!.metadata!, credential, controller.signal, async () => {
        if (row.dispatch || ordinal >= 240) throw new Error("Repeated or over-budget screen dispatch.");
        const receipt: Receipt = { studyId: manifest.id, ordinal: ++ordinal, modelId: row.modelId, caseId: row.caseId, trialIndex: 0, referenceSha256: task.referenceSha256,
          requestBodySha256: sha256(buildBody(task, row.modelId)), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" };
        await save(`attempts/dispatch-${index}.json`, receipt); row.dispatch = receipt;
      });
      await save(`attempts/result-${index}.json`, { studyId: manifest.id, index, modelId: row.modelId, caseId: row.caseId, dispatchSha256: row.dispatch ? sha256(row.dispatch) : null, result }); row.result = result; return result;
    } }); } catch { failed = true; }
    const terminal = { studyId: manifest.id, finishedAt: new Date().toISOString(), startedSha256: sha256(started), stopped: stopped || execution?.stopped === true, persistenceFailure: failed,
      signals, dispatches: rows.filter(row => row.dispatch).length, rowsSha256: sha256(rows), eventsSha256: sha256(await Promise.all(Array.from({ length: event }, (_, index) => read(join(ROOT, `events/event-${index}.json`))))) };
    await save("terminal.json", terminal); const report = { ...reconstructReport(manifest.cases, rows, true), studyId: manifest.id, evidenceCutoffAt: terminal.finishedAt };
    await save("report.json", report); if (failed) throw new Error("Screen stopped after persistence failure; inspect retained unknown outcomes."); return report;
  } finally { clearTimeout(timer); process.off("SIGINT", interrupt); process.off("SIGTERM", terminate); await release(); }
}
export async function report() {
  const manifest = await loadManifest(), rows = createRows(manifest.cases), names = await readdir(join(ROOT, "attempts"));
  if (names.some(name => !/^(dispatch|result)-(0|[1-9]\d*)\.json$/.test(name))) throw new Error("Unexpected screen journal artifact.");
  for (const [index, row] of rows.entries()) {
    if (names.includes(`dispatch-${index}.json`)) { row.dispatch = await read<Receipt>(join(ROOT, `attempts/dispatch-${index}.json`)); if (row.dispatch.studyId !== manifest.id || Date.parse(row.dispatch.authorizedAt) < Date.parse(manifest.frozenAt)) throw new Error("Screen receipt study/freeze binding changed."); }
    if (names.includes(`result-${index}.json`)) {
      const envelope = await read<{ studyId: string; index: number; modelId: string; caseId: string; dispatchSha256: string | null; result: Attempt }>(join(ROOT, `attempts/result-${index}.json`));
      if (envelope.studyId !== manifest.id || envelope.index !== index || envelope.modelId !== row.modelId || envelope.caseId !== row.caseId || envelope.dispatchSha256 !== (row.dispatch ? sha256(row.dispatch) : null)) throw new Error("Screen result envelope binding changed.");
      row.result = envelope.result; assertAttemptReplay(envelope.result, row.modelId, manifest.metadata.find(item => item.request.modelId === row.modelId)!.metadata!);
    }
  }
  if (names.length !== rows.reduce((sum, row) => sum + Number(row.dispatch !== null) + Number(row.result !== null), 0)) throw new Error("Out-of-cohort screen evidence.");
  const started = await absent(join(ROOT, "started.json")) ? null : await read<{ studyId: string; startedAt: string; operatorSha256: string; deadlineAt: string }>(join(ROOT, "started.json"));
  const eventNames = (await readdir(join(ROOT, "events"))).sort((a, b) => Number(a.slice(6, -5)) - Number(b.slice(6, -5)));
  if (eventNames.some((name, index) => name !== `event-${index}.json`)) throw new Error("Screen control events have a gap.");
  const events = await Promise.all(eventNames.map(name => read<Control>(join(ROOT, "events", name))));
  const terminal = await absent(join(ROOT, "terminal.json")) ? null : await read<{ studyId: string; finishedAt: string; startedSha256: string; dispatches: number; rowsSha256: string; eventsSha256: string }>(join(ROOT, "terminal.json"));
  if (!started && (names.length || events.length || terminal) || started && (started.studyId !== manifest.id || started.operatorSha256 !== manifest.operatorSha256 || !instant(started.startedAt) || Date.parse(started.startedAt) < Date.parse(manifest.frozenAt)
    || !instant(started.deadlineAt) || Date.parse(started.deadlineAt) - Date.parse(started.startedAt) !== 1800000)) throw new Error("Screen start record is inconsistent.");
  if (started && rows.some(row => row.dispatch && Date.parse(row.dispatch.authorizedAt) < Date.parse(started.startedAt) || row.result && Date.parse(row.result.startedAt) < Date.parse(started.startedAt))) throw new Error("Screen evidence precedes its unique start record.");
  if (terminal && (!started || terminal.studyId !== manifest.id || !instant(terminal.finishedAt) || Date.parse(terminal.finishedAt) > Date.now() || Date.parse(terminal.finishedAt) < Date.parse(started.startedAt)
    || terminal.startedSha256 !== sha256(started) || terminal.rowsSha256 !== sha256(rows) || terminal.eventsSha256 !== sha256(events) || terminal.dispatches !== rows.filter(row => row.dispatch).length
    || rows.some(row => row.result && Date.parse(row.result.finishedAt) > Date.parse(terminal.finishedAt)))) throw new Error("Screen terminal binding changed.");
  const orphaned = !!started && !terminal && await absent(join(ROOT, "active.lock"));
  const output = { ...reconstructReport(manifest.cases, rows, terminal !== null || orphaned), studyId: manifest.id, evidenceCutoffAt: terminal?.finishedAt ?? null, sealed: terminal !== null, ...(orphaned ? { state: "interrupted" } : {}) };
  if (!await absent(join(ROOT, "report.json"))) { const retained = await read<Record<string, unknown>>(join(ROOT, "report.json")); const { sealed: _sealed, ...comparable } = output; void _sealed; if (!sameData(retained, comparable)) throw new Error("Retained screen report differs from replay."); }
  return { manifest, rows, report: output };
}

if (import.meta.main) {
  const [command, ...args] = Bun.argv.slice(2);
  if (command === "freeze" && !args.length) { const manifest = await freeze(); console.log(JSON.stringify({ id: manifest.id, cases: manifest.cases.length, maximumSends: 240, operatorSha256: manifest.operatorSha256 })); }
  else if (command === "report" && !args.length) console.log(JSON.stringify((await report()).report));
  else if (command === "run" && args.length === 3 && args[0] === "--credential-env" && /^[A-Z_][A-Z0-9_]*$/.test(args[1]) && args[2] === "--accept-charges") console.log(JSON.stringify(await run(process.env[args[1]] ?? "", true)));
  else throw new Error("Use freeze | report | run --credential-env NAME --accept-charges.");
}
