import { expect, test } from "bun:test";
import { buildPrompt } from "../protocol";
import { parseInferenceRequest } from "../inference/policy";
import { deepPairRows } from "./deep-pair";
import { createDeepPairPopulation, replayDeepPairPopulation, buildDeepPairPrompt, DEEP_PAIR_RESEARCH_POLICY } from "./deep-pair-reference";

test("six fixed references cover both depths within separate bounds and preserve standard resource limits", () => {
  const population = createDeepPairPopulation();
  expect(population.cases.length).toBe(6);
  expect(new Set(population.cases.map(row => row.id)).size).toBe(6);
  for (const depth of [256, 512]) for (const label of ["convex", "concave", "neither"]) expect(population.cases.filter(row => row.depth === depth && row.label === label).length).toBe(1);
  for (const row of population.cases) {
    expect(row.certificate.policy).toBe(DEEP_PAIR_RESEARCH_POLICY);
    expect(row.certificate.depth).toBe(row.depth);
    expect(row.certificate.nodeCount).toBeLessThanOrEqual(2600);
    expect(row.certificate.arithmeticOperations).toBeLessThan(200000);
    expect(row.standardVerifierOutcome).toMatchObject({ status: "unverified", reason: "resource-limit" });
  }
  expect(JSON.stringify(replayDeepPairPopulation(JSON.stringify(population)))).toBe(JSON.stringify(population));
  const altered = JSON.parse(JSON.stringify(population)); altered.cases[0].reference.claimedLabel = "neither";
  expect(() => replayDeepPairPopulation(JSON.stringify(altered))).toThrow();
  expect(() => replayDeepPairPopulation(" ".repeat(2097153))).toThrow();
});

test("the user-selected matrix has 36 distinct trials and nine outcomes per depth/model cell", () => {
  const rows = deepPairRows(createDeepPairPopulation());
  expect(rows.length).toBe(36);
  expect(new Set(rows.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size).toBe(36);
  for (const depth of [256, 512]) for (const modelId of ["gpt-4.1-mini", "gpt-4o-mini"]) expect(rows.filter(row => row.depth === depth && row.modelId === modelId).length).toBe(9);
});

test("only proved identities enter prompts, with unchanged neutral instructions and settings", () => {
  const baseline = buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex", witnessPairs: [{ x: "-1", y: "1" }] }, "one-shot-json-v1");
  for (const row of createDeepPairPopulation().cases) {
    const prompt = buildDeepPairPrompt(row.id);
    expect(prompt.messages[0]).toEqual(baseline.messages[0]);
    expect(prompt.generation).toEqual(baseline.generation);
    expect(prompt.responseFormat).toEqual(baseline.responseFormat);
    expect(prompt.messages[1].content).toBe(`f(x) = ${row.certificate.renderedExpression}\nDomain: x in [-1, 1].`);
    expect(parseInferenceRequest({ selection: { provider: "openai", modelId: "gpt-4.1-mini", servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, prompt, acceptCharges: true }).prompt).toEqual(prompt);
  }
  expect(() => buildDeepPairPrompt("unverified-case")).toThrow();
});
