import { describe, expect, it } from "bun:test";
import { analyzeExpression } from "./curvature";
import {
  evaluateExpression,
  parseReference,
  ReferenceInputError,
  renderExpression,
} from "./expression";
import { Arithmetic, format } from "./rational";
import type { Expression } from "./types";

const x: Expression = { op: "variable" };
const square: Expression = { op: "square", arg: x };
const negativeSquare: Expression = { op: "negate", arg: square };
const constant = (value: string): Expression => ({ op: "constant", value });

describe("expression input and representation", () => {
  it("canonicalizes decimal constants without rounding displayed coefficients", () => {
    const arithmetic = new Arithmetic();
    const parsed = parseReference({
      expression: { op: "add", left: square, right: constant("0.10") },
      domain: { min: "-1.00", max: "2/2" },
      claimedLabel: "convex",
    }, arithmetic);
    expect(parsed.canonical.domain).toEqual({ min: "-1", max: "1" });
    expect(renderExpression(parsed.canonical.expression)).toBe("((x^2)+(1/10))");
    expect(format(evaluateExpression(parsed.canonical.expression, arithmetic.parse("0.1"), arithmetic))).toBe("11/100");
    expect(parsed.canonical.witnessPairs).toEqual([]);
  });

  it("rejects extra fields and accessor values without invoking getters", () => {
    let accessed = false;
    const expression = Object.defineProperty({}, "op", {
      enumerable: true,
      get() { accessed = true; return "variable"; },
    });
    const input = { expression, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
    expect(() => parseReference(input, new Arithmetic())).toThrow(ReferenceInputError);
    expect(accessed).toBe(false);
    expect(() => parseReference({ ...input, expression: { ...x, convex: true } }, new Arithmetic())).toThrow(ReferenceInputError);
    expect(() => parseReference({ ...input, expression: x, referenceAnswer: "convex" }, new Arithmetic())).toThrow(ReferenceInputError);
  });

  it("rejects sparse or accessor witness arrays and hidden array fields", () => {
    const base = { expression: square, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
    const sparse = new Array(1);
    expect(() => parseReference({ ...base, witnessPairs: sparse }, new Arithmetic())).toThrow(ReferenceInputError);
    let accessed = false;
    const pairs = Object.defineProperty([], "0", {
      get() { accessed = true; return { x: "-1", y: "1" }; },
    });
    expect(() => parseReference({ ...base, witnessPairs: pairs }, new Arithmetic())).toThrow(ReferenceInputError);
    expect(accessed).toBe(false);
    const extra = Object.assign([], { note: "hidden metadata" });
    expect(() => parseReference({ ...base, witnessPairs: extra }, new Arithmetic())).toThrow(ReferenceInputError);
    const numericExtra = Object.assign([], { "4294967295": "hidden metadata" });
    expect(() => parseReference({ ...base, witnessPairs: numericExtra }, new Arithmetic())).toThrow(ReferenceInputError);
  });

  it("measures operation depth and repeated expression occurrences", () => {
    const arithmetic = new Arithmetic();
    const parsed = parseReference({
      expression: { op: "add", left: square, right: square },
      domain: { min: "-1", max: "1" },
      claimedLabel: "convex",
    }, arithmetic);
    const analysis = analyzeExpression(parsed.canonical.expression, parsed.domain, arithmetic);
    expect(analysis.depth).toBe(2);
    expect(analysis.nodeCount).toBe(5);
    expect(analysis.trace.map((entry) => entry.node)).toEqual([0, 1, 2, 3, 4]);
    expect(analysis.trace.at(-1)?.op).toBe("add");
  });
});

describe("sufficient curvature and range evidence", () => {
  it("proves sign-dependent compositions and constant products", () => {
    const cases: { expression: Expression; convex: boolean; concave: boolean; min: string; max: string }[] = [
      { expression: square, convex: true, concave: false, min: "0", max: "1" },
      { expression: negativeSquare, convex: false, concave: true, min: "-1", max: "0" },
      { expression: { op: "square", arg: negativeSquare }, convex: true, concave: false, min: "0", max: "1" },
      { expression: { op: "abs", arg: negativeSquare }, convex: true, concave: false, min: "0", max: "1" },
      { expression: { op: "multiply", left: constant("-2"), right: square }, convex: false, concave: true, min: "-2", max: "0" },
      { expression: { op: "max", left: square, right: negativeSquare }, convex: false, concave: false, min: "0", max: "1" },
      { expression: { op: "max", left: x, right: { op: "negate", arg: x } }, convex: true, concave: false, min: "-1", max: "1" },
      { expression: { op: "min", left: x, right: { op: "negate", arg: x } }, convex: false, concave: true, min: "-1", max: "1" },
      { expression: { op: "multiply", left: constant("0"), right: { op: "multiply", left: x, right: square } }, convex: true, concave: true, min: "0", max: "0" },
    ];
    for (const item of cases) {
      const arithmetic = new Arithmetic();
      const parsed = parseReference({ expression: item.expression, domain: { min: "-1", max: "1" }, claimedLabel: "convex" }, arithmetic);
      const analysis = analyzeExpression(parsed.canonical.expression, parsed.domain, arithmetic);
      expect([analysis.convex, analysis.concave, format(analysis.range.min), format(analysis.range.max)])
        .toEqual([item.convex, item.concave, item.min, item.max]);
    }
  });

  it("keeps general products and hidden cancellations mathematically unproved", () => {
    for (const expression of [
      { op: "multiply", left: x, right: x },
      { op: "add", left: square, right: negativeSquare },
    ] satisfies Expression[]) {
      const arithmetic = new Arithmetic();
      const analysis = analyzeExpression(expression, { min: arithmetic.parse("-1"), max: arithmetic.parse("1") }, arithmetic);
      expect(analysis.convex).toBe(false);
      expect(analysis.concave).toBe(false);
    }
  });

  it("encloses exact evaluations on positive, negative, and mixed domains", () => {
    const cases: Expression[] = [
      x, constant("-1/3"), square, negativeSquare,
      { op: "abs", arg: x },
      { op: "multiply", left: x, right: square },
      { op: "add", left: square, right: negativeSquare },
      { op: "max", left: x, right: negativeSquare },
      { op: "min", left: x, right: square },
    ];
    for (const [min, max] of [["-2", "-1"], ["-1", "2"], ["1", "3"]]) {
      for (const expression of cases) {
        const arithmetic = new Arithmetic();
        const domain = { min: arithmetic.parse(min), max: arithmetic.parse(max) };
        const analysis = analyzeExpression(expression, domain, arithmetic);
        for (let i = 0; i <= 8; i++) {
          const point = arithmetic.add(domain.min, arithmetic.multiply(arithmetic.subtract(domain.max, domain.min), arithmetic.fraction(BigInt(i), 8n)));
          const value = evaluateExpression(expression, point, arithmetic);
          expect(arithmetic.compare(value, analysis.range.min)).toBeGreaterThanOrEqual(0);
          expect(arithmetic.compare(value, analysis.range.max)).toBeLessThanOrEqual(0);
        }
      }
    }
  });
});
