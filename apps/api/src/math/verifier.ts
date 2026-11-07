// Derive exact reference labels and replay their bounded, input-bound evidence.
import { createHash } from "node:crypto";
import { analyzeExpression } from "./curvature";
import {
  evaluateExpression,
  MAX_DEPTH,
  parseReference,
  ReferenceInputError,
  renderExpression,
} from "./expression";
import {
  Arithmetic,
  ArithmeticLimitError,
  format,
  InvalidRationalError,
} from "./rational";
import type { Rational } from "./rational";
import type {
  Analysis,
  Expression,
  Label,
  ParsedReference,
  VerificationCertificate,
  VerificationResult,
  Witness,
} from "./types";

export const VERIFIER_VERSION = "1";

function midpointWitness(
  expression: Expression,
  x: Rational,
  y: Rational,
  two: Rational,
  arithmetic: Arithmetic,
): Witness | undefined {
  if (arithmetic.compare(x, y) > 0) {
    [x, y] = [y, x];
  }
  const midpoint = arithmetic.divide(arithmetic.add(x, y), two);
  const fX = evaluateExpression(expression, x, arithmetic);
  const fY = evaluateExpression(expression, y, arithmetic);
  const fMidpoint = evaluateExpression(expression, midpoint, arithmetic);
  const gap = arithmetic.subtract(
    fMidpoint,
    arithmetic.divide(arithmetic.add(fX, fY), two),
  );
  if (gap.numerator === 0n) {
    return undefined;
  }
  return {
    x: format(x),
    y: format(y),
    midpoint: format(midpoint),
    fX: format(fX),
    fY: format(fY),
    fMidpoint: format(fMidpoint),
    gap: format(gap),
  };
}

function searchWitnesses(
  parsed: ParsedReference,
  analysis: Analysis,
  arithmetic: Arithmetic,
): VerificationCertificate["witnesses"] {
  const witnesses: VerificationCertificate["witnesses"] = {};
  const two = arithmetic.fraction(2n);
  const considerPair = (x: Rational, y: Rational): boolean => {
    const witness = midpointWitness(parsed.canonical.expression, x, y, two, arithmetic);
    if (witness) {
      const negativeGap = witness.gap.startsWith("-");
      if ((analysis.convex && !negativeGap) || (analysis.concave && negativeGap)) {
        throw new Error("A strict midpoint witness contradicts the sufficient curvature proof.");
      }
      if (negativeGap) {
        witnesses.againstConcavity ??= witness;
      } else {
        witnesses.againstConvexity ??= witness;
      }
    }
    if (analysis.convex) return witnesses.againstConcavity !== undefined;
    if (analysis.concave) return witnesses.againstConvexity !== undefined;
    return witnesses.againstConvexity !== undefined && witnesses.againstConcavity !== undefined;
  };

  for (const { x, y } of parsed.witnessPairs) {
    if (considerPair(x, y)) return witnesses;
  }

  const step = arithmetic.divide(
    arithmetic.subtract(parsed.domain.max, parsed.domain.min),
    arithmetic.fraction(8n),
  );
  const grid = Array.from({ length: 9 }, (_, index) =>
    arithmetic.add(
      parsed.domain.min,
      arithmetic.multiply(step, arithmetic.fraction(BigInt(index))),
    ),
  );
  for (let left = 0; left < grid.length; left++) {
    for (let right = left + 1; right < grid.length; right++) {
      if (considerPair(grid[left], grid[right])) return witnesses;
    }
  }
  return witnesses;
}

export function verifyReference(input: unknown): VerificationResult {
  try {
    const arithmetic = new Arithmetic();
    const parsed = parseReference(input, arithmetic);
    const analysis = analyzeExpression(parsed.canonical.expression, parsed.domain, arithmetic);
    if (analysis.convex && analysis.concave) {
      return {
        status: "excluded",
        reason: "overlapping-labels",
        message: "The function is proved affine or constant, so its convex and concave labels overlap.",
      };
    }

    const witnesses = searchWitnesses(parsed, analysis, arithmetic);
    let label: Label | undefined;
    if (witnesses.againstConvexity && witnesses.againstConcavity) {
      label = "neither";
    } else if (analysis.convex && witnesses.againstConcavity) {
      label = "convex";
    } else if (analysis.concave && witnesses.againstConvexity) {
      label = "concave";
    }
    if (!label) {
      return analysis.convex || analysis.concave
        ? {
            status: "unverified",
            reason: "no-strict-witness",
            message: "The curvature proof has no strict midpoint witness against the opposite property.",
          }
        : {
            status: "unverified",
            reason: "inconclusive-curvature",
            message: "The curvature rules and bounded midpoint search do not establish a reference label.",
          };
    }
    if (label !== parsed.canonical.claimedLabel) {
      return {
        status: "rejected",
        reason: "label-mismatch",
        message: `The claimed label "${parsed.canonical.claimedLabel}" does not match the independently derived label "${label}".`,
      };
    }
    return {
      status: "verified",
      label,
      certificate: {
        version: VERIFIER_VERSION,
        input: parsed.canonical,
        fingerprint: createHash("sha256").update(JSON.stringify(parsed.canonical)).digest("hex"),
        renderedExpression: renderExpression(parsed.canonical.expression),
        depth: analysis.depth,
        nodeCount: analysis.nodeCount,
        trace: analysis.trace,
        witnesses,
      },
    };
  } catch (error) {
    if (error instanceof ArithmeticLimitError) {
      return { status: "unverified", reason: "resource-limit", message: error.message };
    }
    if (error instanceof ReferenceInputError) {
      return { status: "rejected", reason: error.reason, message: error.message };
    }
    if (error instanceof InvalidRationalError) {
      return { status: "rejected", reason: "invalid-input", message: error.message };
    }
    throw error;
  }
}

function matchesEvidence(expected: unknown, provided: unknown, depth = 0): boolean {
  // The trusted input tree has bounded depth; never recurse according to untrusted metadata.
  if (depth > MAX_DEPTH + 8) return false;
  if (expected === null || typeof expected !== "object") return expected === provided;
  if (provided === null || typeof provided !== "object") return false;
  if (Object.getPrototypeOf(provided) !== Object.getPrototypeOf(expected)) return false;

  const expectedKeys = Reflect.ownKeys(expected);
  const providedKeys = Reflect.ownKeys(provided);
  if (expectedKeys.length !== providedKeys.length) return false;
  for (const key of expectedKeys) {
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key);
    const providedDescriptor = Object.getOwnPropertyDescriptor(provided, key);
    if (!expectedDescriptor || !providedDescriptor || !("value" in providedDescriptor)) return false;
    if (!matchesEvidence(expectedDescriptor.value, providedDescriptor.value, depth + 1)) return false;
  }
  return true;
}

export function checkCertificate(input: unknown, certificate: unknown): boolean {
  const result = verifyReference(input);
  return result.status === "verified" && matchesEvidence(result.certificate, certificate);
}
