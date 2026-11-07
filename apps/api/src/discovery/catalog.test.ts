// Catalog fixtures distinguish advertised routes from exact evaluation-profile evidence.
import { describe, expect, it } from "bun:test";
import { parseHuggingFaceModel, parseHuggingFaceSearch, parseOpenAIModel, parseOpenRouterModel } from "./catalog";
import type { SelectionRequest } from "./types";

const request = (provider: SelectionRequest["provider"], servingProvider: string | null = provider === "openai" ? null : "host-a"): SelectionRequest => ({ provider, modelId: "owner/model-a", servingProvider, profileId: "one-shot-json-v1", verification: "metadata" });
const mapping = { status: "live", task: "conversational", providerId: "native/model-a" };
const hub = (inferenceProviderMapping: unknown = { "host-a": mapping }) => ({ id: "owner/model-a", pipeline_tag: "text-generation", inferenceProviderMapping });
const hfProvider = { provider: "host-a", status: "live", context_length: 32000, pricing: { input: 0.037, output: 0.17 }, supports_structured_output: true };
const router = (providers: unknown = [hfProvider]) => ({ data: { id: "owner/model-a", providers } });
const endpoint = { model_id: "owner/model-a", provider_name: "Host A", tag: "host-a", status: 0, context_length: 32000, max_completion_tokens: 4096, supported_parameters: ["max_tokens", "response_format", "structured_outputs"], pricing: { prompt: "0.00000015", completion: "0.0000006" } };
const openRouter = (endpoints: unknown = [endpoint]) => ({ data: { id: "owner/model-a", canonical_slug: "owner/model-a-stable", name: "Model A", architecture: { input_modalities: ["text"], output_modalities: ["text"] }, endpoints } });

describe("Hugging Face public catalog search", () => {
  it("keeps catalog-only models, empty matches, and duplicate display names distinct", () => {
    expect(parseHuggingFaceSearch([], 2)).toEqual([]);
    const result = parseHuggingFaceSearch([
      { id: "owner/model-a", name: "Shared name", pipeline_tag: "text-generation", inferenceProviderMapping: [{ provider: "host-a", ...mapping }] },
      { id: "owner/model-b", name: "Shared name", inferenceProviderMapping: [] },
      { id: "owner/model-c" },
    ], 3);
    expect(result[0]).toEqual({ modelId: "owner/model-a", displayName: "Shared name", task: "text-generation", routes: [{ provider: "host-a", providerModelId: "native/model-a", status: "live", task: "conversational" }] });
    expect(result[1]?.routes).toEqual([]);
    expect(result[2]).toEqual({ modelId: "owner/model-c", displayName: "owner/model-c", task: null, routes: null });
    expect(parseHuggingFaceSearch([{ id: "a" }, { id: "b" }], 1)).toHaveLength(1);
  });

  it("rejects invalid success bodies and duplicate identities instead of returning empty results", () => {
    for (const input of [null, {}, { error: "unavailable" }, [null], [{}], [{ id: "a", inferenceProviderMapping: {} }], [{ id: "a" }, { id: "a" }], [{ id: "a", inferenceProviderMapping: [{ provider: "host-a" }, { provider: "host-a" }] }]]) {
      expect(() => parseHuggingFaceSearch(input, 2)).toThrow("Invalid model catalog response.");
    }
    expect(() => parseHuggingFaceSearch([], 0)).toThrow();
  });
});

describe("OpenAI model metadata", () => {
  it("does not invent capabilities, hosting, prices, or context from model membership", () => {
    const result = parseOpenAIModel({ id: "owner/model-a", object: "model", owned_by: "private-account", context_length: 32000, pricing: 0 }, request("openai"));
    expect(result).toMatchObject({ modelId: "owner/model-a", canonicalId: null, hosted: "unknown", exactRoute: true, contextWindow: null, maxOutputTokens: null, pricing: null, tokenParameter: "max_output_tokens" });
    expect(Object.values(result.capabilities)).toEqual(["unknown", "unknown", "unknown", "unknown"]);
    expect(JSON.stringify(result)).not.toContain("private-account");
  });

  it("rejects missing, mismatched, or non-model identities", () => {
    for (const input of [{ object: "model" }, { id: "other", object: "model" }, { id: "owner/model-a", object: "list" }, { id: "owner/model-a", object: "model", error: { message: "private" } }]) {
      expect(() => parseOpenAIModel(input, request("openai"))).toThrow();
    }
  });
});

describe("OpenRouter route metadata", () => {
  it("checks output capacity against the requested versioned profile", () => {
    const selected: SelectionRequest = { ...request("openrouter"), profileId: "one-shot-json-v2-high" };
    for (const max_completion_tokens of [4096, 16383, 16384, 32768]) {
      const parsed = parseOpenRouterModel(openRouter([{ ...endpoint, max_completion_tokens }]), selected);
      expect(parsed.capabilities.outputTokenLimit).toBe(max_completion_tokens < 16384 ? "unsupported" : "supported");
    }
  });

  it("uses exact endpoint metadata and preserves decimal prices without numeric coercion", () => {
    const result = parseOpenRouterModel(openRouter(), request("openrouter"));
    expect(result).toMatchObject({ canonicalId: "owner/model-a-stable", providerModelId: "owner/model-a", servingProvider: "host-a", providerDisplayName: "Host A", hosted: "available", routeStatus: 0, exactRoute: true, contextWindow: 32000, maxOutputTokens: 4096, tokenParameter: "max_tokens", structuredOutput: "advertised", pricing: { currency: "USD", unit: "token", input: "0.00000015", output: "0.0000006" } });
    expect(result.capabilities).toEqual({ textInput: "supported", textOutput: "supported", outputTokenLimit: "supported", jsonSchema: "unknown" });
    expect(result.pricing).toMatchObject({ source: "https://openrouter.ai/api/v1/models/owner/model-a/endpoints", retrievedAt: null });
  });

  it("requires the advertised parameter spelling and output capacity", () => {
    const parse = (changes: Record<string, unknown>) => parseOpenRouterModel(openRouter([{ ...endpoint, ...changes }]), request("openrouter"));
    expect(parse({ supported_parameters: ["max_completion_tokens", "max_tokens"] }).tokenParameter).toBe("max_completion_tokens");
    expect(parse({ supported_parameters: [] }).capabilities.outputTokenLimit).toBe("unknown");
    expect(parse({ max_completion_tokens: null }).capabilities.outputTokenLimit).toBe("unknown");
    expect(parse({ max_completion_tokens: 4095 }).capabilities.outputTokenLimit).toBe("unsupported");
    expect(parse({ supported_parameters: [] }).capabilities.jsonSchema).toBe("unsupported");
    expect(parse({ supported_parameters: ["response_format"] }).structuredOutput).toBe("unsupported");
    expect(parse({ supported_parameters: null }).structuredOutput).toBe("unknown");
  });

  it("blocks prefix ambiguity and does not substitute an available route", () => {
    const ambiguous = parseOpenRouterModel(openRouter([endpoint, { ...endpoint, tag: "host-a/region-b" }]), request("openrouter"));
    expect(ambiguous.exactRoute).toBe(false);
    const explicit = parseOpenRouterModel(openRouter([endpoint, { ...endpoint, tag: "host-a/region-b" }]), request("openrouter", "host-a/region-b"));
    expect(explicit.exactRoute).toBe(true);
    const absent = parseOpenRouterModel(openRouter([{ ...endpoint, tag: "host-b" }]), request("openrouter"));
    expect(absent).toMatchObject({ hosted: "unavailable", exactRoute: false, servingProvider: "host-a", providerModelId: null, pricing: null });
  });

  it("preserves unavailable metadata and does not infer status meanings", () => {
    const result = parseOpenRouterModel({ data: { id: "owner/model-a", endpoints: [{ model_id: "owner/model-a", tag: "host-a", status: -1 }] } }, request("openrouter"));
    expect(result).toMatchObject({ canonicalId: null, hosted: "unknown", routeStatus: -1, pricing: null, contextWindow: null, tokenParameter: null });
    expect(Object.values(result.capabilities)).toEqual(["unknown", "unknown", "unknown", "unknown"]);
    const noText = parseOpenRouterModel({ data: { ...openRouter().data, architecture: { input_modalities: ["image"], output_modalities: [] } } }, request("openrouter"));
    expect(noText.capabilities).toMatchObject({ textInput: "unsupported", textOutput: "unsupported" });
  });

  it("rejects duplicate routes, mismatched identities, and malformed supplied metadata", () => {
    for (const input of [
      { data: { ...openRouter().data, id: "other" } }, openRouter([endpoint, endpoint]), openRouter({}),
      openRouter([{ ...endpoint, model_id: "other" }]), openRouter([{ ...endpoint, model_id: undefined }]), openRouter([{ ...endpoint, tag: "" }]),
      openRouter([{ ...endpoint, context_length: "32000" }]), openRouter([{ ...endpoint, max_completion_tokens: -1 }]),
      openRouter([{ ...endpoint, status: "0" }]), openRouter([{ ...endpoint, supported_parameters: "max_tokens" }]),
      openRouter([{ ...endpoint, pricing: { prompt: 0.1 } }]), openRouter([{ ...endpoint, pricing: { prompt: "-1" } }]),
      openRouter([{ ...endpoint, pricing: { prompt: "0." + "1".repeat(65) } }]),
    ]) expect(() => parseOpenRouterModel(input, request("openrouter"))).toThrow("Invalid model catalog response.");
  });
});

describe("Hugging Face hosted model metadata", () => {
  it("requires both exact live chat route records and preserves native identity separately", () => {
    const result = parseHuggingFaceModel(hub(), router(), request("hugging-face"));
    expect(result).toMatchObject({ modelId: "owner/model-a", providerModelId: "native/model-a", servingProvider: "host-a", routeStatus: "live", hosted: "available", exactRoute: true, contextWindow: 32000, maxOutputTokens: null, tokenParameter: "max_tokens", structuredOutput: "advertised", pricing: { currency: "USD", unit: "million-tokens", input: "0.037", output: "0.17" } });
    expect(result.capabilities).toEqual({ textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" });
    expect(result.pricing).toMatchObject({ source: "https://router.huggingface.co/v1/models/owner/model-a", retrievedAt: null });
  });

  it("distinguishes missing metadata from explicit route absence or unavailability", () => {
    const parse = (mappingValue: unknown, providers: unknown = [hfProvider]) => parseHuggingFaceModel(hub(mappingValue), router(providers), request("hugging-face"));
    expect(parse(null)).toMatchObject({ hosted: "unknown", exactRoute: false, providerModelId: null });
    expect(parse({})).toMatchObject({ hosted: "unavailable", exactRoute: false });
    expect(parse({ "host-b": mapping })).toMatchObject({ hosted: "unavailable", exactRoute: false });
    expect(parse({ "host-a": mapping }, [])).toMatchObject({ hosted: "unavailable", exactRoute: false });
    expect(parse({ "host-a": mapping }, null)).toMatchObject({ hosted: "unknown", exactRoute: false });
    for (const changes of [{ status: "staging" }, { status: "error" }, { task: "text-to-image" }]) expect(parse({ "host-a": { ...mapping, ...changes } }).hosted).toBe("unavailable");
    expect(parse({ "host-a": mapping }, [{ ...hfProvider, status: "error" }]).hosted).toBe("unavailable");
    expect(parse({ "host-a": { ...mapping, status: "undocumented" } }).hosted).toBe("unknown");
  });

  it("preserves absent optional values and explicit structured-output rejection", () => {
    const result = parseHuggingFaceModel(hub(), router([{ provider: "host-a", status: "live" }]), request("hugging-face"));
    expect(result).toMatchObject({ hosted: "available", pricing: null, contextWindow: null, structuredOutput: "unknown", supportedParameters: null });
    expect(result.capabilities.jsonSchema).toBe("unknown");
    const unsupported = parseHuggingFaceModel(hub(), router([{ ...hfProvider, supports_structured_output: false }]), request("hugging-face"));
    expect(unsupported.structuredOutput).toBe("unsupported");
    expect(unsupported.capabilities.jsonSchema).toBe("unsupported");
  });

  it("rejects model substitution, duplicate routes, and malformed supplied fields", () => {
    for (const [hubBody, routerBody] of [
      [{ ...hub(), id: "other" }, router()], [hub(), { data: { ...router().data, id: "other" } }],
      [hub([{ provider: "host-a", ...mapping }]), router()], [hub(), router([hfProvider, hfProvider])],
      [hub(), router({})], [hub(), router([{ ...hfProvider, provider: "" }])],
      [hub(), router([{ ...hfProvider, supports_structured_output: "true" }])],
      [hub(), router([{ ...hfProvider, pricing: { input: "0.1" } }])],
      [hub(), router([{ ...hfProvider, pricing: { input: -1 } }])],
      [hub(), router([{ ...hfProvider, context_length: 1.5 }])],
    ]) expect(() => parseHuggingFaceModel(hubBody, routerBody, request("hugging-face"))).toThrow("Invalid model catalog response.");
  });
});
