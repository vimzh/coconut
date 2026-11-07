// Versioned suite inputs, retained reference evidence, and generation outcomes.
import type { CanonicalReference, Label, VerificationCertificate } from "../math";
import type { ProfileId } from "../protocol";

export interface SuiteRequest {
  readonly seed: string;
  readonly depths: readonly number[];
  readonly casesPerClass: number;
  readonly profileId: ProfileId;
  readonly purpose: "evaluation" | "illustration";
}

export interface Candidate {
  readonly reference: CanonicalReference;
  readonly family: "tangent-envelope" | "weighted-envelope" | "shifted-absolute";
  readonly semanticKey: string;
}

export interface SuiteCase extends Candidate {
  readonly id: string;
  readonly depth: number;
  readonly label: Label;
  readonly ordinal: number;
  readonly attempt: number;
  readonly certificate: VerificationCertificate;
}

export interface Coverage {
  readonly depth: number;
  readonly label: Label;
  readonly requested: number;
  readonly accepted: number;
}

export interface GenerationSummary {
  readonly attempts: number;
  readonly accepted: number;
  readonly rejections: Readonly<Record<string, number>>;
  readonly coverage: readonly Coverage[];
}

export interface FrozenSuite {
  readonly formatVersion: "1";
  readonly generatorVersion: "1";
  readonly depthPolicyVersion: "1";
  readonly verifierVersion: string;
  readonly protocolVersion: "1";
  readonly id: string;
  readonly request: SuiteRequest;
  readonly cases: readonly SuiteCase[];
  readonly summary: GenerationSummary;
}

export type GenerationResult =
  | { readonly status: "complete"; readonly suite: FrozenSuite }
  | {
      readonly status: "incomplete";
      readonly reason: "cancelled" | "attempt-limit";
      readonly request: SuiteRequest;
      readonly cases: readonly SuiteCase[];
      readonly summary: GenerationSummary;
    };
