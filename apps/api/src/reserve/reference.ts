// Independently derived curvature numerators use exact Bernstein covers and rational witnesses.
import type { Rational } from "../math/rational";
import { add, cmp, div, evaluatePolynomial, mul, polynomialProduct, power, q, square, sub, text } from "../challenge/algebra";
import type { ExactSourceSeparation, ReserveFamily } from "./types";
import { RESERVE_FAMILIES } from "./types";

export interface RationalBounds { readonly min: Rational; readonly max: Rational }
const minimum = (a: readonly Rational[]) => a.reduce((x, y) => cmp(x, y) < 0 ? x : y);
const maximum = (a: readonly Rational[]) => a.reduce((x, y) => cmp(x, y) > 0 ? x : y);
const scale = (a: readonly Rational[], x: Rational) => a.map((v) => mul(v, x));
const plus = (a: readonly Rational[], b: readonly Rational[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? q(0), b[i] ?? q(0)));
export const derivative = (a: readonly Rational[]) => a.slice(1).map((x, i) => mul(x, q(i + 1)));

export function sourcePolynomial(group: number): Rational[] {
  if (group !== 0 && group !== 1) throw new Error("Reserve source group must be zero or one.");
  let p = [q(4)];
  for (let i = 0; i < 9; i++) p = polynomialProduct(p, [sub(q(1), div(q(i), q(4))), q(1)]);
  return group === 0 ? p : polynomialProduct(p, [q("-1/8"), q(1)]);
}

export function numeratorPolynomial(family: ReserveFamily, p: readonly Rational[]): Rational[] {
  const v = derivative(p), w = derivative(v), p2 = polynomialProduct(p, p), u = plus([q(1)], p2);
  const shared = polynomialProduct(polynomialProduct(p, u), w), v2 = polynomialProduct(v, v);
  if (family === "reserve-square-root") return plus(v2, shared);
  const first = polynomialProduct(plus([q(1)], scale(p2, family === "reserve-logarithm" ? q(-1) : q(-3))), v2);
  return scale(plus(first, shared), family === "reserve-logarithm" ? q(2) : q(-2));
}

function choose(n: number, k: number): Rational {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = result * BigInt(n - i + 1) / BigInt(i);
  return q(result.toString());
}

// Transform the fixed polynomial onto [-1,1]; all subsequent cells are exact midpoint restrictions.
function bernstein(coefficients: readonly Rational[]): Rational[] {
  if (coefficients.length < 1 || coefficients.length > 39) throw new Error("Reserve numerator degree exceeds 38.");
  const n = coefficients.length - 1;
  const shifted = coefficients.map((_, j) => mul(power(q(2), j), coefficients.slice(j).reduce((sum, value, offset) =>
    add(sum, mul(mul(value, choose(j + offset, j)), offset % 2 ? q(-1) : q(1))), q(0))));
  return coefficients.map((_, i) => shifted.slice(0, i + 1).reduce((sum, value, j) => add(sum, mul(value, div(choose(i, j), choose(n, j)))), q(0)));
}

function split(coefficients: readonly Rational[]): readonly [Rational[], Rational[]] {
  let row = [...coefficients];
  const left = [row[0]], right = [row.at(-1)!];
  while (row.length > 1) {
    row = row.slice(1).map((value, i) => div(add(row[i], value), q(2)));
    left.push(row[0]); right.push(row.at(-1)!);
  }
  return [left, right.reverse()];
}

export function numeratorBounds(coefficients: readonly Rational[], group: number): RationalBounds {
  if (group !== 0 && group !== 1) throw new Error("Reserve cover source group must be zero or one.");
  const edges = (group === 0 ? ["-1", "-3/4", "-1/2", "0", "1/2", "3/4", "1"]
    : ["-1", "-15/16", "-7/8", "-3/4", "-1/2", "0", "1/2", "1"]).map(q);
  const cells: RationalBounds[] = [];
  const visit = (a: Rational, b: Rational, values: readonly Rational[], level: number): void => {
    const index = edges.findIndex((edge) => cmp(edge, a) === 0);
    if (index >= 0 && index + 1 < edges.length && cmp(edges[index + 1], b) === 0) {
      cells.push({ min: minimum(values), max: maximum(values) }); return;
    }
    if (level >= 5) throw new Error("Fixed reserve Bernstein cover is incomplete.");
    const midpoint = div(add(a, b), q(2)), [left, right] = split(values);
    visit(a, midpoint, left, level + 1); visit(midpoint, b, right, level + 1);
  };
  visit(q(-1), q(1), bernstein(coefficients), 0);
  if (cells.length !== edges.length - 1) throw new Error("Reserve Bernstein cover membership changed.");
  return { min: minimum(cells.map((x) => x.min)), max: maximum(cells.map((x) => x.max)) };
}

export function baseCurvatureBounds(family: ReserveFamily, p: readonly Rational[], group: number): RationalBounds {
  const bound = numeratorBounds(numeratorPolynomial(family, p), group);
  const coarse = family === "reserve-logarithm" ? group === 0 ? ["-31/8", "97/8"] : ["-63/16", "491/32"]
    : family === "reserve-reciprocal" ? group === 0 ? ["-97/8", "31/8"] : ["-491/32", "63/16"]
      : group === 0 ? ["-31/16", "97/16"] : ["-63/32", "491/64"];
  if (cmp(bound.min, q(coarse[0])) < 0 || cmp(bound.max, q(coarse[1])) > 0 || cmp(bound.min, q(0)) >= 0 || cmp(bound.max, q(0)) <= 0) throw new Error("Independent reserve numerator bound failed.");
  // Every denominator is at least one, so this interval straddling zero also bounds the quotient.
  return { min: q(coarse[0]), max: q(coarse[1]) };
}

export function curvatureBoundsAt(family: ReserveFamily, p: readonly Rational[], a: Rational, x: Rational): RationalBounds {
  const u = add(q(1), square(evaluatePolynomial(p, x))), n = evaluatePolynomial(numeratorPolynomial(family, p), x), shift = mul(q(2), a);
  if (family !== "reserve-square-root") {
    const value = add(div(n, power(u, family === "reserve-logarithm" ? 2 : 3)), shift);
    return { min: value, max: value };
  }
  // 1<=sqrt(u)<=u gives rational lower/upper bounds with the negative-division direction preserved.
  const values = [add(div(n, u), shift), add(div(n, square(u)), shift)];
  return { min: minimum(values), max: maximum(values) };
}

export function exactSourceSeparation(): ExactSourceSeparation {
  const x = q("-15/16"), left = square(evaluatePolynomial(sourcePolynomial(0), x)), right = square(evaluatePolynomial(sourcePolynomial(1), x));
  if (cmp(left, q(0)) <= 0 || cmp(right, mul(q("289/256"), left)) !== 0 || cmp(left, right) >= 0) throw new Error("Exact reserve source separation failed.");
  return { policy: "strict-monotone-outer-v1", x: "-15/16", sourceSquares: [text(left), text(right)], ratio: "289/256",
    familyDirections: RESERVE_FAMILIES.map((family) => ({ family, direction: family === "reserve-reciprocal" ? "decreasing" : "increasing" })) };
}
