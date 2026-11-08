// A separately capped follow-up fills only missing model/population cells and retains every dispatch.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInferenceClient, type InferenceResult } from "../inference";
import type { SelectionResult } from "../discovery";
import type { Label } from "../math";
import { buildPrompt, type PromptBlueprint } from "../protocol";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { scoreClassifications } from "../scoring/classification";
import { scoreEvaluation } from "../scoring/scorer";
import { validateFrozenSuite } from "../suites";
import { createDepth100Population } from "./depth100";
import { buildDepth216Prompt, replayDepth216Population } from "./depth216-reference";
import { checkDepth60Suite, countDepth60UnknownSends, isDepth60ModelOutcome } from "./depth60";

const root = new URL("../../data/", import.meta.url);
const privateRoot = new URL("private/fast-table-fill-v1/", root);
const manifestPath = new URL("experiments/fast-table-fill-matrix-v1.json", root);
const summaryPath = new URL("quality/fast-table-fill-v1.json", root);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const models = ["gpt-5.4-mini", "gpt-5.6-luna", "gpt-6-luna", "gpt-5.6-terra", "gpt-6.1-terra"] as const;
export const fastCells = [
  { key: "screening-standard", models: models.slice(0, 1) },
  { key: "depth60", models: models.slice(3) },
  { key: "depth100", models: [...models] },
  { key: "depth216", models: [...models] },
];
interface Task { caseId: string; depth: number; label: Label; prompt: PromptBlueprint }
export interface FastRow { cell: string; modelId: string; caseId: string; trialIndex: number; dispatched: boolean; result: InferenceResult | null }
export function fastRows(tasks: Readonly<Record<string, readonly Task[]>>): FastRow[] {
  const rows = fastCells.flatMap(cell => cell.models.flatMap(modelId => tasks[cell.key].flatMap(task => [0, 1, 2].map(trialIndex => ({
    cell: cell.key, modelId, caseId: task.caseId, trialIndex, dispatched: false, result: null,
  })))));
  if (rows.length !== 351 || new Set(rows.map(row => `${row.cell}:${row.modelId}:${row.caseId}:${row.trialIndex}`)).size !== rows.length)
    throw new Error("The fixed follow-up must contain 351 unique trials.");
  return rows.sort((a, b) => hash(JSON.stringify(a)).localeCompare(hash(JSON.stringify(b))));
}

export async function fastPool<T>(rows: readonly T[], concurrency: number, signal: AbortSignal, work: (row: T) => Promise<void>) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24) throw new Error("Follow-up concurrency must be 1–24.");
  let cursor = 0, failed = false;
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(rows.length, concurrency) }, async () => {
    try { while (!failed && !signal.aborted && cursor < rows.length) await work(rows[cursor++]); }
    catch (error) { failed = true; throw error; }
  }));
  if (outcomes.some(row => row.status === "rejected")) throw new Error("Follow-up worker failed; retained evidence must be inspected.");
}
export function assertFastDispatch(bodyText: string, row: FastRow, prompt: PromptBlueprint, sends: number, method: string | undefined) {
  const body = JSON.parse(bodyText);
  if (method !== "POST" || sends >= 351 || row.dispatched || body.model !== row.modelId || body.max_output_tokens !== 4096 || body.store !== false || body.truncation !== "disabled" || body.reasoning !== undefined || JSON.stringify(body.input) !== JSON.stringify(prompt.messages))
    throw new Error("Unexpected or repeated follow-up dispatch.");
}
export async function retainNativeScreening(score: () => Promise<Awaited<ReturnType<typeof scoreEvaluation>>>, save: (name: string, value: unknown) => Promise<void>) {
  try {
    const report = await score();
    await save("screening-native-report.json", report);
    return { nativeReportSha256: hash(JSON.stringify(report)), scoringFailure: null };
  } catch {
    return { nativeReportSha256: null, scoringFailure: "Native screening scoring or proof replay failed; inspect private evidence." };
  }
}
export function assertFastAccess(access: { kind: string; results: SelectionResult[] }) {
  if (access.kind !== "metadata-only-not-inference-evidence" || access.results.length !== 5 || models.some(model => !access.results.some(row =>
    row.request.modelId === model && row.request.verification === "metadata" && row.failure === null && row.status === "needs-verification" &&
    row.budget.maxInferenceRequests === 0 && row.probe.status === "not-requested" && row.probe.outcome === null &&
    row.probe.usage.inputTokens === null && row.probe.usage.outputTokens === null)))
    throw new Error("Expected five metadata-only checks; these do not establish inference permission.");
}
export function fastConcurrency(headers: readonly { modelId: string; requests: number; tokens: number }[]) {
  return headers.length === 5 && models.every(model => headers.some(row => row.modelId === model)) &&
    headers.every(row => row.requests >= 351 && row.tokens >= 1000000) ? 24 : 5;
}

export async function fastFillInputs() {
  const sources: { path: string; sha256: string }[] = [];
  const loadText = async (path: string) => { const text = await readFile(new URL(path, root), "utf8"); sources.push({ path, sha256: hash(text) }); return text; };
  const load = async (path: string) => JSON.parse(await loadText(path));
  const access = await load("experiments/fast-table-fill-access-v1.json");
  assertFastAccess(access);
  const checkPrior = async (stem: string, methodId: string, count: number, cumulative: number) => {
    const progress = await load(`experiments/${stem}-progress-v1.json`);
    const manifest = await load(`experiments/${stem}-matrix-v1.json`);
    const retained = await load(`private/${stem}-v1/result.json`);
    const identity = (row: { modelId: string; caseId: string; trialIndex: number }) => `${row.modelId}:${row.caseId}:${row.trialIndex}`;
    const byIdentity = new Map<string, { dispatched: boolean; result: InferenceResult | null }>(retained.rows.map((row: FastRow) => [identity(row), row]));
    if (progress.methodId !== methodId || progress.state !== "settled" || progress.inferenceRequests !== count || progress.cumulativeConservativeRequests !== cumulative ||
      progress.rows.length !== count || retained.rows.length !== count || byIdentity.size !== count || new Set(progress.rows.map(identity)).size !== count ||
      progress.manifestSha256 !== hash(JSON.stringify(manifest)) || retained.manifestSha256 !== progress.manifestSha256 || retained.inferenceRequests !== count || retained.cumulativeConservativeRequests !== cumulative ||
      progress.rows.some((row: FastRow & { resultSha256: string | null; failure: unknown }) => {
        const source = byIdentity.get(identity(row));
        return !row.dispatched || row.failure !== null || !source?.dispatched || !isDepth60ModelOutcome(source.result) || row.resultSha256 !== hash(JSON.stringify(source.result));
      })) throw new Error(`Wait for matching complete terminal evidence from ${stem} before this batch.`);
  };
  await checkPrior("depth216", "depth216-pilot-v1", 54, 8124);
  await checkPrior("deep-pair", "deep-pair-pilot-v1", 36, 8160);
  const depth60 = await validateFrozenSuite(await load("suites/depth60-v1.json"));
  checkDepth60Suite(depth60);
  const depth100 = createDepth100Population();
  if (JSON.stringify(await load("research/depth100-population-v1.json")) !== JSON.stringify(depth100)) throw new Error("Depth-100 proof replay changed.");
  const depth216 = replayDepth216Population(await loadText("research/depth216-population-v1.json"));
  for (const depth of [60, 100, 216]) {
    const review = await load(`quality/depth${depth}-reference-review-v1.json`);
    const source = sources.find(row => row.path === (depth === 60 ? "suites/depth60-v1.json" : `research/depth${depth}-population-v1.json`));
    if (review.verdict !== "pass" || review.suiteFileSha256 !== source?.sha256 || review.cases.length !== 9) throw new Error(`Independent reference review mismatch at depth ${depth}.`);
  }
  const snapshot = JSON.parse(await readFile(new URL("../../../web/public/landing-scores.json", import.meta.url), "utf8"));
  const selected = snapshot.models.find((row: { modelId: string }) => row.modelId === "gpt-6-luna").selectedRunIds[0];
  const measurement = snapshot.measurements.find((row: { runId: string }) => row.runId === selected);
  const archiveText = await readFile(new URL(`../../../${measurement.sourcePath}`, root), "utf8");
  // The snapshot binds semantic JSON hashes, not raw file whitespace.
  const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value !== null && typeof value === "object"
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
  const archive = JSON.parse(archiveText);
  if (hash(canonical(archive)) !== measurement.sourceSha256 || archive.record.suite.id !== snapshot.columns[0].comparison.suiteId || archive.record.suite.cases.length !== 9)
    throw new Error("Exact archived screening suite and prompt source are required.");
  sources.push({ path: measurement.sourcePath, sha256: hash(archiveText) });
  const screening = archive.record.suite;
  const tasks: Record<string, Task[]> = {
    "screening-standard": screening.cases.map((entry: { id: string; depth: number; label: Label }, index: number) => ({ caseId: entry.id, depth: entry.depth, label: entry.label, prompt: archive.record.prompts[index] })),
    depth60: depth60.cases.map(entry => ({ caseId: entry.id, depth: 60, label: entry.label, prompt: buildPrompt(entry.reference, "one-shot-json-v1") })),
    depth100: depth100.cases.map(entry => ({ caseId: entry.id, depth: 100, label: entry.label, prompt: buildPrompt(entry.reference, "one-shot-json-v1") })),
    depth216: depth216.cases.map(entry => ({ caseId: entry.id, depth: 216, label: entry.label, prompt: buildDepth216Prompt(entry.id) })),
  };
  for (const path of ["../src/inference/client.ts", "../src/inference/policy.ts", "../src/providers/openai.ts", "../src/providers/transport.ts", "../package.json", "../../../patches/openai@7.53.0.patch"])
    await loadText(path);
  sources.push({ path: "runner", sha256: hash(await readFile(new URL("fast-table-fill.ts", import.meta.url), "utf8")) });
  return { sources, tasks, screening, screeningModel: archive.record.evidence.model };
}

export async function freezeFastFill() {
  const { sources, tasks } = await fastFillInputs();
  const rows = fastRows(tasks);
  const manifest = { version: "1", methodId: "fast-table-fill-v1", frozenAt: new Date().toISOString(), models, cells: fastCells, sources,
    promptsSha256: hash(JSON.stringify(tasks)), rowsSha256: hash(JSON.stringify(rows)),
    priorInferenceRequests: 8160, newAuthorizedMaximum: 351, cumulativeMaximum: 8511, historicalCeilingUnchanged: 8192,
    profileId: "one-shot-json-v1", maxOutputTokens: 4096, inferenceDeadlineMs: 180000, retries: 0, maxConcurrency: 24, screeningConcurrency: 4,
    interpretation: "New user-authorized exploratory follow-up after prior outcomes were inspected; separate populations and depth-216 research policy. Original frozen budgets and results remain unchanged." };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ frozen: manifest.methodId, requests: rows.length, cumulativeMaximum: 8511 }));
}

export async function runFastFill(credentialInput: string) {
  const credential = parseCredential(credentialInput), input = await fastFillInputs();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")), rows = fastRows(input.tasks);
  if (JSON.stringify(manifest.sources) !== JSON.stringify(input.sources) || manifest.promptsSha256 !== hash(JSON.stringify(input.tasks)) || manifest.rowsSha256 !== hash(JSON.stringify(rows)) ||
    manifest.methodId !== "fast-table-fill-v1" || manifest.priorInferenceRequests !== 8160 || manifest.historicalCeilingUnchanged !== 8192 || JSON.stringify(manifest.models) !== JSON.stringify(models) || JSON.stringify(manifest.cells) !== JSON.stringify(fastCells) || !Number.isFinite(Date.parse(manifest.frozenAt)) || Date.parse(manifest.frozenAt) > Date.now() || manifest.newAuthorizedMaximum !== 351 || manifest.cumulativeMaximum !== 8511 || manifest.profileId !== "one-shot-json-v1" || manifest.maxOutputTokens !== 4096 || manifest.maxConcurrency !== 24 || manifest.screeningConcurrency !== 4 || manifest.retries !== 0 || manifest.inferenceDeadlineMs !== 180000)
    throw new Error("Frozen follow-up sources or budget changed.");
  await mkdir(new URL("private/", root), { recursive: true, mode: 0o700 });
  await mkdir(privateRoot, { mode: 0o700 });
  const controller = new AbortController(), signal = controller.signal, stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  let sends = 0, settled = 0;
  const startedAt = new Date().toISOString();
  const blocked = new Set<string>(), headers: { modelId: string; requests: number; tokens: number }[] = [];
  const save = async (name: string, value: unknown) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (reflectsCredential(text, credential)) { controller.abort(); throw new Error("Credential-reflecting evidence discarded."); }
    try { await writeFile(new URL(name, privateRoot), text, { flag: "wx", mode: 0o600 }); }
    catch { controller.abort(); throw new Error("Evidence persistence failed; stop and inspect dispatch receipts."); }
  };
  const work = async (row: FastRow) => {
    if (blocked.has(row.modelId)) return;
    const task = input.tasks[row.cell].find(entry => entry.caseId === row.caseId)!;
    const infer = createInferenceClient(async (url, init) => {
      signal.throwIfAborted();
      if (url === "https://api.openai.com/v1/responses") {
        assertFastDispatch(String(init.body), row, task.prompt, sends, init.method);
        row.dispatched = true;
        await save(`dispatch-${++sends}.json`, { ordinal: sends, cell: row.cell, modelId: row.modelId, caseId: row.caseId, trialIndex: row.trialIndex, requestBodySha256: hash(String(init.body)), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" });
        signal.throwIfAborted();
      }
      const response = await fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false });
      if (url.endsWith("/responses")) headers.push({ modelId: row.modelId, requests: Number(response.headers.get("x-ratelimit-remaining-requests") ?? "NaN"), tokens: Number(response.headers.get("x-ratelimit-remaining-tokens") ?? "NaN") });
      return response;
    });
    row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, prompt: task.prompt, acceptCharges: true }, credential, signal);
    await save(`outcome-${row.cell}-${row.modelId}-${row.caseId}-${row.trialIndex}.json`, row);
    if (row.result.budget.maxInferenceRequests !== 1 || row.result.budget.maxOutputTokens !== 4096 || row.result.budget.inferenceTimeoutMs !== 180000 || row.result.budget.retries !== 0 || row.result.requested.modelId !== row.modelId || row.result.requested.profileId !== "one-shot-json-v1") {
      controller.abort(); throw new Error("Retained result differs from the frozen request/deadline contract.");
    }
    settled++;
    if (!isDepth60ModelOutcome(row.result)) {
      if (row.result.failure && ["model-unavailable", "invalid-provider-response"].includes(row.result.failure.code)) blocked.add(row.modelId);
      else controller.abort();
    }
    if (settled % 27 === 0) console.log(JSON.stringify({ settled, dispatched: sends, planned: rows.length }));
  };
  let failed = false, concurrency = 5;
  try {
    await save("manifest.json", manifest);
    try {
      const first = models.map(model => rows.find(row => row.modelId === model)!);
      await fastPool(first, 5, signal, work);
      concurrency = fastConcurrency(headers);
      console.log(JSON.stringify({ concurrency, initialModels: first.map(row => row.modelId), headroom: headers.slice(0, 5) }));
      const remaining = rows.filter(row => !first.includes(row));
      // Screening preserves its original four-worker contract, separate from research workers.
      await fastPool(remaining.filter(row => row.cell !== "screening-standard"), concurrency, signal, work);
      await fastPool(remaining.filter(row => row.cell === "screening-standard"), 4, signal, work);
    } catch { failed = true; controller.abort(); }
    const reports = fastCells.flatMap(cell => cell.models.map(modelId => {
      const selected = rows.filter(row => row.cell === cell.key && row.modelId === modelId);
      const observations = selected.map(row => { const task = input.tasks[cell.key].find(entry => entry.caseId === row.caseId)!;return { caseId: row.caseId, depth: task.depth, referenceLabel: task.label, trialIndex: row.trialIndex, outcome: row.result?.evidence.outcome ?? null }; });
      const classification = scoreClassifications(observations, 3);
      return { cell: cell.key, modelId, classification, byDepth: [...new Set(observations.map(row => row.depth))].sort((a,b) => a-b).map(depth => ({ depth, classification: scoreClassifications(observations.filter(row => row.depth === depth), 3) })) };
    }));
    const screeningRows = rows.filter(row => row.cell === "screening-standard");
    const { nativeReportSha256, scoringFailure } = await retainNativeScreening(() => scoreEvaluation({ suite: input.screening, evidence: {
      runId: randomUUID(), suiteId: input.screening.id, protocolVersion: "1", profileId: "one-shot-json-v1",
      model: { ...input.screeningModel, modelId: "gpt-5.4-mini" }, run: { elapsedMs: null, concurrency: 4 }, expressionTokens: [],
      trials: screeningRows.map(row => ({ caseId: row.caseId, trialIndex: row.trialIndex, finalAttempt: row.result ? 1 : null, elapsedMs: row.result?.evidence.elapsedMs ?? null, attempts: row.result ? [row.result.evidence] : [] })),
    } }), save);
    if (scoringFailure !== null) failed = true;
    const result = { version: "1", methodId: manifest.methodId, startedAt, finishedAt: new Date().toISOString(), manifestSha256: hash(JSON.stringify(manifest)),
      inferenceRequests: sends, priorInferenceRequests: 8160, cumulativeConservativeRequests: 8160 + sends, concurrency, screeningConcurrency: 4,
      unknownRemoteInferenceRequests: countDepth60UnknownSends(rows), scoringFailure, nativeReportSha256,
      state: failed || signal.aborted || rows.some(row => !isDepth60ModelOutcome(row.result)) ? "incomplete" : "complete", headers, reports, rows };
    await save("result.json", result);
    const summary = { ...result, rows: rows.map(({ cell, modelId, caseId, trialIndex, dispatched, result }) => ({ cell, modelId, caseId, trialIndex, dispatched,
      resultSha256: result ? hash(JSON.stringify(result)) : null, outcome: result?.evidence.outcome.kind ?? "unattempted", failure: result?.failure ?? null })) };
    const text = `${JSON.stringify(summary, null, 2)}\n`;
    if (reflectsCredential(text, credential)) throw new Error("Unsafe public metrics discarded.");
    await writeFile(summaryPath, text, { flag: "wx" });
    console.log(JSON.stringify({ state: summary.state, inferenceRequests: sends, cumulative: summary.cumulativeConservativeRequests, cells: reports.map(row => ({ cell: row.cell, model: row.modelId, population: row.classification.population, macroF1: row.classification.macroF1 })) }));
    if (summary.state !== "complete") throw new Error("Batch incomplete; failures and missing outcomes retained without retries.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    if (Bun.argv[2] === "freeze" && Bun.argv.length === 3) await freezeFastFill();
    else if (Bun.argv[2] === "run" && Bun.argv[3] === "--accept-charges" && Bun.argv.length === 4) await runFastFill(process.env.OPENAI_API_KEY ?? "");
    else throw new Error("Use freeze or run --accept-charges.");
  } catch (error) { console.error(error instanceof Error ? error.message : "Fast-model follow-up failed; inspect retained evidence."); process.exitCode = 1; }
}
