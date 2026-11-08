// Browser projections of the provider policy and safe operation evidence used by setup controls.
export type ProviderId = "openai" | "openrouter" | "hugging-face";
export type ReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ProviderSetupState {
  provider: ProviderId;
  credential: string;
  modelId: string;
  servingProvider: string | null;
  profileId: string;
}

export type ProviderModelInput = Omit<ProviderSetupState, "credential">;

export interface ProviderProfile {
  id: string;
  reasoning: "provider-default" | ReasoningEffort;
  maxOutputTokens: number;
}

export interface ProviderPolicy {
  credentialLifetime: "current-operation-only";
  persistence: "none";
  ownerKeyFallback: false;
  cancellation: string;
  authentication: string;
  probe: string;
  providers: { id: ProviderId; billing: string }[];
}

export interface ProviderModelPolicy {
  version: "2";
  policyId: "model-selection-v2";
  profiles: ProviderProfile[];
  maxSearchResults: number;
  maxProbeInferenceRequests: number;
  freshnessMs: number;
  reasoning: string;
}

export type ProviderFailureCode =
  | "authentication-rejected"
  | "permission-denied"
  | "credit-or-quota-exhausted"
  | "model-unavailable"
  | "rate-limited"
  | "service-unavailable"
  | "cancelled"
  | "timeout"
  | "network-error"
  | "redirect-blocked"
  | "invalid-provider-response"
  | "response-too-large"
  | "output-incomplete"
  | "no-output"
  | "credential-reflection";

export interface ProviderFailure {
  code: ProviderFailureCode;
  remoteOutcome: "not-sent" | "unknown" | "response-received";
}

export interface ProviderAccessResult {
  provider: ProviderId;
  operation: "authenticate";
  status: "authenticated" | "not-verified";
  checkedAt: string;
  failure: ProviderFailure | null;
}

export interface ProviderSearchModel {
  modelId: string;
  displayName: string;
  task: string | null;
  routes:
    | {
        provider: string;
        providerModelId: string | null;
        status: string | null;
        task: string | null;
      }[]
    | null;
}

export interface ProviderSearchResult {
  status: "complete" | "failed";
  models: ProviderSearchModel[];
  failure: ProviderFailure | null;
}

export interface ProviderSelectionResult {
  policyId: "model-selection-v1" | "model-selection-v2";
  request: ProviderModelInput & { verification: "metadata" | "probe" };
  status: "ready" | "needs-verification" | "blocked" | "failed";
  checkedAt: string;
  expiresAt: string;
  metadata: {
    modelId: string;
    canonicalId: string | null;
    providerModelId: string | null;
    servingProvider: string | null;
    hosted: "available" | "unavailable" | "unknown";
    exactRoute: boolean;
    contextWindow: number | null;
    maxOutputTokens: number | null;
  } | null;
  probe: {
    status: "not-requested" | "blocked" | "verified" | "not-verified";
    reportedModelId: string | null;
    reportedServingProvider: string | null;
    usage: { inputTokens: number | null; outputTokens: number | null };
    outputLimitRequestAccepted: boolean;
    nativeSchemaRequestAccepted: boolean;
    reportedReasoningEffort?: ReasoningEffort | null;
    reasoningEffortRequestAccepted?: boolean;
    outcome: string | null;
  };
  budget: { maxInferenceRequests: number; maxOutputTokens: number };
  failure: ProviderFailure | null;
}

export interface ProviderSetupProps {
  state: ProviderSetupState;
  onChange: (state: ProviderSetupState) => void;
  disabled?: boolean;
  onSelection?: (selection: ProviderSelectionResult | null) => void;
  onDisconnect?: () => void;
}
