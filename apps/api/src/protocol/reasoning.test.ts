// Versioned reasoning profiles preserve legacy contracts and keep workload accounting explicit.
import { describe, expect, it } from "bun:test";
import { ANSWER_SCHEMA, buildPrompt, calculateWorkload, getProfile, listProfiles, ProtocolInputError } from "./index";

const efforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const reference = {
  expression: { op: "square", arg: { op: "variable" } },
  domain: { min: "-1", max: "1" }, claimedLabel: "convex",
};

describe("explicit reasoning profile extension", () => {
  it("enumerates exactly the two legacy and fourteen explicit immutable profiles", () => {
    const profiles = listProfiles();
    expect(profiles.map(({ id }) => id)).toEqual([
      "one-shot-json-v1", "one-shot-schema-v1",
      ...efforts.flatMap((effort) => [`one-shot-json-v2-${effort}` as const, `one-shot-schema-v2-${effort}` as const]),
    ]);
    expect(new Set(profiles.map(({ id }) => id)).size).toBe(16);
    expect(Object.isFrozen(profiles)).toBe(true);
    expect(Reflect.set(profiles, "0", null)).toBe(false);
    for (const profile of profiles) {
      expect(getProfile(profile.id)).toBe(profile);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.requirements)).toBe(true);
      expect(Object.isFrozen(profile.responseFormat)).toBe(true);
      expect(Reflect.set(profile, "reasoning", "high")).toBe(false);
    }
  });

  it("changes only profile identity, explicit effort, and output cap from each legacy format", () => {
    for (const effort of efforts) for (const format of ["json", "schema"] as const) {
      const legacy = getProfile(`one-shot-${format}-v1`);
      const id = `one-shot-${format}-v2-${effort}` as const;
      expect(getProfile(id)).toEqual({ ...legacy, id, reasoning: effort, maxOutputTokens: 16384 });
      expect(getProfile(id).responseFormat).toBe(legacy.responseFormat);
      expect(getProfile(id).requirements).toBe(legacy.requirements);
      expect(legacy.reasoning).toBe("provider-default");
      expect(legacy.maxOutputTokens).toBe(4096);
      const prompt = buildPrompt(reference, id);
      expect(prompt.messages).toEqual(buildPrompt(reference, legacy.id).messages);
      expect(prompt.generation).toEqual({ maxOutputTokens: 16384, reasoning: effort, sampling: "provider-default", tools: "none" });
      if (prompt.responseFormat.kind === "json-schema") expect(prompt.responseFormat.schema).toBe(ANSWER_SCHEMA);
    }
  });

  it("retains the trial and attempt ceilings while using the selected cap in workload totals", () => {
    for (const profile of listProfiles()) {
      expect(calculateWorkload(profile.id, 1000)).toEqual({
        protocolVersion: "1", profileId: profile.id, instanceCount: 1000, trialsPerInstance: 3,
        logicalCalls: 3000, maxAttempts: 6000, maxOutputTokens: profile.maxOutputTokens,
        maxOutputTokensTotal: 6000 * profile.maxOutputTokens,
      });
      expect(() => calculateWorkload(profile.id, 1001)).toThrow(ProtocolInputError);
    }
  });

  it("rejects unregistered efforts, partial identifiers, and coercible values", () => {
    for (const id of ["one-shot-json-v2", "one-shot-json-v2-default", "one-shot-json-v2-provider-default", "one-shot-json-v2-HIGH", "one-shot-schema-v2-ultra", "one-shot-json-v2-high ", "constructor", "__proto__", { toString: () => "one-shot-json-v2-high" }]) {
      expect(() => getProfile(id)).toThrow(ProtocolInputError);
    }
  });
});
