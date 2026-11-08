// An explicit private research workflow freezes, replays, dispatches and reviews one panel at a time.
import { mkdir, mkdtemp, readdir, readFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { prepareImportedPanel, replayImportedPanel, importImplementation, checkImportExposure } from "./admission";
import { acquireStudyLock, releaseDeadStudyLock, retainImportBundle, writeArtifact } from "./artifacts";
import { assertFrozenPanel, executePanel, freezePanel, nextSearchDecision, PILOT_POLICY, pilotHash, reviewPanel, scoreSearchResults } from "./pilot";
import { readBoundedFile, sha256, SOURCE_REVISION } from "./source";
import type { FrozenPanel, PanelResult, PanelReview, PriorDispatch, ReviewedPanel } from "./types";
import { reflectsCredential } from "../providers/responses";

const root = new URL("../../data/private/randomized-v1/", import.meta.url).pathname;
const repository = new URL("../../../../", import.meta.url).pathname;
const save = writeArtifact;
const json = async <T>(path: string): Promise<T> => JSON.parse(await readBoundedFile(path));
const panelDirectory = (ordinal: number) => join(root, `panel-${ordinal}`);

async function implementation() {
  const files = ["bun.lock", "patches/openai@7.53.0.patch"];
  for await (const path of new Bun.Glob("apps/api/src/**/*.ts").scan({ cwd: repository })) if (!path.endsWith(".test.ts")) files.push(path);
  files.sort();
  return { ...await importImplementation(), ...Object.fromEntries(await Promise.all(files.map(async path => [path, sha256(await readFile(join(repository, path)))]))) };
}

interface Rule {
  version: "1"; methodId: typeof PILOT_POLICY.methodId; frozenAt: string; policy: typeof PILOT_POLICY;
  sourceRevision: string; implementation: Record<string, string>; priorDevelopmentSends: 0; probeSends: 0;
  generation: { seedRule: string; perClass: 2; batches: 4; dimension: 1; maxChildren: 2; attemptsPerInstance: 20 };
  depthRule: readonly [216, 512, 1000]; domain: { min: "-1"; max: "1" };
}

async function rule(): Promise<Rule> {
  const value = await json<Rule>(join(root, "search-rule.json"));
  if (value.version !== "1" || value.methodId !== PILOT_POLICY.methodId || value.sourceRevision !== SOURCE_REVISION ||
    value.priorDevelopmentSends !== 0 || value.probeSends !== 0 || pilotHash(value.policy) !== pilotHash(PILOT_POLICY) ||
    pilotHash(value.implementation) !== pilotHash(await implementation()) || pilotHash(value.depthRule) !== pilotHash([216, 512, 1000]) ||
    pilotHash(value.domain) !== pilotHash({ min: "-1", max: "1" }) ||
    pilotHash(value.generation) !== pilotHash({ seedRule: "140000+100*panelOrdinal+batchOrdinal", perClass: 2, batches: 4, dimension: 1, maxChildren: 2, attemptsPerInstance: 20 }))
    throw new Error("Frozen search sources, budget or generation settings changed; do not start further paid work.");
  return value;
}

async function history(): Promise<{ reviewed: ReviewedPanel[]; results: PanelResult[]; receipts: PriorDispatch[]; pending: number[] }> {
  const directories = (await readdir(root)).filter(name => /^panel-[1-9]$/.test(name)).sort();
  const reviewed: ReviewedPanel[] = [], results: PanelResult[] = [], receipts: PriorDispatch[] = [], pending: number[] = [];
  for (const name of directories) {
    const directory = join(root, name), files = await readdir(directory);
    const binding = await json<{ bundlePath: string; bundleSha256: string }>(join(directory, "binding.json"));
    if (binding.bundlePath !== "admission/admission.json" || pilotHash(await replayImportedPanel(join(directory, binding.bundlePath))) !== binding.bundleSha256)
      throw new Error("The retained source evidence is unavailable or changed; the study cannot advance.");
    for (const file of files.filter(name => /^dispatch-\d+\.json$/.test(name))) receipts.push(await json<PriorDispatch>(join(directory, file)));
    const result = files.includes("panel-result.json") ? await json<PanelResult>(join(directory, "panel-result.json")) : null;
    if (result) results.push(result);
    if (files.includes("review.json") && result) {
      reviewed.push(reviewPanel(result, await json<PanelReview>(join(directory, "review.json"))));
    } else pending.push(Number(name.slice(6)));
  }
  receipts.sort((a, b) => a.ordinal - b.ordinal);
  if (receipts.some((receipt, index) => receipt.ordinal !== index + 1) || new Set(receipts.map(row => row.dispatchId)).size !== receipts.length || receipts.length > 30)
    throw new Error("Private dispatch receipts do not form a unique contiguous allowance ledger.");
  for (const result of results) {
    const frozen = await json<FrozenPanel>(join(panelDirectory(result.panel.ordinal), "frozen-panel.json"));
    if (pilotHash(result.panel) !== pilotHash(frozen) || result.rows.some(row => row.dispatch && !receipts.some(receipt => pilotHash(receipt) === pilotHash(row.dispatch))))
      throw new Error("A retained panel result lost its frozen identity or original dispatch receipt.");
  }
  return { reviewed, results, receipts, pending };
}

export async function randomizedCli(args: readonly string[]) {
  const [command, ...rest] = args;
  if (!["prepare", "replay", "init", "status", "freeze", "run", "review", "unlock"].includes(command)) throw new Error("Use prepare, replay, init, status, freeze, run, review or unlock.");
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!/^--[a-z-]+$/.test(rest[i]) || !rest[i + 1] || rest[i + 1].startsWith("--") || flags.has(rest[i])) throw new Error("Supply unique named flags with explicit values.");
    flags.set(rest[i], rest[i + 1]);
  }
  const requireFlags = (...names: string[]) => { if (flags.size !== names.length || names.some(name => !flags.has(name))) throw new Error(`Expected flags: ${names.join(", ") || "none"}.`); };
  if (command === "prepare") {
    requireFlags("--checkout", "--python", "--output", "--depth", "--panel");
    const controller = new AbortController(), stop = () => controller.abort();
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    try {
      const bundle = await prepareImportedPanel({ checkout: flags.get("--checkout")!, python: flags.get("--python")!, output: flags.get("--output")!, requestedDepth: Number(flags.get("--depth")), panelOrdinal: Number(flags.get("--panel")), signal: controller.signal });
      return { state: bundle.state, accepted: bundle.accepted.length, proposals: bundle.candidates.length, bundleSha256: pilotHash(bundle), inferenceSends: 0 };
    } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
  }
  if (command === "replay") {
    requireFlags("--bundle"); const bundle = await replayImportedPanel(resolve(flags.get("--bundle")!), undefined, false);
    return { state: bundle.state, referenceReplay: "pass", cases: bundle.accepted.length, bundleSha256: pilotHash(bundle) };
  }
  if (command === "init") {
    requireFlags();
    const sources = await implementation();
    await mkdir(dirname(root.replace(/\/$/, "")), { recursive: true, mode: 0o700 });
    await mkdir(root, { recursive: false, mode: 0o700 });
    const value: Rule = { version: "1", methodId: PILOT_POLICY.methodId, frozenAt: new Date().toISOString(), policy: PILOT_POLICY,
      sourceRevision: SOURCE_REVISION, implementation: sources, priorDevelopmentSends: 0, probeSends: 0,
      generation: { seedRule: "140000+100*panelOrdinal+batchOrdinal", perClass: 2, batches: 4, dimension: 1, maxChildren: 2, attemptsPerInstance: 20 }, depthRule: [216, 512, 1000], domain: { min: "-1", max: "1" } };
    await save(join(root, "search-rule.json"), value);
    return { state: "frozen", methodId: value.methodId, maxDevelopmentSends: 30 };
  }
  if (command === "unlock") { requireFlags(); return releaseDeadStudyLock(root); }
  const frozen = await rule();
  if (command === "status") {
    requireFlags(); const state = await history();
    const decision = state.pending.length ? { action: "stop", reason: "pending-panel-or-review", panels: state.pending }
      : nextSearchDecision(state.reviewed, frozen);
    return { decision, conservativeSends: state.receipts.length, remainingSends: 30 - state.receipts.length,
      scores: scoreSearchResults(state.results) };
  }
  if (command === "freeze") {
    requireFlags("--bundle", "--review");
    const release = await acquireStudyLock(root);
    try {
    const state = await history(); if (state.pending.length) throw new Error("Settle and independently review the pending panel before freezing another.");
    const decision = nextSearchDecision(state.reviewed, frozen);
    if (decision.action !== "query") throw new Error(`Frozen search stops: ${decision.reason}.`);
    const path = resolve(flags.get("--bundle")!), bundle = await replayImportedPanel(path);
    const admissionReview = await json<{ verdict: string; bundleSha256: string; reviewer: string; reviewedAt: string }>(resolve(flags.get("--review")!));
    if (admissionReview.verdict !== "pass" || admissionReview.bundleSha256 !== pilotHash(bundle) || !admissionReview.reviewer?.trim() ||
      !Number.isFinite(Date.parse(admissionReview.reviewedAt)) || Date.parse(admissionReview.reviewedAt) < Date.parse(bundle.createdAt) ||
      bundle.requestedDepth !== decision.requestedDepth || bundle.panelOrdinal !== state.reviewed.length + 1)
      throw new Error("A current independent admission review for the next exact panel is required.");
    const priorExposure = [];
    for (const earlier of state.reviewed) priorExposure.push((await replayImportedPanel(join(panelDirectory(earlier.result.panel.ordinal), "admission/admission.json"))).exposure);
    const overlap = checkImportExposure(bundle.accepted, priorExposure);
    if (overlap.exactMatches.length || overlap.relatedCores.length) throw new Error("The next panel repeats an exposed question or significant core.");
    const panel = freezePanel(bundle.accepted, { ordinal: bundle.panelOrdinal, requestedDepth: bundle.requestedDepth,
      sourceSha256: pilotHash(bundle), admissionReviewSha256: pilotHash(admissionReview) });
    const temporary = await mkdtemp(join(root, `.freezing-${panel.ordinal}-`));
    await retainImportBundle(path, join(temporary, "admission"), bundle);
    if (pilotHash(await replayImportedPanel(join(temporary, "admission/admission.json"))) !== pilotHash(bundle)) throw new Error("Retained source copy failed independent replay.");
    await save(join(temporary, "binding.json"), { bundlePath: "admission/admission.json", bundleSha256: pilotHash(bundle), admissionReview, searchRuleSha256: pilotHash(frozen), exposureCheck: overlap });
    await save(join(temporary, "frozen-panel.json"), panel);
    await rename(temporary, panelDirectory(panel.ordinal));
    return { state: "panel-frozen", panelId: panel.id, requestedDepth: panel.requestedDepth, questions: 3 };
    } finally { await release(); }
  }
  if (command === "run") {
    requireFlags("--panel", "--accept-charges");
    if (flags.get("--accept-charges") !== "true") throw new Error("Explicit provider charge approval is required.");
    const release = await acquireStudyLock(root);
    const controller = new AbortController(), stop = () => controller.abort();
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    try {
      const ordinal = Number(flags.get("--panel")), state = await history(), decision = nextSearchDecision(state.reviewed, frozen);
      if (!Number.isSafeInteger(ordinal) || state.pending.length !== 1 || state.pending[0] !== ordinal || ordinal !== state.reviewed.length + 1 || decision.action !== "query") throw new Error("Exactly the next frozen unattempted panel must be pending.");
      const directory = panelDirectory(ordinal), files = await readdir(directory);
      if (files.some(name => name.startsWith("dispatch-") || name.startsWith("result-") || name === "panel.json" || name === "panel-result.json")) throw new Error("This panel was already started; reconcile it without rerunning paid work.");
      const panel = await json<FrozenPanel>(join(directory, "frozen-panel.json")); assertFrozenPanel(panel);
      const binding = await json<{ bundlePath: string; bundleSha256: string; admissionReview: unknown; searchRuleSha256: string }>(join(directory, "binding.json"));
      if (binding.bundlePath !== "admission/admission.json") throw new Error("A retained panel-local source binding is required.");
      const bundle = await replayImportedPanel(join(directory, binding.bundlePath), controller.signal);
      if (binding.searchRuleSha256 !== pilotHash(frozen) || binding.bundleSha256 !== pilotHash(bundle) || panel.sourceSha256 !== pilotHash(bundle) ||
        panel.admissionReviewSha256 !== pilotHash(binding.admissionReview) || pilotHash(panel.cases) !== pilotHash(bundle.accepted) || panel.requestedDepth !== decision.requestedDepth)
        throw new Error("Frozen source/admission/search bindings changed.");
      const credential = process.env.OPENAI_API_KEY ?? "";
      const result = await executePanel(panel, { credential, acceptCharges: true, priorDispatches: state.receipts, signal: controller.signal,
        persist: async (name, value) => { if (reflectsCredential(JSON.stringify(value), credential)) throw new Error("Unsafe retained evidence."); await save(join(directory, name), value); } });
      return { state: "awaiting-independent-review", panelId: panel.id, dispatches: result.dispatches, unknownRemoteOutcomes: result.unknownRemoteOutcomes, scores: result.scores };
    } finally { controller.abort(); await release(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
  }
  if (command === "review") {
    requireFlags("--panel", "--review");
    const ordinal = Number(flags.get("--panel")); if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 9) throw new Error("Invalid panel ordinal.");
    const result = await json<PanelResult>(join(panelDirectory(ordinal), "panel-result.json")), review = await json<PanelReview>(resolve(flags.get("--review")!));
    const checked = reviewPanel(result, review); await save(join(panelDirectory(ordinal), "review.json"), review);
    return { state: "reviewed", status: checked.status, panelId: result.panel.id };
  }
  throw new Error("Use prepare, replay, init, freeze, run, review or status with explicit named arguments.");
}

if (import.meta.main) {
  try { console.log(JSON.stringify(await randomizedCli(Bun.argv.slice(2)))); }
  catch (error) { console.error(error instanceof Error ? error.message : "The research operation failed; inspect retained evidence."); process.exitCode = 1; }
}
