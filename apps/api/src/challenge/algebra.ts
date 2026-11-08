// Exact closed-form curvature checks provide an independent reference from interval automatic differentiation.
import { Arithmetic, format, type Rational } from "../math/rational";
import type { SmoothExpression } from "../numerics/types";
import type { AnalyticCertificate } from "./types";

export const q = (value: string | number): Rational => {
  const source = String(value);
  if (source.length > 8192 || !/^-?\d+(?:\/[1-9]\d*)?$/.test(source)) throw new Error("Expected a bounded exact rational.");
  const [numerator, denominator = "1"] = source.split("/");
  return new Arithmetic().fraction(BigInt(numerator), BigInt(denominator));
};
export const add = (a: Rational, b: Rational): Rational => new Arithmetic().add(a, b);
export const sub = (a: Rational, b: Rational): Rational => new Arithmetic().subtract(a, b);
export const mul = (a: Rational, b: Rational): Rational => new Arithmetic().multiply(a, b);
export const div = (a: Rational, b: Rational): Rational => new Arithmetic().divide(a, b);
export const cmp = (a: Rational, b: Rational): number => new Arithmetic().compare(a, b);
export const neg = (a: Rational): Rational => new Arithmetic().negate(a);
export const text = (a: Rational): string => format(a);
export const square = (a: Rational): Rational => mul(a, a);
export const power = (a: Rational, n: number): Rational => {
  let result = q(1);
  for (let i = 0; i < n; i++) result = mul(result, a);
  return result;
};

export const variable = (): SmoothExpression => ({ op: "variable" });
export const constant = (value: Rational): SmoothExpression => ({ op: "constant", value: text(value) });
export const unary = (op: "square" | "exp" | "log" | "sqrt", arg: SmoothExpression): SmoothExpression => ({ op, arg });
export const binary = (op: "add" | "multiply" | "divide", left: SmoothExpression, right: SmoothExpression): SmoothExpression => ({ op, left, right });

export function measure(expression: SmoothExpression): { depth: number; nodes: number } {
  if (expression.op === "variable" || expression.op === "constant") return { depth: 0, nodes: 1 };
  if ("arg" in expression) {
    const child = measure(expression.arg);
    return { depth: child.depth + 1, nodes: child.nodes + 1 };
  }
  const left = measure(expression.left), right = measure(expression.right);
  return { depth: 1 + Math.max(left.depth, right.depth), nodes: 1 + left.nodes + right.nodes };
}

export function polynomialProduct(left: readonly Rational[], right: readonly Rational[]): Rational[] {
  const result = Array.from({ length: left.length + right.length - 1 }, () => q(0));
  left.forEach((a, i) => right.forEach((b, j) => { result[i + j] = add(result[i + j], mul(a, b)); }));
  return result;
}

export function evaluatePolynomial(coefficients: readonly Rational[], x: Rational): Rational {
  return [...coefficients].reverse().reduce((total, coefficient) => add(mul(total, x), coefficient), q(0));
}

function trim(coefficients: Rational[]): Rational[] {
  while (coefficients.length > 1 && coefficients.at(-1)!.numerator === 0n) coefficients.pop();
  return coefficients;
}

// Zero coefficients omit an addition, rather than manufacturing operation depth.
export function horner(coefficients: readonly Rational[]): SmoothExpression {
  let expression = constant(coefficients.at(-1)!);
  for (let i = coefficients.length - 2; i >= 0; i--) {
    expression = binary("multiply", expression, variable());
    if (coefficients[i].numerator !== 0n) expression = binary("add", expression, constant(coefficients[i]));
  }
  return expression;
}

export function polynomialFromExpression(expression: SmoothExpression): Rational[] {
  if (expression.op === "variable") return [q(0), q(1)];
  if (expression.op === "constant") return [q(expression.value)];
  if (expression.op === "negate") return polynomialFromExpression(expression.arg).map(neg);
  if (expression.op === "square") {
    const child = polynomialFromExpression(expression.arg);
    return polynomialProduct(child, child);
  }
  if (expression.op !== "add" && expression.op !== "multiply") throw new Error("Analytic polynomial reference contains a nonpolynomial operation.");
  const left = polynomialFromExpression(expression.left), right = polynomialFromExpression(expression.right);
  if (expression.op === "multiply") return trim(polynomialProduct(left, right));
  return trim(Array.from({ length: Math.max(left.length, right.length) }, (_, i) => add(left[i] ?? q(0), right[i] ?? q(0))));
}

export function secondDerivative(coefficients: readonly Rational[]): Rational[] {
  return trim(coefficients.slice(2).map((coefficient, i) => mul(coefficient, q((i + 1) * (i + 2)))));
}

export function samePolynomial(left: readonly Rational[], right: readonly Rational[]): boolean {
  const a = trim([...left]), b = trim([...right]);
  return a.length === b.length && a.every((value, i) => cmp(value, b[i]) === 0);
}

// The positive Taylor tail is bounded by a geometric series; negative arguments use reciprocals.
export function expBounds(x: Rational): { min: Rational; max: Rational } {
  if (cmp(x, q(0)) < 0) {
    const positive = expBounds(neg(x));
    return { min: div(q(1), positive.max), max: div(q(1), positive.min) };
  }
  if (cmp(x, q(4)) > 0) throw new Error("Analytic exponential argument exceeds its fixed bound.");
  let term = q(1), sum = q(1);
  for (let n = 1; n <= 24; n++) {
    term = div(mul(term, x), q(n));
    sum = add(sum, term);
  }
  const next = div(mul(term, x), q(25));
  const tail = div(next, sub(q(1), div(x, q(26))));
  return { min: sum, max: add(sum, tail) };
}

export function assertAnalyticSigns(certificate: AnalyticCertificate): void {
  const global = certificate.globalSecond;
  const positive = certificate.witnesses.some((witness) => cmp(q(witness.min), q(0)) > 0);
  const negative = certificate.witnesses.some((witness) => cmp(q(witness.max), q(0)) < 0);
  if (certificate.witnesses.some((witness) => cmp(q(witness.min), q(witness.max)) > 0) ||
      (global && cmp(q(global.min), q(global.max)) > 0)) throw new Error("Analytic curvature enclosure is reversed.");
  if (certificate.label === "convex" ? !global || cmp(q(global.min), q(0)) <= 0
    : certificate.label === "concave" ? !global || cmp(q(global.max), q(0)) >= 0
      : !positive || !negative) throw new Error("Analytic reference does not establish the claimed exclusive label.");
}
