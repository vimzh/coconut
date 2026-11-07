// Fixed provider destinations and explicit consent; no caller-controlled proxy targets.
import { readDataRecord, requireFields, ProtocolInputError } from "../protocol/validation";
import type { AccessRequest, ProviderId, ProviderPlan } from "./types";

export const ACCESS_TIMEOUT_MS = 20_000 as const;
export const PROBE_MAX_OUTPUT_TOKENS = 128 as const;
export const MAX_PROVIDER_RESPONSE_BYTES = 1_048_576;
export const MAX_ACCESS_BODY_BYTES = 4_096;
export const PROBE_PROMPT = "Reply with OK.";

export const ACCESS_POLICY = Object.freeze({
  version: "1",
  credentialLifetime: "current-operation-only",
  persistence: "none",
  ownerKeyFallback: false,
  disconnect: "Clear current-page credentials and abort active operations. Refresh or restart requires re-entry.",
  cancellation: "Cancellation requests local/upstream termination; work or charges already initiated can remain unknown.",
  authentication: "Authentication checks make no inference request and do not prove model execution permission.",
  probe: "A probe requires explicit charge acknowledgement and sends one fixed request, with no retry or substitution. A requested token ceiling is not a currency limit.",
  maxHttpAttempts: 1,
  maxProbeOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
  timeoutMs: ACCESS_TIMEOUT_MS,
  providers: Object.freeze([
    Object.freeze({ id: "openai", billing: "Usage is charged to the account/project associated with the supplied OpenAI credential." }),
    Object.freeze({ id: "openrouter", billing: "Usage follows the supplied OpenRouter account's billing configuration. The request disables web search, but enforced account plugins may override request settings and add charges." }),
    Object.freeze({ id: "hugging-face", billing: "Usage follows the supplied Hugging Face account's billing configuration, including any configured upstream-provider billing." }),
  ]),
});

export class AccessInputError extends Error {
  constructor(public readonly code: "invalid-input" | "missing-credential" | "invalid-credential" | "charge-authorization-required", message: string) {
    super(message);
    this.name = "AccessInputError";
  }
}

export function safeAccessInputError(error: unknown): AccessInputError {
  const messages = {
    "invalid-input": "Access operation must match the documented provider, operation, model, and serving-route fields.",
    "missing-credential": "Supply your own provider credential for this operation.",
    "invalid-credential": "Supply a valid bearer credential without whitespace or control characters.",
    "charge-authorization-required": "A probe requires explicit acknowledgement of provider charges.",
  } as const;
  const code = error instanceof AccessInputError && Object.hasOwn(messages, error.code) ? error.code : "invalid-input";
  return new AccessInputError(code, messages[code]);
}

export function parseCredential(input: unknown): string {
  if (input === undefined || input === null || input === "") throw new AccessInputError("missing-credential", "Supply your own provider credential for this operation.");
  if (typeof input !== "string" || input.length < 16 || input.length > 4096 || !/^[A-Za-z0-9._~+/-]+=*$/.test(input)) {
    throw new AccessInputError("invalid-credential", "Credential must be a 16–4096-character bearer token without whitespace or control characters.");
  }
  return input;
}

export function parseAccessRequest(input: unknown): AccessRequest {
  try {
    const data = readDataRecord(input, "Access operation");
    if (!["openai", "openrouter", "hugging-face"].includes(data.provider as string)) {
      throw new AccessInputError("invalid-input", "Choose an explicit supported provider.");
    }
    const provider = data.provider as ProviderId;
    if (data.operation === "authenticate") {
      requireFields(data, ["provider", "operation"]);
      return Object.freeze({ provider, operation: "authenticate" });
    }
    if (data.operation !== "probe") throw new AccessInputError("invalid-input", "Choose authenticate or probe explicitly.");
    requireFields(data, ["provider", "operation", "modelId", "servingProvider", "acceptCharges"]);
    if (data.acceptCharges !== true) throw new AccessInputError("charge-authorization-required", "A probe requires explicit acknowledgement of provider charges.");
    if (typeof data.modelId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(data.modelId)) {
      throw new AccessInputError("invalid-input", "Provide an explicit model identifier of at most 256 safe characters.");
    }
    const routerSelectors = [
      "openrouter/auto", "openrouter/auto-code", "openrouter/auto-beta", "openrouter/free",
      "openrouter/bodybuilder", "openrouter/fusion", "openrouter/pareto-code", "typesafe/jev-router", "nvidia/switchyard",
    ];
    if (provider === "openrouter" && (data.modelId.includes(":") || routerSelectors.includes(data.modelId.toLowerCase()))) {
      throw new AccessInputError("invalid-input", "OpenRouter probes require an explicit model without automatic selectors or variant suffixes.");
    }
    if (provider === "openai") {
      if (data.servingProvider !== null) throw new AccessInputError("invalid-input", "OpenAI probes require a null serving-provider field.");
    } else if (typeof data.servingProvider !== "string" || !/^[a-z0-9][a-z0-9._/-]{0,127}$/.test(data.servingProvider) || ["auto", "fastest", "cheapest", "preferred"].includes(data.servingProvider)) {
      throw new AccessInputError("invalid-input", "Router probes require an explicit serving-provider slug, without automatic routing.");
    }
    if (provider === "hugging-face" && data.modelId.includes(":")) throw new AccessInputError("invalid-input", "Supply the Hugging Face model and serving provider separately.");
    return Object.freeze({ provider, operation: "probe", modelId: data.modelId, servingProvider: data.servingProvider as string | null, acceptCharges: true });
  } catch (error) {
    if (error instanceof ProtocolInputError) throw new AccessInputError("invalid-input", "Access operation must contain exactly the documented data fields.");
    throw error;
  }
}

export function buildProviderPlan(request: AccessRequest): ProviderPlan {
  if (request.operation === "authenticate") {
    const urls: Record<ProviderId, string> = {
      openai: "https://api.openai.com/v1/models",
      openrouter: "https://openrouter.ai/api/v1/key",
      "hugging-face": "https://huggingface.co/api/whoami-v2",
    };
    return { url: urls[request.provider], method: "GET" };
  }
  if (request.provider === "openai") {
    return { url: "https://api.openai.com/v1/responses", method: "POST", body: JSON.stringify({ model: request.modelId, input: PROBE_PROMPT, max_output_tokens: PROBE_MAX_OUTPUT_TOKENS, store: false }) };
  }
  const common = { messages: [{ role: "user", content: PROBE_PROMPT }], stream: false };
  if (request.provider === "openrouter") {
    return { url: "https://openrouter.ai/api/v1/chat/completions", method: "POST", body: JSON.stringify({ ...common, model: request.modelId, max_completion_tokens: PROBE_MAX_OUTPUT_TOKENS, provider: { only: [request.servingProvider], allow_fallbacks: false, require_parameters: true }, plugins: [{ id: "web", enabled: false }] }) };
  }
  return { url: "https://router.huggingface.co/v1/chat/completions", method: "POST", body: JSON.stringify({ ...common, model: `${request.modelId}:${request.servingProvider}`, max_tokens: PROBE_MAX_OUTPUT_TOKENS }) };
}
