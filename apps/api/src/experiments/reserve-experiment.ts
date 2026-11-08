// The fixed two-cell reserve operator requires reviewed references and terminal per-attempt lineage accounting.
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, rename, writeFile } from "node:fs/promises";
import { buildNumericalPrompts } from "../numerics";
import type { NumericalPromptBlueprint } from "../numerics/prompt";
import { qualityDataHash } from "../quality";
import { QUALITY_CRITERIA_SHA256, snapshot } from "../quality/data";
import { auditRetainedMetrics } from "../quality/reporting-audit";
import { reflectsCredential } from "../providers/responses";
import type { ReserveSuite } from "../reserve";
import { deriveRunSettingsId } from "../runs/evidence";
import { loadRunSuite } from "../runs/registry";
import type { RunEvent, RunState, RunView } from "../runs/types";
import { archivePublishedExperiment } from "./archive";
import { effortWasAccepted, type CapabilityObservation } from "./capabilities";
import { launchForegroundRun, LOCAL_API, readApplicationJson, readSettledPrivateRun } from "./http";
import { matrixFailureRequiresStop } from "./matrix-policy";
import type { ExperimentLedger } from "./reconcile";
import { assertStudySendEvidence, retainRemainingReceipt, type PriorInferenceAccounting, type PriorStudy, type StudyReconciliation, type StudySendEvidence } from "./remaining-models";
import { experimentPaths } from "./run";

const MODELS = ["gpt-6-astra", "gpt-6.1-sol"] as const, PROFILE = "one-shot-json-v2-max";
const BASE_ID = "suite-reserve-v1-54c719576846a0437a431372204593bd8ea47f4af99def6a654db4a93502e7c7";
const SUITE_ID = "suite-reserve-v1-c4efdfed64c8ff0696db7c6f2bb2a85b8bf563bf253d84cd0547e62c7803b224";
const SUITE_SHA = "b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811";
const PROMPTS_SHA = "e50da50ec96c12639e71e1adf40d4725a1c3b593e47c300dc4dc0307016cd0c6";
const FINGERPRINT = "195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615";
const DECISION_SHA = "29aea846d30bce67bc2e57fc7429824a5ea825362d5e4e9a44dd04e365158fa7", AMENDMENT_SHA = "5ab07c79467049062a5c01a538a9d88cb5c33e0bf041cdb462b6c6249b2d9e5a";
const PROPOSAL_SHA = "766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85";
const CONTROLS_SHA = "f2b920c061a45c3ad6a3d4027f567be28bfff48b8dfe7070bbdc7d2aabbb644e";
const REVIEW_SHA = "2c69ff774dce5b6b90f0b1d3c709d7bd102b4e4cca1aefed2dcb6564ccd851e3";
const SOURCES = {
  original: ["openai-matrix-v1", "openai-progress-v1", "c69ae7489e3ef4e904bf5adeff59841cc4045ce912dcc28f8f31aec0a8e26881"],
  replication: ["openai-matrix-v2", "openai-progress-v2", "62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e"],
  interior: ["interior-matrix-v1", "interior-progress-v1", "a4f109d0ddd550442d10978bfd1854c07ba04bb4f6268dc7cdaead701106d536"],
  "remaining-models": ["remaining-models-matrix-v1", "remaining-models-progress-v1", "583601ed027c0227ca0063734ca65f92bd590cc048688b46e984d530f7b900c5"],
} as const;
type Study = Omit<PriorStudy, "key"> & { readonly key: keyof typeof SOURCES };
export interface ReservePriorAccounting extends Omit<PriorInferenceAccounting, "studies"> { readonly studies: readonly Study[] }
interface Decision { readonly p5: { readonly manifestSha256: string; readonly ledgerSha256: string; readonly cells: readonly { readonly requestedModelId: string; readonly runId: string; readonly publicViewSha256: string }[] } }
export interface ReserveInputs {
  readonly accounting: ReservePriorAccounting; readonly controls: readonly CapabilityObservation[];
  readonly priorStudies: readonly { readonly key: Study["key"]; readonly manifest: unknown; readonly ledger: ExperimentLedger; readonly reconciliation: StudyReconciliation; readonly sendEvidence: StudySendEvidence }[];
  readonly suite: ReserveSuite; readonly prompts: readonly NumericalPromptBlueprint[]; readonly baseSuiteId: string;
  readonly decision: Decision; readonly amendment: unknown; readonly proposalFileSha256: string; readonly p5Views: readonly RunView[];
  readonly review: { readonly version: string; readonly kind: string; readonly status: string; readonly membershipFingerprint: string; readonly findings: readonly unknown[];
    readonly coverage: { readonly canonicalReferences: number; readonly unresolvedPairs: number } };
}
interface ReserveCell {
  readonly id: string; readonly phase: "exploratory"; readonly provider: "openai"; readonly modelId: typeof MODELS[number]; readonly servingProvider: null;
  readonly profileId: typeof PROFILE; readonly suiteId: string; readonly suiteSha256: string; readonly promptsSha256: string; readonly settingsId: string;
  readonly concurrency: 4; readonly reasoningEffort: "max"; readonly maxOutputTokens: 16384; readonly plannedTrials: 54;
}
export interface ReserveExperiment {
  readonly version: "1"; readonly kind: "conditional-reserve-exploration"; readonly frozenAt: string; readonly criteriaSha256: string;
  readonly gates: { readonly decisionSha256: string; readonly amendmentSha256: string; readonly proposalFileSha256: string; readonly independentReviewSha256: string; readonly referenceFingerprint: string };
  readonly accounting: ReservePriorAccounting; readonly accountingSha256: string;
  readonly population: { readonly suiteKey: "reserve-v1"; readonly baseSuiteId: string; readonly caseCount: 18; readonly families: 3; readonly relatedSourceGroups: 2 };
  readonly cells: readonly ReserveCell[];
  readonly budget: { readonly priorActualInferenceRequests: number; readonly maxNewInferenceRequests: 108; readonly cumulativeInferenceCeiling: number; readonly sharedInferenceCeiling: 8192;
    readonly parallelRuns: 2; readonly runConcurrency: 4; readonly maxConcurrency: 8; readonly retries: 0; readonly trialsPerCase: 3; readonly attemptsPerTrial: 1; readonly metadataTimeoutMs: 20000; readonly inferenceTimeoutMs: 180000 };
  readonly interpretation: { readonly population: "exploratory"; readonly ranked: false; readonly confidenceInterval: "unavailable"; readonly strongSignalEligible: false; readonly scope: string };
}
interface Status { id: string; state: "pending" | "active" | Exclude<RunState, "running" | "cancelling">; runId: string | null; progress: { planned: number; finished: number; inferenceRequests: number }; published: boolean; archived: boolean; error: string | null }

function assertInputs(data: ReserveInputs): void {
  const { accounting, suite, prompts } = data;
  if (qualityDataHash(data.decision) !== DECISION_SHA || qualityDataHash(data.amendment) !== AMENDMENT_SHA || data.proposalFileSha256 !== PROPOSAL_SHA
    || qualityDataHash(data.review) !== REVIEW_SHA || data.review.version !== "1" || data.review.kind !== "independent-reserve-runtime-review" || data.review.status !== "verified"
    || data.review.membershipFingerprint !== FINGERPRINT || data.review.findings.length !== 0 || data.review.coverage.canonicalReferences !== 18 || data.review.coverage.unresolvedPairs !== 0) throw new Error("The exact coordinator decision, amendment, unchanged proposal and independent reserve review are required.");
  if (data.p5Views.length !== 2 || data.decision.p5.cells.length !== 2) throw new Error("Both completed correct P5 public views are required.");
  for (const model of MODELS) {
    const declared = data.decision.p5.cells.find(cell => cell.requestedModelId === model), view = data.p5Views.find(view => view.record.request.modelId === model);
    if (!declared || !view || qualityDataHash(view) !== declared.publicViewSha256 || view.record.id !== declared.runId || !view.publishedAt || view.record.state !== "completed"
      || view.record.progress.activeTrials !== 0 || view.record.progress.plannedTrials !== 216 || view.record.results.length !== 216
      || view.record.results.some(row => row.result.failure !== null || row.result.evidence.outcome.kind !== "answer" || row.result.evidence.outcome.label !== view.record.suite.cases.find(entry => entry.id === row.caseId)?.label)) throw new Error("The decision-bound P5 snapshot must contain 216 correct valid labels per model and no failures.");
    auditRetainedMetrics(view.record);
  }
  if (suite.id !== SUITE_ID || qualityDataHash(suite) !== SUITE_SHA || data.baseSuiteId !== BASE_ID || suite.generatorVersion !== "reserve-v1" || suite.promptVersion !== "smooth-v2"
    || suite.cases.length !== 18 || new Set(suite.cases.map(entry => entry.family)).size !== 3 || new Set(suite.cases.map(entry => entry.clusterId)).size !== 2
    || qualityDataHash(suite.cases.map(({ family, reference, analyticCertificate }) => ({ family, reference, analyticCertificate }))) !== FINGERPRINT
    || qualityDataHash(prompts) !== PROMPTS_SHA || prompts.length !== 18 || prompts.some(prompt => prompt.profileId !== PROFILE || prompt.generation.reasoning !== "max" || prompt.generation.maxOutputTokens !== 16384)) throw new Error("The fixed 18-case reserve, reviewed references, max profile or exact prompts changed.");
  if (data.controls.length !== 183 || qualityDataHash(data.controls) !== CONTROLS_SHA || MODELS.some(model => !data.controls.some(control => control.modelId === model && control.effort === "max" && effortWasAccepted(control)))) throw new Error("Exact retained maximum-effort controls are required without new calls.");
  if (accounting.version !== "1" || accounting.kind !== "reconciled-inference-accounting" || accounting.inferenceCeiling !== 8192 || !Number.isFinite(Date.parse(accounting.checkedAt)) || Date.parse(accounting.checkedAt) > Date.now()
    || accounting.controls.path !== "apps/api/data/experiments/capabilities-v1.json" || accounting.controls.sha256 !== CONTROLS_SHA || accounting.controls.inferenceRequests !== 183 || accounting.earlierCalibrationAllowance !== 4
    || accounting.studies.length !== 4 || new Set(accounting.studies.map(study => study.key)).size !== 4 || data.priorStudies.length !== 4 || new Set(data.priorStudies.map(study => study.key)).size !== 4
    || Object.keys(SOURCES).some(key => !accounting.studies.some(study => study.key === key)) || !Number.isSafeInteger(accounting.totalPriorInferenceRequests) || accounting.totalPriorInferenceRequests > 7738
    || accounting.totalPriorInferenceRequests !== accounting.studies.reduce((sum, study) => sum + study.inferenceRequests, 187) || accounting.totalPriorInferenceRequests + 108 > 8192) throw new Error("Four terminal, reconciled earlier studies and the unchanged actual-send budget are required.");
  for (const study of accounting.studies) {
    const source = data.priorStudies.find(source => source.key === study.key), expected = SOURCES[study.key];
    if (!source || !["settled", "interrupted"].includes(source.ledger.state) || source.ledger.cells.some(cell => ["active", "running", "cancelling"].includes(cell.state))) throw new Error("Every earlier study, including the remaining-model supplement, must be terminal.");
    if (study.manifestPath !== `apps/api/data/experiments/${expected[0]}.json` || study.ledgerPath !== `apps/api/data/experiments/${expected[1]}.json` || study.manifestSha256 !== expected[2]
      || qualityDataHash(source.manifest) !== study.manifestSha256 || qualityDataHash(source.ledger) !== study.ledgerSha256 || source.ledger.manifestSha256 !== study.manifestSha256
      || qualityDataHash(source.reconciliation) !== study.reconciliationSha256 || source.reconciliation.sourceManifestSha256 !== study.manifestSha256 || source.reconciliation.sourceLedgerSha256 !== study.ledgerSha256
      || study.key === "original" && study.reconciliationSha256 !== "64aa79c95f178b3fa9ad78102c47d0fb0a0aefb5b94baf181a5e1960c39bfb65"
      || study.key === "interior" && study.ledgerSha256 !== data.decision.p5.ledgerSha256) throw new Error("The prior-study manifest, terminal ledger or reconciliation hash differs from its fixed lineage.");
    assertStudySendEvidence(study, source, accounting.checkedAt);
  }
}

export function createReserveExperiment(data: ReserveInputs): ReserveExperiment {
  assertInputs(data);
  const cells = MODELS.map(modelId => {
    const content = { phase: "exploratory" as const, provider: "openai" as const, modelId, servingProvider: null, profileId: PROFILE, suiteId: SUITE_ID, suiteSha256: SUITE_SHA, promptsSha256: PROMPTS_SHA,
      settingsId: deriveRunSettingsId({ profileId: PROFILE, concurrency: 4 }, data.prompts[0].generation), concurrency: 4 as const, reasoningEffort: "max" as const, maxOutputTokens: 16384 as const, plannedTrials: 54 as const } as const;
    return { id: `reserve-cell-${qualityDataHash(content)}`, ...content };
  });
  return snapshot({ version: "1", kind: "conditional-reserve-exploration", frozenAt: new Date().toISOString(), criteriaSha256: QUALITY_CRITERIA_SHA256,
    gates: { decisionSha256: DECISION_SHA, amendmentSha256: AMENDMENT_SHA, proposalFileSha256: PROPOSAL_SHA, independentReviewSha256: qualityDataHash(data.review), referenceFingerprint: FINGERPRINT },
    accounting: data.accounting, accountingSha256: qualityDataHash(data.accounting), population: { suiteKey: "reserve-v1", baseSuiteId: BASE_ID, caseCount: 18, families: 3, relatedSourceGroups: 2 }, cells,
    budget: { priorActualInferenceRequests: data.accounting.totalPriorInferenceRequests, maxNewInferenceRequests: 108, cumulativeInferenceCeiling: data.accounting.totalPriorInferenceRequests + 108, sharedInferenceCeiling: 8192,
      parallelRuns: 2, runConcurrency: 4, maxConcurrency: 8, retries: 0, trialsPerCase: 3, attemptsPerTrial: 1, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000 },
    interpretation: { population: "exploratory", ranked: false, confidenceInterval: "unavailable", strongSignalEligible: false,
      scope: "Adaptive follow-up after the disclosed amendment and completed P5 outcomes. Eighteen fixed tasks share two related groups; 54 fresh trials per model are descriptive. Eleven baseline remote outcomes remain unknown. No interval, ranking, inherited confirmation or stronger signal follows." } });
}

async function inputs(accounting: ReservePriorAccounting): Promise<ReserveInputs> {
  const artifact = async (path: string) => {
    if (!/^apps\/api\/data\/experiments\/[a-z0-9][a-z0-9-]*\.json$/.test(path)) throw new Error("Accounting sources must name experiment JSON artifacts.");
    return Bun.file(new URL(`../../../../${path}`, import.meta.url)).json();
  };
  const research = new URL("../../data/research/", import.meta.url), experiments = new URL("../../data/experiments/", import.meta.url);
  const decision = await Bun.file(new URL("conditional-reserve-decision-v1.json", research)).json() as Decision;
  const suite = await loadRunSuite("reserve-v1", PROFILE); if (suite.generatorVersion !== "reserve-v1") throw new Error("Reserve generator is unavailable.");
  return { accounting, suite, baseSuiteId: (await loadRunSuite("reserve-v1", "one-shot-json-v1")).id,
    prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), PROFILE, "smooth-v2"), decision,
    amendment: await Bun.file(new URL("conditional-reserve-amendment-v1.json", research)).json(), proposalFileSha256: createHash("sha256").update(new Uint8Array(await Bun.file(new URL("conditional-reserve-v1.json", research)).arrayBuffer())).digest("hex"),
    review: await Bun.file(new URL("../../data/quality/reserve-reference-review-v1.json", import.meta.url)).json(),
    controls: (await Bun.file(new URL("capabilities-v1.json", experiments)).json()).probes,
    p5Views: await Promise.all(decision.p5.cells.map(cell => Bun.file(new URL(`interior-progress-v1-published/${cell.runId}.json`, experiments)).json())),
    priorStudies: await Promise.all(accounting.studies.map(async study => ({ key: study.key, manifest: await artifact(study.manifestPath), ledger: await artifact(study.ledgerPath), reconciliation: await artifact(study.reconciliationPath), sendEvidence: await artifact(study.sendEvidencePath) }))) };
}

export async function freezeReserveExperiment(output: string, priorAccountingPath: string): Promise<ReserveExperiment> {
  if (await Bun.file(output).exists()) throw new Error("The reserve manifest already exists; choose a new path.");
  if (!priorAccountingPath) throw new Error("Terminal four-study actual-send accounting is required before reserve freeze.");
  const manifest = createReserveExperiment(await inputs(await Bun.file(priorAccountingPath).json()));
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 }); return manifest;
}

export function assertReserveRunReady(manifest: ReserveExperiment, data: ReserveInputs, policy: unknown, catalog: unknown): void {
  const recreated = createReserveExperiment(data), limits = policy as Record<string, unknown>, choices = catalog as { suites?: readonly { key: string; suiteId: string; caseCount: number; generatorVersion: string }[] };
  if (qualityDataHash({ ...recreated, frozenAt: manifest.frozenAt }) !== qualityDataHash(manifest) || !Number.isFinite(Date.parse(manifest.frozenAt)) || Date.parse(manifest.frozenAt) > Date.now()
    || Date.parse(manifest.frozenAt) < Date.parse(data.accounting.checkedAt)) throw new Error("Frozen reserve identities, review, chronology or accounting changed.");
  if (!limits || limits.policyId !== "foreground-runs-v1" || limits.trialsPerInstance !== 3 || limits.attemptsPerTrial !== 1 || limits.retries !== 0 || limits.maxActiveRuns !== 4 || limits.maxConcurrency !== 12
    || limits.metadataTimeoutMs !== 20000 || limits.inferenceTimeoutMs !== 180000 || choices?.suites?.length !== 6 || !choices.suites.some(suite => suite.key === "reserve-v1" && suite.suiteId === BASE_ID && suite.caseCount === 18 && suite.generatorVersion === "reserve-v1")) throw new Error("The running API must advertise six suites and the exact reserve execution policy.");
}

export function assertReserveView(cell: ReserveCell, view: RunView, runId: string, frozenAt: string, published = false): void {
  const record = view.record;
  if (Object.keys(view).sort().join(",") !== "publishedAt,record" || record.id !== runId || record.request.suiteKey !== "reserve-v1" || record.request.modelId !== cell.modelId || record.request.provider !== "openai" || record.request.servingProvider !== null
    || record.request.profileId !== PROFILE || record.request.concurrency !== 4 || record.suite.id !== SUITE_ID || qualityDataHash(record.suite) !== SUITE_SHA || qualityDataHash(record.prompts) !== PROMPTS_SHA || record.evidence.model.settingsId !== cell.settingsId
    || !Number.isFinite(Date.parse(record.createdAt)) || Date.parse(record.createdAt) < Date.parse(frozenAt) || record.workload.logicalCalls !== 54 || record.progress.plannedTrials !== 54 || record.progress.activeTrials !== 0 || ["running", "cancelling"].includes(record.state)
    || record.results.some(row => !Number.isFinite(Date.parse(row.result.startedAt)) || Date.parse(row.result.startedAt) < Date.parse(frozenAt))) throw new Error("Retained reserve execution differs from its frozen 54-trial cell.");
  const trials = new Set<string>(); let sends = 0;
  for (const row of record.results) {
    const key = `${row.caseId}:${row.trialIndex}`;
    if (!record.suite.cases.some(entry => entry.id === row.caseId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2 || trials.has(key) || ![0, 1].includes(row.result.inferenceRequests)
      || row.result.requested.modelId !== cell.modelId || row.result.requested.profileId !== PROFILE) throw new Error("Reserve attempt identity, denominator or one-attempt policy changed.");
    trials.add(key); sends += row.result.inferenceRequests;
  }
  if (record.results.length !== record.progress.finishedTrials || sends !== record.progress.inferenceRequests || sends > 54) throw new Error("Reserve retained attempt and send counts disagree.");
  if (record.state === "completed" && (record.results.length !== 54 || record.report?.overall.classification.population.status !== "complete")) throw new Error("A complete, qualified 54-trial reserve view is required.");
  if (published && (!view.publishedAt || !Number.isFinite(Date.parse(view.publishedAt)) || Date.parse(view.publishedAt) < Date.parse(frozenAt) || record.state !== "completed")) throw new Error("A complete, explicit reserve public view is required.");
  if (record.state === "completed") auditRetainedMetrics(record);
}

export async function storeReserveJson(path: string, value: unknown, credential: string, replace = false): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`; if (reflectsCredential(text, credential)) throw new Error("Unsafe reserve evidence.");
  const temporary = replace ? `${path}.${randomUUID()}.tmp` : path;
  await writeFile(temporary, text, { flag: "wx", mode: 0o600 }); if (replace) await rename(temporary, path);
}
type Receipt = { runId: string; accessCode: string };
export function retainReserveReceipt(root: string, receipts: Record<string, Receipt>, cellId: string, receipt: Receipt, credential: string): void {
  if (Object.values(receipts).some(saved => saved.accessCode === receipt.accessCode)) throw new Error("A private reserve access code was repeated.");
  retainRemainingReceipt(root, receipts, cellId, receipt, credential);
}
export function reserveCellsComplete(statuses: readonly Pick<Status, "state" | "error" | "published" | "archived">[], publish: boolean): boolean {
  return statuses.length === 2 && statuses.every(cell => cell.state === "completed" && cell.error === null && (!publish || cell.published && cell.archived));
}

export async function runReserveExperiment(manifestPath: string, output: string, credential: string, acceptCharges: boolean, publish: boolean): Promise<void> {
  if (!acceptCharges || !credential) throw new Error("An explicit credential and provider-charge acknowledgement are required.");
  const manifest = await Bun.file(manifestPath).json() as ReserveExperiment, data = await inputs(manifest.accounting);
  const [policy, catalog] = await Promise.all(["policy", "suites"].map(async route => readApplicationJson(await fetch(`${LOCAL_API}/runs/${route}`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }))));
  assertReserveRunReady(manifest, data, policy, catalog);
  const paths = experimentPaths(output), root = paths.privateRoot, publicRoot = `${paths.output.slice(0, -5)}-published`, archiveSourcePath = `${paths.output.slice(0, -5)}-archive-source.json`;
  if (publish) for (const target of [publicRoot, archiveSourcePath]) {
    try { await lstat(target); throw new Error("The reserve archive or retained source already exists; choose a new output identity."); }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  }
  await mkdir(new URL("../../data/private/", import.meta.url), { recursive: true, mode: 0o700 }); await mkdir(root, { mode: 0o700 }); await mkdir(`${root}records`, { mode: 0o700 });
  await writeFile(paths.output, "{}\n", { flag: "wx", mode: 0o600 }); await writeFile(`${root}access.json`, "{}\n", { flag: "wx", mode: 0o600 });
  const statuses: Status[] = manifest.cells.map(cell => ({ id: cell.id, state: "pending", runId: null, progress: { planned: 54, finished: 0, inferenceRequests: 0 }, published: false, archived: false, error: null }));
  const receipts: Record<string, Receipt> = {}, retained = new Map<string, RunView>(), controller = new AbortController(), stop = () => controller.abort(), startedAt = new Date().toISOString(); let checkpoint = Promise.resolve();
  const ledger = () => ({ version: "1" as const, kind: "conditional-reserve-progress", manifestSha256: qualityDataHash(manifest), startedAt, updatedAt: new Date().toISOString(),
    state: controller.signal.aborted ? "interrupted" : statuses.some(cell => ["active", "pending"].includes(cell.state)) ? "running" : "settled", capabilityCallsThisExecution: 0, budget: manifest.budget, cells: statuses, interpretation: manifest.interpretation });
  const save = () => { checkpoint = checkpoint.then(() => storeReserveJson(paths.output, ledger(), credential, true)).catch(() => { controller.abort(); throw new Error("Reserve checkpoint could not be retained."); }); return checkpoint; };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    await storeReserveJson(paths.capabilities, { version: "1", manifestSha256: qualityDataHash(manifest), boundAt: startedAt, newRequests: 0, probes: data.controls }, credential); await save();
    const workers = await Promise.allSettled(manifest.cells.map(async (cell, index) => {
      const status = statuses[index]; status.state = "active"; await save(); let receipt: Receipt | null = null, lastSave = 0;
      const observe = (event: RunEvent) => {
        if (event.type === "started") { receipt = { runId: event.runId, accessCode: event.accessCode }; status.runId = event.runId; try { retainReserveReceipt(root, receipts, cell.id, receipt, credential); } catch { controller.abort(); throw new Error("Reserve receipt could not be retained."); } }
        if ("progress" in event) status.progress = { planned: event.progress.plannedTrials, finished: event.progress.finishedTrials, inferenceRequests: event.progress.inferenceRequests };
        if (event.type === "started" || Date.now() - lastSave >= 5000) { lastSave = Date.now(); void save().catch(() => {}); }
      };
      try { await launchForegroundRun({ suiteKey: "reserve-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: PROFILE, concurrency: 4, acceptCharges: true }, credential, controller.signal, observe); }
      catch { status.error = "The foreground stream did not establish a terminal outcome; no replacement inference was started."; controller.abort(); }
      const saved = receipt as Receipt | null; if (!saved) { status.state = "interrupted"; controller.abort(); await save(); return; }
      try {
        const view = await readSettledPrivateRun(saved.runId, saved.accessCode, credential); await storeReserveJson(`${root}records/${saved.runId}.json`, view, credential); assertReserveView(cell, view, saved.runId, manifest.frozenAt); retained.set(saved.runId, view);
        status.state = view.record.state; status.progress = { planned: 54, finished: view.record.progress.finishedTrials, inferenceRequests: view.record.progress.inferenceRequests };
        if (matrixFailureRequiresStop(view.record)) controller.abort(); if (status.state !== "completed") status.error = "Incomplete reserve execution remains retained with its original denominator.";
        if (publish && status.state === "completed") { await readApplicationJson(await fetch(`${LOCAL_API}/runs/${saved.runId}/publication`, { method: "POST", headers: { Authorization: `Bearer ${saved.accessCode}`, "Content-Type": "application/json" }, body: '{"published":true}', cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) }), credential); status.published = true; }
      } catch { if (status.state === "active") status.state = "interrupted"; status.error = "Private receipt retained; settlement, storage, identity or publication requires inspection before further paid work."; controller.abort(); }
      await save(); console.log(JSON.stringify({ phase: "conditional-reserve", modelId: cell.modelId, state: status.state, ...status.progress, published: status.published }));
    }));
    await save();
    if (publish) {
      // The archive binds this retained snapshot; final progress will subsequently add archive outcomes.
      const archiveSource = snapshot(ledger());
      await storeReserveJson(archiveSourcePath, archiveSource, credential);
      const index = await archivePublishedExperiment(manifest, archiveSource, publicRoot, async (url, options) => {
        const view = await readApplicationJson(await fetch(url, options), credential) as RunView, cell = manifest.cells.find(cell => statuses.find(status => status.id === cell.id)?.runId === view.record.id);
        if (!cell || !retained.has(view.record.id) || qualityDataHash(view.record) !== qualityDataHash(retained.get(view.record.id)!.record) || Object.values(receipts).some(receipt => reflectsCredential(JSON.stringify(view), receipt.accessCode))) throw new Error("Public reserve evidence differs from its settled private execution.");
        assertReserveView(cell, view, view.record.id, manifest.frozenAt, true); return Response.json(view);
      });
      for (const record of index.records) statuses.find(cell => cell.id === record.cellId)!.archived = true; await save();
    }
    if (workers.some(worker => worker.status === "rejected") || controller.signal.aborted || !reserveCellsComplete(statuses, publish)) throw new Error("The reserve or requested publication/archive did not complete; no replacement work was scheduled.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

export function parseReserveArguments(args: readonly string[]) {
  const command = args[0], values = new Map<string, string>(); let acceptCharges = false, publish = false;
  if (command !== "freeze" && command !== "run") throw new Error("Use freeze or run.");
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (command === "run" && arg === "--accept-charges" && !acceptCharges) acceptCharges = true;
    else if (command === "run" && arg === "--publish" && !publish) publish = true;
    else if ((arg === "--output" || command === "freeze" && arg === "--prior-accounting" || command === "run" && arg === "--manifest") && !values.has(arg) && args[i + 1] && !args[i + 1].startsWith("--")) values.set(arg, args[++i]);
    else throw new Error("Use freeze --prior-accounting <terminal-artifact> --output <new-manifest>, or run --manifest <file> --output <new-ledger> --accept-charges [--publish].");
  }
  const output = values.get("--output"), manifest = values.get("--manifest"), priorAccounting = values.get("--prior-accounting");
  if (!output || command === "freeze" && !priorAccounting || command === "run" && (!manifest || !acceptCharges)) throw new Error("A new output, terminal accounting for freeze, and explicit manifest/charge consent for execution are required.");
  return { command, output, manifest, priorAccounting, acceptCharges, publish };
}
if (import.meta.main) {
  try { const args = parseReserveArguments(Bun.argv.slice(2)); if (args.command === "freeze") { const manifest = await freezeReserveExperiment(args.output, args.priorAccounting!); console.log(JSON.stringify({ manifestSha256: qualityDataHash(manifest), frozenAt: manifest.frozenAt, cells: manifest.cells.length, budget: manifest.budget })); }
    else await runReserveExperiment(args.manifest!, args.output, process.env.OPENAI_API_KEY ?? "", args.acceptCharges, args.publish);
  } catch { console.error("The reserve operator did not complete. Inspect gates, terminal lineage, retained receipts and outcomes before additional paid work; earlier studies were not changed."); process.exitCode = 1; }
}
