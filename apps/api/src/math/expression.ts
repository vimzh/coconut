// Validates canonical scalar expressions and evaluates their exact rational values.
import {
  Arithmetic,
  ArithmeticLimitError,
  MAX_LITERAL_LENGTH,
  format,
} from "./rational";
import type {
  Expression,
  InputFailure,
  Label,
  ParsedReference,
} from "./types";
import type { Rational } from "./rational";

export const MAX_DEPTH = 128;
export const MAX_NODES = 512;
export const MAX_WITNESS_PAIRS = 16;

export class ReferenceInputError extends Error {
  constructor(
    public readonly reason: InputFailure,
    message: string,
  ) {
    super(message);
    this.name = "ReferenceInputError";
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new ReferenceInputError("invalid-input", `${name} must be an object.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !("value" in descriptors[key]!),
    )
  ) {
    throw new ReferenceInputError(
      "invalid-input",
      `${name} must contain only data fields.`,
    );
  }
  return value as Record<string, unknown>;
}

function fields(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): void {
  const keys = Object.getOwnPropertyNames(value);
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    keys.some((key) => !required.includes(key) && !optional.includes(key))
  ) {
    throw new ReferenceInputError(
      "invalid-input",
      `Expected fields: ${required.join(", ")}${optional.length ? `; optional: ${optional.join(", ")}` : ""}.`,
    );
  }
}

function canonicalNumber(value: unknown, arithmetic: Arithmetic): Rational {
  const parsed = arithmetic.parse(value);
  // Canonical inputs must also fit the literal boundary when replayed.
  if (format(parsed).length > MAX_LITERAL_LENGTH) {
    throw new ArithmeticLimitError("Canonical rational literal is too long.");
  }
  return parsed;
}

export function parseReference(
  input: unknown,
  arithmetic: Arithmetic,
): ParsedReference {
  const source = record(input, "Reference");
  fields(source, ["expression", "domain", "claimedLabel"], ["witnessPairs"]);
  if (!["convex", "concave", "neither"].includes(source.claimedLabel as string)) {
    throw new ReferenceInputError("invalid-input", "Unknown claimed label.");
  }
  const rawDomain = record(source.domain, "Domain");
  fields(rawDomain, ["min", "max"]);
  const domain = {
    min: canonicalNumber(rawDomain.min, arithmetic),
    max: canonicalNumber(rawDomain.max, arithmetic),
  };
  if (arithmetic.compare(domain.min, domain.max) >= 0) {
    throw new ReferenceInputError(
      "invalid-domain",
      "Domain must be a finite interval with min < max.",
    );
  }

  let nodes = 0;
  const ancestors = new Set<object>();
  function parseNode(value: unknown, depth: number): Expression {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) {
      throw new ArithmeticLimitError("Expression node or depth limit exceeded.");
    }
    const node = record(value, "Expression");
    if (ancestors.has(node)) {
      throw new ReferenceInputError("invalid-input", "Expression has a cycle.");
    }
    ancestors.add(node);
    let parsed: Expression;
    switch (node.op) {
      case "variable":
        fields(node, ["op"]);
        parsed = { op: "variable" };
        break;
      case "constant":
        fields(node, ["op", "value"]);
        parsed = {
          op: "constant",
          value: format(canonicalNumber(node.value, arithmetic)),
        };
        break;
      case "negate":
      case "square":
      case "abs":
        fields(node, ["op", "arg"]);
        parsed = { op: node.op, arg: parseNode(node.arg, depth + 1) };
        break;
      case "add":
      case "multiply":
      case "max":
      case "min":
        fields(node, ["op", "left", "right"]);
        parsed = {
          op: node.op,
          left: parseNode(node.left, depth + 1),
          right: parseNode(node.right, depth + 1),
        };
        break;
      default:
        throw new ReferenceInputError(
          "unsupported-operation",
          "Supported operations: variable, constant, negate, square, abs, add, multiply, max, min.",
        );
    }
    ancestors.delete(node);
    return parsed;
  }
  const expression = parseNode(source.expression, 0);

  const rawPairs = Object.hasOwn(source, "witnessPairs")
    ? source.witnessPairs
    : [];
  if (!Array.isArray(rawPairs)) {
    throw new ReferenceInputError("invalid-input", "witnessPairs must be an array.");
  }
  if (rawPairs.length > MAX_WITNESS_PAIRS) {
    throw new ArithmeticLimitError("Too many candidate witness pairs.");
  }
  if (
    Object.getPrototypeOf(rawPairs) !== Array.prototype ||
    Reflect.ownKeys(rawPairs).some(
      (key) =>
        key !== "length" &&
        (typeof key !== "string" ||
          key.length > 2 ||
          !/^(0|[1-9][0-9]*)$/.test(key) ||
          Number(key) >= rawPairs.length),
    )
  ) {
    throw new ReferenceInputError("invalid-input", "witnessPairs must be a plain array.");
  }
  const witnessPairs: ParsedReference["witnessPairs"] = [];
  for (let i = 0; i < rawPairs.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(rawPairs, String(i));
    if (!descriptor || !("value" in descriptor)) {
      throw new ReferenceInputError("invalid-input", "witnessPairs must contain data elements without gaps.");
    }
    const value: unknown = descriptor.value;
    const pair = record(value, "Witness pair");
    fields(pair, ["x", "y"]);
    const x = canonicalNumber(pair.x, arithmetic);
    const y = canonicalNumber(pair.y, arithmetic);
    if (
      arithmetic.compare(x, domain.min) < 0 ||
      arithmetic.compare(x, domain.max) > 0 ||
      arithmetic.compare(y, domain.min) < 0 ||
      arithmetic.compare(y, domain.max) > 0 ||
      arithmetic.compare(x, y) === 0
    ) {
      throw new ReferenceInputError(
        "invalid-domain",
        "Witness endpoints must be distinct and inside the input domain.",
      );
    }
    witnessPairs.push({ x, y });
  }
  return {
    canonical: {
      expression,
      domain: { min: format(domain.min), max: format(domain.max) },
      claimedLabel: source.claimedLabel as Label,
      witnessPairs: witnessPairs.map(({ x, y }) => ({ x: format(x), y: format(y) })),
    },
    domain,
    witnessPairs,
  };
}

export function evaluateExpression(
  expression: Expression,
  x: Rational,
  arithmetic: Arithmetic,
): Rational {
  switch (expression.op) {
    case "variable":
      return x;
    case "constant":
      return arithmetic.parse(expression.value);
    case "negate":
      return arithmetic.negate(evaluateExpression(expression.arg, x, arithmetic));
    case "square": {
      const value = evaluateExpression(expression.arg, x, arithmetic);
      return arithmetic.multiply(value, value);
    }
    case "abs": {
      const value = evaluateExpression(expression.arg, x, arithmetic);
      return value.numerator < 0n ? arithmetic.negate(value) : value;
    }
    default: {
      const left = evaluateExpression(expression.left, x, arithmetic);
      const right = evaluateExpression(expression.right, x, arithmetic);
      switch (expression.op) {
        case "add":
          return arithmetic.add(left, right);
        case "multiply":
          return arithmetic.multiply(left, right);
        case "max":
          return arithmetic.compare(left, right) >= 0 ? left : right;
        case "min":
          return arithmetic.compare(left, right) <= 0 ? left : right;
      }
    }
  }
}

export function renderExpression(expression: Expression): string {
  switch (expression.op) {
    case "variable":
      return "x";
    case "constant":
      return `(${expression.value})`;
    case "negate":
      return `(-${renderExpression(expression.arg)})`;
    case "square":
      return `(${renderExpression(expression.arg)}^2)`;
    case "abs":
      return `abs(${renderExpression(expression.arg)})`;
    default: {
      const left = renderExpression(expression.left);
      const right = renderExpression(expression.right);
      return expression.op === "add" || expression.op === "multiply"
        ? `(${left}${expression.op === "add" ? "+" : "*"}${right})`
        : `${expression.op}(${left},${right})`;
    }
  }
}
