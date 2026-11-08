// Synthetic accounting fixtures exercise continuation boundaries without credentials or provider calls.
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelMetadata } from "../apps/api/src/discovery";
import { parseInferenceResponse } from "../apps/api/src/inference/adapters";
import type { Label } from "../apps/api/src/math";
import { extractAnswer } from "../apps/api/src/protocol";
import { sha256 } from "../apps/api/src/quality/data";
import { writeArtifact } from "../apps/api/src/randomized/artifacts";
import type { OutcomeAudit } from "../apps/api/src/deep-study/execution";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { caseBindings, createRows, DEPTHS, freezeStudy, reconstructReport, type CompatibilityControl } from "../apps/api/src/deep-study/study";
import { buildDeepRequestBody, DEEP_MODELS, type DeepAttempt, type DeepModelId } from "../apps/api/src/deep-study/transport";
import { assertAmendment, buildAmendmentPublicSummary, createAmendment, initialAmendmentRows, operatorSha256, parseAmendmentArguments,
  readAmendmentBaseline, reconstructAmendmentReport, retryAfterMilliseconds, scheduleAmendmentRows, selectAmendmentCases, writeAmendmentBaseline,
  type AmendmentBaseline, type AmendmentContext, type SchedulerOutcome } from "./deep-study-amendment";

const LABELS = ["convex", "concave", "neither"] as const;
const originalFrozen = "2026-11-08T00:10:00.000Z", originalStarted = "2026-11-08T00:12:00.000Z",
  oldAuthorized = "2026-11-08T00:12:00.500Z", oldFinished = "2026-11-08T00:12:01.000Z",
  oldCutoff = "2026-11-08T00:18:00.000Z", amendedFrozen = "2026-11-08T00:20:00.000Z";

function population(): ImportedCase[] {
  return DEPTHS.flatMap((depth, d) => LABELS.flatMap((label, l) => Array.from({ length: 33 + Number(d % 3 === l) }, (_, n) => {
    const id = `fixture-${depth}-${label}-${n}`;
    return { id, label, expression: `${label === "concave" ? "-x^2" : label === "convex" ? "x^2" : "x^3"}+${300 * d + 100 * l + n + 1}`,
      domain: { min: "-1", max: "1" }, referenceSha256: sha256({ fixtureReference: id }), coreHashes: [sha256({ fixtureCore: id })],
      requestedDepth: depth, actualDepth: depth + n % 2, astDepth: 2, nonlinearPath: 1, nodeCount: 4 };
  })));
}
function metadata(modelId: DeepModelId): ModelMetadata {
  return { modelId, canonicalId: null, displayName: "Synthetic test fixture", providerModelId: null, servingProvider: null,
    providerDisplayName: null, routeStatus: null, hosted: "available", exactRoute: true,
    capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: "max_output_tokens", supportedParameters: null, pricing: null };
}
function attempt(modelId: DeepModelId, label: Label, kind: "answer" | "invalid" | "refused" | "truncated" = "answer", continuation = false): DeepAttempt {
  const effort = DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort;
  const content = kind === "refused" ? [{ type: "refusal", refusal: "Synthetic refusal fixture." }]
    : [{ type: "output_text", text: kind === "invalid" ? "invalid-json-fixture" : JSON.stringify({ label, explanation: "Synthetic accounting fixture." }) }];
  const rawResponse = { model: modelId, status: kind === "truncated" ? "incomplete" : "completed", max_output_tokens: 32768,
    reasoning: { effort }, truncation: "disabled", ...(kind === "truncated" ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    output: [{ type: "message", role: "assistant", status: kind === "truncated" ? "incomplete" : "completed", content }] };
  const normalized = parseInferenceResponse(rawResponse, { selection: { provider: "openai" }, prompt: {
    responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: 32768 } } }, metadata(modelId));
  return { methodId: "deep-single-response-v1", startedAt: continuation ? "2026-11-08T00:21:00.000Z" : originalStarted,
    finishedAt: continuation ? "2026-11-08T00:21:01.000Z" : oldFinished, inferenceTimeoutMs: 600000, inferenceRequests: 1,
    httpStatus: 200, failure: null, rawResponse, normalized, outcome: extractAnswer(normalized.reply, `one-shot-json-v2-${effort}`) };
}
function infrastructure(modelId: DeepModelId): DeepAttempt {
  const effort = DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort;
  return { methodId: "deep-single-response-v1", startedAt: originalStarted, finishedAt: oldFinished, inferenceTimeoutMs: 600000,
    inferenceRequests: 1, httpStatus: null, failure: { code: "network-error", remoteOutcome: "unknown" }, rawResponse: null, normalized: null,
    outcome: extractAnswer({ status: "provider-error", text: "", message: "network-error" }, `one-shot-json-v2-${effort}`) };
}
function baseline(): AmendmentBaseline {
  const cases = population(), controlTask: ImportedCase = { ...cases[0], id: "fixture-control", expression: "x^4", requestedDepth: 1,
    actualDepth: 1, coreHashes: [sha256("separate-fixture-control")] };
  const controls: CompatibilityControl[] = DEEP_MODELS.map(model => ({ modelId: model.modelId, metadata: metadata(model.modelId), task: controlTask,
    dispatchSha256: sha256({ fixtureControl: model.modelId }), result: { ...attempt(model.modelId, "convex"),
      startedAt: "2026-11-08T00:00:00.000Z", finishedAt: "2026-11-08T00:00:01.000Z" } }));
  const study = freezeStudy({ frozenAt: originalFrozen, populationPath: "fixture/population.json", sourceId: "synthetic-fixture-source",
    populationSha256: sha256(cases), populationSnapshotSha256: sha256("fixture-retained-population"), implementationSha256: sha256("fixture-implementation"),
    referenceReview: { verdict: "pass", reviewer: "Synthetic fixture only", checkedAt: "2026-11-08T00:05:00.000Z", populationSha256: sha256(cases),
      populationSnapshotSha256: sha256("fixture-retained-population"), caseBindingsSha256: sha256(caseBindings(cases)) }, controls,
    accounting: { priorDevelopmentSends: 2, priorUnknownRemote: 1, priorEvidenceSha256: sha256("fixture-prior"), probeSends: 3 } }, cases);
  const rows = createRows(cases);
  for (let n = 0; n < 4; n++) {
    const row = rows[n], task = cases.find(task => task.id === row.caseId)!;
    const result = n === 1 ? null : n === 2 ? infrastructure(row.modelId) : attempt(row.modelId, task.label, n === 3 ? "invalid" : "answer");
    rows[n] = { ...row, dispatch: { studyId: study.id, ordinal: n + 1, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
      referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt: oldAuthorized,
      remoteOutcomeUntilRetained: "unknown" }, result };
  }
  return { study, cases, rows, report: reconstructReport(study, cases, rows, true, oldCutoff) };
}
function context(base: AmendmentBaseline): AmendmentContext {
  return { frozenAt: amendedFrozen, originalStartedAt: originalStarted, originalRootSnapshotSha256: sha256("fixture-original-root"),
    apiImplementationSha256: base.study.implementationSha256, operatorSha256: sha256("fixture-operator") };
}
const success: SchedulerOutcome = { modelOutcome: true, failureCode: null };
const controller = () => new AbortController().signal;

test("hashes the actual operator module through its file URL under the pinned Bun runtime", async () => {
  expect(Bun.version).toBe("1.4.4");
  const expected = createHash("sha256").update(await readFile(new URL("./deep-study-amendment.ts", import.meta.url))).digest("hex");
  expect(await operatorSha256()).toBe(expected);
});

test("selects the same 620 source-order cases without consulting outcomes, preserving 100/10 quotas and 207/207/206 labels", () => {
  const cases = population(), copy = structuredClone(cases), selected = selectAmendmentCases(cases);
  expect(selected).toHaveLength(620); expect(cases).toEqual(copy);
  expect(LABELS.map(label => selected.filter(task => task.label === label).length)).toEqual([207, 207, 206]);
  for (const depth of DEPTHS) {
    const rows = selected.filter(task => task.requestedDepth === depth);
    expect(rows).toHaveLength(depth < 320 ? 100 : 10);
    expect(rows.map(task => task.id)).toEqual(cases.filter(task => task.requestedDepth === depth &&
      (depth < 320 || Number(task.id.split("-").at(-1)) < 3 + Number(task.label === (depth === 320 ? "convex" : "concave")))).map(task => task.id));
  }
  expect(LABELS.map(label => selected.filter(task => task.requestedDepth === 320 && task.label === label).length)).toEqual([4, 3, 3]);
  expect(LABELS.map(label => selected.filter(task => task.requestedDepth === 512 && task.label === label).length)).toEqual([3, 4, 3]);
  expect(selectAmendmentCases(structuredClone(cases))).toEqual(selected);
  expect(() => selectAmendmentCases(cases.slice(1))).toThrow();
});

test("freezes 1860 logical cells plus the existing five development sends and retains every old authorization", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)); assertAmendment(amendment, base);
  expect(amendment.budget).toEqual({ maxLogicalCells: 1860, priorOldFinalSends: 4, maxNewSends: 1856, priorDevelopmentSends: 5,
    sharedPhaseCeiling: 1890, concurrencyCaps: [120, 96, 72], retries: 0, trialsPerCase: 1 });
  expect(amendment.originalDeadlineAt).toBe("2026-11-08T12:12:00.000Z");
  const rows = initialAmendmentRows(amendment, base); expect(rows).toHaveLength(1860);
  for (const old of base.rows.filter(row => row.dispatch)) expect(rows.find(row => row.caseId === old.caseId && row.modelId === old.modelId)).toEqual(old);
  const seen: number[] = []; let active = 0, peak = 0;
  const result = await scheduleAmendmentRows(rows, { signal: controller(), onTransition: async () => { throw new Error("Unexpected fallback"); },
    execute: async (_row, index) => { active++; peak = Math.max(peak, active); seen.push(index); await Promise.resolve(); active--; return success; } });
  expect(result).toMatchObject({ stopped: false, failures: 0, cap: 120, dispatched: 1856 });
  expect(peak).toBe(120); expect(active).toBe(0); expect(new Set(seen).size).toBe(1856);
  expect(seen.some(index => rows[index].dispatch !== null)).toBe(false);
});

test("refuses already-authorized high cases outside the selected subset and invalid chronology/budget bindings", () => {
  const base = baseline();
  const excluded = base.rows.findIndex(row => row.caseId === "fixture-320-convex-10");
  const task = base.cases.find(task => task.id === base.rows[excluded].caseId)!;
  const rows = base.rows.map((row, n) => n === excluded ? { ...row, dispatch: { studyId: base.study.id, ordinal: 5, modelId: row.modelId,
    caseId: row.caseId, trialIndex: 0 as const, referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)),
    authorizedAt: oldAuthorized, remoteOutcomeUntilRetained: "unknown" as const }, result: null } : row);
  const changed = { ...base, rows, report: reconstructReport(base.study, base.cases, rows, true, oldCutoff) };
  expect(() => createAmendment(changed, context(base))).toThrow("excluded old sends");
  for (const bad of [{ frozenAt: originalFrozen }, { originalStartedAt: "invalid" }, { originalStartedAt: "2026-11-08T00:09:00.000Z" },
    { apiImplementationSha256: sha256("changed") }, { operatorSha256: "invalid" }, { originalRootSnapshotSha256: "invalid" }])
    expect(() => createAmendment(base, { ...context(base), ...bad })).toThrow();
});

test("round-trips private baseline artifacts and rejects result/receipt/report/manifest tampering", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), dir = await mkdtemp(join(tmpdir(), "deep-amendment-"));
  try {
    const baselinePath = join(dir, "baseline.json"), amendmentPath = join(dir, "amendment.json");
    await writeArtifact(baselinePath, base); await writeArtifact(amendmentPath, amendment);
    const retained = JSON.parse(await readFile(baselinePath, "utf8")), manifest = JSON.parse(await readFile(amendmentPath, "utf8"));
    expect(() => assertAmendment(manifest, retained)).not.toThrow();
    const changedRows = structuredClone(retained); changedRows.rows[1].dispatch.requestBodySha256 = sha256("tampered");
    await writeFile(baselinePath, JSON.stringify(changedRows));
    const serializedTamper = JSON.parse(await readFile(baselinePath, "utf8"));
    expect(() => initialAmendmentRows(manifest, serializedTamper)).toThrow("baseline changed");
    expect(() => assertAmendment(manifest, changedRows)).toThrow();
    const resultChange = structuredClone(retained); resultChange.rows[0].result.outcome.label = "concave";
    expect(() => initialAmendmentRows(manifest, resultChange)).toThrow("baseline changed");
    const reportChange = structuredClone(retained); reportChange.report.cumulativeSends++;
    expect(() => assertAmendment(manifest, reportChange)).toThrow();
    for (const mutation of [{ id: "changed" }, { budget: { ...manifest.budget, maxNewSends: 1857 } },
      { selectedCaseIds: [...manifest.selectedCaseIds].reverse() }, { originalRootSnapshotSha256: sha256("changed") }])
      expect(() => assertAmendment({ ...manifest, ...mutation }, retained)).toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("drains the full old generation before 120→96→72 fallback and never retries rate-limited cells", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base);
  const starts: { index: number; generation: number }[] = [], transitions: unknown[] = [], gates = new Map<number, ReturnType<typeof Promise.withResolvers<SchedulerOutcome>>>();
  const latches = [Promise.withResolvers<void>(), Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const counts = [0, 0, 0], caps = [120, 96, 72]; let now = 100000, active = 0, peak = 0;
  const pending = scheduleAmendmentRows(rows, { signal: controller(), now: () => now, sleep: async ms => { now += ms; },
    onTransition: async event => { transitions.push(event); }, execute: async (_row, index, generation) => {
      active++; peak = Math.max(peak, active); starts.push({ index, generation }); const gate = Promise.withResolvers<SchedulerOutcome>(); gates.set(index, gate);
      if (++counts[generation] === caps[generation]) latches[generation].resolve();
      try { return await gate.promise; } finally { active--; }
    } });
  await latches[0].promise;
  const first = starts[0]; gates.get(first.index)!.resolve({ modelOutcome: false, failureCode: "rate-limited", retryAfterMs: 5000 });
  await Bun.sleep(0); now += 6000;
  for (const row of starts.filter(row => row.generation === 0).slice(1, 31)) gates.get(row.index)!.resolve(success);
  await Bun.sleep(0); expect(counts[1]).toBe(0);
  for (const row of starts.filter(row => row.generation === 0)) gates.get(row.index)!.resolve(success);
  await latches[1].promise; expect(active).toBe(96);
  const next = starts.find(row => row.generation === 1)!;
  gates.get(next.index)!.resolve({ modelOutcome: false, failureCode: "rate-limited" });
  await Bun.sleep(0); now += 6000;
  for (const row of starts.filter(row => row.generation === 1)) gates.get(row.index)!.resolve(success);
  await latches[2].promise; expect(active).toBe(72);
  const last = starts.find(row => row.generation === 2)!;
  gates.get(last.index)!.resolve({ modelOutcome: false, failureCode: "rate-limited" });
  await Bun.sleep(0); for (const row of starts.filter(row => row.generation === 2)) gates.get(row.index)!.resolve(success);
  const result = await pending;
  expect(result).toMatchObject({ stopped: true, failures: 0, cap: 72, dispatched: 288, stopReason: "rate-limited-at-72" });
  expect(peak).toBe(120); expect(active).toBe(0); expect(new Set(starts.map(row => row.index)).size).toBe(starts.length);
  expect(transitions).toMatchObject([{ kind: "rate-cap", generation: 1, from: 120, to: 96 }, { kind: "rate-cap", generation: 2, from: 96, to: 72 }]);
});

test("does not trigger a second fallback from stale old-generation rate limits", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base), transitions: unknown[] = [];
  let now = 100000;
  const result = await scheduleAmendmentRows(rows, { signal: controller(), now: () => now, sleep: async ms => { now += ms; },
    onTransition: async event => { transitions.push(event); }, execute: async (_row, _index, generation) => generation === 0
      ? { modelOutcome: false, failureCode: "rate-limited" } : success });
  expect(transitions).toHaveLength(1); expect(result).toMatchObject({ stopped: false, cap: 96, dispatched: 1856 });
});

test("non-rate failures and persistence failures stop new work and drain active peers without fallback or retry", async () => {
  for (const failure of ["timeout", "network-error", "service-unavailable", "invalid-provider-response"] as const) {
    const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base), transitions: unknown[] = [], seen: number[] = [];
    const result = await scheduleAmendmentRows(rows, { signal: controller(), onTransition: async event => { transitions.push(event); },
      execute: async (_row, index) => { seen.push(index); await Promise.resolve(); return { modelOutcome: false, failureCode: failure }; } });
    expect(result).toMatchObject({ stopped: true, cap: 120, dispatched: 120 }); expect(transitions).toHaveLength(0);
    expect(new Set(seen).size).toBe(120);
  }
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base);
  let fatal = 0;
  const result = await scheduleAmendmentRows(rows, { signal: controller(), onTransition: async () => {}, onFatal: () => { fatal++; },
    execute: async () => { throw new Error("Synthetic persistence failure"); } });
  expect(result).toMatchObject({ stopped: true, cap: 120, dispatched: 120, stopReason: "execution-or-persistence" });
  expect(fatal).toBe(120); expect(result.failures).toBe(120);
});

test("separates wrong labels/unusable from infrastructure and unknowns under 620/100/10 denominators", () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base);
  const report = reconstructAmendmentReport(amendment, base, rows, true);
  expect(report).toMatchObject({ version: "2", oldFinalSends: 4, newFinalSends: 0, cumulativeSends: 9, dispatched: 4 });
  const astra = report.models[0].overall;
  expect(astra).toMatchObject({ planned: 620, dispatched: 2, modelOutcomes: 2, correct: 1, wrongValid: 0, unusable: 1, accuracy: 0.5 });
  expect(astra.macroF1).toBeCloseTo(2 / 9, 12);
  const active = reconstructAmendmentReport(amendment, base, rows, false);
  expect(active.models[1].overall).toMatchObject({ providerFailures: 1, unknownRemote: 1, inFlight: 0 });
  expect(report.models[1].overall).toMatchObject({ planned: 620, dispatched: 1, modelOutcomes: 0, providerFailures: 1, unknownRemote: 1, accuracy: null });
  expect(report.models[2].overall).toMatchObject({ planned: 620, dispatched: 1, modelOutcomes: 0, providerFailures: 1, unknownRemote: 1 });
  for (const model of report.models) expect(model.byDepth.map(slice => slice.score.planned)).toEqual([100, 100, 100, 100, 100, 100, 10, 10]);
  const wrongIndex = rows.findIndex(row => row.modelId === "gpt-6-astra" && !row.dispatch && base.cases.find(task => task.id === row.caseId)!.label === "concave");
  const row = rows[wrongIndex], task = base.cases.find(task => task.id === row.caseId)!;
  rows[wrongIndex] = { ...row, dispatch: { studyId: amendment.id, ordinal: 5, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
    referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt: "2026-11-08T00:21:00.500Z", remoteOutcomeUntilRetained: "unknown" },
    result: attempt(row.modelId, "convex", "answer", true) };
  const changed = reconstructAmendmentReport(amendment, base, rows, true);
  expect(changed.models[0].overall).toMatchObject({ planned: 620, modelOutcomes: 3, correct: 1, wrongValid: 1, unusable: 1, accuracy: 1 / 3 });
  expect(changed.models[0].overall.macroF1).toBeCloseTo(1 / 6, 12);
  const oldMutation = rows.map((r, i) => i === 1 ? { ...r, result: attempt(r.modelId, "convex", "answer", true) } : r);
  expect(() => reconstructAmendmentReport(amendment, base, oldMutation, true)).toThrow("changed or resent");
});

test("cancels fresh scheduling before start or during a generation without retrying active cells", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base);
  const before = new AbortController(); before.abort(); let calls = 0;
  const unstarted = await scheduleAmendmentRows(rows, { signal: before.signal, onTransition: async () => {}, execute: async () => { calls++; return success; } });
  expect(unstarted).toMatchObject({ stopped: true, dispatched: 0 }); expect(calls).toBe(0);
  const during = new AbortController(), gate = Promise.withResolvers<SchedulerOutcome>(), started = Promise.withResolvers<void>(), visited: number[] = [];
  const pending = scheduleAmendmentRows(rows, { signal: during.signal, onTransition: async () => {}, execute: async (_row, index) => {
    visited.push(index); if (visited.length === 120) started.resolve(); return gate.promise;
  } });
  await started.promise; during.abort(); gate.resolve(success);
  expect(await pending).toMatchObject({ stopped: true, dispatched: 120 });
  expect(visited).toHaveLength(120); expect(new Set(visited).size).toBe(120);
});

test("a failed fallback event write stops before lowering the cap or authorizing another generation", async () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base);
  const visited: number[] = []; let fatal = 0;
  const result = await scheduleAmendmentRows(rows, { signal: controller(), onFatal: () => { fatal++; },
    onTransition: async () => { throw new Error("Synthetic immutable event persistence failure."); },
    execute: async (_row, index) => { visited.push(index); return index === 4 ? { modelOutcome: false, failureCode: "rate-limited" } : success; } });
  expect(result).toMatchObject({ stopped: true, failures: 1, cap: 120, dispatched: 120, stopReason: "transition-persistence" });
  expect(fatal).toBe(1); expect(visited).toHaveLength(120); expect(new Set(visited).size).toBe(120);
});

test("exports audited v2 counts of 620 per model and 100/10 per depth without exposing private transcript data", () => {
  const base = baseline(), amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base), report = reconstructAmendmentReport(amendment, base, rows, true);
  const invalid = rows.find(row => row.result?.outcome.kind === "invalid")!;
  const audit: OutcomeAudit = { verdict: "pass", reviewer: "Synthetic fixture arithmetic reviewer", checkedAt: "2026-11-08T00:25:00.000Z",
    reportSha256: sha256(report), rowsSha256: sha256(rows), inspectedWrongOrUnusable: [`${invalid.modelId}:${invalid.caseId}`],
    diagnoses: [{ modelId: invalid.modelId, caseId: invalid.caseId, referenceSha256: invalid.dispatch!.referenceSha256,
      requestBodySha256: invalid.dispatch!.requestBodySha256, resultSha256: sha256(invalid.result), note: "Synthetic invalid JSON protocol fixture." }],
    correctLabelExplanationsInspected: 1, explanationFindings: [] };
  const summary = buildAmendmentPublicSummary(amendment, base, rows, report, audit);
  expect(summary).toMatchObject({ version: "2", plannedTasksPerModel: 620, trialsPerTask: 1 });
  expect(summary.taskCounts).toEqual(DEPTHS.map(requestedDepth => ({ requestedDepth, tasks: requestedDepth < 320 ? 100 : 10 })));
  expect(summary.models.every(model => model.overall.planned === 620)).toBe(true);
  expect(summary.models.flatMap(model => model.byDepth).every(slice => slice.score.planned === (slice.requestedDepth < 320 ? 100 : 10))).toBe(true);
  expect(summary).not.toHaveProperty("tasksPerDepth");
  const encoded = JSON.stringify(summary);
  expect(encoded).not.toContain("rawResponse"); expect(encoded).not.toContain("Synthetic accounting fixture."); expect(encoded).not.toContain(base.cases[0].expression);
  expect(() => buildAmendmentPublicSummary(amendment, base, rows, report, { ...audit, diagnoses: [] })).toThrow();
  expect(() => buildAmendmentPublicSummary(amendment, base, rows, report, { ...audit, correctLabelExplanationsInspected: 0 })).toThrow();
  expect(() => buildAmendmentPublicSummary(amendment, base, rows, report, { ...audit, rowsSha256: sha256("unbound") })).toThrow();
});

test("requires explicit continuation charge consent and bounds untrusted Retry-After data", () => {
  expect(() => parseAmendmentArguments(["run"])).toThrow();
  expect(parseAmendmentArguments(["run", "--accept-charges"])).toMatchObject({ command: "run" });
  expect(parseAmendmentArguments(["export", "--audit", "/tmp/synthetic-audit.json"])).toMatchObject({ command: "export" });
  for (const args of [[], ["run", "--accept-charges", "--accept-charges"], ["freeze", "--accept-charges"], ["export"], ["report", "--other"]])
    expect(() => parseAmendmentArguments(args)).toThrow();
  expect(retryAfterMilliseconds("0")).toBe(0); expect(retryAfterMilliseconds("1.5")).toBe(1500); expect(retryAfterMilliseconds("600")).toBe(600000);
  for (const value of [null, "", "601", "-1", "1e3", "NaN", " 1 ", "9".repeat(30)]) expect(retryAfterMilliseconds(value)).toBeUndefined();
});

test("round-trips a baseline above 64 MiB using bounded chunks and rejects missing/extra/corrupt artifacts", async () => {
  const base = baseline(), rows = createRows(base.cases), padding = "p".repeat(600 * 1024);
  for (let index = 0; index < 120; index++) {
    const row = rows[index], task = base.cases.find(task => task.id === row.caseId)!, value = attempt(row.modelId, task.label);
    rows[index] = { ...row, dispatch: { studyId: base.study.id, ordinal: index + 1, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
      referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt: oldAuthorized,
      remoteOutcomeUntilRetained: "unknown" }, result: { ...value, rawResponse: { ...(value.rawResponse as Record<string, unknown>), opaqueFixture: padding } } };
  }
  const large: AmendmentBaseline = { ...base, rows, report: reconstructReport(base.study, base.cases, rows, true, oldCutoff) };
  expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(64 * 1024 * 1024);
  const directory = await mkdtemp(join(tmpdir(), "deep-amendment-large-"));
  try {
    await writeAmendmentBaseline(directory, large);
    const files = await readdir(join(directory, "baseline"));
    for (const file of files) expect((await lstat(join(directory, "baseline", file))).size).toBeLessThanOrEqual(64 * 1024 * 1024);
    expect(files.filter(file => file.startsWith("rows-"))).toHaveLength(5);
    const loaded = await readAmendmentBaseline(directory);
    expect(sha256(loaded)).toBe(sha256(large)); expect(loaded.cases).toHaveLength(800); expect(loaded.rows).toHaveLength(2400);
    const chunkPath = join(directory, "baseline", "rows-0.json"), backup = join(directory, "baseline", "moved.json");
    await rename(chunkPath, backup); await expect(readAmendmentBaseline(directory)).rejects.toThrow(); await rename(backup, chunkPath);
    const extra = join(directory, "baseline", "unexpected.json"); await writeFile(extra, "{}");
    await expect(readAmendmentBaseline(directory)).rejects.toThrow(); await rm(extra);
    const originalChunk = await readFile(chunkPath, "utf8"), alteredChunk = JSON.parse(originalChunk);
    alteredChunk[0].result.rawResponse.opaqueFixture = "q" + alteredChunk[0].result.rawResponse.opaqueFixture.slice(1);
    await writeFile(chunkPath, JSON.stringify(alteredChunk)); await expect(readAmendmentBaseline(directory)).rejects.toThrow();
    await writeFile(chunkPath, originalChunk);
    const indexPath = join(directory, "baseline.json"), index = JSON.parse(await readFile(indexPath, "utf8"));
    index.rows[0].sha256 = sha256("tampered-index"); await writeFile(indexPath, JSON.stringify(index));
    await expect(readAmendmentBaseline(directory)).rejects.toThrow();
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 20000);

test("retains a drifted successful reply as known identity infrastructure rather than math evidence or unknown remote", () => {
  const initial = baseline(), empty = createRows(initial.cases);
  const base: AmendmentBaseline = { ...initial, rows: empty, report: reconstructReport(initial.study, initial.cases, empty, true, oldCutoff) };
  const amendment = createAmendment(base, context(base)), rows = initialAmendmentRows(amendment, base), index = 1;
  const row = rows[index], task = base.cases.find(task => task.id === row.caseId)!, value = attempt(row.modelId, task.label, "answer", true);
  const rawResponse = { ...(value.rawResponse as Record<string, unknown>), model: "drifted-model" };
  const normalized = parseInferenceResponse(rawResponse, { selection: { provider: "openai" }, prompt: {
    responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: 32768 } } }, metadata(row.modelId));
  const drifted = { ...value, rawResponse, normalized }, original = structuredClone(drifted);
  rows[index] = { ...row, dispatch: { studyId: amendment.id, ordinal: 1, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
    referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)),
    authorizedAt: "2026-11-08T00:21:00.500Z", remoteOutcomeUntilRetained: "unknown" }, result: drifted };
  const report = reconstructAmendmentReport(amendment, base, rows, true);
  expect(report.models[1].overall).toMatchObject({ planned: 620, dispatched: 1, modelOutcomes: 0, correct: 0, wrongValid: 0, unusable: 0,
    providerFailures: 1, identityFailures: 1, unknownRemote: 0, accuracy: null, macroF1: null });
  expect(rows[index].result).toEqual(original); expect(rows[index].result!.failure).toBeNull();
  const audit: OutcomeAudit = { verdict: "pass", reviewer: "Synthetic identity-boundary reviewer", checkedAt: "2026-11-08T00:25:00.000Z",
    reportSha256: sha256(report), rowsSha256: sha256(rows), inspectedWrongOrUnusable: [], diagnoses: [], correctLabelExplanationsInspected: 0, explanationFindings: [] };
  expect(() => buildAmendmentPublicSummary(amendment, base, rows, report, audit)).not.toThrow();
  expect(() => buildAmendmentPublicSummary(amendment, base, rows, report, { ...audit, explanationFindings: [{ modelId: row.modelId,
    caseId: row.caseId, resultSha256: sha256(drifted), note: "This unaccepted identity cannot supply a scored correct-label explanation." }] })).toThrow();
  rows[index] = { ...rows[index], result: value };
  expect(reconstructAmendmentReport(amendment, base, rows, true).models[1].overall).toMatchObject({ modelOutcomes: 1, correct: 1,
    identityFailures: 0, providerFailures: 0, unknownRemote: 0, accuracy: 1, macroF1: 1 / 3 });
});
