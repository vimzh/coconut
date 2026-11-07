// Shared mathematical inputs and serializable verification evidence.
import type { Rational } from "./rational";

export type Label = "convex" | "concave" | "neither";

export type Expression =
  | { op: "variable" }
  | { op: "constant"; value: string }
  | { op: "negate" | "square" | "abs"; arg: Expression }
  | {
      op: "add" | "multiply" | "max" | "min";
      left: Expression;
      right: Expression;
    };

export interface CanonicalReference {
  expression: Expression;
  domain: { min: string; max: string };
  claimedLabel: Label;
  witnessPairs: { x: string; y: string }[];
}

export interface Range {
  min: Rational;
  max: Rational;
}

export interface ParsedReference {
  canonical: CanonicalReference;
  domain: Range;
  witnessPairs: { x: Rational; y: Rational }[];
}

export interface TraceEntry {
  node: number;
  op: Expression["op"];
  depth: number;
  convex: boolean;
  concave: boolean;
  range: { min: string; max: string };
  rule: string;
}

export interface Analysis {
  convex: boolean;
  concave: boolean;
  range: Range;
  depth: number;
  nodeCount: number;
  trace: TraceEntry[];
}

export interface Witness {
  x: string;
  y: string;
  midpoint: string;
  fX: string;
  fY: string;
  fMidpoint: string;
  gap: string;
}

export interface VerificationCertificate {
  version: string;
  input: CanonicalReference;
  fingerprint: string;
  renderedExpression: string;
  depth: number;
  nodeCount: number;
  trace: TraceEntry[];
  witnesses: {
    againstConvexity?: Witness;
    againstConcavity?: Witness;
  };
}

export type InputFailure =
  | "invalid-input"
  | "invalid-domain"
  | "unsupported-operation";

export type VerificationResult =
  | {
      status: "verified";
      label: Label;
      certificate: VerificationCertificate;
    }
  | { status: "excluded"; reason: "overlapping-labels"; message: string }
  | {
      status: "unverified";
      reason:
        | "inconclusive-curvature"
        | "no-strict-witness"
        | "resource-limit";
      message: string;
    }
  | {
      status: "rejected";
      reason: InputFailure | "label-mismatch";
      message: string;
    };
