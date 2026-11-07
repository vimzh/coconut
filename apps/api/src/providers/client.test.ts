// Transport fixtures prove request bounds and secret isolation without live services.
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { Models } from "openai/resources/models";
import { Responses } from "openai/resources/responses/responses";
import { checkProviderAccess, createProviderAccessClient } from "./client";
import { ACCESS_TIMEOUT_MS, AccessInputError, MAX_PROVIDER_RESPONSE_BYTES } from "./policy";
import { FAILURE_MESSAGES } from "./responses";
import type { AccessRequest, AccessResult, ProviderId } from "./types";

const credential = "fixture-visitor-token-abcdefghijkl";
const auth = (provider: ProviderId = "openai"): AccessRequest => ({ provider, operation: "authenticate" });
const probe = (provider: ProviderId = "openai"): AccessRequest => ({
  provider, operation: "probe", modelId: provider === "openai" ? "fixture-model" : "fixture/model",
  servingProvider: provider === "openai" ? null : "fixture-provider", acceptCharges: true,
});
const authBodies = {
  openai: { object: "list", data: [] },
  openrouter: { data: { label: "discard-me", usage: 999 } },
  "hugging-face": { type: "user", name: "discard-me" },
};
const probeBodies = {
  openai: {
    model: "fixture-model", status: "completed",
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "OK" }] }],
    usage: { input_tokens: 4, output_tokens: 1 },
  },
  openrouter: {
    model: "fixture/model", provider: "fixture-provider",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "OK" } }],
    usage: { prompt_tokens: 4, completion_tokens: 1 },
  },
  "hugging-face": {
    model: "fixture/model", provider: "fixture-provider",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "OK" } }],
    usage: { prompt_tokens: 4, completion_tokens: 1 },
  },
};

function assertSafeFailure(result: AccessResult, code: NonNullable<AccessResult["failure"]>["code"], outcome: NonNullable<AccessResult["failure"]>["remoteOutcome"] = "response-received") {
  expect(result.status).toBe("not-verified");
  expect(result.failure).toEqual({ code, message: FAILURE_MESSAGES[code], remoteOutcome: outcome });
  expect(result.reportedModelId).toBeNull();
  expect(result.reportedServingProvider).toBeNull();
  expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  expect(JSON.stringify(result)).not.toContain(credential);
}

async function waitUntil(condition: () => boolean): Promise<void> {
  const deadline = performance.now() + 1000;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error("Expected transport progress did not occur.");
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

afterEach(() => mock.restore());

describe("single-attempt provider access transport", () => {
  it("uses the official SDK resource methods without automatic catalog pagination", async () => {
    const list = spyOn(Models.prototype, "list");
    const create = spyOn(Responses.prototype, "create");
    const fetcher = mock(async (url: string) => Response.json(url.endsWith("/models") ? authBodies.openai : probeBodies.openai));
    const client = createProviderAccessClient(fetcher);
    expect((await client(auth(), credential)).status).toBe("authenticated");
    expect((await client(probe(), credential)).status).toBe("inference-verified");
    expect(list).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
    it(`authenticates ${provider} without inference or retained account data`, async () => {
      const fetcher = mock(async () => Response.json(authBodies[provider]));
      const result = await createProviderAccessClient(fetcher)(auth(provider), credential);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe({
        openai: "https://api.openai.com/v1/models",
        openrouter: "https://openrouter.ai/api/v1/key",
        "hugging-face": "https://huggingface.co/api/whoami-v2",
      }[provider]);
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.redirect).toBe("manual");
      expect(init.credentials).toBe("omit");
      expect(init.headers).toEqual({ Authorization: `Bearer ${credential}` });
      expect(result.status).toBe("authenticated");
      expect(result.failure).toBeNull();
      expect(result.httpStatus).toBe(200);
      expect(result.requestId).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
      expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);
      expect(result.budget).toEqual({ maxHttpAttempts: 1, maxInferenceRequests: 0, maxOutputTokens: 0, timeoutMs: 20000 });
      expect(JSON.stringify(result)).not.toContain("discard-me");
      expect(JSON.stringify(result)).not.toContain(credential);
    });

    it(`probes exactly the ${provider} model and route with explicit bounded charges`, async () => {
      const fetcher = mock(async () => Response.json(probeBodies[provider]));
      const result = await createProviderAccessClient(fetcher)(probe(provider), credential);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe({
        openai: "https://api.openai.com/v1/responses",
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        "hugging-face": "https://router.huggingface.co/v1/chat/completions",
      }[provider]);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ Authorization: `Bearer ${credential}`, "Content-Type": "application/json" });
      expect(init.redirect).toBe("manual");
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(provider === "openai" ? "fixture-model" : provider === "openrouter" ? "fixture/model" : "fixture/model:fixture-provider");
      if (provider === "openai") {
        expect(body).toEqual({ model: "fixture-model", input: "Reply with OK.", max_output_tokens: 128, store: false });
      } else {
        expect(body.stream).toBe(false);
        expect(body.messages).toEqual([{ role: "user", content: "Reply with OK." }]);
        if (provider === "openrouter") {
          expect(body.provider).toEqual({ only: ["fixture-provider"], allow_fallbacks: false, require_parameters: true });
          expect(body.max_completion_tokens).toBe(128);
        } else expect(body.max_tokens).toBe(128);
      }
      expect(result.status).toBe("inference-verified");
      expect(result.failure).toBeNull();
      expect(result.requestedModelId).toBe(provider === "openai" ? "fixture-model" : "fixture/model");
      expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 1 });
      expect(result.budget).toEqual({ maxHttpAttempts: 1, maxInferenceRequests: 1, maxOutputTokens: 128, timeoutMs: 20000 });
      expect(JSON.stringify(result)).not.toContain(credential);
      expect(JSON.stringify(result)).not.toContain("output_text");
    });
  }

  it("rejects invalid input and missing credentials without ambient-key fallback or network traffic", async () => {
    const fetcher = mock(async () => Response.json(authBodies.openai));
    const client = createProviderAccessClient(fetcher);
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = credential;
    try {
      await expect(client(auth(), undefined)).rejects.toBeInstanceOf(AccessInputError);
      await expect(checkProviderAccess(auth(), undefined)).rejects.toBeInstanceOf(AccessInputError);
      await expect(client({ ...auth(), credential }, credential)).rejects.toBeInstanceOf(AccessInputError);
      await expect(client({ ...probe(), acceptCharges: false }, credential)).rejects.toBeInstanceOf(AccessInputError);
      await expect(client(auth(), "bad token")).rejects.toBeInstanceOf(AccessInputError);
      for (const form of [credential, encodeURIComponent(credential), Buffer.from(credential).toString("base64")]) {
        await expect(client({ ...probe(), modelId: form }, credential)).rejects.toBeInstanceOf(AccessInputError);
      }
      await expect(client({ ...probe("openrouter"), servingProvider: credential }, credential)).rejects.toBeInstanceOf(AccessInputError);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });

  it("sanitizes unexpected local validation exceptions", async () => {
    const fetcher = mock(async () => Response.json(authBodies.openai));
    const poisoned = new Proxy({}, { ownKeys() { throw new Error(credential); } });
    try {
      await createProviderAccessClient(fetcher)(poisoned, credential);
      throw new Error("Expected local validation failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(AccessInputError);
      expect(String(error)).not.toContain(credential);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("ignores ambient SDK credentials, routing headers, endpoints, and debug logging", async () => {
    const ambient = "synthetic-ambient-owner-token-abcdef";
    const variables = {
      OPENAI_API_KEY: ambient,
      OPENAI_ADMIN_KEY: ambient,
      OPENAI_BASE_URL: "https://untrusted.invalid/v1",
      OPENAI_ORG_ID: "ambient-organization",
      OPENAI_PROJECT_ID: "ambient-project",
      OPENAI_CUSTOM_HEADERS: `Authorization: Bearer ${ambient}\nX-Private: ${ambient}\nOpenAI-Project: ambient-project`,
      OPENAI_LOG: "debug",
    };
    const previous = new Map(Object.keys(variables).map((key) => [key, process.env[key]]));
    const spies = ["log", "warn", "error", "info", "debug"].map((method) => spyOn(console, method as "log").mockImplementation(() => {}));
    const fetcher = mock(async (url: string) => Response.json(url.endsWith("/models") ? authBodies.openai : probeBodies.openai));
    try {
      Object.assign(process.env, variables);
      const client = createProviderAccessClient(fetcher);
      const results: AccessResult[] = [];
      for (const customHeaders of [variables.OPENAI_CUSTOM_HEADERS, "Invalid Header: value", "X-Invalid: value\u0007"]) {
        process.env.OPENAI_CUSTOM_HEADERS = customHeaders;
        const current = [await client(auth(), credential), await client(probe(), credential)];
        expect(current.map((result) => result.status)).toEqual(["authenticated", "inference-verified"]);
        expect(process.env.OPENAI_CUSTOM_HEADERS).toBe(customHeaders);
        results.push(...current);
      }
      expect(fetcher).toHaveBeenCalledTimes(6);
      for (const [index, call] of fetcher.mock.calls.entries()) {
        const [url, init] = call as unknown as [string, RequestInit];
        expect(url).toBe(`https://api.openai.com/v1/${index % 2 === 0 ? "models" : "responses"}`);
        expect(init.headers).toEqual(index % 2 === 0 ? { Authorization: `Bearer ${credential}` } : { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" });
        expect(init.redirect).toBe("manual");
        expect(init.credentials).toBe("omit");
      }
      expect(JSON.stringify(results)).not.toContain(ambient);
      expect(JSON.stringify(fetcher.mock.calls)).not.toContain(ambient);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  for (const [status, code] of [[401, "authentication-rejected"], [403, "permission-denied"], [402, "credit-or-quota-exhausted"], [404, "model-unavailable"], [429, "rate-limited"], [503, "service-unavailable"]] as const) {
    it(`categorizes HTTP ${status} without forwarding arbitrary errors or retrying`, async () => {
      const fetcher = mock(async () => Response.json({ error: { message: "discard-secret-marker" } }, { status }));
      const result = await createProviderAccessClient(fetcher)(probe(), credential);
      assertSafeFailure(result, code);
      expect(result.httpStatus).toBe(status);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain("discard-secret-marker");
    });
  }

  it("bounds and sanitizes HTTP failure bodies before the SDK reads them", async () => {
    let cancellations = 0;
    const oversized = new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PROVIDER_RESPONSE_BYTES)); controller.enqueue(new Uint8Array([32])); },
      cancel() { cancellations++; return new Promise(() => {}); },
    }), { status: 429 });
    const fetcher = mock(async () => oversized);
    const limited = await createProviderAccessClient(fetcher)(probe(), credential);
    assertSafeFailure(limited, "response-too-large");
    expect(limited.httpStatus).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cancellations).toBe(1);
    for (const body of [
      { error: { message: credential } },
      { error: { message: "discard-me" }, metadata: Buffer.from(credential).toString("base64") },
    ]) {
      const response = Response.json(body, { status: 401 });
      const result = await createProviderAccessClient(async () => response)(probe(), credential);
      assertSafeFailure(result, "credential-reflection");
      expect(result.httpStatus).toBe(401);
    }
    const malformed = await createProviderAccessClient(async () => new Response(new Uint8Array([0xff]), { status: 503 }))(probe(), credential);
    assertSafeFailure(malformed, "invalid-provider-response");
    expect(malformed.httpStatus).toBe(503);
  });

  it("rejects 2xx error bodies, malformed success, missing text, and unfinished output", async () => {
    for (const [body, code] of [
      [{ error: { code: "insufficient_quota", message: "discard-me" } }, "credit-or-quota-exhausted"],
      [{}, "invalid-provider-response"],
      [{ ...probeBodies.openai, output: [] }, "no-output"],
      [{ ...probeBodies.openai, status: "incomplete" }, "output-incomplete"],
    ] as const) {
      const result = await createProviderAccessClient(async () => Response.json(body))(probe(), credential);
      assertSafeFailure(result, code);
    }
    const malformed = await createProviderAccessClient(async () => new Response("not JSON"))(auth(), credential);
    assertSafeFailure(malformed, "invalid-provider-response");
    const invalidEncoding = await createProviderAccessClient(async () => new Response(new Uint8Array([0xff])))(auth(), credential);
    assertSafeFailure(invalidEncoding, "invalid-provider-response");
  });

  it("never follows redirects and cancels their bodies", async () => {
    let cancellations = 0;
    const response = new Response(new ReadableStream({ cancel() { cancellations++; } }), { status: 307, headers: { Location: "https://untrusted.invalid/" } });
    const fetcher = mock(async () => response);
    const result = await createProviderAccessClient(fetcher)(auth(), credential);
    assertSafeFailure(result, "redirect-blocked");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cancellations).toBe(1);
    expect(JSON.stringify(result)).not.toContain("untrusted");
  });

  it("rejects declared oversized bodies before reading and does not wait for stalled cancellation", async () => {
    let pulls = 0;
    let cancellations = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull() { pulls++; },
      cancel() { cancellations++; return new Promise(() => {}); },
    }, { highWaterMark: 0 });
    const response = new Response(stream, { headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1) } });
    const result = await createProviderAccessClient(async () => response)(auth(), credential);
    assertSafeFailure(result, "response-too-large");
    expect(pulls).toBe(0);
    expect(cancellations).toBe(1);
  });

  it("caps actual streamed bytes despite an absent or dishonest length and cancels the reader", async () => {
    for (const length of [undefined, "1"]) {
      let cancellations = 0;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(MAX_PROVIDER_RESPONSE_BYTES)); controller.enqueue(new Uint8Array([32])); },
        cancel() { cancellations++; return new Promise(() => {}); },
      });
      const result = await createProviderAccessClient(async () => new Response(stream, { headers: length ? { "content-length": length } : {} }))(auth(), credential);
      assertSafeFailure(result, "response-too-large");
      expect(cancellations).toBe(1);
    }
  });

  it("permits the exact byte limit without using unbounded response helpers", async () => {
    const json = JSON.stringify(authBodies.openai);
    const text = json + " ".repeat(MAX_PROVIDER_RESPONSE_BYTES - Buffer.byteLength(json));
    const response = new Response(text, { headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES) } });
    const jsonReader = spyOn(response, "json").mockRejectedValue(new Error(credential));
    const textReader = spyOn(response, "text").mockRejectedValue(new Error(credential));
    const result = await createProviderAccessClient(async () => response)(auth(), credential);
    expect(result.status).toBe("authenticated");
    expect(jsonReader).not.toHaveBeenCalled();
    expect(textReader).not.toHaveBeenCalled();
  });

  it("discards reflected raw, encoded, base64, and JSON-escaped authorization material", async () => {
    const special = "fixture-visitor/token-abcdefghijkl";
    for (const key of [credential, special]) {
      for (const form of [key, encodeURIComponent(key), Buffer.from(key).toString("base64")]) {
        const response = new Response(JSON.stringify({ ...authBodies.openai, metadata: form }).replaceAll("/", "\\/"));
        const result = await createProviderAccessClient(async () => response)(auth(), key);
        assertSafeFailure(result, "credential-reflection");
        expect(JSON.stringify(result)).not.toContain(key);
        expect(JSON.stringify(result)).not.toContain(form);
      }
    }
  });

  it("does not log or return transport errors, bodies, headers, stacks, or abort reasons", async () => {
    const spies = ["log", "warn", "error", "info", "debug"].map((method) => spyOn(console, method as "log").mockImplementation(() => {}));
    const fetcher = mock(async () => { throw new Error(`private failure ${credential}`); });
    const result = await createProviderAccessClient(fetcher)(auth(), credential);
    assertSafeFailure(result, "network-error", "unknown");
    expect(result.httpStatus).toBeNull();
    expect(Object.keys(result).sort()).toEqual([
      "budget", "checkedAt", "failure", "httpStatus", "operation", "provider", "reportedModelId",
      "reportedServingProvider", "requestId", "requestedModelId", "requestedServingProvider", "status", "usage", "version",
    ]);
    expect(JSON.stringify(result)).not.toContain("private failure");
    expect(fetcher).toHaveBeenCalledTimes(1);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("keeps simultaneous visitors' credentials, cancellation, and request IDs isolated", async () => {
    const secondCredential = "fixture-other-visitor-token-abcdef";
    const seen: string[] = [];
    const pending: ((response: Response) => void)[] = [];
    const client = createProviderAccessClient((_url, init) => {
      seen.push((init.headers as Record<string, string>).Authorization);
      return new Promise((resolve) => pending.push(resolve));
    });
    const controller = new AbortController();
    const first = client(auth(), credential, controller.signal);
    const second = client(auth(), secondCredential);
    await waitUntil(() => pending.length === 2);
    controller.abort(new Error(credential));
    pending[1](Response.json(authBodies.openai));
    const [a, b] = await Promise.all([first, second]);
    assertSafeFailure(a, "cancelled", "unknown");
    expect(b.status).toBe("authenticated");
    expect(a.requestId).not.toBe(b.requestId);
    expect(seen).toEqual([`Bearer ${credential}`, `Bearer ${secondCredential}`]);
    pending[0](Response.json({ error: credential }));
    expect(JSON.stringify([a, b])).not.toContain(secondCredential);
    const third = client(auth(), secondCredential);
    await waitUntil(() => pending.length === 3);
    pending[2](Response.json(authBodies.openai));
    expect((await third).status).toBe("authenticated");
    expect(seen[2]).toBe(`Bearer ${secondCredential}`);
  });

  it("returns pre-cancellation with zero network attempts", async () => {
    const controller = new AbortController();
    controller.abort(new Error(credential));
    const fetcher = mock(async () => Response.json(authBodies.openai));
    const result = await createProviderAccessClient(fetcher)(auth(), credential, controller.signal);
    assertSafeFailure(result, "cancelled", "not-sent");
    expect(result.httpStatus).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("settles caller abort even when fetch ignores its signal and cancels a late body", async () => {
    let finish: (response: Response) => void = () => {};
    let upstreamSignal: AbortSignal | undefined;
    let cancellations = 0;
    const fetcher = mock((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const controller = new AbortController();
    const operation = createProviderAccessClient(fetcher)(probe(), credential, controller.signal);
    await waitUntil(() => fetcher.mock.calls.length === 1);
    controller.abort(new Error(credential));
    assertSafeFailure(await operation, "cancelled", "unknown");
    expect(upstreamSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(new Response(new ReadableStream({ cancel() { cancellations++; } })));
    await waitUntil(() => cancellations === 1);
    expect(cancellations).toBe(1);
  });

  it("handles cancellation during a synchronously failing fetch without an unhandled rejection", async () => {
    const controller = new AbortController();
    const fetcher = mock(() => {
      controller.abort(new Error(credential));
      throw new Error(credential);
    });
    const result = await createProviderAccessClient(fetcher)(auth(), credential, controller.signal);
    assertSafeFailure(result, "cancelled", "unknown");
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("settles the independent 20-second deadline even when fetch ignores abort", async () => {
    let expire: (() => void) | undefined;
    const original = globalThis.setTimeout;
    spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, ms?: number) => {
      if (ms === ACCESS_TIMEOUT_MS) { expire ??= callback; return original(() => {}, 60_000); }
      return original(callback, ms);
    }) as typeof setTimeout);
    let upstreamSignal: AbortSignal | undefined;
    const fetcher = mock((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal;
      return new Promise<Response>(() => {});
    });
    const operation = createProviderAccessClient(fetcher)(probe(), credential);
    await waitUntil(() => fetcher.mock.calls.length === 1);
    expect(expire).toBeDefined();
    expire!();
    assertSafeFailure(await operation, "timeout", "unknown");
    expect(upstreamSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("applies the deadline to stalled body reads and bounds cancellation cleanup", async () => {
    let expire: (() => void) | undefined;
    const original = globalThis.setTimeout;
    spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, ms?: number) => {
      if (ms === ACCESS_TIMEOUT_MS) { expire ??= callback; return original(() => {}, 60_000); }
      return original(callback, ms);
    }) as typeof setTimeout);
    for (const status of [200, 429]) {
      expire = undefined;
      let reading: () => void = () => {};
      const started = new Promise<void>((resolve) => { reading = resolve; });
      let cancellations = 0;
      const response = new Response(new ReadableStream<Uint8Array>({
        pull() { reading(); return new Promise(() => {}); },
        cancel() { cancellations++; return new Promise(() => {}); },
      }, { highWaterMark: 0 }), { status });
      const operation = createProviderAccessClient(async () => response)(auth(), credential);
      await started;
      expire!();
      const result = await operation;
      assertSafeFailure(result, "timeout", "unknown");
      expect(result.httpStatus).toBe(status);
      expect(cancellations).toBe(1);
    }
  });

  it("sanitizes stream read failures", async () => {
    for (const status of [200, 503]) {
      const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error(credential)); } });
      const result = await createProviderAccessClient(async () => new Response(stream, { status }))(auth(), credential);
      assertSafeFailure(result, "network-error");
      expect(result.httpStatus).toBe(status);
    }
  });
});
