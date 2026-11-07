import { describe, expect, it } from "bun:test";
import type { Expression, Label } from "../math";
import {
  buildPrompt,
  calculateWorkload,
  checkCompatibility,
  extractAnswer,
  getProfile,
} from "./index";
import type { CapabilityEvidence, ProfileId } from "./index";

const x: Expression = { op: "variable" };
const square: Expression = { op: "square", arg: x };
const fixtures: { expression: Expression; label: Label; explanation: string }[] = [
  { expression: square, label: "convex", explanation: "The quadratic is strictly convex on this interval." },
  { expression: { op: "negate", arg: square }, label: "concave", explanation: "Negating the quadratic gives strict concavity." },
  { expression: { op: "multiply", left: x, right: square }, label: "neither", explanation: "The cubic changes curvature across zero." },
];
const capabilities: CapabilityEvidence = {
  textInput: "supported", textOutput: "supported", outputTokenLimit: "supported", jsonSchema: "supported",
};
const profiles: ProfileId[] = ["one-shot-json-v1", "one-shot-schema-v1"];

describe("offline evaluation protocol integration", () => {
  it("connects verified tasks, both profiles, workloads, and fixture answers through public exports", () => {
    for (const profileId of profiles) {
      expect(checkCompatibility(profileId, capabilities).compatible).toBe(true);
      const workload = calculateWorkload(profileId, fixtures.length);
      expect(workload.logicalCalls).toBe(9);
      expect(workload.maxAttempts).toBe(18);
      let completed = 0;
      for (const fixture of fixtures) {
        const input = { expression: fixture.expression, domain: { min: "-1", max: "1" }, claimedLabel: fixture.label };
        for (let trial = 0; trial < getProfile(profileId).trialsPerInstance; trial++) {
          const prompt = buildPrompt(input, profileId);
          expect(prompt.messages.map((message) => message.role)).toEqual(["system", "user"]);
          const text = JSON.stringify({ label: fixture.label, explanation: fixture.explanation });
          const result = extractAnswer({ status: "completed", text }, prompt.profileId);
          expect(result).toEqual({
            protocolVersion: "1", profileId, rawText: text, kind: "answer",
            label: fixture.label, explanation: fixture.explanation,
          });
          completed++;
        }
      }
      expect(completed).toBe(workload.logicalCalls);
    }
  });

  it("retains wrong answers without silently grading, repairing, or retrying them", () => {
    const prompt = buildPrompt({ expression: square, domain: { min: "-1", max: "1" }, claimedLabel: "convex" }, "one-shot-json-v1");
    const rawText = '{"label":"concave","explanation":"A deliberately incorrect fixture answer."}';
    const result = extractAnswer({ status: "completed", text: rawText }, prompt.profileId);
    expect(result).toMatchObject({ kind: "answer", label: "concave", rawText });
    expect(Object.hasOwn(result, "correct")).toBe(false);
    expect(Object.hasOwn(result, "score")).toBe(false);
    expect(calculateWorkload(prompt.profileId, 1).logicalCalls).toBe(3);
  });

  it("separates unusable answers, noncompletion, and infrastructure errors", () => {
    const text = '{"label":"convex","explanation":"Complete-looking fixture content."}';
    for (const profileId of profiles) {
      expect(extractAnswer({ status: "completed", text: `Result: ${text}` }, profileId)).toMatchObject({ kind: "invalid", reason: "malformed-json" });
      for (const status of ["refused", "truncated", "interrupted", "cancelled"] as const) {
        const result = extractAnswer({ status, text }, profileId);
        expect(result.kind).toBe(status);
        expect(Object.hasOwn(result, "label")).toBe(false);
      }
      const failure = extractAnswer({ status: "provider-error", text, message: "The fixture service is unavailable." }, profileId);
      expect(failure.kind).toBe("provider-error");
      expect(Object.hasOwn(failure, "label")).toBe(false);
    }
  });

  it("reports schema incompatibility without switching the selected profile", () => {
    const evidence = { ...capabilities, jsonSchema: "unknown" as const };
    expect(checkCompatibility("one-shot-schema-v1", evidence)).toEqual({ compatible: false, unsupported: [], unverified: ["jsonSchema"] });
    expect(getProfile("one-shot-schema-v1").responseFormat.kind).toBe("json-schema");
    expect(checkCompatibility("one-shot-json-v1", evidence).compatible).toBe(true);
  });

  it("keeps fresh blueprints repeatable and free of conversation history", () => {
    const input = { expression: square, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
    const first = buildPrompt(input, "one-shot-json-v1");
    const second = buildPrompt(input, "one-shot-json-v1");
    expect(first).toEqual(second);
    expect(first.messages).not.toBe(second.messages);
    expect(first.messages).toHaveLength(2);
    expect(getProfile(first.profileId).conversation).toBe("fresh-per-trial");
    expect(getProfile(first.profileId).tools).toBe("none");
  });
});
