// A bounded research pilot uses compact absolute-value sums without widening the standard suite or verifier limits.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient, type InferenceResult } from "../inference";
import { verifyReference, type CanonicalReference, type Expression, type Label } from "../math";
import { buildPrompt } from "../protocol";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { scoreClassifications } from "../scoring/classification";
import { DEPTH60_MODELS, runDepth60Pool } from "./depth60";

const root = new URL("../../data/", import.meta.url), populationPath = new URL("research/depth100-population-v1.json", root);
const manifestPath = new URL("experiments/depth100-matrix-v1.json", root), privateRoot = new URL("private/depth100-v1/", root);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const load = async (path: URL) => JSON.parse(await readFile(path, "utf8"));
const variable = (): Expression => ({ op: "variable" });

export function createDepth100Population() {
  const cases = (["convex", "concave", "neither"] as const).flatMap((label: Label) => [64, 68, 72].map(denominator => {
    const centers = Array.from({ length: 49 }, (_, i) => [-(i + 1), i + 1]).flat();
    if (label === "convex") centers.push(0);
    centers.sort((a, b) => a - b);
    const terms: Expression[] = centers.map(numerator => ({ op: "abs", arg: { op: "add", left: variable(), right: { op: "constant", value: `${-numerator}/${denominator}` } } }));
    const sum = terms.reduce((left, right): Expression => ({ op: "add", left, right }));
    const expression: Expression = label === "convex" ? sum : label === "concave" ? { op: "negate", arg: sum } : { op: "multiply", left: variable(), right: sum };
    const reference: CanonicalReference = { expression, domain: { min: "-1", max: "1" }, claimedLabel: label,
      witnessPairs: label === "neither" ? [{ x: "-1", y: "0" }, { x: "0", y: "1" }] : [{ x: "-1", y: "1" }] };
    const verified = verifyReference(reference);
    if (verified.status !== "verified" || verified.label !== label || verified.certificate.depth !== 100 || verified.certificate.nodeCount > 512) throw new Error("Depth-100 reference certification failed.");
    return { id: `case-depth100-v1-${verified.certificate.fingerprint}`, depth: 100, label, denominator, centers: centers.map(n => `${n}/${denominator}`),
      reference: verified.certificate.input, certificate: verified.certificate };
  }));
  if (new Set(cases.map(row => row.id)).size !== 9) throw new Error("Depth-100 reference identities repeat.");
  return { version: "1", kind: "research-absolute-sum-population", methodId: "depth100-pilot-v1", profileId: "one-shot-json-v1", cases,
    interpretation: "A single templated absolute-sum family with measured AST depth 100. Associative sum representation, length and kink count are confounded. Class-specific outer forms permit shortcuts. No causal depth, ranking, cross-population or frontier-failure claim." };
}

async function inputs() {
  const populationText = await readFile(populationPath, "utf8"), population = createDepth100Population();
  if (JSON.stringify(JSON.parse(populationText)) !== JSON.stringify(population)) throw new Error("The retained depth-100 population differs from exact reproduction.");
  const reviewText = await readFile(new URL("quality/depth100-reference-review-v1.json", root), "utf8"), review = JSON.parse(reviewText);
  if (review.suiteFileSha256 !== hash(populationText) || review.verdict !== "pass" || review.cases.length !== 9) throw new Error("Matching independent reference evidence is required.");
  const priorText = await readFile(new URL("experiments/depth60-progress-v1.json", root), "utf8"), prior = JSON.parse(priorText);
  if (prior.inferenceRequests !== 54 || prior.cumulativeConservativeRequests !== 7908 || prior.rows.length !== 54 || prior.rows.some((row: { failure: unknown; resultSha256: string | null }) => row.failure !== null || row.resultSha256 === null)) throw new Error("The terminal depth-60 accounting is required.");
  return { population, bindings: { populationFileSha256: hash(populationText), reviewFileSha256: hash(reviewText), priorProgressFileSha256: hash(priorText) } };
}

export async function freezeDepth100Pilot() {
  const { bindings } = await inputs();
  const manifest = { version: "1", methodId: "depth100-pilot-v1", frozenAt: new Date().toISOString(), ...bindings, models: DEPTH60_MODELS,
    profileId: "one-shot-json-v1", caseCount: 9, trialsPerCase: 3, maxInferenceRequests: 54, priorInferenceRequests: 7908,
    cumulativeInferenceCeiling: 7962, sharedCeiling: 8192, maxConcurrency: 12, retries: 0, maxOutputTokens: 4096, inferenceDeadlineMs: 180000 };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(manifest));
}

export async function runDepth100Pilot(suppliedCredential: string) {
  const credential = parseCredential(suppliedCredential), { population, bindings } = await inputs(), manifest = await load(manifestPath);
  if (Object.entries(bindings).some(([key, value]) => manifest[key] !== value) || JSON.stringify(manifest.models) !== JSON.stringify(DEPTH60_MODELS)
    || manifest.maxInferenceRequests !== 54 || manifest.priorInferenceRequests !== 7908 || manifest.cumulativeInferenceCeiling !== 7962
    || manifest.maxOutputTokens !== 4096 || manifest.maxConcurrency !== 12 || manifest.retries !== 0) throw new Error("The frozen depth-100 budget or evidence changed.");
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
  const infer = createInferenceClient(async (url, init) => {
    signal.throwIfAborted();
    if (url === "https://api.openai.com/v1/responses") {
      const body = JSON.parse(String(init.body));
      if (init.method !== "POST" || sends >= 54 || !DEPTH60_MODELS.includes(body.model) || body.max_output_tokens !== 4096 || body.store !== false) throw new Error("Unexpected depth-100 dispatch.");
      const ordinal = ++sends;
      await save(`dispatch-${ordinal}.json`, { ordinal, modelId: body.model, authorizedAt: new Date().toISOString(), requestBodySha256: hash(String(init.body)), remoteOutcomeUntilRetained: "unknown" });
    }
    const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false });
    if (url.endsWith("/responses")) headers.push({ modelId: JSON.parse(String(init.body)).model, status: response.status,
      remainingRequests: response.headers.get("x-ratelimit-remaining-requests"), remainingTokens: response.headers.get("x-ratelimit-remaining-tokens") });
    return response;
  });
  const rows = population.cases.flatMap(entry => [0, 1, 2].flatMap(trialIndex => DEPTH60_MODELS.map(modelId => ({ modelId, caseId: entry.id, trialIndex, result: null as InferenceResult | null }))));
  const work = async (row: (typeof rows)[number]) => {
    try {
      const entry = population.cases.find(entry => entry.id === row.caseId)!;
      row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" },
        prompt: buildPrompt(entry.reference, "one-shot-json-v1"), acceptCharges: true }, credential, signal);
      await save(`${row.modelId}-${population.cases.indexOf(entry)}-${row.trialIndex}.json`, row);
      if (row.result.failure) controller.abort();
    } catch (error) { controller.abort(); throw error; }
  };
  try {
    await save("manifest.json", manifest);
    await runDepth60Pool(rows.slice(0, 2), 2, signal, work);
    const concurrency = headers.length === 2 && headers.every(row => Number(row.remainingRequests) >= 54 && Number(row.remainingTokens) >= 100000) ? 12 : 2;
    await runDepth60Pool(rows.slice(2), concurrency, signal, work);
    const reports = DEPTH60_MODELS.map(modelId => ({ modelId, report: { kind: "research-classification-only", overall: { classification: scoreClassifications(rows.filter(row => row.modelId === modelId).map(row => ({
      caseId: row.caseId, trialIndex: row.trialIndex, depth: 100, referenceLabel: population.cases.find(entry => entry.id === row.caseId)!.label, outcome: row.result?.evidence.outcome ?? null })), 3) } } }));
    const result = { version: "1", methodId: manifest.methodId, finishedAt: new Date().toISOString(), manifestSha256: hash(JSON.stringify(manifest)), inferenceRequests: sends,
      cumulativeConservativeRequests: 7908 + sends, concurrency, rateLimitEvidence: headers, rows, reports, interpretation: population.interpretation };
    await save("result.json", result);
    const summary = { ...result, rows: rows.map(({ modelId, caseId, trialIndex, result }) => ({ modelId, caseId, trialIndex,
      resultSha256: result ? hash(JSON.stringify(result)) : null, outcome: result?.evidence.outcome.kind ?? "unattempted", failure: result?.failure ?? null })) };
    await writeFile(new URL("experiments/depth100-progress-v1.json", root), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ inferenceRequests: sends, concurrency, models: reports.map(row => ({ modelId: row.modelId, population: row.report.overall.classification.population, macroF1: row.report.overall.classification.macroF1 })) }));
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    if (Bun.argv[2] === "prepare" && Bun.argv.length === 3) await writeFile(populationPath, `${JSON.stringify(createDepth100Population(), null, 2)}\n`, { flag: "wx" });
    else if (Bun.argv[2] === "freeze" && Bun.argv.length === 3) await freezeDepth100Pilot();
    else if (Bun.argv[2] === "run" && Bun.argv[3] === "--accept-charges" && Bun.argv.length === 4) await runDepth100Pilot(process.env.OPENAI_API_KEY ?? "");
    else throw new Error("Use prepare, freeze, or run --accept-charges.");
  } catch { console.error("Depth-100 pilot did not complete. Inspect its frozen inputs and private dispatch records before further paid work."); process.exitCode = 1; }
}
