// Smooth task wording has its own identity while reusing the existing answer contract.
import { getProfile, MAX_EXPLANATION_CODE_POINTS, MAX_RESPONSE_CODE_UNITS, type PromptBlueprint } from "../protocol";
import { ProtocolInputError } from "../protocol/validation";
import { certifyReferences } from "./backend";
import type { NumericalCertificate, NumericalPromptVersion } from "./types";

export interface NumericalPromptBlueprint extends PromptBlueprint { readonly promptVersion: NumericalPromptVersion }

const legacyInstructions = [
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

const currentInstructions = [
  "Determine the curvature of the scalar function in the user message on exactly the supplied closed interval.",
  "Read the complete expression, including parentheses and coefficient signs. Account for the domains, ranges, and curvature of nested terms where they affect the conclusion.",
  "Use any valid mathematical argument: simplification, composition rules, derivatives, or inequalities. Preserve the original function's domain when simplifying.",
  'Choose "convex" if the function is convex and not concave throughout the interval; choose "concave" if it is concave and not convex; choose "neither" if it has neither property on that interval.',
  'A composition rule that does not apply is inconclusive; it does not establish "neither". The input population excludes affine and constant functions.',
  "The only variable is x. Rational numbers are exact, ^2 denotes a square, and / denotes real division. exp and log use base e; sqrt denotes the nonnegative real square root.",
  'Respond with one JSON object containing exactly two fields: "label" and "explanation", both strings, each appearing once.',
  'Set "label" to exactly one of "convex", "concave", or "neither", in lowercase.',
  `Use "explanation" for a brief mathematical justification tied to this function and interval, with 1 to ${MAX_EXPLANATION_CODE_POINTS} Unicode code points of well-formed text and at least one non-whitespace character.`,
  `The complete response must fit within ${MAX_RESPONSE_CODE_UNITS} UTF-16 code units. Include no markdown fences, extra fields, or surrounding prose.`,
].join("\n");

// Saved suites must supply their retained version; omission creates new tasks.
export async function buildNumericalPrompts(inputs: readonly unknown[], profileId: unknown, promptVersion: NumericalPromptVersion = "smooth-v2"): Promise<readonly NumericalPromptBlueprint[]> {
  getProfile(profileId);
  if (promptVersion !== "smooth-v1" && promptVersion !== "smooth-v2") throw new ProtocolInputError("invalid-input", "Unknown numerical prompt version.");
  const results = [];
  for (let start = 0; start < inputs.length; start += 64) results.push(...await certifyReferences(inputs.slice(start, start + 64)));
  return results.map((result) => {
    if (result.status !== "verified") throw new ProtocolInputError("unverified-reference", `Smooth task requires a verified reference: ${result.status} (${result.reason}).`);
    return promptFromNumericalCertificate(result.certificate, profileId, promptVersion);
  });
}

// Persistence checks wording from a certificate already admitted by the native verifier.
export function promptFromNumericalCertificate(certificate: NumericalCertificate, profileId: unknown, promptVersion: NumericalPromptVersion): NumericalPromptBlueprint {
  const profile = getProfile(profileId);
  if (promptVersion !== "smooth-v1" && promptVersion !== "smooth-v2") throw new ProtocolInputError("invalid-input", "Unknown numerical prompt version.");
  const instructions = promptVersion === "smooth-v1" ? legacyInstructions : currentInstructions;
  const { renderedExpression, input } = certificate;
  return Object.freeze({
      protocolVersion: "1", promptVersion, profileId: profile.id,
      messages: Object.freeze([
        Object.freeze({ role: "system", content: instructions }),
        Object.freeze({ role: "user", content: `f(x) = ${renderedExpression}\nDomain: x in [${input.domain.min}, ${input.domain.max}].` }),
      ] as const),
      responseFormat: profile.responseFormat,
      generation: Object.freeze({
        maxOutputTokens: profile.maxOutputTokens, sampling: profile.sampling, reasoning: profile.reasoning, tools: profile.tools,
      }),
  });
}

export async function buildNumericalPrompt(input: unknown, profileId: unknown, promptVersion: NumericalPromptVersion = "smooth-v2"): Promise<NumericalPromptBlueprint> {
  return (await buildNumericalPrompts([input], profileId, promptVersion))[0];
}
