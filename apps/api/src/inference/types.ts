// Individual inference preserves execution evidence independently of mathematical scoring.
import type { DiscoveryFailure, ModelMetadata, SelectionRequest, SelectionResult } from "../discovery";
import type { ModelReply, PromptBlueprint } from "../protocol";
import type { AccessFailureCode, ProviderId } from "../providers";
import type { AttemptEvidence, AttemptUsage, CostEvidence } from "../scoring/types";

export interface InferenceRequest {
  readonly selection: SelectionRequest & { readonly verification: "metadata" };
  readonly prompt: PromptBlueprint;
  readonly acceptCharges: true;
}

export interface NormalizedInference {
  readonly reply: ModelReply;
  readonly reportedModelId: string | null;
  readonly reportedServingProvider: string | null;
  readonly finishReason: string | null;
  readonly usage: AttemptUsage;
  readonly cost: CostEvidence | null;
  readonly effective: {
    readonly maxOutputTokens: number | null;
    readonly reasoningEffort: string | null;
    readonly truncation: "disabled" | "auto" | null;
    readonly nativeSchemaAccepted: boolean | null;
  };
  readonly failure: AccessFailureCode | null;
}

export interface InferenceResult {
  readonly version: "1";
  readonly policyId: "individual-inference-v1";
  readonly attemptId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly requested: {
    readonly provider: ProviderId;
    readonly modelId: string;
    readonly servingProvider: string | null;
    readonly profileId: PromptBlueprint["profileId"];
  };
  readonly selection: SelectionResult | null;
  readonly metadata: ModelMetadata | null;
  readonly prompt: PromptBlueprint;
  readonly reportedModelId: string | null;
  readonly reportedServingProvider: string | null;
  readonly effective: NormalizedInference["effective"];
  readonly finishReason: string | null;
  readonly contextFit: "provider-enforced" | "unverified";
  readonly evidence: AttemptEvidence;
  readonly failure: DiscoveryFailure | null;
  readonly httpAttempts: number;
  readonly inferenceRequests: 0 | 1;
  readonly budget: {
    readonly maxInferenceRequests: 1;
    readonly maxOutputTokens: number;
    readonly metadataTimeoutMs: 20000;
    readonly inferenceTimeoutMs: 180000;
    readonly retries: 0;
  };
}

export type InferenceClient = (input: unknown, credential: unknown, signal?: AbortSignal) => Promise<InferenceResult>;
