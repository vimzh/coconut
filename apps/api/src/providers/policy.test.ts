// Fix access destinations, explicit probe consent, and credential-free policy disclosures.
import { describe, expect, it } from "bun:test";
import { createProviderAccessClient } from "./client";
import { ACCESS_POLICY, AccessInputError, buildProviderPlan, parseAccessRequest, parseCredential, safeAccessInputError } from "./policy";

const credential = "VISITOR_CREDENTIAL_ALPHA_0123456789";
const probe = { provider: "openai", operation: "probe", modelId: "fixture-model", servingProvider: null, acceptCharges: true };

describe("provider access policy", () => {
  it("keeps authentication sensitive, inference-free, and restricted to documented endpoints", () => {
    for (const [provider, url] of [
      ["openai", "https://api.openai.com/v1/models"],
      ["openrouter", "https://openrouter.ai/api/v1/key"],
      ["hugging-face", "https://huggingface.co/api/whoami-v2"],
    ]) {
      expect(buildProviderPlan(parseAccessRequest({ provider, operation: "authenticate" }))).toEqual({ url, method: "GET" });
    }
    expect(ACCESS_POLICY.ownerKeyFallback).toBe(false);
    expect(ACCESS_POLICY.persistence).toBe("none");
    expect(Object.isFrozen(ACCESS_POLICY.providers[0])).toBe(true);
  });

  it("pins one bounded probe without silently adding a catalog or alternate model", () => {
    const openai = buildProviderPlan(parseAccessRequest(probe));
    expect(JSON.parse(openai.body!)).toEqual({ model: "fixture-model", input: "Reply with OK.", max_output_tokens: 128, store: false });
    const router = buildProviderPlan(parseAccessRequest({ ...probe, provider: "openrouter", modelId: "owner/model", servingProvider: "explicit-provider" }));
    expect(router.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(router.body!)).toEqual({ model: "owner/model", messages: [{ role: "user", content: "Reply with OK." }], stream: false, max_completion_tokens: 128, provider: { only: ["explicit-provider"], allow_fallbacks: false, require_parameters: true }, plugins: [{ id: "web", enabled: false }] });
    const hf = buildProviderPlan(parseAccessRequest({ ...probe, provider: "hugging-face", modelId: "owner/model", servingProvider: "explicit-provider" }));
    expect(hf.url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect(JSON.parse(hf.body!)).toEqual({ model: "owner/model:explicit-provider", messages: [{ role: "user", content: "Reply with OK." }], stream: false, max_tokens: 128 });
  });

  it("rejects ambiguous requests, missing consent, URLs/headers, and routing shortcuts", () => {
    for (const value of [
      null, [], {}, "request", new Date(),
      { provider: "other", operation: "authenticate" },
      { provider: "openai", operation: "automatic" },
      { provider: "openai", operation: "authenticate", apiKey: credential },
      { provider: "openai", operation: "authenticate", url: "https://example.com" },
      { ...probe, acceptCharges: false }, { ...probe, acceptCharges: "true" },
      { ...probe, modelId: "" }, { ...probe, modelId: "contains space" },
      { ...probe, servingProvider: "other" },
      { ...probe, provider: "openrouter", servingProvider: null },
      { ...probe, provider: "hugging-face", modelId: "owner/model:fastest", servingProvider: "explicit-provider" },
      ...["auto", "fastest", "cheapest", "preferred"].map((servingProvider) => ({ ...probe, provider: "hugging-face", servingProvider })),
    ]) expect(() => parseAccessRequest(value)).toThrow(AccessInputError);
  });

  it("accepts opaque bearer formats without assuming a provider-specific prefix", () => {
    expect(parseCredential(credential)).toBe(credential);
    expect(parseCredential("opaque/user+token==")).toBe("opaque/user+token==");
    for (const value of [undefined, null, "", "short", 123, "x".repeat(4097), "has whitespace between", "a\n" + credential, "Bearer " + credential]) {
      expect(() => parseCredential(value)).toThrow(AccessInputError);
    }
  });

  it("rejects data getters and reconstructs input errors without reflected messages", () => {
    let reads = 0;
    const value = { ...probe };
    Object.defineProperty(value, "provider", { get: () => { reads++; return credential; } });
    expect(() => parseAccessRequest(value)).toThrow(AccessInputError);
    expect(reads).toBe(0);
    const error = safeAccessInputError(new AccessInputError("invalid-input", credential));
    expect(error.code).toBe("invalid-input");
    expect(error.message).not.toContain(credential);
    expect(safeAccessInputError(new Error(credential)).message).not.toContain(credential);
  });

  it("rejects automatic OpenRouter models and plugin variants before any network call", async () => {
    let calls = 0;
    const client = createProviderAccessClient(async () => { calls++; return Response.json({}); });
    for (const modelId of ["openrouter/auto", "openrouter/auto-code", "openrouter/auto-beta", "openrouter/free", "openrouter/bodybuilder", "openrouter/fusion", "openrouter/pareto-code", "typesafe/jev-router", "nvidia/switchyard", "owner/model:online", "owner/model:nitro", "owner/model:floor", "owner/model:free"]) {
      await expect(client({ ...probe, provider: "openrouter", modelId, servingProvider: "explicit-provider" }, credential)).rejects.toThrow(AccessInputError);
    }
    expect(calls).toBe(0);
  });

  it("allows explicit OpenRouter-owned models without enabling its virtual selectors", () => {
    const request = parseAccessRequest({ ...probe, provider: "openrouter", modelId: "openrouter/owl-alpha", servingProvider: "explicit-provider" });
    expect(request.operation).toBe("probe");
    expect(JSON.parse(buildProviderPlan(request).body!).model).toBe("openrouter/owl-alpha");
  });
});
