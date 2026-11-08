// Offline operator fixtures enforce the fixed reserve, per-attempt lineage and private/public retention boundary.
import { beforeAll, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInferenceClient } from "../inference";
import { buildNumericalPrompts } from "../numerics";
import { qualityDataHash } from "../quality";
import { prepareRunRecord } from "../runs/evidence";
import { RUN_POLICY } from "../runs/policy";
import { loadRunSuite } from "../runs/registry";
import type { RunView } from "../runs/types";
import { scoreEvaluation } from "../scoring";
import { archivePublishedExperiment } from "./archive";
import type { ExperimentLedger } from "./reconcile";
import type { PriorInferenceAccounting, StudyReconciliation, StudySendEvidence } from "./remaining-models";
import { assertReserveRunReady, assertReserveView, createReserveExperiment, freezeReserveExperiment, parseReserveArguments, reserveCellsComplete,
  retainReserveReceipt, runReserveExperiment, storeReserveJson, type ReserveExperiment, type ReserveInputs, type ReservePriorAccounting } from "./reserve-experiment";

let data: ReserveInputs, manifest: ReserveExperiment;
let catalog: { suites: { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
beforeAll(async () => {
  const artifact = (path: string) => Bun.file(new URL(`../../../../${path}`, import.meta.url)).json();
  const prefix = "apps/api/data/experiments/", earlier = await artifact(`${prefix}remaining-models-prior-accounting-v1.json`) as PriorInferenceAccounting;
  const existing = await Promise.all(earlier.studies.map(async study => ({ key: study.key as "original" | "replication" | "interior", manifest: await artifact(study.manifestPath), ledger: await artifact(study.ledgerPath), reconciliation: await artifact(study.reconciliationPath), sendEvidence: await artifact(study.sendEvidencePath) })));
  const parent = await artifact(`${prefix}remaining-models-matrix-v1.json`), ledger = await artifact(`${prefix}remaining-models-progress-v1.json`) as ExperimentLedger;
  // The fourth primary and attempt projection are controlled fixtures, not provenance for a future reserve freeze.
  const primary: StudyReconciliation = { version: "1", kind: "offline-study-reconciliation", checkedAt: new Date().toISOString(), sourceManifestSha256: qualityDataHash(parent), sourceLedgerSha256: qualityDataHash(ledger),
    records: ledger.cells.filter(cell => cell.runId).map(cell => ({ cellId: cell.id, runId: cell.runId!, state: cell.state, recordSha256: qualityDataHash({ controlledView: cell.runId }), plannedTrials: 27, retainedTrials: 27, inferenceRequests: 27 })), counts: { mathematicalInferenceRequests: 216, unknownRemoteInferenceRequests: 0 } };
  const sends: StudySendEvidence = { version: "1", kind: "study-send-reconciliation", checkedAt: new Date().toISOString(), sourceManifestSha256: qualityDataHash(parent), sourceLedgerSha256: qualityDataHash(ledger), sourceReconciliationSha256: qualityDataHash(primary),
    records: primary.records.map(record => ({ cellId: record.cellId, runId: record.runId, viewSha256: record.recordSha256, state: record.state, activeTrials: 0, plannedTrials: 27, finishedTrials: 27, inferenceRequests: 27,
      attempts: Array.from({ length: 27 }, (_, index) => ({ caseId: `controlled-case-${Math.floor(index / 3)}`, trialIndex: index % 3, resultSha256: qualityDataHash({ controlledResult: record.runId, index }), inferenceRequests: 1, httpAttempts: 2, failure: null })) })), counts: primary.counts };
  const fourth = { key: "remaining-models" as const, manifestPath: `${prefix}remaining-models-matrix-v1.json`, manifestSha256: qualityDataHash(parent), ledgerPath: `${prefix}remaining-models-progress-v1.json`, ledgerSha256: qualityDataHash(ledger),
    reconciliationPath: `${prefix}fixture-remaining-models-reconciliation.json`, reconciliationSha256: qualityDataHash(primary), sendEvidencePath: `${prefix}fixture-remaining-models-send-evidence.json`, sendEvidenceSha256: qualityDataHash(sends), inferenceRequests: 216, unknownRemoteInferenceRequests: 0 };
  const accounting: ReservePriorAccounting = { ...earlier, checkedAt: new Date().toISOString(), studies: [...earlier.studies as ReservePriorAccounting["studies"], fourth], totalPriorInferenceRequests: earlier.totalPriorInferenceRequests + 216 };
  const suite = await loadRunSuite("reserve-v1", "one-shot-json-v2-max"); if (suite.generatorVersion !== "reserve-v1") throw new Error("Reserve fixture unavailable.");
  const decision = await artifact("apps/api/data/research/conditional-reserve-decision-v1.json");
  data = { accounting, controls: (await artifact(`${prefix}capabilities-v1.json`)).probes, priorStudies: [...existing, { key: "remaining-models", manifest: parent, ledger, reconciliation: primary, sendEvidence: sends }], suite,
    prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), "one-shot-json-v2-max", "smooth-v2"), baseSuiteId: (await loadRunSuite("reserve-v1", "one-shot-json-v1")).id,
    decision, amendment: await artifact("apps/api/data/research/conditional-reserve-amendment-v1.json"), proposalFileSha256: "766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85",
    review: await artifact("apps/api/data/quality/reserve-reference-review-v1.json"), p5Views: await Promise.all(decision.p5.cells.map((cell: { runId: string }) => artifact(`${prefix}interior-progress-v1-published/${cell.runId}.json`))) };
  manifest = createReserveExperiment(data);
  catalog = { suites: [...Array.from({ length: 5 }, (_, index) => ({ key: `earlier-${index}`, suiteId: "earlier", caseCount: 9, generatorVersion: "earlier" })), { key: "reserve-v1", suiteId: data.baseSuiteId, caseCount: 18, generatorVersion: "reserve-v1" }] };
}, 30000);

it("freezes two exact max cells with 54 fresh trials each and literal 108-request ceiling", () => {
  expect(manifest.cells.map(cell => cell.modelId)).toEqual(["gpt-6-astra", "gpt-6.1-sol"]);
  expect(manifest.cells.every(cell => cell.profileId === "one-shot-json-v2-max" && cell.concurrency === 4 && cell.maxOutputTokens === 16384 && cell.plannedTrials === 54)).toBe(true);
  expect(manifest.budget).toMatchObject({ priorActualInferenceRequests: 7738, maxNewInferenceRequests: 108, cumulativeInferenceCeiling: 7846, sharedInferenceCeiling: 8192, parallelRuns: 2, maxConcurrency: 8, retries: 0 });
  expect(manifest.population).toMatchObject({ suiteKey: "reserve-v1", caseCount: 18, families: 3, relatedSourceGroups: 2 });
  expect(manifest.interpretation).toMatchObject({ population: "exploratory", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false });
  expect(manifest.gates.independentReviewSha256).toBe(qualityDataHash(data.review));
});

it("requires unchanged decision, amendment, independent review, proposal and completed P5 sources", () => {
  expect(() => createReserveExperiment({ ...data, decision: { ...data.decision, altered: true } as ReserveInputs["decision"] })).toThrow("coordinator decision");
  expect(() => createReserveExperiment({ ...data, amendment: {} })).toThrow("amendment");
  expect(() => createReserveExperiment({ ...data, review: { ...data.review, status: "unverified" } })).toThrow("independent reserve review");
  expect(() => createReserveExperiment({ ...data, proposalFileSha256: "0".repeat(64) })).toThrow("unchanged proposal");
  expect(() => createReserveExperiment({ ...data, p5Views: data.p5Views.slice(1) })).toThrow("Both completed");
  expect(() => createReserveExperiment({ ...data, p5Views: [{ ...data.p5Views[0], publishedAt: null }, data.p5Views[1]] })).toThrow("P5 snapshot");
});

it("refuses changed suite cases, prompts, profile, controls or frozen cell membership before launch", () => {
  expect(() => assertReserveRunReady(manifest, data, RUN_POLICY, catalog)).not.toThrow();
  expect(() => createReserveExperiment({ ...data, suite: { ...data.suite, cases: data.suite.cases.slice(1) } })).toThrow("18-case");
  expect(() => createReserveExperiment({ ...data, prompts: [{ ...data.prompts[0], generation: { ...data.prompts[0].generation, reasoning: "high" } }, ...data.prompts.slice(1)] })).toThrow("max profile");
  expect(() => createReserveExperiment({ ...data, prompts: [{ ...data.prompts[0], messages: [data.prompts[0].messages[0], { role: "user", content: "changed expression" }] }, ...data.prompts.slice(1)] })).toThrow("exact prompts");
  expect(() => createReserveExperiment({ ...data, controls: data.controls.slice(1) })).toThrow("retained");
  expect(() => assertReserveRunReady({ ...manifest, cells: manifest.cells.slice(1) }, data, RUN_POLICY, catalog)).toThrow("Frozen reserve");
  expect(() => assertReserveRunReady(manifest, data, { ...RUN_POLICY, retries: 1 }, catalog)).toThrow("exact reserve execution policy");
  expect(() => assertReserveRunReady(manifest, data, RUN_POLICY, { suites: catalog.suites.slice(1) })).toThrow("six suites");
});

it("requires all four terminal study populations and retains unknown sends within actual accounting", () => {
  const changed = data.priorStudies.map(source => source.key === "remaining-models" ? { ...source, ledger: { ...source.ledger, state: "running" } } : source);
  expect(() => createReserveExperiment({ ...data, priorStudies: changed })).toThrow("must be terminal");
  expect(() => createReserveExperiment({ ...data, accounting: { ...data.accounting, studies: data.accounting.studies.slice(1) } })).toThrow("Four terminal");
  expect(() => createReserveExperiment({ ...data, accounting: { ...data.accounting, totalPriorInferenceRequests: 7739 } })).toThrow("actual-send budget");
  const unknown = data.accounting.studies.reduce((sum, study) => sum + study.unknownRemoteInferenceRequests, 0);
  expect(unknown).toBeGreaterThanOrEqual(11);
  expect(() => createReserveExperiment({ ...data, accounting: { ...data.accounting, totalPriorInferenceRequests: data.accounting.totalPriorInferenceRequests + unknown } })).toThrow("actual-send budget");
});

it("rejects rebound aggregate-only reconciliations and forged per-attempt send evidence", () => {
  const alter = (change: (source: ReserveInputs["priorStudies"][number]) => ReserveInputs["priorStudies"][number]) => {
    const source = change(structuredClone(data.priorStudies[3]));
    const sendEvidence = { ...source.sendEvidence, sourceReconciliationSha256: qualityDataHash(source.reconciliation) };
    const accounting = { ...data.accounting, studies: data.accounting.studies.map(study => study.key === "remaining-models" ? { ...study, reconciliationSha256: qualityDataHash(source.reconciliation), sendEvidenceSha256: qualityDataHash(sendEvidence) } : study) };
    return () => createReserveExperiment({ ...data, accounting, priorStudies: [...data.priorStudies.slice(0, 3), { ...source, sendEvidence }] });
  };
  expect(alter(source => ({ ...source, reconciliation: { ...source.reconciliation, kind: "aggregate-only" as StudyReconciliation["kind"] } }))).toThrow("per-attempt send reconciliation");
  expect(alter(source => ({ ...source, sendEvidence: { ...source.sendEvidence, records: [] } }))).toThrow("all and only");
  expect(alter(source => ({ ...source, sendEvidence: { ...source.sendEvidence, records: [{ ...source.sendEvidence.records[0], attempts: [{ ...source.sendEvidence.records[0].attempts[0], inferenceRequests: 0 }, ...source.sendEvidence.records[0].attempts.slice(1)] }, ...source.sendEvidence.records.slice(1)] } }))).toThrow("Per-attempt sends disagree");
});

it("requires explicit operator consent and never accepts incomplete or failed publication/archive status", async () => {
  expect(parseReserveArguments(["freeze", "--prior-accounting", "terminal.json", "--output", "new.json"])).toMatchObject({ command: "freeze", acceptCharges: false });
  expect(() => parseReserveArguments(["run", "--manifest", "matrix.json", "--output", "progress.json"])).toThrow("consent");
  await expect(runReserveExperiment("missing.json", "unused.json", "fixture-key", false, true)).rejects.toThrow("acknowledgement");
  const complete = { state: "completed" as const, error: null, published: true, archived: true };
  expect(reserveCellsComplete([complete, complete], true)).toBe(true);
  for (const state of ["pending", "active", "failed", "interrupted", "cancelled", "timed-out"] as const) expect(reserveCellsComplete([complete, { ...complete, state }], true)).toBe(false);
  expect(reserveCellsComplete([complete, { ...complete, published: false }], true)).toBe(false);
  expect(reserveCellsComplete([complete, { ...complete, archived: false }], true)).toBe(false);
  expect(reserveCellsComplete([complete, { ...complete, error: "storage failed" }], true)).toBe(false);
});

it("retains private receipts once, rejects duplicate private codes/reflection and fails storage without overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "reserve-operator-")), receipt = { runId: "reserve-fixture", accessCode: "a".repeat(43) }, receipts: Record<string, typeof receipt> = {};
  try {
    const output = join(root, "manifest.json"); await writeFile(output, "existing-study\n");
    await expect(freezeReserveExperiment(output, "missing-accounting.json")).rejects.toThrow("already exists"); expect(await readFile(output, "utf8")).toBe("existing-study\n");
    retainReserveReceipt(root, receipts, manifest.cells[0].id, receipt, "fixture-provider-key");
    expect(() => retainReserveReceipt(root, receipts, manifest.cells[1].id, { ...receipt, runId: "another-run" }, "fixture-provider-key")).toThrow("access code was repeated");
    expect(() => retainReserveReceipt(root, receipts, manifest.cells[1].id, { runId: "another-run", accessCode: "b".repeat(43) }, "b".repeat(43))).toThrow("Unsafe");
    await expect(storeReserveJson(join(root, "unsafe.json"), { secret: "fixture-provider-key" }, "fixture-provider-key")).rejects.toThrow("Unsafe");
    await expect(storeReserveJson(join(root, "absent", "record.json"), {}, "fixture-provider-key")).rejects.toThrow();
    await expect(storeReserveJson(output, {}, "fixture-provider-key")).rejects.toThrow(); expect(await readFile(output, "utf8")).toBe("existing-study\n");
    expect(JSON.parse(await readFile(join(root, "access.json"), "utf8"))).toEqual({ [manifest.cells[0].id]: receipt });
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("preserves failed private outcomes and archives only complete qualified 54-trial public evidence", async () => {
  const cell = manifest.cells[0], request = { suiteKey: "reserve-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: "one-shot-json-v2-max", concurrency: 4, acceptCharges: true } as const;
  const initial = await prepareRunRecord(request, data.suite), labels = new Map(data.prompts.map((prompt, index) => [prompt.messages[1].content, data.suite.cases[index].label]));
  const client = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: cell.modelId, object: "model" });
    const body = JSON.parse(init.body as string);
    return Response.json({ model: cell.modelId, status: "completed", max_output_tokens: 16384, reasoning: { effort: "max" }, truncation: "disabled", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Controlled fixture; no live inference." }) }] }] });
  });
  const results = await Promise.all(initial.evidence.trials.map(async trial => ({ caseId: trial.caseId, trialIndex: trial.trialIndex,
    result: await client({ selection: { provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: "one-shot-json-v2-max", verification: "metadata" }, prompt: data.prompts[data.suite.cases.findIndex(entry => entry.id === trial.caseId)], acceptCharges: true }, "sk-reserve-fixture-123456789") })));
  const evidence = { ...initial.evidence, trials: initial.evidence.trials.map((trial, index) => ({ ...trial, finalAttempt: 1, elapsedMs: results[index].result.evidence.elapsedMs, attempts: [results[index].result.evidence] })) }, report = await scoreEvaluation({ suite: data.suite, evidence });
  const view: RunView = { publishedAt: new Date().toISOString(), record: { ...initial, state: "completed", evidence, report, results,
    progress: { plannedTrials: 54, startedTrials: 54, activeTrials: 0, finishedTrials: 54, modelOutcomes: 54, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: 54 } } };
  expect(() => assertReserveView(cell, view, initial.id, manifest.frozenAt, true)).not.toThrow();
  expect(() => assertReserveView(cell, { publishedAt: null, record: { ...view.record, state: "failed", report: null } }, initial.id, manifest.frozenAt)).not.toThrow();
  expect(() => assertReserveView(cell, { ...view, publishedAt: null }, initial.id, manifest.frozenAt, true)).toThrow("explicit");
  expect(() => assertReserveView(cell, { ...view, record: { ...view.record, progress: { ...view.record.progress, plannedTrials: 108 } } }, initial.id, manifest.frozenAt, true)).toThrow("54-trial");
  const root = await mkdtemp(join(tmpdir(), "reserve-archive-")), ledger = { manifestSha256: qualityDataHash(manifest), state: "settled", updatedAt: new Date().toISOString(), cells: [{ id: cell.id, runId: initial.id, state: "completed", published: true, archived: false, progress: { planned: 54, finished: 54, inferenceRequests: 54 } }] };
  try {
    const sourcePath = join(root, "progress-archive-source.json"), progressPath = join(root, "progress.json"), archiveSource = structuredClone(ledger);
    await storeReserveJson(sourcePath, archiveSource, "fixture-provider-key");
    const index = await archivePublishedExperiment(manifest, archiveSource, join(root, "valid"), async () => Response.json(view)); expect(index.records).toHaveLength(1);
    ledger.cells[0].archived = true; ledger.updatedAt = new Date(Date.parse(ledger.updatedAt) + 1).toISOString();
    await storeReserveJson(progressPath, ledger, "fixture-provider-key");
    const retainedSource = JSON.parse(await readFile(sourcePath, "utf8")), finalProgress = JSON.parse(await readFile(progressPath, "utf8"));
    expect(index.ledgerSha256).toBe(qualityDataHash(retainedSource));
    expect(index.ledgerSha256).not.toBe(qualityDataHash(finalProgress));
    expect(retainedSource.cells[0].archived).toBe(false); expect(finalProgress.cells[0].archived).toBe(true);
    await expect(storeReserveJson(sourcePath, ledger, "fixture-provider-key")).rejects.toThrow();
    expect(qualityDataHash(JSON.parse(await readFile(sourcePath, "utf8")))).toBe(index.ledgerSha256);
    await expect(archivePublishedExperiment(manifest, ledger, join(root, "unpublished"), async () => Response.json({ ...view, publishedAt: null }))).rejects.toThrow();
    await expect(archivePublishedExperiment(manifest, ledger, join(root, "failed"), async () => Response.json({ ...view, record: { ...view.record, state: "failed" } }))).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
