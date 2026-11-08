// Offline fixtures lock down exact identity, send accounting, and fresh-replication budget preservation.
import { beforeAll, expect, it } from "bun:test";
import { createInferenceClient } from "../inference";
import { buildPrompt } from "../protocol";
import { qualityDataHash } from "../quality";
import { prepareRunRecord } from "../runs/evidence";
import type { RunRequest, RunView } from "../runs/types";
import { generateSuite } from "../suites/generator";
import type { CapabilityObservation } from "./capabilities";
import type { FrozenExperiment } from "./manifest";
import { reconcileExperiment, type ExperimentLedger } from "./reconcile";
import { createReplicationManifest } from "./replicate";
import { experimentPaths, parseFrozenRunArguments } from "./run";

let manifest: FrozenExperiment, ledger: ExperimentLedger, view: RunView;
let controls: CapabilityObservation[];
beforeAll(async () => {
  const request: RunRequest = { provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", suiteKey: "reference-v1", concurrency: 4, acceptCharges: true };
  const generated = await generateSuite({ seed: "offline-reconciliation", depths: [5], casesPerClass: 1, profileId: request.profileId, purpose: "evaluation" });
  if (generated.status !== "complete") throw new Error("Fixture suite failed.");
  const initial = await prepareRunRecord(request, generated.suite);
  const input = { selection: { ...request, verification: "metadata" }, prompt: initial.prompts[0], acceptCharges: true };
  // The strict selection boundary accepts only its explicit four fields.
  input.selection = { provider: request.provider, modelId: request.modelId, servingProvider: null, profileId: request.profileId, verification: "metadata" } as typeof input.selection;
  const infer = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: request.modelId, object: "model" });
    return Response.json({ model: request.modelId, status: "completed", max_output_tokens: 4096, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: initial.suite.cases[0].label, explanation: "Controlled fixture." }) }] }] });
  });
  const answer = await infer(input, "sk-fixture-reconcile-123456789");
  const failed = await createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: request.modelId, object: "model" });
    throw new Error("Controlled unknown remote send.");
  })(input, "sk-fixture-reconcile-123456789");
  const results = [answer, failed].map((result, trialIndex) => ({ caseId: initial.suite.cases[0].id, trialIndex, result }));
  view = { publishedAt: null, record: { ...initial, state: "failed", failure: { code: "incomplete-evidence", message: "Controlled fixture." }, results,
    progress: { ...initial.progress, startedTrials: 2, finishedTrials: 2, modelOutcomes: 1, infrastructureFailures: 1, remainingTrials: 7, inferenceRequests: 2 } } };
  const cell = { id: "fixture-cell", phase: "screening" as const, provider: "openai" as const, modelId: request.modelId, servingProvider: null,
    profileId: request.profileId, suiteId: initial.suite.id, suiteSha256: qualityDataHash(initial.suite), promptsSha256: qualityDataHash(initial.prompts),
    settingsId: initial.evidence.model.settingsId, reasoningEffort: "provider-default" as const, maxOutputTokens: 4096, concurrency: 4 };
  const controlReference = { expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
  const profileId = "one-shot-json-v2-high" as const;
  const controlResult = { ...answer, requested: { ...answer.requested, profileId }, prompt: buildPrompt(controlReference, profileId), effective: { ...answer.effective, maxOutputTokens: 16384, reasoningEffort: "high" } };
  controls = [{ modelId: request.modelId, effort: "high", result: controlResult }];
  manifest = { version: "1", kind: "openai-curvature-experiment", policyId: "quality-criteria-v1", criteriaSha256: "fixture", frozenAt: initial.createdAt,
    inventory: { checkedAt: initial.createdAt, source: "https://api.openai.com/v1/models", modelIds: [request.modelId] },
    frontier: { modelIds: [request.modelId], basis: "Fixture", sourceUrls: [] }, modelEfforts: [],
    cells: [cell, { ...cell, id: "control-cell", phase: "capability-probe", profileId, reasoningEffort: "high", maxOutputTokens: 16384 }],
    budget: { maxChargedAttempts: 8192, maxConcurrency: 12, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000 },
    census: { included: [], excluded: [] }, plannedInferenceCeiling: 28, previousCalibrationAllowance: 4,
    execution: { parallelRuns: 3, runConcurrency: 4, compatibilityConcurrency: 12, retries: 0 }, interpretation: "Fixture", capabilityControl: { reference: controlReference, purpose: "Fixture" } };
  ledger = { version: "1", manifestSha256: qualityDataHash(manifest), state: "settled", capabilitiesInferenceRequests: 1,
    cells: [{ id: cell.id, runId: initial.id, state: "failed", progress: { finished: 2, planned: 9, inferenceRequests: 2 } }] };
});

it("reconciles actual sends and unknown work without inventing a complete score", () => {
  const report = reconcileExperiment(manifest, ledger, [view]);
  expect(report.counts).toMatchObject({ executedCells: 1, completedCells: 0, plannedTrials: 9, retainedTrials: 2, answerCount: 1, correctAnswers: 1,
    mathematicalInferenceRequests: 2, capabilityInferenceRequests: 1, maximumPriorInferenceRequests: 7, unknownRemoteInferenceRequests: 1 });
  expect(report.records[0].state).toBe("failed");
  expect(report.records[0].wrongCaseIds).toEqual([]);
});

it("rejects missing, duplicate, tampered, or count-inconsistent records", () => {
  expect(() => reconcileExperiment(manifest, ledger, [])).toThrow("identity");
  expect(() => reconcileExperiment(manifest, ledger, [view, view])).toThrow("identities");
  expect(() => reconcileExperiment(manifest, { ...ledger, manifestSha256: "changed" }, [view])).toThrow("manifest");
  expect(() => reconcileExperiment(manifest, ledger, [{ ...view, record: { ...view.record, request: { ...view.record.request, modelId: "other" } } }])).toThrow("identity");
  expect(() => reconcileExperiment(manifest, ledger, [{ ...view, record: { ...view.record, results: [view.record.results[0], view.record.results[0]] } }])).toThrow("duplicated");
  expect(() => reconcileExperiment(manifest, ledger, [{ ...view, record: { ...view.record, progress: { ...view.record.progress, inferenceRequests: 0 } } }])).toThrow("counts");
});

it("freezes a fresh full replication with unchanged cells, reused controls, and a cumulative ceiling", () => {
  const report = reconcileExperiment(manifest, ledger, [view]), repeated = createReplicationManifest(manifest, report, controls);
  expect(repeated.cells).toBe(manifest.cells);
  expect(repeated.replication).toMatchObject({ sourceManifestSha256: qualityDataHash(manifest), sourceLedgerSha256: qualityDataHash(ledger),
    retainedPriorInferenceRequests: 7, plannedNewMathInferenceRequests: 27, maximumCumulativeInferenceRequests: 34, capabilityPolicy: "reuse-retained-controls-without-new-calls" });
  expect(repeated.replication?.retainedControlsSha256).toBe(qualityDataHash(controls));
  expect(() => createReplicationManifest(manifest, { ...report, counts: { ...report.counts, maximumPriorInferenceRequests: 8192 } }, controls)).toThrow("ceiling");
  expect(() => createReplicationManifest(manifest, report, [])).toThrow("controls");
  expect(() => createReplicationManifest(repeated, report, controls)).toThrow("replication");
});

it("requires explicit new output and consent, and isolates every replication artifact path", () => {
  expect(parseFrozenRunArguments(["--manifest", "matrix-v2.json", "--output", "progress-v2.json", "--accept-charges", "--publish"])).toEqual({ manifest: "matrix-v2.json", output: "progress-v2.json", publish: true });
  expect(() => parseFrozenRunArguments(["--output", "progress-v2.json"])).toThrow("consent");
  expect(() => parseFrozenRunArguments(["--output", "a.json", "--output", "b.json", "--accept-charges"])).toThrow();
  expect(() => parseFrozenRunArguments(["--output", "a.json", "--accept-charges", "--retry"])).toThrow();
  expect(() => experimentPaths("Progress.json")).toThrow();
  const one = experimentPaths("openai-progress-v2.json"), two = experimentPaths("openai-progress-v3.json");
  expect(one.privateRoot).not.toBe(two.privateRoot);
  expect(one.capabilities).toEndWith("openai-progress-v2-capabilities.json");
  expect(one.privateRoot).toEndWith("data/private/openai-progress-v2/");
});
