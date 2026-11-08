// This fixed-family research proof is separate from the unchanged application verifier's admission policy.
import { createHash } from "node:crypto";
import { renderExpression, MAX_DEPTH, MAX_NODES } from "../math/expression";
import { Arithmetic, format, MAX_LITERAL_LENGTH, MAX_RATIONAL_BITS, MAX_OPERATIONS } from "../math/rational";
import { verifyReference, type CanonicalReference, type Expression } from "../math";
import type { PromptBlueprint } from "../protocol";
import type { Rational } from "../math/rational";
import { buildDepth216Prompt, createDepth216Population } from "./depth216-reference";

export const DEEP_PAIR_RESEARCH_POLICY = "absolute-sum-deep-pair-v1";
export const DEEP_PAIR_PROMPT_VERSION = "absolute-sum-deep-pair-prompt-v1";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const variable = (): Expression => ({ op: "variable" });

function shape(expression: Expression, maximumDepth: number) {
  let nodeCount = 0, depth = 0;
  const stack = [{ node: expression, level: 0 }];
  while (stack.length) {
    const { node, level } = stack.pop()!;
    if (++nodeCount > 2600 || level > maximumDepth) throw new Error("The separate research structural bound was exceeded.");
    depth = Math.max(depth, level);
    if (node.op === "variable" || node.op === "constant") continue;
    if ("arg" in node) stack.push({ node: node.arg, level: level + 1 });
    else stack.push({ node: node.left, level: level + 1 }, { node: node.right, level: level + 1 });
  }
  return { depth, nodeCount };
}

// Explicit postorder work avoids relying on a deeper recursive evaluation stack.
function evaluate(expression: Expression, x: Rational, arithmetic: Arithmetic): Rational {
  const stack = [{ node: expression, ready: false }], values: Rational[] = [];
  let nodes = 0;
  const take = () => { const value = values.pop(); if (!value) throw new Error("Research value stack underflow."); return value; };
  while (stack.length) {
    const { node, ready } = stack.pop()!;
    if (!ready) {
      if (++nodes > 2600) throw new Error("Research evaluation exceeded its node budget.");
      if (node.op === "variable") { values.push(x); continue; }
      if (node.op === "constant") { values.push(arithmetic.parse(node.value)); continue; }
      stack.push({ node, ready: true });
      if (node.op === "abs" || node.op === "negate") stack.push({ node: node.arg, ready: false });
      else if (node.op === "add" || node.op === "multiply") stack.push({ node: node.right, ready: false }, { node: node.left, ready: false });
      else throw new Error("Unsupported operation in the fixed research family.");
      continue;
    }
    if (node.op === "abs" || node.op === "negate") {
      const value = take(); values.push(node.op === "negate" || value.numerator < 0n ? arithmetic.negate(value) : value);
    } else if (node.op === "add" || node.op === "multiply") {
      const right = take(), left = take(); values.push(node.op === "add" ? arithmetic.add(left, right) : arithmetic.multiply(left, right));
    } else throw new Error("Unexpected research evaluation state.");
  }
  if (values.length !== 1) throw new Error("Research evaluation did not settle exactly one value.");
  return values[0];
}

export function createDeepPairPopulation() {
  if (MAX_DEPTH !== 128 || MAX_NODES !== 512 || MAX_LITERAL_LENGTH !== 96 || MAX_RATIONAL_BITS !== 4096 || MAX_OPERATIONS !== 200000) throw new Error("The underlying application or arithmetic boundary changed; review the separate research policy.");
  const cases = ([256, 512] as const).flatMap(depth => (["convex", "concave", "neither"] as const).map(label => {
    const denominator = 5 * depth / 8;
    const arithmetic = new Arithmetic();
    const numerators = Array.from({ length: depth / 2 - 1 }, (_, i) => [-(i + 1), i + 1]).flat();
    if (label === "convex") numerators.push(0);
    numerators.sort((a, b) => a - b);
    const centers = numerators.map(n => format(arithmetic.fraction(BigInt(n), BigInt(denominator))));
    const terms: Expression[] = centers.map(center => ({ op: "abs", arg: { op: "add", left: variable(), right: { op: "constant", value: format(arithmetic.negate(arithmetic.parse(center))) } } }));
    const sum = terms.reduce((left, right): Expression => ({ op: "add", left, right }));
    const expression: Expression = label === "convex" ? sum : label === "concave" ? { op: "negate", arg: sum } : { op: "multiply", left: variable(), right: sum };
    const measured = shape(expression, depth);
    if (measured.depth !== depth || measured.nodeCount !== (label === "convex" ? 5 * depth - 6 : label === "concave" ? 5 * depth - 10 : 5 * depth - 9)) throw new Error("Unexpected research expression shape.");
    const reference: CanonicalReference = { expression, domain: { min: "-1", max: "1" }, claimedLabel: label,
      witnessPairs: label === "neither" ? [{ x: "-1", y: "0" }, { x: "0", y: "1" }] : [{ x: "-1", y: "1" }] };
    const standardVerifierOutcome = verifyReference(reference);
    if (standardVerifierOutcome.status !== "unverified" || standardVerifierOutcome.reason !== "resource-limit") throw new Error("The standard verifier boundary changed; review this research method before use.");
    const witnesses = reference.witnessPairs.map(pair => {
      const x = arithmetic.parse(pair.x), y = arithmetic.parse(pair.y), two = arithmetic.fraction(2n);
      const midpoint = arithmetic.divide(arithmetic.add(x, y), two);
      const fX = evaluate(expression, x, arithmetic), fY = evaluate(expression, y, arithmetic), fMidpoint = evaluate(expression, midpoint, arithmetic);
      return { ...pair, midpoint: format(midpoint), fX: format(fX), fY: format(fY), fMidpoint: format(fMidpoint),
        gap: format(arithmetic.subtract(fMidpoint, arithmetic.divide(arithmetic.add(fX, fY), two))) };
    });
    const signs = witnesses.map(witness => arithmetic.parse(witness.gap).numerator);
    if (label === "convex" ? !(signs.length === 1 && signs[0] < 0n) : label === "concave" ? !(signs.length === 1 && signs[0] > 0n)
      : !(signs.some(sign => sign > 0n) && signs.some(sign => sign < 0n))) throw new Error("Strict research witnesses did not establish the required exclusion.");
    const certificate = { policy: DEEP_PAIR_RESEARCH_POLICY, ...measured, centerCount: centers.length,
      proof: label === "convex" ? "finite-sum-of-absolute-affine-convex" : label === "concave" ? "negated-finite-sum-of-absolute-affine-convex" : "opposite-strict-exact-Jensen-gaps",
      witnesses, arithmeticOperations: arithmetic.operations, renderedExpression: renderExpression(expression) };
    return { id: `case-deep-pair-v1-${depth}-${digest(JSON.stringify(reference))}`, depth, label, denominator, centers, reference, standardVerifierOutcome, certificate };
  }));
  if (new Set(cases.map(row => row.id)).size !== 6) throw new Error("Research identities repeat.");
  return { version: "1", methodId: "deep-pair-pilot-v1", researchPolicy: DEEP_PAIR_RESEARCH_POLICY, researchPromptVersion: DEEP_PAIR_PROMPT_VERSION, cases,
    interpretation: "Separate fixed-family exact research proof; standard verifier admission remains unverified/resource-limit. Highly templated absolute sums, associative nesting, length and kink-count confounds; no general deep-expression, causal depth, ranking or frontier claim." };
}

// Only these regenerated, proved cases can become research prompts; callers cannot supply an arbitrary expression.
const admitted = createDeepPairPopulation();
const template = buildDepth216Prompt(createDepth216Population().cases[0].id);
export function buildDeepPairPrompt(caseId: string): PromptBlueprint {
  const row = admitted.cases.find(row => row.id === caseId);
  if (!row) throw new Error("The research prompt requires one of the six separately proved depth-256/512 cases.");
  return { ...template, messages: [{ ...template.messages[0] },
    { role: "user", content: `f(x) = ${row.certificate.renderedExpression}\nDomain: x in [-1, 1].` }], generation: { ...template.generation } };
}

export function replayDeepPairPopulation(text: string) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 2097152) throw new Error("Research population replay requires JSON text within 2 MiB.");
  const input: unknown = JSON.parse(text);
  const expected = createDeepPairPopulation();
  if (JSON.stringify(input) !== JSON.stringify(expected)) throw new Error("The research population differs from its deterministic proof replay.");
  return expected;
}
