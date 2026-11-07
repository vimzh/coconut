// Exercise anonymous search and credentialed selection through the shared guarded HTTP boundary.
import { describe, expect, it, mock, spyOn } from "bun:test";
import { Hono } from "hono";
import { ACCESS_TIMEOUT_MS, MAX_ACCESS_BODY_BYTES } from "../providers/policy";
import { createProviderRoutes } from "../providers/routes";
import { DISCOVERY_POLICY, DiscoveryInputError, parseSearchRequest, parseSelectionRequest } from "./policy";
import type { ModelSearchClient, ModelSelectionClient, SearchRequest, SearchResult, SelectionRequest, SelectionResult } from "./types";

const credential = "synthetic-discovery-visitor-credential";
const otherCredential = "synthetic-discovery-other-credential";
const search: SearchRequest = { query: "fixture", limit: 5 };
const selection: SelectionRequest = {
  provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata",
};

function searchEvidence(request = search): SearchResult {
  return { version: "1", requestId: "fixture-search", checkedAt: "2026-11-08T00:00:00.000Z", request,
    source: "https://huggingface.co/api/models", status: "complete", models: [], httpAttempts: 1, httpStatus: 200, failure: null };
}

function selectionEvidence(request: SelectionRequest = selection): SelectionResult {
  return {
    version: "1", policyId: "model-selection-v1", requestId: "fixture-selection", checkedAt: "2026-11-08T00:00:00.000Z",
    expiresAt: "2026-11-08T00:05:00.000Z", request, metadata: null, status: "needs-verification",
    capabilities: { textInput: "unknown", textOutput: "unknown", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    compatibility: { compatible: false, unsupported: [], unverified: ["textInput", "textOutput", "outputTokenLimit"] },
    probe: { status: "not-requested", reportedModelId: null, reportedServingProvider: null,
      usage: { inputTokens: null, outputTokens: null }, outputLimitRequestAccepted: false, nativeSchemaRequestAccepted: false, outcome: null },
    contextFit: "not-checked", sources: [], httpAttempts: 1, httpStatus: 200,
    budget: { maxHttpAttempts: 3, maxInferenceRequests: 0, maxOutputTokens: 0, timeoutMs: 20000 }, blockers: [], failure: null,
  };
}

function fixtureClients() {
  return {
    searchClient: mock<ModelSearchClient>(async (input) => searchEvidence(parseSearchRequest(input))),
    selectionClient: mock<ModelSelectionClient>(async (input) => selectionEvidence(parseSelectionRequest(input))),
  };
}

function request(path: "search" | "select", body: unknown = path === "search" ? search : selection, init: RequestInit = {}, origin = "http://localhost"): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (path === "select") headers.set("Authorization", `Bearer ${credential}`);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new Request(`${origin}/models/${path}`, { method: "POST", body: JSON.stringify(body), ...init, headers });
}

function expectPrivate(response: Response): void {
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Vary")).toBe("Origin");
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
}

describe("model discovery HTTP routes", () => {
  it("returns the public policy without a client operation", async () => {
    const clients = fixtureClients();
    const app = new Hono().route("/providers", createProviderRoutes(clients));
    const response = await app.request("http://localhost/providers/models/policy");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DISCOVERY_POLICY);
    expect(clients.searchClient).not.toHaveBeenCalled();
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("passes only a normalized anonymous search and a cancellation signal", async () => {
    const clients = fixtureClients();
    const response = await createProviderRoutes(clients).fetch(request("search", { query: " fixture ", limit: 5 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(searchEvidence());
    expect(clients.searchClient.mock.calls[0]).toHaveLength(2);
    expect(clients.searchClient.mock.calls[0]?.[0]).toEqual(search);
    expect(clients.searchClient.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it("rejects every Authorization header before reading an anonymous search body", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes(clients);
    for (const authorization of ["", `Bearer ${credential}`, `Basic ${credential}`, `Bearer ${credential}, Bearer ${otherCredential}`]) {
      let reads = 0;
      const body = new ReadableStream({ pull() { reads++; throw new Error(credential); } }, { highWaterMark: 0 });
      const response = await app.fetch(request("search", search, { body, headers: { Authorization: authorization } }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("credential-not-permitted");
      expect(reads).toBe(0);
      expectPrivate(response);
    }
    expect(clients.searchClient).not.toHaveBeenCalled();
  });

  it("requires a fresh unambiguous bearer for each selection", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes(clients);
    expect((await app.fetch(request("select"))).status).toBe(200);
    for (const authorization of [undefined, "", "Bearer short", `Bearer ${credential}, Bearer ${otherCredential}`, `Basic ${credential}`]) {
      const input = request("select");
      if (authorization === undefined) input.headers.delete("Authorization");
      else input.headers.set("Authorization", authorization);
      input.headers.set("Cookie", `key=${credential}`);
      const response = await app.fetch(input);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain(credential);
      expectPrivate(response);
    }
    expect(clients.selectionClient).toHaveBeenCalledTimes(1);
    expect(clients.selectionClient.mock.calls[0]?.slice(0, 2)).toEqual([selection, credential]);
    expect(clients.selectionClient.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
  });

  it("separates metadata-only selection from an explicitly charge-approved profile probe", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes(clients);
    const probe = { ...selection, verification: "probe", acceptCharges: true };
    for (const input of [selection, probe]) {
      const response = await app.fetch(request("select", input));
      expect(response.status).toBe(200);
      expect((await response.json()).request).toEqual(input);
      expect(clients.selectionClient.mock.calls.at(-1)?.[0]).toEqual(input);
    }
    for (const input of [{ ...probe, acceptCharges: false }, { ...selection, verification: "probe" }, { ...selection, acceptCharges: true }]) {
      expect((await app.fetch(request("select", input))).status).toBe(400);
    }
    expect(clients.selectionClient).toHaveBeenCalledTimes(2);
    expect(clients.searchClient).not.toHaveBeenCalled();
  });

  it("rejects missing fields, overrides, routing ambiguity, and invalid catalog searches", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes(clients);
    const invalidSearches = [null, [], {}, { query: "fixture" }, { ...search, limit: 21 }, { ...search, limit: 1.5 },
      { ...search, query: "" }, { ...search, credential }, { ...search, url: "https://foreign.example" }];
    const invalidSelections = [null, {}, { ...selection, profileId: "unknown" }, { ...selection, modelId: "" },
      { ...selection, servingProvider: "auto" }, { ...selection, provider: "unknown" }, { ...selection, apiKey: credential },
      { ...selection, capabilities: {} }, { ...selection, provider: "openrouter", modelId: "owner/model" },
      { ...selection, provider: "hugging-face", modelId: "owner/model:auto", servingProvider: "route" }];
    for (const [path, inputs] of [["search", invalidSearches], ["select", invalidSelections]] as const) {
      for (const input of inputs) {
        const response = await app.fetch(request(path, input));
        expect(response.status).toBe(400);
        expect(await response.text()).not.toContain(credential);
        expectPrivate(response);
      }
    }
    expect(clients.searchClient).not.toHaveBeenCalled();
    expect(clients.selectionClient).not.toHaveBeenCalled();
  });

  it("enforces TLS, exact origins, and no query parameters on both discovery operations", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes({ ...clients, webOrigin: "https://web.example" });
    for (const path of ["search", "select"] as const) {
      const insecure = await app.fetch(request(path, undefined, {}, "http://api.example"));
      const foreign = await app.fetch(request(path, undefined, { headers: { Origin: "https://foreign.example" } }, "https://api.example"));
      const queried = request(path);
      const query = await app.fetch(new Request(`${queried.url}?key=${credential}`, queried));
      expect([insecure.status, foreign.status, query.status]).toEqual([400, 403, 400]);
      for (const response of [insecure, foreign, query]) {
        expect(await response.text()).not.toContain(credential);
        expectPrivate(response);
      }
      const allowed = await app.fetch(request(path, undefined, { headers: { Origin: "https://web.example" } }, "https://api.example"));
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://web.example");
    }
    expect(clients.searchClient).toHaveBeenCalledTimes(1);
    expect(clients.selectionClient).toHaveBeenCalledTimes(1);
  });

  it("requires JSON and enforces the same 4 KiB byte cap before either client", async () => {
    const clients = fixtureClients();
    const app = createProviderRoutes(clients);
    for (const path of ["search", "select"] as const) {
      expect((await app.fetch(request(path, undefined, { headers: { "Content-Type": "text/plain" } }))).status).toBe(415);
      for (const body of ["{", new Uint8Array([0xff])]) expect((await app.fetch(request(path, undefined, { body }))).status).toBe(400);
      let reads = 0;
      const body = new ReadableStream({ pull() { reads++; throw new Error(credential); } }, { highWaterMark: 0 });
      expect((await app.fetch(request(path, undefined, { body, headers: { "Content-Length": "4097" } }))).status).toBe(413);
      expect(reads).toBe(0);
      expect((await app.fetch(request(path, undefined, { body: "é".repeat(MAX_ACCESS_BODY_BYTES / 2 + 1) }))).status).toBe(413);
    }
    expect(clients.searchClient).not.toHaveBeenCalled();
    expect(clients.selectionClient).not.toHaveBeenCalled();
  });

  it("isolates simultaneous visitor credentials and does not substitute their selections", async () => {
    const seen: unknown[] = [];
    let release!: () => void;
    const both = new Promise<void>((resolve) => { release = resolve; });
    const selectionClient: ModelSelectionClient = async (input, key) => {
      seen.push(key);
      if (seen.length === 2) release();
      await both;
      return selectionEvidence(parseSelectionRequest(input));
    };
    const app = createProviderRoutes({ selectionClient });
    const second = { ...selection, modelId: "other-model", profileId: "one-shot-schema-v1" };
    const responses = await Promise.all([app.fetch(request("select")), app.fetch(request("select", second, { headers: { Authorization: `Bearer ${otherCredential}` } }))]);
    expect(seen).toEqual([credential, otherCredential]);
    expect((await responses[0]!.json()).request).toEqual(selection);
    expect((await responses[1]!.json()).request).toEqual(second);
  });

  it("rejects pre-aborted requests and cancels active search and selection operations", async () => {
    for (const path of ["search", "select"] as const) {
      const pre = new AbortController(); pre.abort(new Error(credential));
      const clients = fixtureClients();
      expect((await createProviderRoutes(clients).fetch(request(path, undefined, { signal: pre.signal }))).status).toBe(408);
      expect(clients.searchClient).not.toHaveBeenCalled();
      expect(clients.selectionClient).not.toHaveBeenCalled();
      let started!: () => void;
      const active = new Promise<void>((resolve) => { started = resolve; });
      let observed: AbortSignal | undefined;
      const stalled = (signal?: AbortSignal): Promise<never> => { observed = signal; started(); return new Promise(() => {}); };
      const controller = new AbortController();
      const app = createProviderRoutes({ searchClient: async (_input, signal) => stalled(signal), selectionClient: async (_input, _key, signal) => stalled(signal) });
      const pending = app.fetch(request(path, undefined, { signal: controller.signal }));
      await active; controller.abort(new Error(credential));
      const response = await pending;
      expect(response.status).toBe(408);
      expect((await response.json()).error.code).toBe("cancelled");
      expect(observed?.aborted).toBe(true);
      expectPrivate(response);
    }
  });

  it("shares one deadline across stalled ingress and clients that ignore abort", async () => {
    const original = globalThis.setTimeout;
    const timer = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, ms?: number) => original(callback, ms === ACCESS_TIMEOUT_MS ? 5 : ms)) as typeof setTimeout);
    try {
      for (const path of ["search", "select"] as const) {
        const clients = fixtureClients();
        let cancelled = false;
        const body = new ReadableStream({ pull() { return new Promise<void>(() => {}); }, cancel() { cancelled = true; return new Promise<void>(() => {}); } }, { highWaterMark: 0 });
        const ingress = await createProviderRoutes(clients).fetch(request(path, undefined, { body }));
        expect(ingress.status).toBe(408);
        expect(cancelled).toBe(true);
        expect(clients.searchClient).not.toHaveBeenCalled();
        expect(clients.selectionClient).not.toHaveBeenCalled();
        const stalled = createProviderRoutes({ searchClient: async () => new Promise(() => {}), selectionClient: async () => new Promise(() => {}) });
        const response = await stalled.fetch(request(path));
        expect(response.status).toBe(408);
        expect((await response.json()).error.code).toBe("timeout");
        expectPrivate(response);
      }
    } finally { timer.mockRestore(); }
  });

  it("reconstructs safe input errors and never logs unexpected upstream diagnostics", async () => {
    const logs = [spyOn(console, "error"), spyOn(console, "warn"), spyOn(console, "log")];
    try {
      const poisoned = new DiscoveryInputError();
      Object.assign(poisoned, { code: credential, message: otherCredential });
      for (const error of [new Error(credential, { cause: otherCredential }), poisoned, new DiscoveryInputError("charge-authorization-required")]) {
        const app = createProviderRoutes({ searchClient: async () => { throw error; }, selectionClient: async () => { throw error; } });
        for (const path of ["search", "select"] as const) {
          const response = await app.fetch(request(path));
          expect(response.status).toBe(error instanceof DiscoveryInputError ? 400 : 500);
          const text = await response.text();
          expect(text).not.toContain(credential);
          expect(text).not.toContain(otherCredential);
          expectPrivate(response);
        }
      }
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    } finally { for (const log of logs) log.mockRestore(); }
  });

  it("discards reflected credentials in selection inputs and injected client evidence", async () => {
    const clients = fixtureClients();
    expect((await createProviderRoutes(clients).fetch(request("select", { ...selection, modelId: credential }))).status).toBe(400);
    expect(clients.selectionClient).not.toHaveBeenCalled();
    for (const reflected of [credential, Buffer.from(credential).toString("base64")]) {
      const response = await createProviderRoutes({ selectionClient: async () => ({ ...selectionEvidence(), requestId: reflected }) }).fetch(request("select"));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(reflected);
    }
  });
});
