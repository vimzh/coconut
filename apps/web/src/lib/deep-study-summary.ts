// Validate the public study projection before displaying audited scores or coverage.
import summary from "../../public/deep-study-scores.json";

export const requestedGeneratorDepths = [5, 10, 20, 40, 80, 160, 320, 512] as const;

export interface DeepStudyScore {
  planned: number;
  dispatched: number;
  modelOutcomes: number;
  correct: number;
  wrongValid: number;
  unusable: number;
  providerFailures: number;
  unknownRemote: number;
  inFlight: number;
  unattempted: number;
  accuracy: number | null;
  macroF1: number | null;
  status: "complete" | "provisional" | "unavailable" | "planned";
}

export interface DeepStudyModel {
  modelId: string;
  reportedModelIds: string[];
  settings: {
    profileId: string;
    reasoning: string | null;
    maxOutputTokens: number;
    inferenceTimeoutMs: number;
  };
  overall: DeepStudyScore;
  byDepth: {
    requestedDepth: number;
    realizedDepths: { depth: number; count: number }[];
    score: DeepStudyScore;
  }[];
}

export interface DeepStudySummary {
  version: "1";
  studyId: string;
  state: "planned" | "running" | "complete" | "incomplete" | "unavailable";
  depthMeasure: "requested-generator-depth";
  requestedDepths: number[];
  tasksPerDepth: 100;
  trialsPerTask: 1;
  cohortId: string | null;
  cohortSourceId: string | null;
  cohortSha256: string | null;
  reportSha256: string | null;
  audit: {
    verdict: "pending" | "pass";
    reportSha256: string | null;
    referenceReviewSha256: string | null;
  };
  models: DeepStudyModel[];
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid deep study summary: ${message}.`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
  return value as Record<string, unknown>;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

const countFields = ["planned", "dispatched", "modelOutcomes", "correct", "wrongValid", "unusable", "providerFailures", "unknownRemote", "inFlight", "unattempted"] as const;

function validateScore(value: unknown, planned: number, path: string): DeepStudyScore {
  const score = record(value, path);
  for (const field of countFields) requireValue(integer(score[field]), `${path}.${field} must be a nonnegative integer`);
  const result = score as unknown as DeepStudyScore;
  requireValue(result.planned === planned, `${path}.planned must equal ${planned}`);
  requireValue(result.correct + result.wrongValid + result.unusable === result.modelOutcomes, `${path} model outcomes do not reconcile`);
  requireValue(result.modelOutcomes + result.providerFailures + result.inFlight + result.unattempted === planned, `${path} coverage does not reconcile`);
  requireValue(result.dispatched === planned - result.unattempted, `${path} dispatch count does not reconcile`);
  requireValue(result.unknownRemote <= result.providerFailures, `${path} unknown remote count exceeds provider failures`);

  if (result.modelOutcomes === 0) {
    requireValue(result.accuracy === null && result.macroF1 === null, `${path} has scores without model outcomes`);
  } else {
    requireValue(typeof result.accuracy === "number" && Number.isFinite(result.accuracy) && Math.abs(result.accuracy - result.correct / result.modelOutcomes) < 1e-12, `${path} accuracy uses the wrong denominator`);
    requireValue(typeof result.macroF1 === "number" && Number.isFinite(result.macroF1) && result.macroF1 >= 0 && result.macroF1 <= 1, `${path}.macroF1 must be a finite fraction`);
  }

  const expectedStatus = result.modelOutcomes === planned ? "complete"
    : result.modelOutcomes > 0 ? "provisional"
      : result.dispatched === 0 ? "planned" : "unavailable";
  requireValue(result.status === expectedStatus, `${path}.status does not match its evidence`);
  return result;
}

export function parseDeepStudySummary(value: unknown): DeepStudySummary {
  const data = record(value, "summary");
  requireValue(data.version === "1", "unsupported version");
  requireValue(nonempty(data.studyId), "studyId is required");
  requireValue(["planned", "running", "complete", "incomplete", "unavailable"].includes(String(data.state)), "state is invalid");
  requireValue(data.depthMeasure === "requested-generator-depth", "depth measure must remain explicit");
  requireValue(JSON.stringify(data.requestedDepths) === JSON.stringify(requestedGeneratorDepths), "requested depths do not match the frozen design");
  requireValue(data.tasksPerDepth === 100 && data.trialsPerTask === 1, "the design must use 100 tasks per depth and one response per task");
  for (const field of ["cohortId", "cohortSourceId"] as const) requireValue(data[field] === null || nonempty(data[field]), `${field} must be an identity or null`);
  for (const field of ["cohortSha256", "reportSha256"] as const) requireValue(data[field] === null || hash(data[field]), `${field} must be a SHA-256 hash or null`);
  const audit = record(data.audit, "audit");
  requireValue(audit.verdict === "pending" || audit.verdict === "pass", "audit verdict is invalid");
  requireValue(audit.reportSha256 === null || hash(audit.reportSha256), "audit report hash is invalid");
  requireValue(audit.referenceReviewSha256 === null || hash(audit.referenceReviewSha256), "reference review hash is invalid");
  requireValue(Array.isArray(data.models), "models must be an array");

  const ids = new Set<string>();
  for (const entry of data.models) {
    const model = record(entry, "model");
    requireValue(nonempty(model.modelId) && !ids.has(model.modelId), "model identities must be nonempty and unique");
    ids.add(model.modelId);
    requireValue(Array.isArray(model.reportedModelIds) && model.reportedModelIds.every(nonempty) && new Set(model.reportedModelIds).size === model.reportedModelIds.length, "reported model identities are invalid");
    const settings = record(model.settings, `${model.modelId}.settings`);
    requireValue(nonempty(settings.profileId), "profile identity is required");
    requireValue(settings.reasoning === null || nonempty(settings.reasoning), "reasoning setting is invalid");
    requireValue(integer(settings.maxOutputTokens) && settings.maxOutputTokens > 0 && integer(settings.inferenceTimeoutMs) && settings.inferenceTimeoutMs > 0, "token and deadline limits must be positive integers");
    const overall = validateScore(model.overall, 800, `${model.modelId}.overall`);
    requireValue(Array.isArray(model.byDepth) && model.byDepth.length === requestedGeneratorDepths.length, "every model must retain all eight requested depths");
    const scores: DeepStudyScore[] = [];
    for (const [index, entry] of model.byDepth.entries()) {
      const slice = record(entry, `${model.modelId}.byDepth`);
      const requestedDepth = requestedGeneratorDepths[index];
      requireValue(slice.requestedDepth === requestedDepth, "depth slices must retain the frozen order");
      const score = validateScore(slice.score, 100, `${model.modelId}.depth${requestedDepth}`);
      scores.push(score);
      requireValue(Array.isArray(slice.realizedDepths), "realized depths must be an array");
      const depths = new Set<number>();
      let realizedCount = 0;
      for (const entry of slice.realizedDepths) {
        const realized = record(entry, "realized depth");
        requireValue(integer(realized.depth) && realized.depth >= requestedDepth && realized.depth <= requestedDepth + 1 && !depths.has(realized.depth), "realized source depth must be the requested depth or its successor");
        requireValue(integer(realized.count) && realized.count > 0, "realized depth counts must be positive integers");
        depths.add(realized.depth);
        realizedCount += realized.count;
      }
      requireValue(realizedCount === (data.cohortId === null ? 0 : 100), "realized depths must cover the frozen cohort");
    }
    for (const field of countFields) requireValue(scores.reduce((sum, score) => sum + score[field], 0) === overall[field], `${model.modelId}.${field} does not match depth slices`);
  }

  const result = data as unknown as DeepStudySummary;
  const hasDispatches = result.models.some(model => model.overall.dispatched > 0);
  if (hasDispatches || result.audit.verdict === "pass") {
    requireValue(nonempty(result.cohortId) && nonempty(result.cohortSourceId) && hash(result.cohortSha256) && hash(result.reportSha256) && hash(result.audit.referenceReviewSha256), "audited evidence needs cohort, source, report and reference bindings");
    requireValue(result.audit.verdict === "pass" && result.audit.reportSha256 === result.reportSha256, "displayed evidence needs a matching passed report audit");
  }
  requireValue(result.state !== "planned" || !hasDispatches, "planned study contains dispatches");
  requireValue(result.state !== "complete" || (result.models.length > 0 && result.models.every(model => model.overall.status === "complete")), "complete study contains incomplete model evidence");
  requireValue(result.state === "running" || result.models.every(model => model.overall.inFlight === 0), "active requests require a running study state");
  requireValue(result.state !== "unavailable" || result.models.every(model => model.overall.modelOutcomes === 0), "unavailable study contains scored model outcomes");
  return result;
}

export const deepStudySummary = parseDeepStudySummary(summary);
export const hasPublishedDeepStudy = deepStudySummary.audit.verdict === "pass" && deepStudySummary.models.some(model => model.overall.dispatched > 0);
