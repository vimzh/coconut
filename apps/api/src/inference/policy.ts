// Only canonical profile settings and two explicit messages reach inference adapters.
import { isDeepStrictEqual } from "node:util";
import { parseSelectionRequest } from "../discovery";
import { getProfile, type PromptBlueprint } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { freezeData } from "../suites/generator";
import type { InferenceRequest } from "./types";

export const INFERENCE_TIMEOUT_MS = 180_000;
export const INFERENCE_POLICY = freezeData({
  version: "1", policyId: "individual-inference-v1", metadataTimeoutMs: 20_000, inferenceTimeoutMs: INFERENCE_TIMEOUT_MS,
  maxInferenceRequests: 1, retries: 0, maxResponseBytes: 1_048_576, maxPromptBytes: 262_144,
  credentials: "current-foreground-operation-only", tools: "none", persistence: "none",
  uncertainty: "Cancellation, timeout, or a lost connection may leave remote work and charges unknown.",
});

export class InferenceInputError extends Error {
  constructor(readonly code: "invalid-input" | "charge-authorization-required" = "invalid-input") {
    super(code === "charge-authorization-required" ? "Inference requires explicit acknowledgement of provider charges." : "Supply an explicit metadata selection and the matching protocol-built prompt without extra fields or settings overrides.");
    this.name = "InferenceInputError";
  }
}

function copyData(input: unknown, depth = 0): unknown {
  if (depth > 12) throw new InferenceInputError();
  if (input === null || typeof input === "string" || typeof input === "boolean") return input;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (Array.isArray(input)) {
    if (Reflect.ownKeys(input).length !== input.length + 1 || input.length > 16) throw new InferenceInputError();
    return Array.from({ length: input.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (!descriptor || !("value" in descriptor)) throw new InferenceInputError();
      return copyData(descriptor.value, depth + 1);
    });
  }
  const record = readDataRecord(input, "Inference data");
  return Object.fromEntries(Object.keys(record).map((key) => [key, copyData(record[key], depth + 1)]));
}

export function parseInferenceRequest(input: unknown): InferenceRequest {
  try {
    const data = readDataRecord(input, "Inference request");
    requireFields(data, ["selection", "prompt", "acceptCharges"]);
    if (data.acceptCharges !== true) throw new InferenceInputError("charge-authorization-required");
    const selection = parseSelectionRequest(data.selection);
    if (selection.verification !== "metadata") throw new InferenceInputError();
    const prompt = readDataRecord(copyData(data.prompt), "Inference prompt");
    const fields = ["protocolVersion", "profileId", "messages", "responseFormat", "generation"];
    requireFields(prompt, Object.hasOwn(prompt, "promptVersion") ? [...fields, "promptVersion"] : fields);
    if (Object.hasOwn(prompt, "promptVersion") && prompt.promptVersion !== "smooth-v1" && prompt.promptVersion !== "smooth-v2") throw new InferenceInputError();
    const profile = getProfile(prompt.profileId);
    if (prompt.protocolVersion !== profile.protocolVersion || prompt.profileId !== selection.profileId) throw new InferenceInputError();
    const generation = { maxOutputTokens: profile.maxOutputTokens, sampling: profile.sampling, reasoning: profile.reasoning, tools: profile.tools };
    if (!isDeepStrictEqual(prompt.responseFormat, profile.responseFormat) || !isDeepStrictEqual(prompt.generation, generation)) throw new InferenceInputError();
    if (!Array.isArray(prompt.messages) || prompt.messages.length !== 2) throw new InferenceInputError();
    for (const [index, message] of prompt.messages.entries()) {
      const item = readDataRecord(message, "Inference message");
      requireFields(item, ["role", "content"]);
      if (item.role !== (index === 0 ? "system" : "user") || typeof item.content !== "string" || !item.content.isWellFormed() || item.content.trim() === "") throw new InferenceInputError();
    }
    if (Buffer.byteLength(JSON.stringify(prompt.messages), "utf8") > INFERENCE_POLICY.maxPromptBytes) throw new InferenceInputError();
    return freezeData({ selection, prompt: prompt as unknown as PromptBlueprint, acceptCharges: true });
  } catch (error) {
    throw new InferenceInputError(error instanceof InferenceInputError && error.code === "charge-authorization-required" ? error.code : "invalid-input");
  }
}
