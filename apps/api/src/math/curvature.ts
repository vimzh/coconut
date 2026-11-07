// Computes sufficient curvature proofs and exact enclosing ranges bottom-up.
import { Arithmetic, format } from "./rational";
import type { Analysis, Expression, Range, TraceEntry } from "./types";
import type { Rational } from "./rational";

interface State {
  convex: boolean;
  concave: boolean;
  range: Range;
  depth: number;
}

export function analyzeExpression(
  expression: Expression,
  domain: Range,
  arithmetic: Arithmetic,
): Analysis {
  const trace: TraceEntry[] = [];
  const zero = arithmetic.fraction(0n);
  const smaller = (a: Rational, b: Rational) =>
    arithmetic.compare(a, b) <= 0 ? a : b;
  const larger = (a: Rational, b: Rational) =>
    arithmetic.compare(a, b) >= 0 ? a : b;

  function visit(node: Expression): State {
    let convex = false;
    let concave = false;
    let depth = 0;
    let range: Range;
    let rule: string;
    switch (node.op) {
      case "variable":
        convex = concave = true;
        range = domain;
        rule = "affine-variable";
        break;
      case "constant": {
        convex = concave = true;
        const value = arithmetic.parse(node.value);
        range = { min: value, max: value };
        rule = "constant";
        break;
      }
      case "negate":
      case "square":
      case "abs": {
        const child = visit(node.arg);
        depth = child.depth + 1;
        if (node.op === "negate") {
          convex = child.concave;
          concave = child.convex;
          range = {
            min: arithmetic.negate(child.range.max),
            max: arithmetic.negate(child.range.min),
          };
          rule = "negation";
        } else {
          const { min, max } = child.range;
          const nonnegative = min.numerator >= 0n;
          const nonpositive = max.numerator <= 0n;
          const affine = child.convex && child.concave;
          convex =
            affine ||
            (child.convex && nonnegative) ||
            (child.concave && nonpositive);
          rule = convex
            ? `${node.op}-of-${affine ? "affine" : nonnegative ? "nonnegative-convex" : "nonpositive-concave"}`
            : "unknown-composition";
          const transform = (value: Rational) =>
            node.op === "square"
              ? arithmetic.multiply(value, value)
              : value.numerator < 0n
                ? arithmetic.negate(value)
                : value;
          const a = transform(min);
          const b = transform(max);
          range = {
            min: nonnegative ? a : nonpositive ? b : zero,
            max: larger(a, b),
          };
        }
        break;
      }
      default: {
        const left = visit(node.left);
        const right = visit(node.right);
        depth = Math.max(left.depth, right.depth) + 1;
        if (node.op === "add") {
          convex = left.convex && right.convex;
          concave = left.concave && right.concave;
          range = {
            min: arithmetic.add(left.range.min, right.range.min),
            max: arithmetic.add(left.range.max, right.range.max),
          };
          rule = "sum";
        } else if (node.op === "multiply") {
          const products = [
            arithmetic.multiply(left.range.min, right.range.min),
            arithmetic.multiply(left.range.min, right.range.max),
            arithmetic.multiply(left.range.max, right.range.min),
            arithmetic.multiply(left.range.max, right.range.max),
          ];
          range = {
            min: products.reduce(smaller),
            max: products.reduce(larger),
          };
          const leftConstant = arithmetic.compare(left.range.min, left.range.max) === 0;
          const rightConstant = arithmetic.compare(right.range.min, right.range.max) === 0;
          const factor = leftConstant ? left : rightConstant ? right : undefined;
          const other = leftConstant ? right : left;
          if (factor) {
            const positive = factor.range.min.numerator >= 0n;
            convex = positive ? other.convex : other.concave;
            concave = positive ? other.concave : other.convex;
          }
          rule = factor ? "constant-product" : "unknown-product";
        } else {
          const choose = node.op === "max" ? larger : smaller;
          range = {
            min: choose(left.range.min, right.range.min),
            max: choose(left.range.max, right.range.max),
          };
          convex = node.op === "max" && left.convex && right.convex;
          concave = node.op === "min" && left.concave && right.concave;
          rule = node.op === "max" ? "maximum" : "minimum";
        }
        break;
      }
    }
    // A singleton enclosure proves constancy even after an unknown composition.
    if (arithmetic.compare(range.min, range.max) === 0) {
      convex = concave = true;
      rule = "constant-range";
    }
    trace.push({
      node: trace.length,
      op: node.op,
      depth,
      convex,
      concave,
      range: { min: format(range.min), max: format(range.max) },
      rule,
    });
    return { convex, concave, range, depth };
  }

  return { ...visit(expression), nodeCount: trace.length, trace };
}
