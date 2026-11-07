// Discovery evidence distinguishes catalog claims from a current credential's profile check.
import type { CapabilityEvidence, CompatibilityResult, ProfileId } from "../protocol";
import type { AccessFailureCode, AccessUsage, ProviderId } from "../providers";

export interface SearchRequest { readonly query: string; readonly limit: number }
interface SelectionFields {
  readonly provider: ProviderId;
  readonly modelId: string;
  readonly servingProvider: string | null;
  readonly profileId: ProfileId;
}
export type SelectionRequest = SelectionFields & (
  | { readonly verification: "metadata" }
  | { readonly verification: "probe"; readonly acceptCharges: true }
);

export interface DiscoveryFailure {
  readonly code: AccessFailureCode;
  readonly message: string;
  readonly remoteOutcome: "not-sent" | "unknown" | "response-received";
}

export interface AdvertisedRoute {
  readonly provider: string;
  readonly providerModelId: string | null;
  readonly status: string | null;
  readonly task: string | null;
}

export interface SearchModel {
  readonly modelId: string;
  readonly displayName: string;
  readonly task: string | null;
  readonly routes: readonly AdvertisedRoute[] | null;
}

export interface ModelMetadata {
  readonly modelId: string;
  readonly canonicalId: string | null;
  readonly displayName: string;
  readonly providerModelId: string | null;
  readonly servingProvider: string | null;
  readonly providerDisplayName: string | null;
  readonly routeStatus: string | number | null;
  readonly hosted: "available" | "unavailable" | "unknown";
  readonly exactRoute: boolean;
  readonly capabilities: CapabilityEvidence;
  readonly structuredOutput: "advertised" | "unsupported" | "unknown";
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
  readonly tokenParameter: "max_output_tokens" | "max_completion_tokens" | "max_tokens" | null;
  readonly supportedParameters: readonly string[] | null;
  readonly pricing: {
    readonly currency: "USD";
    readonly unit: "token" | "million-tokens";
    readonly input: string | null;
    readonly output: string | null;
    readonly source: string;
    readonly retrievedAt: string | null;
  } | null;
}

export interface SearchResult {
  readonly version: "1";
  readonly requestId: string;
  readonly checkedAt: string;
  readonly request: SearchRequest;
  readonly source: string;
  readonly status: "complete" | "failed";
  readonly models: readonly SearchModel[];
  readonly httpAttempts: number;
  readonly httpStatus: number | null;
  readonly failure: DiscoveryFailure | null;
}

export interface ProfileProbe {
  readonly status: "not-requested" | "blocked" | "verified" | "not-verified";
  readonly reportedModelId: string | null;
  readonly reportedServingProvider: string | null;
  readonly usage: AccessUsage;
  readonly outputLimitRequestAccepted: boolean;
  readonly nativeSchemaRequestAccepted: boolean;
  readonly outcome: string | null;
}

export interface SelectionResult {
  readonly version: "1";
  readonly policyId: "model-selection-v1";
  readonly requestId: string;
  readonly checkedAt: string;
  readonly expiresAt: string;
  readonly request: SelectionRequest;
  readonly metadata: ModelMetadata | null;
  readonly status: "ready" | "needs-verification" | "blocked" | "failed";
  readonly capabilities: CapabilityEvidence;
  readonly compatibility: CompatibilityResult;
  readonly probe: ProfileProbe;
  readonly contextFit: "not-checked";
  readonly sources: readonly string[];
  readonly httpAttempts: number;
  readonly httpStatus: number | null;
  readonly budget: {
    readonly maxHttpAttempts: 3;
    readonly maxInferenceRequests: 0 | 1;
    readonly maxOutputTokens: 0 | 4096;
    readonly timeoutMs: 20000;
  };
  readonly blockers: readonly string[];
  readonly failure: DiscoveryFailure | null;
}

export type ModelSearchClient = (input: unknown, signal?: AbortSignal) => Promise<SearchResult>;
export type ModelSelectionClient = (input: unknown, credential: unknown, signal?: AbortSignal) => Promise<SelectionResult>;
