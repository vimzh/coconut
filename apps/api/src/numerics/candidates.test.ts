import { describe, expect, it } from "bun:test";
import type { Label } from "../math";
import { certifyReferences, NUMERICAL_BATCH_LIMIT } from "./backend";
import { createSmoothCandidate, SUPPORTED_SMOOTH_DEPTHS } from "./candidates";
import type { SmoothExpression } from "./types";

function structure(expression: SmoothExpression): { depth: number; nodes: number; ops: Set<string> } {
  const children = "arg" in expression ? [expression.arg] : "left" in expression ? [expression.left, expression.right] : [];
  const descendants = children.map(structure);
  return {
    depth: descendants.length === 0 ? 0 : 1 + Math.max(...descendants.map((entry) => entry.depth)),
    nodes: 1 + descendants.reduce((total, entry) => total + entry.nodes, 0),
    ops: new Set([expression.op, ...descendants.flatMap((entry) => [...entry.ops])]),
  };
}

function numericValue(expression: SmoothExpression, x: number): number {
  if (expression.op === "variable") return x;
  if (expression.op === "constant") {
    const [numerator, denominator = "1"] = expression.value.split("/");
    return Number(numerator) / Number(denominator);
  }
  if ("arg" in expression) {
    const argument = numericValue(expression.arg, x);
    if (expression.op === "negate") return -argument;
    if (expression.op === "square") return argument * argument;
    return Math[expression.op](argument);
  }
  const left = numericValue(expression.left, x);
  const right = numericValue(expression.right, x);
  return expression.op === "add" ? left + right : expression.op === "multiply" ? left * right : left / right;
}

describe("smooth candidate families", () => {
  const labels: readonly Label[] = ["convex", "concave", "neither"];

  it("has the exact requested depth and bounded structure across both orientations of every family", () => {
    const allFamilies = new Set<string>();
    const allOperations = new Set<string>();
    for (const label of labels) {
      const outerSigns = new Set<boolean>();
      for (const depth of SUPPORTED_SMOOTH_DEPTHS) {
        for (let ordinal = 0; ordinal < 32; ordinal++) {
          const candidate = createSmoothCandidate("structure", label, depth, ordinal, 0);
          const { depth: actualDepth, nodes, ops } = structure(candidate.reference.expression);
          expect(actualDepth).toBe(depth);
          expect(nodes).toBeLessThanOrEqual(256);
          expect(candidate.reference.domain).toEqual({ min: "-1", max: "1" });
          expect(candidate.reference.claimedLabel).toBe(label);
          allFamilies.add(candidate.family);
          for (const op of ops) allOperations.add(op);
          const root = candidate.reference.expression;
          if (root.op !== "add" || root.left.op !== "multiply" || root.left.left.op !== "constant") throw new Error("Expected shared presentation.");
          outerSigns.add(!root.left.left.value.startsWith("-"));
          // This is only a finite sanity check; the independent certifier decides acceptance.
          for (const x of [-1, -0.5, 0, 0.5, 1]) expect(Number.isFinite(numericValue(root, x))).toBe(true);
        }
      }
      expect(outerSigns).toEqual(new Set([false, true]));
    }
    expect(allFamilies.size).toBe(7);
    for (const op of ["exp", "log", "sqrt", "divide"]) expect(allOperations.has(op)).toBe(true);
  });

  it("reproduces choices and responds independently to each seeded coordinate", () => {
    const baseline = createSmoothCandidate("reproducible", "neither", 9, 1, 0);
    expect(createSmoothCandidate("reproducible", "neither", 9, 1, 0)).toEqual(baseline);
    for (const alternative of [
      createSmoothCandidate("another-seed", "neither", 9, 1, 0),
      createSmoothCandidate("reproducible", "neither", 9, 2, 0),
      createSmoothCandidate("reproducible", "neither", 9, 1, 1),
    ]) expect(alternative.reference.expression).not.toEqual(baseline.reference.expression);
  });

  it("independently certifies all families and depths through the native worker", async () => {
    const candidates = SUPPORTED_SMOOTH_DEPTHS.flatMap((depth) => labels.flatMap((label) =>
      Array.from({ length: 10 }, (_, ordinal) => ({ depth, label, ...createSmoothCandidate("native-coverage", label, depth, ordinal, 0) }))));
    const families = new Set<string>();
    for (let start = 0; start < candidates.length; start += NUMERICAL_BATCH_LIMIT) {
      const batch = candidates.slice(start, start + NUMERICAL_BATCH_LIMIT);
      const outcomes = await certifyReferences(batch.map((candidate) => candidate.reference));
      for (let index = 0; index < batch.length; index++) {
        const candidate = batch[index];
        const outcome = outcomes[index];
        expect(outcome.status).toBe("verified");
        if (outcome.status !== "verified") throw new Error(JSON.stringify({ candidate, outcome }));
        expect(outcome.label).toBe(candidate.label);
        expect(outcome.certificate.depth).toBe(candidate.depth);
        families.add(candidate.family);
      }
    }
    expect(candidates).toHaveLength(90);
    expect(families.size).toBe(7);
  });

  it("rejects unsupported or noninteger depths", () => {
    for (const depth of [5, 6, 8, 10, 12, NaN, Infinity, 7.5]) {
      expect(() => createSmoothCandidate("depth", "convex", depth, 0, 0)).toThrow(RangeError);
    }
  });
});
