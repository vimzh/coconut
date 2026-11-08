// Exercise the nested suite through ordinary replay, answer extraction and pooled scoring.
import { expect, it } from "bun:test";
import artifact from "../../data/suites/composition-v1.json";
import { extractAnswer } from "../protocol";
import { scoreEvaluation, type RunEvidence } from "../scoring";
import { parseRunRequest, runPopulation } from "../runs/policy";
import { validateSuiteArtifact } from "./artifact";

it("admits the nested workload and counts wrong and malformed returned answers in its full denominator", async () => {
  const suite = await validateSuiteArtifact(artifact);
  const request = parseRunRequest({ suiteKey: "composition-v1", provider: "openai", modelId: "fixture-model", servingProvider: null,
    profileId: "one-shot-json-v1", concurrency: 4, acceptCharges: true });
  expect(runPopulation(request.suiteKey, suite)).toBe("exploratory");
  expect(() => runPopulation("challenge-v1", suite)).toThrow();
  const evidence: RunEvidence = {
    runId: "composition-controlled-integration", suiteId: suite.id, protocolVersion: "1", profileId: suite.request.profileId,
    model: { provider: "fixture", modelId: "fixture-model", endpointId: "fixture", settingsId: "fixture" },
    run: { elapsedMs: null, concurrency: null }, expressionTokens: [],
    trials: suite.cases.flatMap((entry, index) => [0, 1, 2].map(trialIndex => ({
      caseId: entry.id, trialIndex, finalAttempt: 1, elapsedMs: null,
      attempts: [{ sequence: 1, outcome: extractAnswer({ status: "completed", text: index === 0 && trialIndex === 1 ? "malformed" : JSON.stringify({
        label: index === 0 && trialIndex === 0 ? entry.label === "convex" ? "concave" : "convex" : entry.label,
        explanation: "Controlled integration fixture.",
      }) }, suite.request.profileId), errorKind: null, elapsedMs: null, usage: { input: null, output: null, reasoning: null }, cost: null }],
    }))),
  };
  const report = await scoreEvaluation({ suite, evidence });
  expect(report.identity.generatorVersion).toBe("composition-v1");
  expect(report.overall.classification.population).toMatchObject({ plannedTrials: 81, includedTrials: 81, correctTrials: 79, status: "complete" });
  expect(report.overall.classification.macroF1).toBeLessThan(1);
  expect(report.byDepth.map(entry => entry.depth)).toEqual([...suite.request.depths]);
  await expect(scoreEvaluation({ suite, evidence: { ...evidence, profileId: "one-shot-schema-v1" } })).rejects.toThrow();
}, 30000);

it("rejects renamed generators and accessor identities before entering nested suite replay", async () => {
  await expect(validateSuiteArtifact({ ...artifact, generatorVersion: "smooth-v1" })).rejects.toThrow();
  let reads = 0;
  const accessor = { ...artifact };
  Object.defineProperty(accessor, "generatorVersion", { get() { reads++; return "composition-v1"; } });
  await expect(validateSuiteArtifact(accessor)).rejects.toThrow("must be data");
  expect(reads).toBe(0);
}, 30000);
