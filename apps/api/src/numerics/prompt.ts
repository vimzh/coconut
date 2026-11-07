// Smooth task wording has its own identity while reusing the existing answer contract.
import { getProfile, MAX_EXPLANATION_CODE_POINTS, MAX_RESPONSE_CODE_UNITS, type PromptBlueprint } from "../protocol";
import { ProtocolInputError } from "../protocol/validation";
import { certifyReferences } from "./backend";

export interface NumericalPromptBlueprint extends PromptBlueprint { readonly promptVersion: "smooth-v1" }

const instructions = [
  "Classify a real-valued scalar function over its entire stated closed interval.",
  'Use "convex" for convex but not concave, "concave" for concave but not convex, and "neither" for neither convex nor concave.',
  "Affine and constant functions are excluded from these tasks.",
  "The variable is x. Fractions are exact; ^2 means square; / means real division. exp is the natural exponential, log is the natural logarithm, and sqrt is the nonnegative real square root.",
  'Return exactly one JSON object with exactly two string fields: "label" and "explanation".',
  "Use each field exactly once.",
  'The label must be exactly one of "convex", "concave", or "neither", in lowercase.',
  `Give a brief, nonblank explanation in well-formed Unicode of at most ${MAX_EXPLANATION_CODE_POINTS} Unicode code points.`,
  `Keep the entire response within ${MAX_RESPONSE_CODE_UNITS} UTF-16 code units.`,
  "Do not include markdown fences, additional fields, or text outside the JSON object.",
].join("\n");

export async function buildNumericalPrompts(inputs: readonly unknown[], profileId: unknown): Promise<readonly NumericalPromptBlueprint[]> {
  const profile = getProfile(profileId);
  const results = [];
  for (let start = 0; start < inputs.length; start += 64) results.push(...await certifyReferences(inputs.slice(start, start + 64)));
  return results.map((result) => {
    if (result.status !== "verified") throw new ProtocolInputError("unverified-reference", `Smooth task requires a verified reference: ${result.status} (${result.reason}).`);
    const { renderedExpression, input } = result.certificate;
    return Object.freeze({
      protocolVersion: "1", promptVersion: "smooth-v1", profileId: profile.id,
      messages: Object.freeze([
        Object.freeze({ role: "system", content: instructions }),
        Object.freeze({ role: "user", content: `f(x) = ${renderedExpression}\nDomain: x in [${input.domain.min}, ${input.domain.max}].` }),
      ] as const),
      responseFormat: profile.responseFormat,
      generation: Object.freeze({
        maxOutputTokens: profile.maxOutputTokens, sampling: profile.sampling, reasoning: profile.reasoning, tools: profile.tools,
      }),
    });
  });
}

export async function buildNumericalPrompt(input: unknown, profileId: unknown): Promise<NumericalPromptBlueprint> {
  return (await buildNumericalPrompts([input], profileId))[0];
}
