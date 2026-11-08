// One freshly resolved visitor-funded request becomes one inspectable scoring attempt.
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { createModelSelectionClient, type DiscoveryFailure, type ModelSelectionClient, type SelectionResult } from "../discovery";
import { checkCompatibility, extractAnswer, type ModelReply } from "../protocol";
import { requestOpenAI } from "../providers/openai";
import { parseCredential, safeAccessInputError } from "../providers/policy";
import { classifyHttpFailure, FAILURE_MESSAGES, reflectsCredential } from "../providers/responses";
import { runProviderTransport, type ProviderFetch } from "../providers/transport";
import type { AccessFailureCode } from "../providers";
import type { AttemptEvidence } from "../scoring/types";
import { freezeData } from "../suites/generator";
import { buildInferencePlan, parseInferenceResponse } from "./adapters";
import { INFERENCE_TIMEOUT_MS, InferenceInputError, parseInferenceRequest } from "./policy";
import type { InferenceClient, InferenceResult, NormalizedInference } from "./types";

function errorKind(code: AccessFailureCode): AttemptEvidence["errorKind"] {
  if (code === "authentication-rejected" || code === "permission-denied") return "authentication";
  if (["model-unavailable", "service-unavailable", "rate-limited", "credit-or-quota-exhausted"].includes(code)) return "unavailable";
  if (code === "timeout") return "timeout";
  if (code === "network-error") return "transport";
  return "other";
}

export function createInferenceClient(
  fetcher: ProviderFetch = fetch,
  resolveSelection: ModelSelectionClient = createModelSelectionClient(fetcher),
): InferenceClient {
  return async (input, suppliedCredential, signal) => {
    const request = parseInferenceRequest(input);
    let credential: string;
    try { credential = parseCredential(suppliedCredential); }
    catch (error) { throw safeAccessInputError(error); }
    if (reflectsCredential(JSON.stringify(request), credential)) throw new InferenceInputError();
    const startedAt = new Date().toISOString(), start = performance.now();
    let selection: SelectionResult | null = null;
    let httpAttempts = 0;
    let httpStatus: number | null = null;
    let inferenceRequests: 0 | 1 = 0;
    let failure: DiscoveryFailure | null = null;
    let normalized: NormalizedInference | null = null;
    const fail = (code: AccessFailureCode, remoteOutcome: DiscoveryFailure["remoteOutcome"]) => {
      failure = { code, message: FAILURE_MESSAGES[code], remoteOutcome };
    };
    try {
      selection = await resolveSelection(request.selection, credential, signal);
      if (reflectsCredential(JSON.stringify(selection), credential)) { selection = null; fail("credential-reflection", "not-sent"); }
      if (selection !== null) {
        httpAttempts = selection.httpAttempts;
        if (selection.failure) fail(selection.failure.code, "not-sent");
        else if (!selection.metadata || selection.status === "blocked" || !selection.metadata.exactRoute
          || (request.selection.provider !== "openai" && selection.metadata.hosted !== "available")) fail("model-unavailable", "not-sent");
        else if (checkCompatibility(request.selection.profileId, selection.capabilities).unsupported.length) fail("invalid-provider-response", "not-sent");
        else {
          const metadata = selection.metadata;
          if (request.selection.provider !== "openai" && (metadata.tokenParameter === null
            || (request.prompt.responseFormat.kind === "json-schema" && metadata.structuredOutput !== "advertised"))) fail("invalid-provider-response", "not-sent");
          else {
            const plan = buildInferencePlan(request, metadata);
            const outcome = await runProviderTransport({ fetcher, credential, signal, maxAttempts: 1, timeoutMs: INFERENCE_TIMEOUT_MS }, async (transport) => {
              const response = request.selection.provider === "openai"
                ? await requestOpenAI(plan, credential, transport.signal, transport.send, transport.readBody,
                  (client) => client.responses.create(JSON.parse(plan.body!) as ResponseCreateParamsNonStreaming, { signal: transport.signal }).asResponse(), INFERENCE_TIMEOUT_MS)
                : await transport.send(plan.url, { method: plan.method, body: plan.body, headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" } });
              const body = await transport.readJson(response);
              const parsed = parseInferenceResponse(body, request, metadata);
              if (!response.ok) {
                const code = classifyHttpFailure(response.status, body, true);
                return { ...parsed, failure: code, reply: { status: "provider-error", text: parsed.reply.text, message: FAILURE_MESSAGES[code] } as ModelReply };
              }
              return parsed;
            });
            httpAttempts += outcome.attempts;
            httpStatus = outcome.httpStatus;
            inferenceRequests = outcome.attempts === 0 ? 0 : 1;
            if (!outcome.ok) fail(outcome.code, outcome.remoteOutcome);
            else {
              normalized = outcome.value;
              if (normalized.failure) fail(normalized.failure, "response-received");
              else if ((normalized.effective.maxOutputTokens !== null && normalized.effective.maxOutputTokens !== request.prompt.generation.maxOutputTokens)
                || normalized.effective.truncation === "auto"
                || (request.prompt.generation.reasoning !== "provider-default" && normalized.effective.reasoningEffort !== request.prompt.generation.reasoning)
                || (request.prompt.responseFormat.kind === "json-schema" && normalized.effective.nativeSchemaAccepted === false)) fail("invalid-provider-response", "response-received");
            }
          }
        }
      }
    } catch {
      // Local/injected metadata or parser exceptions cannot become model answers or diagnostics.
      fail(signal?.aborted ? "cancelled" : "invalid-provider-response", inferenceRequests ? "unknown" : "not-sent");
    }
    const safeFailure = failure as DiscoveryFailure | null;
    const reply: ModelReply = safeFailure
      ? safeFailure.code === "cancelled" ? { status: "cancelled", text: normalized?.reply.text ?? "" }
        : { status: "provider-error", text: normalized?.reply.text ?? "", message: safeFailure.message }
      : normalized?.reply ?? { status: "provider-error", text: "", message: FAILURE_MESSAGES["invalid-provider-response"] };
    const evidence: AttemptEvidence = {
      sequence: 1, outcome: extractAnswer(reply, request.selection.profileId),
      errorKind: reply.status === "provider-error" ? errorKind(safeFailure?.code ?? "invalid-provider-response") : null,
      elapsedMs: Math.max(0, performance.now() - start),
      usage: normalized?.usage ?? { input: null, output: null, reasoning: null }, cost: normalized?.cost ?? null,
    };
    const result: InferenceResult = {
      version: "1", policyId: "individual-inference-v1", attemptId: crypto.randomUUID(), startedAt, finishedAt: new Date().toISOString(),
      requested: { provider: request.selection.provider, modelId: request.selection.modelId, servingProvider: request.selection.servingProvider, profileId: request.selection.profileId },
      selection, metadata: selection?.metadata ?? null, prompt: request.prompt,
      reportedModelId: normalized?.reportedModelId ?? null, reportedServingProvider: normalized?.reportedServingProvider ?? null,
      effective: normalized?.effective ?? { maxOutputTokens: null, reasoningEffort: null, truncation: null, nativeSchemaAccepted: null },
      finishReason: normalized?.finishReason ?? null,
      contextFit: request.selection.provider === "openai" && normalized?.effective.truncation === "disabled" && normalized.reply.status !== "provider-error" ? "provider-enforced" : "unverified",
      evidence, failure: safeFailure, httpAttempts, httpStatus, inferenceRequests,
      budget: { maxInferenceRequests: 1, maxOutputTokens: request.prompt.generation.maxOutputTokens, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, retries: 0 },
    };
    if (reflectsCredential(JSON.stringify(result), credential)) throw new InferenceInputError();
    return freezeData(result);
  };
}

export const executeInference = createInferenceClient();
