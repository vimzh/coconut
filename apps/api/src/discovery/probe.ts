// Fixed profile checks retain completion and request-acceptance evidence without evaluation scores.
import { isDeepStrictEqual } from "node:util";
import { extractAnswer, getProfile } from "../protocol";
import { readDataRecord } from "../protocol/validation";
import { classifyHttpFailure } from "../providers/responses";
import { TransportFailure } from "../providers/transport";
import type { AccessFailureCode, ProviderPlan } from "../providers/types";
import type { ModelMetadata, ProfileProbe, SelectionRequest } from "./types";

type Data = Record<string, unknown>;
function object(input: unknown): Data | null {
  try { return readDataRecord(input, "Profile probe"); } catch { return null; }
}
function identifier(input: unknown): string | null {
  return typeof input === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,255}$/.test(input) ? input : null;
}
function count(input: unknown): number | null {
  return typeof input === "number" && Number.isSafeInteger(input) && input >= 0 ? input : null;
}

export function buildProfileProbe(request: SelectionRequest, metadata: ModelMetadata): ProviderPlan {
  const profile = getProfile(request.profileId);
  if (request.verification !== "probe" || request.acceptCharges !== true || metadata.modelId !== request.modelId
    || metadata.servingProvider !== request.servingProvider || !metadata.exactRoute) throw new TransportFailure("invalid-provider-response");
  const prompt = "This is a compatibility check. Return exactly {\"label\":\"convex\",\"explanation\":\"Compatibility check.\"}. Do not solve a mathematical problem or add other content.";
  const native = profile.responseFormat.kind === "json-schema" ? {
    type: "json_schema", name: profile.responseFormat.name, strict: profile.responseFormat.strict, schema: profile.responseFormat.schema,
  } : null;
  if (request.provider === "openai") {
    return { url: "https://api.openai.com/v1/responses", method: "POST", body: JSON.stringify({
      model: request.modelId, input: `${prompt}${native ? " Use the supplied response schema." : " Return only the JSON object."}`,
      max_output_tokens: profile.maxOutputTokens, store: false, ...(native ? { text: { format: native } } : {}),
    }) };
  }
  const tokenParameter = metadata.tokenParameter;
  if ((tokenParameter !== "max_tokens" && tokenParameter !== "max_completion_tokens")
    || (native !== null && metadata.structuredOutput !== "advertised")) throw new TransportFailure("invalid-provider-response");
  const common = {
    messages: [{ role: "user", content: `${prompt}${native ? " Use the supplied response schema." : " Return only the JSON object."}` }],
    stream: false, [tokenParameter]: profile.maxOutputTokens,
    ...(native ? { response_format: { type: "json_schema", json_schema: { name: native.name, strict: native.strict, schema: native.schema } } } : {}),
  };
  if (request.provider === "openrouter") {
    return { url: "https://openrouter.ai/api/v1/chat/completions", method: "POST", body: JSON.stringify({
      ...common, model: request.modelId,
      provider: { only: [request.servingProvider], allow_fallbacks: false, require_parameters: true }, plugins: [{ id: "web", enabled: false }],
    }) };
  }
  return { url: "https://router.huggingface.co/v1/chat/completions", method: "POST", body: JSON.stringify({
    ...common, model: `${request.modelId}:${request.servingProvider}`,
  }) };
}

export function parseProfileProbe(input: unknown, request: SelectionRequest, metadata: ModelMetadata): { probe: ProfileProbe; failure: AccessFailureCode | null } {
  const body = object(input);
  const usage = object(body?.usage);
  const identity = {
    reportedModelId: identifier(body?.model),
    reportedServingProvider: identifier(body?.provider),
    usage: {
      inputTokens: count(usage?.[request.provider === "openai" ? "input_tokens" : "prompt_tokens"]),
      outputTokens: count(usage?.[request.provider === "openai" ? "output_tokens" : "completion_tokens"]),
    },
  };
  const failed = (failure: AccessFailureCode, outcome: string = failure): { probe: ProfileProbe; failure: AccessFailureCode } => ({
    probe: { ...identity, status: "not-verified", outputLimitRequestAccepted: false, nativeSchemaRequestAccepted: false, outcome }, failure,
  });
  if (!body) return failed("invalid-provider-response");
  if (body.error !== undefined && body.error !== null) return failed(classifyHttpFailure(200, body, true));
  if (identity.reportedModelId === null) return failed("invalid-provider-response");
  if (identity.usage.outputTokens !== null && identity.usage.outputTokens > getProfile(request.profileId).maxOutputTokens) return failed("invalid-provider-response", "output-limit-exceeded");
  let text: string;
  if (request.provider === "openai") {
    if (body.status !== "completed" || (body.incomplete_details !== undefined && body.incomplete_details !== null)) return failed("output-incomplete");
    if (!Array.isArray(body.output)) return failed("invalid-provider-response");
    // Provider-default reasoning may add bookkeeping items; it cannot replace assistant text.
    const outputs = body.output.map(object);
    if (outputs.some((item) => item === null || (item.type !== "reasoning" && item.type !== "message"))) return failed("invalid-provider-response");
    const messages = outputs.filter((item) => item?.type === "message");
    if (messages.length !== 1) return failed(messages.length === 0 ? "no-output" : "invalid-provider-response");
    const message = messages[0]!;
    if (message.role !== "assistant" || message.status !== "completed") return failed("output-incomplete");
    if (!Array.isArray(message.content) || message.content.length === 0) return failed("no-output");
    const parts = message.content.map(object);
    if (parts.some((part) => part?.type === "refusal")) return failed("no-output", "refused");
    if (parts.some((part) => part?.type !== "output_text" || typeof part.text !== "string")) return failed("invalid-provider-response");
    text = parts.map((part) => part!.text as string).join("");
  } else {
    if (!Array.isArray(body.choices) || body.choices.length !== 1) return failed("invalid-provider-response");
    const choice = object(body.choices[0]);
    if (!choice || (choice.error !== undefined && choice.error !== null)) return failed("invalid-provider-response");
    if (choice.finish_reason !== "stop" && !(request.provider === "hugging-face" && choice.finish_reason === "eos_token")) return failed("output-incomplete");
    const message = object(choice.message);
    if (!message || message.role !== "assistant") return failed("invalid-provider-response");
    if (message.refusal !== undefined && message.refusal !== null) return failed("no-output", "refused");
    if ((message.tool_calls !== undefined && (!Array.isArray(message.tool_calls) || message.tool_calls.length !== 0))
      || (message.function_call !== undefined && message.function_call !== null)) return failed("invalid-provider-response");
    if (typeof message.content !== "string") return failed("no-output");
    text = message.content;
  }
  const answer = extractAnswer({ status: "completed", text }, request.profileId);
  if (answer.kind !== "answer") return failed(answer.kind === "invalid" && answer.reason === "empty" ? "no-output" : "invalid-provider-response", answer.kind === "invalid" ? answer.reason : answer.kind);
  const profile = getProfile(request.profileId);
  const outputLimitRequestAccepted = request.provider === "openai" ? body.max_output_tokens === profile.maxOutputTokens
    : metadata.tokenParameter === "max_tokens" || metadata.tokenParameter === "max_completion_tokens";
  let nativeSchemaRequestAccepted = false;
  if (profile.responseFormat.kind === "json-schema") {
    if (request.provider === "openai") {
      const format = object(object(body.text)?.format);
      nativeSchemaRequestAccepted = format?.type === "json_schema" && format.name === profile.responseFormat.name
        && format.strict === true && isDeepStrictEqual(format.schema, profile.responseFormat.schema);
    } else nativeSchemaRequestAccepted = metadata.structuredOutput === "advertised";
  }
  return {
    probe: { ...identity, status: "verified", outputLimitRequestAccepted, nativeSchemaRequestAccepted, outcome: "answer" }, failure: null,
  };
}
