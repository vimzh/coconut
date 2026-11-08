// The exploratory population keeps source-polynomial clusters and independent proofs explicit.
import type { Label } from "../math";
import type { NumericalCase, NumericalReference, NumericalSuite } from "../numerics/types";
import type { ProfileId } from "../protocol";

export const INTERIOR_FAMILIES = Object.freeze(["quintic-logarithm", "quintic-reciprocal", "quintic-softplus"] as const);
export type InteriorFamily = typeof INTERIOR_FAMILIES[number];

export interface InteriorRequest {
  readonly seed: "coconut-interior-exploratory-v1";
  readonly population: "exploratory";
  readonly depths: readonly number[];
  readonly casesPerClass: 24;
  readonly profileId: ProfileId;
  readonly purpose: "evaluation";
}

export interface InteriorAnalyticCertificate {
  readonly policy: "interior-bernstein-taylor-v1";
  readonly family: InteriorFamily;
  readonly parameters: Readonly<Record<string, string>>;
  readonly label: Label;
  readonly globalSecond: { readonly min: string; readonly max: string } | null;
  readonly witnesses: readonly { readonly x: string; readonly min: string; readonly max: string }[];
  readonly polynomial: null;
}

export interface InteriorCandidate {
  readonly reference: NumericalReference;
  readonly family: InteriorFamily;
  readonly clusterId: string;
  readonly clusterIndex: number;
  readonly analyticCertificate: InteriorAnalyticCertificate;
}

export interface InteriorCase extends NumericalCase {
  readonly family: InteriorFamily;
  readonly clusterId: string;
  readonly analyticCertificate: InteriorAnalyticCertificate;
}

export interface InteriorAttempt extends InteriorCandidate {
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: 0;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string | null;
}

export interface InteriorFamilyCoverage {
  readonly family: InteriorFamily;
  readonly label: Label;
  readonly requested: number;
  readonly accepted: number;
}

export interface InteriorDesignRevision {
  readonly clusterIndex: number;
  readonly reference: NumericalReference;
  readonly outcome: { readonly status: "rejected"; readonly reason: "label-mismatch" };
  readonly actualLabel: "neither";
  readonly independentWitnesses: readonly { readonly x: string; readonly min: string; readonly max: string }[];
  readonly replacementDomain: { readonly min: "17/32"; readonly max: "5/8" };
}

export interface InteriorSuite extends Omit<NumericalSuite,
  "generatorVersion" | "depthPolicyVersion" | "request" | "cases" | "distinctness" | "attempts"> {
  readonly generatorVersion: "interior-v1";
  readonly depthPolicyVersion: "measured-operation-v1";
  readonly request: InteriorRequest;
  readonly cases: readonly InteriorCase[];
  readonly distinctness: "domain-or-disjoint-value-enclosures-v1";
  readonly independentReferencePolicy: "interior-bernstein-taylor-v1";
  readonly familyCoverage: readonly InteriorFamilyCoverage[];
  readonly attempts: readonly InteriorAttempt[];
  readonly designRevisions: readonly InteriorDesignRevision[];
}

export type InteriorGenerationResult =
  | { readonly status: "complete"; readonly suite: InteriorSuite }
  | {
      readonly status: "incomplete";
      readonly reason: "cancelled" | "candidate-rejected";
      readonly request: InteriorRequest;
      readonly cases: readonly InteriorCase[];
      readonly summary: InteriorSuite["summary"];
      readonly familyCoverage: readonly InteriorFamilyCoverage[];
      readonly attempts: readonly InteriorAttempt[];
    };
