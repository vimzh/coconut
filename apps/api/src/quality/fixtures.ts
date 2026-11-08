// Offline test records use controlled replies and canonical prompts, with no inference client or credential access.
import type { InferenceResult } from "../inference";
import { buildNumericalPrompts } from "../numerics/prompt";
import { buildPrompt, calculateWorkload, extractAnswer, getProfile, type ModelReply } from "../protocol";
import type { RunRecord, RunSuite } from "../runs/types";
import { scoreEvaluation, type AttemptEvidence, type RunEvidence } from "../scoring";
import { sha256 } from "./data";
import type { SignalReviewEvidence } from "./types";

export type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;

export async function fixtureRun(input?: RunSuite): Promise<Mutable<RunRecord>> {
  const suite = input ?? (await Bun.file(new URL("../../data/scoring/mixed-v1.input.json", import.meta.url)).json()).suite as RunSuite;
  const profile = getProfile(suite.request.profileId), workload = calculateWorkload(profile.id, suite.cases.length);
  const prompts = suite.formatVersion === "2" ? await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), profile.id, suite.promptVersion)
    : suite.cases.map((entry) => buildPrompt(entry.reference, profile.id));
  const requested = { provider: "openai" as const, modelId: "fixture-model", servingProvider: null, profileId: profile.id };
  const results: RunRecord["results"][number][] = [], trials: RunEvidence["trials"][number][] = [];
  suite.cases.forEach((entry, i) => [0, 1, 2].forEach((trialIndex) => {
    const attempt: AttemptEvidence = {
      sequence: 1, outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: entry.label, explanation: "Controlled fixture." }) }, profile.id),
      errorKind: null, elapsedMs: 1, usage: { input: null, output: null, reasoning: null }, cost: null,
    };
    const result: InferenceResult = {
      version: "1", policyId: "individual-inference-v1", attemptId: `fixture-attempt-${i}-${trialIndex}`,
      startedAt: "2026-11-08T00:00:00.000Z", finishedAt: "2026-11-08T00:00:00.001Z",
      requested, selection: null, metadata: null, prompt: prompts[i], reportedModelId: "fixture-model-snapshot", reportedServingProvider: null,
      effective: { maxOutputTokens: profile.maxOutputTokens, reasoningEffort: profile.reasoning === "provider-default" ? null : profile.reasoning,
        truncation: "disabled", nativeSchemaAccepted: profile.responseFormat.kind === "json-schema" ? true : null },
      finishReason: "completed", contextFit: "provider-enforced", evidence: attempt, failure: null, httpAttempts: 1, inferenceRequests: 1,
      budget: { maxInferenceRequests: 1, maxOutputTokens: profile.maxOutputTokens, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, retries: 0 },
    };
    results.push({ caseId: entry.id, trialIndex, result });
    trials.push({ caseId: entry.id, trialIndex, finalAttempt: 1, elapsedMs: 1, attempts: [attempt] });
  }));
  const evidence: RunEvidence = { runId: "quality-fixture-v1", suiteId: suite.id, protocolVersion: "1", profileId: profile.id,
    model: { provider: "openai", modelId: "fixture-model", endpointId: "fixture-endpoint", settingsId: "fixture-settings" },
    run: { elapsedMs: 10, concurrency: 2 }, trials, expressionTokens: [] };
  return structuredClone({
    version: "1", id: evidence.runId, revision: 1, createdAt: "2026-11-08T00:00:00.000Z", updatedAt: "2026-11-08T00:00:00.010Z",
    expiresAt: "2026-11-09T00:00:00.000Z", state: "completed",
    request: { suiteKey: suite.generatorVersion === "interior-v1" ? "interior-v1" : suite.generatorVersion === "challenge-v1" ? suite.request.population === "screening" ? "screening-v1" : "challenge-v1"
      : suite.formatVersion === "2" ? "smooth-v2" : "reference-v1", ...requested, concurrency: 2, acceptCharges: true },
    suite, prompts, workload, results, evidence, report: await scoreEvaluation({ suite, evidence }), failure: null,
    progress: { plannedTrials: workload.logicalCalls, startedTrials: workload.logicalCalls, activeTrials: 0, finishedTrials: workload.logicalCalls,
      modelOutcomes: workload.logicalCalls, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: workload.logicalCalls },
  }) as Mutable<RunRecord>;
}

export function replaceReply(record: Mutable<RunRecord>, caseIndex: number, trialIndex: number, reply: ModelReply): void {
  const caseId = record.suite.cases[caseIndex].id;
  const row = record.results.find((row) => row.caseId === caseId && row.trialIndex === trialIndex)!;
  row.result.evidence.outcome = extractAnswer(reply, record.request.profileId);
  row.result.evidence.errorKind = reply.status === "provider-error" ? "transport" : null;
  const trial = record.evidence.trials.find((trial) => trial.caseId === caseId && trial.trialIndex === trialIndex)!;
  trial.attempts[0] = structuredClone(row.result.evidence);
  record.report = null;
  record.progress.modelOutcomes = record.evidence.trials.filter((trial) => trial.finalAttempt !== null &&
    ["answer", "invalid", "refused", "truncated"].includes(trial.attempts[trial.finalAttempt - 1].outcome.kind)).length;
}

export function fixtureExperiment(record: RunRecord): SignalReviewEvidence["experiment"] {
  const profile = getProfile(record.request.profileId);
  if (profile.reasoning === "provider-default") throw new Error("The experiment fixture needs an explicit reasoning profile.");
  const manifest: SignalReviewEvidence["experiment"]["manifest"] = {
    version: "1", policyId: "quality-criteria-v1", criteriaSha256: "956573cb02d264d770219061ff805aa03f942a823138a87fa0266e5bf91d0f95",
    frozenAt: "2026-11-07T23:00:00.000Z", inventory: { checkedAt: "2026-11-07T22:00:00.000Z", source: "https://api.openai.com/v1/models", modelIds: [record.request.modelId] },
    frontier: { modelIds: [record.request.modelId], basis: "Controlled fixture selection, not a real model claim.", sourceUrls: ["https://openai.com/"] },
    modelEfforts: [{ provider: record.request.provider, modelId: record.request.modelId, plannedEfforts: [profile.reasoning], documentedEfforts: [profile.reasoning], sourceUrls: ["https://openai.com/"] }],
    cells: [{ id: "fixture-confirmation-cell", phase: "confirmation", provider: record.request.provider, modelId: record.request.modelId,
      servingProvider: record.request.servingProvider, profileId: profile.id, suiteId: record.suite.id, suiteSha256: sha256(record.suite), promptsSha256: sha256(record.prompts),
      settingsId: record.evidence.model.settingsId, reasoningEffort: profile.reasoning, maxOutputTokens: profile.maxOutputTokens, concurrency: record.request.concurrency }],
    budget: { maxChargedAttempts: 8192, maxConcurrency: 12, inferenceTimeoutMs: 180000, metadataTimeoutMs: 20000 },
  };
  const probe = structuredClone(record.results[0].result);
  const result: InferenceResult = { ...probe, attemptId: "fixture-permission-attempt", startedAt: "2026-11-07T22:30:00.000Z", finishedAt: "2026-11-07T22:30:00.001Z",
    prompt: buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex", witnessPairs: [] }, profile.id) };
  const manifestSha256 = sha256(manifest);
  const capabilities: SignalReviewEvidence["experiment"]["capabilities"] = { version: "1", manifestSha256, checkedAt: "2026-11-07T23:01:00.000Z",
    probes: [{ modelId: record.request.modelId, effort: profile.reasoning, result }] };
  return { manifest, capabilities, manifestSha256, capabilityEvidenceSha256: sha256(capabilities) };
}
