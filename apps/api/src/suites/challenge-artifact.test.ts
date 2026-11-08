// The new generator must enter the existing scorer through full replay and unchanged denominators.
import { expect, it } from "bun:test";
import { extractAnswer } from "../protocol";
import { scoreEvaluation, type RunEvidence } from "../scoring";
import { validateSuiteArtifact } from "./artifact";
import artifact from "../../data/suites/challenge-v1.json";

it("replays all held-out challenge cases and scores every planned controlled trial", async () => {
  const suite = await validateSuiteArtifact(artifact);
  const evidence: RunEvidence = {
    runId: "challenge-controlled-integration", suiteId: suite.id, protocolVersion: "1", profileId: suite.request.profileId,
    model: { provider: "fixture", modelId: "fixture-model", endpointId: "fixture", settingsId: "fixture" },
    run: { elapsedMs: null, concurrency: null }, expressionTokens: [],
    trials: suite.cases.flatMap(entry => [0, 1, 2].map(trialIndex => ({
      caseId: entry.id, trialIndex, finalAttempt: 1, elapsedMs: null,
      attempts: [{ sequence: 1, outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: entry.label, explanation: "Controlled integration fixture." }) }, suite.request.profileId), errorKind: null, elapsedMs: null, usage: { input: null, output: null, reasoning: null }, cost: null }],
    }))),
  };
  const report = await scoreEvaluation({ suite, evidence });
  expect(suite.cases).toHaveLength(72);
  expect(report.overall.classification).toMatchObject({ macroF1: 1, population: { plannedTrials: 216, includedTrials: 216, status: "complete" } });
  expect(report.byDepth.map(slice => slice.depth)).toEqual([3, 4, 5, 6, 14]);
  expect(report.identity.generatorVersion).toBe("challenge-v1");
  await expect(scoreEvaluation({ suite, evidence: { ...evidence, profileId: "one-shot-schema-v1" } })).rejects.toThrow();
}, 30000);

it("rejects a changed challenge generator, analytic claim or accessor identity", async () => {
  await expect(validateSuiteArtifact({ ...artifact, generatorVersion: "smooth-v1" })).rejects.toThrow();
  const altered = structuredClone(artifact);
  altered.cases[0].analyticCertificate.label = "neither";
  await expect(validateSuiteArtifact(altered)).rejects.toThrow();
  const accessor = { ...artifact };
  let reads = 0;
  Object.defineProperty(accessor, "generatorVersion", { get() { reads++; return "challenge-v1"; } });
  await expect(validateSuiteArtifact(accessor)).rejects.toThrow("must be data");
  expect(reads).toBe(0);
}, 30000);
