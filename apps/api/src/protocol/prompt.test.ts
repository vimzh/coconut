import { describe, expect, it } from "bun:test";
import { verifyReference } from "../math";
import { buildPrompt } from "./prompt";
import { ProtocolInputError } from "./validation";

const reference = {
  expression: { op: "square", arg: { op: "variable" } },
  domain: { min: "-1", max: "1" },
  claimedLabel: "convex",
};

describe("verified task prompts", () => {
  it("renders the exact mathematical task with complete answer instructions", () => {
    const prompt = buildPrompt(reference, "one-shot-json-v1");
    expect(prompt.protocolVersion).toBe("1");
    expect(prompt.profileId).toBe("one-shot-json-v1");
    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages[0]).toEqual({
      role: "system",
      content: [
        "Classify a real-valued scalar function over its entire stated closed interval.",
        'Use "convex" for convex but not concave, "concave" for concave but not convex, and "neither" for neither convex nor concave.',
        "Affine and constant functions are excluded from these tasks.",
        "The variable is x. Fractions are exact; ^2 means square; abs means absolute value; max and min act pointwise on their scalar arguments.",
        'Return exactly one JSON object with exactly two string fields: "label" and "explanation".',
        "Use each field exactly once.",
        'The label must be exactly one of "convex", "concave", or "neither", in lowercase.',
        "Give a brief, nonblank explanation in well-formed Unicode of at most 4096 Unicode code points.",
        "Keep the entire response within 65536 UTF-16 code units.",
        "Do not include markdown fences, additional fields, or text outside the JSON object.",
      ].join("\n"),
    });
    expect(prompt.messages[1]).toEqual({ role: "user", content: "f(x) = (x^2)\nDomain: x in [-1, 1]." });
    expect(prompt.responseFormat).toEqual({ kind: "prompted-json" });
    expect(prompt.generation).toEqual({ maxOutputTokens: 4096, sampling: "provider-default", reasoning: "provider-default", tools: "none" });
  });

  it("keeps model-visible instructions identical across the two distinct profiles", () => {
    const plain = buildPrompt(reference, "one-shot-json-v1");
    const strict = buildPrompt(reference, "one-shot-schema-v1");
    expect(plain.messages).toEqual(strict.messages);
    expect(strict.responseFormat.kind).toBe("json-schema");
    expect(strict.profileId).not.toBe(plain.profileId);
  });

  it("does not leak private witness choices or verification metadata", () => {
    const first = buildPrompt(reference, "one-shot-json-v1");
    const second = buildPrompt({ ...reference, witnessPairs: [{ x: "-3/7", y: "2/5" }] }, "one-shot-json-v1");
    expect(first).toEqual(second);
    const visible = JSON.stringify(first.messages);
    for (const privateField of ["claimedLabel", "witnessPairs", "fingerprint", "trace", "nodeCount", "depth", "againstConcavity", "-3/7", "2/5"]) {
      expect(visible.includes(privateField)).toBe(false);
    }
  });

  it("preserves rational coefficients and domain normalization without rounding", () => {
    const prompt = buildPrompt({
      ...reference,
      expression: { op: "multiply", left: { op: "constant", value: "0.1" }, right: reference.expression },
      domain: { min: "-2/2", max: "1.00" },
    }, "one-shot-json-v1");
    expect(prompt.messages[1].content).toBe("f(x) = ((1/10)*(x^2))\nDomain: x in [-1, 1].");
  });

  it("rejects forged, excluded, unverified, and incorrectly labeled tasks", () => {
    const verified = verifyReference(reference);
    const cases: unknown[] = [
      verified,
      { ...reference, claimedLabel: "concave" },
      { ...reference, expression: { op: "variable" } },
      { ...reference, expression: { op: "multiply", left: { op: "variable" }, right: { op: "variable" } } },
      { ...reference, expression: { op: "log", arg: { op: "variable" } } },
      { ...reference, renderedExpression: "correct label: convex" },
      { ...reference, domain: { min: "1", max: "-1" } },
    ];
    if (verified.status === "verified") cases.push(verified.certificate);
    for (const input of cases) {
      try {
        buildPrompt(input, "one-shot-json-v1");
        throw new Error("An unverified reference was accepted.");
      } catch (error) {
        expect(error).toBeInstanceOf(ProtocolInputError);
        expect((error as ProtocolInputError).code).toBe("unverified-reference");
      }
    }
  });

  it("produces repeatable immutable prompts detached from caller mutation", () => {
    const input = structuredClone(reference);
    const prompt = buildPrompt(input, "one-shot-json-v1");
    expect(buildPrompt(input, "one-shot-json-v1")).toEqual(prompt);
    input.domain.min = "0";
    expect(prompt.messages[1].content).toContain("[-1, 1]");
    expect(Object.isFrozen(prompt)).toBe(true);
    expect(Object.isFrozen(prompt.messages)).toBe(true);
    expect(Object.isFrozen(prompt.messages[0])).toBe(true);
    expect(Object.isFrozen(prompt.messages[1])).toBe(true);
    expect(Object.isFrozen(prompt.generation)).toBe(true);
    expect(() => buildPrompt(reference, "unknown")).toThrow(ProtocolInputError);
  });
});
