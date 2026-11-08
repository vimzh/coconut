// Offline reconciliation counts retained attempts without replacing incomplete runs or calling providers.
import { readdir, writeFile } from "node:fs/promises";
import { qualityDataHash } from "../quality";
import type { RunView } from "../runs/types";
import type { FrozenExperiment } from "./manifest";

export interface ExperimentLedger {
  readonly version: "1";
  readonly manifestSha256: string;
  readonly capabilitiesInferenceRequests: number;
  readonly state: string;
  readonly cells: readonly { readonly id: string; readonly state: string; readonly runId: string | null; readonly progress: { readonly finished: number; readonly planned: number; readonly inferenceRequests: number } }[];
}
export interface ExperimentReconciliation {
  readonly version: "1";
  readonly kind: "offline-experiment-reconciliation";
  readonly checkedAt: string;
  readonly sourceManifestSha256: string;
  readonly sourceLedgerSha256: string;
  readonly records: readonly {
    readonly runId: string; readonly cellId: string; readonly recordSha256: string; readonly modelId: string; readonly profileId: string;
    readonly state: string; readonly plannedTrials: number; readonly retainedTrials: number; readonly inferenceRequests: number;
    readonly answerCount: number; readonly correctAnswers: number; readonly wrongCaseIds: readonly string[];
  }[];
  readonly counts: {
    readonly executedCells: number; readonly capabilityUnverifiedCells: number; readonly completedCells: number;
    readonly plannedTrials: number; readonly retainedTrials: number; readonly answerCount: number; readonly correctAnswers: number;
    readonly mathematicalInferenceRequests: number; readonly capabilityInferenceRequests: number; readonly earlierCalibrationAllowance: number;
    readonly maximumPriorInferenceRequests: number; readonly unknownRemoteInferenceRequests: number;
    readonly metadataFailures: number; readonly failureCodes: Readonly<Record<string, number>>;
  };
  readonly interpretation: string;
}

export function reconcileExperiment(manifest: FrozenExperiment, ledger: ExperimentLedger, views: readonly RunView[]): ExperimentReconciliation {
  if (ledger.version !== "1" || ledger.manifestSha256 !== qualityDataHash(manifest)
    || !Number.isSafeInteger(ledger.capabilitiesInferenceRequests) || ledger.capabilitiesInferenceRequests < 0) throw new Error("Experiment ledger does not match its frozen manifest.");
  const cells = manifest.cells.filter(cell => cell.phase !== "capability-probe"), byRun = new Map(views.map(view => [view.record.id, view]));
  if (new Set(cells.map(cell => cell.id)).size !== cells.length || byRun.size !== views.length || ledger.cells.length !== cells.length
    || new Set(ledger.cells.map(cell => cell.id)).size !== cells.length) throw new Error("Experiment identities are repeated or incomplete.");
  const records: ExperimentReconciliation["records"][number][] = [];
  let capabilityUnverifiedCells = 0, metadataFailures = 0, unknownRemoteInferenceRequests = 0;
  const failureCodes: Record<string, number> = {};
  for (const status of ledger.cells) {
    const cell = cells.find(candidate => candidate.id === status.id);
    if (!cell) throw new Error("An unplanned matrix cell is present.");
    if (!status.runId) {
      if (status.state === "capability-unverified") { capabilityUnverifiedCells++; continue; }
      if (status.state === "pending") continue;
      throw new Error("An attempted matrix cell has no retained run receipt.");
    }
    const view = byRun.get(status.runId), record = view?.record;
    if (!record || record.id !== status.runId || record.request.modelId !== cell.modelId || record.request.profileId !== cell.profileId
      || record.request.provider !== cell.provider || record.request.servingProvider !== cell.servingProvider
      || record.request.concurrency !== cell.concurrency || record.suite.id !== cell.suiteId
      || qualityDataHash(record.suite) !== cell.suiteSha256 || qualityDataHash(record.prompts) !== cell.promptsSha256
      || record.evidence.model.settingsId !== cell.settingsId) throw new Error("Retained run identity differs from its frozen cell.");
    const planned = record.suite.cases.length * 3, trials = new Set<string>();
    let inferenceRequests = 0, answerCount = 0, correctAnswers = 0;
    const wrongCaseIds = new Set<string>();
    if (record.workload.logicalCalls !== planned || status.progress.planned !== planned) throw new Error("The planned denominator changed.");
    for (const { caseId, trialIndex, result } of record.results) {
      const entry = record.suite.cases.find(candidate => candidate.id === caseId), key = `${caseId}:${trialIndex}`;
      if (!entry || !Number.isInteger(trialIndex) || trialIndex < 0 || trialIndex > 2 || trials.has(key)
        || (result.inferenceRequests !== 0 && result.inferenceRequests !== 1)
        || !Number.isSafeInteger(result.httpAttempts) || result.httpAttempts < result.inferenceRequests
        || result.requested.modelId !== cell.modelId || result.requested.profileId !== cell.profileId) throw new Error("A retained attempt is duplicated, malformed, or belongs to another cell.");
      trials.add(key); inferenceRequests += result.inferenceRequests;
      if (result.failure) {
        failureCodes[result.failure.code] = (failureCodes[result.failure.code] ?? 0) + 1;
        if (result.inferenceRequests === 0) metadataFailures++;
        if (result.inferenceRequests === 1 && result.failure.remoteOutcome === "unknown") unknownRemoteInferenceRequests++;
      }
      if (result.evidence.outcome.kind === "answer") {
        answerCount++;
        if (result.evidence.outcome.label === entry.label) correctAnswers++; else wrongCaseIds.add(caseId);
      }
    }
    if (status.progress.finished !== record.results.length || status.progress.inferenceRequests !== inferenceRequests
      || record.progress.finishedTrials !== record.results.length || record.progress.inferenceRequests !== inferenceRequests) throw new Error("Retained and ledger attempt counts disagree.");
    records.push({ runId: record.id, cellId: cell.id, recordSha256: qualityDataHash(view), modelId: cell.modelId, profileId: cell.profileId,
      state: record.state, plannedTrials: planned, retainedTrials: record.results.length, inferenceRequests, answerCount, correctAnswers, wrongCaseIds: [...wrongCaseIds].sort() });
  }
  if (records.length !== views.length) throw new Error("Unmatched retained records cannot be discarded from reconciliation.");
  records.sort((a, b) => a.cellId.localeCompare(b.cellId));
  const sum = (key: "plannedTrials" | "retainedTrials" | "inferenceRequests" | "answerCount" | "correctAnswers") => records.reduce((total, row) => total + row[key], 0);
  const mathematicalInferenceRequests = sum("inferenceRequests");
  return { version: "1", kind: "offline-experiment-reconciliation", checkedAt: new Date().toISOString(), sourceManifestSha256: qualityDataHash(manifest), sourceLedgerSha256: qualityDataHash(ledger), records,
    counts: { executedCells: records.length, capabilityUnverifiedCells, completedCells: records.filter(row => row.state === "completed").length,
      plannedTrials: sum("plannedTrials"), retainedTrials: sum("retainedTrials"), answerCount: sum("answerCount"), correctAnswers: sum("correctAnswers"),
      mathematicalInferenceRequests, capabilityInferenceRequests: ledger.capabilitiesInferenceRequests, earlierCalibrationAllowance: manifest.previousCalibrationAllowance,
      maximumPriorInferenceRequests: mathematicalInferenceRequests + ledger.capabilitiesInferenceRequests + manifest.previousCalibrationAllowance,
      unknownRemoteInferenceRequests, metadataFailures, failureCodes },
    interpretation: "Counts describe retained incomplete and complete populations. Correct observed prefixes are not full evaluation scores, evidence of mathematical failure, or permission to replace failed cells. Unknown remote sends count against the shared inference ceiling. No provider was called during reconciliation." };
}

export async function readOriginalExperiment(): Promise<{ manifest: FrozenExperiment; ledger: ExperimentLedger; views: RunView[] }> {
  const manifest = await Bun.file(new URL("../../data/experiments/openai-matrix-v1.json", import.meta.url)).json() as FrozenExperiment;
  const ledger = await Bun.file(new URL("../../data/experiments/openai-progress-v1.json", import.meta.url)).json() as ExperimentLedger;
  const root = new URL("../../data/private/experiment-records-v1/", import.meta.url);
  const files = await readdir(root);
  if (files.some(file => !/^[a-f0-9-]{36}\.json$/.test(file))) throw new Error("Unexpected retained-record file.");
  const views = await Promise.all(files.map(file => Bun.file(new URL(file, root)).json() as Promise<RunView>));
  return { manifest, ledger, views };
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output" || !args[1]) throw new Error("Use --output with a new reconciliation path.");
    const { manifest, ledger, views } = await readOriginalExperiment(), report = reconcileExperiment(manifest, ledger, views);
    await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(report.counts));
  } catch { console.error("Offline reconciliation failed. Original evidence was not changed and no provider request was made."); process.exitCode = 1; }
}
