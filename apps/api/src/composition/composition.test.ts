import { describe, expect, it } from "bun:test";
import { cmp, measure, q, sub, text } from "../challenge/algebra";
import { buildNumericalPrompt } from "../numerics/prompt";
import type { SmoothExpression } from "../numerics/types";
import { createCompositionCandidates, evaluateChain } from "./candidates";
import { generateCompositionSuite, getCompositionRequest, validateCompositionSuite } from "./suite";

function value(expression: SmoothExpression, x: number): number {
  if (expression.op === "variable") return x;
  if (expression.op === "constant") { const [n, d = "1"] = expression.value.split("/"); return Number(n) / Number(d); }
  if ("arg" in expression) { const arg = value(expression.arg, x); if (expression.op === "square") return arg * arg; if (expression.op === "negate") return -arg; throw new Error("Unexpected atom."); }
  const left = value(expression.left, x), right = value(expression.right, x);
  return expression.op === "add" ? left + right : expression.op === "multiply" ? left * right : left / right;
}

describe("fixed nested composition references", () => {
  it("agrees with an independently expanded two-quadratic derivative", () => {
    // Q(Q(x))=(x+2)^4/4096+(x+2)^2/64+1/4.
    for (const [x, second] of [["-1", "35/1024"], ["0", "11/256"], ["1", "59/1024"]]) {
      expect(text(evaluateChain(["Q", "Q"], q(x)).second)).toBe(second);
    }
  });

  it("balances every family and stage across labels with identical outer structure", () => {
    const candidates = createCompositionCandidates();
    expect(candidates).toHaveLength(27);
    expect(new Set(candidates.map(row => row.id)).size).toBe(27);
    expect(new Set(candidates.map(row => row.clusterId)).size).toBe(9);
    for (const row of candidates) {
      expect(row.atoms).toHaveLength(row.stageCount);
      expect(row.atoms).toContain("Q");
      expect(measure(row.reference.expression).depth).toBe(3 * row.stageCount + 1);
      expect(row.reference.expression.op).toBe("add");
      const peers = candidates.filter(other => other.family === row.family && other.stageCount === row.stageCount);
      expect(new Set(peers.map(other => other.reference.claimedLabel)).size).toBe(3);
      const proof = row.analyticCertificate;
      if (row.reference.claimedLabel === "convex") expect(cmp(q(proof.globalSecond.min), q(0))).toBeGreaterThan(0);
      else if (row.reference.claimedLabel === "concave") expect(cmp(q(proof.globalSecond.max), q(0))).toBeLessThan(0);
      else { expect(cmp(q(proof.witnesses[0].second), q(0))).toBeLessThan(0); expect(cmp(q(proof.witnesses[1].second), q(0))).toBeGreaterThan(0); }
      for (const x of [-1, 0, 1]) {
        const h = evaluateChain(row.atoms, q(x)).value, expected = sub(h, q(`${q(proof.coefficient).numerator * BigInt(x * x)}/${q(proof.coefficient).denominator}`));
        const numeric = Number(expected.numerator) / Number(expected.denominator);
        expect(value(row.reference.expression, x)).toBeCloseTo(numeric, 13);
      }
    }
  });

  it("replays all exact references, native certificates, identity and prompt privacy", async () => {
    const retained = await Bun.file(new URL("../../data/suites/composition-v1.json", import.meta.url)).json();
    const suite = await validateCompositionSuite(retained);
    expect(suite.cases).toHaveLength(27);
    expect(suite.summary.accepted).toBe(27);
    expect(suite.summary.rejections).toEqual({});
    for (const row of suite.cases) {
      expect(row.certificate.depth).toBe(row.depth);
      const prompt = buildNumericalPrompt(row.reference, suite.request.profileId, suite.promptVersion);
      const serialized = JSON.stringify(prompt);
      expect(serialized).not.toContain("claimedLabel");
      expect(serialized).not.toContain(row.family);
      expect(serialized).not.toContain("analyticCertificate");
    }
    const modified = structuredClone(retained);
    modified.cases[0].stageCount = 100;
    await expect(validateCompositionSuite(modified)).rejects.toThrow("reproduction");
  }, 30000);

  it("rejects changed populations and preserves cancellation", async () => {
    await expect(generateCompositionSuite({ ...getCompositionRequest(), depths: [100] })).rejects.toThrow("fixed population");
    const controller = new AbortController(); controller.abort();
    expect((await generateCompositionSuite(getCompositionRequest(), controller.signal)).status).toBe("incomplete");
    let accessed = false;
    const input = { ...getCompositionRequest(), get seed() { accessed = true; return "coconut-composition-v1"; } };
    await expect(generateCompositionSuite(input)).rejects.toThrow();
    expect(accessed).toBe(false);
  });
});
