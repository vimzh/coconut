// A separately frozen fresh replication preserves every original cell and its failed evidence.
import { writeFile } from "node:fs/promises";
import { qualityDataHash } from "../quality";
import type { CapabilityObservation } from "./capabilities";
import { effortWasAccepted } from "./capabilities";
import type { FrozenExperiment } from "./manifest";
import { readOriginalExperiment, reconcileExperiment, type ExperimentReconciliation } from "./reconcile";

export function createReplicationManifest(original: FrozenExperiment, reconciliation: ExperimentReconciliation, controls: readonly CapabilityObservation[]): FrozenExperiment {
  if (original.replication || reconciliation.sourceManifestSha256 !== qualityDataHash(original)
    || reconciliation.counts.completedCells !== 0 || reconciliation.counts.executedCells !== reconciliation.records.length
    || reconciliation.records.some(row => ["running", "cancelling"].includes(row.state))
    || controls.length !== original.cells.filter(cell => cell.phase === "capability-probe").length
    || new Set(controls.map(row => `${row.modelId}:${row.effort}`)).size !== controls.length
    || controls.reduce((sum, row) => sum + row.result.inferenceRequests, 0) !== reconciliation.counts.capabilityInferenceRequests) throw new Error("Original execution or retained controls do not support a full fresh replication.");
  for (const control of controls) {
    if (!original.cells.some(cell => cell.phase === "capability-probe" && cell.modelId === control.modelId && cell.reasoningEffort === control.effort)
      || control.result.requested.modelId !== control.modelId || control.result.requested.profileId !== `one-shot-json-v2-${control.effort}`) throw new Error("A retained control differs from its original frozen setting.");
  }
  const plannedNewMathInferenceRequests = original.cells.reduce((sum, cell) => {
    if (cell.phase === "capability-probe") return sum;
    const accepted = cell.reasoningEffort === "provider-default" || controls.some(control => control.modelId === cell.modelId && control.effort === cell.reasoningEffort && effortWasAccepted(control));
    return sum + (accepted ? cell.phase === "confirmation" ? 216 : 27 : 0);
  }, 0);
  const retainedPriorInferenceRequests = reconciliation.counts.maximumPriorInferenceRequests;
  const maximumCumulativeInferenceRequests = retainedPriorInferenceRequests + plannedNewMathInferenceRequests;
  if (!Number.isSafeInteger(retainedPriorInferenceRequests) || retainedPriorInferenceRequests < 0 || maximumCumulativeInferenceRequests > original.budget.maxChargedAttempts) throw new Error("A fresh replication exceeds the cumulative inference ceiling.");
  return { ...original, frozenAt: new Date().toISOString(), plannedInferenceCeiling: plannedNewMathInferenceRequests,
    replication: { kind: "complete-fresh-replication", sourceManifestSha256: qualityDataHash(original), sourceLedgerSha256: reconciliation.sourceLedgerSha256,
      reconciliationSha256: qualityDataHash(reconciliation), retainedPriorInferenceRequests, plannedNewMathInferenceRequests, maximumCumulativeInferenceRequests,
      retainedControlsSha256: qualityDataHash(controls),
      capabilityPolicy: "reuse-retained-controls-without-new-calls",
      reason: "The first complete matrix attempt produced no complete evaluation cells after a shared connection failure. This fresh replication repeats all originally eligible cells with identical tasks/settings, keeps every original attempt, makes no score-based selection, and reuses setting controls without sending them again." },
    interpretation: `${original.interpretation} This is a fresh complete replication after an observed connection outage, linked to the preserved original matrix and reconciliation. Original partial prefixes have already been observed; their exposure is explicit. Capability-probe cells document retained prior controls and schedule no new calls.` };
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output" || !args[1]) throw new Error("Use --output with a new manifest path.");
    const { manifest, ledger, views } = await readOriginalExperiment();
    if (ledger.state !== "settled") throw new Error("Original execution is not settled.");
    const reconciliation = await Bun.file(new URL("../../data/experiments/openai-reconciliation-v1.json", import.meta.url)).json() as ExperimentReconciliation;
    const rechecked = { ...reconcileExperiment(manifest, ledger, views), checkedAt: reconciliation.checkedAt };
    if (qualityDataHash(rechecked) !== qualityDataHash(reconciliation)) throw new Error("Saved reconciliation does not match the retained original evidence.");
    const calibration = await Bun.file(new URL("../../data/experiments/capabilities-v1.json", import.meta.url)).json() as { state: string; probes: CapabilityObservation[]; errors: unknown[] };
    if (calibration.state !== "complete" || calibration.errors.length) throw new Error("Retained controls are incomplete.");
    const replication = createReplicationManifest(manifest, reconciliation, calibration.probes);
    await writeFile(args[1], `${JSON.stringify(replication, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ manifestSha256: qualityDataHash(replication), frozenAt: replication.frozenAt, replication: replication.replication }));
  } catch { console.error("A fresh replication could not be frozen. Original evidence was not changed and no provider request was made."); process.exitCode = 1; }
}
