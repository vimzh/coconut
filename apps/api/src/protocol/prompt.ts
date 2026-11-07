// Builds model-visible tasks solely from independently verified mathematical input.
import { verifyReference } from "../math";
import { getProfile, MAX_EXPLANATION_CODE_POINTS, MAX_RESPONSE_CODE_UNITS, PROTOCOL_VERSION } from "./profiles";
import type { PromptBlueprint } from "./types";
import { ProtocolInputError } from "./validation";

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

export function buildPrompt(referenceInput: unknown, profileId: unknown): PromptBlueprint {
  const profile = getProfile(profileId);
  const reference = verifyReference(referenceInput);
  if (reference.status !== "verified") {
    throw new ProtocolInputError(
      "unverified-reference",
      `A task requires a verified reference; received ${reference.status} (${reference.reason}).`,
    );
  }
  const { renderedExpression, input } = reference.certificate;
  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    profileId: profile.id,
    messages: Object.freeze([
      Object.freeze({ role: "system" as const, content: instructions }),
      Object.freeze({
        role: "user" as const,
        content: `f(x) = ${renderedExpression}\nDomain: x in [${input.domain.min}, ${input.domain.max}].`,
      }),
    ] as const),
    responseFormat: profile.responseFormat,
    generation: Object.freeze({
      maxOutputTokens: profile.maxOutputTokens,
      sampling: profile.sampling,
      reasoning: profile.reasoning,
      tools: profile.tools,
    }),
  });
}
