// Frozen panels, exact dispatch bindings and reviewed adaptive decisions bound the research search.
import { createHash } from "node:crypto";
import { createInferenceClient } from "../inference";
import type { InferenceResult } from "../inference/types";
import { getProfile, type PromptBlueprint } from "../protocol";
import { parseCredential } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import type { ProviderFetch } from "../providers/transport";
import { sameData, sha256 } from "../quality/data";
import { scoreClassifications } from "../scoring/classification";
import { freezeData } from "../suites/generator";
import type { DispatchReceipt, FrozenPanel, ImportedCase, PanelFreeze, PanelResult, PanelReview, PanelRow, PriorDispatch, ReviewedPanel, SearchBudget, SearchDecision } from "./types";

export const PILOT_POLICY = freezeData({ methodId: "adaptive-single-response-v1", modelId: "gpt-6-astra", profileId: "one-shot-json-v2-max", maxOutputTokens: 16384,
  reasoning: "max", trialsPerCase: 1, retries: 0, inferenceTimeoutMs: 180000, metadataTimeoutMs: 20000, maxDevelopmentSends: 30, maxQuestionSends: 27, maxProbeSends: 3, maxPanels: 9 } as const);
export { sha256 as pilotHash } from "../quality/data";
const ENDPOINT = "https://api.openai.com/v1/responses", HEX = /^[a-f0-9]{64}$/, LABELS = ["convex", "concave", "neither"] as const;
const byteHash = (value: string) => createHash("sha256").update(value).digest("hex");
const integer = (value: number, min: number, max: number) => Number.isSafeInteger(value) && value >= min && value <= max;
const instant = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function rational(value: string): [bigint, bigint] {
  if (value.length > 128 || !/^-?\d+(?:\/[1-9]\d*)?$/.test(value)) throw new Error("Panel domains require bounded exact rational endpoints.");
  const [numerator, denominator = "1"] = value.split("/");
  return [BigInt(numerator), BigInt(denominator)];
}

function copyCase(task: ImportedCase): ImportedCase {
  const [lo, ld] = rational(task.domain.min), [hi, hd] = rational(task.domain.max);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(task.id) || !LABELS.includes(task.label) || !HEX.test(task.referenceSha256)
    || !Array.isArray(task.coreHashes) || task.coreHashes.length < 1 || task.coreHashes.length > 16384 || task.coreHashes.some(hash => !HEX.test(hash))
    || typeof task.expression !== "string" || !task.expression.isWellFormed() || !task.expression.trim() || task.expression.length > 131072 || lo * hd >= hi * ld
    || !integer(task.requestedDepth, 1, 1000) || ![task.requestedDepth, task.requestedDepth + 1].includes(task.actualDepth)
    || !integer(task.astDepth, 0, 4096) || !integer(task.nonlinearPath, 0, task.astDepth) || !integer(task.nodeCount, 1, 16384)) throw new Error("The imported panel task exceeds its frozen admission bounds.");
  return { id: task.id, label: task.label, expression: task.expression, domain: { ...task.domain }, referenceSha256: task.referenceSha256, coreHashes: [...task.coreHashes],
    requestedDepth: task.requestedDepth, actualDepth: task.actualDepth, astDepth: task.astDepth, nonlinearPath: task.nonlinearPath, nodeCount: task.nodeCount };
}

export function buildImportedPrompt(task: ImportedCase): PromptBlueprint {
  const profile = getProfile(PILOT_POLICY.profileId);
  const prompt: PromptBlueprint = { protocolVersion: "1", profileId: profile.id, messages: [
    { role: "system", content: 'Classify the real-valued scalar function on exactly the supplied closed interval. All displayed decimal numbers are exact. Numeric literals using e or E are base-10 scientific notation: for example, 1e-05 means 1 times 10^(-5), not the mathematical constant e. Otherwise use ordinary mathematical notation, including the stated LaTeX expression. Choose "convex" for convex and not concave, "concave" for concave and not convex, or "neither" for neither property. Affine and constant functions are excluded. A composition rule that does not apply is inconclusive. Use any valid mathematical argument. Return one JSON object with exactly two string fields, "label" and "explanation", each appearing once. The label must be convex, concave, or neither in lowercase. Give a brief nonblank explanation of at most 4096 Unicode code points, and keep the complete response within 65536 UTF-16 code units. Include no markdown fences or additional text.' },
    { role: "user", content: `f(x) = ${task.expression}\nDomain: x in [${task.domain.min}, ${task.domain.max}].` },
  ], responseFormat: profile.responseFormat, generation: { maxOutputTokens: profile.maxOutputTokens, sampling: profile.sampling, reasoning: profile.reasoning, tools: profile.tools } };
  if (Buffer.byteLength(JSON.stringify(prompt.messages)) > 262144) throw new Error("The imported prompt exceeds the existing transport bound.");
  return freezeData(prompt);
}

export function freezePanel(inputs: readonly ImportedCase[], options: PanelFreeze): FrozenPanel {
  const cases = inputs.map(copyCase), frozenAt = options.frozenAt ?? new Date().toISOString();
  if (!integer(options.ordinal, 1, 9) || !integer(options.requestedDepth, 1, 1000) || !HEX.test(options.sourceSha256) || !HEX.test(options.admissionReviewSha256) || !instant(frozenAt)
    || cases.length !== 3 || new Set(cases.map(task => task.id)).size !== 3 || LABELS.some(label => cases.filter(task => task.label === label).length !== 1)
    || cases.some(task => task.requestedDepth !== options.requestedDepth)) throw new Error("A panel requires three unique, reviewed tasks, one per class at its requested depth.");
  const content = { version: "1" as const, methodId: PILOT_POLICY.methodId, ordinal: options.ordinal, requestedDepth: options.requestedDepth,
    sourceSha256: options.sourceSha256, admissionReviewSha256: options.admissionReviewSha256, frozenAt, cases, prompts: cases.map(buildImportedPrompt) };
  return freezeData({ ...content, id: `adaptive-panel-${sha256(content)}` });
}

export function assertFrozenPanel(panel: FrozenPanel): void {
  if (!sameData(panel, freezePanel(panel.cases, panel))) throw new Error("The frozen panel, source, review or prompts changed.");
}

export function assertPanelRequestBody(bodyText: string, prompt: PromptBlueprint): void {
  const expected = { model: PILOT_POLICY.modelId, input: prompt.messages, max_output_tokens: 16384, store: false, truncation: "disabled", reasoning: { effort: "max" } };
  if (!sameData(JSON.parse(bodyText), expected)) throw new Error("The dispatched body differs from the frozen neutral prompt and settings.");
}

function modelOutcome(result: InferenceResult | null): boolean {
  return result !== null && result.inferenceRequests === 1 && result.failure === null && ["answer", "invalid", "refused", "truncated"].includes(result.evidence.outcome.kind);
}

function configured(result: InferenceResult | null): boolean {
  return modelOutcome(result) && result!.reportedModelId === PILOT_POLICY.modelId && result!.effective.maxOutputTokens === 16384
    && result!.effective.reasoningEffort === "max" && result!.effective.truncation === "disabled" && result!.contextFit === "provider-enforced"
    && sameData(result!.budget, { maxInferenceRequests: 1, maxOutputTokens: 16384, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, retries: 0 });
}

function unknownRemoteOutcome(row: PanelRow): boolean {
  return row.dispatch !== null && (row.result === null || row.result.failure?.remoteOutcome === "unknown" || row.result.failure === null && !modelOutcome(row.result));
}

export function scorePanelRows(panel: FrozenPanel, rows: readonly PanelRow[]): PanelResult["scores"] {
  if (rows.length !== panel.cases.length || rows.some((row, index) => row.caseId !== panel.cases[index].id || row.trialIndex !== 0)) throw new Error("Panel scoring requires each unique planned case exactly once.");
  if (rows.some(row => row.result !== null && ["answer", "invalid", "refused", "truncated"].includes(row.result.evidence.outcome.kind) && !modelOutcome(row.result))) throw new Error("A model answer contradicts its retained transport evidence.");
  return singleResponseScores(rows.map((row, index) => ({ caseId: row.caseId, depth: panel.requestedDepth, referenceLabel: panel.cases[index].label, trialIndex: 0, outcome: row.result?.evidence.outcome ?? null })));
}

function singleResponseScores(observations: Parameters<typeof scoreClassifications>[0]): PanelResult["scores"] {
  const report = scoreClassifications(observations, 1);
  const { trials: _trials, spread: _spread, agreement: _agreement, ...classification } = report;
  void _trials; void _spread; void _agreement;
  return { ...classification, repeatedTrialSpread: null, agreementAcrossRepeats: null };
}

export function scoreSearchResults(results: readonly PanelResult[]): PanelResult["scores"] {
  if (results.length > 9 || results.some(result => !sameData(result.scores, scorePanelRows(result.panel, result.rows)))) throw new Error("Search scores require the actual bounded panel results.");
  const observations = results.flatMap(result => result.rows.map((row, index) => ({ caseId: row.caseId, depth: result.panel.requestedDepth, referenceLabel: result.panel.cases[index].label, trialIndex: 0, outcome: row.result?.evidence.outcome ?? null })));
  if (new Set(observations.map(row => row.caseId)).size !== observations.length) throw new Error("Search scores may not count a task twice.");
  return singleResponseScores(observations);
}

function checkPrior(prior: readonly PriorDispatch[], panel: FrozenPanel): void {
  const questions = prior.filter(row => row.kind === "question"), probes = prior.filter(row => row.kind === "probe");
  if (prior.length + 3 > 30 || questions.length + 3 > 27 || probes.length > 3 || prior.some((row, index) => row.ordinal !== index + 1 || typeof row.dispatchId !== "string" || !row.dispatchId.trim() || row.dispatchId.length > 512
      || !["question", "probe"].includes(row.kind) || (row.kind === "probe" ? row.caseId !== null : typeof row.caseId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(row.caseId)))
    || new Set(prior.map(row => row.dispatchId)).size !== prior.length || new Set(questions.map(row => row.caseId)).size !== questions.length
    || questions.some(row => panel.cases.some(task => task.id === row.caseId))) throw new Error("A complete fresh panel does not fit the reconciled unique-send allowance.");
}

export async function executePanel(panel: FrozenPanel, options: {
  readonly credential: string; readonly acceptCharges: boolean; readonly priorDispatches: readonly PriorDispatch[];
  readonly persist: (name: string, value: unknown) => Promise<void>; readonly signal?: AbortSignal; readonly fetcher?: ProviderFetch;
}): Promise<PanelResult> {
  assertFrozenPanel(panel); checkPrior(options.priorDispatches, panel);
  if (options.acceptCharges !== true) throw new Error("Explicit charge approval is required for the frozen panel.");
  const credential = parseCredential(options.credential), controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const rows: { caseId: string; trialIndex: 0; dispatch: DispatchReceipt | null; result: InferenceResult | null }[] = panel.cases.map(task => ({ caseId: task.id, trialIndex: 0, dispatch: null, result: null }));
  let dispatches = 0, persistenceFailed = false;
  async function save(name: string, value: unknown) {
    if (reflectsCredential(JSON.stringify(value), credential)) { controller.abort(); throw new Error("Unsafe panel evidence was discarded."); }
    try { await options.persist(name, value); } catch { persistenceFailed = true; controller.abort(); throw new Error("Panel evidence could not be persisted; stop and reconcile receipts before further paid work."); }
  }
  await save("panel.json", panel);
  for (const [index, task] of panel.cases.entries()) {
    if (signal.aborted) break;
    const row = rows[index], prompt = panel.prompts[index];
    const infer = createInferenceClient(async (url, init) => {
      signal.throwIfAborted();
      if (url === ENDPOINT && init.method === "POST") {
        if (row.dispatch !== null || options.priorDispatches.length + dispatches >= 30) throw new Error("Repeated or over-budget panel dispatch.");
        const text = String(init.body); assertPanelRequestBody(text, prompt);
        const receipt: DispatchReceipt = { ordinal: options.priorDispatches.length + ++dispatches, dispatchId: `${panel.id}:${task.id}:0`, kind: "question", panelId: panel.id,
          caseId: task.id, trialIndex: 0, referenceSha256: task.referenceSha256, requestBodySha256: byteHash(text), authorizedAt: new Date().toISOString(), remoteOutcomeUntilRetained: "unknown" };
        await save(`dispatch-${receipt.ordinal}.json`, receipt); row.dispatch = receipt; signal.throwIfAborted();
      } else if (url !== `https://api.openai.com/v1/models/${PILOT_POLICY.modelId}` || init.method !== "GET") throw new Error("Unexpected panel provider destination or operation.");
      return (options.fetcher ?? fetch)(url, { ...init, signal: AbortSignal.any([signal, init.signal ?? signal]), timeout: false } as RequestInit);
    });
    row.result = await infer({ selection: { provider: "openai", modelId: PILOT_POLICY.modelId, servingProvider: null, profileId: PILOT_POLICY.profileId, verification: "metadata" }, prompt, acceptCharges: true }, credential, signal);
    if (persistenceFailed) throw new Error("Panel persistence failed before wire dispatch; inspect retained receipts.");
    await save(`result-${task.id}.json`, row);
    if (!modelOutcome(row.result) || !configured(row.result)) { controller.abort(); break; }
  }
  const result: PanelResult = { version: "1", methodId: PILOT_POLICY.methodId, panel, finishedAt: new Date().toISOString(), rows, scores: scorePanelRows(panel, rows), dispatches,
    unknownRemoteOutcomes: rows.filter(unknownRemoteOutcome).length,
    settingsVerified: rows.every(row => configured(row.result)) };
  await save("panel-result.json", result);
  return freezeData(result);
}

export function reviewPanel(result: PanelResult, review: PanelReview): ReviewedPanel {
  assertFrozenPanel(result.panel);
  const rowsBound = result.rows.every((row, index) => {
    const task = result.panel.cases[index], dispatch = row.dispatch, retained = row.result;
    return task !== undefined && (dispatch === null || dispatch.kind === "question" && dispatch.panelId === result.panel.id && dispatch.caseId === task.id && dispatch.trialIndex === 0
      && dispatch.dispatchId === `${result.panel.id}:${task.id}:0` && dispatch.referenceSha256 === task.referenceSha256 && HEX.test(dispatch.requestBodySha256)
      && integer(dispatch.ordinal, 1, 30) && instant(dispatch.authorizedAt) && Date.parse(dispatch.authorizedAt) >= Date.parse(result.panel.frozenAt))
      && (retained === null || sameData(retained.prompt, result.panel.prompts[index]) && sameData(retained.requested, { provider: "openai", modelId: PILOT_POLICY.modelId, servingProvider: null, profileId: PILOT_POLICY.profileId })
        && retained.inferenceRequests === (dispatch === null ? 0 : 1) && instant(retained.startedAt) && instant(retained.finishedAt)
        && Date.parse(retained.finishedAt) >= Date.parse(retained.startedAt) && Date.parse(result.finishedAt) >= Date.parse(retained.finishedAt));
  });
  if (result.version !== "1" || result.methodId !== PILOT_POLICY.methodId || !instant(result.finishedAt) || !sameData(result.scores, scorePanelRows(result.panel, result.rows))
    || !rowsBound || result.dispatches !== result.rows.filter(row => row.dispatch !== null).length || new Set(result.rows.flatMap(row => row.dispatch ? [row.dispatch.ordinal] : [])).size !== result.dispatches
    || result.unknownRemoteOutcomes !== result.rows.filter(unknownRemoteOutcome).length || result.settingsVerified !== result.rows.every(row => configured(row.result))
    || review.panelId !== result.panel.id || review.resultSha256 !== sha256(result) || !review.reviewer.trim() || review.reviewer.length > 128 || !instant(review.reviewedAt) || Date.parse(review.reviewedAt) < Date.parse(result.finishedAt)
    || !sameData(review.references, result.panel.cases.map(task => ({ caseId: task.id, referenceSha256: task.referenceSha256 }))) || new Set(review.verifiedWrongCaseIds).size !== review.verifiedWrongCaseIds.length)
    throw new Error("Independent panel review must bind the retained results and every reference exactly.");
  const wrong = result.rows.filter((row, index) => row.result?.evidence.outcome.kind === "answer" && row.result.evidence.outcome.label !== result.panel.cases[index].label).map(row => row.caseId);
  if (review.verifiedWrongCaseIds.some(id => !wrong.includes(id))) throw new Error("Review cannot certify a nonexistent wrong valid answer.");
  const valid = result.rows.every(row => row.result?.evidence.outcome.kind === "answer") && result.settingsVerified;
  const status = !valid || wrong.some(id => !review.verifiedWrongCaseIds.includes(id)) ? "inconclusive" : wrong.length ? "verified-error" : "all-correct";
  return freezeData({ result, review: structuredClone(review), status });
}

export function nextSearchDecision(history: readonly ReviewedPanel[], budget: SearchBudget): SearchDecision {
  if (!integer(budget.priorDevelopmentSends, 0, 30) || !integer(budget.probeSends, 0, 3) || budget.probeSends > budget.priorDevelopmentSends || budget.priorDevelopmentSends - budget.probeSends > 27
    || history.length > 9 || history.some((entry, index) => entry.result.panel.ordinal !== index + 1 || !sameData(entry, reviewPanel(entry.result, entry.review)))
    || new Set(history.map(entry => entry.result.panel.id)).size !== history.length) throw new Error("Search history or prior-send accounting is invalid.");
  const allCaseIds = history.flatMap(entry => entry.result.panel.cases.map(task => task.id));
  if (new Set(allCaseIds).size !== allCaseIds.length) throw new Error("Search panels may not reuse a case.");
  const questionSends = history.reduce((sum, entry) => sum + entry.result.dispatches, 0);
  if (questionSends + budget.priorDevelopmentSends > 30 || questionSends + budget.priorDevelopmentSends - budget.probeSends > 27) throw new Error("Retained search sends exceed the frozen development allowance.");
  let lower: number | null = null, higher: number | null = null, expected = 216;
  const stop = (reason: Extract<SearchDecision, { action: "stop" }>["reason"]): SearchDecision => ({ action: "stop", reason, lower, higher });
  if (history.some(error => error.status === "verified-error" && history.some(correct => correct.status === "all-correct" && correct.result.panel.requestedDepth > error.result.panel.requestedDepth))) return stop("inversion");
  for (const [index, entry] of history.entries()) {
    const depth = entry.result.panel.requestedDepth;
    if (depth !== expected) throw new Error("History departed from the frozen depth-selection rule.");
    if (entry.status === "inconclusive") { if (index !== history.length - 1) throw new Error("The search continued after an inconclusive panel."); return stop("inconclusive"); }
    if (entry.status === "verified-error") {
      higher = depth;
      if (depth === 216) { if (index !== history.length - 1) throw new Error("The search continued after its initial signal."); return stop("initial-signal"); }
    } else {
      lower = depth;
      if (depth === 1000 && higher === null) { if (index !== history.length - 1) throw new Error("The search continued beyond depth 1000."); return stop("all-correct-through-1000"); }
    }
    if (lower !== null && higher !== null) {
      if (higher - lower <= 16) { if (index !== history.length - 1) throw new Error("The search continued after reaching its interval bound."); return stop("interval-width"); }
      expected = lower === 512 && higher === 1000 ? 750 : Math.floor((lower + higher) / 2);
    } else expected = depth === 216 ? 512 : 1000;
  }
  if (history.length === 9) return stop("panel-limit");
  const remaining = 30 - budget.priorDevelopmentSends - questionSends;
  if (remaining < 3 || budget.priorDevelopmentSends - budget.probeSends + questionSends + 3 > 27) return stop("budget");
  return { action: "query", requestedDepth: expected, lower, higher };
}
