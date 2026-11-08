// Synthetic transports check one-response accounting, frozen decisions and evidence-before-send behavior.
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { InferenceResult } from "../inference/types";
import type { AnswerOutcome, PromptBlueprint } from "../protocol";
import { scoreClassifications } from "../scoring/classification";
import type { Observation } from "../scoring/types";
import { assertFrozenPanel, assertPanelRequestBody, executePanel, freezePanel, nextSearchDecision, PILOT_POLICY, pilotHash, reviewPanel, scorePanelRows, scoreSearchResults } from "./pilot";
import type { DispatchReceipt, FrozenPanel, ImportedCase, PanelResult, PanelReview, PanelRow, PriorDispatch, ReviewedPanel } from "./types";

const credential = "synthetic-adaptive-panel-credential-123456789";
const labels = ["convex", "concave", "neither"] as const;

test("single-response arithmetic preserves an 800-case population without adding repeats", () => {
  const depths = [5, 10, 20, 40, 80, 160, 320, 512];
  const observations: Observation[] = Array.from({ length: 800 }, (_, index) => ({ caseId: `synthetic-final-${index}`, depth: depths[Math.floor(index / 100)], trialIndex: 0, referenceLabel: labels[index % 3], outcome: answer(labels[index % 3]) }));
  const perfect = scoreClassifications(observations, 1);
  expect(perfect.population.plannedTrials).toBe(800);
  expect(perfect.accuracy).toEqual({ numerator: 800, denominator: 800, value: 1 });
  expect(perfect.macroF1).toBe(1);
  expect(labels.map(label => perfect.classes[label].support)).toEqual([267, 267, 266]);
  const threeWrong = scoreClassifications(observations.map((row, index) => index < 3 ? { ...row, outcome: answer(labels[(index + 1) % 3]) } : row), 1);
  expect(threeWrong.accuracy).toEqual({ numerator: 797, denominator: 800, value: 797 / 800 });
  expect(threeWrong.macroF1).toBeCloseTo((266 / 267 + 266 / 267 + 265 / 266) / 3, 14);
  const partial = scoreClassifications(observations.map((row, index) => index === 0 ? { ...row, outcome: null } : row), 1);
  expect(partial.population.status).toBe("provisional");
  expect(partial.population.plannedTrials).toBe(800);
  expect(partial.accuracy).toEqual({ numerator: 799, denominator: 799, value: 1 });
});
function panel(depth = 216, ordinal = 1): FrozenPanel {
  const cases: ImportedCase[] = labels.map((label, index) => ({ id: `synthetic-${ordinal}-${depth}-${index}`, label, expression: [`(x)^2`, `-(x)^2`, `(x)^3`][index], domain: { min: "-1", max: "1" }, referenceSha256: pilotHash({ depth, ordinal, index }), coreHashes: [pilotHash({ core: index, ordinal })], requestedDepth: depth, actualDepth: depth + (index === 1 ? 1 : 0), astDepth: 3, nonlinearPath: 1, nodeCount: 5 }));
  return freezePanel(cases, { ordinal, requestedDepth: depth, sourceSha256: pilotHash("synthetic-source"), admissionReviewSha256: pilotHash("synthetic-reference-review") });
}
function answer(label: typeof labels[number]): AnswerOutcome {
  return { protocolVersion: "1", profileId: PILOT_POLICY.profileId, kind: "answer", label, explanation: "Synthetic retained explanation.", rawText: JSON.stringify({ label, explanation: "Synthetic retained explanation." }) };
}
function result(prompt: PromptBlueprint, outcome: AnswerOutcome): InferenceResult {
  return { version: "1", policyId: "individual-inference-v1", attemptId: crypto.randomUUID(), startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), requested: { provider: "openai", modelId: PILOT_POLICY.modelId, servingProvider: null, profileId: PILOT_POLICY.profileId }, selection: null, metadata: null, prompt, reportedModelId: PILOT_POLICY.modelId, reportedServingProvider: null, effective: { maxOutputTokens: 16384, reasoningEffort: "max", truncation: "disabled", nativeSchemaAccepted: null }, finishReason: "completed", contextFit: "provider-enforced", evidence: { sequence: 1, outcome, errorKind: null, elapsedMs: 1, usage: { input: null, output: null, reasoning: null }, cost: null }, failure: outcome.kind === "provider-error" ? { code: "service-unavailable", message: "Synthetic provider error.", remoteOutcome: "response-received" } : null, httpAttempts: 1, inferenceRequests: 1, budget: { maxInferenceRequests: 1, maxOutputTokens: 16384, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, retries: 0 } };
}
function retained(frozen: FrozenPanel, outcomes = labels.map(answer)): PanelResult {
  const rows: PanelRow[] = frozen.cases.map((task, index) => ({ caseId: task.id, trialIndex: 0, dispatch: { ordinal: (frozen.ordinal - 1) * 3 + index + 1, dispatchId: `${frozen.id}:${task.id}:0`, kind: "question", panelId: frozen.id, caseId: task.id, trialIndex: 0, referenceSha256: task.referenceSha256, requestBodySha256: pilotHash({ index }), authorizedAt: frozen.frozenAt, remoteOutcomeUntilRetained: "unknown" }, result: result(frozen.prompts[index], outcomes[index]) }));
  return { version: "1", methodId: PILOT_POLICY.methodId, panel: frozen, rows, finishedAt: new Date().toISOString(), scores: scorePanelRows(frozen, rows), dispatches: 3, unknownRemoteOutcomes: 0, settingsVerified: true };
}
function attestation(value: PanelResult, verifiedWrongCaseIds?: readonly string[]): PanelReview {
  return { panelId: value.panel.id, resultSha256: pilotHash(value), references: value.panel.cases.map(task => ({ caseId: task.id, referenceSha256: task.referenceSha256 })), verifiedWrongCaseIds: verifiedWrongCaseIds ?? value.rows.filter((row, index) => row.result?.evidence.outcome.kind === "answer" && row.result.evidence.outcome.label !== value.panel.cases[index].label).map(row => row.caseId), reviewer: "synthetic-independent-reviewer", reviewedAt: new Date().toISOString() };
}
function reviewed(depth: number, ordinal: number, wrong = false): ReviewedPanel {
  const value = retained(panel(depth, ordinal), [answer(wrong ? "concave" : "convex"), answer("concave"), answer("neither")]);
  return reviewPanel(value, attestation(value));
}
function sink() {
  const files = new Map<string, unknown>();
  return { files, persist: async (name: string, value: unknown) => { if (files.has(name)) throw new Error("Immutable artifact already exists."); files.set(name, structuredClone(value)); } };
}
function response(text: string, status = "completed") {
  return Response.json({ id: "synthetic-response", object: "response", status, model: PILOT_POLICY.modelId, max_output_tokens: 16384, truncation: "disabled", reasoning: { effort: "max" }, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }] });
}

test("freezes only three unique reviewed classes and refuses changed task meaning or prompts", () => {
  const value = panel();
  expect(() => assertFrozenPanel(value)).not.toThrow();
  for (const cases of [value.cases.slice(1), [value.cases[0], value.cases[0], value.cases[2]], value.cases.map(task => ({ ...task, actualDepth: 218 })), value.cases.map(task => ({ ...task, domain: { min: "1", max: "-1" } }))]) expect(() => freezePanel(cases, value)).toThrow();
  expect(() => assertFrozenPanel({ ...value, admissionReviewSha256: "0".repeat(64) })).toThrow();
  expect(() => assertFrozenPanel({ ...value, prompts: [{ ...value.prompts[0], messages: [{ role: "system", content: "Changed" }, value.prompts[0].messages[1]] }, ...value.prompts.slice(1)] })).toThrow();
  expect(() => freezePanel(value.cases.map(task => ({ ...task, expression: "x".repeat(131073) })), value)).toThrow();
});

test("scores hand-calculated perfect, wrong, majority, unusable and provisional populations once", () => {
  const frozen = panel(), perfect = retained(frozen);
  expect(perfect.scores.accuracy).toEqual({ numerator: 3, denominator: 3, value: 1 });
  expect(perfect.scores.macroF1).toBe(1);
  expect(perfect.scores.repeatedTrialSpread).toBeNull(); expect(perfect.scores.agreementAcrossRepeats).toBeNull();
  expect(Object.hasOwn(perfect.scores, "trials")).toBe(false); expect(Object.hasOwn(perfect.scores, "spread")).toBe(false);
  const wrong = retained(frozen, [answer("concave"), answer("concave"), answer("neither")]);
  expect(wrong.scores.macroF1).toBeCloseTo(5 / 9, 12); expect(wrong.scores.accuracy.value).toBe(2 / 3);
  const majority = retained(frozen, labels.map(() => answer("convex")));
  expect(majority.scores.macroF1).toBeCloseTo(1 / 6, 12); expect(majority.scores.accuracy.value).toBe(1 / 3);
  const unusable: AnswerOutcome = { protocolVersion: "1", profileId: PILOT_POLICY.profileId, kind: "invalid", reason: "empty", rawText: "" };
  const invalid = retained(frozen, [unusable, answer("concave"), answer("neither")]);
  expect(invalid.scores.population.status).toBe("complete"); expect(invalid.scores.accuracy.denominator).toBe(3); expect(invalid.scores.macroF1).toBeCloseTo(2 / 3, 12); expect(invalid.scores.outcomes.empty.numerator).toBe(1);
  const providerError: AnswerOutcome = { protocolVersion: "1", profileId: PILOT_POLICY.profileId, kind: "provider-error", message: "Synthetic", rawText: "" };
  const partial = retained(frozen, [providerError, answer("concave"), answer("neither")]);
  expect(partial.scores.population).toMatchObject({ plannedTrials: 3, includedTrials: 2, excludedTrials: 1, status: "provisional" }); expect(partial.scores.accuracy).toEqual({ numerator: 2, denominator: 2, value: 1 });
  expect(scorePanelRows(frozen, frozen.cases.map(task => ({ caseId: task.id, trialIndex: 0, dispatch: null, result: null }))).population.status).toBe("unavailable");
});

test("a wrong comparison alone cannot establish a verified mathematical endpoint", () => {
  const value = retained(panel(), [answer("concave"), answer("concave"), answer("neither")]);
  expect(reviewPanel(value, attestation(value, [])).status).toBe("inconclusive");
  expect(reviewPanel(value, attestation(value)).status).toBe("verified-error");
  expect(() => reviewPanel(value, { ...attestation(value), resultSha256: "0".repeat(64) })).toThrow();
  expect(() => reviewPanel(value, { ...attestation(value), references: [] })).toThrow();
  expect(() => reviewPanel(value, attestation(value, [value.panel.cases[1].id]))).toThrow();
  const changed: PanelResult = { ...value, rows: value.rows.map((row, index) => index === 0 ? { ...row, result: { ...row.result!, prompt: { ...row.result!.prompt, messages: [row.result!.prompt.messages[0], { role: "user", content: "Changed task after dispatch" }] } } } : row) };
  expect(() => reviewPanel(changed, attestation(changed))).toThrow();
  const invalid = retained(panel(), [{ protocolVersion: "1", profileId: PILOT_POLICY.profileId, kind: "truncated", rawText: "" }, answer("concave"), answer("neither")]);
  expect(nextSearchDecision([reviewPanel(invalid, attestation(invalid))], { priorDevelopmentSends: 0, probeSends: 0 })).toMatchObject({ action: "stop", reason: "inconclusive" });
});

test("adaptive population scores use actual frozen panels and preserve single-response limits", () => {
  const first = retained(panel()), second = retained(panel(512, 2), labels.map(() => answer("convex")));
  const scores = scoreSearchResults([first, second]);
  expect(scores.population.plannedTrials).toBe(6); expect(scores.accuracy).toEqual({ numerator: 4, denominator: 6, value: 2 / 3 });
  expect(scores.repeatedTrialSpread).toBeNull(); expect(scoreSearchResults([]).population.plannedTrials).toBe(0);
  expect(() => scoreSearchResults([first, first])).toThrow("twice");
  expect(() => scoreSearchResults(Array.from({ length: 10 }, () => first))).toThrow("bounded");
});

test("follows reviewed initial panels and bounded coarse midpoint exploration", () => {
  const budget = { priorDevelopmentSends: 0, probeSends: 0 };
  expect(nextSearchDecision([], budget)).toMatchObject({ action: "query", requestedDepth: 216 });
  const history = [reviewed(216, 1)];
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "query", requestedDepth: 512 });
  history.push(reviewed(512, 2));
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "query", requestedDepth: 1000 });
  history.push(reviewed(1000, 3, true));
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "query", requestedDepth: 750, lower: 512, higher: 1000 });
  history.push(reviewed(750, 4));
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "query", requestedDepth: 875 });
  for (const depth of [875, 812, 781]) history.push(reviewed(depth, history.length + 1, true));
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "query", requestedDepth: 765 });
  history.push(reviewed(765, 8));
  expect(nextSearchDecision(history, budget)).toMatchObject({ action: "stop", reason: "interval-width", lower: 765, higher: 781 });
  expect(nextSearchDecision([reviewed(216, 1, true)], budget)).toMatchObject({ action: "stop", reason: "initial-signal" });
  expect(nextSearchDecision([reviewed(216, 1), reviewed(512, 2), reviewed(1000, 3)], budget)).toMatchObject({ action: "stop", reason: "all-correct-through-1000" });
});

test("preserves inversions and refuses budget, duplicate and protocol-deviating histories", () => {
  expect(nextSearchDecision([reviewed(216, 1, true), reviewed(512, 2)], { priorDevelopmentSends: 0, probeSends: 0 })).toMatchObject({ action: "stop", reason: "inversion" });
  expect(nextSearchDecision([], { priorDevelopmentSends: 28, probeSends: 3 })).toMatchObject({ action: "stop", reason: "budget" });
  expect(nextSearchDecision([], { priorDevelopmentSends: 27, probeSends: 3 })).toMatchObject({ action: "query", requestedDepth: 216 });
  expect(nextSearchDecision([reviewed(216, 1)], { priorDevelopmentSends: 27, probeSends: 3 })).toMatchObject({ action: "stop", reason: "budget" });
  expect(() => nextSearchDecision([], { priorDevelopmentSends: 0, probeSends: 1 })).toThrow();
  expect(() => nextSearchDecision([reviewed(512, 1)], { priorDevelopmentSends: 0, probeSends: 0 })).toThrow();
});

test("SDK requests bind only exact neutral task messages and await unique receipts before wire sends", async () => {
  const frozen = panel(), store = sink(); let posts = 0;
  const value = await executePanel(frozen, { credential, acceptCharges: true, priorDispatches: [], persist: store.persist, fetcher: async (url, init) => {
    if (init.method === "GET") return Response.json({ id: PILOT_POLICY.modelId, object: "model" });
    posts++;
    expect(url).toBe("https://api.openai.com/v1/responses");
    const receipt = store.files.get(`dispatch-${posts}.json`) as DispatchReceipt;
    expect(receipt.caseId).toBe(frozen.cases[posts - 1].id);
    const bodyText = String(init.body); assertPanelRequestBody(bodyText, frozen.prompts[posts - 1]);
    expect(receipt.requestBodySha256).toBe(createHash("sha256").update(bodyText).digest("hex"));
    expect(bodyText.includes(frozen.cases[posts - 1].referenceSha256)).toBe(false); expect(bodyText.includes(frozen.cases[posts - 1].id)).toBe(false);
    expect(() => assertPanelRequestBody(JSON.stringify({ ...JSON.parse(bodyText), metadata: { reference: "leak" } }), frozen.prompts[posts - 1])).toThrow();
    return response(JSON.stringify({ label: labels[posts - 1], explanation: "Synthetic explanation." }));
  } });
  expect(posts).toBe(3); expect(value.dispatches).toBe(3); expect(value.settingsVerified).toBe(true); expect(value.scores.macroF1).toBe(1); expect(value.unknownRemoteOutcomes).toBe(0);
  expect([...store.files.keys()]).toEqual(["panel.json", "dispatch-1.json", `result-${frozen.cases[0].id}.json`, "dispatch-2.json", `result-${frozen.cases[1].id}.json`, "dispatch-3.json", `result-${frozen.cases[2].id}.json`, "panel-result.json"]);
});

test("infrastructure failure stops further dispatch and preserves planned but unfinished work", async () => {
  const frozen = panel(), store = sink(); let posts = 0;
  const value = await executePanel(frozen, { credential, acceptCharges: true, priorDispatches: [], persist: store.persist, fetcher: async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: PILOT_POLICY.modelId, object: "model" });
    posts++; throw new Error("Synthetic lost connection.");
  } });
  expect(posts).toBe(1); expect(value.dispatches).toBe(1); expect(value.unknownRemoteOutcomes).toBe(1); expect(value.rows.filter(row => row.result === null)).toHaveLength(2);
  expect(value.scores.population.status).toBe("unavailable"); expect(value.scores.outcomes.unattempted.numerator).toBe(2); expect(value.settingsVerified).toBe(false);
});

test("queued or excluded provider states remain unknown sends even without a transport failure", async () => {
  for (const status of ["queued", "in_progress", "incomplete", "cancelled"]) {
    let posts = 0;
    const value = await executePanel(panel(), { credential, acceptCharges: true, priorDispatches: [], persist: sink().persist, fetcher: async (_url, init) => {
      if (init.method === "GET") return Response.json({ id: PILOT_POLICY.modelId, object: "model" });
      posts++; return response("", status);
    } });
    expect(posts).toBe(1); expect(value.unknownRemoteOutcomes).toBe(1); expect(value.settingsVerified).toBe(false);
  }
});

test("receipt or result persistence failure stops wire sends without hidden retries", async () => {
  for (const failure of ["dispatch", "result"]) {
    let posts = 0;
    await expect(executePanel(panel(), { credential, acceptCharges: true, priorDispatches: [], persist: async name => { if (name.startsWith(`${failure}-`)) throw new Error("Synthetic persistence failure."); }, fetcher: async (_url, init) => {
      if (init.method === "GET") return Response.json({ id: PILOT_POLICY.modelId, object: "model" });
      posts++; return response(JSON.stringify({ label: "convex", explanation: "Synthetic explanation." }));
    } })).rejects.toThrow("persist");
    expect(posts).toBe(failure === "dispatch" ? 0 : 1);
  }
});

test("cancelled or over-budget panels send nothing and prior case receipts block a rerun", async () => {
  const frozen = panel(), store = sink(), controller = new AbortController(); controller.abort(); let calls = 0;
  const fetcher = async () => { calls++; throw new Error("Unexpected request."); };
  const value = await executePanel(frozen, { credential, acceptCharges: true, priorDispatches: [], persist: store.persist, signal: controller.signal, fetcher });
  expect(value.dispatches).toBe(0); expect(value.scores.outcomes.unattempted.numerator).toBe(3); expect(calls).toBe(0);
  const prior: PriorDispatch[] = Array.from({ length: 27 }, (_, index) => ({ ordinal: index + 1, dispatchId: `earlier-${index}`, kind: "question", caseId: `earlier-${index}` }));
  await expect(executePanel(frozen, { credential, acceptCharges: true, priorDispatches: prior, persist: sink().persist, fetcher })).rejects.toThrow("allowance");
  await expect(executePanel(frozen, { credential, acceptCharges: true, priorDispatches: [{ ordinal: 1, dispatchId: "prior", kind: "question", caseId: frozen.cases[0].id }], persist: sink().persist, fetcher })).rejects.toThrow("allowance");
  expect(calls).toBe(0);
});
