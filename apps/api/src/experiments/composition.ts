// Freeze and execute a bounded composition comparison through the normal foreground engine.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient } from "../inference";
import { buildNumericalPrompts } from "../numerics";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { createRunService, createRunStore, loadRunSuite } from "../runs";

const root = new URL("../../data/", import.meta.url);
const privateRoot = new URL("private/composition-v1/", root);
const manifestPath = new URL("experiments/composition-matrix-v1.json", root);
const models = ["gpt-5.4-mini", "gpt-6-luna"] as const;
const settings = { models, profileId: "one-shot-json-v1", promptVersion: "smooth-v2", cases: 27, trialsPerCase: 3, maxInferenceRequests: 162,
  priorInferenceRequests: 8511, maximumCumulativeInferenceRequests: 8673, perModelConcurrency: 6, aggregateConcurrency: 12, retries: 0, maxOutputTokens: 4096 };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

async function inputs() {
  const suite = await loadRunSuite("composition-v1", "one-shot-json-v1");
  if (suite.generatorVersion !== "composition-v1" || suite.cases.length !== 27) throw new Error("Expected the fixed 27-task composition suite.");
  const prompts = await buildNumericalPrompts(suite.cases.map(row => row.reference), "one-shot-json-v1", "smooth-v2");
  const suiteText = await readFile(new URL("suites/composition-v1.json", root), "utf8");
  const reviewText = await readFile(new URL("quality/composition-reference-review-v1.json", root), "utf8");
  const review = JSON.parse(reviewText);
  if (review.verdict !== "pass" || review.suiteFileSha256 !== hash(suiteText)) throw new Error("Matching independent composition reference review is required.");
  const priorText = await readFile(new URL("quality/fast-table-fill-v1.json", root), "utf8");
  const prior = JSON.parse(priorText);
  if (prior.state !== "complete" || prior.inferenceRequests !== 351 || prior.cumulativeConservativeRequests !== 8511 || prior.unknownRemoteInferenceRequests !== 0)
    throw new Error("The settled prior accounting is required.");
  const sources: Record<string, string> = {};
  const glob = new Bun.Glob("apps/api/src/**/*.ts");
  for await (const path of glob.scan({ cwd: new URL("../../../../", import.meta.url).pathname })) {
    if (!path.endsWith(".test.ts")) sources[path] = hash(await readFile(new URL(`../../../../${path}`, import.meta.url), "utf8"));
  }
  for (const path of ["docs/research/composition-reference-review-v1.py", "docs/research/composition-results-audit-v1.py", "bun.lock", "patches/openai@7.53.0.patch", "services/numerics/worker.py", "services/numerics/uv.lock", "services/numerics/certification.py", "services/numerics/expressions.py", "services/numerics/jets.py", "services/numerics/intervals.py"])
    sources[path] = hash(await readFile(new URL(`../../../../${path}`, import.meta.url), "utf8"));
  return { suite, prompts, binding: { suiteId: suite.id, suiteSha256: hash(JSON.stringify(suite)), promptsSha256: hash(JSON.stringify(prompts)), priorSha256: hash(priorText), referenceReviewSha256: hash(reviewText), sources: Object.fromEntries(Object.entries(sources).sort()) } };
}

export function assertCompositionDispatch(bodyText: string, allowedPrompts: ReadonlySet<string>, sent: number) {
  const body = JSON.parse(bodyText);
  if (sent >= 162 || !models.includes(body.model) || body.max_output_tokens !== 4096 || body.store !== false || body.truncation !== "disabled" || body.reasoning !== undefined || !allowedPrompts.has(hash(JSON.stringify(body.input))))
    throw new Error("Unexpected composition dispatch or exhausted frozen budget.");
  return body.model as typeof models[number];
}

export function assertCompositionManifest(manifest: Record<string, unknown>, binding: Record<string, unknown>) {
  if (manifest.version !== "1" || manifest.methodId !== "composition-comparison-v1" || typeof manifest.frozenAt !== "string" ||
      !Number.isFinite(Date.parse(manifest.frozenAt)) || new Date(manifest.frozenAt).toISOString() !== manifest.frozenAt ||
      Object.entries({ ...binding, ...settings }).some(([key, value]) => JSON.stringify(manifest[key]) !== JSON.stringify(value)))
    throw new Error("Frozen composition sources, population or budget changed.");
}

async function freeze() {
  const { binding } = await inputs();
  const manifest = { version: "1", methodId: "composition-comparison-v1", frozenAt: new Date().toISOString(), ...binding,
    ...settings, interpretation: "Exploratory fixed-family comparison; nonlinear stages differ from AST depth. No guaranteed failure, ranking or causal depth claim." };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ state: "frozen", suiteId: binding.suiteId, maxInferenceRequests: 162 }));
}

async function run(suppliedCredential: string) {
  const credential = parseCredential(suppliedCredential), { binding, prompts } = await inputs();
  const manifestText = await readFile(manifestPath, "utf8"), manifest = JSON.parse(manifestText);
  assertCompositionManifest(manifest, binding);
  await mkdir(privateRoot, { recursive: false, mode: 0o700 });
  const save = async (name: string, data: unknown) => {
    const text = `${JSON.stringify(data, null, 2)}\n`;
    if (reflectsCredential(text, credential)) throw new Error("Unsafe composition evidence.");
    await writeFile(new URL(name, privateRoot), text, { flag: "wx", mode: 0o600 });
  };
  await save("manifest.json", manifest);
  const allowed = new Set(prompts.map(prompt => hash(JSON.stringify(prompt.messages))));
  let sends = 0;
  const modelSends = new Map<string, number>();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const infer = createInferenceClient(async (url, init) => {
    if (url === "https://api.openai.com/v1/responses") {
      controller.signal.throwIfAborted();
      if (init.method !== "POST") throw new Error("Unexpected inference method.");
      const model = assertCompositionDispatch(String(init.body), allowed, sends);
      if ((modelSends.get(model) ?? 0) >= 81) throw new Error("Per-model composition budget exhausted.");
      modelSends.set(model, (modelSends.get(model) ?? 0) + 1);
      const ordinal = ++sends;
      try { await save(`dispatch-${ordinal}.json`, { ordinal, modelId: model, dispatchedAt: new Date().toISOString(), requestBodySha256: hash(String(init.body)) }); }
      catch (error) { controller.abort(); throw error; }
    }
    return fetch(url, { ...init, signal: AbortSignal.any([controller.signal, init.signal ?? controller.signal]), timeout: false });
  });
  const store = createRunStore({ path: new URL("runs.sqlite", privateRoot).pathname });
  const service = createRunService({ store, inferenceClient: infer });
  const receipts = new Map<string, { runId: string; accessCode: string }>();
  const startedAt = new Date().toISOString();
  try {
    const settled = await Promise.allSettled(models.map(async modelId => {
      const view = await service.execute({ suiteKey: "composition-v1", provider: "openai", modelId, servingProvider: null,
        profileId: "one-shot-json-v1", concurrency: 6, acceptCharges: true }, credential, controller.signal, event => {
        if (event.type === "started") {
          const receipt = { runId: event.runId, accessCode: event.accessCode };
          const text = JSON.stringify(receipt);
          if (reflectsCredential(text, credential)) throw new Error("Unsafe run receipt.");
          writeFileSync(new URL(`${modelId}-receipt.json`, privateRoot), text, { flag: "wx", mode: 0o600 });
          receipts.set(modelId, receipt);
        }
      });
      return view.record;
    }));
    const summaries = [];
    let knownSends = 0;
    for (let index = 0; index < settled.length; index++) {
      const result = settled[index], modelId = models[index], receipt = receipts.get(modelId);
      const record = result.status === "fulfilled" ? result.value : receipt ? store.read(receipt.runId, receipt.accessCode)?.record : null;
      if (!record) { summaries.push({ modelId, state: "failed", runId: receipt?.runId ?? null, progress: null, report: null }); continue; }
      await save(`${modelId}.json`, record);
      knownSends += record.results.filter(row => row.result.inferenceRequests === 1 && row.result.failure?.remoteOutcome !== "unknown").length;
      summaries.push({ modelId, runId: record.id, state: record.state, progress: record.progress,
        recordSha256: hash(`${JSON.stringify(record, null, 2)}\n`), report: record.report });
    }
    const unknownRemoteInferenceRequests = Math.max(0, sends - knownSends);
    const summary = { version: "1", methodId: manifest.methodId, manifestFileSha256: hash(manifestText), suiteId: binding.suiteId,
      startedAt, finishedAt: new Date().toISOString(), inferenceRequests: sends, cumulativeConservativeRequests: 8511 + sends,
      models: summaries, unknownRemoteInferenceRequests,
      state: sends === 162 && unknownRemoteInferenceRequests === 0 && summaries.every(result => result.state === "completed") ? "complete" : "incomplete" };
    await save("summary.json", summary);
    await writeFile(new URL("experiments/composition-progress-v1.json", root), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ state: summary.state, inferenceRequests: sends, cumulativeConservativeRequests: summary.cumulativeConservativeRequests }));
  } finally { controller.abort(); store.close(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  if (Bun.argv.length === 3 && Bun.argv[2] === "freeze") await freeze();
  else if (Bun.argv.length === 4 && Bun.argv[2] === "run" && Bun.argv[3] === "--accept-charges") await run(process.env.OPENAI_API_KEY ?? "");
  else throw new Error("Use freeze, or run --accept-charges with the configured environment credential.");
}
