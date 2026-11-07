// Constructs seeded, bounded expression families and exact function signatures.
import { createHash } from "node:crypto";
import type { Expression, Label } from "../math";
import { Arithmetic, format, type Rational } from "../math/rational";
import type { Candidate } from "./types";

interface PolynomialPiece {
  readonly start: Rational;
  readonly quadratic: Rational;
  readonly linear: Rational;
  readonly constant: Rational;
}

// Equal adjacent polynomials represent one piece, regardless of the input split.
export function polynomialSignature(pieces: readonly PolynomialPiece[]): string {
  const rows: string[][] = [];
  for (const piece of pieces) {
    const coefficients = [piece.quadratic, piece.linear, piece.constant].map(format);
    const previous = rows.at(-1);
    if (previous && coefficients.every((value, index) => value === previous[index + 1])) continue;
    rows.push([format(piece.start), ...coefficients]);
  }
  return createHash("sha256").update(JSON.stringify(["-1", "1", rows])).digest("hex");
}

function choices(seed: string, label: Label, depth: number, ordinal: number, attempt: number) {
  let counter = 0;
  return (limit: number): number => createHash("sha256")
    .update(JSON.stringify([seed, label, depth, ordinal, attempt, counter++]))
    .digest().readUInt32BE(0) % limit;
}

const variable = (): Expression => ({ op: "variable" });
const constant = (value: Rational): Expression => ({ op: "constant", value: format(value) });
const binary = (
  op: "add" | "multiply" | "max" | "min",
  left: Expression,
  right: Expression,
): Expression => ({ op, left, right });

function centers(count: number, symmetric: boolean, choose: (limit: number) => number, arithmetic: Arithmetic): Rational[] {
  const pool = Array.from({ length: symmetric ? 256 : 513 }, (_, index) => symmetric ? index + 1 : index - 256);
  const selectedCount = symmetric ? Math.floor(count / 2) : count;
  // A partial shuffle gives distinct grid points without an unbounded retry loop.
  for (let index = 0; index < selectedCount; index++) {
    const selected = index + choose(pool.length - index);
    [pool[index], pool[selected]] = [pool[selected], pool[index]];
  }
  const selected = pool.slice(0, selectedCount);
  if (symmetric) {
    selected.push(...selected.map((value) => -value));
    if (count % 2 !== 0) selected.push(0);
  }
  return selected.sort((left, right) => left - right).map((value) => arithmetic.fraction(BigInt(value), 256n));
}

export function createCandidate(seed: string, label: Label, depth: number, ordinal: number, attempt: number): Candidate {
  if (!Number.isInteger(depth) || depth < 5 || depth > 80) {
    throw new RangeError("Candidate depth must be an integer from 5 through 80.");
  }
  const arithmetic = new Arithmetic();
  const choose = choices(seed, label, depth, ordinal, attempt);
  const zero = arithmetic.fraction(0n);
  const two = arithmetic.fraction(2n);
  const minimum = label !== "neither" && choose(2) === 1;
  const magnitude = arithmetic.fraction(BigInt(2 + choose(15)), 17n);
  const positiveScale = label === "neither" ? choose(2) === 1 : (label === "convex") !== minimum;
  const a = positiveScale ? magnitude : arithmetic.negate(magnitude);
  const signedCoefficient = (denominator: bigint): Rational => {
    const numerator = BigInt(1 + choose(31));
    return arithmetic.fraction(choose(2) === 1 ? numerator : -numerator, denominator);
  };
  const b = signedCoefficient(19n);
  const c = signedCoefficient(23n);
  const pieces: PolynomialPiece[] = [];
  let core: Expression;
  let family: Candidate["family"];

  if (label === "neither" && depth === 5) {
    family = "shifted-absolute";
    const shift = arithmetic.fraction(BigInt(choose(31) - 15), 64n);
    core = binary("multiply", variable(), { op: "abs", arg: binary("add", variable(), constant(shift)) });
    const shiftedSlope = arithmetic.multiply(a, shift);
    pieces.push(
      { start: arithmetic.fraction(-1n), quadratic: arithmetic.negate(a), linear: arithmetic.subtract(b, shiftedSlope), constant: c },
      { start: arithmetic.negate(shift), quadratic: a, linear: arithmetic.add(b, shiftedSlope), constant: c },
    );
  } else {
    const weighted = label === "neither";
    family = weighted ? "weighted-envelope" : "tangent-envelope";
    const points = centers(depth - (weighted ? 4 : 3), weighted, choose, arithmetic);
    const effectiveScale = minimum ? arithmetic.negate(a) : a;
    const lines = points.map((point, index): Expression => {
      const twicePoint = arithmetic.multiply(two, point);
      const squaredPoint = arithmetic.multiply(point, point);
      const start = index === 0 ? arithmetic.fraction(-1n)
        : arithmetic.divide(arithmetic.add(points[index - 1], point), two);
      pieces.push(weighted
        ? {
          start,
          quadratic: arithmetic.multiply(a, twicePoint),
          linear: arithmetic.subtract(b, arithmetic.multiply(a, squaredPoint)),
          constant: c,
        }
        : {
          start,
          quadratic: zero,
          linear: arithmetic.add(b, arithmetic.multiply(effectiveScale, twicePoint)),
          constant: arithmetic.subtract(c, arithmetic.multiply(effectiveScale, squaredPoint)),
        });
      return binary("add", binary("multiply", constant(minimum ? arithmetic.negate(twicePoint) : twicePoint), variable()),
        constant(minimum ? squaredPoint : arithmetic.negate(squaredPoint)));
    });
    core = lines.reduce((left, right) => binary(minimum ? "min" : "max", left, right));
    if (weighted) core = binary("multiply", variable(), core);
  }

  // Every class shares this wrapper; its affine term cancels in midpoint gaps.
  const expression = binary("add", binary("multiply", constant(a), core),
    binary("add", binary("multiply", constant(b), variable()), constant(c)));
  return {
    reference: {
      expression,
      domain: { min: "-1", max: "1" },
      claimedLabel: label,
      witnessPairs: label === "neither" ? [{ x: "-1", y: "0" }, { x: "0", y: "1" }] : [{ x: "-1", y: "1" }],
    },
    family,
    semanticKey: polynomialSignature(pieces),
  };
}
