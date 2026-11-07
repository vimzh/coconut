// Freeze versioned task wording and verify domain-aware construction without private evidence.
import { describe, expect, it } from "bun:test";
import { extractAnswer, getProfile } from "../protocol";
import { buildNumericalPrompt } from "./prompt";
import type { NumericalReference, SmoothExpression } from "./types";

const legacyInstructions = [
  "Classify a real-valued scalar function over its entire stated closed interval.",
  'Use "convex" for convex but not concave, "concave" for concave but not convex, and "neither" for neither convex nor concave.',
  "Affine and constant functions are excluded from these tasks.",
  "The variable is x. Fractions are exact; ^2 means square; / means real division. exp is the natural exponential, log is the natural logarithm, and sqrt is the nonnegative real square root.",
  'Return exactly one JSON object with exactly two string fields: "label" and "explanation".',
  "Use each field exactly once.",
  'The label must be exactly one of "convex", "concave", or "neither", in lowercase.',
  "Give a brief, nonblank explanation in well-formed Unicode of at most 4096 Unicode code points.",
  "Keep the entire response within 65536 UTF-16 code units.",
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
  'Use "explanation" for a brief mathematical justification tied to this function and interval, with 1 to 4096 Unicode code points of well-formed text and at least one non-whitespace character.',
  "The complete response must fit within 65536 UTF-16 code units. Include no markdown fences, extra fields, or surrounding prose.",
].join("\n");

const x: SmoothExpression = { op: "variable" };
const difference: SmoothExpression = { op: "add", left: { op: "exp", arg: x }, right: { op: "negate", arg: { op: "square", arg: x } } };
const roundedExponential: NumericalReference = {
  expression: { op: "sqrt", arg: { op: "exp", arg: x } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex",
};

describe("versioned smooth prompts", () => {
  it("preserves historical instructions and changes only the system wording for new tasks", async () => {
    const previous = await buildNumericalPrompt(roundedExponential, "one-shot-json-v1", "smooth-v1");
    const current = await buildNumericalPrompt(roundedExponential, "one-shot-json-v1");
    expect(previous.promptVersion).toBe("smooth-v1");
    expect(previous.messages[0].content).toBe(legacyInstructions);
    expect(current.promptVersion).toBe("smooth-v2");
    expect(current.messages[0].content).toBe(currentInstructions);
    expect(current.messages[0].content).not.toBe(previous.messages[0].content);
    expect(current.messages[1]).toEqual(previous.messages[1]);
    expect(current.messages[1].content).toBe("f(x) = sqrt(exp(x))\nDomain: x in [-1, 1].");
    expect(current.responseFormat).toEqual(previous.responseFormat);
    expect(current.generation).toEqual(previous.generation);
  });

  it("keeps both answer profiles compatible with the existing deterministic extractor", async () => {
    for (const profile of ["one-shot-json-v1", "one-shot-schema-v1"]) {
      for (const version of ["smooth-v1", "smooth-v2"] as const) {
        const prompt = await buildNumericalPrompt(roundedExponential, profile, version);
        expect(prompt.responseFormat).toEqual(getProfile(profile).responseFormat);
        expect(prompt.generation.maxOutputTokens).toBe(4096);
        const outcome = extractAnswer({
          status: "completed",
          text: JSON.stringify({ label: "convex", explanation: "The function equals exp(x/2), whose second derivative is positive on the interval." }),
        }, prompt.profileId);
        expect(outcome).toMatchObject({ kind: "answer", label: "convex", protocolVersion: "1", profileId: profile });
      }
    }
  });

  it("retains the exact interval when a smooth expression changes classification by domain", async () => {
    const convex: NumericalReference = { expression: difference, domain: { min: "1", max: "2" }, claimedLabel: "convex" };
    const neither: NumericalReference = { expression: difference, domain: { min: "-1", max: "1" }, claimedLabel: "neither" };
    for (const version of ["smooth-v1", "smooth-v2"] as const) {
      const positive = await buildNumericalPrompt(convex, "one-shot-json-v1", version);
      const changing = await buildNumericalPrompt(neither, "one-shot-json-v1", version);
      expect(positive.messages[0]).toEqual(changing.messages[0]);
      expect(positive.messages[1].content).toEndWith("Domain: x in [1, 2].");
      expect(changing.messages[1].content).toEndWith("Domain: x in [-1, 1].");
      expect(positive.messages[1].content).not.toContain("convex");
      expect(changing.messages[1].content).not.toContain("neither");
    }
  });

  it("rejects unknown wording versions before producing a task", async () => {
    for (const version of ["smooth-v3", "", 2, null]) {
      await expect(buildNumericalPrompt(roundedExponential, "one-shot-json-v1", version as never)).rejects.toThrow();
    }
  });
});
