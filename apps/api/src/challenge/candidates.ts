// Fixed family-balanced populations vary intrinsic parameters and domains without affine presentation padding.
import { createHash } from "node:crypto";
import type { Label } from "../math";
import type { Rational } from "../math/rational";
import type { SmoothExpression } from "../numerics/types";
import { add, assertAnalyticSigns, binary, cmp, constant, div, evaluatePolynomial, expBounds, horner,
  mul, neg, polynomialFromExpression, polynomialProduct, power, q, samePolynomial, secondDerivative,
  square, sub, text, unary, variable } from "./algebra";
import { CHALLENGE_FAMILIES, type AnalyticCertificate, type ChallengeCandidate, type ChallengeFamily, type ChallengePopulation } from "./types";

const labels: readonly Label[] = ["convex", "concave", "neither"];
const range = (minimum: Rational, maximum: Rational) => ({ min: text(minimum), max: text(maximum) });
const witness = (x: Rational, minimum: Rational, maximum = minimum) => ({ x: text(x), ...range(minimum, maximum) });
const sum = (a: SmoothExpression, b: SmoothExpression) => binary("add", a, b);
const product = (a: SmoothExpression, b: SmoothExpression) => binary("multiply", a, b);
const quotient = (a: SmoothExpression, b: SmoothExpression) => binary("divide", a, b);
const quadratic = (a: Rational) => product(constant(a), unary("square", variable()));

function logarithm(label: Label, c: Rational) {
  const domain = label === "convex" ? { min: "-1/2", max: "1/2" }
    : label === "concave" ? { min: "2", max: "3" } : { min: "0", max: "3" };
  const expression = unary("log", sum(constant(c), unary("square", variable())));
  const derivative = (x: Rational) => div(mul(q(2), sub(c, square(x))), square(add(c, square(x))));
  const global = label === "convex" ? range(div(mul(q(2), sub(c, q("1/4"))), square(add(c, q("1/4")))), div(q(2), c))
    : label === "concave" ? range(div(mul(q(2), sub(c, q(9))), square(add(c, q(4)))), div(mul(q(2), sub(c, q(4))), square(add(c, q(9))))) : null;
  return { expression, domain, parameters: { c: text(c) }, global,
    witnesses: label === "neither" ? [witness(q("1/4"), derivative(q("1/4"))), witness(q("5/2"), derivative(q("5/2")))] : [] };
}

function reciprocal(label: Label, c: Rational) {
  const domain = label === "convex" ? { min: "1", max: "2" }
    : label === "concave" ? { min: "-2", max: "-1" } : { min: "-1", max: "1" };
  const expression = quotient(constant(q(1)), sum(constant(c), unary("exp", variable())));
  const enclosure = (minimum: Rational, maximum: Rational) => {
    const lo = expBounds(minimum).min, hi = expBounds(maximum).max;
    const a = sub(lo, c), b = sub(hi, c);
    if (cmp(a, q(0)) > 0) return range(div(mul(lo, a), power(add(c, hi), 3)), div(mul(hi, b), power(add(c, lo), 3)));
    if (cmp(b, q(0)) < 0) return range(div(mul(hi, a), power(add(c, lo), 3)), div(mul(lo, b), power(add(c, hi), 3)));
    throw new Error("Reciprocal reference interval crosses its curvature threshold.");
  };
  return { expression, domain, parameters: { c: text(c) },
    global: label === "neither" ? null : enclosure(q(domain.min), q(domain.max)),
    witnesses: label === "neither" ? [
      { x: "-3/4", ...enclosure(q("-3/4"), q("-3/4")) },
      { x: "3/4", ...enclosure(q("3/4"), q("3/4")) },
    ] : [] };
}

function exponentialQuadratic(label: Label, a: Rational) {
  const domain = label === "convex" ? { min: "1", max: "2" }
    : label === "concave" ? { min: "-2", max: "-1" } : { min: "-1", max: "1" };
  const expression = sum(unary("exp", variable()), quadratic(neg(a)));
  const enclosure = (minimum: Rational, maximum: Rational) => range(
    sub(expBounds(minimum).min, mul(q(2), a)), sub(expBounds(maximum).max, mul(q(2), a)));
  return { expression, domain, parameters: { a: text(a) },
    global: label === "neither" ? null : enclosure(q(domain.min), q(domain.max)),
    witnesses: label === "neither" ? [
      { x: "-3/4", ...enclosure(q("-3/4"), q("-3/4")) },
      { x: "3/4", ...enclosure(q("3/4"), q("3/4")) },
    ] : [] };
}

function rationalBend(label: Label, c: Rational) {
  const domain = label === "convex" ? { min: "-1/4", max: "1/4" }
    : label === "concave" ? { min: "1", max: "2" } : { min: "0", max: "1" };
  const expression = quotient(unary("square", variable()), sum(constant(c), unary("square", variable())));
  const derivative = (x: Rational) => div(mul(mul(q(2), c), sub(c, mul(q(3), square(x)))), power(add(c, square(x)), 3));
  const global = label === "convex" ? range(div(mul(mul(q(2), c), sub(c, q("3/16"))), power(add(c, q("1/16")), 3)), div(q(2), c))
    : label === "concave" ? range(div(mul(mul(q(2), c), sub(c, q(12))), power(add(c, q(1)), 3)), div(mul(mul(q(2), c), sub(c, q(3))), power(add(c, q(4)), 3))) : null;
  return { expression, domain, parameters: { c: text(c) }, global,
    witnesses: label === "neither" ? [witness(q("1/8"), derivative(q("1/8"))), witness(q("7/8"), derivative(q("7/8")))] : [] };
}

function softplus(label: Label, k: Rational) {
  const k2 = square(k);
  const a = mul(k2, label === "convex" ? q("1/16") : label === "concave" ? q("5/32") : q("7/64"));
  const expression = sum(unary("log", sum(constant(q(1)), unary("exp", product(constant(k), variable())))), quadratic(neg(a)));
  const endpoint = expBounds(k);
  const lower = div(endpoint.min, square(add(q(1), endpoint.max)));
  const global = label === "neither" ? null : range(sub(mul(k2, lower), mul(q(2), a)), sub(div(k2, q(4)), mul(q(2), a)));
  const point = expBounds(mul(k, q("3/4")));
  return { expression, domain: { min: "-1", max: "1" }, parameters: { k: text(k), a: text(a) }, global,
    witnesses: label === "neither" ? [witness(q(0), sub(div(k2, q(4)), mul(q(2), a))),
      witness(q("3/4"), sub(div(mul(k2, point.min), square(add(q(1), point.max))), mul(q(2), a)),
        sub(div(mul(k2, point.max), square(add(q(1), point.min))), mul(q(2), a)))] : [] };
}

function exponentialBowl(label: Label, b: Rational) {
  const a = label === "convex" ? div(b, q(2)) : label === "concave" ? mul(mul(q(2), b), add(q(1), mul(q(2), b))) : mul(b, add(q(1), b));
  const expression = sum(unary("exp", product(constant(b), unary("square", variable()))), quadratic(neg(a)));
  const global = label === "neither" ? null : range(sub(mul(q(2), b), mul(q(2), a)),
    sub(div(mul(mul(q(2), b), add(q(1), mul(q(2), b))), sub(q(1), b)), mul(q(2), a)));
  const point = mul(b, q("9/16")), bounds = expBounds(point), factor = mul(mul(q(2), b), add(q(1), mul(q(2), point)));
  return { expression, domain: { min: "-1", max: "1" }, parameters: { b: text(b), a: text(a) }, global,
    witnesses: label === "neither" ? [witness(q(0), sub(mul(q(2), b), mul(q(2), a))),
      witness(q("3/4"), sub(mul(factor, bounds.min), mul(q(2), a)), sub(mul(factor, bounds.max), mul(q(2), a)))] : [] };
}

function mixed(label: Label, k: Rational) {
  const k2 = square(k);
  const a = label === "convex" ? q("1/8") : add(div(k2, q(8)), label === "concave" ? q("5/8") : q("1/4"));
  const core = sum(unary("log", sum(constant(q(1)), unary("exp", product(constant(k), variable())))),
    unary("sqrt", sum(constant(q(1)), unary("square", variable()))));
  const expression = sum(core, quadratic(neg(a)));
  const global = label === "neither" ? null : range(sub(q("1/3"), mul(q(2), a)), sub(add(div(k2, q(4)), q(1)), mul(q(2), a)));
  return { expression, domain: { min: "-1", max: "1" }, parameters: { k: text(k), a: text(a) }, global,
    witnesses: label === "neither" ? [witness(q(0), sub(add(div(k2, q(4)), q(1)), mul(q(2), a))),
      witness(q("3/4"), neg(mul(q(2), a)), sub(add(mul(k2, q("4/25")), q("64/125")), mul(q(2), a)))] : [] };
}

function integrated(label: Label, clusterIndex: number) {
  const roots = [["-3/4", "-1/4", "1/4", "3/4"], ["-2/3", "-1/3", "1/3", "2/3"],
    ["-4/5", "-1/5", "1/5", "4/5"], ["-3/5", "-2/5", "2/5", "3/5"]][clusterIndex].map(q);
  let source = [q(1)];
  for (const root of roots) source = polynomialProduct(source, [neg(root), q(1)]);
  const absoluteSum = source.reduce((total, coefficient) => add(total, coefficient.numerator < 0n ? neg(coefficient) : coefficient), q(0));
  const epsilon = label === "convex" ? q("-1/64") : label === "concave" ? add(square(absoluteSum), q("1/16")) : q("1/4096");
  const second = polynomialProduct(source, source);
  second[0] = sub(second[0], epsilon);
  const coefficients = [q(0), q(0), ...second.map((coefficient, i) => div(coefficient, q((i + 1) * (i + 2))))];
  const expression = horner(coefficients);
  if (!samePolynomial(polynomialFromExpression(expression), coefficients) || !samePolynomial(secondDerivative(coefficients), second)) {
    throw new Error("Integrated curvature polynomial identity failed.");
  }
  if (roots.some((root) => evaluatePolynomial(source, root).numerator !== 0n)) throw new Error("Curvature polynomial root identity failed.");
  const global = label === "neither" ? null : range(neg(epsilon), sub(square(absoluteSum), epsilon));
  return { expression, domain: { min: "-1", max: "1" }, parameters: { roots: roots.map(text).join(","), epsilon: text(epsilon) }, global,
    witnesses: label === "neither" ? [witness(roots[0], neg(epsilon)), witness(q(0), sub(square(evaluatePolynomial(source, q(0))), epsilon))] : [],
    polynomial: { source: source.map(text), second: second.map(text), integrated: coefficients.map(text) } };
}

export function createChallengeCandidate(family: ChallengeFamily, label: Label, clusterIndex: number): ChallengeCandidate {
  if (!CHALLENGE_FAMILIES.includes(family) || !labels.includes(label) || !Number.isInteger(clusterIndex) || clusterIndex < 0 || clusterIndex > 3) {
    throw new Error("Unsupported challenge candidate coordinates.");
  }
  const c = add(q(1), div(q(clusterIndex), q(4)));
  const built = family === "local-logarithm" ? logarithm(label, c)
    : family === "reciprocal-exponential" ? reciprocal(label, c)
      : family === "exponential-quadratic" ? exponentialQuadratic(label, add(q("1/2"), div(q(clusterIndex), q(16))))
        : family === "rational-bend" ? rationalBend(label, c)
          : family === "softplus-quadratic" ? softplus(label, add(q(1), div(q(clusterIndex), q(8))))
            : family === "exponential-bowl" ? exponentialBowl(label, add(q("1/4"), div(q(clusterIndex), q(32))))
              : family === "mixed-branches" ? mixed(label, add(q(2), div(q(clusterIndex), q(8)))) : integrated(label, clusterIndex);
  const analyticCertificate: AnalyticCertificate = {
    policy: "analytic-curvature-v1", family, parameters: built.parameters, label,
    globalSecond: built.global, witnesses: built.witnesses, polynomial: "polynomial" in built ? built.polynomial : null,
  };
  assertAnalyticSigns(analyticCertificate);
  const clusterId = `cluster-challenge-v1-${createHash("sha256").update(JSON.stringify({ family, clusterIndex })).digest("hex")}`;
  return { reference: { expression: built.expression, domain: built.domain, claimedLabel: label }, family, clusterId, clusterIndex, analyticCertificate };
}

export function createChallengeCandidates(population: ChallengePopulation): readonly ChallengeCandidate[] {
  if (population !== "confirmation" && population !== "screening") throw new Error("Unsupported challenge population.");
  const families: readonly ChallengeFamily[] = population === "confirmation" ? CHALLENGE_FAMILIES
    : ["reciprocal-exponential", "softplus-quadratic", "integrated-curvature"];
  const clusters = population === "confirmation" ? [0, 1, 2] : [3];
  return families.flatMap((family) => clusters.flatMap((cluster) => labels.map((label) => createChallengeCandidate(family, label, cluster))));
}
