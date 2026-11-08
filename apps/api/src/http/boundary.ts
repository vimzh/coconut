// Shared API ingress, origin, transport and cancellation guards preserve the credential boundary.
import { type Context, type Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ACCESS_TIMEOUT_MS, AccessInputError, MAX_ACCESS_BODY_BYTES, parseCredential } from "../providers/policy";

export class RequestError extends Error {
  constructor(readonly code: string, message: string, readonly status: ContentfulStatusCode) {
    super(message);
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function validateWebOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Provider web origin must be an exact HTTPS origin or loopback HTTP origin.");
  }
  if (url.origin !== value || (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname)))) {
    throw new Error("Provider web origin must be an exact HTTPS origin or loopback HTTP origin.");
  }
  return value;
}

async function readAccessBody(request: Request, signal: AbortSignal, interrupted: Promise<never>): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new RequestError("invalid-input", "Content-Length must be a valid byte count.", 400);
    if (Number(declaredLength) > MAX_ACCESS_BODY_BYTES) throw new RequestError("body-too-large", "Access request body exceeds 4096 bytes.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("invalid-json", "Supply a valid JSON request body.", 400);
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const bytes = new Uint8Array(MAX_ACCESS_BODY_BYTES);
  let length = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const chunk = await Promise.race([reader.read(), interrupted]);
      signal.throwIfAborted();
      if (chunk.done) break;
      if (length + chunk.value.byteLength > MAX_ACCESS_BODY_BYTES) {
        // Rejection must not wait for an untrusted stream's cancellation hook.
        cancel();
        throw new RequestError("body-too-large", "Access request body exceeds 4096 bytes.", 413);
      }
      bytes.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("invalid-json", "Supply a valid JSON request body.", 400);
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function bearerCredential(c: Context): string {
  const authorization = c.req.header("Authorization");
  if (authorization === undefined) throw new AccessInputError("missing-credential", "Supply your own provider credential for this operation.");
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
  if (!match) throw new AccessInputError("invalid-credential", "Supply one valid Authorization bearer credential for this operation.");
  return parseCredential(match[1]);
}

type PostOperation = (body: unknown, signal: AbortSignal) => Promise<Response>;

export async function guardedPost(c: Context, label: string, prepare: () => PostOperation): Promise<Response> {
  const cancellation = () => new RequestError("cancelled", `${label} was cancelled. Already-initiated upstream work or charges can remain unknown.`, 408);
  const callerSignal = c.req.raw.signal;
  if (callerSignal.aborted) throw cancellation();
  const controller = new AbortController();
  let rejectInterrupted!: (error: RequestError) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
  // Validation can finish before a concurrent interruption is consumed by a read.
  void interrupted.catch(() => {});
  const stop = (error: RequestError) => {
    if (controller.signal.aborted) return;
    rejectInterrupted(error);
    controller.abort(error);
  };
  const onAbort = () => stop(cancellation());
  callerSignal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => stop(new RequestError("timeout", `${label} timed out. Already-initiated upstream work or charges can remain unknown.`, 408)), ACCESS_TIMEOUT_MS);
  try {
    if (c.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      throw new RequestError("unsupported-content-type", `Use application/json for ${label.toLowerCase()} requests.`, 415);
    }
    const operation = prepare();
    const body = await readAccessBody(c.req.raw, controller.signal, interrupted);
    controller.signal.throwIfAborted();
    return await Promise.race([operation(body, controller.signal), interrupted]);
  } finally {
    clearTimeout(timer);
    callerSignal.removeEventListener("abort", onAbort);
    controller.abort();
  }
}

export function installApiBoundary(routes: Hono, options: { webOrigin?: string; methods?: readonly string[]; label?: string } = {}): void {
  const webOrigin = validateWebOrigin(options.webOrigin ?? "http://localhost:3200");
  const methods = options.methods ?? ["GET", "POST"];
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store, no-cache");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
    c.header("Vary", "Origin");
    const url = new URL(c.req.url);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
      throw new RequestError("secure-transport-required", "Use HTTPS except for loopback development requests.", 400);
    }
    const origin = c.req.header("Origin");
    if (origin !== undefined) {
      if (origin !== webOrigin && origin !== url.origin) throw new RequestError("origin-not-permitted", "Request origin is not permitted.", 403);
      c.header("Access-Control-Allow-Origin", origin);
    }
    if (url.search !== "") throw new RequestError("invalid-input", `${options.label ?? "Provider"} routes do not accept query parameters.`, 400);
    await next();
  });

  routes.options("*", (c) => {
    const method = c.req.header("Access-Control-Request-Method");
    const headers = c.req.header("Access-Control-Request-Headers")?.split(",").map((header) => header.trim().toLowerCase()) ?? [];
    if (!methods.includes(method ?? "") || headers.some((header) => !["authorization", "content-type"].includes(header))) {
      throw new RequestError("invalid-preflight", `Preflight permits only ${methods.join("/")} and Authorization/Content-Type headers.`, 400);
    }
    c.header("Access-Control-Allow-Methods", methods.join(", "));
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return c.body(null, 204);
  });

}
