// Exact rational arithmetic with bounded input, intermediate size, and operation count.
export type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;

export class InvalidRationalError extends Error {}
export class ArithmeticLimitError extends Error {}

export const MAX_LITERAL_LENGTH = 96;
export const MAX_RATIONAL_BITS = 4096;
export const MAX_OPERATIONS = 200_000;

const rationalBound = 1n << BigInt(MAX_RATIONAL_BITS);
// Two bounded cross-products and their sum need at most 2 * 4096 + 1 bits.
const intermediateBound = 1n << BigInt(2 * MAX_RATIONAL_BITS + 1);

function assertSize(value: bigint, bound: bigint): void {
  if (value <= -bound || value >= bound) {
    throw new ArithmeticLimitError("Rational bit length exceeds the arithmetic limit");
  }
}

function assertOperand(value: Rational): void {
  if (
    typeof value !== "object" || value === null ||
    typeof value.numerator !== "bigint" || typeof value.denominator !== "bigint" ||
    value.denominator <= 0n
  ) {
    throw new InvalidRationalError("A rational operand requires bigint fields and a positive denominator");
  }
  assertSize(value.numerator, rationalBound);
  assertSize(value.denominator, rationalBound);
}

function normalize(numerator: bigint, denominator: bigint): Rational {
  if (typeof numerator !== "bigint" || typeof denominator !== "bigint") {
    throw new InvalidRationalError("A fraction requires bigint numerator and denominator");
  }
  if (denominator === 0n) {
    throw new InvalidRationalError("A rational denominator cannot be zero");
  }
  // Bound raw arguments before gcd, then allow cancellation before the retained-size check.
  assertSize(numerator, intermediateBound);
  assertSize(denominator, intermediateBound);
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  numerator /= a;
  denominator /= a;
  assertSize(numerator, rationalBound);
  assertSize(denominator, rationalBound);
  return Object.freeze({ numerator, denominator });
}

export function format(value: Rational): string {
  assertOperand(value);
  const { numerator, denominator } = normalize(value.numerator, value.denominator);
  return denominator === 1n ? numerator.toString() : `${numerator}/${denominator}`;
}

export class Arithmetic {
  #operations = 0;

  get operations(): number {
    return this.#operations;
  }

  #consume(): void {
    if (this.#operations >= MAX_OPERATIONS) {
      throw new ArithmeticLimitError("Arithmetic operation limit exceeded");
    }
    this.#operations++;
  }

  parse(value: unknown): Rational {
    this.#consume();
    if (typeof value !== "string") {
      throw new InvalidRationalError("A rational literal must be a string");
    }
    if (value.length > MAX_LITERAL_LENGTH) {
      throw new ArithmeticLimitError(`A rational literal cannot exceed ${MAX_LITERAL_LENGTH} characters`);
    }
    const fraction = /^([+-]?\d+)\/([+-]?\d+)$/.exec(value);
    if (fraction?.[0] === value) {
      return normalize(BigInt(fraction[1]), BigInt(fraction[2]));
    }
    // Decimals require digits on both sides of the point; whitespace and exponents are rejected.
    const decimal = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
    if (decimal?.[0] !== value) {
      throw new InvalidRationalError("Expected an integer, finite decimal, or integer fraction without whitespace");
    }
    const digits = decimal[3] ?? "";
    return normalize(BigInt(`${decimal[1]}${decimal[2]}${digits}`), 10n ** BigInt(digits.length));
  }

  fraction(numerator: bigint, denominator = 1n): Rational {
    this.#consume();
    return normalize(numerator, denominator);
  }

  add(a: Rational, b: Rational): Rational {
    this.#consume();
    assertOperand(a);
    assertOperand(b);
    return normalize(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
  }

  subtract(a: Rational, b: Rational): Rational {
    this.#consume();
    assertOperand(a);
    assertOperand(b);
    return normalize(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
  }

  multiply(a: Rational, b: Rational): Rational {
    this.#consume();
    assertOperand(a);
    assertOperand(b);
    return normalize(a.numerator * b.numerator, a.denominator * b.denominator);
  }

  divide(a: Rational, b: Rational): Rational {
    this.#consume();
    assertOperand(a);
    assertOperand(b);
    if (b.numerator === 0n) {
      throw new InvalidRationalError("Cannot divide by zero");
    }
    return normalize(a.numerator * b.denominator, a.denominator * b.numerator);
  }

  negate(value: Rational): Rational {
    this.#consume();
    assertOperand(value);
    return normalize(-value.numerator, value.denominator);
  }

  compare(a: Rational, b: Rational): number {
    this.#consume();
    assertOperand(a);
    assertOperand(b);
    const left = a.numerator * b.denominator;
    const right = b.numerator * a.denominator;
    return left < right ? -1 : left > right ? 1 : 0;
  }
}
