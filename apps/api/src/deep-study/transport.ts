// A frozen single-response research transport preserves paid dispatch evidence and isolates provider credentials.
import { isDeepStrictEqual } from "node:util";
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { ModelMetadata } from "../discovery";
import { parseInferenceResponse, type InferenceResponseContext } from "../inference/adapters";
import type { NormalizedInference } from "../inference/types";
import { extractAnswer, type AnswerOutcome } from "../protocol";
import { parseCredential } from "../providers/policy";
import { classifyHttpFailure, reflectsCredential } from "../providers/responses";
import type { AccessFailureCode } from "../providers/types";
import { buildImportedPrompt } from "../randomized/pilot";
import type { ImportedCase } from "../randomized/types";

export const DEEP_MODELS = Object.freeze([
  Object.freeze({ modelId: "gpt-6-astra", reasoningEffort: "max" }),
  Object.freeze({ modelId: "gpt-5.4-mini", reasoningEffort: "xhigh" }),
  Object.freeze({ modelId: "gpt-6-luna", reasoningEffort: "max" }),
] as const);
export type DeepModelId = typeof DEEP_MODELS[number]["modelId"];
export const DEEP_SETTINGS = Object.freeze({ methodId: "deep-single-response-v1", profileId: "deep-research-32k-600s-v1",
  maxOutputTokens: 32768, inferenceTimeoutMs: 600000, retries: 0, maxResponseBytes: 1048576, maxVisibleCodeUnits: 131072 } as const);
const ENDPOINT = "https://api.openai.com/v1/responses";

function modelSettings(modelId: DeepModelId) {
  const selected = DEEP_MODELS.find(model => model.modelId === modelId);
  if (!selected) throw new Error("The model is outside the frozen deep-study roster.");
  return selected;
}

export function buildDeepRequestBody(task: ImportedCase, modelId: DeepModelId) {
  const prompt = buildImportedPrompt(task), selected = modelSettings(modelId);
  return Object.freeze({ model: modelId, input: prompt.messages, max_output_tokens: DEEP_SETTINGS.maxOutputTokens,
    store: false, truncation: "disabled", reasoning: Object.freeze({ effort: selected.reasoningEffort }) } as const);
}

type Failure = { readonly code: AccessFailureCode; readonly remoteOutcome: "not-sent" | "unknown" | "response-received" };
export interface DeepAttempt {
  readonly methodId: "deep-single-response-v1";
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly inferenceTimeoutMs: 600000;
  readonly inferenceRequests: 0 | 1;
  readonly httpStatus: number | null;
  readonly failure: Failure | null;
  readonly rawResponse: unknown;
  readonly normalized: NormalizedInference | null;
  readonly outcome: AnswerOutcome;
}
class DeepFailure extends Error {
  constructor(readonly code: AccessFailureCode) { super(`Deep-study operation failed: ${code}.`); }
}

export async function readDeepBody(response: Response, credential: string, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new DeepFailure("invalid-provider-response");
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let size = 0, text = "", drained = false;
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const chunk = await reader.read(); signal.throwIfAborted();
      if (chunk.done) { drained = true; break; }
      size += chunk.value.byteLength;
      if (size > DEEP_SETTINGS.maxResponseBytes) throw new DeepFailure("response-too-large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    if (reflectsCredential(text, credential)) throw new DeepFailure("credential-reflection");
    return text;
  } finally { signal.removeEventListener("abort", cancel); if (!drained) cancel(); }
}

export async function executeDeepAttempt(task: ImportedCase, modelId: DeepModelId, metadata: ModelMetadata, suppliedCredential: string,
  parentSignal: AbortSignal, onDispatch: () => Promise<void>,
  fetcher: (url: string, options: BunFetchRequestInit) => Promise<Response> = fetch): Promise<DeepAttempt> {
  const credential = parseCredential(suppliedCredential), selected = modelSettings(modelId), body = buildDeepRequestBody(task, modelId), bodyText = JSON.stringify(body);
  if (metadata.modelId !== modelId || metadata.servingProvider !== null || metadata.exactRoute !== true || reflectsCredential(bodyText, credential))
    throw new Error("The fixed deep-study OpenAI Responses request or exact metadata is invalid.");
  const startedAt = new Date().toISOString(), started = performance.now();
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(DEEP_SETTINGS.inferenceTimeoutMs)]);
  const context: InferenceResponseContext = { selection: { provider: "openai" },
    prompt: { responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: DEEP_SETTINGS.maxOutputTokens } } };
  let sent: 0 | 1 = 0, status: number | null = null, raw: unknown = null, normalized: NormalizedInference | null = null;
  let failure: Failure | null = null, transportFailure: unknown, dispatchPersistenceFailed = false;
  const client = new OpenAI({ apiKey: credential, adminAPIKey: null, organization: null, project: null, webhookSecret: null, dataResidency: null,
    baseURL: "https://api.openai.com/v1", maxRetries: 0, timeout: DEEP_SETTINGS.inferenceTimeoutMs, logLevel: "off",
    fetch: async (input, init) => {
      try {
        if ((input instanceof Request ? input.url : String(input)) !== ENDPOINT || init?.method !== "POST" || typeof init.body !== "string"
          || !isDeepStrictEqual(JSON.parse(init.body), body) || sent !== 0) throw new DeepFailure("invalid-provider-response");
        signal.throwIfAborted(); sent = 1;
        try { await onDispatch(); } catch { dispatchPersistenceFailed = true; throw new Error("Dispatch evidence could not be retained; no wire request was started."); }
        signal.throwIfAborted();
        const response = await fetcher(ENDPOINT, { method: "POST", body: init.body,
          headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
          signal: AbortSignal.any([signal, init.signal ?? signal]), redirect: "manual", credentials: "omit", timeout: false });
        status = response.status;
        const text = await readDeepBody(response, credential, signal); raw = text;
        try { raw = JSON.parse(text); } catch { throw new DeepFailure(response.status >= 300 && response.status < 400 ? "redirect-blocked" : "invalid-provider-response"); }
        if (reflectsCredential(JSON.stringify(raw), credential)) throw new DeepFailure("credential-reflection");
        if (response.status >= 300 && response.status < 400) throw new DeepFailure("redirect-blocked");
        signal.throwIfAborted();
        if (performance.now() - started >= DEEP_SETTINGS.inferenceTimeoutMs) throw new DeepFailure("timeout");
        return new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } });
      } catch (error) { transportFailure = error; throw error; }
    } });
  try {
    try { await client.responses.create(JSON.parse(bodyText) as ResponseCreateParamsNonStreaming, { signal, timeout: DEEP_SETTINGS.inferenceTimeoutMs, maxRetries: 0 }).asResponse(); }
    catch (error) { if (transportFailure !== undefined) throw transportFailure; if (!(error instanceof OpenAI.APIError && status !== null && raw !== null)) throw error; }
    if (status === null || raw === null) throw new DeepFailure("invalid-provider-response");
    if (status < 200 || status >= 300) throw new DeepFailure(classifyHttpFailure(status, raw, true));
    normalized = parseInferenceResponse(raw, context, metadata);
    if (normalized.failure) throw new DeepFailure(normalized.failure);
    if (normalized.effective.maxOutputTokens !== DEEP_SETTINGS.maxOutputTokens || normalized.effective.reasoningEffort !== selected.reasoningEffort
      || normalized.effective.truncation !== "disabled" || normalized.reply.text.length > DEEP_SETTINGS.maxVisibleCodeUnits) throw new DeepFailure("invalid-provider-response");
    signal.throwIfAborted();
    if (performance.now() - started >= DEEP_SETTINGS.inferenceTimeoutMs) throw new DeepFailure("timeout");
  } catch (error) {
    if (dispatchPersistenceFailed) throw new Error("Dispatch evidence could not be retained; inspect conservative authorization counts before further paid work.");
    const code = error instanceof DeepFailure ? error.code : parentSignal.aborted ? "cancelled"
      : signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError ? "timeout" : status === null ? "network-error" : "invalid-provider-response";
    failure = { code, remoteOutcome: sent === 0 ? "not-sent" : status === null || ["timeout", "cancelled", "network-error"].includes(code) ? "unknown" : "response-received" };
    if (code === "credential-reflection") { raw = null; normalized = null; }
  }
  const outcome = extractAnswer(failure ? failure.code === "cancelled" ? { status: "cancelled", text: "" }
    : { status: "provider-error", text: "", message: failure.code } : normalized!.reply, `one-shot-json-v2-${selected.reasoningEffort}`);
  const result: DeepAttempt = { methodId: DEEP_SETTINGS.methodId, startedAt, finishedAt: new Date().toISOString(),
    inferenceTimeoutMs: DEEP_SETTINGS.inferenceTimeoutMs, inferenceRequests: sent, httpStatus: status, failure, rawResponse: raw, normalized, outcome };
  if (reflectsCredential(JSON.stringify(result), credential)) throw new Error("Unsafe deep-study evidence was discarded.");
  return result;
}
