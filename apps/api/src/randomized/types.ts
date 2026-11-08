// Single-response research artifacts stay separate from ordinary repeated-trial run records.
import type { InferenceResult } from "../inference/types";
import type { Label } from "../math";
import type { PromptBlueprint } from "../protocol";
import type { ClassificationReport } from "../scoring/classification";

export interface ImportedCase {
  readonly id: string;
  readonly label: Label;
  readonly expression: string;
  readonly domain: { readonly min: string; readonly max: string };
  readonly referenceSha256: string;
  readonly coreHashes: readonly string[];
  readonly requestedDepth: number;
  readonly actualDepth: number;
  readonly astDepth: number;
  readonly nonlinearPath: number;
  readonly nodeCount: number;
}

export interface PanelFreeze {
  readonly ordinal: number;
  readonly requestedDepth: number;
  readonly sourceSha256: string;
  readonly admissionReviewSha256: string;
  readonly frozenAt?: string;
}

export interface FrozenPanel {
  readonly version: "1";
  readonly methodId: "adaptive-single-response-v1";
  readonly id: string;
  readonly ordinal: number;
  readonly requestedDepth: number;
  readonly sourceSha256: string;
  readonly admissionReviewSha256: string;
  readonly frozenAt: string;
  readonly cases: readonly ImportedCase[];
  readonly prompts: readonly PromptBlueprint[];
}

export interface PriorDispatch {
  readonly ordinal: number;
  readonly dispatchId: string;
  readonly kind: "question" | "probe";
  readonly caseId: string | null;
}

export interface DispatchReceipt extends PriorDispatch {
  readonly kind: "question";
  readonly panelId: string;
  readonly caseId: string;
  readonly trialIndex: 0;
  readonly referenceSha256: string;
  readonly requestBodySha256: string;
  readonly authorizedAt: string;
  readonly remoteOutcomeUntilRetained: "unknown";
}

export interface PanelRow {
  readonly caseId: string;
  readonly trialIndex: 0;
  readonly dispatch: DispatchReceipt | null;
  readonly result: InferenceResult | null;
}

export type SingleResponseScores = Omit<ClassificationReport, "trials" | "spread" | "agreement"> & {
  readonly repeatedTrialSpread: null;
  readonly agreementAcrossRepeats: null;
};

export interface PanelResult {
  readonly version: "1";
  readonly methodId: FrozenPanel["methodId"];
  readonly panel: FrozenPanel;
  readonly finishedAt: string;
  readonly rows: readonly PanelRow[];
  readonly scores: SingleResponseScores;
  readonly dispatches: number;
  readonly unknownRemoteOutcomes: number;
  readonly settingsVerified: boolean;
}

export interface PanelReview {
  readonly panelId: string;
  readonly resultSha256: string;
  readonly references: readonly { readonly caseId: string; readonly referenceSha256: string }[];
  readonly verifiedWrongCaseIds: readonly string[];
  readonly reviewer: string;
  readonly reviewedAt: string;
}

export interface ReviewedPanel {
  readonly result: PanelResult;
  readonly review: PanelReview;
  readonly status: "all-correct" | "verified-error" | "inconclusive";
}

export interface SearchBudget {
  // These are sends outside the supplied panel history; probeSends is a subset of this total.
  readonly priorDevelopmentSends: number;
  readonly probeSends: number;
}

export type SearchDecision =
  | { readonly action: "query"; readonly requestedDepth: number; readonly lower: number | null; readonly higher: number | null }
  | { readonly action: "stop"; readonly reason: "initial-signal" | "all-correct-through-1000" | "interval-width" | "panel-limit" | "budget" | "inconclusive" | "inversion"; readonly lower: number | null; readonly higher: number | null };
