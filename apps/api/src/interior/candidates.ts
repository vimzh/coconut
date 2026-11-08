// A quintic's interior curvature competes differently under three genuine nonlinear outer functions.
import { createHash } from "node:crypto";
import type { Label } from "../math";
import { binary, cmp, constant, horner, polynomialFromExpression, q, samePolynomial, text, unary } from "../challenge/algebra";
import { freezeData } from "../suites/generator";
import { curvatureAt, globalCurvature, sourcePolynomial } from "./reference";
import { INTERIOR_FAMILIES, type InteriorAnalyticCertificate, type InteriorCandidate, type InteriorFamily } from "./types";

const labels = ["convex", "concave", "neither"] as const;
const domains = {
  "quintic-logarithm": { convex: ["1/2", "5/8"], concave: ["1/5", "2/5"] },
  "quintic-reciprocal": { convex: ["1/5", "2/5"], concave: ["17/32", "5/8"] },
  "quintic-softplus": { convex: ["3/5", "3/4"], concave: ["1/5", "1/2"] },
} as const;
let fixedPopulation: readonly InteriorCandidate[] | undefined;

export function createInteriorCandidate(family: InteriorFamily, label: Label, clusterIndex: number): InteriorCandidate {
  if (!INTERIOR_FAMILIES.includes(family) || !labels.includes(label)) throw new Error("Unsupported interior candidate coordinates.");
  const coefficients = sourcePolynomial(clusterIndex), p = horner(coefficients);
  if (!samePolynomial(polynomialFromExpression(p), coefficients)) throw new Error("Quintic AST coefficient identity failed.");
  const one = constant(q(1));
  const expression = family === "quintic-softplus" ? unary("log", binary("add", one, unary("exp", p)))
    : family === "quintic-logarithm" ? unary("log", binary("add", one, unary("square", p)))
      : binary("divide", one, binary("add", constant(q(1)), unary("square", p)));
  const [min, max] = label === "neither" ? ["-3/5", "3/5"] : domains[family][label];
  const witnesses: { x: string; min: string; max: string }[] = [];
  if (label === "neither") {
    const coarse = family === "quintic-logarithm" ? [["7/4", "2"], ["-5", "-4"]]
      : family === "quintic-reciprocal" ? [["-2", "-1"], ["4", "5"]] : [["1/4", "1/2"], ["-5", "-4"]];
    for (const [i, x] of ["0", "1/3"].entries()) {
      const actual = curvatureAt(family, coefficients, q(x)), [lo, hi] = coarse[i];
      if (cmp(q(lo), actual.min) > 0 || cmp(actual.max, q(hi)) > 0) throw new Error("Independent witness enclosure failed.");
      witnesses.push({ x, min: lo, max: hi });
    }
    // Endpoints and midpoint agree; a strict interior sign change defeats those three samples.
    const positive = family !== "quintic-reciprocal";
    for (const x of [min, "0", max]) {
      const actual = curvatureAt(family, coefficients, q(x));
      if (positive ? cmp(actual.min, q(0)) <= 0 : cmp(actual.max, q(0)) >= 0) throw new Error("Interior sign-change control failed.");
    }
  }
  const analyticCertificate: InteriorAnalyticCertificate = {
    policy: "interior-bernstein-taylor-v1", family,
    parameters: { index: String(clusterIndex), sourceCoefficients: coefficients.map(text).join(","), polynomialCoverCells: "16", softplusCoverCells: "32", exponentialDegree: "40" },
    label, globalSecond: label === "neither" ? null : globalCurvature(family, coefficients, label, q(min), q(max)),
    witnesses, polynomial: null,
  };
  // The same source polynomial is one cluster across all families and all nine related tasks.
  const clusterId = `cluster-interior-v1-${createHash("sha256").update(JSON.stringify({ clusterIndex })).digest("hex")}`;
  return freezeData({ reference: { expression, domain: { min, max }, claimedLabel: label }, family, clusterId, clusterIndex, analyticCertificate });
}

export function createInteriorCandidates(): readonly InteriorCandidate[] {
  // Only this fixed immutable population is cached; native admission always replays.
  return fixedPopulation ??= freezeData(INTERIOR_FAMILIES.flatMap((family) => Array.from({ length: 8 }, (_, index) =>
    labels.map((label) => createInteriorCandidate(family, label, index))).flat()));
}
