import { describe, expect, it } from "bun:test";
import {
  Arithmetic,
  ArithmeticLimitError,
  format,
  InvalidRationalError,
  MAX_LITERAL_LENGTH,
  MAX_OPERATIONS,
  MAX_RATIONAL_BITS,
} from "./rational";

describe("exact rationals", () => {
  it("reduces fractions, normalizes signs, and freezes values", () => {
    const arithmetic = new Arithmetic();
    expect(arithmetic.fraction(-12n, -18n)).toEqual({ numerator: 2n, denominator: 3n });
    expect(arithmetic.fraction(12n, -18n)).toEqual({ numerator: -2n, denominator: 3n });
    expect(arithmetic.fraction(0n, -18n)).toEqual({ numerator: 0n, denominator: 1n });
    expect(format(arithmetic.fraction(9n, 3n))).toBe("3");
    expect(format(arithmetic.fraction(-6n, 9n))).toBe("-2/3");
    expect(format({ numerator: 6n, denominator: 9n })).toBe("2/3");
    expect(Object.isFrozen(arithmetic.fraction(1n, 3n))).toBe(true);
  });

  it("parses integers, decimals, and signed integer fractions exactly", () => {
    const arithmetic = new Arithmetic();
    for (const [literal, expected] of [
      ["+0012", "12"], ["-0", "0"], ["-0.000", "0"],
      ["0.125", "1/8"], ["-12.50", "-25/2"], ["+0.5", "1/2"],
      ["12/-18", "-2/3"], ["-12/-18", "2/3"], ["+3/+12", "1/4"],
    ]) {
      expect(format(arithmetic.parse(literal))).toBe(expected);
    }
    expect(format(arithmetic.add(arithmetic.parse("0.1"), arithmetic.parse("0.2")))).toBe("3/10");
  });

  it("rejects non-string values and malformed literals without coercion", () => {
    const arithmetic = new Arithmetic();
    for (const literal of [
      undefined, null, 0, 0.5, 1n, {}, ["1"], "", " ", " 1", "1 ",
      "1\n", "1/2\n", "1\r\n", "1\t", ".5", "1.", "1e2", "NaN", "Infinity",
      "--1", "+-1", "1 /2", "1/ 2", "1/2/3", "0.5/2", "0x10", "1_000",
    ]) {
      expect(() => arithmetic.parse(literal)).toThrow(InvalidRationalError);
    }
  });

  it("rejects zero denominators and division by zero explicitly", () => {
    const arithmetic = new Arithmetic();
    for (const literal of ["1/0", "0/0", "1/-0", "1/+00"]) {
      expect(() => arithmetic.parse(literal)).toThrow(InvalidRationalError);
    }
    expect(() => arithmetic.fraction(1n, 0n)).toThrow(InvalidRationalError);
    expect(() => arithmetic.divide(arithmetic.parse("2/3"), arithmetic.parse("0"))).toThrow(InvalidRationalError);
  });

  it("computes all arithmetic operations with exact hand-calculated results", () => {
    const arithmetic = new Arithmetic();
    const a = arithmetic.parse("2/3");
    const b = arithmetic.parse("-5/7");
    expect(format(arithmetic.add(a, b))).toBe("-1/21");
    expect(format(arithmetic.subtract(a, b))).toBe("29/21");
    expect(format(arithmetic.multiply(a, b))).toBe("-10/21");
    expect(format(arithmetic.divide(a, b))).toBe("-14/15");
    expect(format(arithmetic.negate(b))).toBe("5/7");
    expect(arithmetic.compare(a, b)).toBe(1);
    expect(arithmetic.compare(b, a)).toBe(-1);
    expect(arithmetic.compare(a, arithmetic.parse("4/6"))).toBe(0);
  });

  it("retains strict signs far below floating-point resolution", () => {
    const arithmetic = new Arithmetic();
    const one = arithmetic.parse("1");
    const larger = arithmetic.parse("1.0000000000000000000000000000000000000001");
    const gap = arithmetic.subtract(larger, one);
    expect(gap).toEqual({ numerator: 1n, denominator: 10n ** 40n });
    expect(arithmetic.compare(larger, one)).toBe(1);
    expect(arithmetic.compare(gap, arithmetic.parse("0"))).toBe(1);
    expect(arithmetic.compare(arithmetic.negate(gap), arithmetic.parse("0"))).toBe(-1);
  });

  it("checks literal length before parsing arbitrary-sized integers", () => {
    const arithmetic = new Arithmetic();
    expect(format(arithmetic.parse("0".repeat(MAX_LITERAL_LENGTH)))).toBe("0");
    expect(() => arithmetic.parse("0".repeat(MAX_LITERAL_LENGTH + 1))).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.parse("9".repeat(100_000))).toThrow(ArithmeticLimitError);
  });

  it("allows bounded intermediate cancellation before enforcing retained bit limits", () => {
    const arithmetic = new Arithmetic();
    const maximum = (1n << BigInt(MAX_RATIONAL_BITS)) - 1n;
    const a = arithmetic.fraction(maximum, maximum - 1n);
    const reciprocal = arithmetic.fraction(maximum - 1n, maximum);
    expect(format(arithmetic.multiply(a, reciprocal))).toBe("1");
    expect(format(arithmetic.add(a, arithmetic.negate(a)))).toBe("0");
    expect(arithmetic.add(a, a)).toEqual({ numerator: maximum, denominator: (maximum - 1n) / 2n });
    const raw = 1n << BigInt(2 * MAX_RATIONAL_BITS);
    expect(format(arithmetic.fraction(raw, raw))).toBe("1");
  });

  it("rejects retained result growth and oversized raw arguments", () => {
    const arithmetic = new Arithmetic();
    const maximum = arithmetic.fraction((1n << BigInt(MAX_RATIONAL_BITS)) - 1n);
    expect(() => arithmetic.add(maximum, maximum)).toThrow(ArithmeticLimitError);
    const power = arithmetic.fraction(1n << BigInt(MAX_RATIONAL_BITS / 2));
    expect(() => arithmetic.multiply(power, power)).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.fraction(1n, 1n << BigInt(MAX_RATIONAL_BITS))).toThrow(ArithmeticLimitError);
    const oversized = 1n << BigInt(2 * MAX_RATIONAL_BITS + 1);
    expect(() => arithmetic.fraction(oversized, oversized)).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.fraction(0n, oversized)).toThrow(ArithmeticLimitError);
    const huge = 1n << 100_000n;
    expect(() => arithmetic.fraction(huge, huge)).toThrow(ArithmeticLimitError);
  });

  it("validates operand bounds before allocating cross-products", () => {
    const arithmetic = new Arithmetic();
    const valid = arithmetic.parse("1");
    const oversized = { numerator: 1n << 100_000n, denominator: 1n };
    for (const operation of ["add", "subtract", "multiply", "divide", "compare"] as const) {
      expect(() => arithmetic[operation](valid, oversized)).toThrow(ArithmeticLimitError);
      expect(() => arithmetic[operation](oversized, valid)).toThrow(ArithmeticLimitError);
    }
    expect(() => arithmetic.negate(oversized)).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.compare(valid, { numerator: 1n, denominator: -1n })).toThrow(InvalidRationalError);
  });

  it("counts parsing, fraction construction, and every arithmetic operation", () => {
    const arithmetic = new Arithmetic();
    const a = arithmetic.parse("1");
    const b = arithmetic.fraction(2n);
    arithmetic.add(a, b);
    arithmetic.subtract(a, b);
    arithmetic.multiply(a, b);
    arithmetic.divide(a, b);
    arithmetic.negate(a);
    arithmetic.compare(a, b);
    expect(arithmetic.operations).toBe(8);
  });

  it("fails visibly at the operation budget, including fraction construction", () => {
    const arithmetic = new Arithmetic();
    const zero = new Arithmetic().fraction(0n);
    for (let index = 0; index < MAX_OPERATIONS; index++) {
      arithmetic.compare(zero, zero);
    }
    expect(arithmetic.operations).toBe(MAX_OPERATIONS);
    expect(() => arithmetic.compare(zero, zero)).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.parse("0")).toThrow(ArithmeticLimitError);
    expect(() => arithmetic.fraction(0n)).toThrow(ArithmeticLimitError);
    expect(arithmetic.operations).toBe(MAX_OPERATIONS);
  });
});
