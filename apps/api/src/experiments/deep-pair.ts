// Executes a separately verified depth-256/512 research method while leaving application verification limits unchanged.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient, type InferenceResult } from "../inference";
import { createDeepPairPopulation, replayDeepPairPopulation, buildDeepPairPrompt, DEEP_PAIR_RESEARCH_POLICY, DEEP_PAIR_PROMPT_VERSION } from "./deep-pair-reference";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { scoreClassifications } from "../scoring/classification";
import { DEPTH60_MODELS, runDepth60Pool } from "./depth60";

const root = new URL("../../data/", import.meta.url), populationPath = new URL("research/deep-pair-population-v1.json", root);
const manifestPath = new URL("experiments/deep-pair-matrix-v1.json", root), privateRoot = new URL("private/deep-pair-v1/", root);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const load = async (path: URL) => JSON.parse(await readFile(path, "utf8"));

export function deepPairRows(population: ReturnType<typeof createDeepPairPopulation>) {
  return population.cases.flatMap(entry => [0, 1, 2].flatMap(trialIndex => DEPTH60_MODELS.map(modelId => ({ modelId, caseId: entry.id, depth: entry.depth, trialIndex, dispatched: false, result: null as InferenceResult | null }))));
}
async function inputs() {
  const populationText = await readFile(populationPath, "utf8"), population = replayDeepPairPopulation(populationText);
  const reviewText = await readFile(new URL("quality/deep-pair-reference-review-v1.json", root), "utf8"), review = JSON.parse(reviewText);
  if (review.suiteFileSha256 !== hash(populationText) || review.verdict !== "pass" || review.cases.length !== 6) throw new Error("Matching independent reference evidence is required.");
  const priorText = await readFile(new URL("experiments/depth216-progress-v1.json", root), "utf8"), prior = JSON.parse(priorText);
  const priorManifestText = await readFile(new URL("experiments/depth216-matrix-v1.json", root), "utf8"), priorManifest = JSON.parse(priorManifestText);
  const priorResultText = await readFile(new URL("private/depth216-v1/result.json", root), "utf8"), priorResult = JSON.parse(priorResultText);
  if (prior.methodId !== "depth216-pilot-v1" || prior.state !== "settled" || prior.inferenceRequests !== 54 || prior.cumulativeConservativeRequests !== 8124
    || prior.rows.length !== 54 || prior.rows.some((row: { failure: unknown; resultSha256: string | null; dispatched: boolean }) => row.failure !== null || row.resultSha256 === null || row.dispatched !== true)
    || prior.manifestSha256 !== hash(JSON.stringify(priorManifest)) || priorResult.inferenceRequests !== 54 || priorResult.cumulativeConservativeRequests !== 8124
    || priorResult.rows.length !== 54 || priorResult.rows.some((row: { dispatched: boolean; result: InferenceResult | null }) => !row.dispatched || row.result?.failure !== null || row.result?.inferenceRequests !== 1)
    || priorResult.rows.some((row: { modelId: string; caseId: string; trialIndex: number; result: InferenceResult }, index: number) => prior.rows[index].modelId !== row.modelId || prior.rows[index].caseId !== row.caseId || prior.rows[index].trialIndex !== row.trialIndex || prior.rows[index].resultSha256 !== hash(JSON.stringify(row.result)))) throw new Error("The coordinated prior batch must first settle with 54 bound outcomes and cumulative 8124.");
  return { population, bindings: { populationFileSha256: hash(populationText), reviewFileSha256: hash(reviewText), priorProgressFileSha256: hash(priorText),
    priorManifestFileSha256: hash(priorManifestText), priorResultFileSha256: hash(priorResultText),
    promptsSha256: hash(JSON.stringify(population.cases.map(row => buildDeepPairPrompt(row.id)))),
    referenceSourceFileSha256: hash(await readFile(new URL("deep-pair-reference.ts", import.meta.url), "utf8")), runnerSourceFileSha256: hash(await readFile(new URL("deep-pair.ts", import.meta.url), "utf8")) } };
}

export async function freezeDeepPairPilot() {
  const { bindings } = await inputs();
  const manifest = { version: "1", methodId: "deep-pair-pilot-v1", frozenAt: new Date().toISOString(), ...bindings, models: DEPTH60_MODELS,
    researchPolicy: DEEP_PAIR_RESEARCH_POLICY, researchPromptVersion: DEEP_PAIR_PROMPT_VERSION, researchBounds: { depth: 512, nodes: 2600, literalCharacters: 96, rationalBits: 4096, arithmeticOperations: 200000 },
    profileId: "one-shot-json-v1", caseCount: 6, depths: [256, 512], casesPerDepth: 3, trialsPerCase: 3, maxInferenceRequests: 36, priorInferenceRequests: 8124,
    cumulativeInferenceCeiling: 8160, sharedCeiling: 8192, maxConcurrency: 12, retries: 0, maxOutputTokens: 4096, inferenceDeadlineMs: 180000 };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(manifest));
}

export async function runDeepPairPilot(suppliedCredential: string) {
  const credential = parseCredential(suppliedCredential), { population, bindings } = await inputs(), manifest = await load(manifestPath);
  if (Object.entries(bindings).some(([key, value]) => manifest[key] !== value) || JSON.stringify(manifest.models) !== JSON.stringify(DEPTH60_MODELS)
    || manifest.maxInferenceRequests !== 36 || manifest.priorInferenceRequests !== 8124 || manifest.cumulativeInferenceCeiling !== 8160
    || manifest.researchPolicy !== DEEP_PAIR_RESEARCH_POLICY || manifest.researchPromptVersion !== DEEP_PAIR_PROMPT_VERSION
    || manifest.maxOutputTokens !== 4096 || manifest.maxConcurrency !== 12 || manifest.retries !== 0) throw new Error("The frozen depth-256/512 budget or evidence changed.");
  await mkdir(new URL("private/", root), { recursive: true, mode: 0o700 });
  await mkdir(privateRoot, { mode: 0o700 });
  const controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]), stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  let sends = 0;
  const headers: { modelId: string; status: number; remainingRequests: string | null; remainingTokens: string | null }[] = [];
  const save = async (name: string, value: unknown) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    try { if (reflectsCredential(text, credential)) throw new Error("Unsafe evidence"); await writeFile(new URL(name, privateRoot), text, { flag: "wx", mode: 0o600 }); }
    catch { controller.abort(); throw new Error("Evidence could not be retained; stop and inspect private dispatch records."); }
  };
  const rows = deepPairRows(population);
  const work = async (row: (typeof rows)[number]) => {
    try {
      const entry = population.cases.find(entry => entry.id === row.caseId)!;
      const prompt = buildDeepPairPrompt(entry.id);
      const infer = createInferenceClient(async (url, init) => {
        signal.throwIfAborted();
        if (url === "https://api.openai.com/v1/responses") {
          const body = JSON.parse(String(init.body));
          if (init.method !== "POST" || sends >= 36 || row.dispatched || body.model !== row.modelId || body.max_output_tokens !== 4096 || body.store !== false
            || body.truncation !== "disabled" || body.reasoning !== undefined || JSON.stringify(body.input) !== JSON.stringify(prompt.messages)) throw new Error("Unexpected depth-256/512 dispatch.");
          const ordinal = ++sends; row.dispatched = true;
          await save(`dispatch-${ordinal}.json`, { ordinal, modelId: row.modelId, caseId: row.caseId, depth: row.depth, trialIndex: row.trialIndex, authorizedAt: new Date().toISOString(), requestBodySha256: hash(String(init.body)), remoteOutcomeUntilRetained: "unknown" });
          signal.throwIfAborted();
        }
        const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false });
        if (url.endsWith("/responses")) headers.push({ modelId: row.modelId, status: response.status,
          remainingRequests: response.headers.get("x-ratelimit-remaining-requests"), remainingTokens: response.headers.get("x-ratelimit-remaining-tokens") });
        return response;
      });
      row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" },
        prompt, acceptCharges: true }, credential, signal);
      await save(`${row.modelId}-${population.cases.indexOf(entry)}-${row.trialIndex}.json`, row);
      if (row.result.failure) controller.abort();
    } catch (error) { controller.abort(); throw error; }
  };
  try {
    await save("manifest.json", manifest);
    let failed = false, concurrency = 2;
    try {
      await runDepth60Pool(rows.slice(0, 2), 2, signal, work);
      concurrency = headers.length === 2 && new Set(headers.map(row => row.modelId)).size === 2 && headers.every(row => Number(row.remainingRequests) >= 36 && Number(row.remainingTokens) >= 250000) ? 12 : 2;
      await runDepth60Pool(rows.slice(2), concurrency, signal, work);
    } catch { failed = true; controller.abort(); }
    const reports = [256, 512].flatMap(depth => DEPTH60_MODELS.map(modelId => ({ modelId, depth, report: { kind: "research-classification-only", overall: { classification: scoreClassifications(rows.filter(row => row.modelId === modelId && row.depth === depth).map(row => ({
      caseId: row.caseId, trialIndex: row.trialIndex, depth, referenceLabel: population.cases.find(entry => entry.id === row.caseId)!.label, outcome: row.result?.evidence.outcome ?? null })), 3) } } })));
    const result = { version: "1", methodId: manifest.methodId, finishedAt: new Date().toISOString(), manifestSha256: hash(JSON.stringify(manifest)), inferenceRequests: sends,
      cumulativeConservativeRequests: 8124 + sends, concurrency, rateLimitEvidence: headers, rows, reports, interpretation: population.interpretation };
    await save("result.json", result);
    const incomplete = failed || signal.aborted || rows.some(row => !row.result || row.result.failure !== null);
    const summary = { ...result, state: incomplete ? "interrupted" : "settled", unknownRemoteInferenceRequests: rows.filter(row => row.dispatched && (!row.result || row.result.failure?.remoteOutcome === "unknown")).length,
      rows: rows.map(({ modelId, caseId, depth, trialIndex, dispatched, result }) => ({ modelId, caseId, depth, trialIndex, dispatched,
      resultSha256: result ? hash(JSON.stringify(result)) : null, outcome: result?.evidence.outcome.kind ?? "unattempted", failure: result?.failure ?? null })) };
    await writeFile(new URL("experiments/deep-pair-progress-v1.json", root), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    if (incomplete) throw new Error("The depth-256/512 pilot was interrupted; all available outcomes and conservative send counts were retained.");
    console.log(JSON.stringify({ inferenceRequests: sends, concurrency, models: reports.map(row => ({ modelId: row.modelId, depth: row.depth, population: row.report.overall.classification.population, macroF1: row.report.overall.classification.macroF1 })) }));
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    if (Bun.argv[2] === "prepare" && Bun.argv.length === 3) await writeFile(populationPath, `${JSON.stringify(createDeepPairPopulation())}\n`, { flag: "wx" });
    else if (Bun.argv[2] === "freeze" && Bun.argv.length === 3) await freezeDeepPairPilot();
    else if (Bun.argv[2] === "run" && Bun.argv[3] === "--accept-charges" && Bun.argv.length === 4) await runDeepPairPilot(process.env.OPENAI_API_KEY ?? "");
    else throw new Error("Use prepare, freeze, or run --accept-charges.");
  } catch { console.error("Depth-256/512 pilot did not complete. Inspect its frozen inputs and private dispatch records before further paid work."); process.exitCode = 1; }
}
