// Stateless HTTP boundary for visitor-supplied provider credentials and safe access evidence.
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { searchHuggingFaceModels, selectModel } from "../discovery/client";
import { DISCOVERY_POLICY, DiscoveryInputError, parseSearchRequest, parseSelectionRequest } from "../discovery/policy";
import type { ModelSearchClient, ModelSelectionClient } from "../discovery/types";
import { checkProviderAccess } from "./client";
import { ACCESS_POLICY, ACCESS_TIMEOUT_MS, AccessInputError, MAX_ACCESS_BODY_BYTES, parseAccessRequest, parseCredential, safeAccessInputError } from "./policy";
import type { ProviderAccessClient } from "./types";
import { reflectsCredential } from "./responses";

class RequestError extends Error {
  constructor(readonly code: string, message: string, readonly status: ContentfulStatusCode) {
    super(message);
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

function validateWebOrigin(value: string): string {
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

function bearerCredential(c: Context): string {
  const authorization = c.req.header("Authorization");
  if (authorization === undefined) throw new AccessInputError("missing-credential", "Supply your own provider credential for this operation.");
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
  if (!match) throw new AccessInputError("invalid-credential", "Supply one valid Authorization bearer credential for this operation.");
  return parseCredential(match[1]);
}

type PostOperation = (body: unknown, signal: AbortSignal) => Promise<Response>;

async function guardedPost(c: Context, label: string, prepare: () => PostOperation): Promise<Response> {
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

export function createProviderRoutes(options: {
  accessClient?: ProviderAccessClient;
  searchClient?: ModelSearchClient;
  selectionClient?: ModelSelectionClient;
  webOrigin?: string;
} = {}): Hono {
  const accessClient = options.accessClient ?? checkProviderAccess;
  const searchClient = options.searchClient ?? searchHuggingFaceModels;
  const selectionClient = options.selectionClient ?? selectModel;
  const webOrigin = validateWebOrigin(options.webOrigin ?? "http://localhost:3200");
  const routes = new Hono();

  routes.onError((error, c) => {
    if (error instanceof RequestError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof AccessInputError) {
      const safeError = safeAccessInputError(error);
      const status = safeError.code === "missing-credential" || safeError.code === "invalid-credential" ? 401 : 400;
      return c.json({ error: { code: safeError.code, message: safeError.message } }, status);
    }
    if (error instanceof DiscoveryInputError) {
      const safeError = new DiscoveryInputError(error.code === "charge-authorization-required" ? error.code : "invalid-input");
      return c.json({ error: { code: safeError.code, message: safeError.message } }, 400);
    }
    const message = c.req.path.endsWith("/access") ? "Provider access could not be checked." : "Model discovery could not be completed.";
    return c.json({ error: { code: "internal-error", message } }, 500);
  });

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
    if (url.search !== "") throw new RequestError("invalid-input", "Provider routes do not accept query parameters.", 400);
    await next();
  });

  routes.options("*", (c) => {
    const method = c.req.header("Access-Control-Request-Method");
    const headers = c.req.header("Access-Control-Request-Headers")?.split(",").map((header) => header.trim().toLowerCase()) ?? [];
    if ((method !== "GET" && method !== "POST") || headers.some((header) => !["authorization", "content-type"].includes(header))) {
      throw new RequestError("invalid-preflight", "Preflight permits only GET/POST and Authorization/Content-Type headers.", 400);
    }
    c.header("Access-Control-Allow-Methods", "GET, POST");
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return c.body(null, 204);
  });

  routes.get("/policy", (c) => c.json(ACCESS_POLICY));
  routes.get("/models/policy", (c) => c.json(DISCOVERY_POLICY));

  routes.post("/access", (c) => guardedPost(c, "Provider access", () => {
    const credential = bearerCredential(c);
    return async (body, signal) => c.json(await accessClient(parseAccessRequest(body), credential, signal));
  }));

  routes.post("/models/search", (c) => guardedPost(c, "Model discovery", () => {
    if (c.req.header("Authorization") !== undefined) {
      throw new RequestError("credential-not-permitted", "Model search is anonymous. Omit the Authorization header.", 400);
    }
    return async (body, signal) => c.json(await searchClient(parseSearchRequest(body), signal));
  }));

  routes.post("/models/select", (c) => guardedPost(c, "Model discovery", () => {
    const credential = bearerCredential(c);
    return async (body, signal) => {
      const request = parseSelectionRequest(body);
      if (reflectsCredential(JSON.stringify(request), credential)) throw new DiscoveryInputError();
      const result = await selectionClient(request, credential, signal);
      if (reflectsCredential(JSON.stringify(result), credential)) throw new Error("Unsafe selection evidence.");
      return c.json(result);
    };
  }));

  return routes;
}
