// Foreground runs retain every planned logical trial and keep access separate from provider keys.
import type { InferenceResult } from "../inference";
import type { ProfileId, PromptBlueprint, Workload } from "../protocol";
import type { ProviderId } from "../providers";
import type { RunEvidence, ScoringReport } from "../scoring";
import type { validateSuiteArtifact } from "../suites/artifact";

export type RunSuiteKey = "reference-v1" | "smooth-v2" | "challenge-v1" | "screening-v1";
export type RunSuite = Awaited<ReturnType<typeof validateSuiteArtifact>>;
export interface RunRequest {
  readonly suiteKey: RunSuiteKey;
  readonly provider: ProviderId;
  readonly modelId: string;
  readonly servingProvider: string | null;
  readonly profileId: ProfileId;
  readonly concurrency: number;
  readonly acceptCharges: true;
}
export type RunState = "running" | "cancelling" | "completed" | "cancelled" | "timed-out" | "failed" | "interrupted";
export interface RunProgress {
  readonly plannedTrials: number;
  readonly startedTrials: number;
  readonly activeTrials: number;
  readonly finishedTrials: number;
  readonly modelOutcomes: number;
  readonly infrastructureFailures: number;
  readonly remainingTrials: number;
  readonly inferenceRequests: number;
}
export interface RunRecord {
  readonly version: "1";
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly state: RunState;
  readonly request: RunRequest;
  readonly suite: RunSuite;
  readonly prompts: readonly PromptBlueprint[];
  readonly workload: Workload;
  readonly progress: RunProgress;
  readonly results: readonly { readonly caseId: string; readonly trialIndex: number; readonly result: InferenceResult }[];
  readonly evidence: RunEvidence;
  readonly report: ScoringReport | null;
  readonly failure: { readonly code: string; readonly message: string } | null;
}
export interface RunView {
  readonly record: RunRecord;
  readonly publishedAt: string | null;
}
export interface RunStore {
  create(record: RunRecord): { readonly accessCode: string; readonly view: RunView };
  read(id: string, accessCode: string): RunView | null;
  save(record: RunRecord): RunView;
  publish(id: string, accessCode: string, published: boolean): RunView | null;
  readPublic(id: string): RunView | null;
  listPublic(): readonly RunView[];
  remove(id: string, accessCode: string): boolean;
  recoverInterrupted(): number;
  close(): void;
}
export type RunEvent =
  | { readonly type: "started"; readonly runId: string; readonly accessCode: string; readonly progress: RunProgress; readonly expiresAt: string }
  | { readonly type: "progress"; readonly runId: string; readonly state: RunState; readonly progress: RunProgress }
  | { readonly type: "finished"; readonly runId: string; readonly state: RunState; readonly progress: RunProgress; readonly report: ScoringReport }
  | { readonly type: "error"; readonly runId: string | null; readonly code: string; readonly message: string };
export interface RunSuiteDescription {
  readonly key: RunSuiteKey;
  readonly name: string;
  readonly description: string;
  readonly suiteId: string;
  readonly caseCount: number;
  readonly depths: readonly number[];
  readonly generatorVersion: string;
  readonly promptVersion: string;
  readonly recommended: boolean;
}
