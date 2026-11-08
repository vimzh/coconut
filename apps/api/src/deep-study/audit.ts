// Replay retained success and failure evidence before either can affect research denominators.
import { isDeepStrictEqual } from "node:util";
import type { ModelMetadata } from "../discovery";
import { parseInferenceResponse } from "../inference/adapters";
import type { NormalizedInference } from "../inference/types";
import { extractAnswer } from "../protocol";
import { readDataRecord } from "../protocol/validation";
import { classifyHttpFailure, FAILURE_MESSAGES } from "../providers/responses";
import { DEEP_MODELS, DEEP_SETTINGS, type DeepAttempt, type DeepModelId } from "./transport";

const instant = (value: string) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function invalid(): never { throw new Error("Retained research success or failure cannot be replayed from its original provider evidence."); }

function executionFailure(normalized: NormalizedInference, effort: string) {
  if (normalized.failure) return normalized.failure;
  return normalized.effective.maxOutputTokens !== DEEP_SETTINGS.maxOutputTokens || normalized.effective.reasoningEffort !== effort
    || normalized.effective.truncation !== "disabled" || normalized.reply.text.length > DEEP_SETTINGS.maxVisibleCodeUnits ? "invalid-provider-response" : null;
}

export function assertAttemptReplay(result: DeepAttempt, modelId: DeepModelId, metadata: ModelMetadata): void {
  const selected = DEEP_MODELS.find(model => model.modelId === modelId);
  if (!selected || metadata.modelId !== modelId || metadata.servingProvider !== null || metadata.exactRoute !== true
    || result.methodId !== DEEP_SETTINGS.methodId || result.inferenceTimeoutMs !== DEEP_SETTINGS.inferenceTimeoutMs
    || !instant(result.startedAt) || !instant(result.finishedAt) || Date.parse(result.finishedAt) < Date.parse(result.startedAt)
    || ![0, 1].includes(result.inferenceRequests) || result.rawResponse === undefined
    || result.httpStatus !== null && (!Number.isSafeInteger(result.httpStatus) || result.httpStatus < 200 || result.httpStatus > 599)) invalid();
  const { httpStatus: status, rawResponse: raw, normalized } = result;
  if ((status !== null || raw !== null || normalized !== null) && result.inferenceRequests !== 1
    || (raw !== null || normalized !== null) && status === null || normalized !== null && raw === null) invalid();
  const replayed = raw === null ? null : parseInferenceResponse(raw, { selection: { provider: "openai" },
    prompt: { responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: DEEP_SETTINGS.maxOutputTokens } } }, metadata);
  if (normalized !== null && !isDeepStrictEqual(normalized, replayed)) invalid();
  const profile = `one-shot-json-v2-${selected.reasoningEffort}` as const;
  if (result.failure === null) {
    if (result.inferenceRequests !== 1 || status === null || status < 200 || status >= 300 || normalized === null
      || executionFailure(normalized, selected.reasoningEffort) !== null || !isDeepStrictEqual(result.outcome, extractAnswer(normalized.reply, profile))) invalid();
    return;
  }
  const failure = readDataRecord(result.failure, "Retained research failure");
  if (Object.keys(failure).length !== 2 || typeof failure.code !== "string" || !Object.hasOwn(FAILURE_MESSAGES, failure.code)
    || !["not-sent", "unknown", "response-received"].includes(failure.remoteOutcome as string)) invalid();
  const code = failure.code;
  const remoteOutcome = result.inferenceRequests === 0 ? "not-sent" : status === null || ["timeout", "cancelled", "network-error"].includes(code) ? "unknown" : "response-received";
  if (failure.remoteOutcome !== remoteOutcome || !isDeepStrictEqual(result.outcome, extractAnswer(code === "cancelled" ? { status: "cancelled", text: "" }
    : { status: "provider-error", text: "", message: code }, profile))) invalid();

  if (code === "timeout" || code === "cancelled") {
    // Allow one second of wall-clock skew around the monotonic deadline; an earlier timeout needs additional evidence.
    if (code === "timeout" && Date.parse(result.finishedAt) - Date.parse(result.startedAt) < DEEP_SETTINGS.inferenceTimeoutMs - 1000) invalid();
    if (normalized !== null && executionFailure(normalized, selected.reasoningEffort) !== null) invalid();
    return;
  }
  if (code === "network-error") {
    if (status !== null || raw !== null || normalized !== null) invalid();
    return;
  }
  if (code === "credential-reflection" || code === "response-too-large" && raw === null) {
    if (status === null || raw !== null || normalized !== null) invalid();
    return;
  }
  if (code === "redirect-blocked") {
    if (status === null || status < 300 || status >= 400 || normalized !== null) invalid();
    return;
  }
  if (status === null) {
    if (code !== "invalid-provider-response" || result.inferenceRequests !== 0 || raw !== null || normalized !== null) invalid();
    return;
  }
  if (normalized !== null) {
    if (status >= 300 || executionFailure(normalized, selected.reasoningEffort) !== code) invalid();
    return;
  }
  // A failed read or malformed JSON has no normalized evidence; a completed JSON object must be replayed.
  if (code === "invalid-provider-response" && (raw === null || typeof raw === "string" && (status < 300 || status >= 400))) return;
  if (status >= 400 && raw !== null && code === classifyHttpFailure(status, raw, true)) return;
  invalid();
}
