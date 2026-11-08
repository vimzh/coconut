// Validated browser reporting projections retain scorer values without recomputing scores.
export const REPORT_LABELS = ["convex", "concave", "neither"] as const;
export const REPORT_COLUMNS = [...REPORT_LABELS, "unusable"] as const;
export const REPORT_OUTCOMES = [
  "answer",
  "invalid",
  "empty",
  "conflicting",
  "refused",
  "truncated",
  "provider-error",
  "interrupted",
  "cancelled",
  "unattempted",
] as const;
export type ReportLabel = (typeof REPORT_LABELS)[number];
export type ReportColumn = (typeof REPORT_COLUMNS)[number];
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];
export type UsageField = "input" | "output" | "reasoning";
export interface ReportRate {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number | null;
}
export interface ReportSpread {
  readonly count: number;
  readonly mean: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly sampleStandardDeviation: number | null;
}
export interface ReportUsageGroup {
  readonly semantics: string;
  readonly reporting: number;
  readonly total: number;
  readonly mean: number;
}
export interface ReportSlice {
  readonly population: {
    readonly plannedTrials: number;
    readonly includedTrials: number;
    readonly excludedTrials: number;
    readonly correctTrials: number;
    readonly status: "complete" | "provisional" | "unavailable";
  };
  readonly macroF1: number | null;
  readonly accuracy: ReportRate;
  readonly classes: Readonly<
    Record<
      ReportLabel,
      {
        readonly precision: number | null;
        readonly recall: number | null;
        readonly f1: number | null;
        readonly support: number;
      }
    >
  >;
  readonly confusion: Readonly<
    Record<
      ReportLabel,
      {
        readonly counts: Readonly<Record<ReportColumn, number>>;
        readonly rowRates: Readonly<Record<ReportColumn, number>> | null;
      }
    >
  >;
  readonly outcomes: Readonly<Record<ReportOutcome, ReportRate>>;
  readonly spread: ReportSpread;
  readonly recallSpread: Readonly<Record<ReportLabel, ReportSpread>>;
  readonly agreement: {
    readonly eligibleInstances: number;
    readonly totalInstances: number;
    readonly agreeingPairs: number;
    readonly totalPairs: number;
    readonly value: number | null;
  };
  readonly usage: {
    readonly total: number;
    readonly fields: Readonly<
      Record<
        UsageField,
        {
          readonly complete: number;
          readonly missing: number;
          readonly groups: readonly ReportUsageGroup[];
        }
      >
    >;
  };
  readonly latency: {
    readonly eligible: number;
    readonly reporting: number;
    readonly missing: number;
    readonly p50Ms: number | null;
    readonly p95Ms: number | null;
  };
  readonly cost: {
    readonly attempts: number;
    readonly reporting: number;
    readonly missing: number;
    readonly total: {
      readonly kind: "billed" | "estimated";
      readonly currency: string;
      readonly amount: string;
    } | null;
    readonly groups: readonly {
      readonly kind: "billed" | "estimated";
      readonly currency: string;
      readonly amount: string;
      readonly reporting: number;
      readonly missingAttempts: number;
      readonly source: string | null;
      readonly date: string | null;
    }[];
  };
}
export interface ReportCase {
  readonly id: string;
  readonly depth: number;
  readonly family: string;
  readonly label: ReportLabel;
  readonly expression: string;
  readonly domain: { readonly min: string; readonly max: string };
  readonly proof: {
    readonly version: string;
    readonly nodeCount: number;
    readonly kind: "interval" | "structural";
    readonly precision: number | null;
    readonly steps: number;
    readonly witnesses: readonly {
      readonly kind: string;
      readonly values: Readonly<Record<string, string>>;
    }[];
    readonly independent: {
      readonly policy: string;
      readonly globalSecond: {
        readonly min: string;
        readonly max: string;
      } | null;
      readonly witnesses: readonly {
        readonly x: string;
        readonly min: string;
        readonly max: string;
      }[];
    } | null;
  };
}
export interface ReportTrial {
  readonly caseId: string;
  readonly trialIndex: number;
  readonly outcome: string;
  readonly attempts: number;
  readonly rawText: string | null;
  readonly label: ReportLabel | null;
  readonly explanation: string | null;
  readonly invalidReason: string | null;
  readonly elapsedMs: number | null;
  readonly errorKind: string | null;
  readonly failureCode: string | null;
  readonly reportedModelId: string | null;
  readonly reportedServingProvider: string | null;
  readonly reasoningEffort: string | null;
}
export interface ReportRun {
  readonly id: string;
  readonly state: string;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly suiteKey: string;
  readonly suiteId: string;
  readonly profileId: string;
  readonly provider: string;
  readonly modelId: string;
  readonly servingProvider: string | null;
  readonly endpointId: string;
  readonly settingsId: string;
  readonly protocolVersion: string;
  readonly generatorVersion: string;
  readonly verifierVersion: string;
  readonly reportId: string | null;
  readonly evidenceSha256: string | null;
  readonly depthPolicyVersion: string;
  readonly promptVersion: string | null;
  readonly settings: {
    readonly maxOutputTokens: number;
    readonly sampling: string;
    readonly reasoning: string;
    readonly tools: string;
    readonly concurrency: number;
  };
  readonly groupKey: string;
  readonly overall: ReportSlice | null;
  readonly depths: readonly {
    readonly depth: number;
    readonly slice: ReportSlice | null;
    readonly macroF1Difference: number | null;
  }[];
  readonly cases: readonly ReportCase[];
  readonly trials: readonly ReportTrial[];
}
