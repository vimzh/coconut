import { describe, expect, it } from "bun:test";
import { verifyReference, type Expression, type Label } from "../math";
import { evaluateExpression } from "../math/expression";
import { Arithmetic, type Rational } from "../math/rational";
import { createCandidate, polynomialSignature } from "./candidates";
import type { Candidate } from "./types";

const labels: readonly Label[] = ["convex", "concave", "neither"];
type Binary = Extract<Expression, { left: Expression }>;

function readBinary(expression: Expression, op: Binary["op"]): Binary {
  if (expression.op !== op || !("left" in expression)) throw new Error(`Expected ${op}.`);
  return expression;
}

function readConstant(expression: Expression, arithmetic: Arithmetic): Rational {
  if (expression.op !== "constant") throw new Error("Expected a constant.");
  return arithmetic.parse(expression.value);
}

function envelopeLines(expression: Expression): { minimum: boolean; lines: Expression[] } {
  if (expression.op !== "max" && expression.op !== "min") throw new Error("Expected an envelope.");
  const op = expression.op;
  const lines: Expression[] = [];
  let current = expression;
  while (current.op === op && "left" in current) {
    lines.unshift(current.right);
    const left = current.left;
    if (left.op !== op) {
      lines.unshift(left);
      break;
    }
    current = left;
  }
  return { minimum: op === "min", lines };
}

function unwrap(candidate: Candidate, arithmetic: Arithmetic) {
  const root = readBinary(candidate.reference.expression, "add");
  const scaled = readBinary(root.left, "multiply");
  const affine = readBinary(root.right, "add");
  const slope = readBinary(affine.left, "multiply");
  expect(slope.right.op).toBe("variable");
  const a = readConstant(scaled.left, arithmetic);
  const b = readConstant(slope.left, arithmetic);
  const c = readConstant(affine.right, arithmetic);
  expect(a.numerator).not.toBe(0n);
  expect(b.numerator).not.toBe(0n);
  expect(c.numerator).not.toBe(0n);
  expect(a.numerator * a.numerator).not.toBe(a.denominator * a.denominator);
  return { a, b, c, core: scaled.right };
}

describe("seeded expression candidates", () => {
  it("verifies every supported depth and class with exact measured node counts", () => {
    const orientations = new Set<string>();
    const scales = new Set<boolean>();
    for (let depth = 5; depth <= 80; depth++) {
      for (const label of labels) {
        for (let ordinal = 0; ordinal < 2; ordinal++) {
          const candidate = createCandidate("all-depths", label, depth, ordinal, 0);
          const result = verifyReference(candidate.reference);
          expect(result.status).toBe("verified");
          if (result.status !== "verified") throw new Error(JSON.stringify(result));
          expect(result.label).toBe(label);
          expect(result.certificate.depth).toBe(depth);
          const expectedNodes = label !== "neither" ? 6 * (depth - 3) + 7
            : depth === 5 ? 14 : 6 * (depth - 4) + 9;
          expect(result.certificate.nodeCount).toBe(expectedNodes);
          expect(result.certificate.nodeCount).toBeLessThanOrEqual(512);
          expect(candidate.reference.domain).toEqual({ min: "-1", max: "1" });
          expect(candidate.semanticKey).toMatch(/^[a-f0-9]{64}$/);
          const { a, core } = unwrap(candidate, new Arithmetic());
          scales.add(a.numerator > 0n);
          if (label !== "neither") orientations.add(core.op);
          if (label === "neither") {
            expect(result.certificate.witnesses.againstConvexity).toBeDefined();
            expect(result.certificate.witnesses.againstConcavity).toBeDefined();
          }
        }
      }
    }
    expect(orientations).toEqual(new Set(["max", "min"]));
    expect(scales).toEqual(new Set([false, true]));
  });

  it("reproduces every choice and changes independently seeded candidate coordinates", () => {
    const candidate = createCandidate("reproduction", "convex", 20, 3, 2);
    expect(createCandidate("reproduction", "convex", 20, 3, 2)).toEqual(candidate);
    for (const changed of [
      createCandidate("other-seed", "convex", 20, 3, 2),
      createCandidate("reproduction", "convex", 20, 4, 2),
      createCandidate("reproduction", "convex", 20, 3, 3),
    ]) {
      expect(changed.reference.expression).not.toEqual(candidate.reference.expression);
      expect(changed.semanticKey).not.toBe(candidate.semanticKey);
    }
  });

  it("rejects depths outside the documented family boundary", () => {
    for (const depth of [4, 81, 5.5, NaN, Infinity]) {
      expect(() => createCandidate("depth", "neither", depth, 0, 0)).toThrow(RangeError);
    }
  });

  it("keeps every envelope line uniquely active at its center", () => {
    const orientations = new Set<boolean>();
    for (let ordinal = 0; ordinal < 8; ordinal++) {
      const arithmetic = new Arithmetic();
      const candidate = createCandidate("active-lines", "convex", 20, ordinal, 0);
      const { core } = unwrap(candidate, arithmetic);
      const { minimum, lines } = envelopeLines(core);
      orientations.add(minimum);
      const centers: Rational[] = [];
      for (const line of lines) {
        const affine = readBinary(line, "add");
        const slope = readConstant(readBinary(affine.left, "multiply").left, arithmetic);
        centers.push(arithmetic.divide(slope, arithmetic.fraction(minimum ? -2n : 2n)));
      }
      for (let index = 0; index < lines.length; index++) {
        if (index > 0) expect(arithmetic.compare(centers[index - 1], centers[index])).toBe(-1);
        const value = evaluateExpression(lines[index], centers[index], arithmetic);
        for (let other = 0; other < lines.length; other++) {
          if (other === index) continue;
          const comparison = arithmetic.compare(value, evaluateExpression(lines[other], centers[index], arithmetic));
          expect(comparison).toBe(minimum ? -1 : 1);
        }
      }
    }
    expect(orientations).toEqual(new Set([false, true]));
  });

  it("binds each signature to exact polynomial values of the generated expression", () => {
    for (const depth of [5, 6, 9, 10, 80]) {
      for (const label of labels) {
        const arithmetic = new Arithmetic();
        const candidate = createCandidate("signature-values", label, depth, 0, 0);
        const { a, b, c, core } = unwrap(candidate, arithmetic);
        const zero = arithmetic.fraction(0n);
        const two = arithmetic.fraction(2n);
        let pieces: { start: Rational; quadratic: Rational; linear: Rational; constant: Rational }[];
        if (candidate.family === "shifted-absolute") {
          const absolute = readBinary(core, "multiply").right;
          if (absolute.op !== "abs") throw new Error("Expected absolute value.");
          const shift = readConstant(readBinary(absolute.arg, "add").right, arithmetic);
          expect(arithmetic.compare(shift, arithmetic.fraction(-1n, 4n))).toBe(1);
          expect(arithmetic.compare(shift, arithmetic.fraction(1n, 4n))).toBe(-1);
          const offset = arithmetic.multiply(a, shift);
          pieces = [
            { start: arithmetic.fraction(-1n), quadratic: arithmetic.negate(a), linear: arithmetic.subtract(b, offset), constant: c },
            { start: arithmetic.negate(shift), quadratic: a, linear: arithmetic.add(b, offset), constant: c },
          ];
        } else {
          const weighted = candidate.family === "weighted-envelope";
          const envelope = weighted ? readBinary(core, "multiply").right : core;
          const { minimum, lines } = envelopeLines(envelope);
          const slopes = lines.map((line) => readConstant(readBinary(readBinary(line, "add").left, "multiply").left, arithmetic));
          const intercepts = lines.map((line) => readConstant(readBinary(line, "add").right, arithmetic));
          pieces = lines.map((_, index) => ({
            start: index === 0 ? arithmetic.fraction(-1n) : arithmetic.divide(
              arithmetic.subtract(intercepts[index - 1], intercepts[index]),
              arithmetic.subtract(slopes[index], slopes[index - 1])),
            quadratic: weighted ? arithmetic.multiply(a, slopes[index]) : zero,
            linear: weighted ? arithmetic.add(b, arithmetic.multiply(a, intercepts[index])) : arithmetic.add(b, arithmetic.multiply(a, slopes[index])),
            constant: weighted ? c : arithmetic.add(c, arithmetic.multiply(a, intercepts[index])),
          }));
          if (weighted) {
            expect(minimum).toBe(false);
            for (let index = 0; index < slopes.length; index++) {
              expect(arithmetic.compare(slopes[index], arithmetic.negate(slopes[slopes.length - index - 1]))).toBe(0);
            }
          }
        }
        expect(candidate.semanticKey).toBe(polynomialSignature(pieces));
        for (let index = 0; index < pieces.length; index++) {
          const piece = pieces[index];
          const end = pieces[index + 1]?.start ?? arithmetic.fraction(1n);
          const midpoint = arithmetic.divide(arithmetic.add(piece.start, end), two);
          const expected = arithmetic.add(arithmetic.add(
            arithmetic.multiply(piece.quadratic, arithmetic.multiply(midpoint, midpoint)),
            arithmetic.multiply(piece.linear, midpoint)), piece.constant);
          const actual = evaluateExpression(candidate.reference.expression, midpoint, arithmetic);
          expect(arithmetic.compare(actual, expected)).toBe(0);
        }
      }
    }
  });
});

describe("exact generated-family equivalence signatures", () => {
  const arithmetic = new Arithmetic();
  const rational = (value: string) => arithmetic.parse(value);

  function tangentSignature(points: string[], scalar: string, minimum: boolean, slope: string, intercept: string) {
    const t = points.map(rational);
    const a = minimum ? arithmetic.negate(rational(scalar)) : rational(scalar);
    const two = rational("2");
    return polynomialSignature(t.map((point, index) => ({
      start: index === 0 ? rational("-1") : arithmetic.divide(arithmetic.add(t[index - 1], point), two),
      quadratic: rational("0"),
      linear: arithmetic.add(rational(slope), arithmetic.multiply(a, arithmetic.multiply(two, point))),
      constant: arithmetic.subtract(rational(intercept), arithmetic.multiply(a, arithmetic.multiply(point, point))),
    })));
  }

  it("identifies compensated max/min orientations", () => {
    expect(tangentSignature(["-1/2", "1/2"], "2", false, "3", "5"))
      .toBe(tangentSignature(["-1/2", "1/2"], "-2", true, "3", "5"));
  });

  it("identifies different tangent and affine parameterizations of the same function", () => {
    expect(tangentSignature(["-1/2", "1/2"], "2", false, "3", "5"))
      .toBe(tangentSignature(["-1/4", "1/4"], "4", false, "3", "19/4"));
  });

  it("normalizes rational forms and redundant equal polynomial splits", () => {
    const base = { quadratic: rational("0"), linear: rational("1/2"), constant: rational("2") };
    expect(polynomialSignature([{ start: rational("-1"), ...base }])).toBe(polynomialSignature([
      { start: rational("-1"), ...base, linear: { numerator: 2n, denominator: 4n } },
      { start: rational("0"), ...base },
    ]));
  });

  it("distinguishes changed breakpoints and coefficients", () => {
    const baseline = tangentSignature(["-1/2", "1/2"], "2", false, "3", "5");
    for (const changed of [
      tangentSignature(["-1/2", "3/4"], "2", false, "3", "5"),
      tangentSignature(["-1/2", "1/2"], "3", false, "3", "5"),
      tangentSignature(["-1/2", "1/2"], "2", false, "4", "5"),
      tangentSignature(["-1/2", "1/2"], "2", false, "3", "6"),
    ]) expect(changed).not.toBe(baseline);
  });
});
