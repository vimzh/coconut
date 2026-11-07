// One explicit credential, one bounded provider request, and only safe evidence.
import {
  ACCESS_TIMEOUT_MS, AccessInputError, buildProviderPlan,
  parseAccessRequest, parseCredential, PROBE_MAX_OUTPUT_TOKENS, safeAccessInputError,
} from "./policy";
import { FAILURE_MESSAGES, parseAccessResponse, reflectsCredential } from "./responses";
import type { AccessRequest, ProviderAccessClient } from "./types";
import { requestOpenAIAccess } from "./openai";
import { runProviderTransport, type ProviderFetch } from "./transport";

export function createProviderAccessClient(
  fetcher: ProviderFetch = fetch,
): ProviderAccessClient {
  return async (input, suppliedCredential, signal) => {
    let request: AccessRequest;
    let credential: string;
    try {
      request = parseAccessRequest(input);
      credential = parseCredential(suppliedCredential);
      if (request.operation === "probe" && (reflectsCredential(request.modelId, credential) || (request.servingProvider !== null && reflectsCredential(request.servingProvider, credential)))) {
        throw new AccessInputError("invalid-input", "Access operation must contain exactly the documented data fields.");
      }
    } catch (error) {
      throw safeAccessInputError(error);
    }

    const plan = buildProviderPlan(request);
    const evidence = {
      version: "1" as const,
      requestId: crypto.randomUUID(),
      checkedAt: new Date().toISOString(),
      provider: request.provider,
      operation: request.operation,
      requestedModelId: request.operation === "probe" ? request.modelId : null,
      requestedServingProvider: request.operation === "probe" ? request.servingProvider : null,
      budget: {
        maxHttpAttempts: 1 as const,
        maxInferenceRequests: request.operation === "probe" ? 1 as const : 0 as const,
        maxOutputTokens: request.operation === "probe" ? PROBE_MAX_OUTPUT_TOKENS : 0 as const,
        timeoutMs: ACCESS_TIMEOUT_MS,
      },
    };
    const outcome = await runProviderTransport({ fetcher, credential, signal, maxAttempts: 1 }, async (transport) => {
      const headers: Record<string, string> = { Authorization: `Bearer ${credential}` };
      if (plan.method === "POST") headers["Content-Type"] = "application/json";
      const response = await (request.provider === "openai"
        ? requestOpenAIAccess(request, credential, transport.signal, transport.send, transport.readBody)
        : transport.send(plan.url, { method: plan.method, headers, body: plan.body, signal: transport.signal, redirect: "manual", credentials: "omit" }));
      return parseAccessResponse(request, response.status, await transport.readJson(response), credential);
    });
    if (outcome.ok) {
      const parsed = outcome.value;
      return {
        ...evidence, status: parsed.status, reportedModelId: parsed.reportedModelId,
        reportedServingProvider: parsed.reportedServingProvider, usage: parsed.usage, httpStatus: outcome.httpStatus,
        failure: parsed.failure === null ? null : { code: parsed.failure, message: FAILURE_MESSAGES[parsed.failure], remoteOutcome: "response-received" },
      };
    }
    return {
      ...evidence, status: "not-verified", reportedModelId: null, reportedServingProvider: null,
      httpStatus: outcome.httpStatus, usage: { inputTokens: null, outputTokens: null },
      failure: { code: outcome.code, message: FAILURE_MESSAGES[outcome.code], remoteOutcome: outcome.remoteOutcome },
    };
  };
}

export const checkProviderAccess: ProviderAccessClient = createProviderAccessClient();
