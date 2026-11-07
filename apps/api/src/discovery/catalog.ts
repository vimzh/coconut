// Normalize catalog claims without turning hosting metadata into visitor permission or schema proof.
import { getProfile, type CapabilityState } from "../protocol";
import { modelMetadataUrls } from "./policy";
import type { AdvertisedRoute, ModelMetadata, SearchModel, SelectionRequest } from "./types";

type Data = Record<string, unknown>;
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const routePattern = /^[a-z0-9][a-z0-9._/-]{0,127}$/;

function invalid(): never { throw new Error("Invalid model catalog response."); }
function record(value: unknown): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const data = value as Data;
  if (data.error !== undefined && data.error !== null) invalid();
  return data;
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid(); }
function text(value: unknown, pattern?: RegExp): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 256 || value.trim() === "" || [...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || (pattern && !pattern.test(value))) invalid();
  return value;
}
function requiredText(value: unknown, pattern: RegExp): string { return text(value, pattern) ?? invalid(); }
function positiveInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : invalid();
}
function strings(value: unknown): readonly string[] | null {
  if (value === undefined || value === null) return null;
  const result = array(value).map((item) => requiredText(item, modelPattern));
  unique(result);
  return result;
}
function unique(values: readonly string[]): void { if (new Set(values).size !== values.length) invalid(); }
function matches(data: Data, request: SelectionRequest): void {
  if (requiredText(data.id, modelPattern) !== request.modelId) invalid();
}
function base(data: Data, request: SelectionRequest): ModelMetadata {
  matches(data, request);
  return {
    modelId: request.modelId, canonicalId: null, displayName: text(data.name) ?? request.modelId,
    providerModelId: null, servingProvider: request.servingProvider, providerDisplayName: null,
    routeStatus: null, hosted: "unknown", exactRoute: false,
    capabilities: { textInput: "unknown", textOutput: "unknown", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: null,
    supportedParameters: null, pricing: null,
  };
}

// List responses use arrays; model-detail responses key mappings by provider.
function huggingFaceRoutes(value: unknown, detail = false): readonly AdvertisedRoute[] | null {
  if (value === undefined || value === null) return null;
  const entries: Data[] = detail ? Object.entries(record(value)).map(([provider, item]) => ({ ...record(item), provider })) : array(value).map(record);
  const routes = entries.map((entry) => ({
    provider: requiredText(entry.provider, routePattern), providerModelId: text(entry.providerId, modelPattern),
    status: text(entry.status, modelPattern), task: text(entry.task, modelPattern),
  }));
  unique(routes.map((route) => route.provider));
  return routes;
}

export function parseHuggingFaceSearch(input: unknown, limit: number): readonly SearchModel[] {
  if (!Number.isSafeInteger(limit) || limit < 1) invalid();
  const models = array(input).map((item): SearchModel => {
    const data = record(item);
    const modelId = requiredText(data.id, modelPattern);
    return { modelId, displayName: text(data.name) ?? modelId, task: text(data.pipeline_tag, modelPattern), routes: huggingFaceRoutes(data.inferenceProviderMapping) };
  });
  unique(models.map((model) => model.modelId));
  return models.slice(0, limit);
}

export function parseOpenAIModel(input: unknown, request: SelectionRequest): ModelMetadata {
  const data = record(input);
  if (request.provider !== "openai" || request.servingProvider !== null || data.object !== "model") invalid();
  return { ...base(data, request), exactRoute: true, tokenParameter: "max_output_tokens" };
}

function modality(value: unknown): CapabilityState {
  const list = strings(value);
  return list === null ? "unknown" : list.includes("text") ? "supported" : "unsupported";
}
function price(value: unknown, numeric: boolean): string | null {
  if (value === undefined || value === null) return null;
  if (numeric) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) invalid();
    return String(value);
  }
  return typeof value === "string" && value.length <= 64 && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) ? value : invalid();
}
function pricing(value: unknown, numeric: boolean, request: SelectionRequest): ModelMetadata["pricing"] {
  if (value === undefined || value === null) return null;
  const data = record(value);
  return {
    currency: "USD", unit: numeric ? "million-tokens" : "token",
    input: price(data[numeric ? "input" : "prompt"], numeric), output: price(data[numeric ? "output" : "completion"], numeric),
    source: modelMetadataUrls(request).at(-1)!, retrievedAt: null,
  };
}

export function parseOpenRouterModel(input: unknown, request: SelectionRequest): ModelMetadata {
  if (request.provider !== "openrouter" || request.servingProvider === null) invalid();
  const data = record(record(input).data);
  const metadata = base(data, request);
  const architecture = data.architecture === undefined || data.architecture === null ? null : record(data.architecture);
  const endpoints = array(data.endpoints).map(record);
  const tags = endpoints.map((endpoint) => {
    if (requiredText(endpoint.model_id, modelPattern) !== request.modelId) invalid();
    return requiredText(endpoint.tag, routePattern);
  });
  unique(tags);
  const selected = endpoints.find((_, index) => tags[index] === request.servingProvider);
  const exactRoute = selected !== undefined && !tags.some((tag) => tag.startsWith(`${request.servingProvider}/`));
  const parameters = selected ? strings(selected.supported_parameters) : null;
  const tokenParameter = parameters?.includes("max_completion_tokens") ? "max_completion_tokens" : parameters?.includes("max_tokens") ? "max_tokens" : null;
  const maxOutputTokens = selected ? positiveInteger(selected.max_completion_tokens) : null;
  const status = selected?.status;
  if (status !== undefined && status !== null && (typeof status !== "number" || !Number.isSafeInteger(status))) invalid();
  const structuredOutput = parameters === null ? "unknown" : parameters.includes("response_format") && parameters.includes("structured_outputs") ? "advertised" : "unsupported";
  return {
    ...metadata, canonicalId: text(data.canonical_slug, modelPattern),
    providerModelId: selected ? text(selected.model_id, modelPattern) : null,
    providerDisplayName: selected ? text(selected.provider_name) : null,
    routeStatus: status ?? null, hosted: selected === undefined ? "unavailable" : status === 0 ? "available" : "unknown", exactRoute,
    contextWindow: selected ? positiveInteger(selected.context_length) : null, maxOutputTokens, tokenParameter,
    supportedParameters: parameters, pricing: selected ? pricing(selected.pricing, false, request) : null, structuredOutput,
    capabilities: {
      textInput: modality(architecture?.input_modalities), textOutput: modality(architecture?.output_modalities),
      outputTokenLimit: maxOutputTokens !== null && maxOutputTokens < getProfile(request.profileId).maxOutputTokens ? "unsupported" : tokenParameter !== null && maxOutputTokens !== null ? "supported" : "unknown",
      jsonSchema: structuredOutput === "unsupported" ? "unsupported" : "unknown",
    },
  };
}

export function parseHuggingFaceModel(hub: unknown, router: unknown, request: SelectionRequest): ModelMetadata {
  if (request.provider !== "hugging-face" || request.servingProvider === null) invalid();
  const data = record(hub);
  const metadata = base(data, request);
  const routes = huggingFaceRoutes(data.inferenceProviderMapping, true);
  const route = routes?.find((entry) => entry.provider === request.servingProvider);
  const routerData = record(record(router).data);
  matches(routerData, request);
  const providers = routerData.providers === undefined || routerData.providers === null ? null : array(routerData.providers).map(record);
  const providerIds = providers?.map((provider) => requiredText(provider.provider, routePattern)) ?? null;
  if (providerIds !== null) unique(providerIds);
  const provider = providers?.find((_, index) => providerIds?.[index] === request.servingProvider);
  const status = provider ? text(provider.status, modelPattern) : null;
  const flag = provider?.supports_structured_output;
  if (flag !== undefined && flag !== null && typeof flag !== "boolean") invalid();
  let hosted: ModelMetadata["hosted"] = "unknown";
  if ((routes !== null && route === undefined) || (providers !== null && provider === undefined)
    || (route?.task !== null && route?.task !== undefined && route.task !== "conversational")
    || (route?.status !== null && route?.status !== undefined && ["staging", "error"].includes(route.status)) || status === "error") hosted = "unavailable";
  else if (route?.status === "live" && route.task === "conversational" && status === "live") hosted = "available";
  const textSupport = hosted === "available" ? "supported" : "unknown";
  return {
    ...metadata, providerModelId: route?.providerModelId ?? null,
    routeStatus: status ?? route?.status ?? null, hosted, exactRoute: route !== undefined && provider !== undefined,
    contextWindow: provider ? positiveInteger(provider.context_length) : null,
    tokenParameter: "max_tokens", pricing: provider ? pricing(provider.pricing, true, request) : null,
    structuredOutput: flag === true ? "advertised" : flag === false ? "unsupported" : "unknown",
    capabilities: { textInput: textSupport, textOutput: textSupport, outputTokenLimit: "unknown", jsonSchema: flag === false ? "unsupported" : "unknown" },
  };
}
