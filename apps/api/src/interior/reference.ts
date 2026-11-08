// Closed-form derivatives are bounded with exact Bernstein coefficients and a separate exponential series.
import type { Label } from "../math";
import type { Rational } from "../math/rational";
import { add, cmp, div, evaluatePolynomial, mul, neg, polynomialProduct, power, q, square, sub, text } from "../challenge/algebra";
import type { InteriorFamily } from "./types";

type Bounds = { min: Rational; max: Rational };
const minimum = (values: readonly Rational[]) => values.reduce((a, b) => cmp(a, b) < 0 ? a : b);
const maximum = (values: readonly Rational[]) => values.reduce((a, b) => cmp(a, b) > 0 ? a : b);
const scale = (a: readonly Rational[], k: Rational) => a.map((value) => mul(value, k));
const plus = (a: readonly Rational[], b: readonly Rational[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? q(0), b[i] ?? q(0)));
export const derivative = (a: readonly Rational[]) => a.slice(1).map((value, i) => mul(value, q(i + 1)));
const bounds = (values: readonly Rational[]): Bounds => ({ min: minimum(values), max: maximum(values) });
const rendered = (value: Bounds) => ({ min: text(value.min), max: text(value.max) });

function choose(n: number, k: number): Rational {
  let value = 1n;
  for (let i = 1; i <= k; i++) value = value * BigInt(n - i + 1) / BigInt(i);
  return q(value.toString());
}

// On [a,b], a polynomial lies between its degree-n Bernstein coefficients.
export function bernsteinBounds(coefficients: readonly Rational[], a: Rational, b: Rational): Bounds {
  if (coefficients.length < 1 || coefficients.length > 19 || cmp(a, b) > 0) throw new Error("Invalid fixed-degree Bernstein interval.");
  const n = coefficients.length - 1, width = sub(b, a);
  const transformed = coefficients.map((_, j) => coefficients.slice(j).reduce((sum, value, offset) => {
    const k = j + offset;
    return add(sum, mul(mul(mul(value, choose(k, j)), power(a, k - j)), power(width, j)));
  }, q(0)));
  return bounds(coefficients.map((_, i) => transformed.slice(0, i + 1).reduce((sum, value, j) =>
    add(sum, mul(value, div(choose(i, j), choose(n, j)))), q(0))));
}

function cells(a: Rational, b: Rational, count: 16 | 32): readonly (readonly [Rational, Rational])[] {
  const width = div(sub(b, a), q(count));
  return Array.from({ length: count }, (_, i) => [add(a, mul(width, q(i))), add(a, mul(width, q(i + 1)))] as const);
}

export function polynomialBounds(coefficients: readonly Rational[], a: Rational, b: Rational): Bounds {
  const intervals = cells(a, b, 16).map(([lo, hi]) => bernsteinBounds(coefficients, lo, hi));
  return { min: minimum(intervals.map((entry) => entry.min)), max: maximum(intervals.map((entry) => entry.max)) };
}

export function exponentialBounds(x: Rational): Bounds {
  if (cmp(x, q(0)) < 0) {
    const positive = exponentialBounds(neg(x));
    return { min: div(q(1), positive.max), max: div(q(1), positive.min) };
  }
  if (cmp(x, q(4)) > 0) throw new Error("Independent exponential argument exceeds four.");
  let term = q(1), sum = q(1);
  for (let n = 1; n <= 40; n++) { term = div(mul(term, x), q(n)); sum = add(sum, term); }
  const next = div(mul(term, x), q(41));
  return { min: sum, max: add(sum, div(next, sub(q(1), div(x, q(42))))) };
}

export function sourcePolynomial(index: number): Rational[] {
  if (!Number.isInteger(index) || index < 0 || index > 7) throw new Error("Unsupported interior parameter index.");
  const t = div(q(index), q(64));
  return [q("1/4"), add(q(1), div(t, q(4))), add(q("1/8"), div(t, q(2))), neg(add(q(5), t)), div(q(index + 1), q(64)), q(4)];
}

export function signPolynomial(family: Exclude<InteriorFamily, "quintic-softplus">, p: readonly Rational[]): Rational[] {
  const dp = derivative(p), ddp = derivative(dp), p2 = polynomialProduct(p, p);
  const shared = polynomialProduct(polynomialProduct(p, plus([q(1)], p2)), ddp);
  const first = polynomialProduct(plus([family === "quintic-logarithm" ? q(1) : q(-1)], scale(p2, family === "quintic-logarithm" ? q(-1) : q(3))), polynomialProduct(dp, dp));
  return scale(plus(first, scale(shared, family === "quintic-logarithm" ? q(1) : q(-1))), q(2));
}

function softplusBracket(p: readonly Rational[], a: Rational, b: Rational): Bounds {
  const dp = derivative(p), ddp = derivative(dp);
  const intervals = cells(a, b, 32).map(([lo, hi]) => {
    const value = bernsteinBounds(p, lo, hi), first = bernsteinBounds(dp, lo, hi), second = bernsteinBounds(ddp, lo, hi);
    const squared = { min: cmp(first.min, q(0)) <= 0 && cmp(first.max, q(0)) >= 0 ? q(0) : minimum([square(first.min), square(first.max)]), max: maximum([square(first.min), square(first.max)]) };
    return {
      min: add(second.min, div(squared.min, add(q(1), exponentialBounds(value.max).max))),
      max: add(second.max, div(squared.max, add(q(1), exponentialBounds(value.min).min))),
    };
  });
  return { min: minimum(intervals.map((entry) => entry.min)), max: maximum(intervals.map((entry) => entry.max)) };
}

export function curvatureAt(family: InteriorFamily, p: readonly Rational[], x: Rational): Bounds {
  const value = evaluatePolynomial(p, x);
  if (family !== "quintic-softplus") {
    const result = div(evaluatePolynomial(signPolynomial(family, p), x), power(add(q(1), square(value)), family === "quintic-logarithm" ? 2 : 3));
    return { min: result, max: result };
  }
  const first = evaluatePolynomial(derivative(p), x), second = evaluatePolynomial(derivative(derivative(p)), x), exponential = exponentialBounds(value);
  const sigmoids = [div(exponential.min, add(q(1), exponential.min)), div(exponential.max, add(q(1), exponential.max))];
  const brackets = [add(second, div(square(first), add(q(1), exponential.max))), add(second, div(square(first), add(q(1), exponential.min)))];
  return bounds(sigmoids.flatMap((sigma) => brackets.map((bracket) => mul(sigma, bracket))));
}

export function globalCurvature(family: InteriorFamily, p: readonly Rational[], label: Exclude<Label, "neither">, a: Rational, b: Rational): { min: string; max: string } {
  const value = polynomialBounds(p, a, b);
  let enclosure: Bounds, coarse: Bounds;
  if (family !== "quintic-softplus") {
    if (cmp(value.min, q(0)) <= 0 || cmp(value.max, q("1/2")) >= 0) throw new Error("Polynomial range leaves its positive half-unit reference regime.");
    const numerator = polynomialBounds(signPolynomial(family, p), a, b), denominator = power(q("5/4"), family === "quintic-logarithm" ? 2 : 3);
    enclosure = label === "convex" ? { min: div(numerator.min, denominator), max: numerator.max } : { min: numerator.min, max: div(numerator.max, denominator) };
    coarse = family === "quintic-logarithm" ? label === "convex" ? { min: q("1/25"), max: q(6) } : { min: q(-8), max: q(-2) }
      : label === "convex" ? { min: q(2), max: q(8) } : { min: q(-6), max: q("-1/2") };
  } else {
    if (cmp(value.min, q("-1/2")) <= 0 || cmp(value.max, q("1/2")) >= 0) throw new Error("Polynomial range leaves its half-unit reference regime.");
    const bracket = softplusBracket(p, a, b);
    if (label === "concave" && cmp(value.min, q(0)) <= 0) throw new Error("Concave sigmoid reference requires positive arguments.");
    enclosure = label === "convex" ? { min: div(bracket.min, q(3)), max: bracket.max } : { min: bracket.min, max: div(bracket.max, q(2)) };
    coarse = label === "convex" ? { min: q("1/6"), max: q(13) } : { min: q(-7), max: q("-3/2") };
  }
  if ((label === "convex" ? cmp(enclosure.min, q(0)) <= 0 : cmp(enclosure.max, q(0)) >= 0) ||
      cmp(coarse.min, enclosure.min) > 0 || cmp(enclosure.max, coarse.max) > 0) throw new Error("Independent global curvature proof failed.");
  return rendered(coarse);
}
