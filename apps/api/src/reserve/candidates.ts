// Canonical formulas reconstruct all 18 reserve members without loading research artifacts.
import { createHash } from "node:crypto";
import type { Label } from "../math";
import { add, binary, cmp, constant, evaluatePolynomial, horner, mul, polynomialFromExpression, q, samePolynomial, text, unary, variable } from "../challenge/algebra";
import { freezeData } from "../suites/generator";
import { baseCurvatureBounds, curvatureBoundsAt, sourcePolynomial } from "./reference";
import { RESERVE_FAMILIES, type ReserveCandidate, type ReserveFamily } from "./types";

const labels = ["convex", "concave", "neither"] as const;
const coefficients = { "reserve-logarithm": ["2", "-8", "1/64"], "reserve-reciprocal": ["8", "-2", "-1/64"], "reserve-square-root": ["1", "-4", "1/64"] } as const;
let population: readonly ReserveCandidate[] | undefined;

export function createReserveCandidate(family: ReserveFamily, label: Label, group: number): ReserveCandidate {
  if (!RESERVE_FAMILIES.includes(family) || !labels.includes(label)) throw new Error("Unsupported reserve candidate coordinates.");
  const p = sourcePolynomial(group), expressionP = horner(p), a = q(coefficients[family][labels.indexOf(label)]);
  if (!samePolynomial(polynomialFromExpression(expressionP), p)) throw new Error("Reserve source AST coefficient identity failed.");
  const u = binary("add", constant(q(1)), unary("square", expressionP));
  const core = family === "reserve-logarithm" ? unary("log", u) : family === "reserve-reciprocal" ? binary("divide", constant(q(1)), u) : unary("sqrt", u);
  const expression = binary("add", core, binary("multiply", constant(a), unary("square", variable())));
  let globalSecond = null;
  const witnesses: { x: string; min: string; max: string }[] = [];
  if (label !== "neither") {
    const bound = baseCurvatureBounds(family, p, group), shift = mul(q(2), a);
    globalSecond = { min: text(add(bound.min, shift)), max: text(add(bound.max, shift)) };
    if (label === "convex" ? cmp(q(globalSecond.min), q(0)) <= 0 : cmp(q(globalSecond.max), q(0)) >= 0) throw new Error("Independent reserve global sign failed.");
  } else {
    const values = family === "reserve-reciprocal" ? [["-1/16", "-1/32"], ["2", "4"]]
      : family === "reserve-logarithm" ? [["1/32", "1/16"], ["-4", "-2"]] : [["1/32", "1/16"], ["-3", "-1"]];
    for (const [i, x] of ["0", "-15/16"].entries()) {
      const actual = curvatureBoundsAt(family, p, a, q(x)), [min, max] = values[i];
      if (cmp(q(min), actual.min) > 0 || cmp(actual.max, q(max)) > 0) throw new Error("Independent reserve witness bound failed.");
      witnesses.push({ x, min, max });
    }
    for (let i = 0; i < 9; i++) {
      const x = add(q(-1), q(`${i}/4`));
      if (evaluatePolynomial(p, x).numerator !== 0n) throw new Error("Reserve grid root identity failed.");
      const actual = curvatureBoundsAt(family, p, a, x);
      if (family === "reserve-reciprocal" ? cmp(actual.max, q("-1/32")) >= 0 : cmp(actual.min, q("1/32")) <= 0) throw new Error("Reserve coarse sign-control proof failed.");
    }
  }
  const clusterId = `cluster-reserve-v1-${createHash("sha256").update(JSON.stringify({ group })).digest("hex")}`;
  return freezeData({ reference: { expression, domain: { min: "-1", max: "1" }, claimedLabel: label }, family, clusterId, clusterIndex: group,
    analyticCertificate: { policy: "reserve-bernstein-v1", family, parameters: { sourceGroup: String(group), sourceCoefficients: p.map(text).join(","), quadraticCoefficient: text(a), bernsteinCoverCells: group === 0 ? "6" : "7" }, label, globalSecond, witnesses, polynomial: null } });
}

export function createReserveCandidates(): readonly ReserveCandidate[] {
  return population ??= freezeData(RESERVE_FAMILIES.flatMap((family) => [0, 1].flatMap((group) => labels.map((label) => createReserveCandidate(family, label, group)))));
}
