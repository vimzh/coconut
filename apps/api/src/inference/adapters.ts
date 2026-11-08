// Fixed inference plans and narrow, provider-reported execution evidence.
import { isDeepStrictEqual } from "node:util";
import type { ModelMetadata } from "../discovery";
import type { ModelReply } from "../protocol";
import { readDataRecord } from "../protocol/validation";
import { classifyHttpFailure, FAILURE_MESSAGES } from "../providers/responses";
import { TransportFailure } from "../providers/transport";
import type { AccessFailureCode, ProviderPlan } from "../providers/types";
import type { AttemptUsage, CostEvidence, TokenField } from "../scoring/types";
import { MAX_RETAINED_REPLY_CODE_UNITS } from "../scoring/validation";
import type { InferenceRequest, NormalizedInference } from "./types";

type Data = Record<string, unknown>;
export interface InferenceResponseContext {
  readonly selection: Pick<InferenceRequest["selection"], "provider">;
  readonly prompt: {
    readonly responseFormat: InferenceRequest["prompt"]["responseFormat"];
    readonly generation: { readonly maxOutputTokens: number };
  };
}
function object(input: unknown): Data | null {
  try { return readDataRecord(input, "Inference response"); } catch { return null; }
}
function identifier(input: unknown): string | null {
  return typeof input === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,255}$/.test(input) ? input : null;
}
function count(input: unknown): number | null {
  return typeof input === "number" && Number.isSafeInteger(input) && input >= 0 ? input : null;
}

export function buildInferencePlan(request: InferenceRequest, metadata: ModelMetadata): ProviderPlan {
  const { selection, prompt } = request;
  if (request.acceptCharges !== true || selection.verification !== "metadata" || selection.profileId !== prompt.profileId
    || metadata.modelId !== selection.modelId || metadata.servingProvider !== selection.servingProvider || !metadata.exactRoute) {
    throw new TransportFailure("invalid-provider-response");
  }
  const format = prompt.responseFormat;
  const native = format.kind === "json-schema" ? { type: "json_schema", name: format.name, strict: format.strict, schema: format.schema } : null;
  const messages = prompt.messages.map(({ role, content }) => ({ role, content }));
  if (selection.provider === "openai") {
    return { url: "https://api.openai.com/v1/responses", method: "POST", body: JSON.stringify({
      model: selection.modelId, input: messages, max_output_tokens: prompt.generation.maxOutputTokens,
      store: false, truncation: "disabled",
      ...(prompt.generation.reasoning !== "provider-default" ? { reasoning: { effort: prompt.generation.reasoning } } : {}),
      ...(native ? { text: { format: native } } : {}),
    }) };
  }
  const tokenParameter = metadata.tokenParameter;
  if (selection.servingProvider === null || prompt.generation.reasoning !== "provider-default"
    || (tokenParameter !== "max_tokens" && tokenParameter !== "max_completion_tokens")
    || (native !== null && metadata.structuredOutput !== "advertised")) throw new TransportFailure("invalid-provider-response");
  const common = {
    messages, stream: false, [tokenParameter]: prompt.generation.maxOutputTokens,
    ...(native ? { response_format: { type: "json_schema", json_schema: { name: native.name, strict: native.strict, schema: native.schema } } } : {}),
  };
  return selection.provider === "openrouter"
    ? { url: "https://openrouter.ai/api/v1/chat/completions", method: "POST", body: JSON.stringify({
      ...common, model: selection.modelId,
      provider: { only: [selection.servingProvider], allow_fallbacks: false, require_parameters: true }, plugins: [{ id: "web", enabled: false }],
    }) }
    : { url: "https://router.huggingface.co/v1/chat/completions", method: "POST", body: JSON.stringify({
      ...common, model: `${selection.modelId}:${selection.servingProvider}`,
    }) };
}

function parseUsage(body: Data, request: InferenceResponseContext): { usage: AttemptUsage; invalid: boolean } {
  const provider = request.selection.provider;
  const source = object(body.usage);
  const openai = provider === "openai";
  const inputName = openai ? "input_tokens" : "prompt_tokens";
  const outputName = openai ? "output_tokens" : "completion_tokens";
  const detailsName = openai ? "output_tokens_details" : "completion_tokens_details";
  const details = object(source?.[detailsName]);
  let invalid = body.usage != null && source === null || source?.[detailsName] != null && details === null;
  const token = (value: unknown, semantics: string): TokenField | null => {
    if (value == null) return null;
    const parsed = count(value);
    if (parsed === null) { invalid = true; return null; }
    return { count: parsed, semantics };
  };
  const usage: AttemptUsage = {
    input: token(source?.[inputName], `${provider}.${inputName}`),
    output: token(source?.[outputName], `${provider}.${outputName} (${provider === "hugging-face" ? "provider-reported; reasoning inclusion unspecified" : "includes reported reasoning tokens"})`),
    reasoning: token(details?.reasoning_tokens, `${provider}.${detailsName}.reasoning_tokens (subset of output)`),
  };
  const total = token(source?.total_tokens, `${provider}.total_tokens`);
  if ((usage.output !== null && usage.output.count > request.prompt.generation.maxOutputTokens)
    || (usage.reasoning !== null && usage.output !== null && usage.reasoning.count > usage.output.count)
    || (total !== null && [usage.input, usage.output].some((part) => part !== null && part.count > total.count))
    || (total !== null && usage.input !== null && usage.output !== null && total.count !== usage.input.count + usage.output.count)) invalid = true;
  return { usage, invalid };
}

function billedCost(value: unknown): CostEvidence | null {
  if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) return null;
  let amount = String(value);
  // JSON numbers may use exponent notation; retained billing evidence uses plain decimals.
  const exponent = /^(\d+)(?:\.(\d+))?e([+-]?\d+)$/.exec(amount);
  if (exponent && typeof value === "number") {
    const digits = exponent[1]! + (exponent[2] ?? "");
    const position = exponent[1]!.length + Number(exponent[3]);
    if (Math.abs(position) > 64) return null;
    amount = position <= 0 ? `0.${"0".repeat(-position)}${digits}` : position >= digits.length
      ? digits + "0".repeat(position - digits.length) : `${digits.slice(0, position)}.${digits.slice(position)}`;
  }
  return amount.length <= 64 && /^(0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)
    ? { kind: "billed", currency: "USD", amount } : null;
}

function effectiveSettings(body: Data, request: InferenceResponseContext, metadata: ModelMetadata): NormalizedInference["effective"] {
  const openai = request.selection.provider === "openai";
  const cap = count(body[openai ? "max_output_tokens" : metadata.tokenParameter ?? "max_tokens"]);
  const reasoning = object(body.reasoning)?.effort;
  const format = object(openai ? object(body.text)?.format : body.response_format);
  const schema = openai ? format : object(format?.json_schema);
  const selected = request.prompt.responseFormat;
  return {
    maxOutputTokens: cap !== null && cap > 0 ? cap : null,
    reasoningEffort: typeof reasoning === "string" && ["none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(reasoning) ? reasoning : null,
    truncation: body.truncation === "disabled" || body.truncation === "auto" ? body.truncation : null,
    nativeSchemaAccepted: selected.kind !== "json-schema" || format === null ? null
      : format.type === "json_schema" && schema?.name === selected.name && schema.strict === true && isDeepStrictEqual(schema.schema, selected.schema),
  };
}

function providerFailure(error: unknown): AccessFailureCode {
  const code = object(error)?.code;
  const status = typeof code === "number" && Number.isInteger(code) && code >= 400 && code <= 599 ? code : 200;
  return classifyHttpFailure(status, { error }, true);
}

export function parseInferenceResponse(input: unknown, request: InferenceResponseContext, metadata: ModelMetadata): NormalizedInference {
  const body = object(input);
  const parsedUsage = parseUsage(body ?? {}, request);
  const effective = effectiveSettings(body ?? {}, request, metadata);
  const identity = {
    reportedModelId: identifier(body?.model), reportedServingProvider: identifier(body?.provider),
    usage: parsedUsage.usage,
    cost: request.selection.provider === "openrouter" ? billedCost(object(body?.usage)?.cost) : null,
    effective,
  };
  const result = (reply: ModelReply, finishReason: string | null, failure: AccessFailureCode | null = null): NormalizedInference => reply.text.length > MAX_RETAINED_REPLY_CODE_UNITS
    ? { ...identity, reply: { status: "provider-error", text: "", message: FAILURE_MESSAGES["response-too-large"] }, finishReason: "response-discarded-size-limit", failure: "response-too-large" }
    : { ...identity, reply, finishReason, failure };
  const failed = (code: AccessFailureCode, text = "", finishReason: string | null = null) => result({ status: "provider-error", text, message: FAILURE_MESSAGES[code] }, finishReason, code);
  if (body === null) return failed("invalid-provider-response");
  if (body.error != null) return failed(providerFailure(body.error));
  if (parsedUsage.invalid) return failed("invalid-provider-response");
  if ((effective.maxOutputTokens !== null && effective.maxOutputTokens !== request.prompt.generation.maxOutputTokens)
    || effective.truncation === "auto" || effective.nativeSchemaAccepted === false) return failed("invalid-provider-response");

  if (request.selection.provider === "openai") {
    if (body.status === "failed") return failed("service-unavailable");
    if (!Array.isArray(body.output)) return failed("invalid-provider-response");
    // Reasoning items can contain hidden traces; only assistant-visible message content survives.
    const outputs = body.output.map(object);
    if (outputs.some((item) => item === null || (item.type !== "reasoning" && item.type !== "message"))) return failed("invalid-provider-response");
    const messages = outputs.filter((item) => item?.type === "message");
    if (messages.length > 1) return failed("invalid-provider-response");
    const message = messages[0];
    let text = "";
    let refused = false;
    if (message) {
      if (message.role !== "assistant" || !Array.isArray(message.content)) return failed("invalid-provider-response");
      const parts = message.content.map(object);
      if (parts.some((part) => part === null || (part.type !== "output_text" && part.type !== "refusal")
        || typeof part[part.type === "refusal" ? "refusal" : "text"] !== "string")) return failed("invalid-provider-response");
      text = parts.map((part) => part![part!.type === "refusal" ? "refusal" : "text"] as string).join("");
      refused = parts.some((part) => part?.type === "refusal");
    }
    const reason = object(body.incomplete_details)?.reason;
    if (body.status === "completed") {
      if (body.incomplete_details != null || (message && message.status !== "completed")) return failed("invalid-provider-response", text);
      if (!message) return failed("no-output");
      return result({ status: refused ? "refused" : "completed", text }, refused ? "refusal" : "completed");
    }
    if (refused || reason === "content_filter") return result({ status: "refused", text }, refused ? "refusal" : "content_filter");
    if (body.status === "incomplete" && reason === "max_output_tokens") return result({ status: "truncated", text }, "max_output_tokens");
    if (body.status === "cancelled") return result({ status: "cancelled", text }, "cancelled");
    if (["incomplete", "in_progress", "queued"].includes(body.status as string)) return result({ status: "interrupted", text }, body.status as string);
    return failed("invalid-provider-response", text);
  }

  if (!Array.isArray(body.choices) || body.choices.length !== 1) return failed("invalid-provider-response");
  const choice = object(body.choices[0]);
  const message = object(choice?.message);
  if (choice?.error != null) return failed(providerFailure(choice.error), message?.role === "assistant" && typeof message.content === "string" ? message.content : "", "error");
  if (!choice || !message || message.role !== "assistant") return failed("invalid-provider-response");
  if ((message.tool_calls != null && (!Array.isArray(message.tool_calls) || message.tool_calls.length !== 0))
    || message.function_call != null || message.audio != null || (message.content != null && typeof message.content !== "string")
    || (message.refusal != null && typeof message.refusal !== "string")) return failed("invalid-provider-response");
  const text = typeof message.content === "string" ? message.content : typeof message.refusal === "string" ? message.refusal : "";
  const reason = choice.finish_reason;
  if (reason === "error") return failed("service-unavailable", text, "error");
  if (reason === "tool_calls" || reason === "function_call") return failed("invalid-provider-response", text, reason);
  if (message.refusal != null || reason === "content_filter") return result({ status: "refused", text }, "refusal");
  if (reason === "length") return result({ status: "truncated", text }, "length");
  if (reason === "cancelled") return result({ status: "cancelled", text }, "cancelled");
  if (reason === "stop" || (request.selection.provider === "hugging-face" && reason === "eos_token")) {
    if (typeof message.content !== "string") return failed("no-output");
    return result({ status: "completed", text }, reason);
  }
  return result({ status: "interrupted", text }, null);
}
