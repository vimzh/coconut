// Runs a separately frozen, unranked depth-60 pilot through the existing bounded inference and scoring paths.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient, type InferenceResult } from "../inference";
import { buildPrompt } from "../protocol";
import { qualityDataHash } from "../quality";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { scoreEvaluation } from "../scoring/scorer";
import { validateFrozenSuite } from "../suites";
import type { FrozenSuite } from "../suites/types";

const ROOT = new URL("../../data/", import.meta.url);
const SUITE = new URL("suites/depth60-v1.json", ROOT);
const REVIEW = new URL("quality/depth60-reference-review-v1.json", ROOT);
export const DEPTH60_MODELS = Object.freeze(["gpt-4.1-mini", "gpt-4o-mini"] as const);
export const DEPTH60_ADDITIONAL_MODELS = Object.freeze(["gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.6-luna", "gpt-6-luna"] as const);
export type Depth60Study = "pilot" | "additional";
const STUDIES = Object.freeze({
  pilot: Object.freeze({ methodId: "depth60-pilot-v1", stem: "depth60", models: DEPTH60_MODELS, prior: 7854, maximum: 54, cumulative: 7908, initial: 2 }),
  additional: Object.freeze({ methodId: "depth60-additional-v1", stem: "depth60-additional", models: DEPTH60_ADDITIONAL_MODELS, prior: 7962, maximum: 108, cumulative: 8070, initial: 4 }),
});
const configuration = (study: Depth60Study) => { if (study !== "pilot" && study !== "additional") throw new Error("Choose a fixed depth-60 study."); return STUDIES[study]; };
const paths = (study: Depth60Study) => { const { stem } = configuration(study); return { manifest: new URL(`experiments/${stem}-matrix-v1.json`, ROOT), progress: new URL(`experiments/${stem}-progress-v1.json`, ROOT), private: new URL(`private/${stem}-v1/`, ROOT) }; };
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const json = async (path: URL) => JSON.parse(await readFile(path, "utf8"));
export interface Depth60Row { readonly modelId: string; readonly caseId: string; readonly trialIndex: number; dispatched: boolean; result: InferenceResult | null }
interface Depth60Report { readonly modelId: string; readonly report: Awaited<ReturnType<typeof scoreEvaluation>> }
interface PilotResult { readonly methodId: string; readonly manifestSha256: string; readonly inferenceRequests: number; readonly cumulativeConservativeRequests: number; readonly rows: readonly Depth60Row[]; readonly reports: readonly Depth60Report[] }

export function checkDepth60Suite(suite: FrozenSuite): void {
  if (suite.request.seed !== "coconut-depth60-pilot-v1" || suite.request.profileId !== "one-shot-json-v1" || suite.request.purpose !== "evaluation"
    || suite.request.depths.length !== 1 || suite.request.depths[0] !== 60 || suite.cases.length !== 9
    || suite.cases.some(row => row.depth !== 60 || row.certificate.depth !== 60)
    || ["convex", "concave", "neither"].some(label => suite.cases.filter(row => row.label === label).length !== 3)) {
    throw new Error("The depth-60 pilot requires its frozen balanced nine-case exact suite.");
  }
}

async function freezeInputs(study: Depth60Study = "pilot") {
  const suiteText = await readFile(SUITE, "utf8"), suite = await validateFrozenSuite(JSON.parse(suiteText));
  checkDepth60Suite(suite);
  const reviewText = await readFile(REVIEW, "utf8"), review = JSON.parse(reviewText);
  if (review.suiteFileSha256 !== sha(suiteText) || review.verdict !== "pass" || review.cases.length !== 9) throw new Error("A matching independent reference review is required before inference.");
  const priorText = await readFile(new URL("experiments/long-reserve-progress-v1.json", ROOT), "utf8"), prior = JSON.parse(priorText);
  if (prior.state !== "settled" || prior.inferenceRequests !== 108 || prior.budget.cumulativeInferenceCeiling !== 7854) throw new Error("Terminal prior-study accounting is required.");
  const bindings: Record<string, string> = { suiteId: suite.id, suiteFileSha256: sha(suiteText), reviewFileSha256: sha(reviewText), priorProgressFileSha256: sha(priorText) };
  if (study === "additional") {
    const pilot = paths("pilot"), [manifestText, progressText, resultText, auditText] = await Promise.all([readFile(pilot.manifest, "utf8"), readFile(pilot.progress, "utf8"), readFile(new URL("result.json", pilot.private), "utf8"), readFile(new URL("quality/depth60-results-audit-v1.json", ROOT), "utf8")]);
    const manifest = JSON.parse(manifestText), progress = JSON.parse(progressText), result = JSON.parse(resultText), audit = JSON.parse(auditText);
    assertDepth60Manifest(manifest, suite, bindings, "pilot");
    checkDepth60PriorPilot(suite, manifest, result, progress, audit, resultText);
    Object.assign(bindings, { originalPilotManifestFileSha256: sha(manifestText), originalPilotProgressFileSha256: sha(progressText), originalPilotResultFileSha256: sha(resultText), originalPilotAuditFileSha256: sha(auditText), promptsSha256: sha(JSON.stringify(suite.cases.map(entry => buildPrompt(entry.reference, "one-shot-json-v1")))) });
    const [depth100ManifestText, depth100ProgressText, depth100ResultText, populationText, depth100ReviewText] = await Promise.all([
      readFile(new URL("experiments/depth100-matrix-v1.json", ROOT), "utf8"), readFile(new URL("experiments/depth100-progress-v1.json", ROOT), "utf8"), readFile(new URL("private/depth100-v1/result.json", ROOT), "utf8"),
      readFile(new URL("research/depth100-population-v1.json", ROOT), "utf8"), readFile(new URL("quality/depth100-reference-review-v1.json", ROOT), "utf8"),
    ]);
    if (sha(depth100ProgressText) !== "1a7fae6dde2c7f7328169e84cced636feaf6fb692664e887194e01196f72f4fd" || sha(depth100ResultText) !== "a85c6fa9ef169d6525cb85d6472c6c4233a79fe5fd51c16c685021c8ed7f5876") throw new Error("The coordinated terminal depth-100 evidence changed.");
    checkDepth100Gate(JSON.parse(populationText), JSON.parse(depth100ManifestText), JSON.parse(depth100ResultText), JSON.parse(depth100ProgressText), { priorProgress: sha(progressText), population: sha(populationText), review: sha(depth100ReviewText) });
    Object.assign(bindings, { depth100ManifestFileSha256: sha(depth100ManifestText), depth100ProgressFileSha256: sha(depth100ProgressText), depth100ResultFileSha256: sha(depth100ResultText), depth100FinishedAt: JSON.parse(depth100ProgressText).finishedAt });
  }
  return { suite, bindings };
}

export function createDepth60Manifest(suite: FrozenSuite, bindings: Readonly<Record<string, string>>, study: Depth60Study = "pilot", frozenAt = new Date().toISOString()) {
  checkDepth60Suite(suite); const config = configuration(study);
  const required = ["suiteFileSha256", "reviewFileSha256", "priorProgressFileSha256", ...(study === "additional" ? ["originalPilotManifestFileSha256", "originalPilotProgressFileSha256", "originalPilotResultFileSha256", "originalPilotAuditFileSha256", "promptsSha256", "depth100ManifestFileSha256", "depth100ProgressFileSha256", "depth100ResultFileSha256"] : [])];
  if (bindings.suiteId !== suite.id || required.some(key => !/^[a-f0-9]{64}$/.test(bindings[key] ?? "")) || study === "additional" && (bindings.promptsSha256 !== sha(JSON.stringify(suite.cases.map(entry => buildPrompt(entry.reference, "one-shot-json-v1")))) || !Number.isFinite(Date.parse(bindings.depth100FinishedAt)) || Date.parse(frozenAt) < Date.parse(bindings.depth100FinishedAt))) throw new Error("Complete frozen source, exact prompt and terminal chronology bindings are required.");
  return { version: "1", methodId: config.methodId, frozenAt, ...bindings,
    models: config.models, profileId: "one-shot-json-v1", cases: 9, trialsPerCase: 3, maxInferenceRequests: config.maximum,
    priorInferenceRequests: config.prior, cumulativeInferenceCeiling: config.cumulative, sharedCeiling: 8192,
    maxConcurrency: 12, initialConcurrency: config.initial, retries: 0, inferenceDeadlineMs: 180000, maxOutputTokens: 4096,
    interpretation: study === "pilot" ? "Exploratory, unranked exact-envelope tasks. Structural depth also changes expression length and active pieces; no causal depth, frontier-failure or independent-family claim."
      : "Exploratory follow-up after the two-model pilot was inspected. The identical nine tasks and three fresh trials per model remain unranked. Provider-default reasoning may differ by model; no equal-compute, causal depth, general failure threshold or independent-family claim." };
}
export function assertDepth60Manifest(manifest: ReturnType<typeof createDepth60Manifest>, suite: FrozenSuite, bindings: Readonly<Record<string, string>>, study: Depth60Study = "pilot"): void {
  const expected = createDepth60Manifest(suite, bindings, study, manifest.frozenAt);
  if (!Number.isFinite(Date.parse(manifest.frozenAt)) || Date.parse(manifest.frozenAt) > Date.now() || qualityDataHash(expected) !== qualityDataHash(manifest)
    || expected.priorInferenceRequests + expected.maxInferenceRequests !== expected.cumulativeInferenceCeiling || expected.cumulativeInferenceCeiling > expected.sharedCeiling) throw new Error("The frozen depth-60 configuration, identities or complete budget changed.");
}
export function checkDepth60PriorPilot(suite: FrozenSuite, manifest: unknown, retained: PilotResult, progress: { rows: readonly { modelId: string; caseId: string; trialIndex: number; resultSha256: string | null; outcome: string; failure: unknown }[] } & Omit<PilotResult, "rows">,
  audit: { verdict: string; sourceFileSha256: string; inferenceRequests: number; cumulativeConservativeRequests: number; models: readonly { modelId: string; planned: number; correct: number; macroF1: number }[] }, retainedText: string): void {
  const members = new Set(suite.cases.map(entry => entry.id)), byTrial = new Map(retained.rows.map(row => [`${row.modelId}:${row.caseId}:${row.trialIndex}`, row]));
  if (retained.methodId !== "depth60-pilot-v1" || retained.manifestSha256 !== sha(JSON.stringify(manifest)) || retained.inferenceRequests !== 54 || retained.cumulativeConservativeRequests !== 7908
    || retained.rows.length !== 54 || byTrial.size !== 54 || retained.rows.some(row => !DEPTH60_MODELS.includes(row.modelId as typeof DEPTH60_MODELS[number]) || !members.has(row.caseId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2
      || !row.result || row.result.failure !== null || row.result.inferenceRequests !== 1 || row.result.requested.modelId !== row.modelId || row.result.requested.profileId !== "one-shot-json-v1")
    || retained.rows.reduce((sum, row) => sum + row.result!.inferenceRequests, 0) !== 54 || progress.rows.length !== 54 || new Set(progress.rows.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size !== 54
    || progress.manifestSha256 !== retained.manifestSha256 || progress.inferenceRequests !== 54 || progress.cumulativeConservativeRequests !== 7908 || JSON.stringify(progress.reports) !== JSON.stringify(retained.reports)
    || progress.rows.some(row => { const source = byTrial.get(`${row.modelId}:${row.caseId}:${row.trialIndex}`)?.result; return !source || row.resultSha256 !== sha(JSON.stringify(source)) || row.failure !== null || row.outcome !== source.evidence.outcome.kind; })
    || audit.verdict !== "pass" || audit.sourceFileSha256 !== sha(retainedText) || audit.inferenceRequests !== 54 || audit.cumulativeConservativeRequests !== 7908 || audit.models.length !== 2 || retained.reports.length !== 2
    || DEPTH60_MODELS.some(model => { const report = retained.reports.find(row => row.modelId === model)?.report.overall.classification, independent = audit.models.find(row => row.modelId === model); return retained.rows.filter(row => row.modelId === model).length !== 27 || !report || report.population.status !== "complete" || report.population.plannedTrials !== 27 || report.population.includedTrials !== 27 || !independent || independent.planned !== 27 || independent.correct !== report.population.correctTrials || independent.macroF1 !== report.macroF1; })) throw new Error("The original pilot needs 54 unique complete retained outcomes, matching reports, source hashes and independent send accounting.");
}
export function checkDepth100Gate(population: { cases: readonly { id: string; depth: number }[] }, manifest: Record<string, unknown>, retained: PilotResult, progress: { rows: readonly { modelId: string; caseId: string; trialIndex: number; resultSha256: string | null; outcome: string; failure: unknown }[] } & Omit<PilotResult, "rows">,
  bindings: { priorProgress: string; population: string; review: string }): void {
  const members = new Set(population.cases.map(row => row.id)), byTrial = new Map(retained.rows.map(row => [`${row.modelId}:${row.caseId}:${row.trialIndex}`, row]));
  if (manifest.version !== "1" || manifest.methodId !== "depth100-pilot-v1" || JSON.stringify(manifest.models) !== JSON.stringify(DEPTH60_MODELS) || manifest.profileId !== "one-shot-json-v1" || manifest.caseCount !== 9 || manifest.trialsPerCase !== 3
    || manifest.maxInferenceRequests !== 54 || manifest.priorInferenceRequests !== 7908 || manifest.cumulativeInferenceCeiling !== 7962 || manifest.sharedCeiling !== 8192 || manifest.maxOutputTokens !== 4096 || manifest.retries !== 0 || manifest.inferenceDeadlineMs !== 180000
    || manifest.priorProgressFileSha256 !== bindings.priorProgress || manifest.populationFileSha256 !== bindings.population || manifest.reviewFileSha256 !== bindings.review || population.cases.length !== 9 || members.size !== 9 || population.cases.some(row => row.depth !== 100)
    || retained.methodId !== "depth100-pilot-v1" || retained.manifestSha256 !== sha(JSON.stringify(manifest)) || retained.inferenceRequests !== 54 || retained.cumulativeConservativeRequests !== 7962 || retained.rows.length !== 54 || byTrial.size !== 54
    || retained.rows.some(row => !DEPTH60_MODELS.includes(row.modelId as typeof DEPTH60_MODELS[number]) || !members.has(row.caseId) || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2 || !row.result || row.result.failure !== null || row.result.inferenceRequests !== 1 || row.result.requested.modelId !== row.modelId)
    || retained.rows.reduce((sum, row) => sum + row.result!.inferenceRequests, 0) !== 54 || retained.reports.length !== 2 || DEPTH60_MODELS.some(model => { const report = retained.reports.find(row => row.modelId === model)?.report.overall.classification; return retained.rows.filter(row => row.modelId === model).length !== 27 || !report || report.population.status !== "complete" || report.population.plannedTrials !== 27 || report.population.includedTrials !== 27; })
    || progress.inferenceRequests !== 54 || progress.cumulativeConservativeRequests !== 7962 || progress.methodId !== retained.methodId || progress.manifestSha256 !== retained.manifestSha256 || JSON.stringify(progress.reports) !== JSON.stringify(retained.reports)
    || progress.rows.length !== 54 || new Set(progress.rows.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size !== 54 || progress.rows.some(row => { const source = byTrial.get(`${row.modelId}:${row.caseId}:${row.trialIndex}`)?.result; return !source || row.resultSha256 !== sha(JSON.stringify(source)) || row.failure !== null || row.outcome !== source.evidence.outcome.kind || !["answer", "invalid", "refused", "truncated"].includes(row.outcome); })) throw new Error("The coordinated depth-100 study must first retain 54 unique complete outcomes and matching terminal source hashes at cumulative 7962.");
}
export async function freezeDepth60Pilot(study: Depth60Study = "pilot"): Promise<void> {
  const { suite, bindings } = await freezeInputs(study), manifest = createDepth60Manifest(suite, bindings, study);
  await writeFile(paths(study).manifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(manifest));
}

export function depth60Rows(suite: FrozenSuite, study: Depth60Study = "pilot"): Depth60Row[] {
  checkDepth60Suite(suite); return suite.cases.flatMap(entry => [0, 1, 2].flatMap(trialIndex => configuration(study).models.map(modelId => ({ modelId, caseId: entry.id, trialIndex, dispatched: false, result: null }))));
}
export function depth60Dispatch(row: Pick<Depth60Row, "modelId" | "caseId" | "trialIndex">, suite: FrozenSuite, bodyText: string, study: Depth60Study = "pilot") {
  const body = JSON.parse(bodyText), entry = suite.cases.find(entry => entry.id === row.caseId);
  if (!entry || !Number.isInteger(row.trialIndex) || row.trialIndex < 0 || row.trialIndex > 2 || !(configuration(study).models as readonly string[]).includes(row.modelId) || body.model !== row.modelId
    || body.max_output_tokens !== 4096 || body.store !== false || body.truncation !== "disabled" || body.reasoning !== undefined || JSON.stringify(body.input) !== JSON.stringify(buildPrompt(entry.reference, "one-shot-json-v1").messages)) throw new Error("The dispatch differs from its frozen model/case/trial or exact prompt/settings.");
  return { modelId: row.modelId, caseId: row.caseId, trialIndex: row.trialIndex, requestBodySha256: sha(bodyText) };
}
export function depth60Concurrency(study: Depth60Study, headers: readonly { modelId: string; values: Record<string, string> }[]): number {
  const config = configuration(study);
  return headers.length === config.initial && new Set(headers.map(row => row.modelId)).size === config.initial && config.models.every(model => headers.some(row => row.modelId === model))
    && headers.every(row => Number(row.values["x-ratelimit-remaining-requests"]) >= config.maximum && Number(row.values["x-ratelimit-remaining-tokens"]) >= 100000) ? 12 : config.initial;
}
export async function exportDepth60Summary(path: URL, summary: unknown, credential: string, incomplete: boolean): Promise<void> {
  const text = `${JSON.stringify(summary, null, 2)}\n`; if (reflectsCredential(text, credential)) throw new Error("Unsafe pilot summary was discarded.");
  await writeFile(path, text, { flag: "wx", mode: 0o600 });
  if (incomplete) throw new Error("The depth-60 study is incomplete; retained failures and absent outcomes were exported without retries.");
}

// A fixed worker pool stops taking new work after cancellation; settled and absent rows remain distinct.
export async function runDepth60Pool<T>(rows: readonly T[], concurrency: number, signal: AbortSignal, work: (row: T) => Promise<void>): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error("Pilot concurrency must be from 1 through 12.");
  let cursor = 0, failed = false;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    try { while (!failed && !signal.aborted && cursor < rows.length) await work(rows[cursor++]); }
    catch (error) { failed = true; throw error; }
  }));
  if (workers.some(row => row.status === "rejected")) throw new Error("Pilot execution or evidence persistence failed; inspect retained dispatches before further paid work.");
}

export async function runDepth60Pilot(credentialInput: string, study: Depth60Study = "pilot"): Promise<void> {
  const credential = parseCredential(credentialInput), { suite, bindings } = await freezeInputs(study), targets = paths(study), config = configuration(study), manifest = await json(targets.manifest);
  assertDepth60Manifest(manifest, suite, bindings, study);
  if (await Bun.file(targets.progress).exists()) throw new Error("Existing progress blocks a repeated depth-60 study.");
  await mkdir(new URL("private/", ROOT), { recursive: true, mode: 0o700 });
  await mkdir(targets.private, { mode: 0o700 }); // Existing evidence blocks accidental reruns.
  const controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]);
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  let sends = 0, dispatches = 0;
  const headers: { modelId: string; status: number; values: Record<string, string> }[] = [];
  const rows = depth60Rows(suite, study);
  const save = async (name: string, value: unknown) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (reflectsCredential(text, credential)) { controller.abort(); throw new Error("Unsafe evidence was discarded."); }
    try { await writeFile(new URL(name, targets.private), text, { flag: "wx", mode: 0o600 }); }
    catch { controller.abort(); throw new Error("Pilot evidence could not be persisted; stop paid work and inspect dispatch records."); }
  };
  const work = async (row: (typeof rows)[number]) => {
    try {
      const entry = suite.cases.find(entry => entry.id === row.caseId)!;
      // Each closure binds its dispatch receipt to one logical trial, including when results never arrive.
      const infer = createInferenceClient(async (url, init) => {
        signal.throwIfAborted();
        if (url === "https://api.openai.com/v1/responses") {
          if (init.method !== "POST" || sends >= config.maximum || row.dispatched) throw new Error("Pilot inference budget exhausted or repeated.");
          const binding = depth60Dispatch(row, suite, String(init.body), study), ordinal = ++dispatches; sends++; row.dispatched = true;
          await save(`dispatch-${ordinal}.json`, { ordinal, ...binding, authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" });
          signal.throwIfAborted();
        }
        const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false });
        if (url.endsWith("/responses")) {
          const values: Record<string, string> = {};
          for (const key of ["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "retry-after"]) { const value = response.headers.get(key); if (value !== null) values[key] = value; }
          headers.push({ modelId: row.modelId, status: response.status, values });
        }
        return response;
      });
      row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" },
        prompt: buildPrompt(entry.reference, "one-shot-json-v1"), acceptCharges: true }, credential, signal);
      if (row.result.failure) controller.abort();
      await save(`${row.modelId}-${suite.cases.indexOf(entry)}-${row.trialIndex}.json`, row);
    } catch (error) { controller.abort(); throw error; }
  };
  try {
    await save("manifest.json", manifest);
    let failed = false; let concurrency: number = config.initial;
    try {
      await runDepth60Pool(rows.slice(0, config.initial), config.initial, signal, work);
      concurrency = depth60Concurrency(study, headers);
      await runDepth60Pool(rows.slice(config.initial), concurrency, signal, work);
    } catch { failed = true; controller.abort(); }
    const reports = [];
    for (const modelId of config.models) {
      const selected = rows.filter(row => row.modelId === modelId);
      const evidence = { runId: `${config.stem}-v1-${modelId}`, suiteId: suite.id, protocolVersion: "1", profileId: "one-shot-json-v1",
        model: { provider: "openai", modelId, endpointId: "responses", settingsId: "provider-default-4096" }, run: { elapsedMs: null, concurrency }, expressionTokens: [],
        trials: selected.map(row => ({ caseId: row.caseId, trialIndex: row.trialIndex, finalAttempt: row.result ? 1 : null, elapsedMs: row.result?.evidence.elapsedMs ?? null, attempts: row.result ? [row.result.evidence] : [] })) };
      reports.push({ modelId, report: await scoreEvaluation({ suite, evidence }) });
    }
    const result = { version: "1", methodId: manifest.methodId, finishedAt: new Date().toISOString(), manifestSha256: sha(JSON.stringify(manifest)), inferenceRequests: sends,
      cumulativeConservativeRequests: config.prior + sends, concurrency, rateLimitEvidence: headers, rows, reports, interpretation: manifest.interpretation };
    try { await save("result.json", result); } catch { failed = true; }
    const incomplete = failed || signal.aborted || rows.some(row => !row.result || row.result.failure !== null) || reports.some(row => row.report.overall.classification.population.status !== "complete");
    const summary = { ...result, state: incomplete ? "interrupted" : "settled", unknownRemoteInferenceRequests: rows.filter(row => row.dispatched && (!row.result || row.result.failure?.remoteOutcome === "unknown")).length,
      rows: rows.map(({ modelId, caseId, trialIndex, dispatched, result }) => ({ modelId, caseId, trialIndex, dispatched,
      resultSha256: result ? sha(JSON.stringify(result)) : null, outcome: result?.evidence.outcome.kind ?? (dispatched ? "unavailable" : "unattempted"), failure: result?.failure ?? null })) };
    await exportDepth60Summary(targets.progress, summary, credential, incomplete);
    console.log(JSON.stringify({ inferenceRequests: sends, concurrency, models: reports.map(row => ({ modelId: row.modelId, population: row.report.overall.classification.population, macroF1: row.report.overall.classification.macroF1 })) }));
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    if ((Bun.argv[2] === "freeze" || Bun.argv[2] === "freeze-additional") && Bun.argv.length === 3) await freezeDepth60Pilot(Bun.argv[2] === "freeze" ? "pilot" : "additional");
    else if ((Bun.argv[2] === "run" || Bun.argv[2] === "run-additional") && Bun.argv[3] === "--accept-charges" && Bun.argv.length === 4) await runDepth60Pilot(process.env.OPENAI_API_KEY ?? "", Bun.argv[2] === "run" ? "pilot" : "additional");
    else throw new Error("Use freeze[-additional], or run[-additional] --accept-charges with the configured development key.");
  } catch { console.error("Depth-60 pilot did not complete. Inspect frozen inputs and private dispatch evidence before further paid action."); process.exitCode = 1; }
}
