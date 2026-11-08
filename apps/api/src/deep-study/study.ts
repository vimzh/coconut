// Freeze the one-response research population and reconstruct scores from original outcomes.
import type { ModelMetadata } from "../discovery";
import type { Label } from "../math";
import { sha256, sameData } from "../quality/data";
import { buildImportedPrompt } from "../randomized/pilot";
import type { ImportedCase } from "../randomized/types";
import { scoreClassifications } from "../scoring/classification";
import { DEEP_MODELS, DEEP_SETTINGS, buildDeepRequestBody, type DeepAttempt, type DeepModelId } from "./transport";
import { assertAttemptReplay } from "./audit";

export const DEPTHS = [5, 10, 20, 40, 80, 160, 320, 512] as const;
const LABELS = ["convex", "concave", "neither"] as const;
const HASH = /^[a-f0-9]{64}$/;
const instant = (value: string) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const STUDY_BUDGET = { finalSends: 2400, developmentSends: 30, sharedSendCeiling: 2430, maxConcurrency: 12, studyTimeoutMs: 43200000, retries: 0, trialsPerCase: 1 } as const;

export interface ReferenceReview {
  readonly populationSha256: string;
  readonly caseBindingsSha256: string;
  readonly verdict: "pass";
  readonly reviewer: string;
  readonly checkedAt: string;
}
export interface CompatibilityControl {
  readonly modelId: DeepModelId;
  readonly metadata: ModelMetadata;
  readonly task: ImportedCase;
  readonly result: DeepAttempt;
  readonly dispatchSha256: string;
}
export interface DeepStudy {
  readonly version: "1";
  readonly methodId: "deep-single-response-v1";
  readonly id: string;
  readonly frozenAt: string;
  readonly populationPath: string;
  readonly populationSha256: string;
  readonly sourceId: string;
  readonly implementationSha256: string;
  readonly referenceReview: ReferenceReview;
  readonly controls: readonly CompatibilityControl[];
  readonly accounting: { readonly priorDevelopmentSends: 2; readonly priorUnknownRemote: 1; readonly priorEvidenceSha256: string; readonly probeSends: 3 };
  readonly caseBindingsSha256: string;
  readonly requestBindingsSha256: string;
  readonly budget: typeof STUDY_BUDGET;
  readonly settings: typeof DEEP_SETTINGS;
  readonly models: typeof DEEP_MODELS;
}

export const caseBindings = (cases: readonly ImportedCase[]) => cases.map(task => ({ id: task.id, label: task.label, referenceSha256: task.referenceSha256,
  requestedDepth: task.requestedDepth, actualDepth: task.actualDepth, expressionSha256: sha256(task.expression), domain: task.domain }));

export function validatePopulation(cases: readonly ImportedCase[]): void {
  if (cases.length !== 800 || new Set(cases.map(task => task.id)).size !== 800
    || new Set(cases.map(task => sha256({ expression: task.expression, domain: task.domain }))).size !== 800) throw new Error("The final research population requires 800 distinct function/domain pairs.");
  for (const [index, depth] of DEPTHS.entries()) {
    const rows = cases.filter(task => task.requestedDepth === depth);
    if (rows.length !== 100 || LABELS.some((label, labelIndex) => rows.filter(task => task.label === label).length !== 33 + Number(index % 3 === labelIndex)))
      throw new Error("Each frozen depth requires the rotating 34/33/33 reference quota.");
  }
  for (const task of cases) {
    if (!DEPTHS.includes(task.requestedDepth as typeof DEPTHS[number]) || ![task.requestedDepth, task.requestedDepth + 1].includes(task.actualDepth)
      || !HASH.test(task.referenceSha256) || task.domain.min !== "-1" || task.domain.max !== "1" || !LABELS.includes(task.label)
      || !/^[A-Za-z0-9_-]{1,128}$/.test(task.id) || !task.expression.trim() || task.expression.length > 131072
      || !Number.isSafeInteger(task.nodeCount) || task.nodeCount < 1 || task.nodeCount > 16384
      || !Number.isSafeInteger(task.astDepth) || task.astDepth < 0 || task.astDepth > 4096
      || !Number.isSafeInteger(task.nonlinearPath) || task.nonlinearPath < 0 || task.nonlinearPath > task.astDepth
      || !task.coreHashes.length || task.coreHashes.some(hash => !HASH.test(hash))) throw new Error("A final task violates the source/domain/reference bounds.");
    buildImportedPrompt(task);
  }
}

export function freezeStudy(input: Omit<DeepStudy, "id" | "version" | "methodId" | "caseBindingsSha256" | "requestBindingsSha256" | "budget" | "settings" | "models">,
  cases: readonly ImportedCase[]): DeepStudy {
  validatePopulation(cases);
  const binding = sha256(caseBindings(cases)), review = input.referenceReview;
  if (![input.populationSha256, input.implementationSha256, input.accounting.priorEvidenceSha256, review.populationSha256, review.caseBindingsSha256].every(value => HASH.test(value))
    || review.verdict !== "pass" || review.populationSha256 !== input.populationSha256 || review.caseBindingsSha256 !== binding || !review.reviewer.trim()
    || !instant(review.checkedAt) || Date.parse(review.checkedAt) > Date.parse(input.frozenAt) || !instant(input.frozenAt) || Date.parse(input.frozenAt) > Date.now()
    || !input.sourceId.trim() || !input.populationPath.trim() || input.accounting.priorDevelopmentSends !== 2 || input.accounting.priorUnknownRemote !== 1 || input.accounting.probeSends !== 3)
    throw new Error("The population, reference review, implementation or shared accounting is not bound to this study.");
  if (input.controls.length !== 3 || new Set(input.controls.map(control => control.modelId)).size !== 3) throw new Error("One retained research-profile compatibility control per model is required.");
  for (const model of DEEP_MODELS) {
    const control = input.controls.find(row => row.modelId === model.modelId), result = control?.result;
    if (!control || !result || !HASH.test(control.dispatchSha256) || control.metadata.modelId !== model.modelId || !control.metadata.exactRoute
      || control.metadata.servingProvider !== null || !hasModelOutcome(result) || !result.normalized?.reportedModelId
      || result.methodId !== "deep-single-response-v1" || result.inferenceTimeoutMs !== 600000 || !instant(result.startedAt) || !instant(result.finishedAt)
      || Date.parse(result.finishedAt) < Date.parse(result.startedAt)
      || result.normalized.effective.maxOutputTokens !== DEEP_SETTINGS.maxOutputTokens || result.normalized.effective.reasoningEffort !== model.reasoningEffort
      || result.normalized.effective.truncation !== "disabled" || Date.parse(result.finishedAt) > Date.parse(input.frozenAt)
      || cases.some(task => task.id === control.task.id || task.coreHashes.some(hash => control.task.coreHashes.includes(hash))
        || sha256({ expression: task.expression, domain: task.domain }) === sha256({ expression: control.task.expression, domain: control.task.domain })))
      throw new Error("A model's retained 32k/600-second compatibility control is unavailable or exposed in the final population.");
    assertAttemptReplay(result, model.modelId, control.metadata);
  }
  const content = { ...input, version: "1" as const, methodId: "deep-single-response-v1" as const, caseBindingsSha256: binding,
    requestBindingsSha256: sha256(cases.flatMap(task => DEEP_MODELS.map(model => sha256(buildDeepRequestBody(task, model.modelId))))), budget: STUDY_BUDGET, settings: DEEP_SETTINGS, models: DEEP_MODELS };
  return { ...content, id: `deep-study-${sha256(content)}` };
}

export function assertStudy(study: DeepStudy, cases: readonly ImportedCase[], implementationSha256: string): void {
  const { id: _id, version: _version, methodId: _methodId, caseBindingsSha256: _cases, requestBindingsSha256: _requests, budget: _budget, settings: _settings, models: _models, ...input } = study;
  void [_id, _version, _methodId, _cases, _requests, _budget, _settings, _models];
  if (study.implementationSha256 !== implementationSha256 || !sameData(study, freezeStudy(input, cases))) throw new Error("The frozen research study, population or implementation changed.");
}

export interface DeepReceipt {
  readonly studyId: string;
  readonly ordinal: number;
  readonly modelId: DeepModelId;
  readonly caseId: string;
  readonly trialIndex: 0;
  readonly referenceSha256: string;
  readonly requestBodySha256: string;
  readonly authorizedAt: string;
  readonly remoteOutcomeUntilRetained: "unknown";
}
export interface DeepRow {
  readonly modelId: DeepModelId;
  readonly caseId: string;
  readonly trialIndex: 0;
  readonly dispatch: DeepReceipt | null;
  readonly result: DeepAttempt | null;
}
export const hasModelOutcome = (result: DeepAttempt | null): boolean => result !== null && result.inferenceRequests === 1 && result.failure === null
  && ["answer", "invalid", "refused", "truncated"].includes(result.outcome.kind);

export function createRows(cases: readonly ImportedCase[]): DeepRow[] {
  validatePopulation(cases);
  return cases.flatMap(task => DEEP_MODELS.map(model => ({ modelId: model.modelId, caseId: task.id, trialIndex: 0 as const, dispatch: null, result: null })));
}

export function validateRows(study: DeepStudy, cases: readonly ImportedCase[], rows: readonly DeepRow[]): void {
  const expected = createRows(cases);
  if (rows.length !== 2400 || rows.some((row, index) => row.modelId !== expected[index].modelId || row.caseId !== expected[index].caseId || row.trialIndex !== 0))
    throw new Error("Every final model/case/trial identity must occur exactly once in frozen order.");
  const tasks = new Map(cases.map(task => [task.id, task])), ordinals = new Set<number>();
  for (const row of rows) {
    const receipt = row.dispatch, result = row.result, task = tasks.get(row.caseId)!;
    if (receipt) {
      if (receipt.studyId !== study.id || receipt.modelId !== row.modelId || receipt.caseId !== row.caseId || receipt.trialIndex !== 0 || receipt.referenceSha256 !== task.referenceSha256
        || receipt.requestBodySha256 !== sha256(buildDeepRequestBody(task, row.modelId)) || !Number.isSafeInteger(receipt.ordinal) || receipt.ordinal < 1 || receipt.ordinal > 2400
        || ordinals.has(receipt.ordinal) || !instant(receipt.authorizedAt) || Date.parse(receipt.authorizedAt) < Date.parse(study.frozenAt)
        || receipt.remoteOutcomeUntilRetained !== "unknown") throw new Error("A research dispatch receipt is invalid or repeated.");
      ordinals.add(receipt.ordinal);
    }
    if (result && (!receipt || result.inferenceRequests !== 1 || result.methodId !== study.methodId || result.inferenceTimeoutMs !== 600000
      || !instant(result.startedAt) || !instant(result.finishedAt) || Date.parse(result.startedAt) < Date.parse(study.frozenAt)
      || Date.parse(result.startedAt) > Date.parse(receipt.authorizedAt) || Date.parse(result.finishedAt) < Date.parse(receipt.authorizedAt)))
      throw new Error("A retained research result has no compatible original dispatch.");
    if (result) assertAttemptReplay(result, row.modelId, study.controls.find(control => control.modelId === row.modelId)!.metadata);
    if (result?.failure === null) {
      const settings = DEEP_MODELS.find(model => model.modelId === row.modelId)!, control = study.controls.find(control => control.modelId === row.modelId)!;
      if (!result.normalized || result.normalized.reportedModelId !== control.result.normalized!.reportedModelId || result.normalized.effective.maxOutputTokens !== 32768
        || result.normalized.effective.reasoningEffort !== settings.reasoningEffort || result.normalized.effective.truncation !== "disabled") throw new Error("A research outcome differs from its frozen accepted model/settings cell.");
    }
  }
  if ([...ordinals].some(ordinal => ordinal > ordinals.size)) throw new Error("The research dispatch sequence has a gap.");
}

function summarize(rows: readonly DeepRow[], labels: ReadonlyMap<string, Label>, terminal: boolean) {
  const classification = scoreClassifications(rows.map(row => ({ caseId: row.caseId, depth: 0, trialIndex: 0, referenceLabel: labels.get(row.caseId)!, outcome: hasModelOutcome(row.result) ? row.result!.outcome : null })), 1);
  const modelOutcomes = rows.filter(row => hasModelOutcome(row.result)).length, correct = classification.population.correctTrials;
  const wrongValid = rows.filter(row => hasModelOutcome(row.result) && row.result!.outcome.kind === "answer" && row.result!.outcome.label !== labels.get(row.caseId)).length;
  const missing = rows.filter(row => row.dispatch && !row.result).length;
  const dispatched = rows.filter(row => row.dispatch).length, providerFailures = rows.filter(row => row.result && !hasModelOutcome(row.result)).length + (terminal ? missing : 0);
  return { planned: rows.length, dispatched, modelOutcomes, correct, wrongValid, unusable: modelOutcomes - correct - wrongValid, providerFailures,
    unknownRemote: rows.filter(row => row.result && row.dispatch && (row.result.failure?.remoteOutcome === "unknown" || !hasModelOutcome(row.result) && row.result.failure === null)).length + (terminal ? missing : 0),
    inFlight: terminal ? 0 : missing, unattempted: rows.length - dispatched,
    accuracy: classification.accuracy.value, macroF1: classification.macroF1,
    status: modelOutcomes === rows.length ? "complete" as const : modelOutcomes > 0 ? "provisional" as const : dispatched ? "unavailable" as const : "planned" as const,
    classification: { population: classification.population, classes: classification.classes, confusion: classification.confusion, outcomes: classification.outcomes } };
}

export function reconstructReport(study: DeepStudy, cases: readonly ImportedCase[], rows: readonly DeepRow[], terminal: boolean, terminalAt?: string) {
  validateRows(study, cases, rows);
  const latest = Math.max(Date.parse(study.frozenAt), ...rows.flatMap(row => [row.dispatch ? Date.parse(row.dispatch.authorizedAt) : 0, row.result ? Date.parse(row.result.finishedAt) : 0]));
  const evidenceCutoffAt = terminalAt ?? new Date(latest).toISOString();
  if (!instant(evidenceCutoffAt) || Date.parse(evidenceCutoffAt) < latest) throw new Error("The report cutoff predates its retained evidence.");
  const labels = new Map(cases.map(task => [task.id, task.label]));
  const models = DEEP_MODELS.map(model => ({ modelId: model.modelId,
    reportedModelIds: [...new Set(rows.filter(row => row.modelId === model.modelId).flatMap(row => row.result?.normalized?.reportedModelId ? [row.result.normalized.reportedModelId] : []))],
    settings: { profileId: DEEP_SETTINGS.profileId, reasoning: model.reasoningEffort, maxOutputTokens: 32768, inferenceTimeoutMs: 600000 },
    overall: summarize(rows.filter(row => row.modelId === model.modelId), labels, terminal),
    byDepth: DEPTHS.map(requestedDepth => { const tasks = cases.filter(task => task.requestedDepth === requestedDepth), ids = new Set(tasks.map(task => task.id));
      return { requestedDepth, realizedDepths: [requestedDepth, requestedDepth + 1].map(depth => ({ depth, count: tasks.filter(task => task.actualDepth === depth).length })).filter(row => row.count),
        score: summarize(rows.filter(row => row.modelId === model.modelId && ids.has(row.caseId)), labels, terminal) }; }),
  }));
  return { version: "1" as const, studyId: study.id, terminal, evidenceCutoffAt, state: !terminal ? "running" as const : models.every(model => model.overall.status === "complete") ? "complete" as const
    : models.some(model => model.overall.modelOutcomes) ? "incomplete" as const : "unavailable" as const,
  populationSha256: study.populationSha256, caseBindingsSha256: study.caseBindingsSha256, referenceReviewSha256: sha256(study.referenceReview),
  rowsSha256: sha256(rows), dispatched: rows.filter(row => row.dispatch).length, cumulativeSends: 5 + rows.filter(row => row.dispatch).length, models };
}
