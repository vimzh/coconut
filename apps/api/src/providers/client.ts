// One explicit credential, one bounded provider request, and only safe evidence.
import {
  ACCESS_TIMEOUT_MS, AccessInputError, buildProviderPlan, MAX_PROVIDER_RESPONSE_BYTES,
  parseAccessRequest, parseCredential, PROBE_MAX_OUTPUT_TOKENS, safeAccessInputError,
} from "./policy";
import { FAILURE_MESSAGES, parseAccessResponse, reflectsCredential } from "./responses";
import type { AccessFailureCode, AccessRequest, ProviderAccessClient } from "./types";

class TransportFailure extends Error {
  constructor(readonly code: AccessFailureCode) {
    super(FAILURE_MESSAGES[code]);
  }
}

function discardBody(response: Response): void {
  // Cleanup must not extend the deadline when a stream's cancel hook stalls.
  try { void response.body?.cancel().catch(() => {}); } catch { /* The operation already reports failure. */ }
}

export function createProviderAccessClient(
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
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
    const controller = new AbortController();
    let stopped: "cancelled" | "timeout" | null = null;
    let sent = false;
    let received = false;
    let httpStatus: number | null = null;
    let cancelReader: (() => void) | undefined;
    let rejectStopped: (error: TransportFailure) => void;
    const interrupted = new Promise<never>((_, reject) => { rejectStopped = reject; });
    // A synchronous fetch implementation can abort before the first race is attached.
    void interrupted.catch(() => {});
    const stop = (code: "cancelled" | "timeout") => {
      if (stopped !== null) return;
      stopped = code;
      controller.abort();
      rejectStopped(new TransportFailure(code));
    };
    const onAbort = () => stop("cancelled");
    const timer = setTimeout(() => stop("timeout"), ACCESS_TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      if (signal?.aborted) throw new TransportFailure("cancelled");
      const headers: Record<string, string> = { Authorization: `Bearer ${credential}` };
      if (plan.method === "POST") headers["Content-Type"] = "application/json";
      sent = true;
      const pending = fetcher(plan.url, {
        method: plan.method, headers, body: plan.body, signal: controller.signal,
        redirect: "manual", credentials: "omit",
      });
      // An injected or broken transport may ignore abort and resolve after settlement.
      void pending.then((response) => { if (controller.signal.aborted) discardBody(response); }, () => {});
      const response = await Promise.race([pending, interrupted]);
      received = true;
      httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
      if (response.type === "opaqueredirect" || response.redirected || (response.status >= 300 && response.status < 400)) {
        discardBody(response);
        throw new TransportFailure("redirect-blocked");
      }
      const declaredLength = response.headers.get("content-length");
      if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_PROVIDER_RESPONSE_BYTES) {
        discardBody(response);
        throw new TransportFailure("response-too-large");
      }
      if (response.body === null) throw new TransportFailure("invalid-provider-response");
      const reader = response.body.getReader();
      cancelReader = () => {
        try { void reader.cancel().catch(() => {}); } catch { /* Cleanup cannot replace safe evidence. */ }
      };
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let text = "";
      while (true) {
        const chunk = await Promise.race([reader.read(), interrupted]);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_PROVIDER_RESPONSE_BYTES) throw new TransportFailure("response-too-large");
        try { text += decoder.decode(chunk.value, { stream: true }); }
        catch { throw new TransportFailure("invalid-provider-response"); }
      }
      try { text += decoder.decode(); }
      catch { throw new TransportFailure("invalid-provider-response"); }
      if (reflectsCredential(text, credential)) throw new TransportFailure("credential-reflection");
      let body: unknown;
      try { body = JSON.parse(text); }
      catch { throw new TransportFailure("invalid-provider-response"); }
      const parsed = parseAccessResponse(request, response.status, body, credential);
      return {
        ...evidence, status: parsed.status, reportedModelId: parsed.reportedModelId,
        reportedServingProvider: parsed.reportedServingProvider, usage: parsed.usage, httpStatus,
        failure: parsed.failure === null ? null : { code: parsed.failure, message: FAILURE_MESSAGES[parsed.failure], remoteOutcome: "response-received" },
      };
    } catch (error) {
      const code = stopped ?? (error instanceof TransportFailure ? error.code : "network-error");
      return {
        ...evidence, status: "not-verified", reportedModelId: null, reportedServingProvider: null,
        httpStatus, usage: { inputTokens: null, outputTokens: null },
        failure: {
          code, message: FAILURE_MESSAGES[code],
          remoteOutcome: !sent ? "not-sent" : stopped !== null || code === "cancelled" || code === "timeout" || !received ? "unknown" : "response-received",
        },
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      cancelReader?.();
      controller.abort();
    }
  };
}

export const checkProviderAccess: ProviderAccessClient = createProviderAccessClient();
