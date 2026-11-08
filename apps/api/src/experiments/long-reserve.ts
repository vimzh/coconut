// A distinct research method studies the unchanged reserve under a ten-minute deadline without platform run semantics.
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { ModelMetadata } from "../discovery";
import { buildInferencePlan, parseInferenceResponse } from "../inference/adapters";
import type { InferenceRequest, NormalizedInference } from "../inference/types";
import { buildNumericalPrompts } from "../numerics";
import { extractAnswer, type AnswerOutcome } from "../protocol";
import { parseCredential } from "../providers/policy";
import { classifyHttpFailure, reflectsCredential } from "../providers/responses";
import type { AccessFailureCode } from "../providers/types";
import { qualityDataHash } from "../quality";
import { snapshot } from "../quality/data";
import { loadRunSuite } from "../runs/registry";
import { assertStudySendEvidence, type PriorStudy, type StudyReconciliation, type StudySendEvidence } from "./remaining-models";
import { createReserveExperiment, type ReserveInputs, type ReservePriorAccounting } from "./reserve-experiment";
import { experimentPaths } from "./run";

const MODELS = ["gpt-6-astra", "gpt-6.1-sol"] as const, PROFILE = "one-shot-json-v2-max", ENDPOINT = "https://api.openai.com/v1/responses";
export const LONG_RESERVE_DEADLINE_MS = 600000, LONG_RESERVE_STUDY_MS = 5400000;
const STANDARD_SHA = "a27c2ec00a34ac5d448c172126ece0c5a40d9407b1ed44c511f03d42abd69d41";
const STANDARD_LEDGER_SHA = "07ca4c3b50c7dc300440157d1551c0749d7b463e073cf1e07bb3aadd17daefa3";
const STANDARD_RECONCILIATION_SHA = "ee62acdec9b1ee0ec81a6a7704042f9f01b9a8629dc869c4b3ba3a9225403fed";
const STANDARD_SEND_SHA = "a91613e95f40f924f95a7f81d01fa7281bc4b8e83343fcce869826a693a423a2";
type Study = Omit<PriorStudy, "key"> & { readonly key: "original" | "replication" | "interior" | "remaining-models" | "conditional-reserve" };
export interface LongReserveAccounting extends Omit<ReservePriorAccounting, "studies"> { readonly studies: readonly Study[] }
export interface LongReserveInputs extends Omit<ReserveInputs, "accounting" | "priorStudies"> {
  readonly accounting: LongReserveAccounting;
  readonly priorStudies: readonly { readonly key: Study["key"]; readonly manifest: unknown; readonly ledger: ReserveInputs["priorStudies"][number]["ledger"]; readonly reconciliation: StudyReconciliation; readonly sendEvidence: StudySendEvidence }[];
}
export interface LongReserveStudy {
  readonly version: "1"; readonly kind: "research-long-reserve-study"; readonly methodId: "long-reserve-v1"; readonly frozenAt: string;
  readonly referenceBindings: ReturnType<typeof createReserveExperiment>["gates"]; readonly cells: ReturnType<typeof createReserveExperiment>["cells"];
  readonly accounting: LongReserveAccounting; readonly accountingSha256: string; readonly standardStudySha256: string; readonly standardLedgerSha256: string;
  readonly budget: { readonly inferenceTimeoutMs: 600000; readonly studyTimeoutMs: 5400000; readonly maxNewInferenceRequests: 108; readonly cumulativeInferenceCeiling: 7854;
    readonly sharedInferenceCeiling: 8192; readonly parallelModels: 2; readonly concurrencyPerModel: 4; readonly maxConcurrency: 8; readonly trialsPerCase: 3; readonly retries: 0; readonly maxOutputTokens: 16384; readonly maxResponseBytes: 1048576; readonly maxVisibleCodeUnits: 131072 };
  readonly interpretation: string;
}

export function createLongReserveStudy(data: LongReserveInputs): LongReserveStudy {
  const { accounting } = data, study = accounting.studies.find(study => study.key === "conditional-reserve"), source = data.priorStudies.find(source => source.key === "conditional-reserve");
  if (accounting.studies.length !== 5 || new Set(accounting.studies.map(study => study.key)).size !== 5 || data.priorStudies.length !== 5 || new Set(data.priorStudies.map(study => study.key)).size !== 5
    || !study || !source || accounting.totalPriorInferenceRequests !== 7746 || accounting.totalPriorInferenceRequests !== accounting.studies.reduce((sum, study) => sum + study.inferenceRequests, 187)) throw new Error("Exactly five terminal per-attempt reconciled studies and 7746 prior sends are required.");
  const earlier = accounting.studies.filter((study): study is ReservePriorAccounting["studies"][number] => study.key !== "conditional-reserve");
  const standard = createReserveExperiment({ ...data, accounting: { ...accounting, studies: earlier, totalPriorInferenceRequests: earlier.reduce((sum, study) => sum + study.inferenceRequests, 187) },
    priorStudies: data.priorStudies.filter((source): source is ReserveInputs["priorStudies"][number] => source.key !== "conditional-reserve") });
  if (study.manifestPath !== "apps/api/data/experiments/conditional-reserve-matrix-v1.json" || study.ledgerPath !== "apps/api/data/experiments/conditional-reserve-progress-v1.json"
    || study.manifestSha256 !== STANDARD_SHA || study.ledgerSha256 !== STANDARD_LEDGER_SHA || study.reconciliationSha256 !== STANDARD_RECONCILIATION_SHA || study.sendEvidenceSha256 !== STANDARD_SEND_SHA
    || qualityDataHash(source.manifest) !== STANDARD_SHA || qualityDataHash(source.ledger) !== STANDARD_LEDGER_SHA || qualityDataHash(source.reconciliation) !== STANDARD_RECONCILIATION_SHA
    || !["settled", "interrupted"].includes(source.ledger.state) || source.ledger.cells.some(cell => ["running", "cancelling", "active"].includes(cell.state))
    || study.inferenceRequests !== 8 || study.unknownRemoteInferenceRequests !== 8 || source.sendEvidence.records.reduce((sum, row) => sum + row.finishedTrials, 0) !== 8
    || source.sendEvidence.records.flatMap(row => row.attempts).some(attempt => attempt.failure === null || !["timeout", "cancelled"].includes(attempt.failure.code))) throw new Error("The unchanged deadline-censored standard reserve and its eight unknown sends are required.");
  assertStudySendEvidence(study, source, accounting.checkedAt);
  return snapshot({ version: "1", kind: "research-long-reserve-study", methodId: "long-reserve-v1", frozenAt: new Date().toISOString(), referenceBindings: standard.gates, cells: standard.cells,
    accounting, accountingSha256: qualityDataHash(accounting), standardStudySha256: STANDARD_SHA, standardLedgerSha256: STANDARD_LEDGER_SHA,
    budget: { inferenceTimeoutMs: 600000, studyTimeoutMs: 5400000, maxNewInferenceRequests: 108, cumulativeInferenceCeiling: 7854, sharedInferenceCeiling: 8192, parallelModels: 2, concurrencyPerModel: 4, maxConcurrency: 8, trialsPerCase: 3, retries: 0, maxOutputTokens: 16384, maxResponseBytes: 1048576, maxVisibleCodeUnits: 131072 },
    interpretation: "A fresh research-only diagnostic selected by 180-second deadline censoring, with zero observed standard-study answers. All 108 trials are new. The 600-second method is distinct from standard platform inference; no normal RunView, scoring report, ranking, confidence interval or stronger signal is produced. Two related source groups remain exploratory; prior unknown sends and failures remain retained." });
}

async function inputs(accounting: LongReserveAccounting): Promise<LongReserveInputs> {
  const artifact = async (path: string) => {
    if (!/^apps\/api\/data\/experiments\/[a-z0-9][a-z0-9-]*\.json$/.test(path)) throw new Error("Accounting paths must name experiment JSON artifacts.");
    return Bun.file(new URL(`../../../../${path}`, import.meta.url)).json();
  };
  const root = new URL("../../data/", import.meta.url), decision = await Bun.file(new URL("research/conditional-reserve-decision-v1.json", root)).json();
  const suite = await loadRunSuite("reserve-v1", PROFILE); if (suite.generatorVersion !== "reserve-v1") throw new Error("The fixed reserve generator is unavailable.");
  return { accounting, decision, suite, baseSuiteId: (await loadRunSuite("reserve-v1", "one-shot-json-v1")).id, prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), PROFILE, "smooth-v2"),
    controls: (await Bun.file(new URL("experiments/capabilities-v1.json", root)).json()).probes, amendment: await Bun.file(new URL("research/conditional-reserve-amendment-v1.json", root)).json(),
    review: await Bun.file(new URL("quality/reserve-reference-review-v1.json", root)).json(), proposalFileSha256: createHash("sha256").update(new Uint8Array(await Bun.file(new URL("research/conditional-reserve-v1.json", root)).arrayBuffer())).digest("hex"),
    p5Views: await Promise.all(decision.p5.cells.map((cell: { runId: string }) => Bun.file(new URL(`experiments/interior-progress-v1-published/${cell.runId}.json`, root)).json())),
    priorStudies: await Promise.all(accounting.studies.map(async study => ({ key: study.key, manifest: await artifact(study.manifestPath), ledger: await artifact(study.ledgerPath), reconciliation: await artifact(study.reconciliationPath), sendEvidence: await artifact(study.sendEvidencePath) }))) };
}
export async function freezeLongReserveStudy(output: string, accountingPath: string): Promise<LongReserveStudy> {
  if (await Bun.file(output).exists()) throw new Error("The research manifest already exists; choose a new path.");
  if (!accountingPath) throw new Error("Terminal five-study actual-send accounting is required.");
  const manifest = createLongReserveStudy(await inputs(await Bun.file(accountingPath).json()));
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 }); return manifest;
}

type Failure = { code: AccessFailureCode; remoteOutcome: "not-sent" | "unknown" | "response-received" };
export interface LongAttempt {
  readonly methodId: "long-reserve-v1"; readonly startedAt: string; readonly finishedAt: string; readonly inferenceTimeoutMs: 600000;
  readonly inferenceRequests: 0 | 1; readonly httpStatus: number | null; readonly failure: Failure | null;
  readonly rawResponse: unknown; readonly normalized: NormalizedInference | null; readonly outcome: AnswerOutcome;
}
class ResearchFailure extends Error { constructor(readonly code: AccessFailureCode) { super(`Long-reserve operation failed: ${code}.`); } }

export async function readLongBody(response: Response, credential: string, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new ResearchFailure("invalid-provider-response");
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true }), cancel = () => { void reader.cancel().catch(() => {}); }; let size = 0, text = "", drained = false;
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) { const chunk = await reader.read(); signal.throwIfAborted(); if (chunk.done) { drained = true; break; } size += chunk.value.byteLength; if (size > 1048576) throw new ResearchFailure("response-too-large"); text += decoder.decode(chunk.value, { stream: true }); }
    text += decoder.decode(); if (reflectsCredential(text, credential)) throw new ResearchFailure("credential-reflection"); return text;
  } finally { signal.removeEventListener("abort", cancel); if (!drained) cancel(); }
}

export async function executeLongAttempt(request: InferenceRequest, metadata: ModelMetadata, suppliedCredential: string, parentSignal: AbortSignal,
  onDispatch: () => Promise<void>, fetcher: (url: string, options: BunFetchRequestInit) => Promise<Response> = fetch): Promise<LongAttempt> {
  const credential = parseCredential(suppliedCredential), plan = buildInferencePlan(request, metadata), startedAt = new Date().toISOString(), started = performance.now();
  if (request.selection.provider !== "openai" || !MODELS.includes(request.selection.modelId as typeof MODELS[number]) || request.prompt.profileId !== PROFILE || request.prompt.generation.reasoning !== "max" || request.prompt.generation.maxOutputTokens !== 16384
    || plan.url !== ENDPOINT || plan.method !== "POST" || reflectsCredential(plan.body!, credential)) throw new Error("The fixed long-reserve Responses request is invalid.");
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(LONG_RESERVE_DEADLINE_MS)]);
  let sent: 0 | 1 = 0, status: number | null = null, raw: unknown = null, normalized: NormalizedInference | null = null, failure: Failure | null = null, transportFailure: unknown, dispatchPersistenceFailed = false;
  const client = new OpenAI({ apiKey: credential, adminAPIKey: null, organization: null, project: null, webhookSecret: null, dataResidency: null, baseURL: "https://api.openai.com/v1", maxRetries: 0, timeout: LONG_RESERVE_DEADLINE_MS, logLevel: "off",
    fetch: async (input, init) => {
      try {
        if ((input instanceof Request ? input.url : String(input)) !== ENDPOINT || init?.method !== "POST" || typeof init.body !== "string" || qualityDataHash(JSON.parse(init.body)) !== qualityDataHash(JSON.parse(plan.body!)) || sent !== 0) throw new ResearchFailure("invalid-provider-response");
        signal.throwIfAborted(); sent = 1;
        try { await onDispatch(); } catch { dispatchPersistenceFailed = true; throw new Error("Dispatch evidence could not be retained; no wire request was started."); }
        signal.throwIfAborted();
        const response = await fetcher(ENDPOINT, { method: "POST", body: init.body, headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, signal: AbortSignal.any([signal, init.signal ?? signal]), redirect: "manual", credentials: "omit", timeout: false }); status = response.status;
        const text = await readLongBody(response, credential, signal); raw = text;
        try { raw = JSON.parse(text); } catch { throw new ResearchFailure(response.status >= 300 && response.status < 400 ? "redirect-blocked" : "invalid-provider-response"); }
        if (reflectsCredential(JSON.stringify(raw), credential)) throw new ResearchFailure("credential-reflection");
        if (response.status >= 300 && response.status < 400) throw new ResearchFailure("redirect-blocked");
        signal.throwIfAborted();
        if (performance.now() - started >= LONG_RESERVE_DEADLINE_MS) throw new ResearchFailure("timeout");
        return new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } });
      } catch (error) { transportFailure = error; throw error; }
    } });
  try {
    try { await client.responses.create(JSON.parse(plan.body!) as ResponseCreateParamsNonStreaming, { signal, timeout: LONG_RESERVE_DEADLINE_MS, maxRetries: 0 }).asResponse(); }
    catch (error) { if (transportFailure !== undefined) throw transportFailure; if (!(error instanceof OpenAI.APIError && status !== null && raw !== null)) throw error; }
    if (status === null || raw === null) throw new ResearchFailure("invalid-provider-response");
    if (status < 200 || status >= 300) throw new ResearchFailure(classifyHttpFailure(status, raw, true));
    normalized = parseInferenceResponse(raw, request, metadata);
    if (normalized.failure) throw new ResearchFailure(normalized.failure);
    if (normalized.effective.maxOutputTokens !== 16384 || normalized.effective.reasoningEffort !== "max" || normalized.effective.truncation !== "disabled" || normalized.reply.text.length > 131072) throw new ResearchFailure("invalid-provider-response");
    signal.throwIfAborted(); if (performance.now() - started >= LONG_RESERVE_DEADLINE_MS) throw new ResearchFailure("timeout");
  } catch (error) {
    if (dispatchPersistenceFailed) throw new Error("Dispatch evidence could not be retained; inspect conservative authorization counts before further paid work.");
    const code = error instanceof ResearchFailure ? error.code : parentSignal.aborted ? "cancelled" : signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError ? "timeout" : status === null ? "network-error" : "invalid-provider-response";
    failure = { code, remoteOutcome: sent === 0 ? "not-sent" : status === null || ["timeout", "cancelled", "network-error"].includes(code) ? "unknown" : "response-received" };
    if (code === "credential-reflection") { raw = null; normalized = null; }
  }
  const outcome = extractAnswer(failure ? failure.code === "cancelled" ? { status: "cancelled", text: "" } : { status: "provider-error", text: "", message: failure.code } : normalized!.reply, PROFILE);
  const result: LongAttempt = { methodId: "long-reserve-v1", startedAt, finishedAt: new Date().toISOString(), inferenceTimeoutMs: 600000, inferenceRequests: sent, httpStatus: status, failure, rawResponse: raw, normalized, outcome };
  if (reflectsCredential(JSON.stringify(result), credential)) throw new Error("Unsafe long-reserve evidence was discarded."); return result;
}

const isModelOutcome = (attempt: LongAttempt) => attempt.inferenceRequests === 1 && attempt.failure === null && ["answer", "invalid", "refused", "truncated"].includes(attempt.outcome.kind);
export interface LongTrial { readonly modelId: typeof MODELS[number]; readonly caseId: string; readonly trialIndex: number; state: "unattempted" | "active" | "settled"; inferenceRequests: number; result: LongAttempt | null }
export async function scheduleLongTrials(trials: readonly LongTrial[], signal: AbortSignal, execute: (trial: LongTrial) => Promise<void>) {
  if (trials.length !== 108 || new Set(trials.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size !== 108
    || trials.some(row => !MODELS.includes(row.modelId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2)
    || MODELS.some(model => trials.filter(row => row.modelId === model).length !== 54 || new Set(trials.filter(row => row.modelId === model).map(row => row.caseId)).size !== 18)) throw new Error("The research population must contain exactly 108 unique fixed trial identities.");
  return Promise.allSettled(MODELS.flatMap(model => {
    const rows = trials.filter(row => row.modelId === model); let cursor = 0;
    return Array.from({ length: 4 }, async () => { while (!signal.aborted && cursor < rows.length) await execute(rows[cursor++]); });
  }));
}
export function summarizeLongModel(modelId: string, trials: readonly LongTrial[], labels: ReadonlyMap<string, string>) {
  const rows = trials.filter(trial => trial.modelId === modelId), model = rows.filter(trial => trial.result && isModelOutcome(trial.result)), answers = model.filter(trial => trial.result!.outcome.kind === "answer");
  if (rows.length > 54 || new Set(rows.map(row => `${row.caseId}:${row.trialIndex}`)).size !== rows.length || rows.some(row => !labels.has(row.caseId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2)) throw new Error("Research summary trial identities are invalid or repeated.");
  const correct = answers.filter(trial => { const outcome = trial.result!.outcome; return outcome.kind === "answer" && outcome.label === labels.get(trial.caseId); }).length;
  return { modelId, plannedTrials: 54, retainedOutcomes: rows.filter(trial => trial.result !== null).length, modelOutcomes: model.length, validAnswers: answers.length, correctLabels: correct, wrongLabels: answers.length - correct,
    unusableModelOutcomes: model.length - answers.length, infrastructureOutcomes: rows.filter(trial => trial.result?.failure != null || trial.result !== null && !isModelOutcome(trial.result)).length,
    unattemptedTrials: rows.filter(trial => trial.state === "unattempted").length, inferenceRequests: rows.reduce((sum, trial) => sum + trial.inferenceRequests, 0),
    unknownRemoteInferenceRequests: rows.filter(trial => trial.inferenceRequests === 1 && (trial.result === null || trial.result.failure?.remoteOutcome === "unknown")).length,
    populationStatus: rows.length === 54 && model.length === 54 ? "complete" : "unavailable", accuracyAmongValidAnswers: { numerator: correct, denominator: answers.length, value: answers.length ? correct / answers.length : null } };
}
async function store(path: string, value: unknown, credential: string, replace = false): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`; if (reflectsCredential(text, credential)) throw new Error("Unsafe research evidence."); const target = replace ? `${path}.${randomUUID()}.tmp` : path;
  await writeFile(target, text, { flag: "wx", mode: 0o600 }); if (replace) await rename(target, path);
}

export async function runLongReserveStudy(manifestPath: string, output: string, credential: string, acceptCharges: boolean, publish: boolean): Promise<void> {
  if (!acceptCharges || !credential) throw new Error("Explicit provider-charge consent and credential are required."); parseCredential(credential);
  const manifest = await Bun.file(manifestPath).json() as LongReserveStudy, data = await inputs(manifest.accounting), recreated = createLongReserveStudy(data);
  if (qualityDataHash({ ...recreated, frozenAt: manifest.frozenAt }) !== qualityDataHash(manifest) || !Number.isFinite(Date.parse(manifest.frozenAt)) || Date.parse(manifest.frozenAt) > Date.now() || Date.parse(manifest.frozenAt) < Date.parse(data.accounting.checkedAt)) throw new Error("The frozen research method, chronology or lineage changed.");
  const paths = experimentPaths(output), root = paths.privateRoot, publishedRoot = `${paths.output.slice(0, -5)}-research-published`;
  if (publish) { try { await lstat(publishedRoot); throw new Error("Research publication already exists."); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; } }
  await mkdir(new URL("../../data/private/", import.meta.url), { recursive: true, mode: 0o700 }); await mkdir(root, { mode: 0o700 }); await mkdir(join(root, "attempts"), { mode: 0o700 }); await writeFile(paths.output, "{}\n", { flag: "wx", mode: 0o600 });
  const labels = new Map(data.suite.cases.map(entry => [entry.id, entry.label])), trials: LongTrial[] = MODELS.flatMap(modelId => data.suite.cases.flatMap(entry => [0, 1, 2].map(trialIndex => ({ modelId, caseId: entry.id, trialIndex, state: "unattempted" as const, inferenceRequests: 0, result: null }))));
  const controller = new AbortController(), deadline = AbortSignal.timeout(LONG_RESERVE_STUDY_MS), signal = AbortSignal.any([controller.signal, deadline]), stop = () => controller.abort(); let sent = 0, checkpoint = Promise.resolve(); const startedAt = new Date().toISOString();
  const progress = () => ({ version: "1", kind: "research-long-reserve-progress", methodId: manifest.methodId, manifestSha256: qualityDataHash(manifest), startedAt, updatedAt: new Date().toISOString(),
    state: signal.aborted ? "interrupted" : trials.some(trial => trial.state !== "settled") ? "running" : "settled", budget: manifest.budget, inferenceRequests: sent,
    models: MODELS.map(model => summarizeLongModel(model, trials, labels)), outcomes: trials.map(({ modelId, caseId, trialIndex, state, inferenceRequests, result }) => ({ modelId, caseId, trialIndex, state, inferenceRequests, resultSha256: result ? qualityDataHash(result) : null })), interpretation: manifest.interpretation });
  const save = () => { checkpoint = checkpoint.then(() => store(paths.output, progress(), credential, true)).catch(() => { controller.abort(); throw new Error("Research checkpoint persistence failed."); }); return checkpoint; };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    await save();
    const metadataByModel = new Map(MODELS.map(modelId => {
      const metadata = data.controls.find(control => control.modelId === modelId && control.effort === "max")!.result.metadata;
      if (!metadata || !metadata.exactRoute || metadata.modelId !== modelId) throw new Error("Retained model identity metadata is unavailable; no probe or inference was started.");
      return [modelId, metadata] as const;
    }));
    const workers = await scheduleLongTrials(trials, signal, async row => {
          const { modelId } = row, metadata = metadataByModel.get(modelId)!, index = data.suite.cases.findIndex(entry => entry.id === row.caseId), attemptId = randomUUID(); row.state = "active";
          const request: InferenceRequest = { selection: { provider: "openai", modelId, servingProvider: null, profileId: PROFILE, verification: "metadata" }, prompt: data.prompts[index], acceptCharges: true };
          try {
            row.result = await executeLongAttempt(request, metadata, credential, signal, async () => {
              if (signal.aborted || sent >= 108) throw new Error("The research dispatch budget or deadline is exhausted."); sent++; row.inferenceRequests = 1;
              await store(join(root, "attempts", `${attemptId}-dispatch.json`), { version: "1", methodId: manifest.methodId, manifestSha256: qualityDataHash(manifest), attemptId, modelId, caseId: row.caseId, trialIndex: row.trialIndex, dispatchAuthorizedAt: new Date().toISOString(), conservativeInferenceRequests: 1, remoteOutcomeUntilRetained: "unknown" }, credential); await save();
            });
            row.state = "settled"; if (!isModelOutcome(row.result)) controller.abort();
            await store(join(root, "attempts", `${attemptId}-result.json`), { attemptId, modelId, caseId: row.caseId, trialIndex: row.trialIndex, result: row.result }, credential); await save();
          } catch { controller.abort(); throw new Error("Research execution or evidence persistence failed; inspect retained dispatch authorizations before any further paid action."); }
    });
    await save();
    if (publish) {
      await mkdir(publishedRoot, { mode: 0o700 }); const selected: { modelId: string; file: string; sha256: string }[] = [];
      for (const modelId of MODELS) {
        const summary = summarizeLongModel(modelId, trials, labels); if (summary.populationStatus !== "complete") continue;
        const population = { version: "1", kind: "published-research-long-reserve-population", methodId: manifest.methodId, manifestSha256: qualityDataHash(manifest), summary, interpretation: manifest.interpretation,
          outcomes: trials.filter(trial => trial.modelId === modelId).map(trial => ({ caseId: trial.caseId, trialIndex: trial.trialIndex, result: trial.result })) };
        const file = `${modelId}.json`; await store(join(publishedRoot, file), population, credential); selected.push({ modelId, file, sha256: qualityDataHash(population) });
      }
      await store(join(publishedRoot, "index.json"), { version: "1", kind: "research-long-reserve-publication-index", methodId: manifest.methodId, manifestSha256: qualityDataHash(manifest), selected,
        omitted: MODELS.filter(model => !selected.some(row => row.modelId === model)).map(modelId => ({ modelId, reason: "No complete qualified 54-trial research population; infrastructure records remain private." })) }, credential);
    }
    if (workers.some(worker => worker.status === "rejected") || signal.aborted || MODELS.some(model => summarizeLongModel(model, trials, labels).populationStatus !== "complete")) throw new Error("The long-reserve research population did not complete; no retry or replacement was scheduled.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

export function parseLongReserveArguments(args: readonly string[]) {
  const command = args[0], values = new Map<string, string>(); let acceptCharges = false, publish = false; if (command !== "freeze" && command !== "run") throw new Error("Use freeze or run.");
  for (let index = 1; index < args.length; index++) { const arg = args[index]; if (command === "run" && arg === "--accept-charges" && !acceptCharges) acceptCharges = true; else if (command === "run" && arg === "--publish" && !publish) publish = true;
    else if ((arg === "--output" || command === "freeze" && arg === "--prior-accounting" || command === "run" && arg === "--manifest") && !values.has(arg) && args[index + 1] && !args[index + 1].startsWith("--")) values.set(arg, args[++index]); else throw new Error("Use an explicit new output, prior accounting for freeze, or manifest and charge consent for run."); }
  const output = values.get("--output"), manifest = values.get("--manifest"), accounting = values.get("--prior-accounting"); if (!output || command === "freeze" && !accounting || command === "run" && (!manifest || !acceptCharges)) throw new Error("Research freeze accounting or explicit run consent is missing."); return { command, output, manifest, accounting, acceptCharges, publish };
}
if (import.meta.main) {
  try { const args = parseLongReserveArguments(Bun.argv.slice(2)); if (args.command === "freeze") { const manifest = await freezeLongReserveStudy(args.output, args.accounting!); console.log(JSON.stringify({ methodId: manifest.methodId, manifestSha256: qualityDataHash(manifest), budget: manifest.budget })); }
    else await runLongReserveStudy(args.manifest!, args.output, process.env.OPENAI_API_KEY ?? "", args.acceptCharges, args.publish);
  } catch { console.error("Long-reserve research did not complete. Inspect immutable lineage, private dispatch evidence and unknown sends before further paid action. Standard platform records were not changed."); process.exitCode = 1; }
}
