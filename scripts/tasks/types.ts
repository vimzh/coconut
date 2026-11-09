// Certified generated populations and their finite admission evidence.
import type { ImportReference } from "../../apps/api/src/randomized/admission";
import type { GeneratedCandidate } from "../../apps/api/src/randomized/source";
import type { ImportedCase } from "../../apps/api/src/randomized/types";
export type { ImportedCase, ImportReference };
export interface TasksRequest {
  readonly depths: readonly number[];
  readonly casesPerDepth: number;
  readonly seed: number;
  readonly maxBatches: number;
}
export interface TasksLedgerEntry {
  readonly depthOrdinal: number;
  readonly batch: number;
  readonly seed: number;
  readonly ordinal: number;
  readonly label: ImportedCase["label"];
  readonly expressionSha256: string;
  readonly disposition: "admitted" | "duplicate" | "quota-filled" | "unverified";
  readonly caseId: string | null;
  readonly reason: string | null;
}
export interface TasksBatch {
  readonly depthOrdinal: number;
  readonly batch: number;
  readonly seed: number;
  readonly csvSha256: string;
  readonly candidates: readonly GeneratedCandidate[];
}
export interface TasksArtifact {
  readonly version: "1";
  readonly policy: "configurable-import-tasks-v1";
  readonly id: string;
  readonly state: "complete" | "incomplete";
  readonly request: TasksRequest;
  readonly domain: { readonly min: "-1"; readonly max: "1" };
  readonly provenance: { readonly source: unknown; readonly implementation: Readonly<Record<string, string>>; readonly permissions: "private-local-only-export-permissions-unresolved" };
  readonly cases: readonly ImportedCase[];
  readonly references: Readonly<Record<string, ImportReference>>;
  readonly batches: readonly TasksBatch[];
  readonly ledger: readonly TasksLedgerEntry[];
  readonly failure: string | null;
}
