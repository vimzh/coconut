// Private operator execution uses immutable receipts and refuses duplicate or unaudited research sends.
import { createHash } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createModelSelectionClient } from "../discovery";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { sameData, sha256 } from "../quality/data";
import { certifyImported } from "../randomized/admission";
import { acquireStudyLock, writeArtifact } from "../randomized/artifacts";
import { scorePanelRows } from "../randomized/pilot";
import { readBoundedFile, SOURCE_REVISION } from "../randomized/source";
import type { ImportedCase, PanelResult } from "../randomized/types";
import { loadPopulationCases, replayPopulation } from "./population";
import { CONTROL_EXPRESSION } from "./population-diagnostics";
import { assertStudy, createRows, freezeStudy, hasModelOutcome, reconstructReport, validatePopulation, type CompatibilityControl, type DeepReceipt, type DeepRow, type DeepStudy, type ReferenceReview } from "./study";
import { buildDeepRequestBody, DEEP_MODELS, DEEP_SETTINGS, executeDeepAttempt, type DeepModelId } from "./transport";

const API_ROOT = resolve(import.meta.dir, "../.."), REPO_ROOT = resolve(API_ROOT, "../..");
export const DEEP_ROOT = join(API_ROOT, "data/private/deep-study-v1");
const PRIOR_ROOT = join(API_ROOT, "data/private/randomized-v1");
const PRIOR_RESULT = "0a5a05e75728a986cfdb4b4583d04916dc61245e50384488b76585d7aedfd604";
const read = async <T>(path: string): Promise<T> => JSON.parse(await readBoundedFile(path)) as T;
const ensurePrivate = async () => mkdir(DEEP_ROOT, { recursive: true, mode: 0o700 });
async function retain(path: string, value: unknown, credential?: string) {
  if (credential && reflectsCredential(JSON.stringify(value), credential)) throw new Error("Unsafe research evidence was discarded.");
  await writeArtifact(path, value);
}

export async function implementationSha256(): Promise<string> {
  const files = (await Array.fromAsync(new Bun.Glob("**/*.ts").scan({ cwd: join(API_ROOT, "src"), onlyFiles: true })))
    .filter(path => !path.endsWith(".test.ts")).map(path => `apps/api/src/${path}`).sort();
  files.push("bun.lock", "apps/api/package.json", "patches/openai@7.53.0.patch", "services/numerics/import_reference.py", "services/numerics/import_syntax.py", "services/numerics/uv.lock", "apps/api/src/deep-study/population-diagnostics.py");
  return sha256({ runtime: { bun: Bun.version }, files: await Promise.all(files.map(async path => ({ path, sha256: createHash("sha256").update(await readBoundedFile(join(REPO_ROOT, path))).digest("hex") }))) });
}

export async function priorAccounting() {
  const rootNames = await readdir(PRIOR_ROOT);
  if (rootNames.includes("active.lock") || rootNames.filter(name => /^panel-/.test(name)).join() !== "panel-1") throw new Error("Unexpected or active development panels require shared-budget reconciliation.");
  const result = await read<PanelResult>(join(PRIOR_ROOT, "panel-1/panel-result.json"));
  const receipts = await Promise.all([1, 2].map(index => read<unknown>(join(PRIOR_ROOT, `panel-1/dispatch-${index}.json`))));
  const summary = await read<{ panelResultSha256: string; dispatchedAttempts: number; unknownRemoteOutcomes: number; budget: { probeSends: number } }>(join(PRIOR_ROOT, "terminal-summary.json"));
  if (sha256(result) !== PRIOR_RESULT || summary.panelResultSha256 !== PRIOR_RESULT || summary.dispatchedAttempts !== 2 || summary.unknownRemoteOutcomes !== 1 || summary.budget.probeSends !== 0
    || result.dispatches !== 2 || result.unknownRemoteOutcomes !== 1 || !sameData(scorePanelRows(result.panel, result.rows), result.scores)
    || !sameData(receipts, result.rows.flatMap(row => row.dispatch ? [row.dispatch] : []))) throw new Error("The original two-send development ledger cannot be reconciled.");
  const names = await readdir(join(PRIOR_ROOT, "panel-1"));
  if (names.filter(name => /^dispatch-\d+\.json$/.test(name)).length !== 2) throw new Error("Unexpected development dispatch evidence requires a shared-budget amendment.");
  return { priorDevelopmentSends: 2 as const, priorUnknownRemote: 1 as const, priorEvidenceSha256: sha256({ result, receipts, summary }), probeSends: 3 as const };
}

export async function runControls(credential: string, signal = new AbortController().signal): Promise<readonly CompatibilityControl[]> {
  parseCredential(credential); await ensurePrivate(); const release = await acquireStudyLock(DEEP_ROOT);
  try {
    const accounting = await priorAccounting();
    await retain(join(DEEP_ROOT, "control-plan.json"), { version: "1", models: DEEP_MODELS, settings: DEEP_SETTINGS, accounting, implementationSha256: await implementationSha256(), frozenAt: new Date().toISOString(), maxNewSends: 3, retries: 0 }, credential);
    const expression = CONTROL_EXPRESSION, reference = await certifyImported(expression, "convex");
    if (reference.status !== "verified") throw new Error("The original quadratic compatibility control did not certify.");
    const task: ImportedCase = { id: "deep-profile-control-quadratic", expression, label: "convex", domain: { min: "-1", max: "1" }, referenceSha256: sha256(reference),
      coreHashes: [...reference.coreHashes!, reference.shapeHash!], requestedDepth: 1, actualDepth: 1, astDepth: reference.astDepth!, nonlinearPath: reference.nonlinearPath!, nodeCount: reference.nodeCount! };
    await retain(join(DEEP_ROOT, "control-reference.json"), reference, credential);
    const controls: CompatibilityControl[] = [];
    for (const [index, model] of DEEP_MODELS.entries()) {
      signal.throwIfAborted();
      const selection = await createModelSelectionClient()({ provider: "openai", modelId: model.modelId, servingProvider: null, profileId: `one-shot-json-v2-${model.reasoningEffort}`, verification: "metadata" }, credential, signal);
      await retain(join(DEEP_ROOT, `control-metadata-${index}.json`), selection, credential);
      if (!selection.metadata?.exactRoute || selection.failure || selection.status === "blocked" || selection.status === "failed") throw new Error("Exact model metadata is unavailable; no compatibility inference was started for this cell.");
      const receipt = { ordinal: accounting.priorDevelopmentSends + index + 1, kind: "probe", modelId: model.modelId, requestBodySha256: sha256(buildDeepRequestBody(task, model.modelId)), authorizedAt: "", remoteOutcomeUntilRetained: "unknown" };
      const result = await executeDeepAttempt(task, model.modelId, selection.metadata, credential, signal, async () => {
        receipt.authorizedAt = new Date().toISOString();
        await retain(join(DEEP_ROOT, `control-dispatch-${index}.json`), receipt, credential);
      }, async (url, options) => {
        const response = await fetch(url, options);
        const limits = Object.fromEntries(["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"].map(name => {
          const value = response.headers.get(name);
          return [name, value !== null && value.length <= 64 && /^[0-9.ms]+$/.test(value) ? value : null];
        }));
        await retain(join(DEEP_ROOT, `control-rate-limits-${index}.json`), { modelId: model.modelId, receivedAt: new Date().toISOString(), limits }, credential);
        return response;
      });
      const control: CompatibilityControl = { modelId: model.modelId, metadata: selection.metadata, task, result, dispatchSha256: sha256(receipt) };
      await retain(join(DEEP_ROOT, `control-result-${index}.json`), control, credential); controls.push(control);
      if (!hasModelOutcome(result) || !result.normalized?.reportedModelId) throw new Error("The research-profile control did not establish compatibility; no retry is allowed.");
    }
    await retain(join(DEEP_ROOT, "controls.json"), controls, credential); return controls;
  } finally { await release(); }
}

async function loadControls(): Promise<readonly CompatibilityControl[]> {
  const controls = await read<CompatibilityControl[]>(join(DEEP_ROOT, "controls.json")), plan = await read<Record<string, unknown>>(join(DEEP_ROOT, "control-plan.json"));
  if (controls.length !== 3 || !sameData(plan.models, DEEP_MODELS) || !sameData(plan.settings, DEEP_SETTINGS) || !sameData(plan.accounting, await priorAccounting())
    || plan.implementationSha256 !== await implementationSha256() || plan.maxNewSends !== 3 || plan.retries !== 0) throw new Error("The retained compatibility-control plan changed.");
  const reference = await read<unknown>(join(DEEP_ROOT, "control-reference.json"));
  if (!sameData(reference, await certifyImported(CONTROL_EXPRESSION, "convex"))) throw new Error("The original compatibility-control reference changed.");
  const names = await readdir(DEEP_ROOT);
  if (names.filter(name => /^control-dispatch-/.test(name)).length !== 3) throw new Error("The compatibility probe-send ledger is incomplete or repeated.");
  for (const [index, model] of DEEP_MODELS.entries()) {
    const control = controls[index], receipt = await read<Record<string, unknown>>(join(DEEP_ROOT, `control-dispatch-${index}.json`));
    const retained = await read<unknown>(join(DEEP_ROOT, `control-result-${index}.json`)), metadata = await read<{ metadata: unknown }>(join(DEEP_ROOT, `control-metadata-${index}.json`));
    if (!control || control.modelId !== model.modelId || !sameData(control, retained) || !sameData(metadata.metadata, control.metadata) || sha256(receipt) !== control.dispatchSha256
      || receipt.ordinal !== index + 3 || receipt.kind !== "probe" || receipt.modelId !== model.modelId || receipt.remoteOutcomeUntilRetained !== "unknown"
      || receipt.requestBodySha256 !== sha256(buildDeepRequestBody(control.task, model.modelId)) || control.task.referenceSha256 !== sha256(reference)
      || control.task.expression !== CONTROL_EXPRESSION || control.task.label !== "convex" || !sameData(control.task.domain, { min: "-1", max: "1" })
      || typeof receipt.authorizedAt !== "string" || !Number.isFinite(Date.parse(receipt.authorizedAt))
      || Date.parse(receipt.authorizedAt) < Date.parse(control.result.startedAt) || Date.parse(receipt.authorizedAt) > Date.parse(control.result.finishedAt)) throw new Error("A compatibility control cannot be reconciled to its original dispatch and reference.");
  }
  return controls;
}

export async function freezeFinalStudy(populationPath: string, reviewPath: string): Promise<DeepStudy> {
  await ensurePrivate(); const release = await acquireStudyLock(DEEP_ROOT);
  try {
    const population = await replayPopulation(resolve(populationPath));
    if (population.state !== "ready") throw new Error("The 800-case population is incomplete; final evaluation cannot freeze.");
    const cases = await loadPopulationCases(resolve(populationPath)); validatePopulation(cases);
    const review = await read<ReferenceReview>(reviewPath);
    if (Date.parse(review.checkedAt) < Date.parse(population.createdAt)) throw new Error("The reference review predates the completed population.");
    const study = freezeStudy({ frozenAt: new Date().toISOString(), populationPath: resolve(populationPath), populationSha256: sha256(population),
      sourceId: SOURCE_REVISION, implementationSha256: await implementationSha256(), referenceReview: review,
      controls: await loadControls(), accounting: await priorAccounting() }, cases);
    await retain(join(DEEP_ROOT, "study.json"), study); return study;
  } finally { await release(); }
}

async function boundStudy() {
  const study = await read<DeepStudy>(join(DEEP_ROOT, "study.json")), population = await replayPopulation(study.populationPath);
  if (sha256(population) !== study.populationSha256 || !sameData(await priorAccounting(), study.accounting)) throw new Error("The frozen population or prior shared send accounting changed.");
  const cases = await loadPopulationCases(study.populationPath); assertStudy(study, cases, await implementationSha256());
  const controls = await loadControls();
  if (!sameData(controls, study.controls)) throw new Error("The frozen compatibility controls changed.");
  return { study, cases };
}

export async function scheduleRows(rows: readonly DeepRow[], signal: AbortSignal, execute: (row: DeepRow, index: number) => Promise<boolean>, concurrency = 12) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 12 || rows.length !== 2400) throw new Error("The research scheduler requires 2400 cells and at most12 workers.");
  let cursor = 0, stopped = false;
  const settled = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
    while (!signal.aborted && !stopped && cursor < rows.length) {
      const index = cursor++;
      try { if (!await execute(rows[index], index)) stopped = true; }
      catch (error) { stopped = true; throw error; }
    }
  }));
  return { stopped: stopped || signal.aborted, failures: settled.filter(row => row.status === "rejected").length };
}

export async function runFinalStudy(credential: string) {
  parseCredential(credential); await ensurePrivate(); const release = await acquireStudyLock(DEEP_ROOT);
  const controller = new AbortController(), stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const { study, cases } = await boundStudy(), rows = createRows(cases), tasks = new Map(cases.map(task => [task.id, task]));
    await mkdir(join(DEEP_ROOT, "attempts"), { mode: 0o700 });
    await retain(join(DEEP_ROOT, "started.json"), { studyId: study.id, startedAt: new Date().toISOString(), implementationSha256: study.implementationSha256 }, credential);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(study.budget.studyTimeoutMs)]); let sent = 0;
    const state = await scheduleRows(rows, signal, async (row, index) => {
      const task = tasks.get(row.caseId)!, control = study.controls.find(control => control.modelId === row.modelId)!;
      let dispatch: DeepReceipt | null = null;
      const result = await executeDeepAttempt(task, row.modelId, control.metadata, credential, signal, async () => {
        if (signal.aborted || sent >= 2400 || 5 + sent >= 2430) throw new Error("The frozen research send budget or deadline is exhausted.");
        const ordinal = ++sent;
        dispatch = { studyId: study.id, ordinal, modelId: row.modelId, caseId: row.caseId, trialIndex: 0, referenceSha256: task.referenceSha256,
          requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" };
        try { await retain(join(DEEP_ROOT, "attempts", `dispatch-${index}.json`), dispatch, credential); }
        catch { controller.abort(); throw new Error("Research receipt persistence failed; dispatch stopped."); }
        rows[index] = { ...row, dispatch };
      });
      if (!dispatch) throw new Error("The research attempt did not obtain a persisted dispatch authorization.");
      try { await retain(join(DEEP_ROOT, "attempts", `result-${index}.json`), { studyId: study.id, index, modelId: row.modelId, caseId: row.caseId, dispatchSha256: sha256(dispatch), result }, credential); }
      catch { controller.abort(); throw new Error("Research result persistence failed; dispatch stopped."); }
      rows[index] = { ...row, dispatch, result };
      console.log(JSON.stringify({ event: "settled", sent, modelId: row.modelId, caseId: row.caseId, outcome: result.outcome.kind, failure: result.failure?.code ?? null }));
      // Infrastructure or identity drift stops fresh work; already authorized requests may finish.
      return hasModelOutcome(result) && result.normalized!.reportedModelId === control.result.normalized!.reportedModelId;
    });
    const terminal = { studyId: study.id, finishedAt: new Date().toISOString(), ...state, authorizedSends: sent };
    await retain(join(DEEP_ROOT, "terminal.json"), terminal, credential);
    const report = reconstructReport(study, cases, rows, true, terminal.finishedAt); await retain(join(DEEP_ROOT, "report.json"), report, credential);
    return report;
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); await release(); }
}

export async function reconcileStudy() {
  const { study, cases } = await boundStudy(), rows = createRows(cases), names = await readdir(join(DEEP_ROOT, "attempts"));
  const retained = new Set(names);
  if (names.some(name => !/^(dispatch|result)-(0|[1-9]\d*)\.json$/.test(name))) throw new Error("Unexpected research attempt artifacts require inspection.");
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]; let dispatch: DeepReceipt | null = null, result: DeepRow["result"] = null;
    if (retained.has(`dispatch-${index}.json`)) dispatch = await read<DeepReceipt>(join(DEEP_ROOT, "attempts", `dispatch-${index}.json`));
    if (retained.has(`result-${index}.json`)) {
      const evidence = await read<{ studyId: string; index: number; modelId: DeepModelId; caseId: string; dispatchSha256: string; result: NonNullable<DeepRow["result"]> }>(join(DEEP_ROOT, "attempts", `result-${index}.json`));
      if (!dispatch || evidence.studyId !== study.id || evidence.index !== index || evidence.modelId !== row.modelId || evidence.caseId !== row.caseId || evidence.dispatchSha256 !== sha256(dispatch)) throw new Error("A retained result has an invalid receipt binding.");
      result = evidence.result;
    }
    rows[index] = { ...row, dispatch, result };
  }
  if (names.length !== rows.reduce((sum, row) => sum + Number(row.dispatch !== null) + Number(row.result !== null), 0)) throw new Error("Out-of-population research artifacts were found.");
  const terminalExists = await Bun.file(join(DEEP_ROOT, "terminal.json")).exists();
  const terminal = terminalExists ? await read<{ finishedAt: string }>(join(DEEP_ROOT, "terminal.json")) : null;
  if (terminal) validateTerminal(terminal, study, rows);
  const report = reconstructReport(study, cases, rows, terminalExists, terminal?.finishedAt);
  if (await Bun.file(join(DEEP_ROOT, "report.json")).exists() && !sameData(await read<unknown>(join(DEEP_ROOT, "report.json")), report)) throw new Error("The retained terminal report differs from reconstructed original outcomes.");
  return { study, cases, rows, report };
}

export function validateTerminal(input: unknown, study: Pick<DeepStudy, "id" | "frozenAt">, rows: readonly DeepRow[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The terminal research record is invalid.");
  const record = input as Record<string, unknown>, finishedAt = record.finishedAt;
  if (record.studyId !== study.id || typeof finishedAt !== "string" || !Number.isFinite(Date.parse(finishedAt)) || new Date(finishedAt).toISOString() !== finishedAt
    || Date.parse(finishedAt) < Date.parse(study.frozenAt) || Date.parse(finishedAt) > Date.now() || typeof record.stopped !== "boolean" || !Number.isSafeInteger(record.failures)
    || (record.failures as number) < 0 || (record.failures as number) > 12 || record.authorizedSends !== rows.filter(row => row.dispatch).length
    || rows.some(row => row.result && Date.parse(row.result.finishedAt) > Date.parse(finishedAt))
    || !record.stopped && (rows.some(row => !row.result || !hasModelOutcome(row.result)) || record.failures !== 0)) throw new Error("Terminal study identity, chronology or dispatch accounting is inconsistent.");
}

export interface OutcomeAudit {
  readonly verdict: "pass";
  readonly reviewer: string;
  readonly checkedAt: string;
  readonly reportSha256: string;
  readonly rowsSha256: string;
  readonly inspectedWrongOrUnusable: readonly string[];
  readonly diagnoses: readonly { readonly modelId: DeepModelId; readonly caseId: string; readonly referenceSha256: string; readonly requestBodySha256: string; readonly resultSha256: string; readonly note: string }[];
  readonly correctLabelExplanationsInspected: number;
  readonly explanationFindings: readonly { readonly modelId: DeepModelId; readonly caseId: string; readonly resultSha256: string; readonly note: string }[];
}
export async function exportStudy(auditPath: string, output: string) {
  const { study, cases, rows, report } = await reconcileStudy(), audit = await read<OutcomeAudit>(auditPath);
  const summary = buildPublicSummary(study, cases, rows, report, audit);
  await mkdir(dirname(resolve(output)), { recursive: true });
  // The operator reviews this new artifact before replacing the public landing projection.
  await retain(resolve(output), summary); return summary;
}

export function buildPublicSummary(study: DeepStudy, cases: readonly ImportedCase[], rows: readonly DeepRow[], report: ReturnType<typeof reconstructReport>, audit: OutcomeAudit) {
  if (!sameData(report, reconstructReport(study, cases, rows, report.terminal, report.evidenceCutoffAt))) throw new Error("Public scores differ from the reconstructed research outcomes.");
  const labels = new Map(cases.map(task => [task.id, task.label]));
  const required = rows.filter(row => hasModelOutcome(row.result) && (row.result!.outcome.kind !== "answer" || row.result!.outcome.label !== labels.get(row.caseId))).map(row => `${row.modelId}:${row.caseId}`).sort();
  const latestEvidence = Date.parse(report.evidenceCutoffAt);
  if (audit.verdict !== "pass" || !audit.reviewer.trim() || !Number.isFinite(Date.parse(audit.checkedAt)) || new Date(audit.checkedAt).toISOString() !== audit.checkedAt
    || Date.parse(audit.checkedAt) < latestEvidence || Date.parse(audit.checkedAt) > Date.now() || audit.reportSha256 !== sha256(report) || audit.rowsSha256 !== sha256(rows)
    || !sameData([...audit.inspectedWrongOrUnusable].sort(), required) || !Array.isArray(audit.diagnoses)
    || !sameData(audit.diagnoses.map(row => `${row.modelId}:${row.caseId}`).sort(), required)
    || audit.correctLabelExplanationsInspected !== report.models.reduce((sum, model) => sum + model.overall.correct, 0)
    || report.models.every(model => model.overall.dispatched === 0)) throw new Error("An independent original-outcome audit is required before public score export.");
  for (const diagnosis of audit.diagnoses) {
    const row = rows.find(row => row.modelId === diagnosis.modelId && row.caseId === diagnosis.caseId), task = cases.find(task => task.id === diagnosis.caseId);
    if (!row?.result || !task || diagnosis.resultSha256 !== sha256(row.result) || diagnosis.referenceSha256 !== task.referenceSha256
      || diagnosis.requestBodySha256 !== row.dispatch?.requestBodySha256 || !diagnosis.note.trim()) throw new Error("A failure diagnosis is not bound to its original request, reference and transcript.");
  }
  for (const finding of audit.explanationFindings) {
    const row = rows.find(row => row.modelId === finding.modelId && row.caseId === finding.caseId);
    if (!row?.result || !hasModelOutcome(row.result) || row.result.outcome.kind !== "answer" || row.result.outcome.label !== labels.get(row.caseId)
      || finding.resultSha256 !== sha256(row.result) || !finding.note.trim()) throw new Error("An explanation finding is not bound to an original correct-label response.");
  }
  const scoreOnly = <T extends { classification: unknown }>(score: T) => { const { classification: _classification, ...summary } = score; void _classification; return summary; };
  return { version: "1", studyId: study.id, state: report.state, depthMeasure: "requested-generator-depth", requestedDepths: [5, 10, 20, 40, 80, 160, 320, 512], tasksPerDepth: 100, trialsPerTask: 1,
    cohortId: `population-${study.populationSha256}`, cohortSourceId: study.sourceId, cohortSha256: study.populationSha256, reportSha256: sha256(report),
    audit: { verdict: "pass", reportSha256: sha256(report), referenceReviewSha256: sha256(study.referenceReview) },
    models: report.models.map(model => ({ ...model, overall: scoreOnly(model.overall), byDepth: model.byDepth.map(slice => ({ ...slice, score: scoreOnly(slice.score) })) })) };
}
