// Strict selection requests never accept capability overrides, destinations, or implicit charges.
import { getProfile, listProfiles } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { validateModelRoute } from "../providers/policy";
import { freezeData } from "../suites/generator";
import type { SearchRequest, SelectionRequest } from "./types";

export const SELECTION_TTL_MS = 300_000;
export const DISCOVERY_POLICY = freezeData({
  version: "2", policyId: "model-selection-v2", search: "Anonymous Hugging Face catalog only; no credential or inference.",
  selection: "Metadata lookup makes no inference request. Profile probing requires explicit charge acknowledgement.",
  maxSearchResults: 20, timeoutMs: 20_000, maxHttpAttempts: 3, maxProbeInferenceRequests: 1, maxProbeOutputTokens: 16384,
  profiles: listProfiles().map(({ id, reasoning, maxOutputTokens }) => ({ id, reasoning, maxOutputTokens })),
  reasoning: "Version-1 profiles retain provider-default reasoning and 4096 output tokens. Explicit version-2 efforts request 16384 output tokens and are supported only for direct OpenAI operations; model support requires an exact observed effort echo. Routed explicit-effort probes are blocked.",
  freshnessMs: SELECTION_TTL_MS, credentials: "current-operation-only", persistence: "none",
  claims: "Metadata is advertised capability. A probe verifies one observed request; future availability, universal output conformance, and model accuracy remain unproved.",
  execution: "Selection records are not authorization tokens. Re-resolve untrusted selections with the current credential before execution; check each real prompt's context fit.",
});

export class DiscoveryInputError extends Error {
  constructor(public readonly code: "invalid-input" | "charge-authorization-required" = "invalid-input") {
    super(code === "charge-authorization-required" ? "A profile probe requires explicit acknowledgement of provider charges." : "Use the documented search or selection fields with an explicit model, route, profile, and verification mode.");
    this.name = "DiscoveryInputError";
  }
}

export function parseSearchRequest(input: unknown): SearchRequest {
  try {
    const data = readDataRecord(input, "Model search");
    requireFields(data, ["query", "limit"]);
    if (typeof data.query !== "string" || !data.query.isWellFormed() || data.query.trim() === "" || [...data.query].length > 80 || /\p{Cc}/u.test(data.query)) throw new DiscoveryInputError();
    if (!Number.isInteger(data.limit) || (data.limit as number) < 1 || (data.limit as number) > 20) throw new DiscoveryInputError();
    return freezeData({ query: data.query.trim(), limit: data.limit as number });
  } catch { throw new DiscoveryInputError(); }
}

export function parseSelectionRequest(input: unknown): SelectionRequest {
  try {
    const data = readDataRecord(input, "Model selection");
    if (data.verification !== "metadata" && data.verification !== "probe") throw new DiscoveryInputError();
    const fields = ["provider", "modelId", "servingProvider", "profileId", "verification"];
    requireFields(data, data.verification === "probe" ? [...fields, "acceptCharges"] : fields);
    if (data.verification === "probe" && data.acceptCharges !== true) throw new DiscoveryInputError("charge-authorization-required");
    if (data.provider !== "openai" && data.provider !== "openrouter" && data.provider !== "hugging-face") throw new DiscoveryInputError();
    const route = validateModelRoute(data.provider, data.modelId, data.servingProvider);
    const segments = route.modelId.split("/");
    if (segments.some((part) => part === "." || part === ".." || part === "") || (data.provider !== "openai" && segments.length !== 2)) throw new DiscoveryInputError();
    if (route.servingProvider?.split("/").some((part) => part === "." || part === ".." || part === "")) throw new DiscoveryInputError();
    const profile = getProfile(data.profileId);
    const base: Pick<SelectionRequest, "provider" | "modelId" | "servingProvider" | "profileId"> = { provider: data.provider, ...route, profileId: profile.id };
    return freezeData(data.verification === "probe" ? { ...base, verification: "probe", acceptCharges: true } : { ...base, verification: "metadata" });
  } catch (error) {
    throw error instanceof DiscoveryInputError ? error : new DiscoveryInputError();
  }
}

export function modelSearchUrl(request: SearchRequest): string {
  const url = new URL("https://huggingface.co/api/models");
  url.searchParams.set("search", request.query); url.searchParams.set("limit", String(request.limit));
  url.searchParams.append("expand", "pipeline_tag"); url.searchParams.append("expand", "inferenceProviderMapping");
  return url.href;
}

export function modelMetadataUrls(request: SelectionRequest): readonly string[] {
  if (request.provider === "openai") return [`https://api.openai.com/v1/models/${encodeURIComponent(request.modelId)}`];
  const path = request.modelId.split("/").map(encodeURIComponent).join("/");
  if (request.provider === "openrouter") return [`https://openrouter.ai/api/v1/models/${path}/endpoints`];
  return [`https://huggingface.co/api/models/${path}?expand=pipeline_tag&expand=inferenceProviderMapping`, `https://router.huggingface.co/v1/models/${path}`];
}

export function selectionIsFresh(input: unknown, now = Date.now()): boolean {
  // Freshness is advisory; supplied records still require trusted revalidation.
  if (input === null || typeof input !== "object" || !Number.isFinite(now)) return false;
  const checked = Object.getOwnPropertyDescriptor(input, "checkedAt"), expiry = Object.getOwnPropertyDescriptor(input, "expiresAt");
  if (!checked || !("value" in checked) || !expiry || !("value" in expiry) || typeof checked.value !== "string" || typeof expiry.value !== "string") return false;
  const start = Date.parse(checked.value), end = Date.parse(expiry.value);
  return Number.isFinite(start) && Number.isFinite(end) && end - start === SELECTION_TTL_MS && start <= now && now < end;
}
