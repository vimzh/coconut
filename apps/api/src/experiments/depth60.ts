// Runs a separately frozen, unranked depth-60 pilot through the existing bounded inference and scoring paths.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient, type InferenceClient, type InferenceResult } from "../inference";
import { buildPrompt } from "../protocol";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { scoreEvaluation } from "../scoring/scorer";
import { validateFrozenSuite } from "../suites";
import type { FrozenSuite } from "../suites/types";

const ROOT = new URL("../../data/", import.meta.url);
const SUITE = new URL("suites/depth60-v1.json", ROOT);
const MANIFEST = new URL("experiments/depth60-matrix-v1.json", ROOT);
const PRIVATE = new URL("private/depth60-v1/", ROOT);
const REVIEW = new URL("quality/depth60-reference-review-v1.json", ROOT);
export const DEPTH60_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"] as const;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const json = async (path: URL) => JSON.parse(await readFile(path, "utf8"));

export function checkDepth60Suite(suite: FrozenSuite): void {
  if (suite.request.seed !== "coconut-depth60-pilot-v1" || suite.request.profileId !== "one-shot-json-v1" || suite.request.purpose !== "evaluation"
    || suite.request.depths.length !== 1 || suite.request.depths[0] !== 60 || suite.cases.length !== 9
    || suite.cases.some(row => row.depth !== 60 || row.certificate.depth !== 60)
    || ["convex", "concave", "neither"].some(label => suite.cases.filter(row => row.label === label).length !== 3)) {
    throw new Error("The depth-60 pilot requires its frozen balanced nine-case exact suite.");
  }
}

async function freezeInputs() {
  const suiteText = await readFile(SUITE, "utf8"), suite = await validateFrozenSuite(JSON.parse(suiteText));
  checkDepth60Suite(suite);
  const reviewText = await readFile(REVIEW, "utf8"), review = JSON.parse(reviewText);
  if (review.suiteFileSha256 !== sha(suiteText) || review.verdict !== "pass" || review.cases.length !== 9) throw new Error("A matching independent reference review is required before inference.");
  const priorText = await readFile(new URL("experiments/long-reserve-progress-v1.json", ROOT), "utf8"), prior = JSON.parse(priorText);
  if (prior.state !== "settled" || prior.inferenceRequests !== 108 || prior.budget.cumulativeInferenceCeiling !== 7854) throw new Error("Terminal prior-study accounting is required.");
  return { suite, bindings: { suiteId: suite.id, suiteFileSha256: sha(suiteText), reviewFileSha256: sha(reviewText), priorProgressFileSha256: sha(priorText) } };
}

export async function freezeDepth60Pilot(): Promise<void> {
  const { bindings } = await freezeInputs();
  const manifest = { version: "1", methodId: "depth60-pilot-v1", frozenAt: new Date().toISOString(), ...bindings,
    models: DEPTH60_MODELS, profileId: "one-shot-json-v1", cases: 9, trialsPerCase: 3, maxInferenceRequests: 54,
    priorInferenceRequests: 7854, cumulativeInferenceCeiling: 7908, sharedCeiling: 8192,
    maxConcurrency: 12, initialConcurrency: 2, retries: 0, inferenceDeadlineMs: 180000, maxOutputTokens: 4096,
    interpretation: "Exploratory, unranked exact-envelope tasks. Structural depth also changes expression length and active pieces; no causal depth, frontier-failure or independent-family claim." };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(manifest));
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

export async function runDepth60Pilot(credentialInput: string): Promise<void> {
  const credential = parseCredential(credentialInput), { suite, bindings } = await freezeInputs(), manifest = await json(MANIFEST);
  if (Object.entries(bindings).some(([key, value]) => manifest[key] !== value) || JSON.stringify(manifest.models) !== JSON.stringify(DEPTH60_MODELS)
    || manifest.maxInferenceRequests !== 54 || manifest.priorInferenceRequests !== 7854 || manifest.cumulativeInferenceCeiling !== 7908
    || manifest.maxConcurrency !== 12 || manifest.maxOutputTokens !== 4096 || manifest.retries !== 0) throw new Error("The frozen pilot identity or budget changed.");
  await mkdir(new URL("private/", ROOT), { recursive: true, mode: 0o700 });
  await mkdir(PRIVATE, { mode: 0o700 }); // Existing evidence blocks accidental reruns.
  const controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]);
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  let sends = 0, dispatches = 0;
  const headers: { modelId: string; status: number; values: Record<string, string> }[] = [];
  const rows = suite.cases.flatMap(entry => [0, 1, 2].flatMap(trialIndex => DEPTH60_MODELS.map(modelId => ({ modelId, caseId: entry.id, trialIndex, result: null as InferenceResult | null }))));
  const save = async (name: string, value: unknown) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (reflectsCredential(text, credential)) { controller.abort(); throw new Error("Unsafe evidence was discarded."); }
    try { await writeFile(new URL(name, PRIVATE), text, { flag: "wx", mode: 0o600 }); }
    catch { controller.abort(); throw new Error("Pilot evidence could not be persisted; stop paid work and inspect dispatch records."); }
  };
  const infer: InferenceClient = createInferenceClient(async (url, init) => {
    signal.throwIfAborted();
    if (url === "https://api.openai.com/v1/responses") {
      if (init.method !== "POST" || sends >= 54) throw new Error("Pilot inference budget exhausted.");
      const body = JSON.parse(String(init.body));
      if (!DEPTH60_MODELS.includes(body.model) || body.max_output_tokens !== 4096 || body.store !== false) throw new Error("Unexpected pilot request.");
      const ordinal = ++dispatches; sends++;
      await save(`dispatch-${ordinal}.json`, { ordinal, modelId: body.model, authorizedAt: new Date().toISOString(), requestBodySha256: sha(String(init.body)), remoteOutcomeUntilRetained: "unknown" });
    }
    const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false });
    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init.body)), values: Record<string, string> = {};
      for (const key of ["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "retry-after"]) {
        const value = response.headers.get(key); if (value !== null) values[key] = value;
      }
      headers.push({ modelId: body.model, status: response.status, values });
    }
    return response;
  });
  const work = async (row: (typeof rows)[number]) => {
    try {
      const entry = suite.cases.find(entry => entry.id === row.caseId)!;
      row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" },
        prompt: buildPrompt(entry.reference, "one-shot-json-v1"), acceptCharges: true }, credential, signal);
      await save(`${row.modelId}-${suite.cases.indexOf(entry)}-${row.trialIndex}.json`, row);
      if (row.result.failure) controller.abort();
    } catch (error) { controller.abort(); throw error; }
  };
  try {
    await save("manifest.json", manifest);
    await runDepth60Pool(rows.slice(0, 2), 2, signal, work);
    // Raise concurrency only when both first responses expose sufficient request/token headroom.
    const headroom = headers.length === 2 && headers.every(row => Number(row.values["x-ratelimit-remaining-requests"]) >= 54 && Number(row.values["x-ratelimit-remaining-tokens"]) >= 100000);
    const concurrency = headroom ? 12 : 2;
    await runDepth60Pool(rows.slice(2), concurrency, signal, work);
    const reports = [];
    for (const modelId of DEPTH60_MODELS) {
      const selected = rows.filter(row => row.modelId === modelId);
      const evidence = { runId: `depth60-v1-${modelId}`, suiteId: suite.id, protocolVersion: "1", profileId: "one-shot-json-v1",
        model: { provider: "openai", modelId, endpointId: "responses", settingsId: "provider-default-4096" }, run: { elapsedMs: null, concurrency }, expressionTokens: [],
        trials: selected.map(row => ({ caseId: row.caseId, trialIndex: row.trialIndex, finalAttempt: row.result ? 1 : null, elapsedMs: row.result?.evidence.elapsedMs ?? null, attempts: row.result ? [row.result.evidence] : [] })) };
      reports.push({ modelId, report: await scoreEvaluation({ suite, evidence }) });
    }
    const result = { version: "1", methodId: manifest.methodId, finishedAt: new Date().toISOString(), manifestSha256: sha(JSON.stringify(manifest)), inferenceRequests: sends,
      cumulativeConservativeRequests: 7854 + sends, concurrency, rateLimitEvidence: headers, rows, reports, interpretation: manifest.interpretation };
    await save("result.json", result);
    const summary = { ...result, rows: rows.map(({ modelId, caseId, trialIndex, result }) => ({ modelId, caseId, trialIndex,
      resultSha256: result ? sha(JSON.stringify(result)) : null, outcome: result?.evidence.outcome.kind ?? "unattempted", failure: result?.failure ?? null })) };
    await writeFile(new URL("experiments/depth60-progress-v1.json", ROOT), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ inferenceRequests: sends, concurrency, models: reports.map(row => ({ modelId: row.modelId, population: row.report.overall.classification.population, macroF1: row.report.overall.classification.macroF1 })) }));
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    if (Bun.argv[2] === "freeze" && Bun.argv.length === 3) await freezeDepth60Pilot();
    else if (Bun.argv[2] === "run" && Bun.argv[3] === "--accept-charges" && Bun.argv.length === 4) await runDepth60Pilot(process.env.OPENAI_API_KEY ?? "");
    else throw new Error("Use freeze, or run --accept-charges with the configured development key.");
  } catch { console.error("Depth-60 pilot did not complete. Inspect frozen inputs and private dispatch evidence before further paid action."); process.exitCode = 1; }
}
