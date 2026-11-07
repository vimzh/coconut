// Resolve catalog evidence and one explicitly authorized profile check without retaining credentials.
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { checkCompatibility, getProfile, type CapabilityEvidence } from "../protocol";
import { requestOpenAI } from "../providers/openai";
import { parseCredential, safeAccessInputError } from "../providers/policy";
import { classifyHttpFailure, FAILURE_MESSAGES, reflectsCredential } from "../providers/responses";
import { runProviderTransport, TransportFailure, type ProviderFetch, type ProviderTransport } from "../providers/transport";
import { freezeData } from "../suites/generator";
import { parseHuggingFaceModel, parseHuggingFaceSearch, parseOpenAIModel, parseOpenRouterModel } from "./catalog";
import { DiscoveryInputError, modelMetadataUrls, modelSearchUrl, parseSearchRequest, parseSelectionRequest, SELECTION_TTL_MS } from "./policy";
import { buildProfileProbe, parseProfileProbe } from "./probe";
import type { DiscoveryFailure, ModelMetadata, ModelSearchClient, ModelSelectionClient, ProfileProbe, SelectionRequest } from "./types";

const unknownCapabilities: CapabilityEvidence = { textInput: "unknown", textOutput: "unknown", outputTokenLimit: "unknown", jsonSchema: "unknown" };
const unusedProbe: ProfileProbe = {
  status: "not-requested", reportedModelId: null, reportedServingProvider: null,
  usage: { inputTokens: null, outputTokens: null }, outputLimitRequestAccepted: false, nativeSchemaRequestAccepted: false, outcome: null,
};

async function responseData(transport: ProviderTransport, response: Response, modelOperation = true): Promise<unknown> {
  const data = await transport.readJson(response);
  if (!response.ok || (data !== null && typeof data === "object" && "error" in data && data.error !== null && data.error !== undefined)) {
    throw new TransportFailure(classifyHttpFailure(response.status, data, modelOperation));
  }
  return data;
}

function parseCatalog<T>(parse: () => T): T {
  try { return parse(); }
  catch { throw new TransportFailure("invalid-provider-response"); }
}

export function createModelSearchClient(fetcher: ProviderFetch = fetch): ModelSearchClient {
  return async (input, signal) => {
    const request = parseSearchRequest(input);
    const source = modelSearchUrl(request);
    const evidence = { version: "1" as const, requestId: crypto.randomUUID(), checkedAt: new Date().toISOString(), request, source };
    const outcome = await runProviderTransport({ fetcher, credential: null, signal, maxAttempts: 1 }, async (transport) => {
      const response = await transport.send(source, { method: "GET", headers: { Accept: "application/json" } });
      const data = await responseData(transport, response, false);
      return parseCatalog(() => parseHuggingFaceSearch(data, request.limit));
    });
    return freezeData(outcome.ok
      ? { ...evidence, status: "complete", models: outcome.value, httpAttempts: outcome.attempts, httpStatus: outcome.httpStatus, failure: null }
      : { ...evidence, status: "failed", models: [], httpAttempts: outcome.attempts, httpStatus: outcome.httpStatus,
        failure: { code: outcome.code, message: FAILURE_MESSAGES[outcome.code], remoteOutcome: outcome.remoteOutcome } });
  };
}

function selectionBlockers(metadata: ModelMetadata, request: SelectionRequest): string[] {
  const blockers: string[] = [];
  const profile = getProfile(request.profileId);
  if (request.provider !== "openai" && profile.reasoning !== "provider-default") blockers.push("Explicit reasoning efforts are supported only through direct OpenAI operations. Select a permitted provider or version-1 profile explicitly.");
  if (!metadata.exactRoute && metadata.hosted !== "unknown") blockers.push("The exact requested serving route is absent or ambiguous. Select an advertised leaf route explicitly.");
  if (metadata.hosted === "unavailable") blockers.push("The selected model has no available advertised conversational route.");
  if (metadata.contextWindow !== null && metadata.contextWindow <= profile.maxOutputTokens) blockers.push(`The advertised context window leaves no room for input after reserving the profile's ${profile.maxOutputTokens} output tokens.`);
  const compatibility = checkCompatibility(request.profileId, metadata.capabilities);
  if (compatibility.unsupported.length) blockers.push(`Unsupported profile requirements: ${compatibility.unsupported.join(", ")}. Select another permitted model, route, or profile explicitly.`);
  return blockers;
}

export function createModelSelectionClient(fetcher: ProviderFetch = fetch): ModelSelectionClient {
  return async (input, suppliedCredential, signal) => {
    const request = parseSelectionRequest(input);
    const profile = getProfile(request.profileId);
    let credential: string;
    try { credential = parseCredential(suppliedCredential); }
    catch (error) { throw safeAccessInputError(error); }
    if (reflectsCredential(JSON.stringify(request), credential)) throw new DiscoveryInputError();
    const checkedAt = new Date().toISOString();
    const sources = [...modelMetadataUrls(request)];
    let metadata: ModelMetadata | null = null;
    let probe: ProfileProbe = { ...unusedProbe };
    let failure: DiscoveryFailure | null = null;
    let blockers: string[] = [];
    let capabilities = { ...unknownCapabilities };
    const outcome = await runProviderTransport({ fetcher, credential, signal, maxAttempts: 3 }, async (transport) => {
      const bodies: unknown[] = [];
      for (const url of sources) {
        const plan = { url, method: "GET" as const };
        const response = request.provider === "openai"
          ? await requestOpenAI(plan, credential, transport.signal, transport.send, transport.readBody,
            (client) => client.models.retrieve(request.modelId, { signal: transport.signal }).asResponse())
          : await transport.send(url, { method: "GET", headers: { Accept: "application/json" } });
        bodies.push(await responseData(transport, response));
      }
      metadata = parseCatalog(() => request.provider === "openai" ? parseOpenAIModel(bodies[0], request)
        : request.provider === "openrouter" ? parseOpenRouterModel(bodies[0], request)
        : parseHuggingFaceModel(bodies[0], bodies[1], request));
      if (metadata.pricing !== null) metadata = { ...metadata, pricing: { ...metadata.pricing, retrievedAt: checkedAt } };
      capabilities = { ...metadata.capabilities };
      blockers = selectionBlockers(metadata, request);
      if (request.verification === "metadata") return;
      if (blockers.length) { probe = { ...unusedProbe, status: "blocked" }; return; }
      // Public hosting metadata is required before sending a credential to a router.
      if (request.provider !== "openai" && (metadata.hosted !== "available" || !metadata.exactRoute)) {
        probe = { ...unusedProbe, status: "blocked", outcome: "Serving-route availability remains unknown; no inference request was sent." };
        return;
      }
      if (metadata.tokenParameter === null || (profile.responseFormat.kind === "json-schema" && request.provider !== "openai" && metadata.structuredOutput !== "advertised")) {
        probe = { ...unusedProbe, status: "blocked", outcome: "Required request parameters remain unverified; no inference request was sent." };
        return;
      }
      const plan = buildProfileProbe(request, metadata);
      sources.push(plan.url);
      probe = { ...unusedProbe, status: "not-verified" };
      const response = request.provider === "openai"
        ? await requestOpenAI(plan, credential, transport.signal, transport.send, transport.readBody,
          (client) => client.responses.create(JSON.parse(plan.body!) as ResponseCreateParamsNonStreaming, { signal: transport.signal }).asResponse())
        : await transport.send(plan.url, { method: plan.method, headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: plan.body });
      const parsed = parseProfileProbe(await responseData(transport, response), request, metadata);
      probe = parsed.probe;
      if (parsed.failure !== null) failure = { code: parsed.failure, message: FAILURE_MESSAGES[parsed.failure], remoteOutcome: "response-received" };
      if (probe.status === "verified") capabilities = {
        textInput: "supported", textOutput: "supported",
        outputTokenLimit: probe.outputLimitRequestAccepted ? "supported" : capabilities.outputTokenLimit,
        jsonSchema: probe.nativeSchemaRequestAccepted ? "supported" : capabilities.jsonSchema,
      };
    });
    if (!outcome.ok) failure = { code: outcome.code, message: FAILURE_MESSAGES[outcome.code], remoteOutcome: outcome.remoteOutcome };
    const compatibility = checkCompatibility(request.profileId, capabilities);
    const status = failure !== null ? "failed" : blockers.length ? "blocked"
      : probe.status === "verified" && compatibility.compatible ? "ready" : "needs-verification";
    return freezeData({
      version: "1", policyId: profile.reasoning === "provider-default" ? "model-selection-v1" : "model-selection-v2", requestId: crypto.randomUUID(), checkedAt,
      expiresAt: new Date(Date.parse(checkedAt) + SELECTION_TTL_MS).toISOString(), request, metadata, status,
      capabilities, compatibility, probe, contextFit: "not-checked", sources,
      httpAttempts: outcome.attempts, httpStatus: outcome.httpStatus,
      budget: { maxHttpAttempts: 3, maxInferenceRequests: request.verification === "probe" ? 1 : 0,
        maxOutputTokens: request.verification === "probe" ? profile.maxOutputTokens : 0, timeoutMs: 20000 }, blockers, failure,
    });
  };
}

export const searchHuggingFaceModels = createModelSearchClient();
export const selectModel = createModelSelectionClient();
