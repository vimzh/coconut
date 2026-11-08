// Two separately frozen frontier cells characterize a fixed exploratory population without retries or ranks.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildNumericalPrompts } from "../numerics";
import type { NumericalPromptBlueprint } from "../numerics/prompt";
import { qualityDataHash } from "../quality";
import { QUALITY_CRITERIA_SHA256, snapshot } from "../quality/data";
import { auditRetainedMetrics } from "../quality/reporting-audit";
import { reflectsCredential } from "../providers/responses";
import { deriveRunSettingsId } from "../runs/evidence";
import { loadRunSuite } from "../runs/registry";
import type { RunEvent, RunView } from "../runs/types";
import type { InteriorSuite } from "../interior";
import { effortWasAccepted, type CapabilityObservation } from "./capabilities";
import { launchForegroundRun, LOCAL_API, readApplicationJson, readPrivateRun } from "./http";
import type { FrozenExperiment } from "./manifest";
import { matrixFailureRequiresStop } from "./matrix-policy";
import { experimentPaths } from "./run";

const MODELS = ["gpt-6-astra", "gpt-6.1-sol"] as const;
const PROFILE = "one-shot-json-v2-max";
interface ParentLedger {
  readonly version: "1"; readonly state: string; readonly manifestSha256: string; readonly updatedAt: string;
  readonly cells: readonly { readonly id: string; readonly state: string; readonly progress: { readonly inferenceRequests: number } }[];
}
interface InteriorCell {
  readonly id: string; readonly phase: "exploratory"; readonly provider: "openai"; readonly modelId: typeof MODELS[number]; readonly servingProvider: null;
  readonly profileId: typeof PROFILE; readonly suiteId: string; readonly suiteSha256: string; readonly promptsSha256: string;
  readonly settingsId: string; readonly reasoningEffort: "max"; readonly maxOutputTokens: 16384; readonly concurrency: 4; readonly plannedTrials: 216;
}
export interface InteriorExperiment {
  readonly version: "1"; readonly kind: "interior-curvature-exploration"; readonly frozenAt: string; readonly criteriaSha256: string;
  readonly sourceParent: { readonly manifestSha256: string; readonly originalManifestSha256: string; readonly originalLedgerSha256: string; readonly originalReconciliationSha256: string; readonly retainedControlsSha256: string };
  readonly exposure: { readonly observedBeforeDesign: string; readonly ledgerSnapshotSha256: string; readonly ledgerSnapshot: ParentLedger };
  readonly population: { readonly suiteKey: "interior-v1"; readonly baseSuiteId: string; readonly suiteId: string; readonly suiteSha256: string; readonly promptsSha256: string; readonly seed: string; readonly caseCount: 72; readonly families: 3; readonly sharedSourceClusters: 8; readonly rawDepth: 13 };
  readonly cells: readonly InteriorCell[];
  readonly budget: { readonly sharedInferenceCeiling: 8192; readonly priorReservedInferenceCeiling: 7648; readonly maxNewInferenceRequests: 432; readonly cumulativeInferenceCeiling: 8080; readonly parallelRuns: 2; readonly runConcurrency: 4; readonly maxConcurrency: 8; readonly retries: 0; readonly trialsPerCase: 3; readonly metadataTimeoutMs: 20000; readonly inferenceTimeoutMs: 180000 };
  readonly capabilities: { readonly policy: "reuse-retained-controls-without-new-calls"; readonly retainedProbeCount: 183; readonly newRequests: 0 };
  readonly interpretation: { readonly population: "exploratory"; readonly ranked: false; readonly confidenceInterval: "unavailable"; readonly strongSignalEligible: false; readonly scope: string };
}
interface InteriorStatus { id: string; state: "pending" | "active" | "completed" | "failed" | "cancelled" | "timed-out" | "interrupted"; runId: string | null; progress: { finished: number; planned: number; inferenceRequests: number }; reportId: string | null; published: boolean; archived: boolean; error: string | null }
export interface InteriorLedger { readonly version: "1"; readonly state: "running" | "settled" | "interrupted"; readonly manifestSha256: string; readonly cells: readonly InteriorStatus[] }

function assertControls(parent: FrozenExperiment, controls: readonly CapabilityObservation[]): void {
  if (controls.length !== 183 || qualityDataHash(controls) !== parent.replication?.retainedControlsSha256) throw new Error("Retained capability controls differ from the parent experiment.");
  for (const modelId of MODELS) {
    const control = controls.find(row => row.modelId === modelId && row.effort === "max");
    if (!control || !effortWasAccepted(control) || control.result.contextFit !== "provider-enforced" || control.result.reportedModelId === null) throw new Error("The exact frontier maximum effort was not established by retained controls.");
  }
}

export function createInteriorExperiment(parent: FrozenExperiment, exposure: ParentLedger, controls: readonly CapabilityObservation[], suite: InteriorSuite, prompts: readonly NumericalPromptBlueprint[], baseSuiteId: string): InteriorExperiment {
  const replication = parent.replication;
  if (parent.criteriaSha256 !== QUALITY_CRITERIA_SHA256 || !replication || replication.maximumCumulativeInferenceRequests !== 7648
    || replication.retainedPriorInferenceRequests !== 412 || replication.plannedNewMathInferenceRequests !== 7236
    || exposure.manifestSha256 !== qualityDataHash(parent) || exposure.version !== "1") throw new Error("The parent identities or reserved cumulative budget changed.");
  assertControls(parent, controls);
  if (suite.generatorVersion !== "interior-v1" || suite.request.population !== "exploratory" || suite.request.seed !== "coconut-interior-exploratory-v1"
    || suite.request.profileId !== PROFILE || suite.cases.length !== 72 || new Set(suite.cases.map(entry => entry.family)).size !== 3
    || new Set(suite.cases.map(entry => entry.clusterId)).size !== 8 || suite.cases.some(entry => entry.depth !== 13)
    || prompts.length !== 72 || prompts.some(prompt => prompt.profileId !== PROFILE || prompt.promptVersion !== "smooth-v2" || prompt.generation.reasoning !== "max" || prompt.generation.maxOutputTokens !== 16384)) throw new Error("The fixed exploratory workload or generation settings changed.");
  const suiteSha256 = qualityDataHash(suite), promptsSha256 = qualityDataHash(prompts);
  const cells = MODELS.map(modelId => {
    const content: Omit<InteriorCell, "id"> = { phase: "exploratory", provider: "openai", modelId, servingProvider: null,
      profileId: PROFILE, suiteId: suite.id, suiteSha256, promptsSha256, settingsId: deriveRunSettingsId({ profileId: PROFILE, concurrency: 4 }, prompts[0].generation),
      reasoningEffort: "max" as const, maxOutputTokens: 16384 as const, concurrency: 4 as const, plannedTrials: 216 as const };
    return { id: `interior-cell-${qualityDataHash(content)}`, ...content };
  });
  return snapshot({ version: "1", kind: "interior-curvature-exploration", frozenAt: new Date().toISOString(), criteriaSha256: QUALITY_CRITERIA_SHA256,
    sourceParent: { manifestSha256: qualityDataHash(parent), originalManifestSha256: replication.sourceManifestSha256, originalLedgerSha256: replication.sourceLedgerSha256, originalReconciliationSha256: replication.reconciliationSha256, retainedControlsSha256: replication.retainedControlsSha256 },
    exposure: { observedBeforeDesign: "Completed high/max cells on the earlier challenge were inspected before these three families were constructed. This adaptive, exploratory follow-up retains the prior ledger snapshot; it is not held-out confirmation.", ledgerSnapshotSha256: qualityDataHash(exposure), ledgerSnapshot: exposure },
    population: { suiteKey: "interior-v1", baseSuiteId, suiteId: suite.id, suiteSha256, promptsSha256, seed: suite.request.seed, caseCount: 72, families: 3, sharedSourceClusters: 8, rawDepth: 13 }, cells,
    budget: { sharedInferenceCeiling: 8192, priorReservedInferenceCeiling: 7648, maxNewInferenceRequests: 432, cumulativeInferenceCeiling: 8080, parallelRuns: 2, runConcurrency: 4, maxConcurrency: 8, retries: 0, trialsPerCase: 3, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000 },
    capabilities: { policy: "reuse-retained-controls-without-new-calls", retainedProbeCount: 183, newRequests: 0 },
    interpretation: { population: "exploratory", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false,
      scope: "Three families and eight shared clusters fail the unchanged six-family/20-cluster confirmation and interval conditions. Report descriptive outcomes and individually reviewed observed point failures only; no broad ranking or general failure claim follows." } });
}

async function inputs() {
  const root = new URL("../../data/experiments/", import.meta.url);
  const parent = await Bun.file(new URL("openai-matrix-v2.json", root)).json() as FrozenExperiment;
  const ledger = await Bun.file(new URL("openai-progress-v2.json", root)).json() as ParentLedger;
  const calibration = await Bun.file(new URL("capabilities-v1.json", root)).json() as { state: string; probes: CapabilityObservation[]; errors: unknown[] };
  if (calibration.state !== "complete" || calibration.errors.length) throw new Error("Retained controls are incomplete.");
  const original = await Bun.file(new URL("openai-matrix-v1.json", root)).json(), originalLedger = await Bun.file(new URL("openai-progress-v1.json", root)).json();
  const reconciliation = await Bun.file(new URL("openai-reconciliation-v1.json", root)).json();
  if (qualityDataHash(original) !== parent.replication?.sourceManifestSha256 || qualityDataHash(originalLedger) !== parent.replication.sourceLedgerSha256 || qualityDataHash(reconciliation) !== parent.replication.reconciliationSha256) throw new Error("Original evidence no longer matches the parent replication.");
  const loaded = await loadRunSuite("interior-v1", PROFILE), base = await loadRunSuite("interior-v1", "one-shot-json-v1");
  if (loaded.generatorVersion !== "interior-v1") throw new Error("The exploratory generator is unavailable.");
  const prompts = await buildNumericalPrompts(loaded.cases.map(entry => entry.reference), PROFILE, loaded.promptVersion);
  return { parent, ledger, controls: calibration.probes, suite: loaded, prompts, baseSuiteId: base.id };
}

export async function freezeInteriorExperiment(output: string): Promise<InteriorExperiment> {
  const data = await inputs(), manifest = createInteriorExperiment(data.parent, data.ledger, data.controls, data.suite, data.prompts, data.baseSuiteId);
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

export function assertInteriorRunReady(manifest: InteriorExperiment, parent: FrozenExperiment, ledger: ParentLedger, controls: readonly CapabilityObservation[], suite: InteriorSuite, prompts: readonly NumericalPromptBlueprint[], baseSuiteId: string, policy: unknown, catalog: unknown): void {
  if (ledger.state === "running" || ledger.cells.some(cell => cell.state === "active") || !["settled", "interrupted"].includes(ledger.state)) throw new Error("The parent experiment must settle before exploratory work can start.");
  const recreated = createInteriorExperiment(parent, manifest.exposure.ledgerSnapshot, controls, suite, prompts, baseSuiteId);
  if (qualityDataHash({ ...recreated, frozenAt: manifest.frozenAt }) !== qualityDataHash(manifest) || manifest.exposure.ledgerSnapshotSha256 !== qualityDataHash(manifest.exposure.ledgerSnapshot)
    || !Number.isFinite(Date.parse(manifest.frozenAt)) || Date.parse(manifest.frozenAt) > Date.now() || ledger.manifestSha256 !== manifest.sourceParent.manifestSha256
    || ledger.cells.reduce((sum, cell) => sum + cell.progress.inferenceRequests, 0) > parent.plannedInferenceCeiling) throw new Error("Frozen exploratory inputs, parent identity, or send budget changed.");
  const limits = policy as Record<string, unknown>, choices = catalog as { suites?: readonly { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
  if (!limits || limits.policyId !== "foreground-runs-v1" || limits.trialsPerInstance !== 3 || limits.attemptsPerTrial !== 1 || limits.retries !== 0
    || limits.metadataTimeoutMs !== 20000 || limits.inferenceTimeoutMs !== 180000 || limits.maxActiveRuns !== 4 || limits.maxConcurrency !== 12
    || !Array.isArray(choices?.suites) || !choices.suites.some(entry => entry.key === "interior-v1" && entry.suiteId === baseSuiteId && entry.caseCount === 72 && entry.generatorVersion === "interior-v1")) throw new Error("The running API does not advertise the frozen exploratory suite and execution policy. Restart the updated API after parent settlement.");
}

export function interiorCellsComplete(cells: readonly Pick<InteriorStatus, "state">[]): boolean { return cells.length === 2 && cells.every(cell => cell.state === "completed"); }

function assertCellView(cell: InteriorCell, view: RunView, expectedRunId: string, frozenAt: string): void {
  const record = view.record;
  if (Object.keys(view).sort().join(",") !== "publishedAt,record" || record.id !== expectedRunId || !Number.isFinite(Date.parse(record.createdAt)) || Date.parse(record.createdAt) < Date.parse(frozenAt)
    || record.results.some(row => !Number.isFinite(Date.parse(row.result.startedAt)) || Date.parse(row.result.startedAt) < Date.parse(frozenAt))
    || record.request.suiteKey !== "interior-v1" || record.request.provider !== "openai" || record.request.modelId !== cell.modelId || record.request.servingProvider !== null || record.request.profileId !== PROFILE || record.request.concurrency !== 4
    || record.suite.id !== cell.suiteId || qualityDataHash(record.suite) !== cell.suiteSha256 || qualityDataHash(record.prompts) !== cell.promptsSha256 || record.evidence.model.settingsId !== cell.settingsId
    || record.workload.logicalCalls !== 216 || record.progress.inferenceRequests > 216) throw new Error("Retained exploratory execution differs from its frozen cell.");
}

export function assertInteriorPublishedView(cell: InteriorCell, view: RunView, expectedRunId: string, frozenAt: string): void {
  assertCellView(cell, view, expectedRunId, frozenAt);
  if (!view.publishedAt || view.record.state !== "completed" || view.record.report?.overall.classification.population.status !== "complete") throw new Error("Explicit completed publication was not established.");
  auditRetainedMetrics(view.record);
}

async function atomicJson(path: string, value: unknown, credential: string): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (reflectsCredential(text, credential)) throw new Error("Unsafe exploratory evidence.");
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, { flag: "wx", mode: 0o600 }); await rename(temporary, path);
}

export async function runInteriorExperiment(manifestPath: string, output: string, credential: string, acceptCharges: boolean, publish: boolean): Promise<void> {
  if (acceptCharges !== true || !credential) throw new Error("An explicit credential and provider-charge acknowledgement are required.");
  const manifest = await Bun.file(manifestPath).json() as InteriorExperiment, data = await inputs();
  const [policy, catalog] = await Promise.all(["policy", "suites"].map(async route => readApplicationJson(await fetch(`${LOCAL_API}/runs/${route}`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }))));
  assertInteriorRunReady(manifest, data.parent, data.ledger, data.controls, data.suite, data.prompts, data.baseSuiteId, policy, catalog);
  const paths = experimentPaths(output), root = paths.privateRoot, publicRoot = `${paths.output.slice(0, -5)}-published`;
  await mkdir(new URL("../../data/private/", import.meta.url), { recursive: true, mode: 0o700 }); await mkdir(root, { mode: 0o700 });
  await mkdir(`${root}records`, { mode: 0o700 });
  if (publish) await mkdir(publicRoot, { mode: 0o700 });
  await writeFile(paths.output, "{}\n", { flag: "wx", mode: 0o600 });
  await writeFile(`${root}access.json`, "{}\n", { flag: "wx", mode: 0o600 });
  const controller = new AbortController(), stop = () => controller.abort();
  const startedAt = new Date().toISOString();
  const statuses: InteriorStatus[] = manifest.cells.map(cell => ({ id: cell.id, state: "pending", runId: null, progress: { finished: 0, planned: 216, inferenceRequests: 0 }, reportId: null, published: false, archived: false, error: null }));
  const receipts: Record<string, { runId: string; accessCode: string }> = {};
  const archived: { cellId: string; runId: string; file: string; sha256: string; reportId: string }[] = [];
  let checkpoint = Promise.resolve();
  const save = () => {
    checkpoint = checkpoint.then(async () => {
      await atomicJson(paths.output, { version: "1", kind: "interior-exploratory-progress", manifestSha256: qualityDataHash(manifest), startedAt, updatedAt: new Date().toISOString(),
        state: controller.signal.aborted ? "interrupted" : statuses.some(cell => cell.state === "pending" || cell.state === "active") ? "running" : "settled", capabilityCallsThisExecution: 0,
        priorReservedInferenceCeiling: 7648, maxNewInferenceRequests: 432, cumulativeInferenceCeiling: 8080, cells: statuses,
        interpretation: manifest.interpretation }, credential);
    }).catch(() => { controller.abort(); throw new Error("Exploratory checkpoint could not be retained."); });
    return checkpoint;
  };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const capabilityText = `${JSON.stringify({ version: "1", manifestSha256: qualityDataHash(manifest), boundAt: startedAt, observedControlsPolicy: manifest.capabilities, probes: data.controls }, null, 2)}\n`;
    if (reflectsCredential(capabilityText, credential)) throw new Error("Unsafe retained control binding.");
    await writeFile(paths.capabilities, capabilityText, { flag: "wx", mode: 0o600 });
    await save();
    const settled = await Promise.allSettled(manifest.cells.map(async (cell, index) => {
      const status = statuses[index]; status.state = "active"; await save();
      let receipt: { runId: string; accessCode: string } | null = null, lastSave = 0;
      const observe = (event: RunEvent) => {
        if (event.type === "started") {
          receipt = { runId: event.runId, accessCode: event.accessCode }; receipts[cell.id] = receipt; status.runId = event.runId;
          // Persist the once-only receipt synchronously before consuming another stream event.
          const text = `${JSON.stringify(receipts, null, 2)}\n`, temporary = `${root}access.${randomUUID()}.tmp`;
          if (reflectsCredential(text, credential)) throw new Error("Unsafe private receipt.");
          try { writeFileSync(temporary, text, { flag: "wx", mode: 0o600 }); renameSync(temporary, `${root}access.json`); }
          catch { controller.abort(); throw new Error("The private receipt could not be retained."); }
        }
        if ("progress" in event) status.progress = { finished: event.progress.finishedTrials, planned: event.progress.plannedTrials, inferenceRequests: event.progress.inferenceRequests };
        if (event.type === "started" || Date.now() - lastSave >= 5000) { lastSave = Date.now(); void save().catch(() => {}); }
      };
      try {
        await launchForegroundRun({ suiteKey: "interior-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: PROFILE, concurrency: 4, acceptCharges: true }, credential, controller.signal, observe);
      } catch { status.error = "The foreground operation did not establish a terminal outcome. No retry was started."; }
      const saved = receipt as { runId: string; accessCode: string } | null;
      if (!saved) { status.state = "interrupted"; controller.abort(); await save(); return; }
      try {
        const view = await readPrivateRun(saved.runId, saved.accessCode, credential); assertCellView(cell, view, saved.runId, manifest.frozenAt);
        await atomicJson(`${root}records/${saved.runId}.json`, view, credential);
        status.state = view.record.state === "running" || view.record.state === "cancelling" ? "interrupted" : view.record.state;
        status.progress = { finished: view.record.progress.finishedTrials, planned: 216, inferenceRequests: view.record.progress.inferenceRequests }; status.reportId = view.record.report?.id ?? null;
        if (matrixFailureRequiresStop(view.record)) controller.abort();
        if (publish && view.record.state === "completed") {
          const response = await fetch(`${LOCAL_API}/runs/${saved.runId}/publication`, { method: "POST", headers: { Authorization: `Bearer ${saved.accessCode}`, "Content-Type": "application/json" }, body: '{"published":true}', cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) });
          await readApplicationJson(response, credential); status.published = true;
          const published = await readApplicationJson(await fetch(`${LOCAL_API}/runs/${saved.runId}/public`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }), credential) as RunView;
          assertInteriorPublishedView(cell, published, saved.runId, manifest.frozenAt);
          const file = `${saved.runId}.json`;
          await atomicJson(join(publicRoot, file), published, credential); status.archived = true;
          archived.push({ cellId: cell.id, runId: saved.runId, file, sha256: qualityDataHash(published), reportId: published.record.report!.id });
        }
      } catch { status.error = "Retained execution, publication, or archive needs review. No replacement call was started."; if (status.state === "active") { status.state = "interrupted"; controller.abort(); } }
      await save();
      console.log(JSON.stringify({ phase: "interior-exploratory", modelId: cell.modelId, state: status.state, finished: status.progress.finished, planned: 216, inferenceRequests: status.progress.inferenceRequests, published: status.published, archived: status.archived }));
    }));
    await save();
    if (publish) await atomicJson(join(publicRoot, "index.json"), { version: "1", kind: "published-interior-exploratory-archive", createdAt: new Date().toISOString(), manifestSha256: qualityDataHash(manifest),
      records: archived, omitted: statuses.filter(status => !status.archived).map(status => ({ cellId: status.id, state: status.state, reason: "No completed explicit public evidence was archived." })), interpretation: manifest.interpretation }, credential);
    if (settled.some(result => result.status === "rejected") || controller.signal.aborted || !interiorCellsComplete(statuses) || (publish && statuses.some(cell => !cell.published || !cell.archived))) throw new Error("The exploratory matrix or requested publication did not complete.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

export function parseInteriorExperimentArguments(args: readonly string[]): { command: "freeze" | "run"; output: string; manifest?: string; acceptCharges: boolean; publish: boolean } {
  const command = args[0];
  if (command !== "freeze" && command !== "run") throw new Error("Use freeze or run.");
  const values = new Map<string, string>(); let acceptCharges = false, publish = false;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (command === "run" && arg === "--accept-charges" && !acceptCharges) acceptCharges = true;
    else if (command === "run" && arg === "--publish" && !publish) publish = true;
    else if ((arg === "--output" || command === "run" && arg === "--manifest") && !values.has(arg) && args[i + 1] && !args[i + 1].startsWith("--")) values.set(arg, args[++i]);
    else throw new Error("Use freeze --output <new-manifest>, or run --manifest <file> --output <new-ledger> --accept-charges [--publish].");
  }
  const output = values.get("--output"), manifest = values.get("--manifest");
  if (!output || command === "run" && (!manifest || !acceptCharges)) throw new Error("Explicit output, manifest and charge consent are required for execution.");
  return { command, output, manifest, acceptCharges, publish };
}

if (import.meta.main) {
  try {
    const args = parseInteriorExperimentArguments(Bun.argv.slice(2));
    if (args.command === "freeze") { const manifest = await freezeInteriorExperiment(args.output); console.log(JSON.stringify({ manifestSha256: qualityDataHash(manifest), frozenAt: manifest.frozenAt, cells: manifest.cells.length, budget: manifest.budget })); }
    else await runInteriorExperiment(args.manifest!, args.output, process.env.OPENAI_API_KEY ?? "", args.acceptCharges, args.publish);
  } catch { console.error("Exploratory work did not complete. Inspect retained receipts and evidence before any additional paid action. Original experiments were not changed."); process.exitCode = 1; }
}
