// Challenge artifacts retain analytic references and related-task clusters separately from native proofs.
import type { Label } from "../math";
import type { NumericalCase, NumericalReference, NumericalSuite } from "../numerics/types";
import type { ProfileId } from "../protocol";

export const CHALLENGE_FAMILIES = Object.freeze([
  "local-logarithm", "reciprocal-exponential", "exponential-quadratic", "rational-bend",
  "softplus-quadratic", "exponential-bowl", "mixed-branches", "integrated-curvature",
] as const);
export type ChallengeFamily = typeof CHALLENGE_FAMILIES[number];
export type ChallengePopulation = "confirmation" | "screening";

export interface ChallengeRequest {
  readonly seed: "coconut-challenge-confirmation-v1" | "coconut-challenge-screening-v1";
  readonly population: ChallengePopulation;
  readonly depths: readonly number[];
  readonly casesPerClass: number;
  readonly profileId: ProfileId;
  readonly purpose: "evaluation";
}

export interface AnalyticCertificate {
  readonly policy: "analytic-curvature-v1";
  readonly family: ChallengeFamily;
  readonly parameters: Readonly<Record<string, string>>;
  readonly label: Label;
  readonly globalSecond: { readonly min: string; readonly max: string } | null;
  readonly witnesses: readonly { readonly x: string; readonly min: string; readonly max: string }[];
  readonly polynomial: {
    readonly source: readonly string[];
    readonly second: readonly string[];
    readonly integrated: readonly string[];
  } | null;
}

export interface ChallengeCandidate {
  readonly reference: NumericalReference;
  readonly family: ChallengeFamily;
  readonly clusterId: string;
  readonly clusterIndex: number;
  readonly analyticCertificate: AnalyticCertificate;
}

export interface ChallengeCase extends NumericalCase {
  readonly family: ChallengeFamily;
  readonly clusterId: string;
  readonly analyticCertificate: AnalyticCertificate;
}

export interface ChallengeAttempt extends ChallengeCandidate {
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: 0;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string | null;
}

export interface FamilyCoverage {
  readonly family: ChallengeFamily;
  readonly label: Label;
  readonly requested: number;
  readonly accepted: number;
}

export interface ChallengeSuite extends Omit<NumericalSuite,
  "generatorVersion" | "depthPolicyVersion" | "request" | "cases" | "distinctness" | "attempts"> {
  readonly generatorVersion: "challenge-v1";
  readonly depthPolicyVersion: "measured-operation-v1";
  readonly request: ChallengeRequest;
  readonly cases: readonly ChallengeCase[];
  readonly distinctness: "domain-or-disjoint-value-enclosures-v1";
  readonly independentReferencePolicy: "analytic-curvature-v1";
  readonly familyCoverage: readonly FamilyCoverage[];
  readonly attempts: readonly ChallengeAttempt[];
}

export type ChallengeGenerationResult =
  | { readonly status: "complete"; readonly suite: ChallengeSuite }
  | {
      readonly status: "incomplete";
      readonly reason: "cancelled" | "candidate-rejected";
      readonly request: ChallengeRequest;
      readonly cases: readonly ChallengeCase[];
      readonly summary: ChallengeSuite["summary"];
      readonly familyCoverage: readonly FamilyCoverage[];
      readonly attempts: readonly ChallengeAttempt[];
    };
