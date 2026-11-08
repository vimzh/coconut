// A separate eight-cell supplement preserves unfinished scheduling, prior exposure, and actual-send accounting.
import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNumericalPrompts } from "../numerics";
import type { ProfileId, PromptBlueprint } from "../protocol";
import { qualityDataHash } from "../quality";
import { QUALITY_CRITERIA_SHA256, snapshot } from "../quality/data";
import { auditRetainedMetrics } from "../quality/reporting-audit";
import { reflectsCredential } from "../providers/responses";
import { deriveRunSettingsId } from "../runs/evidence";
import { loadRunSuite } from "../runs/registry";
import type { RunEvent, RunState, RunSuite, RunView } from "../runs/types";
import { effortWasAccepted, type CapabilityObservation } from "./capabilities";
import { launchForegroundRun, LOCAL_API, readApplicationJson, readSettledPrivateRun } from "./http";
import type { FrozenExperiment } from "./manifest";
import { matrixFailureRequiresStop } from "./matrix-policy";
import type { ExperimentLedger } from "./reconcile";
import { experimentPaths } from "./run";

const PARENT_SHA256 = "62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e";
const PARENT_LEDGER_SHA256 = "965ec97993701ad8712df8155e09b6f992a0e7a531e82848f0d42e08dd9c9787";
const PROFILES: readonly ProfileId[] = ["one-shot-json-v1", "one-shot-json-v2-low", "one-shot-json-v2-medium", "one-shot-json-v2-high"];
type Cell = FrozenExperiment["cells"][number];
export interface ScreeningWorkload { readonly suite: RunSuite; readonly prompts: readonly PromptBlueprint[] }
export interface RemainingModelsInputs {
  readonly parent: FrozenExperiment; readonly ledger: ExperimentLedger; readonly controls: readonly CapabilityObservation[];
  readonly workloads: ReadonlyMap<ProfileId, ScreeningWorkload>;
  readonly priorStudies: readonly { readonly key: PriorStudy["key"]; readonly manifest: unknown; readonly ledger: ExperimentLedger;
    readonly reconciliation: StudyReconciliation; readonly sendEvidence: StudySendEvidence }[];
  readonly conditionalReserveActivated: boolean;
}

// The coordinator supplies this only after reconciling every earlier paid population to terminal private records.
export interface PriorInferenceAccounting {
  readonly version: "1"; readonly kind: "reconciled-inference-accounting"; readonly checkedAt: string; readonly inferenceCeiling: 8192;
  readonly controls: { readonly path: "apps/api/data/experiments/capabilities-v1.json"; readonly sha256: string; readonly inferenceRequests: 183 };
  readonly studies: readonly PriorStudy[];
  readonly earlierCalibrationAllowance: 4;
  readonly totalPriorInferenceRequests: number;
}
export interface PriorStudy {
  readonly key: "original" | "replication" | "interior" | "conditional-reserve";
  readonly manifestPath: string; readonly manifestSha256: string; readonly ledgerPath: string; readonly ledgerSha256: string;
  readonly reconciliationPath: string; readonly reconciliationSha256: string; readonly inferenceRequests: number; readonly unknownRemoteInferenceRequests: number;
  readonly sendEvidencePath: string; readonly sendEvidenceSha256: string;
}
export interface StudyReconciliation {
  readonly version: "1"; readonly kind: "offline-experiment-reconciliation" | "offline-study-reconciliation"; readonly checkedAt: string;
  readonly sourceManifestSha256: string; readonly sourceLedgerSha256: string;
  readonly records: readonly { readonly cellId: string; readonly runId: string; readonly recordSha256: string; readonly state: string;
    readonly plannedTrials: number; readonly retainedTrials: number; readonly inferenceRequests: number }[];
  readonly counts: { readonly mathematicalInferenceRequests: number; readonly unknownRemoteInferenceRequests: number };
}
export interface StudySendEvidence {
  readonly version: "1"; readonly kind: "study-send-reconciliation"; readonly checkedAt: string;
  readonly sourceManifestSha256: string; readonly sourceLedgerSha256: string; readonly sourceReconciliationSha256: string;
  readonly records: readonly { readonly cellId: string; readonly runId: string; readonly viewSha256: string; readonly state: string;
    readonly activeTrials: number; readonly plannedTrials: number; readonly finishedTrials: number; readonly inferenceRequests: number;
    readonly attempts: readonly { readonly caseId: string; readonly trialIndex: number; readonly resultSha256: string;
      readonly inferenceRequests: number; readonly httpAttempts: number;
      readonly failure: { readonly code: string; readonly remoteOutcome: "not-sent" | "unknown" | "response-received" } | null }[] }[];
  readonly counts: { readonly mathematicalInferenceRequests: number; readonly unknownRemoteInferenceRequests: number };
}
export interface RemainingModelsExperiment {
  readonly version: "1"; readonly kind: "remaining-model-screening-supplement"; readonly frozenAt: string; readonly criteriaSha256: string;
  readonly sourceParent: { readonly manifestSha256: string; readonly ledgerSha256: string; readonly originalManifestSha256: string;
    readonly originalLedgerSha256: string; readonly originalReconciliationSha256: string; readonly retainedControlsSha256: string };
  readonly exposure: { readonly selectionRule: string; readonly priorResults: string; readonly ledgerSnapshot: ExperimentLedger; readonly ledgerSnapshotSha256: string };
  readonly priorAccounting: PriorInferenceAccounting; readonly priorAccountingSha256: string;
  readonly cells: readonly Cell[];
  readonly budget: { readonly sharedInferenceCeiling: 8192; readonly priorActualInferenceRequests: number; readonly maxNewInferenceRequests: 216;
    readonly cumulativeInferenceCeiling: number; readonly parallelRuns: 3; readonly runConcurrency: 4; readonly maxConcurrency: 12; readonly retries: 0;
    readonly trialsPerCase: 3; readonly attemptsPerTrial: 1; readonly metadataTimeoutMs: 20000; readonly inferenceTimeoutMs: 180000 };
  readonly capabilities: { readonly policy: "reuse-retained-controls-without-new-calls"; readonly retainedProbeCount: 183; readonly newRequests: 0 };
  readonly interpretation: { readonly population: "screening"; readonly ranked: false; readonly confidenceInterval: "unavailable"; readonly strongSignalEligible: false; readonly scope: string };
}
interface Status {
  id: string; state: "pending" | "active" | Exclude<RunState, "running" | "cancelling">; runId: string | null;
  progress: { finished: number; planned: number; inferenceRequests: number }; reportId: string | null; published: boolean; archived: boolean; error: string | null;
}

function assertTerminal(ledger: ExperimentLedger): void {
  if (!["settled", "interrupted"].includes(ledger.state) || ledger.cells.some(cell => ["active", "running", "cancelling"].includes(cell.state))) throw new Error("Every earlier paid study must be terminal before the supplement is frozen or launched.");
}

const isHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
const terminalStates = ["completed", "cancelled", "timed-out", "failed", "interrupted"];
function exactKeys(value: unknown, keys: string): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.split(",").sort().join(",");
}

export function assertStudySendEvidence(study: Pick<PriorStudy, "manifestSha256" | "ledgerSha256" | "reconciliationSha256" | "sendEvidenceSha256" | "inferenceRequests" | "unknownRemoteInferenceRequests">,
  source: Pick<RemainingModelsInputs["priorStudies"][number], "ledger" | "reconciliation" | "sendEvidence">, accountingAt: string): void {
  const primary = source.reconciliation, evidence = source.sendEvidence, ledgerAt = (source.ledger as ExperimentLedger & { updatedAt?: string }).updatedAt;
  if (!primary || primary.version !== "1" || !["offline-experiment-reconciliation", "offline-study-reconciliation"].includes(primary.kind)
    || !validTime(ledgerAt) || !validTime(primary.checkedAt) || Date.parse(primary.checkedAt) < Date.parse(ledgerAt)
    || !Array.isArray(primary.records) || primary.records.length > 500 || primary.records.some(record => !record || typeof record.runId !== "string" || typeof record.cellId !== "string") || !primary.counts
    || !evidence || !exactKeys(evidence, "version,kind,checkedAt,sourceManifestSha256,sourceLedgerSha256,sourceReconciliationSha256,records,counts")
    || evidence.version !== "1" || evidence.kind !== "study-send-reconciliation" || !validTime(evidence.checkedAt)
    || Date.parse(evidence.checkedAt) < Date.parse(primary.checkedAt) || Date.parse(accountingAt) < Date.parse(evidence.checkedAt)
    || !Array.isArray(evidence.records) || evidence.records.length > 500 || evidence.records.some(record => !record || typeof record.runId !== "string" || typeof record.cellId !== "string")
    || !exactKeys(evidence.counts, "mathematicalInferenceRequests,unknownRemoteInferenceRequests")
    || ![primary.sourceManifestSha256, primary.sourceLedgerSha256, evidence.sourceManifestSha256, evidence.sourceLedgerSha256, evidence.sourceReconciliationSha256].every(isHash)
    || evidence.sourceManifestSha256 !== study.manifestSha256 || evidence.sourceLedgerSha256 !== study.ledgerSha256
    || evidence.sourceReconciliationSha256 !== study.reconciliationSha256 || qualityDataHash(evidence) !== study.sendEvidenceSha256) throw new Error("A valid terminal per-attempt send reconciliation and full primary records are required.");
  const started = source.ledger.cells.filter(cell => cell.runId !== null), primaryByRun = new Map(primary.records.map(record => [record.runId, record]));
  if (new Set(source.ledger.cells.map(cell => cell.id)).size !== source.ledger.cells.length || new Set(started.map(cell => cell.runId)).size !== started.length
    || primaryByRun.size !== primary.records.length || new Set(primary.records.map(record => record.cellId)).size !== primary.records.length
    || new Set(evidence.records.map(record => record.runId)).size !== evidence.records.length || new Set(evidence.records.map(record => record.cellId)).size !== evidence.records.length
    || primary.records.length !== started.length || evidence.records.length !== started.length) throw new Error("Send reconciliation must contain all and only the unique started ledger runs and cells.");
  let sends = 0, unknown = 0;
  for (const record of evidence.records) {
    const status = started.find(cell => cell.runId === record.runId && cell.id === record.cellId), retained = primaryByRun.get(record.runId);
    if (!exactKeys(record, "cellId,runId,viewSha256,state,activeTrials,plannedTrials,finishedTrials,inferenceRequests,attempts")
      || !status || !retained || retained.cellId !== record.cellId || !/^[A-Za-z0-9_-]{1,128}$/.test(record.runId)
      || !isHash(record.viewSha256) || !isHash(retained.recordSha256) || record.viewSha256 !== retained.recordSha256
      || !terminalStates.includes(record.state) || !terminalStates.includes(status.state) || retained.state !== record.state || record.activeTrials !== 0
      || !Number.isSafeInteger(record.plannedTrials) || record.plannedTrials < 3 || record.plannedTrials > 225 || record.plannedTrials % 3 !== 0
      || record.plannedTrials !== status.progress.planned || record.plannedTrials !== retained.plannedTrials
      || !Array.isArray(record.attempts) || record.attempts.length > record.plannedTrials || record.finishedTrials !== record.attempts.length
      || record.state === "completed" && record.finishedTrials !== record.plannedTrials
      || record.finishedTrials !== status.progress.finished || record.finishedTrials !== retained.retainedTrials) throw new Error("Per-run send evidence is incomplete, duplicated, nonterminal, or differs from its retained view and ledger.");
    const trials = new Set<string>(); let recordSends = 0;
    for (const attempt of record.attempts) {
      if (!exactKeys(attempt, "caseId,trialIndex,resultSha256,inferenceRequests,httpAttempts,failure")) throw new Error("A per-attempt send projection has invalid fields.");
      const trial = `${attempt.caseId}:${attempt.trialIndex}`;
      if (typeof attempt.caseId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(attempt.caseId) || !Number.isInteger(attempt.trialIndex) || attempt.trialIndex < 0 || attempt.trialIndex > 2
        || trials.has(trial) || !isHash(attempt.resultSha256) || ![0, 1].includes(attempt.inferenceRequests)
        || !Number.isSafeInteger(attempt.httpAttempts) || attempt.httpAttempts < attempt.inferenceRequests
        || attempt.failure !== null && (!exactKeys(attempt.failure, "code,remoteOutcome") || !/^[a-z][a-z0-9-]{0,95}$/.test(attempt.failure.code)
          || !["not-sent", "unknown", "response-received"].includes(attempt.failure.remoteOutcome))) throw new Error("A per-attempt send identity, count, or failure projection is invalid or repeated.");
      trials.add(trial); recordSends += attempt.inferenceRequests;
      if (attempt.inferenceRequests === 1 && attempt.failure?.remoteOutcome === "unknown") unknown++;
    }
    if (new Set(record.attempts.map((attempt: StudySendEvidence["records"][number]["attempts"][number]) => attempt.caseId)).size > record.plannedTrials / 3
      || recordSends !== record.inferenceRequests || recordSends !== status.progress.inferenceRequests || recordSends !== retained.inferenceRequests) throw new Error("Per-attempt sends disagree with the run, primary reconciliation, or terminal ledger.");
    sends += recordSends;
  }
  if (sends !== evidence.counts.mathematicalInferenceRequests || unknown !== evidence.counts.unknownRemoteInferenceRequests
    || sends !== primary.counts.mathematicalInferenceRequests || unknown !== primary.counts.unknownRemoteInferenceRequests
    || sends !== study.inferenceRequests || unknown !== study.unknownRemoteInferenceRequests) throw new Error("Derived sends and unknown remote outcomes disagree with the retained reconciliation or accounting totals.");
}

function originalCells(data: RemainingModelsInputs): readonly Cell[] {
  const { parent, ledger, controls } = data;
  assertTerminal(ledger);
  if (qualityDataHash(parent) !== PARENT_SHA256 || qualityDataHash(ledger) !== PARENT_LEDGER_SHA256 || ledger.manifestSha256 !== PARENT_SHA256
    || parent.criteriaSha256 !== QUALITY_CRITERIA_SHA256 || controls.length !== 183 || qualityDataHash(controls) !== parent.replication?.retainedControlsSha256) throw new Error("The pinned parent, terminal exposure ledger, or retained controls changed.");
  const members = new Map(parent.cells.filter(cell => cell.phase === "screening").map(cell => [cell.id, cell]));
  const models = [...new Set(ledger.cells.filter(status => ["pending", "interrupted"].includes(status.state)).flatMap(status => members.has(status.id) ? [members.get(status.id)!.modelId] : []))].sort();
  if (models.join(",") !== "o3,o3-2025-04-16") throw new Error("Unfinished scheduling no longer selects exactly the two declared model IDs.");
  const cells = parent.cells.filter(cell => cell.phase === "screening" && models.includes(cell.modelId));
  if (cells.length !== 8 || models.some(model => cells.filter(cell => cell.modelId === model).map(cell => cell.profileId).join(",") !== PROFILES.join(","))) throw new Error("The complete original eight-cell screening membership changed.");
  for (const cell of cells) {
    const loaded = data.workloads.get(cell.profileId);
    if (!loaded || cell.provider !== "openai" || cell.servingProvider !== null || cell.concurrency !== 4 || loaded.suite.cases.length !== 9
      || loaded.suite.id !== cell.suiteId || qualityDataHash(loaded.suite) !== cell.suiteSha256 || qualityDataHash(loaded.prompts) !== cell.promptsSha256
      || loaded.prompts.length !== 9 || loaded.prompts.some(prompt => prompt.profileId !== cell.profileId)
      || deriveRunSettingsId({ profileId: cell.profileId, concurrency: 4 }, loaded.prompts[0].generation) !== cell.settingsId
      || loaded.prompts[0].generation.reasoning !== cell.reasoningEffort || loaded.prompts[0].generation.maxOutputTokens !== cell.maxOutputTokens
      || cell.reasoningEffort !== "provider-default" && !controls.some(control => control.modelId === cell.modelId && control.effort === cell.reasoningEffort && effortWasAccepted(control))) throw new Error("Original screening suite, prompts, settings, or retained effort acceptance changed.");
  }
  return cells;
}

function assertAccounting(accounting: PriorInferenceAccounting, data: RemainingModelsInputs): void {
  if (!accounting || accounting.version !== "1" || accounting.kind !== "reconciled-inference-accounting" || accounting.inferenceCeiling !== 8192 || !Number.isFinite(Date.parse(accounting.checkedAt))
    || Date.parse(accounting.checkedAt) > Date.now() || accounting.controls?.sha256 !== qualityDataHash(data.controls)
    || accounting.controls.path !== "apps/api/data/experiments/capabilities-v1.json" || accounting.controls.inferenceRequests !== 183 || accounting.earlierCalibrationAllowance !== 4 || !Array.isArray(accounting.studies)
    || ![3, 4].includes(accounting.studies.length) || new Set(accounting.studies.map(study => study.key)).size !== accounting.studies.length
    || ["original", "replication", "interior"].some(key => !accounting.studies.some(study => study.key === key))
    || accounting.studies.some(study => study.key === "conditional-reserve") !== data.conditionalReserveActivated
    || new Set(accounting.studies.map(study => study.manifestSha256)).size !== accounting.studies.length
    || accounting.studies.some(study => ![study.manifestSha256, study.ledgerSha256, study.reconciliationSha256, study.sendEvidenceSha256].every(isHash)
      || ![study.manifestPath, study.ledgerPath, study.reconciliationPath, study.sendEvidencePath].every(path => /^apps\/api\/data\/experiments\/[a-z0-9][a-z0-9-]*\.json$/.test(path))
      || !["original", "replication", "interior", "conditional-reserve"].includes(study.key)
      || !Number.isSafeInteger(study.inferenceRequests) || study.inferenceRequests < 0
      || !Number.isSafeInteger(study.unknownRemoteInferenceRequests) || study.unknownRemoteInferenceRequests < 0 || study.unknownRemoteInferenceRequests > study.inferenceRequests)
    || !accounting.studies.some(study => study.key === "replication" && study.manifestSha256 === PARENT_SHA256 && study.ledgerSha256 === PARENT_LEDGER_SHA256)
    || !accounting.studies.some(study => study.key === "original" && study.manifestSha256 === data.parent.replication?.sourceManifestSha256 && study.ledgerSha256 === data.parent.replication?.sourceLedgerSha256
      && study.reconciliationSha256 === data.parent.replication?.reconciliationSha256)
    || accounting.totalPriorInferenceRequests !== accounting.studies.reduce((sum, study) => sum + study.inferenceRequests, 187)
    || !Number.isSafeInteger(accounting.totalPriorInferenceRequests) || accounting.totalPriorInferenceRequests + 216 > 8192) throw new Error("Complete terminal actual-send accounting, including unknown remote sends and one retained-control/calibration allowance, is required within the unchanged budget.");
  if (data.priorStudies.length !== accounting.studies.length || new Set(data.priorStudies.map(study => study.key)).size !== data.priorStudies.length) throw new Error("Every activated earlier paid study requires one reconciled accounting entry.");
  for (const study of accounting.studies) {
    const source = data.priorStudies.find(candidate => candidate.key === study.key);
    if (!source) throw new Error("An earlier accounting source is missing.");
    assertTerminal(source.ledger);
    const updatedAt = (source.ledger as ExperimentLedger & { updatedAt?: string }).updatedAt;
    if (updatedAt !== undefined && (!Number.isFinite(Date.parse(updatedAt)) || Date.parse(updatedAt) > Date.parse(accounting.checkedAt))) throw new Error("Actual-send accounting predates an earlier study's terminal ledger.");
    const expected = study.key === "original" ? ["openai-matrix-v1", "openai-progress-v1"] : study.key === "replication" ? ["openai-matrix-v2", "openai-progress-v2"]
      : study.key === "interior" ? ["interior-matrix-v1", "interior-progress-v1"] : ["conditional-reserve-matrix-v1", "conditional-reserve-progress-v1"];
    if (study.manifestPath !== `apps/api/data/experiments/${expected[0]}.json` || study.ledgerPath !== `apps/api/data/experiments/${expected[1]}.json`
      || study.key === "interior" && study.manifestSha256 !== "a4f109d0ddd550442d10978bfd1854c07ba04bb4f6268dc7cdaead701106d536") throw new Error("Accounting names a different earlier study or frozen interior population.");
    if (qualityDataHash(source.manifest) !== study.manifestSha256 || qualityDataHash(source.ledger) !== study.ledgerSha256
      || qualityDataHash(source.reconciliation) !== study.reconciliationSha256 || source.ledger.manifestSha256 !== study.manifestSha256
      || source.reconciliation.sourceManifestSha256 !== study.manifestSha256 || source.reconciliation.sourceLedgerSha256 !== study.ledgerSha256
      || source.reconciliation.counts.mathematicalInferenceRequests !== study.inferenceRequests || source.reconciliation.counts.unknownRemoteInferenceRequests !== study.unknownRemoteInferenceRequests
      || source.ledger.cells.reduce((sum, cell) => sum + cell.progress.inferenceRequests, 0) !== study.inferenceRequests) throw new Error("Actual-send accounting differs from its immutable source manifest, terminal ledger, or reconciliation.");
    assertStudySendEvidence(study, source, accounting.checkedAt);
  }
}

export function createRemainingModelsExperiment(data: RemainingModelsInputs, accounting: PriorInferenceAccounting): RemainingModelsExperiment {
  const cells = originalCells(data); assertAccounting(accounting, data);
  const replication = data.parent.replication!;
  return snapshot({ version: "1", kind: "remaining-model-screening-supplement", frozenAt: new Date().toISOString(), criteriaSha256: QUALITY_CRITERIA_SHA256,
    sourceParent: { manifestSha256: PARENT_SHA256, ledgerSha256: PARENT_LEDGER_SHA256, originalManifestSha256: replication.sourceManifestSha256,
      originalLedgerSha256: replication.sourceLedgerSha256, originalReconciliationSha256: replication.reconciliationSha256, retainedControlsSha256: replication.retainedControlsSha256 },
    exposure: { selectionRule: "Select model IDs with pending/interrupted original screening scheduling in the pinned terminal parent ledger; run all four original screening profiles afresh for each. No grade selects membership.",
      priorResults: "Earlier failed and incomplete runs remain separate. The parent o3/default run returned a seven-answer prefix before failure; that exposure is known. No prefix is resumed, discarded, or pooled with these 27 fresh trials per cell.",
      ledgerSnapshot: data.ledger, ledgerSnapshotSha256: PARENT_LEDGER_SHA256 }, priorAccounting: accounting, priorAccountingSha256: qualityDataHash(accounting), cells,
    budget: { sharedInferenceCeiling: 8192, priorActualInferenceRequests: accounting.totalPriorInferenceRequests, maxNewInferenceRequests: 216,
      cumulativeInferenceCeiling: accounting.totalPriorInferenceRequests + 216, parallelRuns: 3, runConcurrency: 4, maxConcurrency: 12, retries: 0,
      trialsPerCase: 3, attemptsPerTrial: 1, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000 },
    capabilities: { policy: "reuse-retained-controls-without-new-calls", retainedProbeCount: 183, newRequests: 0 },
    interpretation: { population: "screening", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false,
      scope: "Eight separately recorded screening cells, 27 fresh planned trials each. Report descriptive outcomes with complete denominators only; aliases and snapshots stay distinct. Prior exposures and incomplete evidence do not establish a confidence interval, model ranking, or stronger signal." } });
}

async function inputs(accounting: PriorInferenceAccounting): Promise<RemainingModelsInputs> {
  const root = new URL("../../data/experiments/", import.meta.url);
  const parent = await Bun.file(new URL("openai-matrix-v2.json", root)).json() as FrozenExperiment;
  const ledger = await Bun.file(new URL("openai-progress-v2.json", root)).json() as ExperimentLedger;
  const calibration = await Bun.file(new URL("capabilities-v1.json", root)).json() as { state: string; probes: CapabilityObservation[]; errors: unknown[] };
  if (calibration.state !== "complete" || calibration.errors.length) throw new Error("Retained controls are incomplete.");
  const workloads = new Map<ProfileId, ScreeningWorkload>();
  for (const profile of PROFILES) {
    const suite = await loadRunSuite("screening-v1", profile);
    workloads.set(profile, { suite, prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), profile, "smooth-v2") });
  }
  // Restrict documentary reads to experiment artifacts; credentials and private receipts are never inputs to freezing.
  const artifact = async (path: string) => {
    if (!/^apps\/api\/data\/experiments\/[a-z0-9][a-z0-9-]*\.json$/.test(path)) throw new Error("Accounting paths must name experiment JSON artifacts.");
    return Bun.file(new URL(`../../../../${path}`, import.meta.url)).json();
  };
  const priorStudies = await Promise.all(accounting.studies.map(async study => ({ key: study.key, manifest: await artifact(study.manifestPath), ledger: await artifact(study.ledgerPath), reconciliation: await artifact(study.reconciliationPath), sendEvidence: await artifact(study.sendEvidencePath) })));
  return { parent, ledger, controls: calibration.probes, workloads, priorStudies,
    conditionalReserveActivated: await Bun.file(new URL("conditional-reserve-progress-v1.json", root)).exists() };
}

export async function freezeRemainingModelsExperiment(output: string, priorAccountingPath: string): Promise<RemainingModelsExperiment> {
  if (await Bun.file(output).exists()) throw new Error("The supplement manifest already exists; choose a new output path.");
  if (!priorAccountingPath) throw new Error("An immutable terminal lineage actual-send accounting artifact is required; no count is inferred from unused reservations.");
  const accounting = await Bun.file(priorAccountingPath).json() as PriorInferenceAccounting, data = await inputs(accounting);
  const manifest = createRemainingModelsExperiment(data, accounting);
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

export function assertRemainingRunReady(manifest: RemainingModelsExperiment, data: RemainingModelsInputs, policy: unknown, catalog: unknown): void {
  const recreated = createRemainingModelsExperiment(data, manifest.priorAccounting);
  if (qualityDataHash({ ...recreated, frozenAt: manifest.frozenAt }) !== qualityDataHash(manifest) || !Number.isFinite(Date.parse(manifest.frozenAt))
    || Date.parse(manifest.frozenAt) > Date.now() || Date.parse(manifest.frozenAt) < Date.parse(manifest.priorAccounting.checkedAt)) throw new Error("Frozen supplement membership, accounting, chronology, or execution identities changed.");
  const limits = policy as Record<string, unknown>, choices = catalog as { suites?: readonly { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
  if (!limits || limits.policyId !== "foreground-runs-v1" || limits.trialsPerInstance !== 3 || limits.attemptsPerTrial !== 1 || limits.retries !== 0
    || limits.metadataTimeoutMs !== 20000 || limits.inferenceTimeoutMs !== 180000 || limits.maxActiveRuns !== 4 || limits.maxConcurrency !== 12
    || !choices?.suites?.some(suite => suite.key === "screening-v1" && suite.suiteId === data.workloads.get("one-shot-json-v1")!.suite.id && suite.caseCount === 9 && suite.generatorVersion === "challenge-v1")) throw new Error("The running API does not advertise the original screening suite and exact execution policy.");
}

export function assertRemainingCellView(cell: Cell, view: RunView, runId: string, frozenAt: string): void {
  const record = view.record;
  if (Object.keys(view).sort().join(",") !== "publishedAt,record" || record.id !== runId || !/^[A-Za-z0-9_-]{1,128}$/.test(runId)
    || !Number.isFinite(Date.parse(record.createdAt)) || Date.parse(record.createdAt) < Date.parse(frozenAt)
    || record.request.suiteKey !== "screening-v1" || record.request.provider !== "openai" || record.request.modelId !== cell.modelId || record.request.servingProvider !== null
    || record.request.profileId !== cell.profileId || record.request.concurrency !== 4 || record.suite.id !== cell.suiteId || qualityDataHash(record.suite) !== cell.suiteSha256
    || qualityDataHash(record.prompts) !== cell.promptsSha256 || record.evidence.model.settingsId !== cell.settingsId || record.workload.logicalCalls !== 27
    || record.progress.plannedTrials !== 27 || record.progress.activeTrials !== 0 || ["running", "cancelling"].includes(record.state)
    || record.results.some(row => !Number.isFinite(Date.parse(row.result.startedAt)) || Date.parse(row.result.startedAt) < Date.parse(frozenAt))) throw new Error("Retained supplement execution differs from its frozen original screening cell.");
  const trials = new Set<string>(); let sends = 0;
  for (const row of record.results) {
    const key = `${row.caseId}:${row.trialIndex}`;
    if (!record.suite.cases.some(entry => entry.id === row.caseId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2 || trials.has(key)
      || ![0, 1].includes(row.result.inferenceRequests) || row.result.requested.modelId !== cell.modelId || row.result.requested.profileId !== cell.profileId) throw new Error("Retained supplement attempt identity or one-attempt policy changed.");
    trials.add(key); sends += row.result.inferenceRequests;
  }
  if (record.results.length !== record.progress.finishedTrials || sends !== record.progress.inferenceRequests || sends > 27) throw new Error("Retained supplement sends or trial counts disagree.");
}

export function assertRemainingPublishedView(cell: Cell, view: RunView, runId: string, frozenAt: string): void {
  assertRemainingCellView(cell, view, runId, frozenAt);
  if (!view.publishedAt || view.record.state !== "completed" || view.record.results.length !== 27 || view.record.report?.overall.classification.population.status !== "complete") throw new Error("A completed explicit public publication is required for archiving.");
  auditRetainedMetrics(view.record);
}

export function remainingCellsComplete(statuses: readonly Pick<Status, "state" | "error" | "published" | "archived">[], publish: boolean): boolean {
  return statuses.length === 8 && statuses.every(cell => cell.state === "completed" && cell.error === null && (!publish || cell.published && cell.archived));
}

async function storeJson(path: string, value: unknown, credential: string, replace = false): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (reflectsCredential(text, credential)) throw new Error("Unsafe supplement evidence; the original private receipt must be inspected.");
  if (!replace) { await writeFile(path, text, { flag: "wx", mode: 0o600 }); return; }
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, { flag: "wx", mode: 0o600 }); await rename(temporary, path);
}

type Receipt = { runId: string; accessCode: string };
export function retainRemainingReceipt(root: string, receipts: Record<string, Receipt>, cellId: string, receipt: Receipt, credential: string): void {
  if (receipts[cellId] || Object.values(receipts).some(saved => saved.runId === receipt.runId) || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt.runId)
    || !/^[A-Za-z0-9_-]{43}$/.test(receipt.accessCode)) throw new Error("A private supplement receipt is invalid or repeated.");
  const text = `${JSON.stringify({ ...receipts, [cellId]: receipt }, null, 2)}\n`, temporary = join(root, `access.${randomUUID()}.tmp`);
  if (reflectsCredential(text, credential)) throw new Error("Unsafe private supplement receipt.");
  // Commit the once-only receipt before consuming another foreground event.
  try { writeFileSync(temporary, text, { flag: "wx", mode: 0o600 }); renameSync(temporary, join(root, "access.json")); }
  catch { throw new Error("The private supplement receipt could not be retained."); }
  receipts[cellId] = receipt;
}

export async function runRemainingModelsExperiment(manifestPath: string, output: string, credential: string, acceptCharges: boolean, publish: boolean): Promise<void> {
  if (acceptCharges !== true || !credential) throw new Error("An explicit credential and provider-charge acknowledgement are required.");
  const manifest = await Bun.file(manifestPath).json() as RemainingModelsExperiment, data = await inputs(manifest.priorAccounting);
  const [policy, catalog] = await Promise.all(["policy", "suites"].map(async route => readApplicationJson(await fetch(`${LOCAL_API}/runs/${route}`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }))));
  assertRemainingRunReady(manifest, data, policy, catalog);
  const paths = experimentPaths(output), root = paths.privateRoot, publicRoot = `${paths.output.slice(0, -5)}-published`;
  await mkdir(new URL("../../data/private/", import.meta.url), { recursive: true, mode: 0o700 }); await mkdir(root, { mode: 0o700 });
  await mkdir(`${root}records`, { mode: 0o700 }); if (publish) await mkdir(publicRoot, { mode: 0o700 });
  await writeFile(paths.output, "{}\n", { flag: "wx", mode: 0o600 }); await writeFile(`${root}access.json`, "{}\n", { flag: "wx", mode: 0o600 });
  const statuses: Status[] = manifest.cells.map(cell => ({ id: cell.id, state: "pending", runId: null, progress: { finished: 0, planned: 27, inferenceRequests: 0 }, reportId: null, published: false, archived: false, error: null }));
  const receipts: Record<string, { runId: string; accessCode: string }> = {}, archived: { cellId: string; runId: string; file: string; sha256: string; reportId: string }[] = [];
  const controller = new AbortController(), stop = () => controller.abort(), startedAt = new Date().toISOString();
  let cursor = 0, checkpoint = Promise.resolve();
  const save = () => {
    checkpoint = checkpoint.then(() => storeJson(paths.output, { version: "1", kind: "remaining-model-screening-progress", manifestSha256: qualityDataHash(manifest), startedAt, updatedAt: new Date().toISOString(),
      state: controller.signal.aborted ? "interrupted" : statuses.some(cell => ["pending", "active"].includes(cell.state)) ? "running" : "settled", capabilityCallsThisExecution: 0,
      budget: manifest.budget, cells: statuses, interpretation: manifest.interpretation }, credential, true)).catch(() => { controller.abort(); throw new Error("Supplement checkpoint could not be retained."); });
    return checkpoint;
  };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    await storeJson(paths.capabilities, { version: "1", manifestSha256: qualityDataHash(manifest), boundAt: startedAt, observedControlsPolicy: manifest.capabilities, probes: data.controls }, credential);
    await save();
    const workers = await Promise.allSettled(Array.from({ length: 3 }, async () => {
      while (!controller.signal.aborted && cursor < manifest.cells.length) {
        const index = cursor++, cell = manifest.cells[index], status = statuses[index]; status.state = "active"; await save();
        let receipt: { runId: string; accessCode: string } | null = null, lastSave = 0;
        const observe = (event: RunEvent) => {
          if (event.type === "started") {
            receipt = { runId: event.runId, accessCode: event.accessCode }; status.runId = event.runId;
            try { retainRemainingReceipt(root, receipts, cell.id, receipt, credential); }
            catch { controller.abort(); throw new Error("The private supplement receipt could not be retained."); }
          }
          if ("progress" in event) status.progress = { finished: event.progress.finishedTrials, planned: event.progress.plannedTrials, inferenceRequests: event.progress.inferenceRequests };
          if (event.type === "started" || Date.now() - lastSave >= 5000) { lastSave = Date.now(); void save().catch(() => {}); }
        };
        try { await launchForegroundRun({ suiteKey: "screening-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: cell.profileId, concurrency: 4, acceptCharges: true }, credential, controller.signal, observe); }
        catch { status.error = "The foreground stream did not establish a terminal outcome; no retry or replacement inference was started."; controller.abort(); }
        const saved = receipt as { runId: string; accessCode: string } | null;
        if (!saved) { status.state = "interrupted"; controller.abort(); await save(); return; }
        try {
          const view = await readSettledPrivateRun(saved.runId, saved.accessCode, credential);
          await storeJson(`${root}records/${saved.runId}.json`, view, credential);
          assertRemainingCellView(cell, view, saved.runId, manifest.frozenAt);
          status.state = view.record.state; status.reportId = view.record.report?.id ?? null;
          status.progress = { finished: view.record.progress.finishedTrials, planned: 27, inferenceRequests: view.record.progress.inferenceRequests };
          if (matrixFailureRequiresStop(view.record)) controller.abort();
          if (view.record.state !== "completed") status.error = "Retained incomplete execution; its original denominator and outcomes remain separate.";
          else if (status.error) controller.abort();
          if (publish && view.record.state === "completed") {
            await readApplicationJson(await fetch(`${LOCAL_API}/runs/${saved.runId}/publication`, { method: "POST", headers: { Authorization: `Bearer ${saved.accessCode}`, "Content-Type": "application/json" }, body: '{"published":true}', cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }), credential);
            const published = await readApplicationJson(await fetch(`${LOCAL_API}/runs/${saved.runId}/public`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }), credential) as RunView;
            if (reflectsCredential(JSON.stringify(published), saved.accessCode)) throw new Error("Public supplement evidence reflected its private receipt.");
            if (qualityDataHash(published.record) !== qualityDataHash(view.record)) throw new Error("Published supplement evidence differs from the settled private execution.");
            assertRemainingPublishedView(cell, published, saved.runId, manifest.frozenAt); status.published = true;
            const file = `${saved.runId}.json`; await storeJson(join(publicRoot, file), published, credential); status.archived = true;
            archived.push({ cellId: cell.id, runId: saved.runId, file, sha256: qualityDataHash(published), reportId: published.record.report!.id });
          }
        } catch {
          if (status.state === "active") status.state = "interrupted";
          status.error = "Private receipt retained; settlement, execution evidence, publication, or archive needs inspection before further paid work."; controller.abort();
        }
        await save();
        console.log(JSON.stringify({ phase: "remaining-model-screening", modelId: cell.modelId, profileId: cell.profileId, state: status.state, ...status.progress, published: status.published, archived: status.archived }));
      }
    }));
    await save();
    if (publish) await storeJson(join(publicRoot, "index.json"), { version: "1", kind: "published-remaining-model-screening-archive", createdAt: new Date().toISOString(), manifestSha256: qualityDataHash(manifest), records: archived,
      omitted: statuses.filter(cell => !cell.archived).map(cell => ({ cellId: cell.id, state: cell.state, reason: "No completed, verified explicit public view was archived." })), interpretation: manifest.interpretation }, credential);
    if (workers.some(worker => worker.status === "rejected") || controller.signal.aborted || !remainingCellsComplete(statuses, publish)) throw new Error("The supplement or requested publication/archive did not complete; no replacement work was scheduled.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

export function parseRemainingModelsArguments(args: readonly string[]) {
  const command = args[0];
  if (command !== "freeze" && command !== "run") throw new Error("Use freeze or run.");
  const values = new Map<string, string>(); let acceptCharges = false, publish = false;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (command === "run" && arg === "--accept-charges" && !acceptCharges) acceptCharges = true;
    else if (command === "run" && arg === "--publish" && !publish) publish = true;
    else if ((arg === "--output" || command === "freeze" && arg === "--prior-accounting" || command === "run" && arg === "--manifest") && !values.has(arg) && args[i + 1] && !args[i + 1].startsWith("--")) values.set(arg, args[++i]);
    else throw new Error("Use freeze --prior-accounting <terminal-artifact> --output <new-manifest>, or run --manifest <file> --output <new-ledger> --accept-charges [--publish].");
  }
  const output = values.get("--output"), manifest = values.get("--manifest"), priorAccounting = values.get("--prior-accounting");
  if (!output || command === "freeze" && !priorAccounting || command === "run" && (!manifest || !acceptCharges)) throw new Error("Explicit new output, terminal accounting for freeze, and manifest/charge consent for execution are required.");
  return { command, output, manifest, priorAccounting, acceptCharges, publish };
}

if (import.meta.main) {
  try {
    const args = parseRemainingModelsArguments(Bun.argv.slice(2));
    if (args.command === "freeze") { const manifest = await freezeRemainingModelsExperiment(args.output, args.priorAccounting!); console.log(JSON.stringify({ manifestSha256: qualityDataHash(manifest), frozenAt: manifest.frozenAt, cells: manifest.cells.length, budget: manifest.budget })); }
    else await runRemainingModelsExperiment(args.manifest!, args.output, process.env.OPENAI_API_KEY ?? "", args.acceptCharges, args.publish);
  } catch { console.error("Remaining-model supplement did not complete. Terminal lineage accounting, private receipts, and retained outcomes require inspection before further paid work. Earlier studies were not changed."); process.exitCode = 1; }
}
