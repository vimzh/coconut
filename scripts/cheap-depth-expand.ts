// Extend the completed private screen without repeating any retained model/case authorization.
import { createHash } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseOpenAIModel } from "../apps/api/src/discovery/catalog";
import { implementationSha256 } from "../apps/api/src/deep-study/execution";
import { populationSnapshotSha256 } from "../apps/api/src/deep-study/snapshot";
import { DEPTHS, validatePopulation } from "../apps/api/src/deep-study/study";
import { parseCredential } from "../apps/api/src/providers/policy";
import { reflectsCredential } from "../apps/api/src/providers/responses";
import { sameData, sha256 } from "../apps/api/src/quality/data";
import { acquireStudyLock, writeArtifact } from "../apps/api/src/randomized/artifacts";
import { IMPORT_LIMITS, readBoundedFile } from "../apps/api/src/randomized/source";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { scoreClassifications } from "../apps/api/src/scoring/classification";
import { reportAmendment } from "./deep-study-amendment";
import { MODELS, SETTINGS, ROOT as SCREEN_ROOT, acceptedIdentity, assertAttemptReplay, buildBody, createRows, executeAttempt, hasModelOutcome,
  operatorSha256 as screenOperatorSha256, reconstructReport as screenReport, report as reportScreen, type Attempt, type Manifest, type ModelId, type Receipt, type Row } from "./cheap-depth-screen";

export { MODELS, SETTINGS, buildBody, executeAttempt, assertAttemptReplay };
export type { Attempt, ModelId, Receipt, Row };
export const ROOT = resolve(import.meta.dir, "../apps/api/data/private/cheap-depth-expand-v1");
export const EXPANSION_SETTINGS = Object.freeze({ maxRequests: 2400, priorRequests: 240, maxNewRequests: 2160, concurrencyCaps: [120, 96, 72], studyTimeoutMs: 1800000, retries: 0 } as const);
const HASH = /^[a-f0-9]{64}$/;
const identity = (row: Row) => `${row.modelId}:${row.caseId}:${row.trialIndex}`;
const instant = (value: string) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readBoundedFile(path)) as T;
const absent = async (path: string) => { try { await stat(path); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; throw error; } };
const requests = (cases: readonly ImportedCase[]) => cases.flatMap(task => MODELS.map(m => sha256(buildBody(task, m.modelId))));
const metadata = (modelId: ModelId) => parseOpenAIModel({ id: modelId, object: "model" }, { provider: "openai", modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" });
export async function operatorSha256() { return createHash("sha256").update(await Bun.file(new URL(import.meta.url)).bytes()).digest("hex"); }

export interface Bindings { readonly frozenAt: string; readonly operatorSha256: string; readonly apiImplementationSha256: string; readonly screenOperatorSha256: string;
  readonly screenRootSnapshotSha256: string; readonly parentId: string; readonly parentManifestSha256: string; readonly parentReportSha256: string; readonly populationSnapshotSha256: string }
export interface Expansion extends Bindings { readonly version: "1"; readonly id: string; readonly settings: typeof EXPANSION_SETTINGS; readonly cases: readonly ImportedCase[];
  readonly screenManifest: Manifest; readonly screenReport: ReturnType<typeof screenReport>; readonly baselineRows: readonly Row[]; readonly pins: Readonly<Record<ModelId, string>>;
  readonly caseBindingsSha256: string; readonly requestBindingsSha256: string }
export function createExpansion(cases: readonly ImportedCase[], manifest: Manifest, rows: readonly Row[], retainedReport: ReturnType<typeof screenReport>, bindings: Bindings): Expansion {
  validatePopulation(cases);
  const expected = screenReport(manifest.cases, rows, true), { sealed: _sealed, ...comparable } = retainedReport as typeof retainedReport & { sealed?: boolean }; void _sealed;
  if (!expected.terminal || !sameData(expected, Object.fromEntries(Object.entries(comparable).filter(([key]) => !["studyId", "evidenceCutoffAt"].includes(key))))
    || rows.length !== 240 || rows.some(row => !row.dispatch || !row.result) || rows.some(row => row.dispatch!.studyId !== manifest.id)
    || !sameData(manifest.settings, SETTINGS) || !sameData(manifest.models, MODELS) || manifest.operatorSha256 !== bindings.screenOperatorSha256
    || manifest.apiImplementationSha256 !== bindings.apiImplementationSha256 || manifest.populationSnapshotSha256 !== bindings.populationSnapshotSha256
    || manifest.parentId !== bindings.parentId || manifest.parentManifestSha256 !== bindings.parentManifestSha256 || manifest.parentReportSha256 !== bindings.parentReportSha256
    || manifest.cases.some(task => !sameData(task, cases.find(item => item.id === task.id))) || !instant(bindings.frozenAt) || Date.parse(bindings.frozenAt) > Date.now()
    || rows.some(row => Date.parse(row.result!.finishedAt) > Date.parse(bindings.frozenAt)) || Object.entries(bindings).some(([key, value]) => key.endsWith("Sha256") && !HASH.test(value))) throw new Error("Expansion requires the unchanged certified population and all 240 sealed screen results.");
  const pins = Object.fromEntries(MODELS.map(m => { const first = rows.find(row => row.modelId === m.modelId)!.result!, id = first.normalized?.reportedModelId ?? null;
    if (!hasModelOutcome(first) || !acceptedIdentity(m.modelId, id)) throw new Error("An inherited model lacks its accepted scored identity pin."); return [m.modelId, id!]; })) as Record<ModelId, string>;
  const content = { ...bindings, version: "1" as const, settings: EXPANSION_SETTINGS, cases, screenManifest: manifest, screenReport: retainedReport, baselineRows: rows, pins,
    caseBindingsSha256: sha256(cases), requestBindingsSha256: sha256(requests(cases)) };
  return { ...content, id: `cheap-depth-expand-v1-${sha256(content)}` };
}
export function assertExpansion(value: Expansion) { const { version: _version, id: _id, settings: _settings, cases, screenManifest, screenReport: retained, baselineRows, pins: _pins,
  caseBindingsSha256: _cases, requestBindingsSha256: _requests, ...bindings } = value; void [_version, _id, _settings, _pins, _cases, _requests];
  if (!sameData(value, createExpansion(cases, screenManifest, baselineRows, retained, bindings))) throw new Error("Frozen expansion baseline or source binding changed."); }
export function initialRows(value: Expansion): Row[] { assertExpansion(value); const prior = new Map(value.baselineRows.map(row => [identity(row), row]));
  return createRows(value.cases).map(row => { const old = prior.get(identity(row)); return old ? { ...old } : row; }); }

export interface Control { readonly kind: "rate-cap" | "rate-wait" | "stop-fresh"; readonly generation: number; readonly from: number; readonly to: number;
  readonly index: number; readonly observedAt: string; readonly cooldownMs: number; readonly reason: string }
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (value === null || value.length > 256) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) { const ms = Number(value) * 1000; return Number.isFinite(ms) ? ms : undefined; }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const date = Date.parse(value); return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}
export async function scheduleRows(rows: readonly Row[], options: { readonly pins: Readonly<Record<ModelId, string>>; readonly execute: (index: number, generation: number) => Promise<{ result: Attempt; retryAfterMs?: number }>;
  readonly persistControl: (event: Control) => Promise<void>; readonly signal: AbortSignal; readonly now?: () => number; readonly sleep?: (ms: number) => Promise<void>; readonly abort?: () => void }) {
  if (rows.length !== 2400 || new Set(rows.map(identity)).size !== 2400 || rows.filter(row => row.dispatch).length !== 240 || rows.some(row => !!row.dispatch !== !!row.result)) throw new Error("Expansion scheduling requires exactly 240 retained and 2160 fresh unique cells.");
  const pending = rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.dispatch), now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise<void>(resolveSleep => { const done = () => { clearTimeout(timer); options.signal.removeEventListener("abort", done); resolveSleep(); }, timer = setTimeout(done, ms); options.signal.addEventListener("abort", done, { once: true }); if (options.signal.aborted) done(); }));
  let cursor = 0, generation = 0, cap: number = 120, cooldownUntil = 0, draining = false, stopped = false, fatal: unknown, reason: string | null = null;
  type Settled = { index: number; generation: number } & ({ value: { result: Attempt; retryAfterMs?: number }; error?: never } | { error: unknown; value?: never });
  const active = new Map<number, Promise<Settled>>();
  const control = (kind: Control["kind"], index: number, from: number, to: number, cooldownMs: number, why: string) => options.persistControl({ kind, index, generation, from, to, cooldownMs, reason: why, observedAt: new Date(now()).toISOString() });
  while (cursor < pending.length || active.size) {
    if (!active.size) draining = false;
    if (options.signal.aborted) { stopped = true; reason ??= "operator-or-deadline"; }
    while (!stopped && !draining && now() >= cooldownUntil && active.size < cap && cursor < pending.length) { const { index } = pending[cursor++], dispatchedGeneration = generation;
      active.set(index, Promise.resolve().then(() => options.execute(index, dispatchedGeneration)).then(value => ({ index, generation: dispatchedGeneration, value }), error => ({ index, generation: dispatchedGeneration, error }))); }
    if (!active.size) { if (stopped || cursor === pending.length) break; await sleep(Math.max(0, cooldownUntil - now())); continue; }
    const settled = await Promise.race(active.values()); active.delete(settled.index);
    if ("error" in settled) { stopped = true; reason ??= "execution-or-persistence"; fatal ??= settled.error; options.abort?.(); continue; }
    const { result, retryAfterMs } = settled.value; rows[settled.index].result = result;
    try {
      if (result.failure?.code === "rate-limited") {
        if (!stopped) {
          if (cap === 72 && settled.generation === generation || retryAfterMs !== undefined && (!Number.isFinite(retryAfterMs) || retryAfterMs < 0 || retryAfterMs > 1800000)) {
            stopped = true; reason = cap === 72 && settled.generation === generation ? "rate-limited-at-72" : "retry-after-exceeds-phase"; await control("stop-fresh", settled.index, cap, cap, 0, reason);
          } else if (settled.generation !== generation) { const delay = retryAfterMs ?? 5000;
            await control("rate-wait", settled.index, cap, cap, delay, "stale-generation-rate-limited"); cooldownUntil = Math.max(cooldownUntil, now() + delay); draining = true;
          } else { const next = EXPANSION_SETTINGS.concurrencyCaps[++generation], delay = retryAfterMs ?? 5000;
            await control("rate-cap", settled.index, cap, next, delay, "rate-limited"); cap = next; cooldownUntil = now() + delay; draining = true; }
        }
      } else if (!hasModelOutcome(result) || result.normalized?.reportedModelId !== options.pins[rows[settled.index].modelId]) {
        if (!stopped) { stopped = true; reason = result.failure?.code ?? "identity-mismatch"; await control("stop-fresh", settled.index, cap, cap, 0, reason); }
      }
    } catch (error) { stopped = true; reason = "control-persistence"; fatal ??= error; options.abort?.(); }
  }
  if (fatal) throw fatal;
  return { stopped, stopReason: reason, cap, dispatched: cursor, generation };
}

export function reconstructReport(cases: readonly ImportedCase[], rows: readonly Row[], pins: Readonly<Record<ModelId, string>>, terminal: boolean) {
  validatePopulation(cases);
  if (!sameData(rows.map(identity), createRows(cases).map(identity)) || MODELS.some(m => !acceptedIdentity(m.modelId, pins[m.modelId]))) throw new Error("Expansion rows or accepted identity pins changed.");
  const tasks = new Map(cases.map(task => [task.id, task])), ordinals = new Set<number>(), studies = new Set<string>();
  for (const row of rows) { const task = tasks.get(row.caseId)!, receipt = row.dispatch, result = row.result;
    if (receipt) { if (receipt.modelId !== row.modelId || receipt.caseId !== row.caseId || receipt.trialIndex !== 0 || receipt.referenceSha256 !== task.referenceSha256 || receipt.requestBodySha256 !== sha256(buildBody(task, row.modelId))
      || !instant(receipt.authorizedAt) || Date.parse(receipt.authorizedAt) > Date.now() || receipt.remoteOutcomeUntilRetained !== "unknown" || !Number.isSafeInteger(receipt.ordinal) || receipt.ordinal < 1 || receipt.ordinal > 2400 || ordinals.has(receipt.ordinal)) throw new Error("Expansion dispatch binding changed or repeated."); ordinals.add(receipt.ordinal); studies.add(receipt.studyId); }
    if (result) { assertAttemptReplay(result, row.modelId, metadata(row.modelId)); if (result.inferenceRequests !== Number(!!receipt) || Date.parse(result.finishedAt) > Date.now() || receipt && (Date.parse(result.startedAt) > Date.parse(receipt.authorizedAt) || Date.parse(result.finishedAt) < Date.parse(receipt.authorizedAt))) throw new Error("Expansion result lacks compatible dispatch chronology."); }
  }
  if (studies.size > 2 || [...ordinals].some(n => n > ordinals.size)) throw new Error("Expansion ordinals have a gap or unrelated study.");
  const qualified = (row: Row) => hasModelOutcome(row.result) && row.result!.normalized?.reportedModelId === pins[row.modelId];
  function score(part: readonly Row[]) { const classification = scoreClassifications(part.map(row => ({ caseId: row.caseId, depth: tasks.get(row.caseId)!.requestedDepth, trialIndex: 0, referenceLabel: tasks.get(row.caseId)!.label, outcome: qualified(row) ? row.result!.outcome : null })), 1);
    const modelOutcomes = part.filter(qualified).length, correct = classification.population.correctTrials, wrongValid = part.filter(row => qualified(row) && row.result!.outcome.kind === "answer" && row.result!.outcome.label !== tasks.get(row.caseId)!.label).length, missing = part.filter(row => row.dispatch && !row.result).length;
    return { planned: part.length, dispatched: part.filter(row => row.dispatch).length, modelOutcomes, correct, wrongValid, unusable: modelOutcomes - correct - wrongValid,
      providerFailures: part.filter(row => row.result && !qualified(row)).length + (terminal ? missing : 0), identityFailures: part.filter(row => hasModelOutcome(row.result) && !qualified(row)).length,
      unknownRemote: part.filter(row => row.result?.failure?.remoteOutcome === "unknown").length + (terminal ? missing : 0), inFlight: terminal ? 0 : missing, unattempted: part.filter(row => !row.dispatch && !row.result).length,
      accuracy: classification.accuracy.value, macroF1: classification.macroF1, classification: { population: classification.population, classes: classification.classes, confusion: classification.confusion, outcomes: classification.outcomes }, usage: part.flatMap(row => row.result?.normalized ? [{ caseId: row.caseId, ...row.result.normalized.usage }] : []), cost: { status: "unknown", amount: null } };
  }
  return { version: "1" as const, terminal, state: terminal ? rows.every(qualified) ? "complete" : "incomplete" : "running", plannedTasksPerModel: 800, requestedDepths: DEPTHS, taskCounts: DEPTHS.map(requestedDepth => ({ requestedDepth, tasks: 100 })), rowsSha256: sha256(rows), dispatched: ordinals.size,
    maximumSends: 2400, inheritedSends: 240, maximumNewSends: 2160, expansionSettings: EXPANSION_SETTINGS, models: MODELS.map(m => ({ modelId: m.modelId, reportedModelId: pins[m.modelId], settings: { ...SETTINGS, maxRequests: 2400, concurrency: 120, reasoningEffort: m.reasoningEffort, reasoningParameter: m.reasoningEffort ?? "omitted" }, overall: score(rows.filter(row => row.modelId === m.modelId)),
      byDepth: DEPTHS.map(requestedDepth => ({ requestedDepth, realizedDepths: [...new Set(cases.filter(task => task.requestedDepth === requestedDepth).map(task => task.actualDepth))].sort((a, b) => a - b), score: score(rows.filter(row => row.modelId === m.modelId && tasks.get(row.caseId)!.requestedDepth === requestedDepth)) })) })) };
}

// The completed screen is snapshotted before any new journal exists; later reads preserve its exact bytes.
export async function freeze() {
  if (Bun.version !== "1.4.4") throw new Error("Use the pinned Bun 1.4.4 runtime.");
  if (!await absent(join(SCREEN_ROOT, "active.lock"))) throw new Error("The completed screen must release its lock before expansion.");
  const snapshot = await populationSnapshotSha256(join(SCREEN_ROOT, "manifest.json")), prior = await reportScreen(), parent = await reportAmendment();
  if (!prior.report.sealed || !parent.report.terminal) throw new Error("Expansion requires sealed screen and certified parent reports.");
  const expansion = createExpansion(parent.baseline.cases, prior.manifest, prior.rows, prior.report, { frozenAt: new Date().toISOString(), operatorSha256: await operatorSha256(),
    apiImplementationSha256: await implementationSha256(), screenOperatorSha256: await screenOperatorSha256(), screenRootSnapshotSha256: snapshot,
    parentId: parent.amendment.id, parentManifestSha256: sha256(parent.amendment), parentReportSha256: sha256(parent.report), populationSnapshotSha256: parent.amendment.populationSnapshotSha256 });
  if (snapshot !== await populationSnapshotSha256(join(SCREEN_ROOT, "manifest.json"))) throw new Error("The completed screen changed during expansion freeze.");
  if (Buffer.byteLength(JSON.stringify(expansion, null, 2)) + 1 > IMPORT_LIMITS.fileBytes) throw new Error("Expansion manifest exceeds its existing 64 MiB artifact bound.");
  await mkdir(ROOT, { mode: 0o700 }); await mkdir(join(ROOT, "attempts"), { mode: 0o700 }); await mkdir(join(ROOT, "events"), { mode: 0o700 });
  await writeArtifact(join(ROOT, "manifest.json"), expansion); return expansion;
}
async function loadManifest() {
  if (Bun.version !== "1.4.4") throw new Error("Use the pinned Bun 1.4.4 runtime.");
  const expansion = await read<Expansion>(join(ROOT, "manifest.json")); assertExpansion(expansion);
  const parentRoot = resolve(ROOT, "../deep-study-amendment-v2"), parent = await read<{ originalStudySha256: string }>(join(parentRoot, "amendment.json")), original = await read<{ populationPath: string }>(resolve(ROOT, "../deep-study-v1/study.json"));
  if (expansion.operatorSha256 !== await operatorSha256() || expansion.screenOperatorSha256 !== await screenOperatorSha256() || expansion.apiImplementationSha256 !== await implementationSha256()
    || expansion.screenRootSnapshotSha256 !== await populationSnapshotSha256(join(SCREEN_ROOT, "manifest.json")) || !await absent(join(SCREEN_ROOT, "active.lock"))
    || sha256(parent) !== expansion.parentManifestSha256 || sha256(await read(join(parentRoot, "report.json"))) !== expansion.parentReportSha256 || sha256(original) !== parent.originalStudySha256
    || await populationSnapshotSha256(original.populationPath) !== expansion.populationSnapshotSha256) throw new Error("Expansion implementation, prior journal, source population or parent binding changed.");
  return expansion;
}
export interface Envelope { readonly studyId: string; readonly index: number; readonly generation: number; readonly modelId: ModelId; readonly caseId: string;
  readonly dispatchSha256: string | null; readonly responseHeaders: Readonly<Record<string, string>>; readonly responseHeadersObservedAt: string | null; readonly retryAfterMs: number | null; readonly result: Attempt }
const allowedHeader = (key: string) => key === "retry-after" || /^x-ratelimit-(limit|remaining|reset)-(requests|tokens)$/.test(key);
export async function run(suppliedCredential: string, acceptCharges: boolean) {
  if (!acceptCharges) throw new Error("Explicit charge acceptance is required for at most 2160 additional sends and 2400 total cells.");
  const credential = parseCredential(suppliedCredential), expansion = await loadManifest(), release = await acquireStudyLock(ROOT), rows = initialRows(expansion), wire = new AbortController(), stop = new AbortController();
  let ordinal = 240, event = 0, failed = false; const signals: { signal: string; observedAt: string }[] = [];
  const drain = (signal: string) => { signals.push({ signal, observedAt: new Date().toISOString() }); stop.abort(); }, interrupt = () => drain("SIGINT"), terminate = () => drain("SIGTERM");
  process.on("SIGINT", interrupt); process.on("SIGTERM", terminate); const timer = setTimeout(() => { drain("study-deadline"); wire.abort(); }, 1800000);
  async function save(path: string, value: unknown) { try { if (reflectsCredential(JSON.stringify(value), credential)) throw new Error("Unsafe evidence"); await writeArtifact(join(ROOT, path), value); }
    catch { failed = true; stop.abort(); throw new Error("Expansion persistence failed; drain peers and retain unknown authorizations."); } }
  try {
    if (!await absent(join(ROOT, "started.json")) || (await readdir(join(ROOT, "attempts"))).length || (await readdir(join(ROOT, "events"))).length) throw new Error("Expansion replay or resumption is forbidden.");
    const startedAt = new Date().toISOString(), started = { studyId: expansion.id, startedAt, operatorSha256: expansion.operatorSha256, deadlineAt: new Date(Date.parse(startedAt) + 1800000).toISOString() }; await save("started.json", started);
    let execution: Awaited<ReturnType<typeof scheduleRows>> | null = null;
    try { execution = await scheduleRows(rows, { pins: expansion.pins, signal: stop.signal, abort: () => stop.abort(), persistControl: value => save(`events/event-${event++}.json`, value), execute: async (index, generation) => {
      const row = rows[index], task = expansion.cases[Math.floor(index / 3)]; let responseHeaders: Record<string, string> = {}, responseHeadersObservedAt: string | null = null;
      const result = await executeAttempt(task, row.modelId, expansion.screenManifest.metadata.find(item => item.request.modelId === row.modelId)!.metadata!, credential, wire.signal, async () => {
        if (row.dispatch || row.result || ordinal >= 2400) throw new Error("Repeated or over-budget expansion dispatch.");
        const receipt: Receipt = { studyId: expansion.id, ordinal: ++ordinal, modelId: row.modelId, caseId: row.caseId, trialIndex: 0, referenceSha256: task.referenceSha256,
          requestBodySha256: sha256(buildBody(task, row.modelId)), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" };
        await save(`attempts/dispatch-${index}.json`, receipt); row.dispatch = receipt;
      }, async (url, init) => { const response = await fetch(url, init); responseHeadersObservedAt = new Date().toISOString(); responseHeaders = Object.fromEntries([...response.headers].filter(([key, value]) => allowedHeader(key) && value.length <= 256)); return response; });
      const retryAfterMs = responseHeadersObservedAt ? parseRetryAfter(responseHeaders["retry-after"] ?? null, Date.parse(responseHeadersObservedAt)) : undefined;
      const envelope: Envelope = { studyId: expansion.id, index, generation, modelId: row.modelId, caseId: row.caseId, dispatchSha256: row.dispatch ? sha256(row.dispatch) : null,
        responseHeaders, responseHeadersObservedAt, retryAfterMs: retryAfterMs ?? null, result };
      await save(`attempts/result-${index}.json`, envelope); row.result = result; return { result, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) };
    } }); } catch { failed = true; }
    const terminal = { studyId: expansion.id, finishedAt: new Date().toISOString(), startedSha256: sha256(started), stopped: stop.signal.aborted || execution?.stopped === true, persistenceFailure: failed,
      signals, dispatches: rows.filter(row => row.dispatch).length, newDispatches: rows.filter(row => row.dispatch?.studyId === expansion.id).length, rowsSha256: sha256(rows), eventsSha256: sha256(await Promise.all(Array.from({ length: event }, (_, index) => read(join(ROOT, `events/event-${index}.json`))))) };
    await save("terminal.json", terminal); const report = { ...reconstructReport(expansion.cases, rows, expansion.pins, true), studyId: expansion.id, evidenceCutoffAt: terminal.finishedAt };
    await save("report.json", report); if (failed) throw new Error("Expansion stopped after persistence failure; inspect retained unknown authorizations."); return report;
  } finally { clearTimeout(timer); process.off("SIGINT", interrupt); process.off("SIGTERM", terminate); await release(); }
}
export async function report() {
  const expansion = await loadManifest(), rows = initialRows(expansion), prior = new Map(expansion.baselineRows.map(row => [identity(row), row])), names = await readdir(join(ROOT, "attempts"));
  if (names.some(name => !/^(dispatch|result)-(0|[1-9]\d*)\.json$/.test(name))) throw new Error("Unexpected expansion journal artifact.");
  const eventNames = (await readdir(join(ROOT, "events"))).sort((a, b) => Number(a.slice(6, -5)) - Number(b.slice(6, -5)));
  if (eventNames.some((name, index) => name !== `event-${index}.json`)) throw new Error("Expansion control events have a gap.");
  const events = await Promise.all(eventNames.map(name => read<Control>(join(ROOT, "events", name)))), envelopes: Envelope[] = [];
  for (const [index, row] of rows.entries()) {
    if (prior.has(identity(row)) && (names.includes(`dispatch-${index}.json`) || names.includes(`result-${index}.json`))) throw new Error("An inherited cell was resent or rewritten.");
    if (names.includes(`dispatch-${index}.json`)) { row.dispatch = await read<Receipt>(join(ROOT, `attempts/dispatch-${index}.json`)); if (row.dispatch.studyId !== expansion.id || row.dispatch.ordinal <= 240 || Date.parse(row.dispatch.authorizedAt) < Date.parse(expansion.frozenAt)) throw new Error("Expansion receipt lost its study/freeze binding."); }
    if (names.includes(`result-${index}.json`)) { const value = await read<Envelope>(join(ROOT, `attempts/result-${index}.json`));
      if (value.studyId !== expansion.id || value.index !== index || value.modelId !== row.modelId || value.caseId !== row.caseId || value.dispatchSha256 !== (row.dispatch ? sha256(row.dispatch) : null)
        || !Number.isInteger(value.generation) || value.generation < 0 || value.generation > 2 || Object.entries(value.responseHeaders).some(([key, val]) => !allowedHeader(key) || typeof val !== "string" || val.length > 256)
        || value.responseHeadersObservedAt !== null && (!instant(value.responseHeadersObservedAt) || Date.parse(value.responseHeadersObservedAt) < Date.parse(value.result.startedAt) || Date.parse(value.responseHeadersObservedAt) > Date.parse(value.result.finishedAt))
        || value.retryAfterMs !== (value.responseHeadersObservedAt ? parseRetryAfter(value.responseHeaders["retry-after"] ?? null, Date.parse(value.responseHeadersObservedAt)) ?? null : null)
        || value.responseHeadersObservedAt === null && Object.keys(value.responseHeaders).length) throw new Error("Expansion result envelope or bounded response-header binding changed.");
      row.result = value.result; envelopes.push(value);
    }
  }
  if (names.length !== rows.filter(row => !prior.has(identity(row))).reduce((n, row) => n + Number(!!row.dispatch) + Number(!!row.result), 0)) throw new Error("Out-of-cohort expansion evidence.");
  const started = await absent(join(ROOT, "started.json")) ? null : await read<{ studyId: string; startedAt: string; operatorSha256: string; deadlineAt: string }>(join(ROOT, "started.json")), terminal = await absent(join(ROOT, "terminal.json")) ? null : await read<{ studyId: string; finishedAt: string; startedSha256: string; rowsSha256: string; eventsSha256: string; dispatches: number; newDispatches: number }>(join(ROOT, "terminal.json"));
  if (!started && (names.length || events.length || terminal) || started && (started.studyId !== expansion.id || started.operatorSha256 !== expansion.operatorSha256 || !instant(started.startedAt) || Date.parse(started.startedAt) < Date.parse(expansion.frozenAt) || !instant(started.deadlineAt) || Date.parse(started.deadlineAt) - Date.parse(started.startedAt) !== 1800000)) throw new Error("Expansion start binding changed.");
  const fresh = rows.filter(row => !prior.has(identity(row)));
  if (started && fresh.some(row => row.dispatch && (Date.parse(row.dispatch.authorizedAt) < Date.parse(started.startedAt) || Date.parse(row.dispatch.authorizedAt) > Date.parse(started.deadlineAt)) || row.result && Date.parse(row.result.startedAt) < Date.parse(started.startedAt))) throw new Error("Expansion evidence is outside its unique phase start/deadline.");
  let generation = 0, cap: number = 120, stopped = false;
  for (const event of events) { const row = rows[event.index], envelope = envelopes.find(value => value.index === event.index);
    if (!row || !row.result || !envelope || !instant(event.observedAt) || Date.parse(event.observedAt) < Date.parse(row.result.finishedAt) || !Number.isFinite(event.cooldownMs) || event.cooldownMs < 0 || event.cooldownMs > 1800000 || event.from !== cap || stopped) throw new Error("Expansion control evidence is inconsistent.");
    if (event.kind === "rate-cap") { if (row.result.failure?.code !== "rate-limited" || event.generation !== ++generation || envelope.generation !== generation - 1 || generation > 2 || event.to !== EXPANSION_SETTINGS.concurrencyCaps[generation] || event.reason !== "rate-limited" || event.cooldownMs < (envelope.retryAfterMs ?? 5000)) throw new Error("Expansion rate transition changed."); cap = event.to; }
    else if (event.kind === "rate-wait" && row.result.failure?.code === "rate-limited" && event.generation === generation && envelope.generation < generation && event.to === cap && event.reason === "stale-generation-rate-limited" && event.cooldownMs >= (envelope.retryAfterMs ?? 5000)) { /* An old generation can extend the minimum cooldown without another cap reduction. */ }
    else if (event.kind === "stop-fresh" && event.generation === generation && event.to === cap && event.cooldownMs === 0 && (!hasModelOutcome(row.result) || row.result.normalized?.reportedModelId !== expansion.pins[row.modelId])) stopped = true;
    else throw new Error("Unknown expansion control event.");
  }
  for (const value of envelopes) { const transition = events.find(event => event.kind === "rate-cap" && event.generation === value.generation), next = events.find(event => event.kind === "rate-cap" && event.generation === value.generation + 1);
    if (value.generation > generation || value.generation > 0 && (!transition || events.some(event => event.kind !== "stop-fresh" && event.generation <= value.generation && Date.parse(value.result.startedAt) < Date.parse(event.observedAt) + event.cooldownMs))
      || next && Date.parse(value.result.startedAt) > Date.parse(next.observedAt)
      || envelopes.some(previous => previous.generation < value.generation && Date.parse(previous.result.finishedAt) > Date.parse(value.result.startedAt))) throw new Error("Expansion result generation, drain barrier or cooldown changed."); }
  if (terminal && (!started || terminal.studyId !== expansion.id || !instant(terminal.finishedAt) || Date.parse(terminal.finishedAt) > Date.now() || Date.parse(terminal.finishedAt) < Date.parse(started.startedAt)
    || terminal.startedSha256 !== sha256(started) || terminal.rowsSha256 !== sha256(rows) || terminal.eventsSha256 !== sha256(events) || terminal.dispatches !== rows.filter(row => row.dispatch).length || terminal.newDispatches !== fresh.filter(row => row.dispatch).length || fresh.some(row => row.result && Date.parse(row.result.finishedAt) > Date.parse(terminal.finishedAt)))) throw new Error("Expansion terminal binding changed.");
  const orphaned = !!started && !terminal && await absent(join(ROOT, "active.lock")), output = { ...reconstructReport(expansion.cases, rows, expansion.pins, terminal !== null || orphaned), studyId: expansion.id, evidenceCutoffAt: terminal?.finishedAt ?? null, sealed: terminal !== null };
  if (!await absent(join(ROOT, "report.json"))) { const { sealed: _sealed, ...comparable } = output; void _sealed; if (!sameData(await read(join(ROOT, "report.json")), comparable)) throw new Error("Retained expansion report differs from replay."); }
  return { expansion, rows, report: output };
}
if (import.meta.main) { const [command, ...args] = Bun.argv.slice(2);
  if (command === "freeze" && !args.length) { const value = await freeze(); console.log(JSON.stringify({ id: value.id, cases: value.cases.length, maximumNewSends: 2160, maximumSends: 2400, operatorSha256: value.operatorSha256 })); }
  else if (command === "report" && !args.length) console.log(JSON.stringify((await report()).report));
  else if (command === "run" && args.length === 3 && args[0] === "--credential-env" && /^[A-Z_][A-Z0-9_]*$/.test(args[1]) && args[2] === "--accept-charges") console.log(JSON.stringify(await run(process.env[args[1]] ?? "", true)));
  else throw new Error("Use freeze | report | run --credential-env NAME --accept-charges.");
}
