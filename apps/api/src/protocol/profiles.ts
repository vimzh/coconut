// Defines immutable evaluation profiles and checks their capability and workload bounds.
import type {
  AnswerSchema,
  Capability,
  CompatibilityResult,
  EvaluationProfile,
  ProfileId,
  Workload,
} from "./types";
import { ProtocolInputError, readDataRecord, requireFields } from "./validation";

export const PROTOCOL_VERSION = "1" as const;
export const MAX_EXPLANATION_CODE_POINTS = 4096;
export const MAX_RESPONSE_CODE_UNITS = 65536;

export const ANSWER_SCHEMA: AnswerSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({
    label: Object.freeze({
      type: "string",
      enum: Object.freeze(["convex", "concave", "neither"] as const),
    }),
    explanation: Object.freeze({ type: "string" }),
  }),
  required: Object.freeze(["label", "explanation"] as const),
  additionalProperties: false,
});

const capabilities = ["textInput", "textOutput", "outputTokenLimit", "jsonSchema"] as const;
const common = {
  protocolVersion: PROTOCOL_VERSION,
  method: "one-shot",
  trialsPerInstance: 3,
  maxInstances: 1000,
  maxOutputTokens: 4096,
  maxAttemptsPerTrial: 2,
  sampling: "provider-default",
  reasoning: "provider-default",
  conversation: "fresh-per-trial",
  tools: "none",
} as const;

const profiles: Readonly<Record<ProfileId, EvaluationProfile>> = Object.freeze({
  "one-shot-json-v1": Object.freeze({
    ...common,
    id: "one-shot-json-v1",
    requirements: Object.freeze(["textInput", "textOutput", "outputTokenLimit"] as const),
    responseFormat: Object.freeze({ kind: "prompted-json" }),
  }),
  "one-shot-schema-v1": Object.freeze({
    ...common,
    id: "one-shot-schema-v1",
    requirements: Object.freeze([...capabilities]),
    responseFormat: Object.freeze({
      kind: "json-schema",
      name: "classification_answer_v1",
      strict: true,
      schema: ANSWER_SCHEMA,
    }),
  }),
});

export function getProfile(profileId: unknown): EvaluationProfile {
  if (profileId !== "one-shot-json-v1" && profileId !== "one-shot-schema-v1") {
    throw new ProtocolInputError(
      "unknown-profile",
      "Use an explicit profile: one-shot-json-v1 or one-shot-schema-v1.",
    );
  }
  return profiles[profileId];
}

export function checkCompatibility(profileId: unknown, evidence: unknown): CompatibilityResult {
  const profile = getProfile(profileId);
  const record = readDataRecord(evidence, "Capability evidence");
  requireFields(record, capabilities);
  for (const capability of capabilities) {
    const state = record[capability];
    if (state !== "supported" && state !== "unsupported" && state !== "unknown") {
      throw new ProtocolInputError(
        "invalid-input",
        `Capability ${capability} must be supported, unsupported, or unknown.`,
      );
    }
  }

  const unsupported: Capability[] = [];
  const unverified: Capability[] = [];
  for (const capability of profile.requirements) {
    if (record[capability] === "unsupported") unsupported.push(capability);
    if (record[capability] === "unknown") unverified.push(capability);
  }
  return { compatible: unsupported.length === 0 && unverified.length === 0, unsupported, unverified };
}

export function calculateWorkload(profileId: unknown, instanceCount: unknown): Workload {
  const profile = getProfile(profileId);
  if (
    typeof instanceCount !== "number" ||
    !Number.isFinite(instanceCount) ||
    !Number.isInteger(instanceCount) ||
    instanceCount < 1
  ) {
    throw new ProtocolInputError("invalid-input", "Instance count must be a finite positive integer.");
  }
  if (instanceCount > profile.maxInstances) {
    throw new ProtocolInputError("workload-limit", `Instance count must not exceed ${profile.maxInstances}.`);
  }

  const logicalCalls = instanceCount * profile.trialsPerInstance;
  const maxAttempts = logicalCalls * profile.maxAttemptsPerTrial;
  return {
    protocolVersion: PROTOCOL_VERSION,
    profileId: profile.id,
    instanceCount,
    trialsPerInstance: profile.trialsPerInstance,
    logicalCalls,
    maxAttempts,
    maxOutputTokens: profile.maxOutputTokens,
    maxOutputTokensTotal: maxAttempts * profile.maxOutputTokens,
  };
}
