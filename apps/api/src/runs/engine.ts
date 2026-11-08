// A bounded foreground pool records each logical trial once and preserves partial work on stop.
import { createHash } from "node:crypto";
import { executeInference, type InferenceClient } from "../inference";
import { parseCredential, safeAccessInputError } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import { MAX_PROVIDER_ERROR_CODE_UNITS, MAX_RETAINED_REPLY_CODE_UNITS, MAX_RETAINED_TEXT_CODE_UNITS, scoreEvaluation } from "../scoring";
import { prepareRunRecord } from "./evidence";
import { RUN_POLICY, RUN_TIMEOUT_MS, RunInputError, parseRunRequest, runPopulation } from "./policy";
import { loadRunSuite } from "./registry";
import type { RunEvent, RunProgress, RunRecord, RunState, RunStore, RunSuite, RunSuiteKey, RunView } from "./types";
import type { ProfileId } from "../protocol";

type StopState = "cancelled" | "timed-out" | "failed";
const terminalModelKinds = new Set(["answer", "invalid", "refused", "truncated"]);
const digest = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

export function createRunService(options: {
  store: RunStore;
  inferenceClient?: InferenceClient;
  loadSuite?: (key: RunSuiteKey, profileId: ProfileId) => Promise<RunSuite>;
  score?: typeof scoreEvaluation;
}) {
  const { store } = options;
  const infer = options.inferenceClient ?? executeInference;
  const suiteLoader = options.loadSuite ?? loadRunSuite;
  const score = options.score ?? scoreEvaluation;
  const active = new Map<string, () => void>();
  let preparing = 0;

  async function execute(input: unknown, suppliedCredential: unknown, signal?: AbortSignal, onEvent: (event: RunEvent) => void = () => {}): Promise<RunView> {
    const request = parseRunRequest(input);
    let credential: string;
    try { credential = parseCredential(suppliedCredential); } catch (error) { throw safeAccessInputError(error); }
    if (reflectsCredential(JSON.stringify(request), credential)) throw new RunInputError();
    if (signal?.aborted) throw new RunInputError("cancelled", "The run was cancelled before it started.");
    if (active.size + preparing >= RUN_POLICY.maxActiveRuns) throw new RunInputError("capacity-exceeded", "Four evaluations are already active. Wait for one to settle before starting another.");
    preparing++;
    let record: RunRecord;
    try {
      const suite = await suiteLoader(request.suiteKey, request.profileId);
      if (suite.cases.length < 1 || suite.cases.length > RUN_POLICY.maxCases || suite.request.profileId !== request.profileId) throw new RunInputError("invalid-suite", "The selected suite does not match the requested workload/profile.");
      runPopulation(request.suiteKey, suite);
      record = await prepareRunRecord(request, suite);
      if (signal?.aborted) throw new RunInputError("cancelled", "The run was cancelled before inference started.");
    } finally { preparing--; }
    const created = store.create(record);
    record = created.view.record;
    const controller = new AbortController();
    let stopState: StopState | null = null;
    let persistenceFailed = false;
    let started = 0, workersActive = 0, cursor = 0, retainedText = 0;
    const start = performance.now();
    const progress = (): RunProgress => ({
      plannedTrials: record.workload.logicalCalls, startedTrials: started, activeTrials: workersActive,
      finishedTrials: record.results.length,
      modelOutcomes: record.results.filter(entry => terminalModelKinds.has(entry.result.evidence.outcome.kind)).length,
      infrastructureFailures: record.results.filter(entry => !terminalModelKinds.has(entry.result.evidence.outcome.kind)).length,
      remainingTrials: record.workload.logicalCalls - record.results.length,
      inferenceRequests: record.results.reduce((sum, entry) => sum + entry.result.inferenceRequests, 0),
    });
    const persist = () => { record = store.save({ ...record, progress: progress() }).record; };
    const emit = (event: RunEvent) => {
      try { onEvent(event); }
      catch { if (stopState === null) stop("cancelled", "recipient-disconnected", "The progress recipient disconnected. New work stopped; remote charges may remain unknown."); }
    };
    const stop = (state: StopState, code: string, message: string) => {
      if (stopState !== null) return;
      stopState = state;
      record = { ...record, state: "cancelling", failure: { code, message } };
      controller.abort();
      try { persist(); }
      catch { persistenceFailed = true; stopState = "failed"; }
      emit({ type: "progress", runId: record.id, state: record.state, progress: progress() });
    };
    const cancel = () => stop("cancelled", "cancelled", "Cancellation stopped new work; already-dispatched requests may still incur provider charges.");
    const onAbort = () => cancel();
    active.set(record.id, cancel);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => stop("timed-out", "run-timeout", "The evaluation reached its 60-minute deadline. Unattempted work remains incomplete."), RUN_TIMEOUT_MS);
    const worker = async () => {
      while (!controller.signal.aborted && cursor < record.evidence.trials.length) {
        const reserve = MAX_RETAINED_REPLY_CODE_UNITS + MAX_PROVIDER_ERROR_CODE_UNITS;
        if (retainedText + (workersActive + 1) * reserve > MAX_RETAINED_TEXT_CODE_UNITS) {
          stop("failed", "retention-limit", "The bounded evidence budget is full. Completed work is retained; remaining trials were not dispatched."); break;
        }
        const index = cursor++, trial = record.evidence.trials[index];
        const caseIndex = Math.floor(index / record.workload.trialsPerInstance);
        started++; workersActive++;
        let released = false;
        const release = () => { if (!released) { workersActive--; released = true; } };
        try {
          persist();
          emit({ type: "progress", runId: record.id, state: record.state, progress: record.progress });
          const result = await infer({
            selection: { provider: request.provider, modelId: request.modelId, servingProvider: request.servingProvider, profileId: request.profileId, verification: "metadata" },
            prompt: record.prompts[caseIndex], acceptCharges: true,
          }, credential, controller.signal);
          if (reflectsCredential(JSON.stringify(result), credential)
            || digest(result.prompt) !== digest(record.prompts[caseIndex]) || result.evidence.sequence !== 1
            || result.requested.modelId !== request.modelId || result.requested.provider !== request.provider
            || result.requested.servingProvider !== request.servingProvider || result.requested.profileId !== request.profileId) throw new Error("Invalid inference evidence.");
          if (record.results.some(entry => entry.caseId === trial.caseId && entry.trialIndex === trial.trialIndex)) throw new Error("Duplicate trial result.");
          const outcome = result.evidence.outcome;
          retainedText += outcome.rawText.length + (outcome.kind === "provider-error" ? outcome.message.length : 0);
          record = { ...record,
            results: [...record.results, { caseId: trial.caseId, trialIndex: trial.trialIndex, result }],
            evidence: { ...record.evidence, trials: record.evidence.trials.map((entry, offset) => offset === index ? { ...entry, finalAttempt: 1, elapsedMs: result.evidence.elapsedMs, attempts: [result.evidence] } : entry) },
          };
          release(); persist();
          emit({ type: "progress", runId: record.id, state: record.state, progress: record.progress });
          if (result.failure && ["authentication-rejected", "permission-denied", "credit-or-quota-exhausted", "model-unavailable", "invalid-provider-response", "network-error", "timeout"].includes(result.failure.code)) stop("failed", result.failure.code, "The provider could not establish the requested access, configuration, or connection. New work stopped; completed and uncertain attempts remain recorded.");
        } catch {
          release();
          stop("failed", "execution-error", "An inference result could not be retained safely. Work stopped; unavailable outcomes remain explicit.");
        }
      }
    };
    try {
      if (signal?.aborted) cancel();
      emit({ type: "started", runId: record.id, accessCode: created.accessCode, progress: record.progress, expiresAt: record.expiresAt });
      const settled = await Promise.allSettled(Array.from({ length: Math.min(request.concurrency, record.workload.logicalCalls) }, worker));
      if (settled.some(result => result.status === "rejected")) stop("failed", "worker-error", "A worker could not settle its evidence. The run remains incomplete.");
      if (persistenceFailed) throw new Error("Run persistence failed.");
      record = { ...record, evidence: { ...record.evidence, run: { elapsedMs: Math.max(0, performance.now() - start), concurrency: request.concurrency } } };
      persist();
      const report = await score({ suite: record.suite, evidence: record.evidence });
      const state: RunState = stopState ?? (report.overall.classification.population.status === "complete" ? "completed" : "failed");
      record = { ...record, state, report,
        failure: record.failure ?? (state === "failed" ? { code: "incomplete-evidence", message: "Infrastructure failures or unavailable work prevent a complete evaluation population." } : null) };
      persist();
      emit({ type: "finished", runId: record.id, state, progress: record.progress, report });
      return { record, publishedAt: null };
    } catch {
      record = { ...record, state: "failed", report: null,
        failure: { code: "finalization-failed", message: "Scoring or final storage failed. Retained outcomes remain incomplete and cannot be published." } };
      try { persist(); }
      catch { persistenceFailed = true; }
      emit({ type: "error", runId: record.id, code: "run-failed", message: "The evaluation could not finalize its retained evidence. No successful completion is claimed." });
      throw new RunInputError(persistenceFailed ? "storage-failed" : "run-failed", persistenceFailed
        ? "The evaluation could not retain its terminal state. Inspect storage and the private record before starting another paid run."
        : "The evaluation could not finalize its retained evidence. Inspect the private record before starting another paid run.");
    } finally {
      clearTimeout(timer); signal?.removeEventListener("abort", onAbort); active.delete(record.id); controller.abort();
    }
  }

  return {
    execute,
    cancel(id: string, accessCode: string): boolean {
      if (!store.read(id, accessCode)) return false;
      const cancel = active.get(id);
      if (!cancel) return false;
      cancel(); return true;
    },
    get activeRuns() { return active.size + preparing; },
  };
}
