// Continue a separately frozen research cohort without rewriting or repeating the original paid attempts.
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assertAttemptReplay } from "../apps/api/src/deep-study/audit";
import { DEEP_ROOT, implementationSha256, reconcileStudy, type OutcomeAudit } from "../apps/api/src/deep-study/execution";
import { populationSnapshotSha256 } from "../apps/api/src/deep-study/snapshot";
import { caseBindings, DEPTHS, hasModelOutcome, reconstructReport, validatePopulation, type DeepReceipt, type DeepRow, type DeepStudy } from "../apps/api/src/deep-study/study";
import { buildDeepRequestBody, DEEP_MODELS, DEEP_SETTINGS, executeDeepAttempt } from "../apps/api/src/deep-study/transport";
import { parseCredential } from "../apps/api/src/providers/policy";
import { reflectsCredential } from "../apps/api/src/providers/responses";
import type { AccessFailureCode } from "../apps/api/src/providers/types";
import { sameData, sha256 } from "../apps/api/src/quality/data";
import { acquireStudyLock, writeArtifact } from "../apps/api/src/randomized/artifacts";
import { IMPORT_LIMITS, readBoundedFile } from "../apps/api/src/randomized/source";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { scoreClassifications } from "../apps/api/src/scoring/classification";

export const AMENDMENT_ROOT = resolve(import.meta.dir, "../apps/api/data/private/deep-study-amendment-v2");
const LABELS = ["convex", "concave", "neither"] as const, CAPS = [120, 96, 72] as const, HASH = /^[a-f0-9]{64}$/;
const instant = (value: string) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const identity = (row: Pick<DeepRow, "modelId" | "caseId" | "trialIndex">) => `${row.modelId}:${row.caseId}:${row.trialIndex}`;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readBoundedFile(path)) as T;

export interface AmendmentBaseline {
  readonly study: DeepStudy;
  readonly cases: readonly ImportedCase[];
  readonly rows: readonly DeepRow[];
  readonly report: ReturnType<typeof reconstructReport>;
}
export interface AmendmentContext {
  readonly frozenAt: string;
  readonly originalStartedAt: string;
  readonly originalRootSnapshotSha256: string;
  readonly apiImplementationSha256: string;
  readonly operatorSha256: string;
}
export interface Amendment extends AmendmentContext {
  readonly version: "2";
  readonly policy: "deep-study-amendment-v2";
  readonly id: string;
  readonly methodId: "deep-single-response-v1";
  readonly baselineSha256: string;
  readonly originalStudySha256: string;
  readonly originalRowsSha256: string;
  readonly originalReportSha256: string;
  readonly controlsSha256: string;
  readonly referenceReviewSha256: string;
  readonly populationSha256: string;
  readonly populationSnapshotSha256: string;
  readonly selectedCaseIds: readonly string[];
  readonly caseBindingsSha256: string;
  readonly requestBindingsSha256: string;
  readonly originalDeadlineAt: string;
  readonly bunVersion: "1.4.4";
  readonly models: typeof DEEP_MODELS;
  readonly settings: typeof DEEP_SETTINGS;
  readonly budget: { readonly maxLogicalCells: 1860; readonly priorOldFinalSends: number; readonly maxNewSends: number;
    readonly priorDevelopmentSends: 5; readonly sharedPhaseCeiling: 1890; readonly concurrencyCaps: typeof CAPS; readonly retries: 0; readonly trialsPerCase: 1 };
}

export function selectAmendmentCases(cases: readonly ImportedCase[]): ImportedCase[] {
  validatePopulation(cases);
  const selected = new Set<string>();
  for (const depth of DEPTHS) {
    const rows = cases.filter(task => task.requestedDepth === depth);
    if (depth < 320) for (const task of rows) selected.add(task.id);
    else for (const [index, label] of LABELS.entries()) for (const task of rows.filter(task => task.label === label).slice(0, 3 + Number(index === (depth === 320 ? 0 : 1)))) selected.add(task.id);
  }
  const result = cases.filter(task => selected.has(task.id));
  if (result.length !== 620 || !sameData(LABELS.map(label => result.filter(task => task.label === label).length), [207, 207, 206]))
    throw new Error("The amendment requires the original 320/512 pool and the frozen 620-case source-order selection.");
  return result;
}

export function createAmendment(baseline: AmendmentBaseline, context: AmendmentContext): Amendment {
  const { study, cases, rows, report } = baseline, selected = selectAmendmentCases(cases), ids = new Set(selected.map(task => task.id));
  if (!report.terminal || !sameData(report, reconstructReport(study, cases, rows, true, report.evidenceCutoffAt))) throw new Error("A reconciled original terminal report is required before amendment freeze.");
  if (rows.some(row => row.dispatch && !ids.has(row.caseId))) throw new Error("Every old authorized cell must remain in the amendment; excluded old sends cannot be dropped.");
  if (!instant(context.frozenAt) || !instant(context.originalStartedAt) || Date.parse(context.frozenAt) > Date.now() || Date.parse(context.frozenAt) < Date.parse(report.evidenceCutoffAt)
    || Date.parse(context.originalStartedAt) < Date.parse(study.frozenAt) || Date.parse(context.originalStartedAt) > Date.parse(report.evidenceCutoffAt)
    || ![context.originalRootSnapshotSha256, context.apiImplementationSha256, context.operatorSha256].every(value => HASH.test(value))
    || context.apiImplementationSha256 !== study.implementationSha256 || study.accounting.priorDevelopmentSends + study.accounting.probeSends !== 5)
    throw new Error("The original implementation, chronology, source snapshots or five prior development sends are not bound.");
  const priorOldFinalSends = rows.filter(row => row.dispatch).length;
  if (priorOldFinalSends > 1860) throw new Error("The retained sends exceed the amended logical budget.");
  const content = { ...context, version: "2" as const, policy: "deep-study-amendment-v2" as const, methodId: study.methodId,
    baselineSha256: sha256(baseline), originalStudySha256: sha256(study), originalRowsSha256: sha256(rows), originalReportSha256: sha256(report),
    controlsSha256: sha256(study.controls), referenceReviewSha256: sha256(study.referenceReview), populationSha256: study.populationSha256,
    populationSnapshotSha256: study.populationSnapshotSha256, selectedCaseIds: selected.map(task => task.id), caseBindingsSha256: sha256(caseBindings(selected)),
    requestBindingsSha256: sha256(selected.flatMap(task => DEEP_MODELS.map(model => sha256(buildDeepRequestBody(task, model.modelId))))),
    originalDeadlineAt: new Date(Date.parse(context.originalStartedAt) + study.budget.studyTimeoutMs).toISOString(), bunVersion: "1.4.4" as const, models: DEEP_MODELS, settings: DEEP_SETTINGS,
    budget: { maxLogicalCells: 1860 as const, priorOldFinalSends, maxNewSends: 1860 - priorOldFinalSends, priorDevelopmentSends: 5 as const,
      sharedPhaseCeiling: 1890 as const, concurrencyCaps: CAPS, retries: 0 as const, trialsPerCase: 1 as const } };
  return { ...content, id: `deep-study-amendment-v2-${sha256(content)}` };
}

export function assertAmendment(amendment: Amendment, baseline: AmendmentBaseline): void {
  const context: AmendmentContext = amendment;
  if (!sameData(amendment, createAmendment(baseline, { frozenAt: context.frozenAt, originalStartedAt: context.originalStartedAt,
    originalRootSnapshotSha256: context.originalRootSnapshotSha256, apiImplementationSha256: context.apiImplementationSha256, operatorSha256: context.operatorSha256 })))
    throw new Error("The frozen amendment, original baseline or selection changed.");
}

export function initialAmendmentRows(amendment: Amendment, baseline: AmendmentBaseline): DeepRow[] {
  if (sha256(baseline) !== amendment.baselineSha256) throw new Error("The frozen original baseline changed.");
  const previous = new Map(baseline.rows.map(row => [identity(row), row]));
  return amendment.selectedCaseIds.flatMap(caseId => DEEP_MODELS.map(model => {
    const row = previous.get(`${model.modelId}:${caseId}:0`);
    if (!row) throw new Error("An amended cell has no original planned identity.");
    return { ...row };
  }));
}

export interface SchedulerOutcome { readonly modelOutcome: boolean; readonly failureCode: AccessFailureCode | null; readonly retryAfterMs?: number }
export interface RateTransition { readonly kind: "rate-cap"; readonly generation: number; readonly from: number; readonly to: number;
  readonly index: number; readonly observedAt: string; readonly cooldownMs: number }
export async function scheduleAmendmentRows(rows: readonly DeepRow[], options: {
  readonly signal: AbortSignal;
  readonly execute: (row: DeepRow, index: number, generation: number) => Promise<SchedulerOutcome>;
  readonly onTransition: (event: RateTransition) => Promise<void>;
  readonly onFatal?: (error: unknown) => void;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}) {
  if (rows.length !== 1860 || new Set(rows.map(identity)).size !== 1860) throw new Error("The amendment scheduler requires 1860 unique logical cells.");
  const pending = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.dispatch === null);
  const now = options.now ?? Date.now, sleep = options.sleep ?? (milliseconds => Bun.sleep(milliseconds));
  let cursor = 0, generation = 0, cap: number = 120, cooldownUntil = 0, draining = false, stopped = false, failures = 0, stopReason: string | null = null;
  type Settled = { token: number; index: number; generation: number } & ({ outcome: SchedulerOutcome; error?: never } | { error: unknown; outcome?: never });
  const active = new Map<number, Promise<Settled>>();
  while (cursor < pending.length || active.size) {
    if (active.size === 0) draining = false;
    if (options.signal.aborted) { stopped = true; stopReason ??= "operator-or-deadline"; }
    while (!stopped && !draining && now() >= cooldownUntil && active.size < cap && cursor < pending.length) {
      const { row, index } = pending[cursor++], token = index, dispatchedGeneration = generation;
      active.set(token, Promise.resolve().then(() => options.execute(row, index, dispatchedGeneration))
        .then(outcome => ({ token, index, generation: dispatchedGeneration, outcome }), error => ({ token, index, generation: dispatchedGeneration, error })));
    }
    if (!active.size) {
      if (stopped || cursor === pending.length) break;
      await sleep(Math.max(0, cooldownUntil - now())); continue;
    }
    const settled = await Promise.race(active.values()); active.delete(settled.token);
    if ("error" in settled) { failures++; stopped = true; stopReason ??= "execution-or-persistence"; options.onFatal?.(settled.error); continue; }
    if (settled.outcome.failureCode === "rate-limited") {
      if (!stopped && settled.generation === generation) {
        if (cap === 72) { stopped = true; stopReason = "rate-limited-at-72"; }
        else {
          const next = CAPS[++generation], candidate = settled.outcome.retryAfterMs;
          const cooldownMs = typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= 600000 ? candidate : 5000;
          try { await options.onTransition({ kind: "rate-cap", generation, from: cap, to: next, index: settled.index, observedAt: new Date(now()).toISOString(), cooldownMs }); }
          catch (error) { failures++; stopped = true; stopReason = "transition-persistence"; options.onFatal?.(error); continue; }
          cap = next; cooldownUntil = now() + cooldownMs; draining = true;
        }
      }
    } else if (!settled.outcome.modelOutcome || settled.outcome.failureCode !== null) { stopped = true; stopReason ??= settled.outcome.failureCode ?? "identity-or-incomplete-outcome"; }
  }
  return { stopped, failures, cap, dispatched: cursor, stopReason };
}

function validateMergedRows(amendment: Amendment, baseline: AmendmentBaseline, rows: readonly DeepRow[]) {
  const expected = initialAmendmentRows(amendment, baseline), tasks = new Map(baseline.cases.map(task => [task.id, task])), ordinals = new Set<number>();
  if (rows.length !== 1860 || rows.some((row, index) => identity(row) !== identity(expected[index]))) throw new Error("Amended model/case/trial identities changed or repeat.");
  for (const [index, row] of rows.entries()) {
    const old = expected[index], task = tasks.get(row.caseId)!;
    if (old.dispatch && !sameData(row, old)) throw new Error("An old authorized cell was changed or resent.");
    if (!old.dispatch && row.dispatch) {
      const receipt = row.dispatch;
      if (receipt.studyId !== amendment.id || receipt.modelId !== row.modelId || receipt.caseId !== row.caseId || receipt.trialIndex !== 0
        || receipt.referenceSha256 !== task.referenceSha256 || receipt.requestBodySha256 !== sha256(buildDeepRequestBody(task, row.modelId))
        || !Number.isSafeInteger(receipt.ordinal) || receipt.ordinal <= amendment.budget.priorOldFinalSends || receipt.ordinal > 1860
        || ordinals.has(receipt.ordinal) || !instant(receipt.authorizedAt) || Date.parse(receipt.authorizedAt) < Date.parse(amendment.frozenAt)
        || receipt.remoteOutcomeUntilRetained !== "unknown") throw new Error("A continuation receipt is invalid, repeated or outside its budget.");
      ordinals.add(receipt.ordinal);
    }
    if (row.result) {
      if (!row.dispatch || row.result.inferenceRequests !== 1 || Date.parse(row.result.startedAt) > Date.parse(row.dispatch.authorizedAt)
        || Date.parse(row.result.finishedAt) < Date.parse(row.dispatch.authorizedAt) || Date.parse(row.result.finishedAt) > Date.now()
        || !old.dispatch && Date.parse(row.result.startedAt) < Date.parse(amendment.frozenAt)) throw new Error("A continuation result lacks compatible original authorization.");
      const control = baseline.study.controls.find(control => control.modelId === row.modelId)!;
      assertAttemptReplay(row.result, row.modelId, control.metadata);
    }
  }
  if ([...ordinals].some(ordinal => ordinal > amendment.budget.priorOldFinalSends + ordinals.size)) throw new Error("The continuation dispatch ordinals have a gap.");
}

export function qualifiedOutcome(row: DeepRow, baseline: AmendmentBaseline): boolean {
  return hasModelOutcome(row.result) && row.result!.normalized?.reportedModelId === baseline.study.controls.find(control => control.modelId === row.modelId)!.result.normalized!.reportedModelId;
}

function summarize(rows: readonly DeepRow[], labels: ReadonlyMap<string, ImportedCase["label"]>, terminal: boolean, currentStudyId: string, baseline: AmendmentBaseline) {
  const classification = scoreClassifications(rows.map(row => ({ caseId: row.caseId, depth: 0, trialIndex: 0, referenceLabel: labels.get(row.caseId)!, outcome: qualifiedOutcome(row, baseline) ? row.result!.outcome : null })), 1);
  const modelOutcomes = rows.filter(row => qualifiedOutcome(row, baseline)).length, correct = classification.population.correctTrials;
  const wrongValid = rows.filter(row => qualifiedOutcome(row, baseline) && row.result!.outcome.kind === "answer" && row.result!.outcome.label !== labels.get(row.caseId)).length;
  const missing = rows.filter(row => row.dispatch && !row.result).length, oldMissing = rows.filter(row => row.dispatch && row.dispatch.studyId !== currentStudyId && !row.result).length;
  const dispatched = rows.filter(row => row.dispatch).length, terminalMissing = oldMissing + (terminal ? missing - oldMissing : 0);
  return { planned: rows.length, dispatched, modelOutcomes, correct, wrongValid, unusable: modelOutcomes - correct - wrongValid,
    providerFailures: rows.filter(row => row.result && !qualifiedOutcome(row, baseline)).length + terminalMissing,
    identityFailures: rows.filter(row => hasModelOutcome(row.result) && !qualifiedOutcome(row, baseline)).length,
    unknownRemote: rows.filter(row => row.result && (row.result.failure?.remoteOutcome === "unknown" || row.result.failure === null && !hasModelOutcome(row.result))).length + terminalMissing,
    inFlight: terminal ? 0 : missing - oldMissing, unattempted: rows.length - dispatched, accuracy: classification.accuracy.value, macroF1: classification.macroF1,
    status: modelOutcomes === rows.length ? "complete" as const : modelOutcomes ? "provisional" as const : dispatched ? "unavailable" as const : "planned" as const,
    classification: { population: classification.population, classes: classification.classes, confusion: classification.confusion, outcomes: classification.outcomes } };
}

export function reconstructAmendmentReport(amendment: Amendment, baseline: AmendmentBaseline, rows: readonly DeepRow[], terminal: boolean, cutoffAt?: string) {
  validateMergedRows(amendment, baseline, rows);
  const ids = new Set(amendment.selectedCaseIds), cases = baseline.cases.filter(task => ids.has(task.id)), labels = new Map(cases.map(task => [task.id, task.label]));
  const latest = Math.max(Date.parse(amendment.frozenAt), ...rows.flatMap(row => [row.dispatch ? Date.parse(row.dispatch.authorizedAt) : 0, row.result ? Date.parse(row.result.finishedAt) : 0]));
  const evidenceCutoffAt = cutoffAt ?? new Date(latest).toISOString();
  if (!instant(evidenceCutoffAt) || Date.parse(evidenceCutoffAt) < latest || Date.parse(evidenceCutoffAt) > Date.now()) throw new Error("The amended report cutoff is inconsistent with original evidence.");
  const models = DEEP_MODELS.map(model => ({ modelId: model.modelId,
    reportedModelIds: [...new Set(rows.filter(row => row.modelId === model.modelId).flatMap(row => row.result?.normalized?.reportedModelId ? [row.result.normalized.reportedModelId] : []))],
    settings: { profileId: DEEP_SETTINGS.profileId, reasoning: model.reasoningEffort, maxOutputTokens: 32768, inferenceTimeoutMs: 600000 },
    overall: summarize(rows.filter(row => row.modelId === model.modelId), labels, terminal, amendment.id, baseline),
    byDepth: DEPTHS.map(requestedDepth => { const tasks = cases.filter(task => task.requestedDepth === requestedDepth), taskIds = new Set(tasks.map(task => task.id));
      return { requestedDepth, realizedDepths: [requestedDepth, requestedDepth + 1].map(depth => ({ depth, count: tasks.filter(task => task.actualDepth === depth).length })).filter(row => row.count),
        score: summarize(rows.filter(row => row.modelId === model.modelId && taskIds.has(row.caseId)), labels, terminal, amendment.id, baseline) }; }) }));
  const dispatched = rows.filter(row => row.dispatch).length;
  return { version: "2" as const, studyId: amendment.id, originalStudyId: baseline.study.id, terminal, evidenceCutoffAt,
    state: !terminal ? "running" as const : models.every(model => model.overall.status === "complete") ? "complete" as const : models.some(model => model.overall.modelOutcomes) ? "incomplete" as const : "unavailable" as const,
    cohortSha256: amendment.caseBindingsSha256, referenceReviewSha256: amendment.referenceReviewSha256, rowsSha256: sha256(rows), dispatched,
    oldFinalSends: amendment.budget.priorOldFinalSends, newFinalSends: dispatched - amendment.budget.priorOldFinalSends, cumulativeSends: 5 + dispatched, models };
}

export function buildAmendmentPublicSummary(amendment: Amendment, baseline: AmendmentBaseline, rows: readonly DeepRow[], report: ReturnType<typeof reconstructAmendmentReport>, audit: OutcomeAudit) {
  if (!report.terminal || !sameData(report, reconstructAmendmentReport(amendment, baseline, rows, true, report.evidenceCutoffAt))) throw new Error("Only original-outcome terminal reports can be exported.");
  const tasks = new Map(baseline.cases.map(task => [task.id, task]));
  const required = rows.filter(row => qualifiedOutcome(row, baseline) && (row.result!.outcome.kind !== "answer" || row.result!.outcome.label !== tasks.get(row.caseId)!.label)).map(row => `${row.modelId}:${row.caseId}`).sort();
  if (audit.verdict !== "pass" || !audit.reviewer.trim() || !instant(audit.checkedAt) || Date.parse(audit.checkedAt) < Date.parse(report.evidenceCutoffAt)
    || Date.parse(audit.checkedAt) > Date.now() || audit.reportSha256 !== sha256(report) || audit.rowsSha256 !== sha256(rows)
    || !sameData([...audit.inspectedWrongOrUnusable].sort(), required) || !Array.isArray(audit.diagnoses)
    || !sameData(audit.diagnoses.map(row => `${row.modelId}:${row.caseId}`).sort(), required)
    || audit.correctLabelExplanationsInspected !== report.models.reduce((sum, model) => sum + model.overall.correct, 0)
    || !report.dispatched) throw new Error("Every wrong/unusable diagnosis and correct-label explanation inspection must bind the amended report.");
  for (const diagnosis of audit.diagnoses) {
    const row = rows.find(row => row.modelId === diagnosis.modelId && row.caseId === diagnosis.caseId);
    if (!row?.result || diagnosis.resultSha256 !== sha256(row.result) || diagnosis.referenceSha256 !== tasks.get(row.caseId)!.referenceSha256
      || diagnosis.requestBodySha256 !== row.dispatch?.requestBodySha256 || !diagnosis.note.trim()) throw new Error("An amended failure diagnosis lacks its original evidence binding.");
  }
  const findings = new Set<string>();
  for (const finding of audit.explanationFindings) {
    const row = rows.find(row => row.modelId === finding.modelId && row.caseId === finding.caseId), key = `${finding.modelId}:${finding.caseId}`;
    if (!row?.result || !qualifiedOutcome(row, baseline) || row.result.outcome.kind !== "answer" || row.result.outcome.label !== tasks.get(row.caseId)!.label
      || finding.resultSha256 !== sha256(row.result) || !finding.note.trim() || findings.has(key)) throw new Error("An amended explanation finding is not uniquely bound to a correct-label response.");
    findings.add(key);
  }
  const cases = baseline.cases.filter(task => amendment.selectedCaseIds.includes(task.id));
  const scoreOnly = <T extends { classification: unknown }>(score: T) => { const { classification: _classification, ...summary } = score; void _classification; return summary; };
  return { version: "2", studyId: amendment.id, state: report.state, depthMeasure: "requested-generator-depth", requestedDepths: DEPTHS,
    taskCounts: DEPTHS.map(requestedDepth => ({ requestedDepth, tasks: cases.filter(task => task.requestedDepth === requestedDepth).length })),
    plannedTasksPerModel: 620, trialsPerTask: 1, cohortId: `population-${amendment.caseBindingsSha256}`, cohortSourceId: baseline.study.sourceId,
    cohortSha256: amendment.caseBindingsSha256, reportSha256: sha256(report), audit: { verdict: "pass", reportSha256: sha256(report), referenceReviewSha256: amendment.referenceReviewSha256 },
    models: report.models.map(model => ({ ...model, overall: scoreOnly(model.overall), byDepth: model.byDepth.map(slice => ({ ...slice, score: scoreOnly(slice.score) })) })) };
}

export async function operatorSha256() {
  return createHash("sha256").update(new Uint8Array(await Bun.file(new URL(import.meta.url)).arrayBuffer())).digest("hex");
}
async function absent(path: string) {
  try { await lstat(path); return false; } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return true; throw error; }
}
async function requireOriginalTerminal() {
  if (!await absent(join(DEEP_ROOT, "active.lock")) || await absent(join(DEEP_ROOT, "terminal.json"))) throw new Error("The original run must have a terminal record and no active lock before continuation.");
}
async function retain(path: string, value: unknown, credential?: string) {
  if (credential && reflectsCredential(JSON.stringify(value), credential)) throw new Error("Unsafe continuation evidence was discarded.");
  if (Buffer.byteLength(JSON.stringify(value, null, 2)) + 1 > IMPORT_LIMITS.fileBytes) throw new Error("A continuation artifact exceeds the existing 64 MiB file bound.");
  await writeArtifact(path, value);
}
interface BaselineIndex {
  readonly version: "1";
  readonly sha256: string;
  readonly studySha256: string;
  readonly reportSha256: string;
  readonly cases: readonly { readonly path: string; readonly sha256: string; readonly count: number }[];
  readonly rows: readonly { readonly path: string; readonly sha256: string; readonly count: number }[];
}
async function retainChunks<T>(root: string, kind: "cases" | "rows", items: readonly T[]) {
  const bindings: BaselineIndex["cases"][number][] = [];
  let chunk: T[] = [], bytes = 2;
  const flush = async () => {
    const path = `${kind}-${bindings.length}.json`;
    await retain(join(root, "baseline", path), chunk);
    bindings.push({ path, sha256: sha256(chunk), count: chunk.length }); chunk = []; bytes = 2;
  };
  for (const item of items) {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (size + 2 > IMPORT_LIMITS.fileBytes) throw new Error("One baseline item exceeds the existing bounded artifact size.");
    if (chunk.length && bytes + size + 1 > 16 * 1024 * 1024) await flush();
    bytes += size + Number(chunk.length > 0); chunk.push(item);
  }
  if (chunk.length) await flush(); return bindings;
}
export async function writeAmendmentBaseline(root: string, baseline: AmendmentBaseline): Promise<void> {
  await mkdir(join(root, "baseline"), { mode: 0o700 });
  await retain(join(root, "baseline", "study.json"), baseline.study);
  await retain(join(root, "baseline", "report.json"), baseline.report);
  const cases = await retainChunks(root, "cases", baseline.cases), rows = await retainChunks(root, "rows", baseline.rows);
  const index: BaselineIndex = { version: "1", sha256: sha256(baseline), studySha256: sha256(baseline.study), reportSha256: sha256(baseline.report), cases, rows };
  await retain(join(root, "baseline.json"), index);
}
export async function readAmendmentBaseline(root: string): Promise<AmendmentBaseline> {
  const directory = join(root, "baseline"), info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("The original baseline must remain in a real private directory.");
  const index = await read<BaselineIndex>(join(root, "baseline.json"));
  if (index.version !== "1" || ![index.sha256, index.studySha256, index.reportSha256].every(value => HASH.test(value))
    || !Array.isArray(index.cases) || !Array.isArray(index.rows) || !index.cases.length || index.cases.length > 800 || !index.rows.length || index.rows.length > 2400)
    throw new Error("The bounded original baseline index changed.");
  const loadChunks = async <T>(kind: "cases" | "rows", maximum: number): Promise<T[]> => {
    const values: T[] = [];
    for (const [ordinal, binding] of index[kind].entries()) {
      if (binding.path !== `${kind}-${ordinal}.json` || !HASH.test(binding.sha256) || !Number.isSafeInteger(binding.count) || binding.count < 1 || binding.count > maximum)
        throw new Error("An original baseline chunk binding is invalid or repeated.");
      const chunk = await read<T[]>(join(directory, binding.path));
      if (!Array.isArray(chunk) || chunk.length !== binding.count || sha256(chunk) !== binding.sha256 || values.length + chunk.length > maximum)
        throw new Error("An original baseline chunk changed or exceeds its population bound.");
      values.push(...chunk);
    }
    if (values.length !== maximum) throw new Error("The original baseline lost planned cases or cells.");
    return values;
  };
  const study = await read<DeepStudy>(join(directory, "study.json")), report = await read<AmendmentBaseline["report"]>(join(directory, "report.json"));
  const cases = await loadChunks<ImportedCase>("cases", 800), rows = await loadChunks<DeepRow>("rows", 2400);
  const expected = ["study.json", "report.json", ...index.cases.map(binding => binding.path), ...index.rows.map(binding => binding.path)].sort();
  const baseline = { study, cases, rows, report };
  if (!sameData((await readdir(directory)).sort(), expected) || sha256(study) !== index.studySha256 || sha256(report) !== index.reportSha256 || sha256(baseline) !== index.sha256)
    throw new Error("The original baseline bytes or logical evidence binding changed.");
  return baseline;
}
function requireRuntime() {
  if (Bun.version !== "1.4.4") throw new Error("Run this frozen continuation with Bun1.4.4 explicitly.");
}

export async function freezeAmendment(): Promise<Amendment> {
  requireRuntime(); await requireOriginalTerminal();
  if (!await absent(AMENDMENT_ROOT)) throw new Error("The continuation directory already exists; immutable freeze cannot be overwritten.");
  const originalRootSnapshotSha256 = await populationSnapshotSha256(join(DEEP_ROOT, "study.json"));
  const baseline = await reconcileStudy();
  const started = await read<{ studyId: string; startedAt: string; implementationSha256: string }>(join(DEEP_ROOT, "started.json"));
  if (started.studyId !== baseline.study.id || started.implementationSha256 !== baseline.study.implementationSha256) throw new Error("The original start record is not bound to its frozen study.");
  const amendment = createAmendment(baseline, { frozenAt: new Date().toISOString(), originalStartedAt: started.startedAt,
    originalRootSnapshotSha256, apiImplementationSha256: await implementationSha256(), operatorSha256: await operatorSha256() });
  await requireOriginalTerminal();
  if (await populationSnapshotSha256(join(DEEP_ROOT, "study.json")) !== originalRootSnapshotSha256) throw new Error("Original evidence changed during continuation freeze.");
  await mkdir(AMENDMENT_ROOT, { mode: 0o700 });
  await writeAmendmentBaseline(AMENDMENT_ROOT, baseline); await retain(join(AMENDMENT_ROOT, "amendment.json"), amendment);
  return amendment;
}

async function loadAmendment() {
  requireRuntime(); await requireOriginalTerminal();
  const amendment = await read<Amendment>(join(AMENDMENT_ROOT, "amendment.json")), baseline = await readAmendmentBaseline(AMENDMENT_ROOT);
  assertAmendment(amendment, baseline);
  if (amendment.bunVersion !== Bun.version || amendment.operatorSha256 !== await operatorSha256() || amendment.apiImplementationSha256 !== await implementationSha256()
    || amendment.originalRootSnapshotSha256 !== await populationSnapshotSha256(join(DEEP_ROOT, "study.json"))
    || amendment.populationSnapshotSha256 !== await populationSnapshotSha256(baseline.study.populationPath)) throw new Error("Frozen operator, API implementation, original evidence or source population bytes changed.");
  await requireOriginalTerminal(); return { amendment, baseline };
}

export function retryAfterMilliseconds(value: string | null): number | undefined {
  if (value === null || value.length > 16 || !/^\d{1,6}(?:\.\d{1,3})?$/.test(value)) return undefined;
  const milliseconds = Number(value) * 1000;
  return milliseconds <= 600000 ? milliseconds : undefined;
}

interface StartRecord { readonly studyId: string; readonly startedAt: string; readonly originalDeadlineAt: string; readonly operatorSha256: string; readonly initialCap: 120 }
interface TerminalRecord {
  readonly studyId: string; readonly finishedAt: string; readonly stopped: boolean; readonly failures: number; readonly cap: number;
  readonly stopReason: string | null; readonly authorizedNewSends: number; readonly cumulativeFinalSends: number; readonly rowsSha256: string;
  readonly startedSha256: string; readonly eventsSha256: string;
}
export async function runAmendment(suppliedCredential: string, acceptCharges: boolean) {
  if (acceptCharges !== true) throw new Error("Explicit provider-charge acknowledgement is required for continuation.");
  const credential = parseCredential(suppliedCredential), { amendment, baseline } = await loadAmendment();
  const remaining = Date.parse(amendment.originalDeadlineAt) - Date.now();
  if (remaining <= 0) throw new Error("The unchanged original twelve-hour overall deadline has expired.");
  const release = await acquireStudyLock(AMENDMENT_ROOT), forced = new AbortController(), stopFresh = new AbortController();
  const deadline = AbortSignal.timeout(remaining), wireSignal = AbortSignal.any([forced.signal, deadline]), schedulingSignal = AbortSignal.any([stopFresh.signal, deadline]);
  const rows = initialAmendmentRows(amendment, baseline), tasks = new Map(baseline.cases.map(task => [task.id, task]));
  const events: unknown[] = []; let queue = Promise.resolve(), sent = 0, fatal = false, interrupts = 0;
  const onFatal = () => { fatal = true; stopFresh.abort(); forced.abort(); };
  const control = (value: unknown) => { const ordinal = events.length; events.push(value); queue = queue.then(() => retain(join(AMENDMENT_ROOT, "events", `event-${ordinal}.json`), value, credential)); return queue; };
  const signal = (name: string) => {
    if (name === "SIGINT") interrupts++;
    const abort = name === "SIGINT" && interrupts >= 2;
    stopFresh.abort(); if (abort) forced.abort();
    void control({ kind: abort ? "force-abort" : "stop-fresh", signal: name, observedAt: new Date().toISOString() }).catch(onFatal);
  };
  const usr1 = () => signal("SIGUSR1"), int = () => signal("SIGINT"), term = () => signal("SIGTERM");
  let handlers = false;
  try {
    const start: StartRecord = { studyId: amendment.id, startedAt: new Date().toISOString(), originalDeadlineAt: amendment.originalDeadlineAt, operatorSha256: amendment.operatorSha256, initialCap: 120 };
    await retain(join(AMENDMENT_ROOT, "started.json"), start, credential);
    await mkdir(join(AMENDMENT_ROOT, "attempts"), { mode: 0o700 }); await mkdir(join(AMENDMENT_ROOT, "events"), { mode: 0o700 });
    await control({ kind: "initial-cap", cap: 120, generation: 0, observedAt: start.startedAt });
    process.on("SIGUSR1", usr1); process.on("SIGINT", int); process.on("SIGTERM", term); handlers = true;
    const state = await scheduleAmendmentRows(rows, { signal: schedulingSignal, onFatal,
      onTransition: event => control(event), execute: async (row, index, generation) => {
        const task = tasks.get(row.caseId)!, original = baseline.study.controls.find(control => control.modelId === row.modelId)!;
        let dispatch: DeepReceipt | null = null, retryAfterMs: number | undefined, authorizationStopped = false;
        let result: Awaited<ReturnType<typeof executeDeepAttempt>>;
        try { result = await executeDeepAttempt(task, row.modelId, original.metadata, credential, wireSignal, async () => {
          if (schedulingSignal.aborted) { authorizationStopped = true; throw new Error("Operator pause prevented a new authorization."); }
          if (sent >= amendment.budget.maxNewSends || 5 + amendment.budget.priorOldFinalSends + sent >= amendment.budget.sharedPhaseCeiling)
            throw new Error("The amended dispatch budget, operator pause or original deadline prevents a fresh send.");
          dispatch = { studyId: amendment.id, ordinal: amendment.budget.priorOldFinalSends + ++sent, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
            referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" };
          try { await retain(join(AMENDMENT_ROOT, "attempts", `dispatch-${index}.json`), dispatch, credential); rows[index] = { ...row, dispatch }; }
          catch { onFatal(); throw new Error("Continuation receipt persistence failed before wire dispatch."); }
        }, async (url, options) => {
          const response = await fetch(url, options);
          if (response.status === 429) retryAfterMs = retryAfterMilliseconds(response.headers.get("retry-after"));
          return response;
        }); } catch (error) {
          if (authorizationStopped && !dispatch && !fatal) return { modelOutcome: false, failureCode: null };
          throw error;
        }
        if (!dispatch) throw new Error("Continuation stopped before retaining a dispatch authorization.");
        try { await retain(join(AMENDMENT_ROOT, "attempts", `result-${index}.json`), { studyId: amendment.id, index, generation, modelId: row.modelId,
          caseId: row.caseId, dispatchSha256: sha256(dispatch), retryAfterMs: retryAfterMs ?? null, result }, credential); }
        catch { onFatal(); throw new Error("Continuation result persistence failed; fresh work stopped."); }
        rows[index] = { ...row, dispatch, result };
        console.log(JSON.stringify({ event: "settled", newSends: sent, finalSends: amendment.budget.priorOldFinalSends + sent, modelId: row.modelId, caseId: row.caseId, outcome: result.outcome.kind, failure: result.failure?.code ?? null }));
        return { modelOutcome: hasModelOutcome(result) && result.normalized!.reportedModelId === original.result.normalized!.reportedModelId, failureCode: result.failure?.code ?? null, retryAfterMs };
      } });
    await queue;
    if (fatal) throw new Error("Continuation evidence persistence failed; inspect retained authorizations before any further paid operation.");
    const terminal: TerminalRecord = { studyId: amendment.id, finishedAt: new Date().toISOString(), stopped: state.stopped, failures: state.failures,
      cap: state.cap, stopReason: state.stopReason, authorizedNewSends: rows.filter(row => row.dispatch?.studyId === amendment.id).length,
      cumulativeFinalSends: rows.filter(row => row.dispatch).length, rowsSha256: sha256(rows), startedSha256: sha256(start), eventsSha256: sha256(events) };
    await retain(join(AMENDMENT_ROOT, "terminal.json"), terminal, credential);
    const report = reconstructAmendmentReport(amendment, baseline, rows, true, terminal.finishedAt);
    await retain(join(AMENDMENT_ROOT, "report.json"), report, credential); return report;
  } finally {
    forced.abort(); if (handlers) { process.removeListener("SIGUSR1", usr1); process.removeListener("SIGINT", int); process.removeListener("SIGTERM", term); }
    await release();
  }
}

export async function reportAmendment() {
  const { amendment, baseline } = await loadAmendment(), rows = initialAmendmentRows(amendment, baseline);
  if (await absent(join(AMENDMENT_ROOT, "started.json"))) return { amendment, baseline, rows, report: reconstructAmendmentReport(amendment, baseline, rows, false) };
  const started = await read<StartRecord>(join(AMENDMENT_ROOT, "started.json"));
  if (started.studyId !== amendment.id || !instant(started.startedAt) || Date.parse(started.startedAt) < Date.parse(amendment.frozenAt)
    || started.originalDeadlineAt !== amendment.originalDeadlineAt || started.operatorSha256 !== amendment.operatorSha256 || started.initialCap !== 120) throw new Error("The continuation start record changed.");
  const names = await readdir(join(AMENDMENT_ROOT, "attempts")), retained = new Set(names), generations = new Map<number, number>();
  if (names.some(name => !/^(dispatch|result)-(0|[1-9]\d*)\.json$/.test(name))) throw new Error("Unexpected continuation attempt artifacts require inspection.");
  for (const [index, row] of rows.entries()) {
    const dispatchName = `dispatch-${index}.json`, resultName = `result-${index}.json`;
    if (row.dispatch && (retained.has(dispatchName) || retained.has(resultName))) throw new Error("An original authorized cell was repeated in the continuation.");
    if (!retained.has(dispatchName)) { if (retained.has(resultName)) throw new Error("A continuation result lost its original receipt."); continue; }
    const dispatch = await read<DeepReceipt>(join(AMENDMENT_ROOT, "attempts", dispatchName));
    let result: DeepRow["result"] = null;
    if (retained.has(resultName)) {
      const envelope = await read<{ studyId: string; index: number; generation: number; modelId: string; caseId: string; dispatchSha256: string; result: NonNullable<DeepRow["result"]> }>(join(AMENDMENT_ROOT, "attempts", resultName));
      if (envelope.studyId !== amendment.id || envelope.index !== index || envelope.modelId !== row.modelId || envelope.caseId !== row.caseId
        || envelope.dispatchSha256 !== sha256(dispatch) || !Number.isSafeInteger(envelope.generation) || envelope.generation < 0 || envelope.generation > 2) throw new Error("A continuation result envelope changed.");
      generations.set(index, envelope.generation);
      result = envelope.result;
    }
    rows[index] = { ...row, dispatch, result };
  }
  if (names.length !== rows.filter(row => row.dispatch?.studyId === amendment.id).reduce((sum, row) => sum + 1 + Number(row.result !== null), 0)) throw new Error("Out-of-cohort continuation evidence was found.");
  const eventNames = (await readdir(join(AMENDMENT_ROOT, "events"))).sort((left, right) => Number(left.slice(6, -5)) - Number(right.slice(6, -5)));
  if (!eventNames.length || eventNames.some((name, index) => name !== `event-${index}.json`)) throw new Error("Continuation control events repeat, are missing or have gaps.");
  const events = await Promise.all(eventNames.map(name => read<Record<string, unknown>>(join(AMENDMENT_ROOT, "events", name))));
  let cap: number = 120, generation = 0, latestControl = Date.parse(started.startedAt);
  for (const [index, event] of events.entries()) {
    if (!instant(event.observedAt as string) || Date.parse(event.observedAt as string) < latestControl || Date.parse(event.observedAt as string) > Date.now()) throw new Error("A continuation control event has invalid chronology.");
    latestControl = Date.parse(event.observedAt as string);
    if (index === 0) { if (event.kind !== "initial-cap" || event.cap !== 120 || event.generation !== 0) throw new Error("The initial continuation pool changed."); }
    else if (event.kind === "rate-cap") {
      if (event.from !== cap || event.to !== CAPS[generation + 1] || event.generation !== generation + 1 || generation >= 2
        || !Number.isSafeInteger(event.index) || rows[event.index as number]?.dispatch?.studyId !== amendment.id
        || rows[event.index as number]?.result?.failure?.code !== "rate-limited" || generations.get(event.index as number) !== generation
        || Date.parse(rows[event.index as number]!.result!.finishedAt) > latestControl
        || typeof event.cooldownMs !== "number" || event.cooldownMs < 0 || event.cooldownMs > 600000) throw new Error("A rate-cap transition lacks its explicit retained rate-limit failure.");
      cap = event.to as number; generation++;
    } else if (!["stop-fresh", "force-abort"].includes(event.kind as string) || !["SIGUSR1", "SIGINT", "SIGTERM"].includes(event.signal as string)) throw new Error("An unknown continuation control action was retained.");
  }
  if ([...generations.values()].some(value => value > generation)) throw new Error("A continuation result uses an unretained rate-cap generation.");
  const terminal = await absent(join(AMENDMENT_ROOT, "terminal.json")) ? null : await read<TerminalRecord>(join(AMENDMENT_ROOT, "terminal.json"));
  if (terminal && (terminal.studyId !== amendment.id || !instant(terminal.finishedAt) || Date.parse(terminal.finishedAt) > Date.now() || Date.parse(terminal.finishedAt) < latestControl
    || typeof terminal.stopped !== "boolean" || !Number.isSafeInteger(terminal.failures) || terminal.failures < 0 || terminal.failures > 120 || terminal.cap !== cap
    || terminal.authorizedNewSends !== rows.filter(row => row.dispatch?.studyId === amendment.id).length || terminal.cumulativeFinalSends !== rows.filter(row => row.dispatch).length
    || terminal.rowsSha256 !== sha256(rows) || terminal.startedSha256 !== sha256(started) || terminal.eventsSha256 !== sha256(events)
    || !terminal.stopped && terminal.authorizedNewSends !== amendment.budget.maxNewSends)) throw new Error("The terminal continuation record is not bound to its original journal.");
  const report = reconstructAmendmentReport(amendment, baseline, rows, terminal !== null, terminal?.finishedAt);
  if (!await absent(join(AMENDMENT_ROOT, "report.json")) && !sameData(await read<unknown>(join(AMENDMENT_ROOT, "report.json")), report)) throw new Error("The retained continuation report differs from original outcomes.");
  return { amendment, baseline, rows, report };
}

export async function exportAmendment(auditPath: string) {
  if (!await absent(join(AMENDMENT_ROOT, "active.lock"))) throw new Error("Drain the continuation and release its active lock before export.");
  const { amendment, baseline, rows, report } = await reportAmendment(), audit = await read<OutcomeAudit>(auditPath);
  const summary = buildAmendmentPublicSummary(amendment, baseline, rows, report, audit);
  await retain(join(AMENDMENT_ROOT, "public-summary-v2.json"), summary); return summary;
}

export function parseAmendmentArguments(args: readonly string[]) {
  if (args.length === 1 && ["freeze", "report"].includes(args[0])) return { command: args[0] as "freeze" | "report" };
  if (args.length === 2 && args[0] === "run" && args[1] === "--accept-charges") return { command: "run" as const };
  if (args.length === 3 && args[0] === "export" && args[1] === "--audit" && args[2] && !args[2].startsWith("--")) return { command: "export" as const, auditPath: args[2] };
  throw new Error("Use freeze, run --accept-charges, report, or export --audit <review.json> for this fixed continuation.");
}
if (import.meta.main) {
  try {
    const args = parseAmendmentArguments(Bun.argv.slice(2));
    const result = args.command === "freeze" ? await freezeAmendment() : args.command === "run" ? await runAmendment(process.env.OPENAI_API_KEY ?? "", true)
      : args.command === "report" ? (await reportAmendment()).report : await exportAmendment(args.auditPath!);
    console.log(JSON.stringify(result));
  } catch { console.error("Research continuation did not complete. Inspect the immutable original baseline, continuation receipts and control journal before further paid work."); process.exitCode = 1; }
}
