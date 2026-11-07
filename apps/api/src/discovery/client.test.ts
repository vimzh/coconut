// Exercise complete selection flows while keeping catalog claims and charged checks distinct.
import { describe, expect, it } from "bun:test";
import { createModelSearchClient, createModelSelectionClient } from "./client";
import type { SelectionRequest } from "./types";
import type { ProviderFetch } from "../providers/transport";
import { ANSWER_SCHEMA } from "../protocol";

const credential = "sk-visitor-test-credential-123456";
const request = (provider: SelectionRequest["provider"] = "openai", verify = false, schema = false): SelectionRequest => ({
  provider, modelId: provider === "openai" ? "model-a" : "owner/model-a", servingProvider: provider === "openai" ? null : "host-a",
  profileId: schema ? "one-shot-schema-v1" : "one-shot-json-v1", ...(verify ? { verification: "probe", acceptCharges: true } : { verification: "metadata" }),
});
const answer = JSON.stringify({ label: "convex", explanation: "Compatibility check." });
const openAI = { id: "model-a", object: "model" };
const completed = {
  model: "model-a-snapshot", status: "completed", max_output_tokens: 4096,
  output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: answer }] }],
  text: { format: { type: "json_schema", name: "classification_answer_v1", strict: true, schema: ANSWER_SCHEMA } },
  usage: { input_tokens: 30, output_tokens: 12 },
};
const endpoint = { model_id: "owner/model-a", tag: "host-a", provider_name: "Host A", status: 0, context_length: 32000, max_completion_tokens: 8192, supported_parameters: ["max_tokens", "response_format", "structured_outputs"], pricing: { prompt: "0.0001", completion: "0.0002" } };
const orMetadata = (changes = {}) => ({ data: { id: "owner/model-a", architecture: { input_modalities: ["text"], output_modalities: ["text"] }, endpoints: [{ ...endpoint, ...changes }] } });
const hub = { id: "owner/model-a", inferenceProviderMapping: { "host-a": { status: "live", task: "conversational", providerId: "native/model-a" } } };
const hfMetadata = { data: { id: "owner/model-a", providers: [{ provider: "host-a", status: "live", supports_structured_output: true }] } };
const chat = { model: "native/model-snapshot", provider: "Host A", choices: [{ finish_reason: "stop", message: { role: "assistant", content: answer } }], usage: { prompt_tokens: 40, completion_tokens: 12 } };

function wire(bodies: unknown[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: ProviderFetch = async (url, init) => {
    calls.push({ url, init });
    if (calls.length > bodies.length) throw new Error("Unexpected extra request.");
    const body = bodies[calls.length - 1];
    return body instanceof Response ? body : Response.json(body);
  };
  return { calls, fetcher };
}

describe("public catalog search orchestration", () => {
  it("encodes search, sends no credential, and preserves catalog-only matches", async () => {
    const { calls, fetcher } = wire([[{ id: "owner/model-a" }]]);
    const result = await createModelSearchClient(fetcher)({ query: "model & 深", limit: 2 });
    expect(result).toMatchObject({ status: "complete", models: [{ modelId: "owner/model-a", routes: null }], httpAttempts: 1, httpStatus: 200, failure: null });
    expect(new URL(calls[0]!.url).searchParams.get("search")).toBe("model & 深");
    expect(new Headers(calls[0]!.init.headers).has("authorization")).toBe(false);
    expect(calls[0]!.init).toMatchObject({ method: "GET", redirect: "manual", credentials: "omit" });
  });

  it("distinguishes a successful empty catalog from failed or invalid upstream responses", async () => {
    for (const [body, status] of [[[], "complete"], [Response.json({ error: { message: "private failure" } }, { status: 503 }), "failed"], [{ unexpected: [] }, "failed"]] as const) {
      const { fetcher } = wire([body]);
      const result = await createModelSearchClient(fetcher)({ query: "absent", limit: 2 });
      expect(result.status).toBe(status);
      expect(result.models).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("private failure");
    }
  });

  it("rejects invalid input before network work and preserves cancellation", async () => {
    const { calls, fetcher } = wire([]);
    await expect(createModelSearchClient(fetcher)({ query: "test", limit: 21 })).rejects.toThrow();
    const signal = AbortSignal.abort();
    const result = await createModelSearchClient(fetcher)({ query: "test", limit: 1 }, signal);
    expect(result).toMatchObject({ status: "failed", httpAttempts: 0, failure: { code: "cancelled", remoteOutcome: "not-sent" } });
    expect(calls).toHaveLength(0);
  });

  it("does not mistake an unavailable search endpoint for an unavailable selected model", async () => {
    const { fetcher } = wire([Response.json({}, { status: 404 })]);
    const result = await createModelSearchClient(fetcher)({ query: "test", limit: 1 });
    expect(result.failure?.code).toBe("service-unavailable");
  });
});

describe("credentialed model selection", () => {
  it("retrieves OpenAI metadata through the SDK without inventing compatibility or making inference", async () => {
    const { calls, fetcher } = wire([openAI]);
    const result = await createModelSelectionClient(fetcher)(request(), credential);
    expect(result).toMatchObject({ status: "needs-verification", metadata: { contextWindow: null, pricing: null }, probe: { status: "not-requested" }, httpAttempts: 1, budget: { maxInferenceRequests: 0, maxOutputTokens: 0 }, contextFit: "not-checked" });
    expect(Object.values(result.capabilities)).toEqual(["unknown", "unknown", "unknown", "unknown"]);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/models/model-a");
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(`Bearer ${credential}`);
    expect(Date.parse(result.expiresAt) - Date.parse(result.checkedAt)).toBe(300000);
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it.each([false, true])("verifies the exact OpenAI profile with one charged request (schema=%s)", async (schema) => {
    const { calls, fetcher } = wire([openAI, completed]);
    const result = await createModelSelectionClient(fetcher)(request("openai", true, schema), credential);
    expect(result).toMatchObject({ status: "ready", failure: null, httpAttempts: 2, probe: { status: "verified", reportedModelId: "model-a-snapshot", usage: { inputTokens: 30, outputTokens: 12 }, outputLimitRequestAccepted: true } });
    expect(result.request.modelId).toBe("model-a");
    expect(result.metadata?.modelId).toBe("model-a");
    const body = JSON.parse(calls[1]!.init.body as string);
    expect(body).toMatchObject({ model: "model-a", store: false, max_output_tokens: 4096 });
    expect(body.text?.format?.type ?? null).toBe(schema ? "json_schema" : null);
    expect(result.probe.nativeSchemaRequestAccepted).toBe(schema);
    expect(result.sources).toEqual([calls[0]!.url, calls[1]!.url]);
  });

  it("does not turn conforming JSON with missing request acknowledgements into schema proof", async () => {
    const { fetcher } = wire([openAI, { ...completed, max_output_tokens: undefined, text: undefined }]);
    const result = await createModelSelectionClient(fetcher)(request("openai", true, true), credential);
    expect(result.status).not.toBe("ready");
    expect(result.capabilities.jsonSchema).toBe("unknown");
    expect(result.capabilities.outputTokenLimit).toBe("unknown");
  });

  it("keeps router metadata advertised and requires a separate profile probe", async () => {
    const { calls, fetcher } = wire([orMetadata()]);
    const result = await createModelSelectionClient(fetcher)(request("openrouter"), credential);
    expect(result).toMatchObject({ status: "needs-verification", compatibility: { compatible: true }, probe: { status: "not-requested" } });
    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0]!.init.headers).has("authorization")).toBe(false);
    expect(result.metadata?.pricing).toMatchObject({ source: calls[0]!.url, retrievedAt: result.checkedAt });
  });

  it("rejects a claimed output cap contradicted by reported usage", async () => {
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      const reply = provider === "openai" ? { ...completed, usage: { output_tokens: 4097 } } : { ...chat, usage: { completion_tokens: 4097 } };
      const bodies = provider === "openai" ? [openAI, reply] : provider === "openrouter" ? [orMetadata(), reply] : [hub, hfMetadata, reply];
      const { fetcher } = wire(bodies);
      const result = await createModelSelectionClient(fetcher)(request(provider, true, true), credential);
      expect(result).toMatchObject({ status: "failed", probe: { status: "not-verified", outputLimitRequestAccepted: false, nativeSchemaRequestAccepted: false, outcome: "output-limit-exceeded", usage: { outputTokens: 4097 } }, failure: { code: "invalid-provider-response" } });
      expect(result.capabilities.jsonSchema).not.toBe("supported");
    }
  });

  it.each(["max_tokens", "max_completion_tokens"])("preserves OR's advertised %s spelling and exact routing", async (parameter) => {
    const { calls, fetcher } = wire([orMetadata({ supported_parameters: [parameter, "response_format", "structured_outputs"] }), chat]);
    const result = await createModelSelectionClient(fetcher)(request("openrouter", true, true), credential);
    expect(result).toMatchObject({ status: "ready", httpAttempts: 2, metadata: { tokenParameter: parameter, structuredOutput: "advertised" }, probe: { reportedModelId: "native/model-snapshot", reportedServingProvider: "Host A", nativeSchemaRequestAccepted: true } });
    const body = JSON.parse(calls[1]!.init.body as string);
    expect(body[parameter]).toBe(4096);
    expect(body[parameter === "max_tokens" ? "max_completion_tokens" : "max_tokens"]).toBeUndefined();
    expect(body.provider).toEqual({ only: ["host-a"], allow_fallbacks: false, require_parameters: true });
  });

  it("uses two HF catalogs and at most one exact-provider profile check without inventing capacity", async () => {
    const { calls, fetcher } = wire([hub, hfMetadata, { ...chat, provider: undefined }]);
    const result = await createModelSelectionClient(fetcher)(request("hugging-face", true, true), credential);
    expect(result).toMatchObject({ status: "ready", httpAttempts: 3, metadata: { providerModelId: "native/model-a", maxOutputTokens: null }, probe: { reportedModelId: "native/model-snapshot", reportedServingProvider: null } });
    for (const call of calls.slice(0, 2)) expect(new Headers(call.init.headers).has("authorization")).toBe(false);
    expect(calls[2]!.url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect(JSON.parse(calls[2]!.init.body as string)).toMatchObject({ model: "owner/model-a:host-a", max_tokens: 4096 });
  });

  it("blocks explicit output/context/schema conflicts before any charged work", async () => {
    for (const changes of [{ max_completion_tokens: 4095 }, { context_length: 4096 }, { supported_parameters: ["max_tokens"] }]) {
      const { calls, fetcher } = wire([orMetadata(changes)]);
      const result = await createModelSelectionClient(fetcher)(request("openrouter", true, true), credential);
      expect(result).toMatchObject({ status: "blocked", probe: { status: "blocked" }, httpAttempts: 1, failure: null });
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(calls).toHaveLength(1);
    }
  });

  it("leaves missing hosting and required parameters unverified without sending inference", async () => {
    for (const changes of [{ status: undefined }, { supported_parameters: undefined }]) {
      const { calls, fetcher } = wire([orMetadata(changes)]);
      const result = await createModelSelectionClient(fetcher)(request("openrouter", true, true), credential);
      expect(result).toMatchObject({ status: "needs-verification", probe: { status: "blocked" }, httpAttempts: 1 });
      expect(calls).toHaveLength(1);
    }
    const { fetcher } = wire([{ id: "owner/model-a" }, hfMetadata]);
    const result = await createModelSelectionClient(fetcher)(request("hugging-face", true), credential);
    expect(result).toMatchObject({ status: "needs-verification", metadata: { hosted: "unknown", exactRoute: false }, httpAttempts: 2 });
  });

  it("preserves a changed permission failure after metadata instead of reusing catalog success", async () => {
    const { fetcher } = wire([openAI, Response.json({ error: { message: "private failure" } }, { status: 403 })]);
    const result = await createModelSelectionClient(fetcher)(request("openai", true), credential);
    expect(result).toMatchObject({ status: "failed", metadata: { modelId: "model-a" }, httpAttempts: 2, httpStatus: 403, probe: { status: "not-verified" }, failure: { code: "permission-denied", remoteOutcome: "response-received" } });
    expect(JSON.stringify(result)).not.toContain("private failure");
  });

  it("categorizes failures without retry and preserves uncertain remote outcomes", async () => {
    let calls = 0;
    const fetcher: ProviderFetch = async () => { if (++calls === 1) return Response.json(openAI); throw new Error("private network detail"); };
    const result = await createModelSelectionClient(fetcher)(request("openai", true), credential);
    expect(result).toMatchObject({ status: "failed", httpAttempts: 2, httpStatus: null, failure: { code: "network-error", remoteOutcome: "unknown" } });
    expect(calls).toBe(2);
    expect(JSON.stringify(result)).not.toContain("private network detail");
  });

  it("rejects raw or escaped reflected credentials before retaining any catalog or inference data", async () => {
    for (const reflected of [credential, credential.replaceAll("s", "\\u0073")]) {
      const body = new Response(`{"id":"model-a","object":"model","private":"${reflected}"}`, { headers: { "content-type": "application/json" } });
      const { fetcher } = wire([body]);
      const result = await createModelSelectionClient(fetcher)(request(), credential);
      expect(result).toMatchObject({ status: "failed", metadata: null, failure: { code: "credential-reflection" } });
      expect(JSON.stringify(result)).not.toContain(credential);
    }
  });

  it("requires current credentials and charge consent before all network activity", async () => {
    const { calls, fetcher } = wire([]);
    const client = createModelSelectionClient(fetcher);
    await expect(client(request(), null)).rejects.toThrow("Supply your own");
    await expect(client({ ...request("openai", true), acceptCharges: false }, credential)).rejects.toThrow("acknowledgement");
    await expect(client({ ...request(), modelId: credential }, credential)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("keeps concurrent visitor credentials isolated through SDK requests", async () => {
    const keys = [credential, "sk-second-visitor-credential-123456"];
    const observed: string[] = [];
    const client = createModelSelectionClient(async (_url, init) => {
      observed.push(new Headers(init.headers).get("authorization")!);
      await Promise.resolve();
      return Response.json(openAI);
    });
    const results = await Promise.all(keys.map((key) => client(request(), key)));
    expect(observed.sort()).toEqual(keys.map((key) => `Bearer ${key}`).sort());
    for (const result of results) for (const key of keys) expect(JSON.stringify(result)).not.toContain(key);
  });
});
