// A strong mathematical-failure claim needs pinned transcript reviews and an explicit frontier/effort attestation.
import type { InferenceResult } from "../inference";
import { getProfile } from "../protocol";
import type { RunRecord, RunSuite } from "../runs/types";
import { sameData, sha256, snapshot } from "./data";
import { analyzeExpression } from "./structure";
import { provedDifferentCurvatureCore } from "./separation";
import { validateSignalExperiment } from "./experiment";
import type { QualityReport, SignalReviewEvidence } from "./types";

export const referenceReviewHash = (entry: RunSuite["cases"][number]): string => sha256({ reference: entry.reference, certificate: entry.certificate });
export const transcriptReviewHash = (result: InferenceResult): string => sha256({
  attemptId: result.attemptId, requested: result.requested, prompt: result.prompt,
  reportedModelId: result.reportedModelId, reportedServingProvider: result.reportedServingProvider,
  effective: result.effective, finishReason: result.finishReason, budget: result.budget, evidence: result.evidence,
});

export function finalResult(record: RunRecord, caseId: string, trialIndex: number): InferenceResult | undefined {
  const trial = record.evidence.trials.find((trial) => trial.caseId === caseId && trial.trialIndex === trialIndex);
  return record.results.find((row) => row.caseId === caseId && row.trialIndex === trialIndex && row.result.evidence.sequence === trial?.finalAttempt)?.result;
}

export function verifyReviews(record: RunRecord, input?: SignalReviewEvidence): void {
  if (!input) return;
  if (input.trials.length > record.suite.cases.length * 3) throw new Error("Signal review exceeds the planned trial population.");
  const seen = new Set<string>();
  for (const item of input.trials) {
    const key = `${item.caseId}:${item.trialIndex}`;
    if (seen.has(key) || ![0, 1, 2].includes(item.trialIndex)) throw new Error("Signal review has duplicate or invalid case/trial identities.");
    seen.add(key);
    const entry = record.suite.cases.find((entry) => entry.id === item.caseId);
    const result = finalResult(record, item.caseId, item.trialIndex);
    if (!entry || !result || item.attemptId !== result.attemptId || item.referenceSha256 !== referenceReviewHash(entry) ||
      item.transcriptSha256 !== transcriptReviewHash(result) || item.referenceIndependentlyChecked !== true || !["AI-assisted", "human"].includes(item.reviewerRole)) {
      throw new Error("Signal review is stale or does not pin an independently checked reference and retained transcript.");
    }
    const answer = result.evidence.outcome;
    const permitted = answer.kind === "answer" ? answer.label === entry.label ? ["correct-label"] : ["mathematical-error", "expression-domain-misreading"]
      : answer.kind === "invalid" ? ["format-only-failure"] : answer.kind === "refused" ? ["refusal"]
        : answer.kind === "truncated" ? ["budget-exhaustion"] : ["infrastructure"];
    if (item.diagnosis !== "unresolved" && !permitted.includes(item.diagnosis)) throw new Error("Transcript diagnosis contradicts its retained outcome.");
  }
}

export function assessValidatedSignal(record: RunRecord, input?: SignalReviewEvidence): QualityReport["signal"] {
  verifyReviews(record, input);
  const candidates = record.suite.cases.filter((entry) => {
    const trials = record.evidence.trials.filter((trial) => trial.caseId === entry.id);
    return trials.length === 3 && trials.every((trial) => trial.finalAttempt !== null &&
      ["answer", "invalid"].includes(trial.attempts[trial.finalAttempt - 1].outcome.kind)) && trials.filter((trial) => {
      const outcome = trial.attempts[trial.finalAttempt! - 1].outcome;
      return outcome.kind === "answer" && outcome.label !== entry.label;
    }).length >= 2;
  });
  const candidateCaseIds = candidates.map((entry) => entry.id);
  const reasons: string[] = [];
  const no = (qualifiedCaseIds: readonly string[] = []): QualityReport["signal"] => ({ verdict: "no-go", candidateCaseIds, qualifiedCaseIds, reasons });
  if (!input) { reasons.push("A predeclared frontier/highest-effort attestation and pinned independent reference/transcript reviews are missing."); return no(); }
  const review = snapshot(input), experiment = validateSignalExperiment(record, review.experiment);
  if (!experiment.valid) { reasons.push(experiment.reason); return no(); }
  const qualified = candidates.filter((entry) => {
    const reviews = review.trials.filter((item) => item.caseId === entry.id);
    if (reviews.length !== 3 || ![0, 1, 2].every((index) => reviews.some((item) => item.trialIndex === index))) return false;
    return reviews.every((item) => {
      const result = finalResult(record, entry.id, item.trialIndex)!;
      const outcome = result.evidence.outcome;
      const trial = record.evidence.trials.find((row) => row.caseId === entry.id && row.trialIndex === item.trialIndex)!;
      if (trial.finalAttempt === null || !sameData(trial.attempts[trial.finalAttempt - 1], result.evidence) ||
        result.requested.profileId !== record.request.profileId || result.requested.modelId !== record.request.modelId ||
        result.effective.reasoningEffort !== experiment.highestVerifiedEffort || result.effective.maxOutputTokens !== getProfile(record.request.profileId).maxOutputTokens ||
        result.reportedModelId === null || result.inferenceRequests !== 1 || result.finishReason === "length" ||
        result.contextFit !== "provider-enforced" || result.failure !== null) return false;
      return outcome.kind === "answer" ? item.diagnosis === (outcome.label === entry.label ? "correct-label" : "mathematical-error")
        : outcome.kind === "invalid" && item.diagnosis === "format-only-failure";
    });
  });
  const qualifiedCaseIds = qualified.map((entry) => entry.id);
  const clusters = new Set(qualified.map((entry) => "clusterId" in entry ? entry.clusterId : null).filter((id) => id !== null));
  const cores = new Set(qualified.map((entry) => analyzeExpression(entry.reference.expression, entry.reference.domain).coreSignature));
  if (clusters.size < 2 || cores.size < 2 || new Set(qualified.map((entry) => entry.family)).size < 2) {
    reasons.push("The recorded reviews do not establish two qualifying non-equivalent core clusters in two broad families, each with at least two wrong valid labels among three completed trials."); return no(qualifiedCaseIds);
  }
  if (record.suite.generatorVersion !== "challenge-v1" || record.suite.request.population !== "confirmation") {
    reasons.push("The stronger claim requires the frozen confirmation population, not screening or historical descriptive work."); return no(qualifiedCaseIds);
  }
  const separated = qualified.some((a, i) => qualified.slice(i + 1).some((b) => a.family !== b.family && "clusterId" in a && "clusterId" in b && a.clusterId !== b.clusterId &&
    "probes" in a.certificate && "probes" in b.certificate && provedDifferentCurvatureCore(a.certificate, b.certificate)));
  if (!separated) {
    reasons.push("Different signatures alone do not prove different curvature problems; certified nonproportional second derivatives have not separated two qualifying family/cluster cores."); return no(qualifiedCaseIds);
  }
  return { verdict: "go", candidateCaseIds, qualifiedCaseIds, reasons: [
    "Pinned reviews and certified nonproportional second derivatives support two distinct curvature cores in the attested experiment cell; no hidden reasoning process or universal model claim follows.",
  ] };
}
