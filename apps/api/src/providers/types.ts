// Explicit provider operations and safe evidence; credentials are passed separately.
export type ProviderId = "openai" | "openrouter" | "hugging-face";

export type AccessRequest =
  | { readonly provider: ProviderId; readonly operation: "authenticate" }
  | {
      readonly provider: ProviderId;
      readonly operation: "probe";
      readonly modelId: string;
      readonly servingProvider: string | null;
      readonly acceptCharges: true;
    };

export type AccessFailureCode =
  | "authentication-rejected" | "permission-denied" | "credit-or-quota-exhausted"
  | "model-unavailable" | "rate-limited" | "service-unavailable"
  | "cancelled" | "timeout" | "network-error" | "redirect-blocked"
  | "invalid-provider-response" | "response-too-large" | "output-incomplete"
  | "no-output" | "credential-reflection";

export interface AccessUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface AccessResult {
  readonly version: "1";
  readonly requestId: string;
  readonly checkedAt: string;
  readonly provider: ProviderId;
  readonly operation: AccessRequest["operation"];
  readonly status: "authenticated" | "inference-verified" | "not-verified";
  readonly requestedModelId: string | null;
  readonly reportedModelId: string | null;
  readonly requestedServingProvider: string | null;
  readonly reportedServingProvider: string | null;
  readonly httpStatus: number | null;
  readonly usage: AccessUsage;
  readonly budget: {
    readonly maxHttpAttempts: 1;
    readonly maxInferenceRequests: 0 | 1;
    readonly maxOutputTokens: 0 | 128;
    readonly timeoutMs: 20000;
  };
  readonly failure: { readonly code: AccessFailureCode; readonly message: string; readonly remoteOutcome: "not-sent" | "unknown" | "response-received" } | null;
}

export interface ProviderPlan {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly body?: string;
}

export type ProviderAccessClient = (input: unknown, credential: unknown, signal?: AbortSignal) => Promise<AccessResult>;

export interface ParsedAccessResponse {
  readonly status: AccessResult["status"];
  readonly reportedModelId: string | null;
  readonly reportedServingProvider: string | null;
  readonly usage: AccessUsage;
  readonly failure: AccessFailureCode | null;
}
