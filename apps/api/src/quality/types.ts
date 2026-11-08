// Offline reports expose aggregate evidence and review needs without provider replies or credentials.
import type { Label } from "../math";
import type { ClassificationReport } from "../scoring";

export interface QualityFinding {
  readonly id: string;
  readonly category: "reference" | "coverage" | "identity" | "depth" | "leakage" | "selection" | "execution" | "comparison" | "inspection";
  readonly severity: "critical" | "warning" | "missing-evidence";
  readonly status: "passed" | "repaired" | "accepted-scoped-limitation" | "unresolved";
  readonly caseIds: readonly string[];
  readonly evidence: string;
  readonly responsibleModule: string;
  readonly repairVersion: string | null;
  readonly verification: string;
  readonly claimRestriction: string | null;
}

export interface QualityGate {
  readonly verdict: "go" | "no-go";
  readonly blockers: readonly string[];
}

export interface ExpressionDiagnostics {
  readonly caseId: string;
  readonly family: string;
  readonly label: Label;
  readonly rawDepth: number;
  readonly rawNodes: number;
  readonly diagnosticDepth: number;
  readonly diagnosticNodes: number;
  readonly uniqueSubtrees: number;
  readonly operatorCounts: Readonly<Record<string, number>>;
  readonly expressionCharacters: number;
  readonly activePieces: number | null;
  readonly identityFlags: readonly string[];
  readonly exactSignature: string;
  readonly coreSignature: string;
}

export interface QualityCluster {
  readonly id: string;
  readonly family: string;
  readonly caseIds: readonly string[];
  readonly basis: "declared-parameter-group" | "bounded-curvature-equivalence" | "singleton";
}

export interface SuiteQualityReport {
  readonly version: "1";
  readonly policyId: "quality-criteria-v1";
  readonly criteriaSha256: string;
  readonly id: string;
  readonly suiteId: string;
  readonly suiteSha256: string;
  readonly population: {
    readonly cases: number;
    readonly families: number;
    readonly clusters: number;
    readonly distinctExactTasks: number;
    readonly requestedCases: number;
    readonly acceptedCandidates: number;
    readonly attemptedCandidates: number;
    readonly rejectedCandidates: number;
    readonly unverifiedCandidates: number;
    readonly rejectionReasons: Readonly<Record<string, number>>;
    readonly interpretation: string;
  };
  readonly coverage: {
    readonly labels: Readonly<Record<Label, number>>;
    readonly families: readonly { readonly family: string; readonly labels: Readonly<Record<Label, number>>; readonly clusters: number }[];
    readonly depths: readonly { readonly depth: number; readonly labels: Readonly<Record<Label, number>> }[];
  };
  readonly candidateAccounting: {
    readonly detailedAttemptsRetained: boolean;
    readonly groups: readonly { readonly family: string | null; readonly label: Label; readonly parameterGroup: number | null; readonly accepted: number; readonly rejected: number }[];
  };
  readonly clusters: readonly QualityCluster[];
  readonly structures: readonly ExpressionDiagnostics[];
  readonly duplicates: readonly { readonly left: string; readonly right: string }[];
  readonly relatedPairs: readonly { readonly left: string; readonly right: string; readonly relation: string }[];
  readonly unknownEquivalencePairs: number;
  readonly reviewRecords: readonly {
    readonly role: "AI-assisted independent mathematical review" | "certificate replay";
    readonly reference: string;
    readonly status: "matched" | "missing";
    readonly limitation: string;
  }[];
  readonly findings: readonly QualityFinding[];
  readonly gate: QualityGate;
}

export interface BootstrapInterval {
  readonly status: "available" | "unavailable";
  readonly reasons: readonly string[];
  readonly seed: "coconut-quality-bootstrap-v1";
  readonly replicates: 10000;
  readonly quantileRule: "nearest-rank percentile 2.5%,97.5%";
  readonly randomGenerator: "mulberry32-sha256-seed-v1";
  readonly strata: readonly { readonly family: string; readonly clusters: number }[];
  readonly clusters: number;
  readonly intervals: { readonly macroF1: readonly [number, number]; readonly accuracy: readonly [number, number] } | null;
  readonly interpretation: string;
}

export interface QualityReport {
  readonly version: "1";
  readonly policyId: "quality-criteria-v1";
  readonly criteriaSha256: string;
  readonly id: string;
  readonly runId: string;
  readonly scoringReportId: string;
  readonly evidenceSha256: string;
  readonly reviewEvidenceSha256: string | null;
  readonly suite: SuiteQualityReport;
  readonly headline: ClassificationReport;
  readonly comparison: {
    readonly profileId: import("../protocol").ProfileId;
    readonly outputTokenCeiling: number;
    readonly requestedReasoning: string;
    readonly sampling: string;
    readonly responseFormat: "prompted-json" | "json-schema";
    readonly provider: string;
    readonly requestedModelId: string;
    readonly reportedModelIds: readonly (string | null)[];
    readonly requestedServingProvider: string | null;
    readonly reportedServingProviders: readonly (string | null)[];
    readonly effectiveTokenCeilings: readonly (number | null)[];
    readonly effectiveReasoningEfforts: readonly (string | null)[];
    readonly endpointId: string;
    readonly settingsId: string;
    readonly equalComputeClaim: false;
  };
  readonly denominators: {
    readonly plannedTrials: number;
    readonly includedModelOutcomes: number;
    readonly validLabels: number;
    readonly validCorrect: number;
    readonly validWrong: number;
    readonly malformed: number;
    readonly empty: number;
    readonly conflicting: number;
    readonly refused: number;
    readonly truncated: number;
    readonly providerErrors: number;
    readonly interrupted: number;
    readonly cancelled: number;
    readonly unattempted: number;
    readonly retainedAttempts: number;
    readonly inferenceRequests: number;
    readonly distinctInstances: number;
    readonly clusters: number;
    readonly families: number;
  };
  readonly outcomeReviews: readonly {
    readonly caseId: string;
    readonly trialIndex: number;
    readonly attemptId: string | null;
    readonly category: "wrong-valid-label" | "format-only-failure" | "refusal" | "budget-exhaustion" | "infrastructure" | "unattempted";
    readonly status: "needs-review" | "reviewed";
    readonly diagnosis: SignalReviewEvidence["trials"][number]["diagnosis"] | null;
  }[];
  readonly uncertainty: BootstrapInterval;
  readonly signal: {
    readonly verdict: "go" | "no-go";
    readonly candidateCaseIds: readonly string[];
    readonly qualifiedCaseIds: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly findings: readonly QualityFinding[];
  readonly gate: QualityGate;
}

export interface SignalReviewEvidence {
  readonly experiment: {
    readonly manifestSha256: string;
    readonly capabilityEvidenceSha256: string;
    readonly manifest: SignalExperimentManifest;
    readonly capabilities: SignalCapabilityEvidence;
  };
  readonly trials: readonly {
    readonly caseId: string;
    readonly trialIndex: number;
    readonly attemptId: string;
    readonly transcriptSha256: string;
    readonly referenceSha256: string;
    readonly referenceIndependentlyChecked: true;
    readonly reviewerRole: "AI-assisted" | "human";
    readonly diagnosis: "mathematical-error" | "correct-label" | "expression-domain-misreading" | "format-only-failure" | "refusal" | "budget-exhaustion" | "infrastructure" | "unresolved";
  }[];
}

export interface SignalExperimentManifest {
  readonly version: "1";
  readonly policyId: "quality-criteria-v1";
  readonly criteriaSha256: string;
  readonly frozenAt: string;
  readonly inventory: { readonly checkedAt: string; readonly source: string; readonly modelIds: readonly string[] };
  readonly frontier: { readonly modelIds: readonly string[]; readonly basis: string; readonly sourceUrls: readonly string[] };
  readonly modelEfforts: readonly {
    readonly provider: import("../providers").ProviderId;
    readonly modelId: string;
    readonly plannedEfforts: readonly import("../protocol").ReasoningEffort[];
    readonly documentedEfforts: readonly import("../protocol").ReasoningEffort[];
    readonly sourceUrls: readonly string[];
  }[];
  readonly cells: readonly {
    readonly id: string;
    readonly phase: "screening" | "confirmation" | "capability-probe";
    readonly provider: import("../providers").ProviderId;
    readonly modelId: string;
    readonly servingProvider: string | null;
    readonly profileId: import("../protocol").ProfileId;
    readonly suiteId: string;
    readonly suiteSha256: string;
    readonly promptsSha256: string;
    readonly settingsId: string;
    readonly reasoningEffort: string;
    readonly maxOutputTokens: number;
    readonly concurrency: number;
  }[];
  readonly budget: { readonly maxChargedAttempts: 8192; readonly maxConcurrency: 12; readonly inferenceTimeoutMs: 180000; readonly metadataTimeoutMs: 20000 };
}

export interface SignalCapabilityEvidence {
  readonly version: "1";
  readonly manifestSha256: string;
  readonly checkedAt: string;
  readonly probes: readonly { readonly modelId: string; readonly effort: import("../protocol").ReasoningEffort; readonly result: import("../inference").InferenceResult }[];
}
