// Fixture-only browser client checks protect credential separation and truthful response states.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  authenticateProvider,
  inspectProviderModel,
  loadProviderModelPolicy,
  probeProviderModel,
  ProviderApiError,
  searchProviderModels,
} from "./provider-api";

const credential = "sk-fixture-visitor-credential-1234";
const model = {
  provider: "openai" as const,
  modelId: "fixture-model",
  servingProvider: null,
  profileId: "one-shot-json-v1",
};
const checkedAt = "2026-11-08T00:00:00.000Z";
const originalFetch = globalThis.fetch;
const originalOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
let calls: { url: string; init: RequestInit }[];
let responses: Response[];

function selection(verification: "metadata" | "probe" = "metadata") {
  return {
    version: "1",
    policyId: "model-selection-v1",
    request: { ...model, verification },
    status: verification === "probe" ? "ready" : "needs-verification",
    checkedAt,
    expiresAt: "2026-11-08T00:05:00.000Z",
    metadata: {
      modelId: model.modelId,
      canonicalId: null,
      providerModelId: null,
      servingProvider: null,
      hosted: "unknown",
      exactRoute: true,
      contextWindow: null,
      maxOutputTokens: null,
    },
    probe: {
      status: verification === "probe" ? "verified" : "not-requested",
      reportedModelId: null,
      reportedServingProvider: null,
      usage: { inputTokens: null, outputTokens: null },
      outputLimitRequestAccepted: verification === "probe",
      nativeSchemaRequestAccepted: false,
      outcome: null,
    },
    compatibility: { compatible: verification === "probe" },
    budget: {
      maxInferenceRequests: verification === "probe" ? 1 : 0,
      maxOutputTokens: verification === "probe" ? 4096 : 0,
    },
    failure: null,
  };
}

beforeEach(() => {
  calls = [];
  responses = [];
  process.env.NEXT_PUBLIC_API_ORIGIN = "http://localhost:3201";
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(input), init: init ?? {} });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected fixture request");
    return response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_API_ORIGIN;
  else process.env.NEXT_PUBLIC_API_ORIGIN = originalOrigin;
});

describe("provider browser API", () => {
  it("keeps search anonymous and preserves successful empty results", async () => {
    responses.push(
      Response.json({
        version: "1",
        status: "complete",
        models: [],
        failure: null,
      }),
    );
    assert.deepEqual(await searchProviderModels("missing model", 8), {
      status: "complete",
      models: [],
      failure: null,
    });
    assert.equal(calls[0].url, "http://localhost:3201/providers/models/search");
    assert.equal(
      new Headers(calls[0].init.headers).has("authorization"),
      false,
    );
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      query: "missing model",
      limit: 8,
    });
    assert.equal(calls[0].init.credentials, "omit");
    assert.equal(calls[0].init.cache, "no-store");
    assert.equal(calls[0].init.redirect, "error");
  });

  it("keeps catalog-only entries and failed search distinct without retaining diagnostics", async () => {
    responses.push(
      Response.json({
        version: "1",
        status: "complete",
        models: [
          {
            modelId: "owner/model",
            displayName: "Model",
            task: null,
            routes: [],
          },
        ],
        failure: null,
      }),
    );
    assert.deepEqual(
      (await searchProviderModels("model", 8)).models[0].routes,
      [],
    );
    responses.push(
      Response.json({
        version: "1",
        status: "failed",
        models: [],
        failure: {
          code: "service-unavailable",
          message: "private diagnostic",
          remoteOutcome: "response-received",
        },
      }),
    );
    const result = await searchProviderModels("model", 8);
    assert.equal(result.status, "failed");
    assert.equal(result.failure?.code, "service-unavailable");
    assert.equal(JSON.stringify(result).includes("private diagnostic"), false);
  });

  it("sends a separate bearer credential for access without putting it in the body", async () => {
    responses.push(
      Response.json({
        version: "1",
        provider: "openai",
        operation: "authenticate",
        status: "authenticated",
        checkedAt,
        failure: null,
      }),
    );
    const controller = new AbortController();
    assert.equal(
      (await authenticateProvider("openai", credential, controller.signal))
        .status,
      "authenticated",
    );
    assert.equal(
      new Headers(calls[0].init.headers).get("authorization"),
      `Bearer ${credential}`,
    );
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      provider: "openai",
      operation: "authenticate",
    });
    assert.equal(String(calls[0].init.body).includes(credential), false);
    assert.equal(calls[0].init.signal, controller.signal);
  });

  it("separates metadata lookup from explicit consented probing", async () => {
    responses.push(
      Response.json(selection()),
      Response.json(selection("probe")),
    );
    await inspectProviderModel(
      { ...model, credential } as typeof model,
      credential,
    );
    const metadataBody = JSON.parse(calls[0].init.body as string);
    assert.equal(metadataBody.verification, "metadata");
    assert.equal("acceptCharges" in metadataBody, false);
    assert.equal("credential" in metadataBody, false);
    const result = await probeProviderModel(model, credential, true);
    assert.equal(result.status, "ready");
    assert.deepEqual(JSON.parse(calls[1].init.body as string), {
      ...model,
      verification: "probe",
      acceptCharges: true,
    });
    assert.throws(
      () => probeProviderModel(model, credential, false as true),
      ProviderApiError,
    );
    assert.equal(calls.length, 2);
  });

  it("loads profile choices and their caps from the policy rather than inventing model support", async () => {
    responses.push(
      Response.json({
        version: "2",
        policyId: "model-selection-v2",
        profiles: [
          {
            id: "one-shot-json-v1",
            reasoning: "provider-default",
            maxOutputTokens: 4096,
          },
          {
            id: "one-shot-schema-v2-max",
            reasoning: "max",
            maxOutputTokens: 16384,
          },
        ],
        maxSearchResults: 20,
        maxProbeInferenceRequests: 1,
        freshnessMs: 300000,
        reasoning: "Explicit effort support is model-dependent",
      }),
    );
    const policy = await loadProviderModelPolicy();
    assert.equal(policy.profiles[1].maxOutputTokens, 16384);
    assert.equal(policy.profiles[1].reasoning, "max");
    assert.equal(
      new Headers(calls[0].init.headers).has("authorization"),
      false,
    );
  });

  it("rejects malformed, contradictory, mismatched, and credential-reflecting success responses", async () => {
    for (const body of [
      {},
      {
        ...selection(),
        request: {
          ...model,
          modelId: "different-model",
          verification: "metadata",
        },
      },
      { ...selection(), status: "ready" },
      { ...selection(), private: credential },
      { ...selection(), private: btoa(credential) },
    ]) {
      responses.push(Response.json(body));
      await assert.rejects(
        inspectProviderModel(model, credential),
        (error: unknown) =>
          error instanceof ProviderApiError &&
          error.code === "unexpected-response" &&
          !error.message.includes(credential),
      );
    }
  });

  it("discards oversized and invalid JSON bodies without showing arbitrary response text", async () => {
    for (const response of [
      new Response("private upstream error", {
        headers: { "content-type": "application/json" },
      }),
      new Response("x".repeat(1_048_577), {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      responses.push(response);
      await assert.rejects(
        searchProviderModels("model", 8),
        (error: unknown) =>
          error instanceof ProviderApiError &&
          error.code === "unexpected-response" &&
          !error.message.includes("private upstream"),
      );
    }
  });

  it("fails before sending a credential to an insecure or path-bearing configured destination", async () => {
    for (const origin of [
      "http://remote.example",
      "https://example.invalid/path",
      "https://user:password@example.invalid",
      "https://example.invalid?destination=other",
    ]) {
      process.env.NEXT_PUBLIC_API_ORIGIN = origin;
      await assert.rejects(
        authenticateProvider("openai", credential),
        (error: unknown) =>
          error instanceof ProviderApiError && error.code === "configuration",
      );
    }
    assert.equal(calls.length, 0);
  });

  it("does not turn HTTP failure, network failure, or abort into successful access", async () => {
    responses.push(
      Response.json({ message: "private failure" }, { status: 403 }),
    );
    await assert.rejects(
      authenticateProvider("openai", credential),
      (error: unknown) =>
        error instanceof ProviderApiError && error.code === "http-error",
    );
    await assert.rejects(
      authenticateProvider("openai", credential),
      (error: unknown) =>
        error instanceof ProviderApiError && error.code === "network-error",
    );
    const controller = new AbortController();
    controller.abort();
    const previousCalls = calls.length;
    await assert.rejects(
      authenticateProvider("openai", credential, controller.signal),
      (error: unknown) =>
        error instanceof ProviderApiError && error.code === "cancelled",
    );
    assert.equal(calls.length, previousCalls);
  });
});
