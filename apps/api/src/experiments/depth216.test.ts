import { expect, test } from "bun:test";
import { buildPrompt } from "../protocol";
import { parseInferenceRequest } from "../inference/policy";
import { createDepth216Population, replayDepth216Population, buildDepth216Prompt, DEPTH216_RESEARCH_POLICY } from "./depth216-reference";

test("the separate research family proves nine depth-216 tasks while retaining standard refusal", () => {
  const population = createDepth216Population();
  expect(population.cases.length).toBe(9);
  expect(new Set(population.cases.map(row => row.id)).size).toBe(9);
  for (const label of ["convex", "concave", "neither"]) expect(population.cases.filter(row => row.label === label).length).toBe(3);
  for (const row of population.cases) {
    expect(row.certificate.policy).toBe(DEPTH216_RESEARCH_POLICY);
    expect(row.certificate.depth).toBe(216);
    expect(row.certificate.nodeCount).toBeLessThanOrEqual(1200);
    expect(row.certificate.arithmeticOperations).toBeLessThan(200000);
    expect(row.standardVerifierOutcome).toMatchObject({ status: "unverified", reason: "resource-limit" });
  }
  expect(replayDepth216Population(JSON.stringify(population))).toEqual(population);
  expect(() => replayDepth216Population(JSON.stringify({ ...population, cases: population.cases.slice(1) }))).toThrow();
  const altered = JSON.parse(JSON.stringify(population)); altered.cases[0].reference.claimedLabel = "neither";
  expect(() => replayDepth216Population(JSON.stringify(altered))).toThrow();
  expect(() => replayDepth216Population(" ".repeat(2097153))).toThrow();
});

test("research prompts preserve neutral text/settings and admit only proved case identities", () => {
  const baseline = buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex", witnessPairs: [{ x: "-1", y: "1" }] }, "one-shot-json-v1");
  for (const row of createDepth216Population().cases) {
    const prompt = buildDepth216Prompt(row.id);
    expect(prompt.messages[0]).toEqual(baseline.messages[0]);
    expect(prompt.generation).toEqual(baseline.generation);
    expect(prompt.responseFormat).toEqual(baseline.responseFormat);
    expect(prompt.messages[1].content).toBe(`f(x) = ${row.certificate.renderedExpression}\nDomain: x in [-1, 1].`);
    expect(parseInferenceRequest({ selection: { provider: "openai", modelId: "gpt-4.1-mini", servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, prompt, acceptCharges: true }).prompt).toEqual(prompt);
  }
  expect(() => buildDepth216Prompt("unverified-case")).toThrow();
});
