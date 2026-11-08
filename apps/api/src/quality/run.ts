// Reconcile a run against canonical prompts and shared scoring before reporting safe offline diagnostics.
import { buildNumericalPrompts } from "../numerics/prompt";
import { buildPrompt, calculateWorkload, getProfile } from "../protocol";
import type { RunRecord } from "../runs/types";
import { scoreEvaluation } from "../scoring";
import { bindEvidence, parseEvidence } from "../scoring/evidence";
import type { Observation } from "../scoring/types";
import { validateSuiteArtifact } from "../suites/artifact";
import { clusterBootstrapInterval } from "./bootstrap";
import { finding, finish, QUALITY_CRITERIA_SHA256, qualityGate, sameData, sha256, snapshot } from "./data";
import { assessValidatedSignal, finalResult, verifyReviews } from "./signal";
import { analyzeValidatedSuite, requireBoundedSuite } from "./suite";
import type { QualityFinding, QualityReport, SignalReviewEvidence } from "./types";

export async function auditRun(input: RunRecord, reviewInput?: SignalReviewEvidence): Promise<QualityReport> {
  const record = snapshot(input), review = reviewInput ? snapshot(reviewInput) : undefined;
  requireBoundedSuite(record.suite);
  const parsed = parseEvidence(record.evidence);
  const suite = await validateSuiteArtifact(record.suite);
  const evidence = bindEvidence(parsed, suite);
  if (record.version !== "1" || record.id !== evidence.runId || record.request.profileId !== evidence.profileId ||
    record.request.provider !== evidence.model.provider || record.request.modelId !== evidence.model.modelId) {
    throw new Error("Run record identity differs from its retained scoring evidence.");
  }
  const profile = getProfile(evidence.profileId), workload = calculateWorkload(evidence.profileId, suite.cases.length);
  const scoring = await scoreEvaluation({ suite, evidence });
  if (record.report !== null && !sameData(record.report, scoring)) throw new Error("Retained scoring report differs from complete shared-scorer replay.");
  const suiteReport = analyzeValidatedSuite(suite);
  const findings: QualityFinding[] = [...suiteReport.findings];
  const canonicalPrompts = suite.formatVersion === "2"
    ? await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), profile.id, suite.promptVersion)
    : suite.cases.map((entry) => buildPrompt(entry.reference, profile.id));
  const expectedPrompt = new Map(suite.cases.map((entry, index) => [entry.id, canonicalPrompts[index]]));
  let promptMismatch = !sameData(record.prompts, canonicalPrompts), budgetMismatch = !sameData(record.workload, workload);
  let requestMismatch = false, unknownSettings = false;
  const resultKeys = new Set<string>(), attempts = new Map(evidence.trials.map((trial) => [`${trial.caseId}:${trial.trialIndex}`, trial]));
  if (record.results.length > suite.cases.length * profile.trialsPerInstance * profile.maxAttemptsPerTrial) throw new Error("Run results exceed the fixed planned attempt population.");
  for (const row of record.results) {
    const result = row.result, trial = attempts.get(`${row.caseId}:${row.trialIndex}`), sequence = result.evidence.sequence;
    const key = `${row.caseId}:${row.trialIndex}:${sequence}`;
    if (!trial || resultKeys.has(key) || !Number.isInteger(sequence) || sequence < 1 || sequence > trial.attempts.length ||
      !sameData(trial.attempts[sequence - 1], result.evidence)) throw new Error("Inference results must bind each retained attempt exactly once to its case/trial.");
    resultKeys.add(key);
    if (!sameData(result.prompt, expectedPrompt.get(row.caseId))) promptMismatch = true;
    if (result.version !== "1" || result.policyId !== "individual-inference-v1" || result.requested.provider !== record.request.provider ||
      result.requested.modelId !== record.request.modelId || result.requested.profileId !== record.request.profileId ||
      result.requested.servingProvider !== record.request.servingProvider) requestMismatch = true;
    if (result.budget.maxOutputTokens !== profile.maxOutputTokens || result.budget.maxInferenceRequests !== 1 || result.budget.retries !== 0 ||
      result.budget.metadataTimeoutMs !== 20_000 || result.budget.inferenceTimeoutMs !== 180_000 ||
      (result.effective.maxOutputTokens !== null && result.effective.maxOutputTokens !== profile.maxOutputTokens) ||
      (profile.reasoning !== "provider-default" && result.effective.reasoningEffort !== null && result.effective.reasoningEffort !== profile.reasoning) ||
      ![0, 1].includes(result.inferenceRequests)) budgetMismatch = true;
    if (["answer", "invalid", "refused", "truncated"].includes(result.evidence.outcome.kind) && result.inferenceRequests !== 1) requestMismatch = true;
    unknownSettings ||= result.reportedModelId === null || result.effective.maxOutputTokens === null ||
      (profile.reasoning !== "provider-default" && result.effective.reasoningEffort === null) || result.contextFit === "unverified";
  }
  const retainedAttempts = evidence.trials.reduce((sum, trial) => sum + trial.attempts.length, 0);
  if (resultKeys.size !== retainedAttempts) throw new Error("Every retained scoring attempt requires its corresponding inference result.");
  findings.push(finding("prompt-leakage", "leakage", promptMismatch ? "critical" : "warning", promptMismatch ? "unresolved" : "passed",
    promptMismatch ? "A retained prompt differs from the canonical expression/domain-only blueprint or includes extra metadata/settings."
      : "Every retained prompt exactly matches its canonical blueprint, including neutral instructions, generation fields, and response format.", [],
    "This checks retained blueprints. Outgoing wire-body/browser-asset privacy requires separate adapter integration verification."));
  findings.push(finding("budget-and-settings", "comparison", budgetMismatch || requestMismatch ? "critical" : "warning",
    budgetMismatch || requestMismatch ? "unresolved" : "passed", budgetMismatch || requestMismatch
      ? "Retained workload, request identity, deadline/retry policy, or output/reasoning settings do not match the selected profile."
      : "Requested model, route, profile, workload, output ceiling, retry policy, and deadlines are consistent across retained attempts."));
  findings.push(finding("comparison-boundary", "comparison", "warning", "accepted-scoped-limitation", unknownSettings
    ? "Some reported model/settings/context-fit evidence is unknown. No substitution of requested for reported identity is made."
    : "This report describes one requested/reported settings cell; endpoint changes and model aliases can limit reproduction.", [],
    "Different efforts/budgets/profiles remain separate descriptive cells. A common token ceiling is not equal compute. No ranking or superiority claim is established."));
  const caseMap = new Map(suite.cases.map((entry) => [entry.id, entry]));
  const observations: Observation[] = evidence.trials.map((trial) => ({
    caseId: trial.caseId, trialIndex: trial.trialIndex, depth: caseMap.get(trial.caseId)!.depth,
    referenceLabel: caseMap.get(trial.caseId)!.label,
    outcome: trial.finalAttempt === null ? null : trial.attempts[trial.finalAttempt - 1].outcome,
  }));
  verifyReviews(record, review);
  const outcomeReviews: QualityReport["outcomeReviews"] = observations.flatMap((row) => {
    if (row.outcome?.kind === "answer" && row.outcome.label === row.referenceLabel) return [];
    const result = finalResult(record, row.caseId, row.trialIndex);
    const reviewed = review?.trials.find((item) => item.caseId === row.caseId && item.trialIndex === row.trialIndex);
    const category = !row.outcome ? "unattempted" : row.outcome.kind === "answer" ? "wrong-valid-label"
      : row.outcome.kind === "invalid" ? "format-only-failure" : row.outcome.kind === "refused" ? "refusal"
        : row.outcome.kind === "truncated" ? "budget-exhaustion" : "infrastructure";
    return [{ caseId: row.caseId, trialIndex: row.trialIndex, attemptId: result?.attemptId ?? null, category,
      status: reviewed && reviewed.diagnosis !== "unresolved" ? "reviewed" : "needs-review", diagnosis: reviewed?.diagnosis ?? null }];
  });
  const headline = scoring.overall.classification, outcomes = headline.outcomes;
  const denominators: QualityReport["denominators"] = {
    plannedTrials: headline.population.plannedTrials, includedModelOutcomes: headline.population.includedTrials,
    validLabels: outcomes.answer.numerator, validCorrect: headline.population.correctTrials,
    validWrong: outcomes.answer.numerator - headline.population.correctTrials,
    malformed: outcomes.invalid.numerator, empty: outcomes.empty.numerator, conflicting: outcomes.conflicting.numerator,
    refused: outcomes.refused.numerator, truncated: outcomes.truncated.numerator, providerErrors: outcomes["provider-error"].numerator,
    interrupted: outcomes.interrupted.numerator, cancelled: outcomes.cancelled.numerator, unattempted: outcomes.unattempted.numerator,
    retainedAttempts, inferenceRequests: record.results.reduce((sum, row) => sum + row.result.inferenceRequests, 0),
    distinctInstances: suite.cases.length, clusters: suiteReport.clusters.length, families: suiteReport.population.families,
  };
  const reconciled = denominators.validCorrect + denominators.validWrong + denominators.malformed + denominators.empty + denominators.conflicting +
    denominators.refused + denominators.truncated + denominators.providerErrors + denominators.interrupted + denominators.cancelled + denominators.unattempted;
  if (reconciled !== workload.logicalCalls || denominators.plannedTrials !== workload.logicalCalls) throw new Error("Planned outcome denominators do not reconcile.");
  if (record.progress.plannedTrials !== workload.logicalCalls || record.progress.modelOutcomes !== denominators.includedModelOutcomes ||
    record.progress.inferenceRequests !== denominators.inferenceRequests) findings.push(finding("progress-reconciliation", "execution", "critical", "unresolved", "Retained progress disagrees with planned trials, included outcomes, or inference requests."));
  findings.push(finding("complete-trials", "execution", headline.population.status === "complete" ? "warning" : "missing-evidence",
    headline.population.status === "complete" ? "passed" : "unresolved",
    `${denominators.includedModelOutcomes} of ${denominators.plannedTrials} planned trials are included model outcomes. Infrastructure and unattempted work retain separate categories.`, [],
    headline.population.status === "complete" ? null : "Scores remain provisional or unavailable; excluded infrastructure is not a mathematical answer."));
  const outstanding = outcomeReviews.filter((item) => item.status === "needs-review");
  if (outstanding.length) findings.push(finding("outcome-inspection", "inspection", "missing-evidence", "unresolved",
    `${outstanding.length} wrong valid or unusable/unattempted outcomes require pinned transcript review.`, [...new Set(outstanding.map((item) => item.caseId))],
    "Unreviewed errors do not establish a mathematical-failure mechanism."));
  else findings.push(finding("outcome-inspection", "inspection", "warning", "passed", "No wrong/unusable outcome remains without a pinned applicable review."));
  let signal = assessValidatedSignal(record, review);
  if (outstanding.length || findings.some((entry) => entry.status === "unresolved" && entry.severity === "critical")) {
    signal = { ...signal, verdict: "no-go", reasons: [...signal.reasons,
      "Unreviewed outcomes or an unresolved critical identity, reference, leakage, or budget defect block a mathematical-failure claim."] };
  }
  return finish({
    version: "1" as const, policyId: "quality-criteria-v1" as const, criteriaSha256: QUALITY_CRITERIA_SHA256, runId: record.id, scoringReportId: scoring.id,
    evidenceSha256: sha256(evidence), reviewEvidenceSha256: review ? sha256(review) : null, suite: suiteReport, headline, denominators, outcomeReviews,
    comparison: {
      profileId: profile.id, outputTokenCeiling: profile.maxOutputTokens, requestedReasoning: profile.reasoning, sampling: profile.sampling,
      responseFormat: profile.responseFormat.kind, provider: evidence.model.provider, requestedModelId: evidence.model.modelId,
      reportedModelIds: [...new Set(record.results.map((row) => row.result.reportedModelId))],
      requestedServingProvider: record.request.servingProvider, reportedServingProviders: [...new Set(record.results.map((row) => row.result.reportedServingProvider))],
      effectiveTokenCeilings: [...new Set(record.results.map((row) => row.result.effective.maxOutputTokens))],
      effectiveReasoningEfforts: [...new Set(record.results.map((row) => row.result.effective.reasoningEffort))],
      endpointId: evidence.model.endpointId, settingsId: evidence.model.settingsId, equalComputeClaim: false as const,
    },
    uncertainty: clusterBootstrapInterval(suiteReport.clusters, observations), signal, findings, gate: qualityGate(findings),
  }, "run-quality-v1");
}
