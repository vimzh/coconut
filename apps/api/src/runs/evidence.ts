// Initialize the complete planned population before any paid inference is dispatched.
import { createHash } from "node:crypto";
import { buildNumericalPrompts } from "../numerics";
import { buildPrompt, calculateWorkload, type PromptBlueprint } from "../protocol";
import type { RunRecord, RunRequest, RunSuite } from "./types";
import { RUN_RETENTION_MS } from "./policy";

export function deriveRunSettingsId(request: Pick<RunRequest, "profileId" | "concurrency">, generation: PromptBlueprint["generation"]): string {
  return `settings-v1-${createHash("sha256").update(JSON.stringify({ profileId: request.profileId, generation, concurrency: request.concurrency, policyId: "individual-inference-v1", retries: 0, inferenceTimeoutMs: 180000 })).digest("hex")}`;
}

export async function prepareRunRecord(request: RunRequest, suite: RunSuite): Promise<RunRecord> {
  const prompts: readonly PromptBlueprint[] = suite.formatVersion === "2"
    ? await buildNumericalPrompts(suite.cases.map(entry => entry.reference), request.profileId, suite.promptVersion)
    : suite.cases.map(entry => buildPrompt(entry.reference, request.profileId));
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const workload = calculateWorkload(request.profileId, suite.cases.length);
  const settingsId = deriveRunSettingsId(request, prompts[0].generation);
  return {
    version: "1", id, revision: 0, createdAt, updatedAt: createdAt, expiresAt: new Date(Date.parse(createdAt) + RUN_RETENTION_MS).toISOString(), state: "running",
    request, suite, prompts, workload,
    progress: { plannedTrials: workload.logicalCalls, startedTrials: 0, activeTrials: 0, finishedTrials: 0, modelOutcomes: 0, infrastructureFailures: 0, remainingTrials: workload.logicalCalls, inferenceRequests: 0 },
    results: [], report: null, failure: null,
    evidence: {
      runId: id, suiteId: suite.id, protocolVersion: "1", profileId: request.profileId,
      model: { provider: request.provider, modelId: request.modelId, endpointId: `${request.provider}/${request.servingProvider ?? "direct"}`, settingsId },
      run: { elapsedMs: null, concurrency: request.concurrency }, expressionTokens: [],
      trials: suite.cases.flatMap(entry => Array.from({ length: workload.trialsPerInstance }, (_, trialIndex) => ({ caseId: entry.id, trialIndex, finalAttempt: null, elapsedMs: null, attempts: [] }))),
    },
  };
}
