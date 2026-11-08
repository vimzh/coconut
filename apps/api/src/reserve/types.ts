// Fixed reserve contracts keep exploratory task membership separate from research history.
import type { Label } from "../math";
import type { NumericalCase, NumericalReference, NumericalSuite } from "../numerics/types";
import type { ProfileId } from "../protocol";

export const RESERVE_FAMILIES = Object.freeze(["reserve-logarithm", "reserve-reciprocal", "reserve-square-root"] as const);
export type ReserveFamily = typeof RESERVE_FAMILIES[number];

export interface ReserveRequest {
  readonly seed: "coconut-reserve-exploratory-v1";
  readonly population: "exploratory";
  readonly depths: readonly number[];
  readonly casesPerClass: 6;
  readonly profileId: ProfileId;
  readonly purpose: "evaluation";
}

export interface ReserveAnalyticCertificate {
  readonly policy: "reserve-bernstein-v1";
  readonly family: ReserveFamily;
  readonly parameters: Readonly<Record<string, string>>;
  readonly label: Label;
  readonly globalSecond: { readonly min: string; readonly max: string } | null;
  readonly witnesses: readonly { readonly x: string; readonly min: string; readonly max: string }[];
  readonly polynomial: null;
}

export interface ReserveCandidate {
  readonly reference: NumericalReference;
  readonly family: ReserveFamily;
  readonly clusterId: string;
  readonly clusterIndex: number;
  readonly analyticCertificate: ReserveAnalyticCertificate;
}

export interface ReserveCase extends NumericalCase {
  readonly family: ReserveFamily;
  readonly clusterId: string;
  readonly analyticCertificate: ReserveAnalyticCertificate;
}

export interface ReserveAttempt extends ReserveCandidate {
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: 0;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string | null;
}

export interface ReserveFamilyCoverage {
  readonly family: ReserveFamily;
  readonly label: Label;
  readonly requested: 2;
  readonly accepted: number;
}

export interface ExactSourceSeparation {
  readonly policy: "strict-monotone-outer-v1";
  readonly x: "-15/16";
  readonly sourceSquares: readonly [string, string];
  readonly ratio: "289/256";
  readonly familyDirections: readonly { readonly family: ReserveFamily; readonly direction: "increasing" | "decreasing" }[];
}

export interface ReserveSuite extends Omit<NumericalSuite,
  "generatorVersion" | "depthPolicyVersion" | "request" | "cases" | "distinctness" | "attempts"> {
  readonly generatorVersion: "reserve-v1";
  readonly depthPolicyVersion: "measured-operation-v1";
  readonly request: ReserveRequest;
  readonly cases: readonly ReserveCase[];
  readonly distinctness: "native-probes-or-exact-source-value-v1";
  readonly independentReferencePolicy: "reserve-bernstein-v1";
  readonly exactSourceSeparation: ExactSourceSeparation;
  readonly familyCoverage: readonly ReserveFamilyCoverage[];
  readonly attempts: readonly ReserveAttempt[];
}

export type ReserveGenerationResult =
  | { readonly status: "complete"; readonly suite: ReserveSuite }
  | {
      readonly status: "incomplete";
      readonly reason: "cancelled" | "candidate-rejected";
      readonly request: ReserveRequest;
      readonly cases: readonly ReserveCase[];
      readonly summary: ReserveSuite["summary"];
      readonly familyCoverage: readonly ReserveFamilyCoverage[];
      readonly attempts: readonly ReserveAttempt[];
    };
