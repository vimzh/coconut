// Discovery inputs keep catalog searches public and route selection explicit, bounded, and fresh.
import { describe, expect, it } from "bun:test";
import { DISCOVERY_POLICY, DiscoveryInputError, SELECTION_TTL_MS, modelMetadataUrls, modelSearchUrl, parseSearchRequest, parseSelectionRequest, selectionIsFresh } from "./policy";

const search = { query: "model-a", limit: 20 };
const selection = { provider: "openai", modelId: "model-a", servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" } as const;
const routed = { ...selection, provider: "openrouter", modelId: "owner/model-a", servingProvider: "host-a/region-b" } as const;

describe("public discovery search policy", () => {
  it("accepts bounded Unicode queries, trims surrounding spaces, and freezes results", () => {
    const result = parseSearchRequest({ query: "  模型 🥥  ", limit: 1 });
    expect(result).toEqual({ query: "模型 🥥", limit: 1 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(parseSearchRequest({ query: "🥥".repeat(80), limit: 20 }).query).toHaveLength(160);
    expect(parseSearchRequest(Object.assign(Object.create(null), search))).toEqual(search);
  });

  it("rejects empty, malformed, control-bearing queries and invalid result limits", () => {
    for (const query of [undefined, null, 1, [], "", "   ", "x".repeat(81), "🥥".repeat(81), "\ud800", "\udfff", "a\nmodel", "a\tmodel", "a\u0000model", "a\u007fmodel", "a\u0085model"]) {
      expect(() => parseSearchRequest({ ...search, query })).toThrow(DiscoveryInputError);
    }
    for (const limit of [undefined, null, "1", 0, -1, 21, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseSearchRequest({ ...search, limit })).toThrow(DiscoveryInputError);
    }
  });

  it("encodes query text as data while preserving the fixed anonymous endpoint and expansions", () => {
    const query = "模型 &limit=999#fragment https://elsewhere.invalid/?x=1";
    const url = new URL(modelSearchUrl(parseSearchRequest({ query, limit: 2 })));
    expect(url.origin).toBe("https://huggingface.co");
    expect(url.pathname).toBe("/api/models");
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    expect(url.hash).toBe("");
    expect(url.searchParams.get("search")).toBe(query);
    expect(url.searchParams.getAll("limit")).toEqual(["2"]);
    expect(url.searchParams.getAll("expand")).toEqual(["pipeline_tag", "inferenceProviderMapping"]);
    expect([...url.searchParams.keys()]).toEqual(["search", "limit", "expand", "expand"]);
  });
});

describe("strict discovery data records", () => {
  it("rejects missing, extra, symbol, inherited, and accessor fields without reading getters", () => {
    for (const [parse, input] of [[parseSearchRequest, search], [parseSelectionRequest, selection]] as const) {
      for (const malformed of [null, [], new Date(), "input", {}, Object.assign(Object.create(input), input), { ...input, url: "https://elsewhere.invalid" }, { ...input, credential: "private-marker" }, { ...input, [Symbol("extra")]: true }]) {
        expect(() => parse(malformed)).toThrow(DiscoveryInputError);
      }
      const nonEnumerable = { ...input };
      Object.defineProperty(nonEnumerable, "hidden", { value: true, enumerable: false });
      expect(() => parse(nonEnumerable)).toThrow(DiscoveryInputError);
      for (const field of Object.keys(input)) {
        let reads = 0;
        const getter = { ...input };
        Object.defineProperty(getter, field, { get: () => { reads++; throw new Error("private-marker"); } });
        expect(() => parse(getter)).toThrow(DiscoveryInputError);
        expect(reads).toBe(0);
        const setter = { ...input };
        Object.defineProperty(setter, field, { set: () => { reads++; } });
        expect(() => parse(setter)).toThrow(DiscoveryInputError);
        expect(reads).toBe(0);
      }
    }
  });
});

describe("explicit model selection policy", () => {
  it("enumerates profile-specific probe limits without changing selection or consent fields", () => {
    expect(DISCOVERY_POLICY.profiles).toHaveLength(16);
    expect(Object.isFrozen(DISCOVERY_POLICY.profiles)).toBe(true);
    for (const profile of DISCOVERY_POLICY.profiles) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(parseSelectionRequest({ ...selection, profileId: profile.id }).profileId).toBe(profile.id);
      expect(profile.maxOutputTokens).toBe(profile.reasoning === "provider-default" ? 4096 : 16384);
      expect(() => parseSelectionRequest({ ...selection, profileId: profile.id, verification: "probe" })).toThrow(DiscoveryInputError);
    }
  });

  it("accepts each provider and profile without inference consent in metadata mode", () => {
    for (const profileId of ["one-shot-json-v1", "one-shot-schema-v1"] as const) {
      for (const input of [selection, routed, { ...routed, provider: "hugging-face" }] as const) {
        const result = parseSelectionRequest({ ...input, profileId });
        expect(result).toEqual({ ...input, profileId });
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.hasOwn(result, "acceptCharges")).toBe(false);
      }
    }
    expect(parseSelectionRequest(Object.assign(Object.create(null), selection))).toEqual(selection);
    expect(parseSelectionRequest({ ...routed, modelId: "openrouter/owl-alpha" }).modelId).toBe("openrouter/owl-alpha");
  });

  it("requires explicit probe consent and rejects consent or overrides in metadata mode", () => {
    const probe = { ...selection, verification: "probe", acceptCharges: true } as const;
    expect(parseSelectionRequest(probe)).toEqual(probe);
    for (const acceptCharges of [false, "true", 1, null]) {
      try {
        parseSelectionRequest({ ...probe, acceptCharges });
        throw new Error("Expected explicit consent rejection.");
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryInputError);
        expect((error as DiscoveryInputError).code).toBe("charge-authorization-required");
      }
    }
    for (const input of [
      { ...selection, verification: "probe" }, { ...selection, acceptCharges: true },
      { ...probe, temperature: 0 }, { ...selection, capabilities: { textInput: "supported" } },
      { ...selection, verification: "auto" }, { ...selection, provider: "unknown" },
      { ...selection, profileId: "unknown" }, { ...selection, profileId: null },
      { ...selection, model: selection.modelId },
    ]) expect(() => parseSelectionRequest(input)).toThrow(DiscoveryInputError);
  });

  it("rejects malformed model IDs, traversal, unexpected namespaces, and provider destinations", () => {
    for (const modelId of [undefined, null, 1, "", "contains space", "x".repeat(257), "/model", "owner/", "owner//model", "owner/./model", "owner/../model", "owner/%2e%2e", "owner/model?x=1", "owner/model#part", "https://elsewhere.invalid/model", "owner\\model", "model\nname"]) {
      expect(() => parseSelectionRequest({ ...routed, modelId })).toThrow(DiscoveryInputError);
    }
    for (const modelId of ["model", "owner/model/extra", "owner/.", "owner/.."]) {
      for (const provider of ["openrouter", "hugging-face"]) expect(() => parseSelectionRequest({ ...routed, provider, modelId })).toThrow(DiscoveryInputError);
    }
    expect(parseSelectionRequest({ ...selection, modelId: "x".repeat(256) }).modelId).toHaveLength(256);
    expect(() => parseSelectionRequest({ ...selection, servingProvider: "openai" })).toThrow(DiscoveryInputError);
  });

  it("rejects automatic models, variants, missing routes, and automatic serving policies", () => {
    for (const modelId of ["openrouter/auto", "OpenRouter/AUTO", "openrouter/auto-code", "openrouter/auto-beta", "openrouter/free", "openrouter/bodybuilder", "openrouter/fusion", "openrouter/pareto-code", "typesafe/jev-router", "nvidia/switchyard", "owner/model:online", "owner/model:nitro", "owner/model:floor", "owner/model:free"]) {
      expect(() => parseSelectionRequest({ ...routed, modelId })).toThrow(DiscoveryInputError);
    }
    expect(() => parseSelectionRequest({ ...routed, provider: "hugging-face", modelId: "owner/model:host-a" })).toThrow(DiscoveryInputError);
    for (const servingProvider of [undefined, null, "", "auto", "fastest", "cheapest", "preferred", "Host A", "https://elsewhere.invalid", "host:route", "h".repeat(129)]) {
      expect(() => parseSelectionRequest({ ...routed, servingProvider })).toThrow(DiscoveryInputError);
    }
    for (const servingProvider of ["host/../other", "host/.", "host//region", "host/"]) {
      expect(() => parseSelectionRequest({ ...routed, servingProvider })).toThrow(DiscoveryInputError);
    }
    expect(parseSelectionRequest({ ...routed, servingProvider: "h".repeat(128) }).servingProvider).toHaveLength(128);
  });

  it("builds fixed model metadata URLs and keeps routing identity outside the destination path", () => {
    expect(modelMetadataUrls(parseSelectionRequest({ ...selection, modelId: "ft:model-a:owner:run" }))).toEqual(["https://api.openai.com/v1/models/ft%3Amodel-a%3Aowner%3Arun"]);
    expect(modelMetadataUrls(parseSelectionRequest(routed))).toEqual(["https://openrouter.ai/api/v1/models/owner/model-a/endpoints"]);
    expect(modelMetadataUrls(parseSelectionRequest({ ...routed, provider: "hugging-face" }))).toEqual([
      "https://huggingface.co/api/models/owner/model-a?expand=pipeline_tag&expand=inferenceProviderMapping",
      "https://router.huggingface.co/v1/models/owner/model-a",
    ]);
    expect(Object.isFrozen(DISCOVERY_POLICY)).toBe(true);
    expect(DISCOVERY_POLICY).toMatchObject({ version: "2", policyId: "model-selection-v2", freshnessMs: 300000, maxSearchResults: 20, maxHttpAttempts: 3, maxProbeInferenceRequests: 1, maxProbeOutputTokens: 16384, persistence: "none" });
  });
});

describe("selection evidence freshness", () => {
  const start = Date.parse("2026-11-08T00:00:00.000Z");
  const evidence = { checkedAt: new Date(start).toISOString(), expiresAt: new Date(start + SELECTION_TTL_MS).toISOString() };

  it("accepts exactly five minutes and expires at the exclusive endpoint", () => {
    expect(SELECTION_TTL_MS).toBe(300000);
    expect(selectionIsFresh(evidence, start)).toBe(true);
    expect(selectionIsFresh(evidence, start + SELECTION_TTL_MS - 1)).toBe(true);
    expect(selectionIsFresh(evidence, start + SELECTION_TTL_MS)).toBe(false);
    expect(selectionIsFresh(evidence, start + SELECTION_TTL_MS + 1)).toBe(false);
    expect(selectionIsFresh(evidence, start - 1)).toBe(false);
    for (const delta of [-1, 1, -SELECTION_TTL_MS]) {
      expect(selectionIsFresh({ ...evidence, expiresAt: new Date(start + SELECTION_TTL_MS + delta).toISOString() }, start)).toBe(false);
    }
  });

  it("rejects missing or malformed timestamps and non-finite clocks", () => {
    for (const input of [null, undefined, [], "record", {}, { checkedAt: evidence.checkedAt }, { expiresAt: evidence.expiresAt }, { ...evidence, checkedAt: 1 }, { ...evidence, expiresAt: null }, { ...evidence, checkedAt: "invalid" }, { ...evidence, expiresAt: "invalid" }]) {
      expect(selectionIsFresh(input, start)).toBe(false);
    }
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(selectionIsFresh(evidence, now)).toBe(false);
    expect(selectionIsFresh(Object.create(evidence), start)).toBe(false);
  });

  it("rejects accessor timestamps without invoking their getters", () => {
    for (const field of ["checkedAt", "expiresAt"]) {
      let reads = 0;
      const input = { ...evidence };
      Object.defineProperty(input, field, { get: () => { reads++; throw new Error("private-marker"); } });
      expect(selectionIsFresh(input, start)).toBe(false);
      expect(reads).toBe(0);
    }
  });
});
