// Evaluate an independently replayed task file with private, durable authorization and outcome evidence.
import { chmodSync, closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { executeInference, parseInferenceRequest, type InferenceClient, type InferenceRequest, type InferenceResult } from "../../apps/api/src/inference";
import { getProfile } from "../../apps/api/src/protocol";
import { parseCredential } from "../../apps/api/src/providers/policy";
import { reflectsCredential } from "../../apps/api/src/providers/responses";
import { sameData, sha256 } from "../../apps/api/src/quality/data";
import { buildImportedPrompt } from "../../apps/api/src/randomized/pilot";
import type { ImportedCase } from "../../apps/api/src/randomized/types";
import { scoreClassifications } from "../../apps/api/src/scoring/classification";
import { computeUsage } from "../../apps/api/src/scoring/usage";
import { freezeData } from "../../apps/api/src/suites/generator";
import { loadTasks } from "./population";

export const taskEvaluationHelp = "Usage: bun run eval:run --input <tasks.json> --model <exact-openai-model-id> --credential-env <variable-name> --output <new-private-directory> --accept-charges [--trials <1..10>] [--profile <registered-profile-id>] [--concurrency <1..12>]\nDefaults: trials 1, profile one-shot-json-v1, concurrency 4. At most 10000 requests; no retries, resume, or publication. Existing output paths are rejected. Each dispatched request may incur charges, including cancelled work. SIGINT/SIGTERM abort active requests and retain unknown remote outcomes. Private files: manifest.json, dispatch-*.json, attempt-*.json, run.json, report.json. --help or -h prints this help.";

export interface TaskEvaluationRow {
  readonly caseId: string;
  readonly trialIndex: number;
  readonly requestSha256: string;
  dispatch: { readonly authorizedAt: string; readonly remoteOutcomeUntilRetained: "unknown" } | null;
  result: InferenceResult | null;
  localFailure: "outcome-not-retained" | null;
}

export interface TaskEvaluationOptions {
  readonly env?: Record<string, string | undefined>;
  readonly out?: (message: string) => void;
  readonly error?: (message: string) => void;
  readonly inferenceClient?: InferenceClient;
  readonly loadTasks?: typeof loadTasks;
  readonly syncDirectory?: (path: string) => void;
  readonly signal?: AbortSignal;
}

function parseArgs(args: readonly string[]) {
  const flags = new Map<string, string>();
  const allowed = ["--input", "--model", "--credential-env", "--output", "--accept-charges", "--trials", "--profile", "--concurrency"];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.includes(flag) || flags.has(flag)) throw new Error();
    if (flag === "--accept-charges") { flags.set(flag, "true"); continue; }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error();
    flags.set(flag, value);
  }
  const input = flags.get("--input"), model = flags.get("--model"), environment = flags.get("--credential-env"), output = flags.get("--output");
  const trials = flags.get("--trials") ?? "1", concurrency = flags.get("--concurrency") ?? "4";
  if (!input || !model || !output || !environment || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(environment)
    || !flags.has("--accept-charges") || !/^(?:[1-9]|10)$/.test(trials) || !/^(?:[1-9]|1[0-2])$/.test(concurrency)) throw new Error();
  const profile = getProfile(flags.get("--profile") ?? "one-shot-json-v1");
  return { input: resolve(input), output: resolve(output), environment, model, trials: Number(trials), concurrency: Number(concurrency), profile };
}

function syncDirectory(path: string) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function privateJson(path: string, value: unknown, credential: string, sync: (path: string) => void) {
  const text = `${JSON.stringify(value)}\n`;
  if (reflectsCredential(text, credential)) throw new Error();
  const fd = openSync(path, "wx", 0o600);
  try { fchmodSync(fd, 0o600); writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  sync(dirname(path));
}

// Reconstruct from the full planned population; infrastructure and unattempted rows remain excluded explicitly.
export function buildTaskEvaluationReport(cases: readonly ImportedCase[], rows: readonly TaskEvaluationRow[], trials: number) {
  if (!Number.isSafeInteger(trials) || trials < 1 || trials > 10 || rows.length !== cases.length * trials || !cases.length
    || new Set(cases.map(task => task.id)).size !== cases.length) throw new Error("Invalid planned report population.");
  for (const [index, row] of rows.entries()) {
    if (row.caseId !== cases[Math.floor(index / trials)].id || row.trialIndex !== index % trials || row.result && !row.dispatch)
      throw new Error("Report rows do not match the frozen case/trial order.");
  }
  const summarize = (selected: readonly ImportedCase[]) => {
    const tasks = new Map(selected.map(task => [task.id, task]));
    const subset = rows.filter(row => tasks.has(row.caseId));
    const classification = scoreClassifications(subset.map(row => ({ caseId: row.caseId, trialIndex: row.trialIndex,
      depth: tasks.get(row.caseId)!.requestedDepth, referenceLabel: tasks.get(row.caseId)!.label, outcome: row.result?.evidence.outcome ?? null })), trials);
    return { classification, planned: subset.length, authorized: subset.filter(row => row.dispatch).length,
      inferenceRequests: { known: subset.reduce((total, row) => total + (row.result?.inferenceRequests ?? 0), 0),
        unknownAuthorizations: subset.filter(row => row.dispatch && !row.result).length },
      unattempted: subset.filter(row => !row.dispatch).length,
      infrastructureFailures: subset.filter(row => row.dispatch && (!row.result || row.result.failure !== null
        || ["provider-error", "cancelled", "interrupted"].includes(row.result.evidence.outcome.kind))).length,
      unknownRemoteOutcomes: subset.filter(row => row.dispatch && (!row.result || row.result.failure?.remoteOutcome === "unknown")).length };
  };
  const overall = summarize(cases);
  return { version: "1", policy: "configurable-task-evaluation-v1", state: overall.classification.population.status === "complete" ? "complete" : "incomplete",
    trialsPerCase: trials, overall,
    byRequestedDepth: [...new Set(cases.map(task => task.requestedDepth))].map(requestedDepth => {
      const selected = cases.filter(task => task.requestedDepth === requestedDepth);
      return { requestedDepth, realizedDepths: [...new Set(selected.map(task => task.actualDepth))].sort((a, b) => a - b)
        .map(depth => ({ depth, count: selected.filter(task => task.actualDepth === depth).length })), ...summarize(selected) };
    }),
    reportedModelIds: [...new Set(rows.flatMap(row => row.result?.reportedModelId ? [row.result.reportedModelId] : []))], rowsSha256: sha256(rows) };
}

function validateResult(result: InferenceResult, request: InferenceRequest) {
  if (result.version !== "1" || result.policyId !== "individual-inference-v1" || !sameData(result.prompt, request.prompt)
    || !sameData(result.requested, { provider: "openai", modelId: request.selection.modelId, servingProvider: null, profileId: request.selection.profileId })
    || result.evidence.sequence !== 1 || result.evidence.outcome.profileId !== request.selection.profileId
    || ![0, 1].includes(result.inferenceRequests) || !Number.isSafeInteger(result.httpAttempts) || result.httpAttempts < result.inferenceRequests
    || (result.failure === null && (result.inferenceRequests !== 1 || !result.reportedModelId?.trim() || !result.metadata?.exactRoute
      || result.metadata.modelId !== request.selection.modelId || result.metadata.servingProvider !== null || result.reportedServingProvider !== null
      || !result.selection || !sameData(result.selection.request, request.selection)
      || result.effective.truncation === "auto" || result.effective.maxOutputTokens !== null && result.effective.maxOutputTokens !== request.prompt.generation.maxOutputTokens
      || request.prompt.generation.reasoning !== "provider-default" && result.effective.reasoningEffort !== request.prompt.generation.reasoning))) throw new Error();
}

export async function runTaskEvaluation(args: readonly string[], options: TaskEvaluationOptions = {}): Promise<number> {
  const out = options.out ?? console.log, error = options.error ?? console.error;
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) { out(taskEvaluationHelp); return 0; }
  let failure = taskEvaluationHelp, status = 1;
  let cancellationRequested = false;
  const controller = new AbortController(), interrupt = () => { cancellationRequested = true; controller.abort(); };
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  options.signal?.addEventListener("abort", interrupt, { once: true });
  try {
    const parsed = parseArgs(args);
    failure = "The exact task artifact could not be independently replayed. No provider work was started.";
    const tasks = await (options.loadTasks ?? loadTasks)(parsed.input, controller.signal);
    if (tasks.state !== "complete" || !tasks.cases.length || tasks.cases.length * parsed.trials > 10000) throw new Error();
    const requests = tasks.cases.map(task => {
      const prompt = { ...buildImportedPrompt(task), profileId: parsed.profile.id, responseFormat: parsed.profile.responseFormat,
        generation: { maxOutputTokens: parsed.profile.maxOutputTokens, sampling: parsed.profile.sampling, reasoning: parsed.profile.reasoning, tools: parsed.profile.tools } };
      return parseInferenceRequest({ selection: { provider: "openai", modelId: parsed.model, servingProvider: null, profileId: parsed.profile.id, verification: "metadata" }, prompt, acceptCharges: true });
    });
    failure = "The explicit credential environment variable is missing or invalid, or credential material occurs in run inputs.";
    const credential = parseCredential((options.env ?? process.env)[parsed.environment]);
    if (reflectsCredential(JSON.stringify({ parsed, tasks, requests }), credential)) throw new Error();
    failure = "The evaluation was cancelled before provider work started.";
    if (options.signal?.aborted || controller.signal.aborted) throw new Error();
    const rows: TaskEvaluationRow[] = tasks.cases.flatMap((task, index) => Array.from({ length: parsed.trials }, (_, trialIndex) => ({
      caseId: task.id, trialIndex, requestSha256: sha256(requests[index]), dispatch: null, result: null, localFailure: null })));
    const manifest = freezeData({ version: "1", policy: "configurable-task-evaluation-v1", startedAt: new Date().toISOString(), input: parsed.input,
      tasks, tasksSha256: sha256(tasks), provider: "openai", modelId: parsed.model,
      profile: { id: parsed.profile.id, protocolVersion: parsed.profile.protocolVersion, responseFormat: parsed.profile.responseFormat,
        reasoning: parsed.profile.reasoning, maxOutputTokens: parsed.profile.maxOutputTokens, sampling: parsed.profile.sampling, tools: parsed.profile.tools }, trialsPerCase: parsed.trials,
      concurrency: parsed.concurrency, budget: { maxInferenceRequests: rows.length, maxOutputTokensPerRequest: parsed.profile.maxOutputTokens,
        maxOutputTokensTotal: rows.length * parsed.profile.maxOutputTokens, retries: 0, inferenceTimeoutMs: 180000 }, requests, rows: structuredClone(rows) });
    failure = "The output directory must be fresh and its parent writable. No provider work was started.";
    mkdirSync(parsed.output, { mode: 0o700 }); chmodSync(parsed.output, 0o700);
    const sync = options.syncDirectory ?? syncDirectory;
    failure = "The immutable manifest could not be durably saved. No provider work was started.";
    privateJson(join(parsed.output, "manifest.json"), manifest, credential, sync); sync(dirname(parsed.output));
    const manifestSha256 = sha256(manifest);
    let next = 0, storageFailure = false;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const index = next++;
        if (index >= rows.length) return;
        const row = rows[index], request = requests[Math.floor(index / parsed.trials)], ordinal = String(index + 1).padStart(5, "0");
        try {
          const dispatch = { authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" as const };
          privateJson(join(parsed.output, `dispatch-${ordinal}.json`), { manifestSha256, ordinal: index + 1, caseId: row.caseId,
            trialIndex: row.trialIndex, requestSha256: row.requestSha256, ...dispatch }, credential, sync);
          row.dispatch = dispatch;
        } catch { storageFailure = true; controller.abort(); return; }
        try {
          const result = await (options.inferenceClient ?? executeInference)(request, credential, controller.signal);
          validateResult(result, request);
          privateJson(join(parsed.output, `attempt-${ordinal}.json`), { manifestSha256, ordinal: index + 1, requestSha256: row.requestSha256, result }, credential, sync);
          row.result = result;
          if (result.failure !== null || ["provider-error", "cancelled", "interrupted"].includes(result.evidence.outcome.kind)) controller.abort();
        } catch {
          row.localFailure = "outcome-not-retained";
          storageFailure = true; controller.abort();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parsed.concurrency, rows.length) }, worker));
    const report = { ...buildTaskEvaluationReport(tasks.cases, rows, parsed.trials), tasksSha256: manifest.tasksSha256,
      modelId: parsed.model, provider: "openai", profile: manifest.profile, budget: manifest.budget,
      usage: computeUsage(rows.map(row => ({ caseId: row.caseId, trialIndex: row.trialIndex, finalAttempt: row.result ? 1 : null,
        elapsedMs: row.result?.evidence.elapsedMs ?? null, attempts: row.result ? [row.result.evidence] : [] }))) };
    failure = "Private final exports failed. Preserve the immutable manifest and dispatch/attempt files; do not repeat paid work to repair an export.";
    privateJson(join(parsed.output, "run.json"), { manifestSha256, finishedAt: new Date().toISOString(), cancelled: cancellationRequested,
      state: report.state, tasksSha256: manifest.tasksSha256, modelId: parsed.model, profile: manifest.profile,
      budget: manifest.budget, concurrency: parsed.concurrency, trialsPerCase: parsed.trials, rows, usage: report.usage, reportSha256: sha256(report) }, credential, sync);
    privateJson(join(parsed.output, "report.json"), { manifestSha256, ...report }, credential, sync);
    status = !storageFailure && !controller.signal.aborted && report.state === "complete" ? 0 : 1;
    if (status) error("Evaluation incomplete. Inspect retained attempts, unknown remote outcomes, and unattempted rows before another paid run.");
    out(JSON.stringify({ output: parsed.output, run: join(parsed.output, "run.json"), report: join(parsed.output, "report.json") }));
  } catch { error(failure); }
  finally {
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
    options.signal?.removeEventListener("abort", interrupt);
  }
  return status;
}
