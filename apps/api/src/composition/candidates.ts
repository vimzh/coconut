// Exact atom-chain derivatives establish references independently of native AST differentiation.
import { createHash } from "node:crypto";
import { add, binary, cmp, constant, div, measure, mul, q, square, sub, text, unary, variable } from "../challenge/algebra";
import type { Rational } from "../math/rational";
import type { Label } from "../math";
import type { NumericalReference, SmoothExpression } from "../numerics/types";

export const COMPOSITION_FAMILIES = ["quadratic-chain", "quadratic-reciprocal-chain", "reciprocal-quadratic-chain"] as const;
export const COMPOSITION_STAGES = [2, 4, 6] as const;
type Atom = "Q" | "R";

export function evaluateChain(atoms: readonly Atom[], x: Rational) {
  let value = x, first = q(1), second = q(0);
  for (const atom of atoms) {
    const shift = atom === "Q" ? add(value, q(2)) : sub(q(4), value);
    if (cmp(value, q(-1)) < 0 || cmp(value, q(1)) > 0) throw new Error("Chain escaped its proved atom domain.");
    const atomFirst = atom === "Q" ? div(shift, q(8)) : div(q(1), square(shift));
    const atomSecond = atom === "Q" ? q("1/8") : div(q(2), mul(square(shift), shift));
    second = add(mul(atomSecond, square(first)), mul(atomFirst, second));
    first = mul(atomFirst, first);
    value = atom === "Q" ? div(square(shift), q(16)) : div(q(1), shift);
  }
  return { value, first, second };
}

function expressionFor(atoms: readonly Atom[]): SmoothExpression {
  let expression = variable();
  for (const atom of atoms) expression = atom === "Q"
    ? binary("divide", unary("square", binary("add", expression, constant(q(2)))), constant(q(16)))
    : binary("divide", constant(q(1)), binary("add", constant(q(4)), { op: "negate", arg: expression }));
  return expression;
}

function dyadic(value: Rational, ceil = false): Rational {
  const scale = 1n << 48n, numerator = value.numerator * scale;
  if (numerator <= 0n) throw new Error("A positive curvature threshold is required.");
  return q(`${numerator / value.denominator + (ceil ? 1n : 0n)}/${scale}`);
}

// Q and R preserve [-1,1]; positive atom derivatives imply H''' > 0 after two stages.
// Thus endpoint H'' bounds are global, while opposite interior signs prove neither.
export function createCompositionCandidates() {
  return COMPOSITION_FAMILIES.flatMap((family, familyIndex) => COMPOSITION_STAGES.flatMap(stageCount => {
    const atoms: Atom[] = Array.from({ length: stageCount }, (_, i) => familyIndex === 0 ? "Q" : (i + familyIndex) % 2 ? "Q" : "R");
    const expression = expressionFor(atoms);
    const lower = evaluateChain(atoms, q(-1)).second, upper = evaluateChain(atoms, q(1)).second;
    const left = evaluateChain(atoms, q("-3/4")).second, right = evaluateChain(atoms, q("3/4")).second;
    if (cmp(lower, q(0)) <= 0 || cmp(lower, left) >= 0 || cmp(left, right) >= 0 || cmp(right, upper) >= 0) throw new Error("Strict chain-curvature ordering failed.");
    const clusterId = `cluster-composition-v1-${familyIndex}-${stageCount}`;
    return (["convex", "concave", "neither"] as const).map((label: Label) => {
      const coefficient = label === "convex" ? dyadic(div(lower, q(4))) : label === "concave" ? dyadic(upper, true) : dyadic(div(add(left, right), q(4)));
      const twice = mul(q(2), coefficient), globalMin = sub(lower, twice), globalMax = sub(upper, twice);
      const witnessMin = sub(left, twice), witnessMax = sub(right, twice);
      if (label === "convex" ? cmp(globalMin, q(0)) <= 0 : label === "concave" ? cmp(globalMax, q(0)) >= 0 : cmp(witnessMin, q(0)) >= 0 || cmp(witnessMax, q(0)) <= 0) throw new Error("The independent curvature proof failed.");
      const reference: NumericalReference = { expression: binary("add", expression, binary("multiply", constant(mul(q(-1), coefficient)), unary("square", variable()))), domain: { min: "-1", max: "1" }, claimedLabel: label };
      return { reference, family, clusterId, stageCount, atoms, depth: measure(reference.expression).depth,
        analyticCertificate: { policy: "exact-atom-chain-v1" as const, coefficient: text(coefficient),
          globalSecond: { min: text(globalMin), max: text(globalMax) },
          witnesses: [{ x: "-3/4", second: text(witnessMin) }, { x: "3/4", second: text(witnessMax) }] },
        id: `case-composition-v1-${createHash("sha256").update(JSON.stringify(reference)).digest("hex")}` };
    });
  }));
}

export type CompositionCandidate = ReturnType<typeof createCompositionCandidates>[number];
