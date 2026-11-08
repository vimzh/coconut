import { expect, test } from "bun:test";
import { createDepth100Population } from "./depth100";
import { buildPrompt } from "../protocol";
import { verifyReference } from "../math";

test("depth-100 references have balanced distinct tasks within unchanged verifier limits", () => {
  const population = createDepth100Population();
  expect(population.cases.length).toBe(9);
  expect(new Set(population.cases.map(row => row.id)).size).toBe(9);
  for (const label of ["convex", "concave", "neither"]) expect(population.cases.filter(row => row.label === label).length).toBe(3);
  for (const row of population.cases) {
    expect(row.certificate.depth).toBe(100);
    expect(row.certificate.nodeCount).toBeLessThanOrEqual(512);
    expect(verifyReference({ ...row.reference, claimedLabel: row.label === "neither" ? "convex" : "neither" }).status).toBe("rejected");
    const prompt = buildPrompt(row.reference, "one-shot-json-v1");
    expect(prompt.messages[1].content).toBe(`f(x) = ${row.certificate.renderedExpression}\nDomain: x in [-1, 1].`);
    expect(prompt.generation.maxOutputTokens).toBe(4096);
  }
});
