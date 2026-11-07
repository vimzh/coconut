// Shares bounded request, response, and cancellation handling across provider operations.
import { ACCESS_TIMEOUT_MS, MAX_PROVIDER_RESPONSE_BYTES } from "./policy";
import { FAILURE_MESSAGES, reflectsCredential } from "./responses";
import type { AccessFailureCode } from "./types";

export type ProviderFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ProviderTransport {
  readonly signal: AbortSignal;
  readonly attempts: number;
  readonly httpStatus: number | null;
  send(url: string, init: RequestInit): Promise<Response>;
  readBody(response: Response): Promise<string>;
  readJson(response: Response): Promise<unknown>;
}

export type TransportOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly attempts: number; readonly httpStatus: number | null }
  | {
      readonly ok: false;
      readonly code: AccessFailureCode;
      readonly remoteOutcome: "not-sent" | "unknown" | "response-received";
      readonly attempts: number;
      readonly httpStatus: number | null;
    };

export class TransportFailure extends Error {
  constructor(readonly code: AccessFailureCode) {
    super(FAILURE_MESSAGES[code]);
  }
}

function discardBody(response: Response): void {
  // Cleanup must not extend the deadline when a stream's cancel hook stalls.
  try { void response.body?.cancel().catch(() => {}); } catch { /* The operation already reports failure. */ }
}

export async function runProviderTransport<T>(
  options: { fetcher?: ProviderFetch; credential: string | null; signal?: AbortSignal; maxAttempts: 1 | 2 | 3; timeoutMs?: number },
  work: (transport: ProviderTransport) => Promise<T>,
): Promise<TransportOutcome<T>> {
  if (![1, 2, 3].includes(options.maxAttempts)) throw new Error("Provider operations require a request limit from 1 through 3.");
  const timeoutMs = options.timeoutMs ?? ACCESS_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180_000) throw new Error("Provider timeout must be an integer from 1 through 180000 milliseconds.");
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  let stopped: "cancelled" | "timeout" | null = null;
  let attempts = 0;
  let received = false;
  let httpStatus: number | null = null;
  const unreadResponses = new Set<Response>();
  const cancelReaders = new Set<() => void>();
  let rejectStopped!: (error: TransportFailure) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectStopped = reject; });
  // An injected transport can abort synchronously before the first race attaches.
  void interrupted.catch(() => {});
  const stop = (code: "cancelled" | "timeout") => {
    if (stopped !== null) return;
    stopped = code;
    controller.abort();
    rejectStopped(new TransportFailure(code));
  };
  const onAbort = () => stop("cancelled");
  const timer = setTimeout(() => stop("timeout"), timeoutMs);
  options.signal?.addEventListener("abort", onAbort, { once: true });

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    if (controller.signal.aborted) throw new TransportFailure(stopped ?? "cancelled");
    if (attempts >= options.maxAttempts) throw new TransportFailure("invalid-provider-response");
    const authorization = new Headers(init.headers).get("authorization");
    if (authorization !== null && (options.credential === null || authorization !== `Bearer ${options.credential}`)) {
      throw new TransportFailure("invalid-provider-response");
    }
    attempts++;
    received = false;
    httpStatus = null;
    const signal = init.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal;
    const pending = fetcher(url, { ...init, signal, redirect: "manual", credentials: "omit" });
    // An injected or broken fetch may ignore abort and resolve after settlement.
    void pending.then((response) => { if (controller.signal.aborted) discardBody(response); }, () => {});
    const response = await Promise.race([pending, interrupted]);
    received = true;
    httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    unreadResponses.add(response);
    return response;
  };

  const readBody = async (response: Response): Promise<string> => {
    unreadResponses.delete(response);
    if (controller.signal.aborted) {
      discardBody(response);
      throw new TransportFailure(stopped ?? "cancelled");
    }
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
    const cancel = () => {
      try { void reader.cancel().catch(() => {}); } catch { /* Cleanup cannot replace safe evidence. */ }
    };
    cancelReaders.add(cancel);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    let drained = false;
    try {
      while (true) {
        const chunk = await Promise.race([reader.read(), interrupted]);
        if (chunk.done) { drained = true; break; }
        bytes += chunk.value.byteLength;
        if (bytes > MAX_PROVIDER_RESPONSE_BYTES) throw new TransportFailure("response-too-large");
        try { text += decoder.decode(chunk.value, { stream: true }); }
        catch { throw new TransportFailure("invalid-provider-response"); }
      }
      try { text += decoder.decode(); }
      catch { throw new TransportFailure("invalid-provider-response"); }
      if (options.credential !== null && reflectsCredential(text, options.credential)) throw new TransportFailure("credential-reflection");
      return text;
    } finally {
      if (drained) {
        cancelReaders.delete(cancel);
        reader.releaseLock();
      }
    }
  };

  const transport: ProviderTransport = {
    signal: controller.signal,
    get attempts() { return attempts; },
    get httpStatus() { return httpStatus; },
    send, readBody,
    async readJson(response) {
      const text = await readBody(response);
      let body: unknown;
      try { body = JSON.parse(text); }
      catch {
        // Error status still carries actionable evidence when its bounded body is text or empty.
        if (response.status >= 400 && !response.ok) return null;
        throw new TransportFailure("invalid-provider-response");
      }
      if (options.credential !== null && reflectsCredential(JSON.stringify(body), options.credential)) throw new TransportFailure("credential-reflection");
      return body;
    },
  };

  try {
    if (options.signal?.aborted) throw new TransportFailure("cancelled");
    const value = await Promise.race([work(transport), interrupted]);
    return { ok: true, value, attempts, httpStatus };
  } catch (error) {
    const code = stopped ?? (error instanceof TransportFailure ? error.code : "network-error");
    return {
      ok: false, code, attempts, httpStatus,
      remoteOutcome: attempts === 0 ? "not-sent" : stopped !== null || code === "cancelled" || code === "timeout" || !received ? "unknown" : "response-received",
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    for (const cancel of cancelReaders) cancel();
    for (const response of unreadResponses) discardBody(response);
    controller.abort();
  }
}
