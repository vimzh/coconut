// Builds seeded smooth families with substantive nonlinear growth and bounded domains.
import { createHash } from "node:crypto";
import type { Label } from "../math";
import type { NumericalReference, SmoothExpression } from "./types";

export const SUPPORTED_SMOOTH_DEPTHS = Object.freeze([7, 9, 11] as const);

const variable = (): SmoothExpression => ({ op: "variable" });
const constant = (value: string): SmoothExpression => ({ op: "constant", value });
const unary = (op: "negate" | "square" | "exp" | "log" | "sqrt", arg: SmoothExpression): SmoothExpression => ({ op, arg });
const binary = (op: "add" | "multiply" | "divide", left: SmoothExpression, right: SmoothExpression): SmoothExpression => ({ op, left, right });

function choices(seed: string, label: Label, depth: number, ordinal: number, attempt: number) {
  let counter = 0;
  return (limit: number): number => createHash("sha256")
    .update(JSON.stringify(["smooth-v1", seed, label, depth, ordinal, attempt, counter++]))
    .digest().readUInt32BE(0) % limit;
}

function affine(scale: string, shift?: string): SmoothExpression {
  const scaled = binary("multiply", constant(scale), variable());
  return shift === undefined ? scaled : binary("add", scaled, constant(shift));
}

function curvedCore(choose: (limit: number) => number, positive: boolean, family: number): SmoothExpression {
  const shift = `${choose(5) - 2}/64`;
  if (family === 0) {
    const q = affine(`${4 + choose(5)}/16`, positive ? shift : undefined);
    const rounded = unary("sqrt", binary("add", constant("1"), unary("square", q)));
    return positive ? rounded : unary("negate", rounded);
  }
  if (family === 1) {
    const q = affine(`${4 + choose(5)}/16`, shift);
    const exponential = unary("exp", q);
    const quadratic = binary("multiply", constant(positive ? "-1/8" : "1/8"), unary("square", q));
    // exp(q) - q²/8 has positive curvature for this entire small q range.
    return binary("add", positive ? exponential : unary("negate", exponential), quadratic);
  }
  if (family === 2) {
    const q = affine(`${4 + choose(4)}/32`, positive ? shift : undefined);
    const logarithm = unary("log", binary("add", constant("1"), unary("square", q)));
    return positive ? logarithm : unary("negate", logarithm);
  }
  const q = affine(`${3 + choose(4)}/16`, `${22 + choose(3)}/16`);
  // q >= 1 ensures exp(q) > 2, hence this reciprocal has positive curvature.
  return binary("divide", constant(positive ? "1" : "-1"), binary("add", constant("2"), unary("exp", q)));
}

function changingCore(choose: (limit: number) => number, positive: boolean, family: number): SmoothExpression {
  const shift = `${choose(5) - 2}/64`;
  if (family === 0) {
    const q = affine(`${16 + choose(3)}/8`, positive ? shift : undefined);
    const logarithm = unary("log", binary("add", constant("1"), unary("square", q)));
    return positive ? logarithm : unary("negate", logarithm);
  }
  const q = affine(`${6 + choose(3)}/8`, positive ? shift : undefined);
  const square = unary("square", q);
  if (family === 1) {
    const cube = binary("multiply", square, q);
    const denominator = positive
      ? binary("add", constant("1"), square)
      : binary("add", constant("-1"), unary("negate", square));
    return binary("divide", cube, denominator);
  }
  const quartic = unary("square", square);
  return binary("add", positive ? quartic : unary("negate", quartic),
    binary("multiply", constant(`${positive ? "-" : ""}${2 + choose(3)}/16`), square));
}

export function createSmoothCandidate(seed: string, label: Label, depth: number, ordinal: number, attempt: number): {
  readonly reference: NumericalReference;
  readonly family: string;
} {
  if (!(SUPPORTED_SMOOTH_DEPTHS as readonly number[]).includes(depth)) {
    throw new RangeError("Smooth candidate depth must be 7, 9, or 11.");
  }
  const choose = choices(seed, label, depth, ordinal, attempt);
  const positive = choose(2) === 1;
  const familyIndex = choose(label === "neither" ? 3 : 4);
  const family = (label === "neither"
    ? ["log-curvature-change", "rational-curvature-change", "quartic-curvature-change"]
    : ["rounded-norm", "exponential-quadratic", "local-logarithm", "reciprocal-exponential"])[familyIndex];
  let core = label === "neither" ? changingCore(choose, positive, familyIndex) : curvedCore(choose, positive, familyIndex);
  for (let current = 7; current < depth; current += 2) {
    // Each layer changes the function; its finite domain and curvature are independently certified.
    core = positive ? unary("exp", binary("divide", core, constant("16")))
      : unary("log", binary("add", constant("16"), core));
  }
  const positiveScale = label === "neither" ? choose(2) === 1 : (label === "convex") === positive;
  const scale = `${positiveScale ? "" : "-"}${2 + choose(15)}/17`;
  const slope = `${choose(2) === 1 ? "" : "-"}${1 + choose(31)}/19`;
  const offset = `${choose(1000001) - 500000}/4096`;
  const expression = binary("add", binary("multiply", constant(scale), core),
    binary("add", binary("multiply", constant(slope), variable()), constant(offset)));
  return { reference: { expression, domain: { min: "-1", max: "1" }, claimedLabel: label }, family };
}
