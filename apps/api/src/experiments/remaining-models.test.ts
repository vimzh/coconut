// Offline fixtures preserve the exact unfinished-model population, terminal accounting, and publication boundary.
import { beforeAll, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import parentData from "../../data/experiments/openai-matrix-v2.json";
import ledgerData from "../../data/experiments/openai-progress-v2.json";
import controlData from "../../data/experiments/capabilities-v1.json";
import { createInferenceClient } from "../inference";
import { buildNumericalPrompts } from "../numerics";
import type { ProfileId } from "../protocol";
import { qualityDataHash } from "../quality";
import { prepareRunRecord } from "../runs/evidence";
import { RUN_POLICY } from "../runs/policy";
import { loadRunSuite } from "../runs/registry";
import type { RunView } from "../runs/types";
import { scoreEvaluation } from "../scoring";
import type { CapabilityObservation } from "./capabilities";
import type { FrozenExperiment } from "./manifest";
import type { ExperimentLedger } from "./reconcile";
import { assertRemainingCellView, assertRemainingPublishedView, assertRemainingRunReady, createRemainingModelsExperiment, freezeRemainingModelsExperiment,
  parseRemainingModelsArguments, remainingCellsComplete, retainRemainingReceipt, runRemainingModelsExperiment,
  type PriorInferenceAccounting, type RemainingModelsExperiment, type RemainingModelsInputs, type ScreeningWorkload, type StudyReconciliation, type StudySendEvidence } from "./remaining-models";

let data: RemainingModelsInputs, accounting: PriorInferenceAccounting, manifest: RemainingModelsExperiment;
let catalog: { suites: { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
beforeAll(async () => {
  const workloads = new Map<ProfileId, ScreeningWorkload>();
  for (const profile of ["one-shot-json-v1", "one-shot-json-v2-low", "one-shot-json-v2-medium", "one-shot-json-v2-high"] as const) {
    const suite = await loadRunSuite("screening-v1", profile);
    workloads.set(profile, { suite, prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), profile, "smooth-v2") });
  }
  const artifact = (name: string) => Bun.file(new URL(`../../data/experiments/${name}.json`, import.meta.url)).json();
  const parent = parentData as unknown as FrozenExperiment, ledger = ledgerData as unknown as ExperimentLedger;
  const interior = await artifact("interior-matrix-v1");
  // This terminal follow-up ledger is synthetic; no live interior outcome is used or claimed by these fixtures.
  const interiorLedger: ExperimentLedger & { updatedAt: string } = { version: "1", manifestSha256: qualityDataHash(interior), capabilitiesInferenceRequests: 0, state: "settled", updatedAt: new Date().toISOString(),
    cells: ["a", "b"].map(id => ({ id: `controlled-interior-${id}`, runId: `fixture-interior-${id}`, state: "completed", progress: { planned: 216, finished: 216, inferenceRequests: 216 } })) };
  const reconciliation = (source: unknown, progress: ExperimentLedger, sent: number): StudyReconciliation => ({ version: "1", kind: "offline-study-reconciliation", checkedAt: new Date().toISOString(), sourceManifestSha256: qualityDataHash(source), sourceLedgerSha256: qualityDataHash(progress),
    records: progress.cells.filter(cell => cell.runId !== null).map(cell => ({ cellId: cell.id, runId: cell.runId!, recordSha256: qualityDataHash({ controlledView: cell.runId }), state: cell.state, plannedTrials: cell.progress.planned, retainedTrials: cell.progress.finished, inferenceRequests: cell.progress.inferenceRequests })),
    counts: { mathematicalInferenceRequests: sent, unknownRemoteInferenceRequests: 0 } });
  const sendEvidence = (primary: StudyReconciliation): StudySendEvidence => {
    let remainingUnknown = primary.counts.unknownRemoteInferenceRequests;
    return { version: "1", kind: "study-send-reconciliation", checkedAt: new Date().toISOString(), sourceManifestSha256: primary.sourceManifestSha256, sourceLedgerSha256: primary.sourceLedgerSha256, sourceReconciliationSha256: qualityDataHash(primary),
      records: primary.records.map(record => ({ cellId: record.cellId, runId: record.runId, viewSha256: record.recordSha256, state: record.state, activeTrials: 0, plannedTrials: record.plannedTrials, finishedTrials: record.retainedTrials, inferenceRequests: record.inferenceRequests,
        attempts: Array.from({ length: record.retainedTrials }, (_, index) => {
          const inferenceRequests = index < record.inferenceRequests ? 1 : 0, unknown = inferenceRequests === 1 && remainingUnknown > 0;
          if (unknown) remainingUnknown--;
          return { caseId: `controlled-case-${Math.floor(index / 3)}`, trialIndex: index % 3, resultSha256: qualityDataHash({ controlledAttempt: record.runId, index }), inferenceRequests, httpAttempts: inferenceRequests + 1,
            failure: unknown ? { code: "network-error", remoteOutcome: "unknown" as const } : null };
        }) })), counts: { mathematicalInferenceRequests: primary.counts.mathematicalInferenceRequests, unknownRemoteInferenceRequests: primary.counts.unknownRemoteInferenceRequests } };
  };
  const originalPrimary = await artifact("openai-reconciliation-v1") as StudyReconciliation;
  const replicationPrimary = reconciliation(parent, ledger, 6678), interiorPrimary = reconciliation(interior, interiorLedger, 432);
  const priorStudies: RemainingModelsInputs["priorStudies"] = [
    { key: "original", manifest: await artifact("openai-matrix-v1"), ledger: await artifact("openai-progress-v1"), reconciliation: originalPrimary, sendEvidence: sendEvidence(originalPrimary) },
    { key: "replication", manifest: parent, ledger, reconciliation: replicationPrimary, sendEvidence: sendEvidence(replicationPrimary) },
    { key: "interior", manifest: interior, ledger: interiorLedger, reconciliation: interiorPrimary, sendEvidence: sendEvidence(interiorPrimary) },
  ];
  data = { parent, ledger, controls: controlData.probes as unknown as CapabilityObservation[], workloads, priorStudies, conditionalReserveActivated: false };
  const paths = { original: ["openai-matrix-v1", "openai-progress-v1", "openai-reconciliation-v1"], replication: ["openai-matrix-v2", "openai-progress-v2", "fixture-reconciliation-v2"], interior: ["interior-matrix-v1", "interior-progress-v1", "fixture-interior-reconciliation"], "conditional-reserve": ["conditional-reserve-matrix-v1", "conditional-reserve-progress-v1", "fixture-reserve-reconciliation"] };
  accounting = { version: "1", kind: "reconciled-inference-accounting", checkedAt: new Date().toISOString(), inferenceCeiling: 8192,
    controls: { path: "apps/api/data/experiments/capabilities-v1.json", sha256: qualityDataHash(data.controls), inferenceRequests: 183 }, earlierCalibrationAllowance: 4,
    studies: priorStudies.map(study => ({ key: study.key, manifestPath: `apps/api/data/experiments/${paths[study.key][0]}.json`, manifestSha256: qualityDataHash(study.manifest),
      ledgerPath: `apps/api/data/experiments/${paths[study.key][1]}.json`, ledgerSha256: qualityDataHash(study.ledger), reconciliationPath: `apps/api/data/experiments/${paths[study.key][2]}.json`,
      reconciliationSha256: qualityDataHash(study.reconciliation), sendEvidencePath: `apps/api/data/experiments/fixture-${study.key}-send-evidence.json`, sendEvidenceSha256: qualityDataHash(study.sendEvidence),
      inferenceRequests: study.reconciliation.counts.mathematicalInferenceRequests, unknownRemoteInferenceRequests: study.reconciliation.counts.unknownRemoteInferenceRequests })),
    totalPriorInferenceRequests: 7522 };
  manifest = createRemainingModelsExperiment(data, accounting);
  catalog = { suites: [{ key: "screening-v1", suiteId: workloads.get("one-shot-json-v1")!.suite.id, caseCount: 9, generatorVersion: "challenge-v1" }] };
}, 30000);

function alteredInterior(change: (source: RemainingModelsInputs["priorStudies"][number]) => RemainingModelsInputs["priorStudies"][number]) {
  const changed = change(structuredClone(data.priorStudies.find(study => study.key === "interior")!));
  const primary = { ...changed.reconciliation, sourceLedgerSha256: qualityDataHash(changed.ledger) };
  const source = { ...changed, reconciliation: primary, sendEvidence: { ...changed.sendEvidence, sourceLedgerSha256: qualityDataHash(changed.ledger), sourceReconciliationSha256: qualityDataHash(primary) } };
  const candidate = { ...data, priorStudies: data.priorStudies.map(study => study.key === "interior" ? source : study) };
  const prior = { ...accounting, studies: accounting.studies.map(study => study.key === "interior" ? { ...study, ledgerSha256: qualityDataHash(source.ledger), reconciliationSha256: qualityDataHash(primary), sendEvidenceSha256: qualityDataHash(source.sendEvidence) } : study) };
  return () => createRemainingModelsExperiment(candidate, prior);
}

it("selects all eight unchanged original cells solely from unfinished model scheduling", () => {
  const before = qualityDataHash({ parent: data.parent, ledger: data.ledger, accounting, controls: data.controls });
  const frozen = createRemainingModelsExperiment(data, accounting);
  expect(frozen.cells).toEqual(data.parent.cells.filter(cell => cell.phase === "screening" && ["o3", "o3-2025-04-16"].includes(cell.modelId)));
  expect(frozen.cells.map(cell => `${cell.modelId}:${cell.profileId}`)).toEqual(["o3", "o3-2025-04-16"].flatMap(model => ["one-shot-json-v1", "one-shot-json-v2-low", "one-shot-json-v2-medium", "one-shot-json-v2-high"].map(profile => `${model}:${profile}`)));
  expect(frozen.budget).toMatchObject({ priorActualInferenceRequests: 7522, maxNewInferenceRequests: 216, cumulativeInferenceCeiling: 7738, sharedInferenceCeiling: 8192, parallelRuns: 3, runConcurrency: 4, maxConcurrency: 12, retries: 0, attemptsPerTrial: 1 });
  expect(frozen.capabilities).toEqual({ policy: "reuse-retained-controls-without-new-calls", retainedProbeCount: 183, newRequests: 0 });
  expect(frozen.interpretation).toMatchObject({ population: "screening", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false });
  expect(frozen.exposure.priorResults).toContain("seven-answer prefix");
  expect(frozen.priorAccountingSha256).toBe(qualityDataHash(accounting));
  expect(qualityDataHash({ parent: data.parent, ledger: data.ledger, accounting, controls: data.controls })).toBe(before);
});

it("refuses an alive parent, alive follow-up, missing activated reserve, or changed terminal source", () => {
  expect(() => createRemainingModelsExperiment({ ...data, ledger: { ...data.ledger, state: "running" } }, accounting)).toThrow("terminal");
  const active = { ...data.ledger, cells: [{ ...data.ledger.cells[0], state: "active" }, ...data.ledger.cells.slice(1)] };
  expect(() => createRemainingModelsExperiment({ ...data, ledger: active }, accounting)).toThrow("terminal");
  const priorStudies = data.priorStudies.map(study => study.key === "interior" ? { ...study, ledger: { ...study.ledger, state: "running" } } : study);
  expect(() => createRemainingModelsExperiment({ ...data, priorStudies }, accounting)).toThrow("terminal");
  expect(() => createRemainingModelsExperiment({ ...data, conditionalReserveActivated: true }, accounting)).toThrow("accounting");
  expect(() => createRemainingModelsExperiment({ ...data, ledger: { ...data.ledger, cells: data.ledger.cells.slice(1) } }, accounting)).toThrow("pinned");
  expect(() => createRemainingModelsExperiment({ ...data, controls: data.controls.slice(1) }, accounting)).toThrow("controls");
});

it("counts controls/allowance and unknown remote sends exactly once and refuses budget or lineage drift", () => {
  const totalWithDoubleUnknown = accounting.totalPriorInferenceRequests + accounting.studies.reduce((sum, study) => sum + study.unknownRemoteInferenceRequests, 0);
  expect(totalWithDoubleUnknown).toBeGreaterThan(accounting.totalPriorInferenceRequests);
  expect(() => createRemainingModelsExperiment(data, { ...accounting, totalPriorInferenceRequests: totalWithDoubleUnknown })).toThrow("accounting");
  expect(() => createRemainingModelsExperiment(data, { ...accounting, studies: [...accounting.studies, accounting.studies[0]] })).toThrow("accounting");
  const larger = accounting.studies.map(study => study.key === "interior" ? { ...study, inferenceRequests: 1000 } : study);
  expect(() => createRemainingModelsExperiment(data, { ...accounting, studies: larger, totalPriorInferenceRequests: 8090 })).toThrow("budget");
  expect(() => createRemainingModelsExperiment(data, { ...accounting, studies: accounting.studies.map(study => study.key === "interior" ? { ...study, unknownRemoteInferenceRequests: 433 } : study) })).toThrow("accounting");
  const changed = data.priorStudies.map(study => study.key === "interior" ? { ...study, reconciliation: { ...study.reconciliation, counts: { ...study.reconciliation.counts, mathematicalInferenceRequests: 431 } } } : study);
  expect(() => createRemainingModelsExperiment({ ...data, priorStudies: changed }, accounting)).toThrow("immutable source");
});

it("requires genuine primary records and derives every send and unknown outcome from unique attempts", () => {
  expect(alteredInterior(source => ({ ...source, reconciliation: { ...source.reconciliation, kind: "not-a-reconciliation" as StudyReconciliation["kind"] } }))).toThrow("per-attempt send reconciliation");
  expect(alteredInterior(source => ({ ...source, reconciliation: { ...source.reconciliation, records: undefined as unknown as StudyReconciliation["records"] } }))).toThrow("full primary records");
  expect(alteredInterior(source => ({ ...source, sendEvidence: { ...source.sendEvidence, records: [] } }))).toThrow("all and only");
  expect(alteredInterior(source => ({ ...source, sendEvidence: { ...source.sendEvidence, records: [source.sendEvidence.records[0], source.sendEvidence.records[0]] } }))).toThrow("unique started");
  expect(alteredInterior(source => ({ ...source, reconciliation: { ...source.reconciliation, records: [source.reconciliation.records[0], source.reconciliation.records[0]] } }))).toThrow("unique started");
  const alterFirst = (source: RemainingModelsInputs["priorStudies"][number], change: (record: StudySendEvidence["records"][number]) => StudySendEvidence["records"][number]) => ({ ...source, sendEvidence: { ...source.sendEvidence, records: [change(source.sendEvidence.records[0]), ...source.sendEvidence.records.slice(1)] } });
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, activeTrials: 1 })))).toThrow("nonterminal");
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, attempts: [record.attempts[0], record.attempts[0], ...record.attempts.slice(2)] })))).toThrow("repeated");
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, attempts: [{ ...record.attempts[0], inferenceRequests: 0 }, ...record.attempts.slice(1)] })))).toThrow("Per-attempt sends disagree");
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, attempts: [{ ...record.attempts[0], failure: { code: "timeout", remoteOutcome: "unknown" } }, ...record.attempts.slice(1)] })))).toThrow("Derived sends and unknown");
  expect(alteredInterior(source => ({ ...source, sendEvidence: { ...source.sendEvidence, counts: { ...source.sendEvidence.counts, unknownRemoteInferenceRequests: 1 } } }))).toThrow("Derived sends and unknown");
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, viewSha256: "0".repeat(64) })))).toThrow("retained view");
  expect(alteredInterior(source => alterFirst(source, record => ({ ...record, attempts: [{ ...record.attempts[0], httpAttempts: 0 }, ...record.attempts.slice(1)] })))).toThrow("per-attempt send");
});

it("refuses stale or private-field send projections even after all changed source hashes are rebound", () => {
  expect(alteredInterior(source => ({ ...source, reconciliation: { ...source.reconciliation, checkedAt: new Date(Date.parse((source.ledger as ExperimentLedger & { updatedAt: string }).updatedAt) - 1).toISOString() } }))).toThrow("terminal per-attempt");
  expect(alteredInterior(source => ({ ...source, sendEvidence: { ...source.sendEvidence, checkedAt: new Date(Date.parse(source.reconciliation.checkedAt) - 1).toISOString() } }))).toThrow("terminal per-attempt");
  expect(alteredInterior(source => ({ ...source, sendEvidence: { ...source.sendEvidence, accessCode: "private-field" } as unknown as StudySendEvidence }))).toThrow("terminal per-attempt");
  expect(() => createRemainingModelsExperiment(data, { ...accounting, studies: accounting.studies.map(study => study.key === "interior" ? { ...study, sendEvidenceSha256: "invalid" } : study) })).toThrow("accounting");
});

it("reconstructs every member, prompt, settings, and API policy before launch", () => {
  expect(() => assertRemainingRunReady(manifest, data, RUN_POLICY, catalog)).not.toThrow();
  expect(() => assertRemainingRunReady({ ...manifest, cells: manifest.cells.slice(1) }, data, RUN_POLICY, catalog)).toThrow("Frozen supplement");
  expect(() => assertRemainingRunReady({ ...manifest, cells: [{ ...manifest.cells[0], settingsId: "changed" }, ...manifest.cells.slice(1)] }, data, RUN_POLICY, catalog)).toThrow("Frozen supplement");
  expect(() => assertRemainingRunReady({ ...manifest, budget: { ...manifest.budget, maxNewInferenceRequests: 215 } } as unknown as RemainingModelsExperiment, data, RUN_POLICY, catalog)).toThrow("Frozen supplement");
  const workloads = new Map(data.workloads), original = workloads.get("one-shot-json-v1")!;
  workloads.set("one-shot-json-v1", { ...original, prompts: [{ ...original.prompts[0], messages: [original.prompts[0].messages[0], { role: "user", content: "changed prompt" }] }, ...original.prompts.slice(1)] });
  expect(() => createRemainingModelsExperiment({ ...data, workloads }, accounting)).toThrow("prompts");
  expect(() => assertRemainingRunReady(manifest, data, { ...RUN_POLICY, retries: 1 }, catalog)).toThrow("exact execution policy");
  expect(() => assertRemainingRunReady(manifest, data, RUN_POLICY, { suites: [] })).toThrow("exact execution policy");
});

it("rejects accidental launches and reports any incomplete/publication/archive failure unsuccessfully", async () => {
  expect(parseRemainingModelsArguments(["freeze", "--prior-accounting", "accounting.json", "--output", "new.json"])).toMatchObject({ command: "freeze", acceptCharges: false });
  expect(parseRemainingModelsArguments(["run", "--manifest", "matrix.json", "--output", "progress.json", "--accept-charges", "--publish"])).toMatchObject({ command: "run", acceptCharges: true, publish: true });
  expect(() => parseRemainingModelsArguments(["freeze", "--output", "new.json"])).toThrow("accounting");
  expect(() => parseRemainingModelsArguments(["run", "--manifest", "matrix.json", "--output", "progress.json"])).toThrow("consent");
  expect(() => parseRemainingModelsArguments(["run", "--manifest", "matrix.json", "--output", "progress.json", "--accept-charges", "--retry"])).toThrow();
  await expect(runRemainingModelsExperiment("absent.json", "absent-progress.json", "fixture-key", false, false)).rejects.toThrow("acknowledgement");
  const statuses = Array.from({ length: 8 }, () => ({ state: "completed" as const, error: null, published: true, archived: true }));
  expect(remainingCellsComplete(statuses, true)).toBe(true);
  for (const state of ["pending", "active", "failed", "interrupted", "cancelled", "timed-out"] as const) expect(remainingCellsComplete([{ ...statuses[0], state }, ...statuses.slice(1)], true)).toBe(false);
  expect(remainingCellsComplete([{ ...statuses[0], published: false }, ...statuses.slice(1)], true)).toBe(false);
  expect(remainingCellsComplete([{ ...statuses[0], archived: false }, ...statuses.slice(1)], true)).toBe(false);
  expect(remainingCellsComplete([{ ...statuses[0], error: "archive failed" }, ...statuses.slice(1)], true)).toBe(false);
  expect(remainingCellsComplete(statuses.slice(1), true)).toBe(false);
});

it("never overwrites a frozen study and saves once-only private receipts atomically with secret checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "remaining-models-fixture-")), output = join(root, "manifest.json");
  const receipt = { runId: "fixture-run", accessCode: "a".repeat(43) }, receipts: Record<string, typeof receipt> = {};
  try {
    await writeFile(output, "original-study\n");
    await expect(freezeRemainingModelsExperiment(output, "absent-accounting.json")).rejects.toThrow("already exists");
    expect(await readFile(output, "utf8")).toBe("original-study\n");
    retainRemainingReceipt(root, receipts, manifest.cells[0].id, receipt, "fixture-provider-key");
    expect(JSON.parse(await readFile(join(root, "access.json"), "utf8"))).toEqual({ [manifest.cells[0].id]: receipt });
    expect((await stat(join(root, "access.json"))).mode & 0o777).toBe(0o600);
    expect(() => retainRemainingReceipt(root, receipts, manifest.cells[0].id, receipt, "fixture-provider-key")).toThrow("repeated");
    expect(() => retainRemainingReceipt(root, receipts, manifest.cells[1].id, { runId: "other-run", accessCode: "b".repeat(43) }, "b".repeat(43))).toThrow("Unsafe");
    expect(Object.keys(receipts)).toHaveLength(1);
    expect(await readFile(join(root, "access.json"), "utf8")).not.toContain("fixture-provider-key");
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("retains failed private evidence but archives only complete verified explicit public views", async () => {
  const cell = manifest.cells[0], workload = data.workloads.get(cell.profileId)!, request = { suiteKey: "screening-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: cell.profileId, concurrency: 4, acceptCharges: true } as const;
  const initial = await prepareRunRecord(request, workload.suite), labels = new Map(workload.prompts.map((prompt, index) => [prompt.messages[1].content, workload.suite.cases[index].label]));
  const client = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: cell.modelId, object: "model" });
    const body = JSON.parse(init.body as string);
    return Response.json({ model: cell.modelId, status: "completed", max_output_tokens: 4096, truncation: "disabled", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Controlled fixture; no live model observation." }) }] }] });
  });
  const results = await Promise.all(initial.evidence.trials.map(async trial => ({ caseId: trial.caseId, trialIndex: trial.trialIndex,
    result: await client({ selection: { provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: cell.profileId, verification: "metadata" }, prompt: workload.prompts[workload.suite.cases.findIndex(entry => entry.id === trial.caseId)], acceptCharges: true }, "sk-remaining-fixture-123456789") })));
  const evidence = { ...initial.evidence, trials: initial.evidence.trials.map((trial, index) => ({ ...trial, finalAttempt: 1, elapsedMs: results[index].result.evidence.elapsedMs, attempts: [results[index].result.evidence] })) };
  const report = await scoreEvaluation({ suite: workload.suite, evidence });
  const view: RunView = { publishedAt: new Date().toISOString(), record: { ...initial, state: "completed", evidence, report, results,
    progress: { plannedTrials: 27, startedTrials: 27, activeTrials: 0, finishedTrials: 27, modelOutcomes: 27, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: 27 } } };
  expect(() => assertRemainingPublishedView(cell, view, initial.id, manifest.frozenAt)).not.toThrow();
  const failed: RunView = { publishedAt: null, record: { ...view.record, state: "failed", report: null } };
  expect(() => assertRemainingCellView(cell, failed, initial.id, manifest.frozenAt)).not.toThrow();
  expect(() => assertRemainingPublishedView(cell, failed, initial.id, manifest.frozenAt)).toThrow("publication");
  expect(() => assertRemainingPublishedView(cell, { ...view, publishedAt: null }, initial.id, manifest.frozenAt)).toThrow("publication");
  expect(() => assertRemainingPublishedView(cell, view, "wrong-run", manifest.frozenAt)).toThrow("frozen original");
  expect(() => assertRemainingPublishedView(cell, { ...view, accessCode: "private-sentinel" } as unknown as RunView, initial.id, manifest.frozenAt)).toThrow("frozen original");
  expect(() => assertRemainingPublishedView(cell, { ...view, record: { ...view.record, results: [view.record.results[0], ...view.record.results.slice(0, -1)] } }, initial.id, manifest.frozenAt)).toThrow("one-attempt");
  expect(() => assertRemainingPublishedView(cell, { ...view, record: { ...view.record, report: { ...report, overall: { ...report.overall, classification: { ...report.overall.classification, macroF1: 0 } } } } }, initial.id, manifest.frozenAt)).toThrow();
}, 30000);
