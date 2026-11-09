// Run the registered composition workload with private local evidence and explicit charge consent.
import { chmodSync, closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { InferenceClient } from "../apps/api/src/inference";
import { calculateWorkload } from "../apps/api/src/protocol";
import { parseCredential } from "../apps/api/src/providers/policy";
import { reflectsCredential } from "../apps/api/src/providers/responses";
import { createRunService, createRunStore, loadRunSuite, parseRunRequest, RUN_POLICY, type RunEvent, type RunStore } from "../apps/api/src/runs";

const usage = "Usage: bun run eval:run --suite composition-v1 --model <openai-model-id> --credential-env <variable-name> --output <new-private-directory> --accept-charges [--profile <profile-id>] [--concurrency <1..12>]";
const help = `${usage}\nOpenAI only. Default profile: one-shot-json-v1; concurrency: 4.\nEach of 27 certified cases has 3 fresh trials (81 maximum inference requests), with no retry, resumption, substitution, or publication. Every dispatched request may incur charges, including cancelled work.\nPrivate artifacts: receipt.json (including access code), runs.sqlite, run.json (full run view), report.json. SIGINT/SIGTERM stop new work and preserve settled evidence; remote charges may remain unknown. Existing output paths are rejected.`;
interface CliOptions {
  readonly env?: Record<string, string | undefined>;
  readonly out?: (message: string) => void;
  readonly error?: (message: string) => void;
  readonly inferenceClient?: InferenceClient;
  readonly loadSuite?: typeof loadRunSuite;
  readonly createStore?: typeof createRunStore;
  readonly syncDirectory?: (path: string) => void;
  readonly signal?: AbortSignal;
}

function parseArgs(args: readonly string[]) {
  const options = new Map<string, string>();
  const allowed = ["--suite", "--model", "--credential-env", "--output", "--profile", "--concurrency", "--accept-charges"];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!allowed.includes(flag) || options.has(flag)) throw new Error();
    if (flag === "--accept-charges") { options.set(flag, "true"); continue; }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error();
    options.set(flag, value);
  }
  const environment = options.get("--credential-env"), output = options.get("--output");
  if (options.get("--suite") !== "composition-v1" || !environment || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(environment) || !output || !options.has("--model")) throw new Error();
  const concurrency = options.get("--concurrency") ?? String(RUN_POLICY.defaultConcurrency);
  if (!/^(?:[1-9]|1[0-2])$/.test(concurrency)) throw new Error();
  const request = parseRunRequest({ suiteKey: "composition-v1", provider: "openai", modelId: options.get("--model"), servingProvider: null,
    profileId: options.get("--profile") ?? "one-shot-json-v1", concurrency: Number(concurrency), acceptCharges: options.has("--accept-charges") });
  return { request, environment, output: resolve(output) };
}

// The start event is synchronous: flush its private receipt before the engine can dispatch work.
function writePrivateJson(path: string, value: unknown, credential: string) {
  const text = `${JSON.stringify(value)}\n`;
  if (reflectsCredential(text, credential)) throw new Error();
  const descriptor = openSync(path, "wx", 0o600);
  try { fchmodSync(descriptor, 0o600); writeFileSync(descriptor, text); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
}

function syncDirectory(path: string) {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
}

export async function runCli(args: readonly string[], options: CliOptions = {}): Promise<number> {
  const out = options.out ?? console.log, error = options.error ?? console.error;
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) { out(help); return 0; }
  let store: RunStore | undefined, receipt: Extract<RunEvent, { type: "started" }> | undefined;
  let directory = "", credential = "", status = 1, startedReceiptSaved = false;
  let failure = `${usage}\nExplicit --accept-charges and an environment credential are required.`;
  const controller = new AbortController(), interrupt = () => controller.abort();
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  options.signal?.addEventListener("abort", interrupt, { once: true });
  try {
    const parsed = parseArgs(args);
    failure = "The selected credential environment variable is missing or invalid.";
    credential = parseCredential((options.env ?? process.env)[parsed.environment]);
    failure = "The request or output path contains credential material. Choose safe identifiers and a private output path.";
    if (reflectsCredential(JSON.stringify(parsed), credential)) throw new Error();
    failure = "The certified suite could not be loaded within its supported workload. Check the suite artifacts and numerical runtime.";
    const suite = await (options.loadSuite ?? loadRunSuite)(parsed.request.suiteKey, parsed.request.profileId);
    const workload = calculateWorkload(parsed.request.profileId, suite.cases.length);
    if (suite.generatorVersion !== "composition-v1" || suite.request.profileId !== parsed.request.profileId || suite.cases.length !== 27 || workload.logicalCalls !== 81) throw new Error();
    const budget = { logicalTrials: workload.logicalCalls, maxInferenceRequests: workload.logicalCalls, maxOutputTokensPerRequest: workload.maxOutputTokens,
      maxOutputTokensTotal: workload.logicalCalls * workload.maxOutputTokens, retries: 0 };
    failure = "The evaluation was cancelled before inference started.";
    if (options.signal?.aborted || controller.signal.aborted) throw new Error();
    failure = "The output directory must be new, with an existing writable parent. Existing paths are never reused.";
    mkdirSync(parsed.output, { mode: 0o700 }); directory = parsed.output; chmodSync(directory, 0o700);
    failure = "Private run storage could not be initialized. Inspect the output directory before starting another paid run.";
    store = (options.createStore ?? createRunStore)({ path: join(directory, "runs.sqlite") });
    const service = createRunService({ store, inferenceClient: options.inferenceClient, loadSuite: async () => suite });
    failure = "The evaluation could not finalize safely. Inspect the private receipt and SQLite evidence before another paid run.";
    const view = await service.execute(parsed.request, credential, controller.signal, event => {
      if (event.type === "started") {
        receipt = event;
        writePrivateJson(join(directory, "receipt.json"), { ...event, request: parsed.request, suiteId: suite.id, budget }, credential);
        (options.syncDirectory ?? syncDirectory)(directory);
        (options.syncDirectory ?? syncDirectory)(dirname(directory));
        startedReceiptSaved = true;
      }
      if ("progress" in event) out(JSON.stringify({ state: event.type === "started" ? "running" : event.state, ...event.progress }));
    });
    status = startedReceiptSaved && view.record.state === "completed" && view.record.report?.overall.classification.population.status === "complete" ? 0 : 1;
    if (!startedReceiptSaved) error("The private start receipt or directory entries could not be synced. No provider requests were started. Preserve the output directory before another paid run.");
    else if (status !== 0) error("Evaluation incomplete. Retained outcomes and unattempted trials remain explicit; inspect the private artifacts before another paid run.");
  } catch { error(failure); }
  finally {
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
    options.signal?.removeEventListener("abort", interrupt);
    if (store && receipt) {
      try {
        const view = store.read(receipt.runId, receipt.accessCode);
        if (!view) throw new Error();
        writePrivateJson(join(directory, "run.json"), view, credential);
        writePrivateJson(join(directory, "report.json"), view.record.report, credential);
        out(JSON.stringify({ output: directory, run: join(directory, "run.json"), report: join(directory, "report.json"), database: join(directory, "runs.sqlite") }));
      } catch { status = 1; error("Private JSON export failed. Preserve the receipt and SQLite evidence; do not repeat paid work to repair an export."); }
    }
    try { store?.close(); }
    catch { status = 1; error("Private run storage could not close cleanly. Preserve the output directory for inspection."); }
  }
  return status;
}

if (import.meta.main) process.exitCode = await runCli(Bun.argv.slice(2));
