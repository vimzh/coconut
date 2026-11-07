// HTTP fixtures verify credential isolation and rejection before any provider operation.
import { describe, expect, it, mock, spyOn } from "bun:test";
import { Hono } from "hono";
import { AccessInputError, ACCESS_POLICY, ACCESS_TIMEOUT_MS, MAX_ACCESS_BODY_BYTES, parseAccessRequest } from "./policy";
import { createProviderRoutes } from "./routes";
import type { AccessRequest, AccessResult, ProviderAccessClient } from "./types";

const visitorCredential = "fixture-visitor-alpha-credential";
const otherCredential = "fixture-visitor-beta-credential";
const authentication: AccessRequest = { provider: "openai", operation: "authenticate" };
const probe: AccessRequest = { provider: "openai", operation: "probe", modelId: "fixture-model", servingProvider: null, acceptCharges: true };

function evidence(request: AccessRequest): AccessResult {
  const isProbe = request.operation === "probe";
  return {
    version: "1", requestId: "fixture-request-id", checkedAt: "2026-11-07T00:00:00.000Z",
    provider: request.provider, operation: request.operation,
    status: isProbe ? "inference-verified" : "authenticated",
    requestedModelId: isProbe ? request.modelId : null,
    reportedModelId: isProbe ? request.modelId : null,
    requestedServingProvider: isProbe ? request.servingProvider : null,
    reportedServingProvider: isProbe ? "openai" : null,
    httpStatus: 200, usage: { inputTokens: null, outputTokens: null },
    budget: { maxHttpAttempts: 1, maxInferenceRequests: isProbe ? 1 : 0, maxOutputTokens: isProbe ? 128 : 0, timeoutMs: 20000 },
    failure: null,
  };
}

function accessRequest(body: unknown = authentication, init: RequestInit = {}, url = "http://localhost/access"): Request {
  const headers = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${visitorCredential}` });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Request(url, { method: "POST", body: JSON.stringify(body), ...init, headers });
}

function clientFixture() {
  return mock<ProviderAccessClient>(async (request) => evidence(parseAccessRequest(request)));
}

function expectPrivate(response: Response): void {
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Vary")).toBe("Origin");
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
}

describe("provider HTTP routes", () => {
  it("returns the policy without authentication or provider calls", async () => {
    const client = clientFixture();
    const app = new Hono().route("/providers", createProviderRoutes({ accessClient: client }));
    const response = await app.request("http://localhost/providers/policy");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCESS_POLICY);
    expect(client).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("passes parsed operation, a separate credential, and an operation signal", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    const controller = new AbortController();
    const request = accessRequest(probe, { signal: controller.signal });
    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(evidence(probe));
    expect(client).toHaveBeenCalledTimes(1);
    expect(client.mock.calls[0]?.slice(0, 2)).toEqual([probe, visitorCredential]);
    expect(client.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
    expectPrivate(response);
  });

  it("keeps provider failure evidence distinct from a successful inference status", async () => {
    const result: AccessResult = {
      ...evidence(probe), status: "not-verified", reportedModelId: null, reportedServingProvider: null, httpStatus: 403,
      failure: { code: "permission-denied", message: "The request is not permitted. Check model, account, regional, and credential restrictions.", remoteOutcome: "response-received" },
    };
    const response = await createProviderRoutes({ accessClient: async () => result }).fetch(accessRequest(probe));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expectPrivate(response);
  });

  it("allows the exact configured origin, actual same origin, and explicit-key CLI requests", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client, webOrigin: "https://web.example" });
    for (const origin of ["https://web.example", "https://api.example", undefined]) {
      const response = await app.fetch(accessRequest(authentication, { headers: origin ? { Origin: origin } : {} }, "https://api.example/access"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin ?? null);
      expectPrivate(response);
    }
    expect(client).toHaveBeenCalledTimes(3);
  });

  it("rejects null, foreign, and lookalike origins before credentials or body are read", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const origin of ["null", "https://foreign.example", "http://localhost:3200.evil.example", "http://localhost:3200/", "http://localhost:3200, https://foreign.example"]) {
      let reads = 0;
      const request = new Request("http://localhost/access", {
        method: "POST", headers: { Origin: origin },
        body: new ReadableStream({ pull() { reads++; throw new Error(visitorCredential); } }, { highWaterMark: 0 }),
      });
      const response = await app.fetch(request);
      expect(response.status).toBe(403);
      expect(reads).toBe(0);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(await response.text()).not.toContain(visitorCredential);
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
  });

  it("requires TLS outside loopback and ignores forwarded transport claims", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const url of ["http://api.example/access", "http://192.168.1.10/access", "http://localhost.evil.example/access"]) {
      const response = await app.fetch(accessRequest(authentication, { headers: { "X-Forwarded-Proto": "https" } }, url));
      expect(response.status).toBe(400);
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
    for (const url of ["http://localhost/access", "http://127.0.0.1/access", "http://[::1]/access", "https://api.example/access"]) {
      expect((await app.fetch(accessRequest(authentication, {}, url))).status).toBe(200);
    }
    expect(client).toHaveBeenCalledTimes(4);
  });

  it("fails immediately for invalid or insecure configured origins", () => {
    for (const webOrigin of ["", "null", "*", "http://web.example", "https://web.example/", "https://web.example/path", "https://web.example?query=1", "https://web.example#fragment", "https://user:password@web.example", "https://web.example:443", " https://web.example"]) {
      expect(() => createProviderRoutes({ webOrigin })).toThrow("exact HTTPS origin or loopback HTTP origin");
    }
    for (const webOrigin of ["https://web.example", "http://localhost:3200", "http://127.0.0.1:3200", "http://[::1]:3200"]) {
      expect(() => createProviderRoutes({ webOrigin })).not.toThrow();
    }
  });

  it("handles approved preflights without a credential or provider call", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const method of ["GET", "POST"]) {
      const response = await app.request("http://localhost/access", { method: "OPTIONS", headers: {
        Origin: "http://localhost:3200", "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization, Content-Type",
      } });
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3200");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
      expect(await response.text()).toBe("");
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
  });

  it("rejects preflight methods, headers, and origins outside the allowlist", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const [method, headers, origin, status] of [
      ["DELETE", "authorization", "http://localhost:3200", 400],
      ["POST", "authorization, x-provider-key", "http://localhost:3200", 400],
      ["POST", "cookie", "http://localhost:3200", 400],
      ["POST", "authorization", "null", 403],
      ["POST", "authorization", "https://foreign.example", 403],
    ] as const) {
      const response = await app.request("http://localhost/access", { method: "OPTIONS", headers: {
        Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers,
      } });
      expect(response.status).toBe(status);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
  });

  it("requires one explicit bearer credential and never reuses a previous visitor's credential", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    expect((await app.fetch(accessRequest())).status).toBe(200);
    for (const authorization of [undefined, "", `Basic ${visitorCredential}`, `Bearer ${visitorCredential}, Bearer ${otherCredential}`, `Bearer ${visitorCredential} ${otherCredential}`, "Bearer short", `Bearer ${visitorCredential}=invalid`]) {
      const request = accessRequest();
      if (authorization === undefined) request.headers.delete("Authorization");
      else request.headers.set("Authorization", authorization);
      request.headers.set("Cookie", `credential=${visitorCredential}`);
      const response = await app.fetch(request);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain(visitorCredential);
      expectPrivate(response);
    }
    const duplicate = accessRequest();
    duplicate.headers.append("Authorization", `Bearer ${otherCredential}`);
    expect((await app.fetch(duplicate)).status).toBe(401);
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("rejects query parameters, missing consent, extra fields, and incomplete operation data", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const body of [
      null, [], {}, "authenticate", { provider: "openai" }, { operation: "authenticate" },
      { ...authentication, credential: visitorCredential }, { ...authentication, apiKey: visitorCredential },
      { ...authentication, headers: { Authorization: visitorCredential } },
      { ...authentication, url: "https://foreign.example" }, { ...authentication, modelId: "fixture-model" },
      { ...probe, acceptCharges: false }, { provider: "openai", operation: "probe", modelId: "fixture-model", servingProvider: null },
      { ...probe, servingProvider: "auto" }, { ...probe, modelId: "" },
    ]) {
      const response = await app.fetch(accessRequest(body));
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(visitorCredential);
      expectPrivate(response);
    }
    const response = await app.fetch(accessRequest(authentication, {}, `http://localhost/access?credential=${visitorCredential}`));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(visitorCredential);
    expect(client).not.toHaveBeenCalled();
  });

  it("requires JSON and rejects malformed, invalid UTF-8, and unreadable bodies safely", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "application/json-patch+json", "application/json, text/plain"]) {
      const response = await app.fetch(accessRequest(authentication, { headers: { "Content-Type": contentType } }));
      expect(response.status).toBe(415);
      expectPrivate(response);
    }
    for (const body of ["{", "", new Uint8Array([0xff]), new ReadableStream({ pull() { throw new Error(visitorCredential); } }, { highWaterMark: 0 })]) {
      const response = await app.fetch(accessRequest(authentication, { body }));
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(visitorCredential);
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
    expect((await app.fetch(accessRequest(authentication, { headers: { "Content-Type": "application/json; charset=utf-8" } }))).status).toBe(200);
  });

  it("caps declared and streamed byte lengths at exactly 4096 bytes", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    let reads = 0;
    const declared = accessRequest(authentication, {
      headers: { "Content-Length": String(MAX_ACCESS_BODY_BYTES + 1) },
      body: new ReadableStream({ pull() { reads++; throw new Error("Must not read an oversized declared body."); } }, { highWaterMark: 0 }),
    });
    expect((await app.fetch(declared)).status).toBe(413);
    expect(reads).toBe(0);
    let cancelled = false;
    let chunk = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new TextEncoder().encode(chunk++ === 0 ? " ".repeat(MAX_ACCESS_BODY_BYTES) : "x")); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const streamed = await app.fetch(accessRequest(authentication, { headers: { "Content-Length": "1" }, body: stream }));
    expect(streamed.status).toBe(413);
    expect(cancelled).toBe(true);
    expectPrivate(streamed);
    const multiByte = await app.fetch(accessRequest(authentication, { body: "é".repeat(MAX_ACCESS_BODY_BYTES / 2 + 1) }));
    expect(multiByte.status).toBe(413);
    expect(client).not.toHaveBeenCalled();
    const json = JSON.stringify(authentication);
    expect((await app.fetch(accessRequest(authentication, { body: json.padEnd(MAX_ACCESS_BODY_BYTES) }))).status).toBe(200);
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("does not delay body-size rejection when stream cancellation stalls or rejects", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const cancel of [() => new Promise<void>(() => {}), () => Promise.reject(new Error(visitorCredential))]) {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(MAX_ACCESS_BODY_BYTES + 1)); }, cancel,
      }, { highWaterMark: 0 });
      const response = await app.fetch(accessRequest(authentication, { body: stream }));
      expect(response.status).toBe(413);
      expect(await response.text()).not.toContain(visitorCredential);
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
  });

  it("isolates concurrent visitors and does not retain a credential after success", async () => {
    const seen: unknown[] = [];
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => { release = resolve; });
    const client: ProviderAccessClient = async (input, credential) => {
      seen.push(credential);
      if (seen.length === 2) release();
      await bothStarted;
      return evidence(parseAccessRequest(input));
    };
    const app = createProviderRoutes({ accessClient: client });
    const responses = await Promise.all([
      app.fetch(accessRequest()),
      app.fetch(accessRequest(authentication, { headers: { Authorization: `Bearer ${otherCredential}` } })),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(seen).toEqual([visitorCredential, otherCredential]);
    for (const response of responses) {
      const text = await response.text();
      expect(text).not.toContain(visitorCredential);
      expect(text).not.toContain(otherCredential);
    }
    const next = accessRequest();
    next.headers.delete("Authorization");
    expect((await app.fetch(next)).status).toBe(401);
    expect(seen).toHaveLength(2);
  });

  it("forwards caller cancellation to the active operation", async () => {
    const controller = new AbortController();
    let started!: () => void;
    const active = new Promise<void>((resolve) => { started = resolve; });
    let observedSignal: AbortSignal | undefined;
    const client: ProviderAccessClient = async (input, _credential, signal) => {
      observedSignal = signal;
      started();
      await new Promise<void>((resolve) => signal!.addEventListener("abort", () => resolve(), { once: true }));
      return { ...evidence(parseAccessRequest(input)), status: "not-verified", failure: {
        code: "cancelled", message: "The operation was cancelled. Already-initiated upstream work or charges can remain unknown.", remoteOutcome: "unknown",
      } };
    };
    const pending = createProviderRoutes({ accessClient: client }).fetch(accessRequest(authentication, { signal: controller.signal }));
    await active;
    controller.abort();
    expect(observedSignal?.aborted).toBe(true);
    const response = await pending;
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: {
      code: "cancelled", message: "Provider access was cancelled. Already-initiated upstream work or charges can remain unknown.",
    } });
    expectPrivate(response);
  });

  it("rejects pre-aborted requests without reading their body or calling the client", async () => {
    const controller = new AbortController();
    controller.abort(new Error(visitorCredential));
    let reads = 0;
    const body = new ReadableStream({ pull() { reads++; throw new Error(visitorCredential); } }, { highWaterMark: 0 });
    const client = clientFixture();
    const response = await createProviderRoutes({ accessClient: client }).fetch(accessRequest(authentication, { body, signal: controller.signal }));
    expect(response.status).toBe(408);
    expect(await response.text()).not.toContain(visitorCredential);
    expect(reads).toBe(0);
    expect(client).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("aborts a stalled request body without waiting for its cancellation hook", async () => {
    const controller = new AbortController();
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    let cancelled = false;
    const body = new ReadableStream({
      pull() { started(); return new Promise<void>(() => {}); },
      cancel() { cancelled = true; return new Promise<void>(() => {}); },
    }, { highWaterMark: 0 });
    const client = clientFixture();
    const pending = createProviderRoutes({ accessClient: client }).fetch(accessRequest(authentication, { body, signal: controller.signal }));
    await reading;
    controller.abort(new Error(visitorCredential));
    const response = await pending;
    expect(response.status).toBe(408);
    expect(await response.text()).not.toContain(visitorCredential);
    expect(cancelled).toBe(true);
    expect(client).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("times out stalled ingress and a client that ignores abort under one HTTP deadline", async () => {
    const original = globalThis.setTimeout;
    const timer = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, ms?: number) => {
      return original(callback, ms === ACCESS_TIMEOUT_MS ? 5 : ms);
    }) as typeof setTimeout);
    try {
      const client = clientFixture();
      let cancelled = false;
      const body = new ReadableStream({
        pull() { return new Promise<void>(() => {}); },
        cancel() { cancelled = true; return new Promise<void>(() => {}); },
      }, { highWaterMark: 0 });
      const ingress = await createProviderRoutes({ accessClient: client }).fetch(accessRequest(authentication, { body }));
      expect(ingress.status).toBe(408);
      expect(await ingress.json()).toEqual({ error: {
        code: "timeout", message: "Provider access timed out. Already-initiated upstream work or charges can remain unknown.",
      } });
      expect(cancelled).toBe(true);
      expect(client).not.toHaveBeenCalled();
      expectPrivate(ingress);
      let signal: AbortSignal | undefined;
      const stubbornClient: ProviderAccessClient = async (_input, _credential, operationSignal) => {
        signal = operationSignal;
        return new Promise<AccessResult>(() => {});
      };
      const response = await createProviderRoutes({ accessClient: stubbornClient }).fetch(accessRequest());
      expect(response.status).toBe(408);
      expect(signal?.aborted).toBe(true);
      expect(timer.mock.calls.filter((call) => call[1] === ACCESS_TIMEOUT_MS)).toHaveLength(2);
      expectPrivate(response);
    } finally {
      timer.mockRestore();
    }
  });

  it("removes the caller abort listener after completion and validation failure", async () => {
    const client = clientFixture();
    const app = createProviderRoutes({ accessClient: client });
    for (const body of [authentication, {}]) {
      const request = accessRequest(body);
      const remove = spyOn(request.signal, "removeEventListener");
      try {
        await app.fetch(request);
        expect(remove.mock.calls.some((call) => call[0] === "abort")).toBe(true);
      } finally {
        remove.mockRestore();
      }
    }
  });

  it("does not expose or log unexpected client messages, causes, or input-error messages", async () => {
    const logs = [spyOn(console, "error"), spyOn(console, "warn"), spyOn(console, "log")];
    try {
      for (const error of [new Error(visitorCredential, { cause: { credential: otherCredential } }), new AccessInputError("invalid-credential", visitorCredential)]) {
        const app = new Hono().route("/providers", createProviderRoutes({ accessClient: async () => { throw error; } }));
        const response = await app.fetch(accessRequest(authentication, { headers: { Origin: "http://localhost:3200" } }, "http://localhost/providers/access"));
        expect(response.status).toBe(error instanceof AccessInputError ? 401 : 500);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3200");
        const text = await response.text();
        expect(text).not.toContain(visitorCredential);
        expect(text).not.toContain(otherCredential);
        expectPrivate(response);
      }
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    } finally {
      for (const log of logs) log.mockRestore();
    }
  });

  it("keeps no-cache and origin behavior on unsupported provider paths and methods", async () => {
    const client = clientFixture();
    const app = new Hono().route("/providers", createProviderRoutes({ accessClient: client }));
    for (const [path, method] of [["/providers/access", "GET"], ["/providers/policy", "POST"], ["/providers/missing", "GET"]]) {
      const response = await app.request(`http://localhost${path}`, { method, headers: { Origin: "http://localhost:3200" } });
      expect(response.status).toBe(404);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3200");
      expectPrivate(response);
    }
    expect(client).not.toHaveBeenCalled();
  });
});
