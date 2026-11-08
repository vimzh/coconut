// Bounded identities diagnose representation padding without changing evaluated expressions or domains.
import { Arithmetic, format, type Rational } from "../math/rational";
import { canonical, sha256 } from "./data";

type Node = { readonly op: "variable" } | { readonly op: "constant"; readonly value: string }
  | { readonly op: "negate" | "square" | "abs" | "exp" | "log" | "sqrt"; readonly arg: Node }
  | { readonly op: "add" | "multiply" | "max" | "min" | "divide"; readonly left: Node; readonly right: Node };
const arithmetic = () => new Arithmetic();
const rational = (value: string): Rational => { const [n, d = "1"] = value.split("/"); return arithmetic().fraction(BigInt(n), BigInt(d)); };
const add = (a: Rational, b: Rational) => arithmetic().add(a, b);
const mul = (a: Rational, b: Rational) => arithmetic().multiply(a, b);
const neg = (a: Rational) => arithmetic().negate(a);
const zero = () => rational("0"), one = () => rational("1");
const constant = (value: Rational): Node => ({ op: "constant", value: format(value) });
const isConstant = (node: Node, value: string) => node.op === "constant" && format(rational(node.value)) === value;

function affine(node: Node): { slope: Rational; offset: Rational } | null {
  if (node.op === "variable") return { slope: one(), offset: zero() };
  if (node.op === "constant") return { slope: zero(), offset: rational(node.value) };
  if (node.op === "negate") {
    const child = affine(node.arg);
    return child && { slope: neg(child.slope), offset: neg(child.offset) };
  }
  if (node.op !== "add" && node.op !== "multiply") return null;
  const left = affine(node.left), right = affine(node.right);
  if (!left || !right) return null;
  if (node.op === "add") return { slope: add(left.slope, right.slope), offset: add(left.offset, right.offset) };
  if (left.slope.numerator !== 0n && right.slope.numerator !== 0n) return null;
  return { slope: add(mul(left.slope, right.offset), mul(right.slope, left.offset)), offset: mul(left.offset, right.offset) };
}

function renderAffine(value: { slope: Rational; offset: Rational }): Node {
  if (value.slope.numerator === 0n) return constant(value.offset);
  const term: Node = format(value.slope) === "1" ? { op: "variable" } : { op: "multiply", left: constant(value.slope), right: { op: "variable" } };
  return value.offset.numerator === 0n ? term : { op: "add", left: term, right: constant(value.offset) };
}

function simplify(node: Node, flags: Set<string>): Node {
  if (node.op === "constant") return constant(rational(node.value));
  if (node.op === "variable") return node;
  if ("arg" in node) {
    const arg = simplify(node.arg, flags);
    if ((node.op === "negate" && arg.op === "negate") || (node.op === "log" && arg.op === "exp") ||
      (node.op === "exp" && arg.op === "log") || (node.op === "square" && arg.op === "sqrt")) {
      flags.add(`${node.op}-${arg.op}-identity-on-certified-domain`);
      return arg.arg;
    }
    if ((node.op === "square" || node.op === "abs") && arg.op === "negate") {
      flags.add("even-operation-input-reflection");
      return { op: node.op, arg: arg.arg };
    }
    if (node.op === "negate" && arg.op === "constant") return constant(neg(rational(arg.value)));
    const result: Node = { ...node, arg } as Node;
    const linear = affine(result);
    return linear ? renderAffine(linear) : result;
  }
  let left = simplify(node.left, flags), right = simplify(node.right, flags);
  if (node.op === "add" && (isConstant(left, "0") || isConstant(right, "0"))) {
    flags.add("add-zero"); return isConstant(left, "0") ? right : left;
  }
  if (node.op === "multiply" && (isConstant(left, "0") || isConstant(right, "0"))) { flags.add("multiply-zero-on-certified-domain"); return constant(zero()); }
  if ((node.op === "multiply" || node.op === "divide") && isConstant(right, "1")) { flags.add(`${node.op}-one`); return left; }
  if (node.op === "multiply" && isConstant(left, "1")) { flags.add("multiply-one"); return right; }
  const result = { ...node, left, right } as Node;
  const linear = affine(result);
  if (linear) return renderAffine(linear);
  if (["add", "multiply", "max", "min"].includes(node.op) && canonical(left) > canonical(right)) [left, right] = [right, left];
  return { ...node, left, right } as Node;
}

function substitute(node: Node, replacement: Node): Node {
  if (node.op === "variable") return replacement;
  if (node.op === "constant") return node;
  if ("arg" in node) return { ...node, arg: substitute(node.arg, replacement) } as Node;
  return { ...node, left: substitute(node.left, replacement), right: substitute(node.right, replacement) } as Node;
}

function curvatureCore(node: Node, flags: Set<string>): string {
  const terms = new Map<string, Rational>();
  function collect(value: Node, scale: Rational): void {
    if (affine(value)) { flags.add("output-affine-terms-removed-for-core-only"); return; }
    if (value.op === "negate") { collect(value.arg, neg(scale)); return; }
    if (value.op === "add") { collect(value.left, scale); collect(value.right, scale); return; }
    if (value.op === "multiply" && value.left.op === "constant") { collect(value.right, mul(scale, rational(value.left.value))); return; }
    if (value.op === "multiply" && value.right.op === "constant") { collect(value.left, mul(scale, rational(value.right.value))); return; }
    const key = canonical(value); terms.set(key, add(terms.get(key) ?? zero(), scale));
  }
  collect(node, one());
  const ordered = [...terms].filter(([, coefficient]) => coefficient.numerator !== 0n).sort(([a], [b]) => a.localeCompare(b));
  if (!ordered.length) return "affine";
  const scale = ordered[0][1];
  if (format(scale) !== "1") flags.add(scale.numerator < 0n ? "negative-output-scale-for-core-only" : "positive-output-scale-for-core-only");
  return canonical(ordered.map(([term, coefficient]) => [term, format(arithmetic().divide(coefficient, scale))]));
}

function metrics(node: Node) {
  const operators: Record<string, number> = {}, unique = new Set<string>();
  function visit(value: Node): { depth: number; nodes: number } {
    operators[value.op] = (operators[value.op] ?? 0) + 1; unique.add(canonical(value));
    if (value.op === "constant" || value.op === "variable") return { depth: 0, nodes: 1 };
    if ("arg" in value) { const child = visit(value.arg); return { depth: child.depth + 1, nodes: child.nodes + 1 }; }
    const a = visit(value.left), b = visit(value.right);
    return { depth: 1 + Math.max(a.depth, b.depth), nodes: 1 + a.nodes + b.nodes };
  }
  return { ...visit(node), uniqueSubtrees: unique.size, operatorCounts: operators };
}

// Call after certificate replay: cancellations preserve the supplied domain, never an extended domain.
export function analyzeExpression(expression: Node, domain: { readonly min: string; readonly max: string }) {
  const flags = new Set<string>(), raw = metrics(expression), diagnostic = simplify(expression, flags);
  const min = rational(domain.min), max = rational(domain.max), half = rational("1/2");
  const center = mul(add(min, max), half), radius = mul(add(max, neg(min)), half);
  const normalized = simplify(substitute(diagnostic, renderAffine({ slope: radius, offset: center })), new Set());
  const reflected = simplify(substitute(normalized, { op: "negate", arg: { op: "variable" } }), new Set());
  const core = [curvatureCore(normalized, flags), curvatureCore(reflected, flags)].sort()[0];
  const simplified = metrics(diagnostic);
  return {
    rawDepth: raw.depth, rawNodes: raw.nodes, diagnosticDepth: simplified.depth, diagnosticNodes: simplified.nodes,
    uniqueSubtrees: raw.uniqueSubtrees, operatorCounts: raw.operatorCounts, activePieces: null,
    identityFlags: [...flags].sort(), exactSignature: sha256({ expression: diagnostic, domain }), coreSignature: sha256(core),
  };
}
