// This fixed-family research proof is separate from the unchanged application verifier's admission policy.
import { createHash } from "node:crypto";
import { evaluateExpression, renderExpression, MAX_DEPTH, MAX_NODES } from "../math/expression";
import { Arithmetic, format, MAX_LITERAL_LENGTH, MAX_RATIONAL_BITS, MAX_OPERATIONS } from "../math/rational";
import { verifyReference, type CanonicalReference, type Expression } from "../math";
import { getProfile, MAX_EXPLANATION_CODE_POINTS, MAX_RESPONSE_CODE_UNITS } from "../protocol/profiles";
import type { PromptBlueprint } from "../protocol";

export const DEPTH216_RESEARCH_POLICY = "absolute-sum-exact-216-v1";
export const DEPTH216_PROMPT_VERSION = "absolute-sum-216-prompt-v1";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const variable = (): Expression => ({ op: "variable" });

function shape(expression: Expression) {
  let nodes = 0;
  const visit = (node: Expression, level: number): number => {
    if (++nodes > 1200 || level > 216) throw new Error("The research-only 216-depth/1200-node bound was exceeded.");
    if (node.op === "variable" || node.op === "constant") return 0;
    if ("arg" in node) return 1 + visit(node.arg, level + 1);
    return 1 + Math.max(visit(node.left, level + 1), visit(node.right, level + 1));
  };
  return { depth: visit(expression, 0), nodeCount: nodes };
}

export function createDepth216Population() {
  if (MAX_DEPTH !== 128 || MAX_NODES !== 512 || MAX_LITERAL_LENGTH !== 96 || MAX_RATIONAL_BITS !== 4096 || MAX_OPERATIONS !== 200000) throw new Error("The underlying application or arithmetic boundary changed; review the separate research policy.");
  const cases = (["convex", "concave", "neither"] as const).flatMap(label => [128, 136, 144].map(denominator => {
    const arithmetic = new Arithmetic();
    const numerators = Array.from({ length: 107 }, (_, i) => [-(i + 1), i + 1]).flat();
    if (label === "convex") numerators.push(0);
    numerators.sort((a, b) => a - b);
    const centers = numerators.map(n => format(arithmetic.fraction(BigInt(n), BigInt(denominator))));
    const terms: Expression[] = centers.map(center => ({ op: "abs", arg: { op: "add", left: variable(), right: { op: "constant", value: format(arithmetic.negate(arithmetic.parse(center))) } } }));
    const sum = terms.reduce((left, right): Expression => ({ op: "add", left, right }));
    const expression: Expression = label === "convex" ? sum : label === "concave" ? { op: "negate", arg: sum } : { op: "multiply", left: variable(), right: sum };
    const measured = shape(expression);
    if (measured.depth !== 216 || measured.nodeCount !== (label === "convex" ? 1074 : label === "concave" ? 1070 : 1071)) throw new Error("Unexpected research expression shape.");
    const reference: CanonicalReference = { expression, domain: { min: "-1", max: "1" }, claimedLabel: label,
      witnessPairs: label === "neither" ? [{ x: "-1", y: "0" }, { x: "0", y: "1" }] : [{ x: "-1", y: "1" }] };
    const standardVerifierOutcome = verifyReference(reference);
    if (standardVerifierOutcome.status !== "unverified" || standardVerifierOutcome.reason !== "resource-limit") throw new Error("The standard verifier boundary changed; review this research method before use.");
    const witnesses = reference.witnessPairs.map(pair => {
      const x = arithmetic.parse(pair.x), y = arithmetic.parse(pair.y), two = arithmetic.fraction(2n);
      const midpoint = arithmetic.divide(arithmetic.add(x, y), two);
      const fX = evaluateExpression(expression, x, arithmetic), fY = evaluateExpression(expression, y, arithmetic), fMidpoint = evaluateExpression(expression, midpoint, arithmetic);
      return { ...pair, midpoint: format(midpoint), fX: format(fX), fY: format(fY), fMidpoint: format(fMidpoint),
        gap: format(arithmetic.subtract(fMidpoint, arithmetic.divide(arithmetic.add(fX, fY), two))) };
    });
    const signs = witnesses.map(witness => arithmetic.parse(witness.gap).numerator);
    if (label === "convex" ? !(signs.length === 1 && signs[0] < 0n) : label === "concave" ? !(signs.length === 1 && signs[0] > 0n)
      : !(signs.some(sign => sign > 0n) && signs.some(sign => sign < 0n))) throw new Error("Strict research witnesses did not establish the required exclusion.");
    const certificate = { policy: DEPTH216_RESEARCH_POLICY, ...measured, centerCount: centers.length,
      proof: label === "convex" ? "finite-sum-of-absolute-affine-convex" : label === "concave" ? "negated-finite-sum-of-absolute-affine-convex" : "opposite-strict-exact-Jensen-gaps",
      witnesses, arithmeticOperations: arithmetic.operations, renderedExpression: renderExpression(expression) };
    return { id: `case-depth216-v1-${digest(JSON.stringify(reference))}`, depth: 216, label, denominator, centers, reference, standardVerifierOutcome, certificate };
  }));
  if (new Set(cases.map(row => row.id)).size !== 9) throw new Error("Research identities repeat.");
  return { version: "1", methodId: "depth216-pilot-v1", researchPolicy: DEPTH216_RESEARCH_POLICY, researchPromptVersion: DEPTH216_PROMPT_VERSION, cases,
    interpretation: "Separate fixed-family exact research proof; standard verifier admission remains unverified/resource-limit. Highly templated absolute sums, associative nesting, length and kink-count confounds; no general deep-expression, causal depth, ranking or frontier claim." };
}

// Only these regenerated, proved cases can become research prompts; callers cannot supply an arbitrary expression.
const admitted = createDepth216Population();
const instructions = [
  "Classify a real-valued scalar function over its entire stated closed interval.",
  'Use "convex" for convex but not concave, "concave" for concave but not convex, and "neither" for neither convex nor concave.',
  "Affine and constant functions are excluded from these tasks.",
  "The variable is x. Fractions are exact; ^2 means square; abs means absolute value; max and min act pointwise on their scalar arguments.",
  'Return exactly one JSON object with exactly two string fields: "label" and "explanation".',
  "Use each field exactly once.",
  'The label must be exactly one of "convex", "concave", or "neither", in lowercase.',
  `Give a brief, nonblank explanation in well-formed Unicode of at most ${MAX_EXPLANATION_CODE_POINTS} Unicode code points.`,
  `Keep the entire response within ${MAX_RESPONSE_CODE_UNITS} UTF-16 code units.`,
  "Do not include markdown fences, additional fields, or text outside the JSON object.",
].join("\n");

export function buildDepth216Prompt(caseId: string): PromptBlueprint {
  const row = admitted.cases.find(row => row.id === caseId);
  if (!row) throw new Error("The research prompt requires one of the nine separately proved depth-216 cases.");
  const profile = getProfile("one-shot-json-v1");
  return { protocolVersion: "1", profileId: profile.id, messages: [{ role: "system", content: instructions },
    { role: "user", content: `f(x) = ${row.certificate.renderedExpression}\nDomain: x in [-1, 1].` }], responseFormat: profile.responseFormat,
    generation: { maxOutputTokens: profile.maxOutputTokens, sampling: profile.sampling, reasoning: profile.reasoning, tools: profile.tools } };
}

export function replayDepth216Population(text: string) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 2097152) throw new Error("Research population replay requires JSON text within 2 MiB.");
  const input: unknown = JSON.parse(text);
  const expected = createDepth216Population();
  if (JSON.stringify(input) !== JSON.stringify(expected)) throw new Error("The research population differs from its deterministic proof replay.");
  return expected;
}
