import { describe, expect, it } from "bun:test";
import {
  ANSWER_SCHEMA,
  calculateWorkload,
  checkCompatibility,
  getProfile,
  MAX_EXPLANATION_CODE_POINTS,
  MAX_RESPONSE_CODE_UNITS,
  PROTOCOL_VERSION,
} from "./profiles";
import type { Capability, CapabilityEvidence, ProfileId } from "./types";
import { ProtocolInputError, type ProtocolErrorCode } from "./validation";

const profileIds: readonly ProfileId[] = ["one-shot-json-v1", "one-shot-schema-v1"];
const capabilities: readonly Capability[] = ["textInput", "textOutput", "outputTokenLimit", "jsonSchema"];
const supported: CapabilityEvidence = {
  textInput: "supported", textOutput: "supported", outputTokenLimit: "supported", jsonSchema: "supported",
};

function expectProtocolError(run: () => unknown, code: ProtocolErrorCode) {
  let failure: unknown;
  try {
    run();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ProtocolInputError);
  expect((failure as ProtocolInputError).code).toBe(code);
}

function checkFrozenTree(value: object) {
  expect(Object.isFrozen(value)).toBe(true);
  expect(Reflect.set(value, "injected", true)).toBe(false);
  for (const [key, child] of Object.entries(value)) {
    expect(Reflect.set(value, key, null)).toBe(false);
    if (child !== null && typeof child === "object") checkFrozenTree(child);
  }
}

describe("evaluation profiles", () => {
  it("fixes version and local response bounds", () => {
    expect(PROTOCOL_VERSION).toBe("1");
    expect(MAX_EXPLANATION_CODE_POINTS).toBe(4096);
    expect(MAX_RESPONSE_CODE_UNITS).toBe(65536);
  });

  it("defines only the common structural answer schema", () => {
    expect(ANSWER_SCHEMA).toEqual({
      type: "object",
      properties: {
        label: { type: "string", enum: ["convex", "concave", "neither"] },
        explanation: { type: "string" },
      },
      required: ["label", "explanation"],
      additionalProperties: false,
    });
  });

  it("shares fixed method and per-profile budgets", () => {
    for (const id of profileIds) {
      expect(getProfile(id)).toMatchObject({
        id,
        protocolVersion: "1",
        method: "one-shot",
        trialsPerInstance: 3,
        maxInstances: 1000,
        maxOutputTokens: 4096,
        maxAttemptsPerTrial: 2,
        sampling: "provider-default",
        reasoning: "provider-default",
        conversation: "fresh-per-trial",
        tools: "none",
      });
    }
  });

  it("uses prompted JSON without requiring provider schema support", () => {
    expect(getProfile("one-shot-json-v1").responseFormat).toEqual({ kind: "prompted-json" });
    expect(getProfile("one-shot-json-v1").requirements).toEqual([
      "textInput", "textOutput", "outputTokenLimit",
    ]);
  });

  it("requires strict schema enforcement for the schema profile", () => {
    const profile = getProfile("one-shot-schema-v1");
    expect(profile.requirements).toEqual(capabilities);
    expect(profile.responseFormat).toEqual({
      kind: "json-schema", name: "classification_answer_v1", strict: true, schema: ANSWER_SCHEMA,
    });
    if (profile.responseFormat.kind !== "json-schema") throw new Error("Expected schema profile.");
    expect(profile.responseFormat.schema).toBe(ANSWER_SCHEMA);
  });

  it("prevents nested mutations from changing later profile or schema lookups", () => {
    const before = profileIds.map((id) => structuredClone(getProfile(id)));
    checkFrozenTree(ANSWER_SCHEMA);
    for (const id of profileIds) checkFrozenTree(getProfile(id));
    expect(profileIds.map((id) => getProfile(id))).toEqual(before);
    expect(getProfile("one-shot-schema-v1")).toBe(getProfile("one-shot-schema-v1"));
  });

  it("rejects unknown profile identities without coercion or a default", () => {
    const coercible = { toString: () => { throw new Error("Must not coerce profile IDs."); } };
    for (const id of [undefined, null, "", "one-shot-json-v2", "constructor", "__proto__", 1, [], coercible, Symbol()]) {
      expectProtocolError(() => getProfile(id), "unknown-profile");
    }
    expectProtocolError(() => checkCompatibility("missing", supported), "unknown-profile");
    expectProtocolError(() => calculateWorkload("missing", 1), "unknown-profile");
  });
});

describe("capability compatibility", () => {
  it("accepts fully supported evidence for both profiles", () => {
    for (const id of profileIds) {
      expect(checkCompatibility(id, supported)).toEqual({ compatible: true, unsupported: [], unverified: [] });
    }
  });

  it("distinguishes every required unknown capability from confirmed unsupported", () => {
    for (const id of profileIds) {
      for (const capability of getProfile(id).requirements) {
        expect(checkCompatibility(id, { ...supported, [capability]: "unknown" })).toEqual({
          compatible: false, unsupported: [], unverified: [capability],
        });
        expect(checkCompatibility(id, { ...supported, [capability]: "unsupported" })).toEqual({
          compatible: false, unsupported: [capability], unverified: [],
        });
      }
    }
  });

  it("reports unsupported and unknown capabilities together in requirement order", () => {
    expect(checkCompatibility("one-shot-schema-v1", {
      textInput: "unknown", textOutput: "unsupported", outputTokenLimit: "unknown", jsonSchema: "unsupported",
    })).toEqual({
      compatible: false, unsupported: ["textOutput", "jsonSchema"], unverified: ["textInput", "outputTokenLimit"],
    });
  });

  it("allows unknown or unsupported schema support for ordinary text requests", () => {
    for (const jsonSchema of ["unknown", "unsupported"]) {
      expect(checkCompatibility("one-shot-json-v1", { ...supported, jsonSchema })).toEqual({
        compatible: true, unsupported: [], unverified: [],
      });
    }
  });

  it("requires all four capability fields even for ordinary text requests", () => {
    for (const capability of capabilities) {
      const evidence: Record<string, unknown> = { ...supported };
      delete evidence[capability];
      expectProtocolError(() => checkCompatibility("one-shot-json-v1", evidence), "invalid-input");
    }
  });

  it("rejects invalid states including the nonrequired schema capability", () => {
    for (const capability of capabilities) {
      for (const state of [undefined, null, true, 1, "SUPPORTED", "available", {}, ["supported"]]) {
        expectProtocolError(
          () => checkCompatibility("one-shot-json-v1", { ...supported, [capability]: state }),
          "invalid-input",
        );
      }
    }
  });

  it("accepts plain data objects with a null prototype", () => {
    expect(checkCompatibility("one-shot-schema-v1", Object.assign(Object.create(null), supported))).toEqual({
      compatible: true, unsupported: [], unverified: [],
    });
  });

  it("rejects malformed records, extra fields, symbols, and non-enumerable extras", () => {
    const hiddenExtra = Object.defineProperty({ ...supported }, "extra", { value: "supported" });
    for (const evidence of [
      undefined, null, [], "supported", 1, new Map(), Object.create(supported),
      { ...supported, extra: "supported" }, { ...supported, [Symbol("extra")]: "supported" }, hiddenExtra,
    ]) {
      expectProtocolError(() => checkCompatibility("one-shot-json-v1", evidence), "invalid-input");
    }
  });

  it("rejects accessor fields without invoking their getters", () => {
    let reads = 0;
    const evidence = Object.defineProperty({ ...supported }, "textInput", {
      get: () => { reads++; throw new Error("Must not invoke capability getters."); },
    });
    expectProtocolError(() => checkCompatibility("one-shot-json-v1", evidence), "invalid-input");
    expect(reads).toBe(0);
  });
});

describe("workload limits", () => {
  it("budgets three logical trials and both permitted attempts per selected profile", () => {
    for (const id of profileIds) {
      expect(calculateWorkload(id, 100)).toEqual({
        protocolVersion: "1", profileId: id, instanceCount: 100, trialsPerInstance: 3,
        logicalCalls: 300, maxAttempts: 600, maxOutputTokens: 4096, maxOutputTokensTotal: 2457600,
      });
    }
  });

  it("accepts the minimum and maximum instance counts without doubling profile work", () => {
    for (const id of profileIds) {
      expect(calculateWorkload(id, 1)).toMatchObject({ logicalCalls: 3, maxAttempts: 6, maxOutputTokensTotal: 24576 });
      expect(calculateWorkload(id, 1000)).toMatchObject({
        logicalCalls: 3000, maxAttempts: 6000, maxOutputTokensTotal: 24576000,
      });
    }
  });

  it("rejects nonnumeric, nonfinite, noninteger, and nonpositive counts", () => {
    for (const count of [
      undefined, null, "100", true, {}, [], NaN, Infinity, -Infinity, 0, -0, -1, -1000,
      -Number.MAX_SAFE_INTEGER, 0.5, 1.5, 1000.5,
    ]) {
      expectProtocolError(() => calculateWorkload("one-shot-json-v1", count), "invalid-input");
    }
  });

  it("rejects every integer above the suite limit before doing workload arithmetic", () => {
    for (const count of [1001, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE]) {
      expectProtocolError(() => calculateWorkload("one-shot-schema-v1", count), "workload-limit");
    }
  });
});
