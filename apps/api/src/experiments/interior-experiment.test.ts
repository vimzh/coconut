// Frozen exploratory fixtures reject source, budget, consent and API-image drift without inference calls.
import { beforeAll, expect, it } from "bun:test";
import parentData from "../../data/experiments/openai-matrix-v2.json";
import controlData from "../../data/experiments/capabilities-v1.json";
import { buildNumericalPrompts } from "../numerics";
import type { NumericalPromptBlueprint } from "../numerics/prompt";
import { qualityDataHash } from "../quality";
import { QUALITY_CRITERIA_SHA256 } from "../quality/data";
import { loadRunSuite } from "../runs/registry";
import { RUN_POLICY } from "../runs/policy";
import { prepareRunRecord } from "../runs/evidence";
import type { RunView } from "../runs/types";
import { createInferenceClient } from "../inference";
import { scoreEvaluation } from "../scoring";
import type { InteriorSuite } from "../interior";
import type { CapabilityObservation } from "./capabilities";
import type { FrozenExperiment } from "./manifest";
import { assertInteriorPublishedView, assertInteriorRunReady, createInteriorExperiment, interiorCellsComplete, parseInteriorExperimentArguments, runInteriorExperiment, type InteriorExperiment } from "./interior-experiment";

const parent = parentData as unknown as FrozenExperiment;
const controls = controlData.probes as unknown as CapabilityObservation[];
const exposure = { version: "1" as const, state: "running", manifestSha256: qualityDataHash(parent), updatedAt: "2026-11-08T05:35:00.000Z", cells: [{ id: "documented-prior-cell", state: "active", progress: { inferenceRequests: 5 } }] };
const settled = { ...exposure, state: "settled", cells: [{ ...exposure.cells[0], state: "completed" }] };
let suite: InteriorSuite, prompts: readonly NumericalPromptBlueprint[], baseSuiteId: string, manifest: InteriorExperiment;
let catalog: { suites: { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
beforeAll(async () => {
  const loaded = await loadRunSuite("interior-v1", "one-shot-json-v2-max");
  if (loaded.generatorVersion !== "interior-v1") throw new Error("Exploratory fixture unavailable.");
  suite = loaded; baseSuiteId = (await loadRunSuite("interior-v1", "one-shot-json-v1")).id;
  prompts = await buildNumericalPrompts(suite.cases.map(entry => entry.reference), "one-shot-json-v2-max", "smooth-v2");
  manifest = createInteriorExperiment(parent, exposure, controls, suite, prompts, baseSuiteId);
  catalog = { suites: [{ key: "interior-v1", suiteId: baseSuiteId, caseCount: 72, generatorVersion: "interior-v1" }] };
}, 30000);

function ready(candidate = manifest, parentLedger = settled, policy: unknown = RUN_POLICY, choices: unknown = catalog, source = parent) {
  return assertInteriorRunReady(candidate, source, parentLedger, controls, suite, prompts, baseSuiteId, policy, choices);
}

it("pins exactly two highest-effort frontier cells and the full independently verified workload", () => {
  expect(manifest.cells.map(cell => cell.modelId)).toEqual(["gpt-6-astra", "gpt-6.1-sol"]);
  expect(manifest.cells.every(cell => cell.phase === "exploratory" && cell.profileId === "one-shot-json-v2-max" && cell.maxOutputTokens === 16384 && cell.concurrency === 4 && cell.plannedTrials === 216)).toBe(true);
  expect(manifest.population).toMatchObject({ suiteKey: "interior-v1", caseCount: 72, families: 3, sharedSourceClusters: 8, rawDepth: 13, seed: "coconut-interior-exploratory-v1" });
  expect(manifest.population.suiteSha256).toBe(qualityDataHash(suite));
  expect(manifest.population.promptsSha256).toBe(qualityDataHash(prompts));
  expect(manifest.criteriaSha256).toBe(QUALITY_CRITERIA_SHA256);
  expect(manifest.sourceParent.manifestSha256).toBe(qualityDataHash(parent));
  expect(manifest.sourceParent.originalManifestSha256).toBe(parent.replication!.sourceManifestSha256);
  expect(manifest.sourceParent.retainedControlsSha256).toBe(qualityDataHash(controls));
  expect(manifest.budget).toMatchObject({ maxNewInferenceRequests: 432, priorReservedInferenceCeiling: 7648, cumulativeInferenceCeiling: 8080, sharedInferenceCeiling: 8192, maxConcurrency: 8, retries: 0 });
  expect(manifest.capabilities).toEqual({ policy: "reuse-retained-controls-without-new-calls", retainedProbeCount: 183, newRequests: 0 });
  expect(manifest.interpretation).toMatchObject({ population: "exploratory", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false });
  expect(manifest.exposure.ledgerSnapshot).not.toBe(exposure);
  expect(manifest.exposure.ledgerSnapshotSha256).toBe(qualityDataHash(exposure));
});

it("leaves source objects unchanged and rejects parent identity, control, and cumulative-budget drift", () => {
  const before = qualityDataHash({ parent, exposure, controls, suite, prompts });
  createInteriorExperiment(parent, exposure, controls, suite, prompts, baseSuiteId);
  expect(qualityDataHash({ parent, exposure, controls, suite, prompts })).toBe(before);
  expect(() => createInteriorExperiment({ ...parent, interpretation: "changed full source" }, exposure, controls, suite, prompts, baseSuiteId)).toThrow("parent identities");
  const changedParent = { ...parent, replication: { ...parent.replication!, maximumCumulativeInferenceRequests: 8192 } };
  expect(() => createInteriorExperiment(changedParent, exposure, controls, suite, prompts, baseSuiteId)).toThrow("budget");
  expect(() => createInteriorExperiment(parent, exposure, controls.slice(1), suite, prompts, baseSuiteId)).toThrow("controls");
  expect(() => createInteriorExperiment(parent, exposure, controls, { ...suite, request: { ...suite.request, profileId: "one-shot-json-v2-high" } }, prompts, baseSuiteId)).toThrow("settings");
});

it("refuses a running parent, active cells, stale API catalog, and altered execution policy", () => {
  expect(() => ready()).not.toThrow();
  expect(() => ready(manifest, exposure)).toThrow("settle");
  expect(() => ready(manifest, { ...settled, cells: [{ ...settled.cells[0], state: "active" }] })).toThrow("settle");
  expect(() => ready(manifest, settled, RUN_POLICY, { suites: [] })).toThrow("running API");
  expect(() => ready(manifest, settled, { ...RUN_POLICY, attemptsPerTrial: 2 })).toThrow("execution policy");
  expect(() => ready(manifest, settled, { ...RUN_POLICY, maxActiveRuns: undefined })).toThrow("execution policy");
  expect(() => ready(manifest, { ...settled, cells: [{ ...settled.cells[0], progress: { inferenceRequests: 9000 } }] })).toThrow("budget");
});

it("validates every frozen field and exact prompt content before any paid launch", () => {
  expect(() => ready({ ...manifest, budget: { ...manifest.budget, maxNewInferenceRequests: 433 } } as unknown as InteriorExperiment)).toThrow("Frozen exploratory");
  expect(() => ready({ ...manifest, cells: [{ ...manifest.cells[0], settingsId: "changed" }, manifest.cells[1]] })).toThrow("Frozen exploratory");
  expect(() => ready({ ...manifest, exposure: { ...manifest.exposure, ledgerSnapshotSha256: "changed" } })).toThrow("Frozen exploratory");
  expect(() => assertInteriorRunReady(manifest, parent, settled, controls, suite, [{ ...prompts[0], messages: [prompts[0].messages[0], { role: "user", content: "changed expression" }] }, ...prompts.slice(1)], baseSuiteId, RUN_POLICY, catalog)).toThrow("Frozen exploratory");
});

it("requires an intentional launch and never calls incomplete scheduling a successful matrix", async () => {
  expect(parseInteriorExperimentArguments(["freeze", "--output", "new-matrix.json"])).toMatchObject({ command: "freeze", output: "new-matrix.json", acceptCharges: false });
  expect(parseInteriorExperimentArguments(["run", "--manifest", "matrix.json", "--output", "progress.json", "--accept-charges", "--publish"])).toMatchObject({ command: "run", acceptCharges: true, publish: true });
  expect(() => parseInteriorExperimentArguments(["run", "--manifest", "matrix.json", "--output", "progress.json"])).toThrow("consent");
  expect(() => parseInteriorExperimentArguments(["run", "--manifest", "matrix.json", "--output", "progress.json", "--accept-charges", "--retry"])).toThrow();
  expect(() => parseInteriorExperimentArguments(["freeze", "--output", "a.json", "--output", "b.json"])).toThrow();
  await expect(runInteriorExperiment("missing.json", "unused.json", "fixture-key", false, false)).rejects.toThrow("acknowledgement");
  expect(interiorCellsComplete([{ state: "completed" }, { state: "completed" }])).toBe(true);
  for (const state of ["pending", "active", "failed", "interrupted", "cancelled", "timed-out"] as const) expect(interiorCellsComplete([{ state: "completed" }, { state }])).toBe(false);
  expect(interiorCellsComplete([{ state: "completed" }])).toBe(false);
});

it("archives only a complete explicit publication with exact identity and independently reconciled metrics", async () => {
  const request = { suiteKey: "interior-v1", provider: "openai", modelId: "gpt-6-astra", servingProvider: null, profileId: "one-shot-json-v2-max", concurrency: 4, acceptCharges: true } as const;
  const initial = await prepareRunRecord(request, suite), labels = new Map(prompts.map((prompt, index) => [prompt.messages[1].content, suite.cases[index].label]));
  const client = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: request.modelId, object: "model" });
    const body = JSON.parse(init.body as string);
    return Response.json({ model: request.modelId, status: "completed", max_output_tokens: 16384, reasoning: { effort: "max" }, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Explicit controlled fixture, not a model observation." }) }] }] });
  });
  const results = await Promise.all(initial.evidence.trials.map(async trial => {
    const index = suite.cases.findIndex(entry => entry.id === trial.caseId);
    const result = await client({ selection: { provider: request.provider, modelId: request.modelId, servingProvider: null, profileId: request.profileId, verification: "metadata" }, prompt: prompts[index], acceptCharges: true }, "sk-interior-fixture-123456789");
    return { caseId: trial.caseId, trialIndex: trial.trialIndex, result };
  }));
  const evidence = { ...initial.evidence, trials: initial.evidence.trials.map((trial, index) => ({ ...trial, finalAttempt: 1, elapsedMs: results[index].result.evidence.elapsedMs, attempts: [results[index].result.evidence] })) };
  const report = await scoreEvaluation({ suite, evidence });
  const view: RunView = { publishedAt: new Date().toISOString(), record: { ...initial, state: "completed", results, evidence, report,
    progress: { plannedTrials: 216, startedTrials: 216, activeTrials: 0, finishedTrials: 216, modelOutcomes: 216, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: 216 } } };
  expect(() => assertInteriorPublishedView(manifest.cells[0], view, initial.id, manifest.frozenAt)).not.toThrow();
  expect(() => assertInteriorPublishedView(manifest.cells[0], { ...view, publishedAt: null }, initial.id, manifest.frozenAt)).toThrow("publication");
  expect(() => assertInteriorPublishedView(manifest.cells[0], { ...view, record: { ...view.record, state: "failed" } }, initial.id, manifest.frozenAt)).toThrow("publication");
  expect(() => assertInteriorPublishedView(manifest.cells[0], view, "other-run", manifest.frozenAt)).toThrow("frozen cell");
  expect(() => assertInteriorPublishedView(manifest.cells[0], { ...view, record: { ...view.record, report: { ...report, overall: { ...report.overall, classification: { ...report.overall.classification, macroF1: 0 } } } } }, initial.id, manifest.frozenAt)).toThrow();
  expect(() => assertInteriorPublishedView(manifest.cells[0], { ...view, accessCode: "private-sentinel" } as unknown as RunView, initial.id, manifest.frozenAt)).toThrow("frozen cell");
}, 30000);
