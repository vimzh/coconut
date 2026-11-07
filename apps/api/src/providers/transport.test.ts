// Shared-operation fixtures cover multi-request budgets and credential isolation.
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ACCESS_TIMEOUT_MS } from "./policy";
import { runProviderTransport } from "./transport";

const credential = "fixture-visitor-token-abcdefghijkl";
const url = "https://provider.example/models";

afterEach(() => mock.restore());

describe("bounded provider operations", () => {
  it("allows categorical HTTP-error evidence without accepting malformed success JSON", async () => {
    for (const status of [200, 401, 429, 503]) {
      const result = await runProviderTransport({ credential: null, maxAttempts: 1, fetcher: async () => new Response("not JSON", { status }) }, async transport => transport.readJson(await transport.send(url, {})));
      if (status === 200) expect(result).toMatchObject({ ok: false, code: "invalid-provider-response" });
      else expect(result).toMatchObject({ ok: true, value: null, httpStatus: status });
    }
  });

  it("rejects timeout overrides outside the explicit operation ceiling before sending", async () => {
    for (const timeoutMs of [0, -1, 180001, NaN, Infinity, 1.5]) {
      const fetcher = mock(async () => Response.json({}));
      await expect(runProviderTransport({ fetcher, credential: null, maxAttempts: 1, timeoutMs }, async () => undefined)).rejects.toThrow("Provider timeout");
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it("counts and bounds the actual sends before a fourth request can leave", async () => {
    const fetcher = mock(async () => Response.json({ ready: true }));
    const result = await runProviderTransport({ fetcher, credential, maxAttempts: 3 }, async (transport) => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        await transport.readJson(await transport.send(url, { method: "GET" }));
        expect(transport.attempts).toBe(attempt);
        expect(transport.httpStatus).toBe(200);
      }
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: false, code: "invalid-provider-response", remoteOutcome: "response-received", attempts: 3, httpStatus: 200 });
  });

  it("does not attribute a previous metadata status to a later network failure", async () => {
    const fetcher = mock(async () => {
      if (fetcher.mock.calls.length === 1) return Response.json({ ready: true });
      throw new Error("Discard this upstream error.");
    });
    const result = await runProviderTransport({ fetcher, credential, maxAttempts: 2 }, async (transport) => {
      await transport.readJson(await transport.send(url, { method: "GET" }));
      return transport.send(url, { method: "POST" });
    });
    expect(result).toEqual({ ok: false, code: "network-error", remoteOutcome: "unknown", attempts: 2, httpStatus: null });
  });

  it("records the current response status and independent per-response reads", async () => {
    const fetcher = mock(async () => Response.json({ attempt: fetcher.mock.calls.length }, { status: fetcher.mock.calls.length === 1 ? 200 : 201 }));
    const result = await runProviderTransport({ fetcher, credential, maxAttempts: 2 }, async (transport) => {
      const first = await transport.readJson(await transport.send(url, { method: "GET" }));
      const second = await transport.readJson(await transport.send(url, { method: "POST" }));
      return [first, second];
    });
    expect(result).toEqual({ ok: true, value: [{ attempt: 1 }, { attempt: 2 }], attempts: 2, httpStatus: 201 });
  });

  it("keeps anonymous operations anonymous and forces redirect and cookie bounds", async () => {
    const fetcher = mock(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("authorization")).toBe(false);
      expect(init.redirect).toBe("manual");
      expect(init.credentials).toBe("omit");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ ready: true });
    });
    const result = await runProviderTransport({ fetcher, credential: null, maxAttempts: 1 }, async (transport) => {
      return transport.readJson(await transport.send(url, { method: "GET", redirect: "follow", credentials: "include" }));
    });
    expect(result).toEqual({ ok: true, value: { ready: true }, attempts: 1, httpStatus: 200 });
  });

  it("rejects anonymous Authorization and a credential from another operation before sending", async () => {
    for (const selected of [null, credential]) {
      const fetcher = mock(async () => Response.json({}));
      const result = await runProviderTransport({ fetcher, credential: selected, maxAttempts: 1 }, (transport) => {
        return transport.send(url, { headers: { Authorization: "Bearer fixture-other-visitor" } });
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, code: "invalid-provider-response", remoteOutcome: "not-sent", attempts: 0, httpStatus: null });
    }
  });

  it("blocks raw and JSON-decoded credential reflection before returning any body", async () => {
    const escaped = [...credential].map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
    for (const body of [JSON.stringify({ secret: credential }), `{"secret":"${escaped}"}`]) {
      const result = await runProviderTransport({ fetcher: async () => new Response(body), credential, maxAttempts: 1 }, async (transport) => {
        return transport.readJson(await transport.send(url, {}));
      });
      expect(result).toEqual({ ok: false, code: "credential-reflection", remoteOutcome: "response-received", attempts: 1, httpStatus: 200 });
      expect(JSON.stringify(result)).not.toContain(credential);
    }
  });

  it("cancels unread response bodies without waiting for the cancel hook", async () => {
    let cancellations = 0;
    const response = new Response(new ReadableStream({ cancel() { cancellations++; return new Promise(() => {}); } }));
    const result = await runProviderTransport({ fetcher: async () => response, credential: null, maxAttempts: 1 }, async (transport) => {
      await transport.send(url, {});
      return "metadata-only";
    });
    expect(result).toEqual({ ok: true, value: "metadata-only", attempts: 1, httpStatus: 200 });
    expect(cancellations).toBe(1);
  });

  it("starts the whole-operation deadline before invoking work that ignores abort", async () => {
    let expire: (() => void) | undefined;
    const setTimer = globalThis.setTimeout;
    spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
      if (delay === ACCESS_TIMEOUT_MS) expire = callback;
      return setTimer(callback, delay);
    }) as typeof setTimeout);
    let observedSignal: AbortSignal | undefined;
    const pending = runProviderTransport({ credential: null, maxAttempts: 1 }, async (transport) => {
      expect(expire).toBeFunction();
      observedSignal = transport.signal;
      return new Promise<never>(() => {});
    });
    expire!();
    expect(await pending).toEqual({ ok: false, code: "timeout", remoteOutcome: "not-sent", attempts: 0, httpStatus: null });
    expect(observedSignal?.aborted).toBe(true);
  });
});
