// Provider-neutral contracts for versioned tasks, budgets, and model outcomes.
import type { Label } from "../math";

export type ProfileId = "one-shot-json-v1" | "one-shot-schema-v1";
export type Capability = "textInput" | "textOutput" | "outputTokenLimit" | "jsonSchema";
export type CapabilityState = "supported" | "unsupported" | "unknown";
export type CapabilityEvidence = Readonly<Record<Capability, CapabilityState>>;

export interface AnswerSchema {
  readonly type: "object";
  readonly properties: {
    readonly label: { readonly type: "string"; readonly enum: readonly Label[] };
    readonly explanation: { readonly type: "string" };
  };
  readonly required: readonly ["label", "explanation"];
  readonly additionalProperties: false;
}

export type ResponseFormat =
  | { readonly kind: "prompted-json" }
  | {
      readonly kind: "json-schema";
      readonly name: string;
      readonly strict: true;
      readonly schema: AnswerSchema;
    };

export interface EvaluationProfile {
  readonly id: ProfileId;
  readonly protocolVersion: "1";
  readonly method: "one-shot";
  readonly trialsPerInstance: 3;
  readonly maxInstances: 1000;
  readonly maxOutputTokens: 4096;
  readonly maxAttemptsPerTrial: 2;
  readonly sampling: "provider-default";
  readonly reasoning: "provider-default";
  readonly conversation: "fresh-per-trial";
  readonly tools: "none";
  readonly requirements: readonly Capability[];
  readonly responseFormat: ResponseFormat;
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly unsupported: readonly Capability[];
  readonly unverified: readonly Capability[];
}

export interface Workload {
  readonly protocolVersion: "1";
  readonly profileId: ProfileId;
  readonly instanceCount: number;
  readonly trialsPerInstance: 3;
  readonly logicalCalls: number;
  readonly maxAttempts: number;
  readonly maxOutputTokens: 4096;
  readonly maxOutputTokensTotal: number;
}

export interface PromptBlueprint {
  readonly protocolVersion: "1";
  readonly profileId: ProfileId;
  readonly messages: readonly [
    { readonly role: "system"; readonly content: string },
    { readonly role: "user"; readonly content: string },
  ];
  readonly responseFormat: ResponseFormat;
  readonly generation: Readonly<Pick<EvaluationProfile, "maxOutputTokens" | "sampling" | "reasoning" | "tools">>;
}

export type ReplyState = "completed" | "refused" | "truncated" | "interrupted" | "cancelled";
export type ModelReply =
  | { readonly status: ReplyState; readonly text: string }
  | { readonly status: "provider-error"; readonly text: string; readonly message: string };

export type InvalidAnswerReason =
  | "empty"
  | "response-too-large"
  | "malformed-json"
  | "duplicate-field"
  | "invalid-shape"
  | "invalid-label"
  | "invalid-explanation";

interface OutcomeIdentity {
  readonly protocolVersion: "1";
  readonly profileId: ProfileId;
  readonly rawText: string;
}

export type AnswerOutcome = OutcomeIdentity & (
  | { readonly kind: "answer"; readonly label: Label; readonly explanation: string }
  | { readonly kind: "invalid"; readonly reason: InvalidAnswerReason }
  | { readonly kind: Exclude<ReplyState, "completed"> }
  | { readonly kind: "provider-error"; readonly message: string }
);
