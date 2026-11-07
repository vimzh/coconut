// Separate smooth-task contracts keep historical exact suites reproducible.
import type { Label } from "../math";
import type { SuiteRequest, GenerationSummary } from "../suites/types";

export type NumericalPromptVersion = "smooth-v1" | "smooth-v2";
export type NumericalSuiteRequest = SuiteRequest & { readonly promptVersion?: "smooth-v2" };

export type SmoothExpression =
  | { readonly op: "variable" }
  | { readonly op: "constant"; readonly value: string }
  | { readonly op: "negate" | "square" | "exp" | "log" | "sqrt"; readonly arg: SmoothExpression }
  | { readonly op: "add" | "multiply" | "divide"; readonly left: SmoothExpression; readonly right: SmoothExpression };

export interface NumericalReference {
  readonly expression: SmoothExpression;
  readonly domain: { readonly min: string; readonly max: string };
  readonly claimedLabel: Label;
}

export interface NumericalBackend {
  readonly id: "arb-jet-v1";
  readonly pythonFlint: string;
  readonly flint: string;
  readonly policyVersion: "1";
}

export interface Enclosure { readonly min: string; readonly max: string }
export interface DerivativeWitness { readonly x: string; readonly second: Enclosure }
export interface NumericalCertificate {
  readonly version: "1";
  readonly backend: NumericalBackend;
  readonly input: NumericalReference;
  readonly renderedExpression: string;
  readonly depth: number;
  readonly nodeCount: number;
  readonly precision: 192;
  readonly cover: readonly { readonly min: string; readonly max: string; readonly second: Enclosure }[];
  readonly witnesses: { readonly positive?: DerivativeWitness; readonly negative?: DerivativeWitness };
  readonly probes: readonly { readonly x: string; readonly value: Enclosure; readonly second: Enclosure }[];
}

export type NumericalResult =
  | { readonly status: "verified"; readonly label: Label; readonly certificate: NumericalCertificate }
  | { readonly status: "unverified" | "rejected" | "excluded"; readonly reason: string };

export interface NumericalCase {
  readonly id: string;
  readonly reference: NumericalReference;
  readonly family: string;
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: number;
  readonly certificate: NumericalCertificate;
}

export interface NumericalSuite {
  readonly formatVersion: "2";
  readonly generatorVersion: "smooth-v1";
  readonly depthPolicyVersion: "smooth-v1";
  readonly verifierVersion: "arb-jet-v1";
  readonly protocolVersion: "1";
  readonly promptVersion: NumericalPromptVersion;
  readonly backend: NumericalBackend;
  readonly id: string;
  readonly request: NumericalSuiteRequest;
  readonly cases: readonly NumericalCase[];
  readonly summary: GenerationSummary;
  readonly distinctness: "disjoint-value-enclosures-v1";
  readonly attempts: readonly CandidateAttempt[];
}

export interface CandidateAttempt {
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: number;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string | null;
}

export type NumericalGenerationResult =
  | { readonly status: "complete"; readonly suite: NumericalSuite }
  | {
      readonly status: "incomplete";
      readonly reason: "cancelled" | "attempt-limit";
      readonly request: NumericalSuiteRequest;
      readonly cases: readonly NumericalCase[];
      readonly summary: GenerationSummary;
      readonly attempts: readonly CandidateAttempt[];
    };
