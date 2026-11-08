// Synthetic protocol fixtures test accounting and bindings; they supply no source-generation or reference-certification evidence.
import { expect, it } from "bun:test";
import type { ModelMetadata } from "../discovery";
import { parseInferenceResponse } from "../inference/adapters";
import type { Label } from "../math";
import { extractAnswer } from "../protocol";
import { sha256 } from "../quality/data";
import type { ImportedCase } from "../randomized/types";
import { assertStudy, caseBindings, createRows, DEPTHS, freezeStudy, hasModelOutcome, reconstructReport, STUDY_BUDGET, validatePopulation, validateRows,
  type CompatibilityControl, type DeepReceipt, type DeepRow, type DeepStudy } from "./study";
import { buildDeepRequestBody, DEEP_MODELS, DEEP_SETTINGS, type DeepAttempt, type DeepModelId } from "./transport";
import { buildPublicSummary, validateTerminal, type OutcomeAudit } from "./execution";
import { parseDeepArguments } from "./cli";
import { parseDeepStudySummary } from "../../../web/src/lib/deep-study-summary";

const LABELS = ["convex", "concave", "neither"] as const;
const frozenAt = "2026-11-08T00:10:00.000Z", startedAt = "2026-11-08T00:12:00.000Z",
  authorizedAt = "2026-11-08T00:12:00.500Z", finishedAt = "2026-11-08T00:12:01.000Z";
function syntheticPopulation(): ImportedCase[] {
  return DEPTHS.flatMap((depth, depthOrdinal) => LABELS.flatMap((label, labelOrdinal) =>
    Array.from({ length: 33 + Number(depthOrdinal % 3 === labelOrdinal) }, (_, index) => {
      const id = `synthetic-${depth}-${label}-${index}`, offset = depthOrdinal * 300 + labelOrdinal * 100 + index + 1;
      return { id, label, expression: `${label === "convex" ? "x^2" : label === "concave" ? "-x^2" : "x^3"} + ${offset}`,
        domain: { min: "-1", max: "1" }, referenceSha256: sha256({ fixtureReference: id }), coreHashes: [sha256({ fixtureCore: id })],
        requestedDepth: depth, actualDepth: depth + index % 2, astDepth: 2, nonlinearPath: 1, nodeCount: 4 };
    })));
}
function metadata(modelId: DeepModelId): ModelMetadata {
  return { modelId, canonicalId: null, displayName: "Synthetic model fixture", providerModelId: null, servingProvider: null,
    providerDisplayName: null, routeStatus: null, hosted: "available", exactRoute: true,
    capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: "max_output_tokens", supportedParameters: null, pricing: null };
}
function attempt(modelId: DeepModelId, label: Label, kind: "answer" | "invalid" | "refused" | "truncated" = "answer"): DeepAttempt {
  const effort = DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort;
  const content = kind === "refused" ? [{ type: "refusal", refusal: "Synthetic refusal." }]
    : [{ type: "output_text", text: kind === "invalid" ? "invalid-json-fixture" : JSON.stringify({ label, explanation: "Synthetic protocol fixture." }) }];
  const rawResponse = { model: modelId, status: kind === "truncated" ? "incomplete" : "completed", max_output_tokens: 32768,
    reasoning: { effort }, truncation: "disabled", ...(kind === "truncated" ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    output: [{ type: "message", role: "assistant", status: kind === "truncated" ? "incomplete" : "completed", content }] };
  const normalized = parseInferenceResponse(rawResponse, { selection: { provider: "openai" }, prompt: { responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: 32768 } } }, metadata(modelId));
  return { methodId: "deep-single-response-v1", startedAt, finishedAt, inferenceTimeoutMs: 600000, inferenceRequests: 1, httpStatus: 200,
    failure: null, rawResponse, normalized, outcome: extractAnswer(normalized.reply, `one-shot-json-v2-${effort}`) };
}
function infrastructure(modelId: DeepModelId, unknown = true): DeepAttempt {
  const effort = DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort;
  const code = unknown ? "network-error" : "service-unavailable";
  return { methodId: "deep-single-response-v1", startedAt, finishedAt, inferenceTimeoutMs: 600000, inferenceRequests: 1,
    httpStatus: unknown ? null : 503, failure: { code, remoteOutcome: unknown ? "unknown" : "response-received" },
    rawResponse: unknown ? null : { error: { code: "server_error", message: "Synthetic service failure." } }, normalized: null,
    outcome: extractAnswer({ status: "provider-error", text: "", message: code }, `one-shot-json-v2-${effort}`) };
}
const cases = syntheticPopulation();
const controlTask: ImportedCase = { ...cases[0], id: "synthetic-control", expression: "x^4", coreHashes: [sha256("synthetic-separate-control-core")], requestedDepth: 1, actualDepth: 1 };
const controls: CompatibilityControl[] = DEEP_MODELS.map(model => ({ modelId: model.modelId, metadata: metadata(model.modelId), task: controlTask,
  dispatchSha256: sha256({ fixtureControlDispatch: model.modelId }), result: { ...attempt(model.modelId, "convex"), startedAt: "2026-11-08T00:00:00.000Z", finishedAt: "2026-11-08T00:00:01.000Z" } }));
const input: Parameters<typeof freezeStudy>[0] = { frozenAt, populationPath: "synthetic-fixtures/population.json", populationSha256: sha256({ fixturePopulation: cases }),
  populationSnapshotSha256: sha256("synthetic-retained-population-files"),
  sourceId: "synthetic-source-fixture", implementationSha256: sha256("synthetic-implementation"),
  referenceReview: { verdict: "pass", reviewer: "Synthetic protocol fixture only", checkedAt: "2026-11-08T00:05:00.000Z",
    populationSnapshotSha256: sha256("synthetic-retained-population-files"),
    populationSha256: sha256({ fixturePopulation: cases }), caseBindingsSha256: sha256(caseBindings(cases)) },
  controls, accounting: { priorDevelopmentSends: 2, priorUnknownRemote: 1, priorEvidenceSha256: sha256("synthetic-prior-evidence"), probeSends: 3 } };
const study = freezeStudy(input, cases);
function dispatched(rows: DeepRow[], index: number, ordinal: number, result: DeepAttempt | null): void {
  const row = rows[index], task = cases.find(task => task.id === row.caseId)!;
  const dispatch: DeepReceipt = { studyId: study.id, ordinal, modelId: row.modelId, caseId: row.caseId, trialIndex: 0,
    referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildDeepRequestBody(task, row.modelId)), authorizedAt, remoteOutcomeUntilRetained: "unknown" };
  rows[index] = { ...row, dispatch, result };
}

it("freezes all eight rotating 100-case quotas, three model controls, and 2400 exact request identities", () => {
  validatePopulation(cases); assertStudy(study, cases, input.implementationSha256);
  expect(cases).toHaveLength(800); expect(new Set(cases.map(task => task.id)).size).toBe(800);
  expect(new Set(cases.map(task => sha256({ expression: task.expression, domain: task.domain }))).size).toBe(800);
  expect(LABELS.map(label => cases.filter(task => task.label === label).length)).toEqual([267, 267, 266]);
  for (const [index, depth] of DEPTHS.entries()) expect(LABELS.map(label => cases.filter(task => task.requestedDepth === depth && task.label === label).length))
    .toEqual(LABELS.map((_, labelIndex) => 33 + Number(index % 3 === labelIndex)));
  expect(study).toMatchObject({ methodId: "deep-single-response-v1", models: DEEP_MODELS, settings: DEEP_SETTINGS,
    budget: { finalSends: 2400, developmentSends: 30, sharedSendCeiling: 2430, maxConcurrency: 12, retries: 0, trialsPerCase: 1 },
    accounting: { priorDevelopmentSends: 2, priorUnknownRemote: 1, probeSends: 3 } });
  expect(study.budget).toEqual(STUDY_BUDGET);
  expect(study.requestBindingsSha256).toBe(sha256(cases.flatMap(task => DEEP_MODELS.map(model => sha256(buildDeepRequestBody(task, model.modelId))))));
  expect(freezeStudy(structuredClone(input), structuredClone(cases))).toEqual(study);
  const rows = createRows(cases);
  expect(rows).toHaveLength(2400); expect(new Set(rows.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size).toBe(2400);
  expect(rows.every(row => row.trialIndex === 0 && row.dispatch === null && row.result === null)).toBe(true);
});

it("rejects missing/duplicate cases, wrong depth quotas and out-of-policy task bounds", () => {
  expect(() => validatePopulation(cases.slice(1))).toThrow("800 distinct");
  expect(() => validatePopulation([cases[0], ...cases.slice(0, -1)])).toThrow("800 distinct");
  const duplicate = cases.map((task, index) => index === 1 ? { ...task, expression: cases[0].expression } : task);
  expect(() => validatePopulation(duplicate)).toThrow("800 distinct");
  const quota = cases.map((task, index) => index === 0 ? { ...task, label: "concave" as const } : task);
  expect(() => validatePopulation(quota)).toThrow("rotating");
  const mutations: Partial<ImportedCase>[] = [{ requestedDepth: 1000 }, { actualDepth: 7 }, { domain: { min: "0", max: "1" } },
    { referenceSha256: "invalid" }, { id: "unsafe/id" }, { expression: " " }, { expression: "x".repeat(131073) },
    { nodeCount: 0 }, { nodeCount: 16385 }, { astDepth: 4097 }, { nonlinearPath: 3 }, { coreHashes: [] }, { coreHashes: ["invalid"] }];
  for (const mutation of mutations) expect(() => validatePopulation(cases.map((task, index) => index === 0 ? { ...task, ...mutation } : task))).toThrow();
});

it("binds review, accounting, implementation, settings, population order and model controls against mutation", () => {
  const mutations: ((value: DeepStudy) => DeepStudy)[] = [
    value => ({ ...value, id: "changed" }), value => ({ ...value, frozenAt: "2026-11-08T00:11:00.000Z" }),
    value => ({ ...value, caseBindingsSha256: sha256("changed") }), value => ({ ...value, requestBindingsSha256: sha256("changed") }),
    value => ({ ...value, populationSha256: sha256("changed") }), value => ({ ...value, implementationSha256: sha256("changed") }),
    value => ({ ...value, populationSnapshotSha256: sha256("changed") }),
    value => ({ ...value, referenceReview: { ...value.referenceReview, reviewer: "changed" } }),
    value => ({ ...value, accounting: { ...value.accounting, priorEvidenceSha256: sha256("changed") } }),
    value => ({ ...value, budget: { ...value.budget, maxConcurrency: 11 } } as unknown as DeepStudy),
    value => ({ ...value, settings: { ...value.settings, maxOutputTokens: 16384 } } as unknown as DeepStudy),
    value => ({ ...value, models: [...value.models].reverse() } as unknown as DeepStudy),
    value => ({ ...value, controls: value.controls.map((control, index) => index === 0 ? { ...control, dispatchSha256: sha256("changed") } : control) }),
  ];
  for (const mutate of mutations) expect(() => assertStudy(mutate(structuredClone(study)), cases, input.implementationSha256)).toThrow();
  expect(() => assertStudy(study, [...cases.slice(1), cases[0]], input.implementationSha256)).toThrow("review");
  expect(() => assertStudy(study, cases, sha256("changed implementation"))).toThrow("implementation changed");
  for (const mutation of [{ frozenAt: "not-a-time" }, { referenceReview: { ...input.referenceReview, checkedAt: "not-a-time" } },
    { referenceReview: { ...input.referenceReview, checkedAt: "2026-11-08T00:11:00.000Z" } },
    { referenceReview: { ...input.referenceReview, populationSha256: sha256("unbound population") } }])
    expect(() => freezeStudy({ ...input, ...mutation }, cases)).toThrow("bound");
});

it("requires one distinct exact compatible control per model and keeps every control outside the final population", () => {
  expect(() => freezeStudy({ ...input, controls: controls.slice(1) }, cases)).toThrow("per model");
  expect(() => freezeStudy({ ...input, controls: [controls[0], controls[0], controls[2]] }, cases)).toThrow("per model");
  const mutations: ((control: CompatibilityControl) => CompatibilityControl)[] = [
    control => ({ ...control, task: { ...control.task, coreHashes: cases[0].coreHashes } }),
    control => ({ ...control, dispatchSha256: "invalid" }), control => ({ ...control, metadata: { ...control.metadata, exactRoute: false } }),
    control => ({ ...control, metadata: { ...control.metadata, modelId: "other" } }), control => ({ ...control, metadata: { ...control.metadata, servingProvider: "other" } }),
    control => ({ ...control, task: { ...control.task, id: cases[0].id } }),
    control => ({ ...control, task: { ...control.task, expression: cases[0].expression, domain: cases[0].domain } }),
    control => ({ ...control, result: { ...control.result, inferenceRequests: 0 } }),
    control => ({ ...control, result: { ...control.result, methodId: "other" } } as unknown as CompatibilityControl),
    control => ({ ...control, result: { ...control.result, inferenceTimeoutMs: 180000 } } as unknown as CompatibilityControl),
    control => ({ ...control, result: { ...control.result, startedAt: "invalid" } }),
    control => ({ ...control, result: { ...control.result, finishedAt: "invalid" } }),
    control => ({ ...control, result: { ...control.result, finishedAt: "2026-11-08T00:11:00.000Z" } }),
    control => ({ ...control, result: { ...control.result, normalized: null } }),
    control => ({ ...control, result: { ...control.result, normalized: { ...control.result.normalized!, reportedModelId: null } } }),
    control => ({ ...control, result: { ...control.result, normalized: { ...control.result.normalized!, effective: { ...control.result.normalized!.effective, reasoningEffort: "high" } } } }),
    control => ({ ...control, result: { ...control.result, normalized: { ...control.result.normalized!, effective: { ...control.result.normalized!.effective, maxOutputTokens: 16384 } } } }),
  ];
  for (const mutate of mutations) expect(() => freezeStudy({ ...input, controls: controls.map((control, index) => index === 0 ? mutate(control) : control) }, cases)).toThrow("compatibility control");
});

it("separates parameter compatibility from control accuracy and rejects control replies without model outcomes", () => {
  const original = controls[0];
  for (const kind of ["answer", "invalid", "refused", "truncated"] as const) {
    const result = { ...attempt(original.modelId, "concave", kind), startedAt: original.result.startedAt, finishedAt: original.result.finishedAt };
    expect(() => freezeStudy({ ...input, controls: [{ ...original, result }, ...controls.slice(1)] }, cases)).not.toThrow();
  }
  for (const status of ["interrupted", "provider-error"] as const) {
    const reply = status === "interrupted" ? { status, text: "" } : { status, text: "", message: "Synthetic provider error." };
    const result: DeepAttempt = { ...original.result, normalized: { ...original.result.normalized!, reply },
      outcome: extractAnswer(reply, "one-shot-json-v2-max") };
    expect(() => freezeStudy({ ...input, controls: [{ ...original, result }, ...controls.slice(1)] }, cases)).toThrow("compatibility control");
  }
});

it("keeps planned/missing denominators explicit without inventing answers or repeated-trial statistics", () => {
  const report = reconstructReport(study, cases, createRows(cases), true);
  expect(report).toMatchObject({ state: "unavailable", dispatched: 0, cumulativeSends: 5 });
  for (const model of report.models) {
    expect(model.overall).toMatchObject({ planned: 800, dispatched: 0, modelOutcomes: 0, correct: 0, wrongValid: 0, unusable: 0,
      providerFailures: 0, unknownRemote: 0, inFlight: 0, unattempted: 800, accuracy: null, macroF1: null, status: "planned",
      classification: { population: { plannedTrials: 800, includedTrials: 0, excludedTrials: 800, correctTrials: 0, status: "unavailable" } } });
    expect(model.overall).not.toHaveProperty("agreement"); expect(model.overall).not.toHaveProperty("spread"); expect(model.overall).not.toHaveProperty("trials");
    expect(model.byDepth.map(slice => slice.requestedDepth)).toEqual([...DEPTHS]);
    expect(model.byDepth.every(slice => slice.score.planned === 100 && slice.score.accuracy === null && slice.score.macroF1 === null)).toBe(true);
  }
});

it("includes unusable model replies in accuracy/F1 while excluding provider failures and receipt-only sends", () => {
  const rows = createRows(cases), modelId = DEEP_MODELS[0].modelId;
  const convex = rows.findIndex(row => row.modelId === modelId && cases.find(task => task.id === row.caseId)!.label === "convex");
  const concave = rows.findIndex(row => row.modelId === modelId && cases.find(task => task.id === row.caseId)!.label === "concave");
  const neither = rows.findIndex(row => row.modelId === modelId && cases.find(task => task.id === row.caseId)!.label === "neither");
  const indices = [convex, concave, neither, convex + 3, convex + 6, convex + 9, convex + 12, convex + 15];
  const outcomes = [attempt(modelId, "convex"), attempt(modelId, "convex"), attempt(modelId, "neither", "invalid"),
    attempt(modelId, "convex", "refused"), attempt(modelId, "convex", "truncated"), infrastructure(modelId), infrastructure(modelId, false), null];
  indices.forEach((index, ordinal) => dispatched(rows, index, ordinal + 1, outcomes[ordinal]));
  const active = reconstructReport(study, cases, rows, false).models[0].overall;
  expect(active).toMatchObject({ planned: 800, dispatched: 8, modelOutcomes: 5, correct: 1, wrongValid: 1, unusable: 3,
    providerFailures: 2, unknownRemote: 1, inFlight: 1, unattempted: 792, accuracy: 1 / 5, status: "provisional",
    classification: { population: { includedTrials: 5, excludedTrials: 795, correctTrials: 1 },
      classes: { convex: { tp: 1, fp: 1, fn: 2, support: 3, f1: 2 / 5 }, concave: { tp: 0, fn: 1, support: 1, f1: 0 }, neither: { tp: 0, fn: 1, support: 1, f1: 0 } } } });
  expect(active.macroF1).toBeCloseTo(2 / 15, 12);
  expect(active.classification.confusion.rows.convex.counts).toEqual({ convex: 1, concave: 0, neither: 0, unusable: 2 });
  const terminal = reconstructReport(study, cases, rows, true).models[0].overall;
  expect(terminal).toMatchObject({ providerFailures: 3, unknownRemote: 2, inFlight: 0, modelOutcomes: 5, correct: 1, accuracy: 1 / 5 });
  expect(terminal.macroF1).toBe(active.macroF1);
  expect(rows[indices.at(-1)!].result).toBeNull();
  const unaffected = reconstructReport(study, cases, rows, true).models[1].overall;
  expect(unaffected).toMatchObject({ dispatched: 0, modelOutcomes: 0, accuracy: null, status: "planned" });
});

it("uses a fixed three-class macro-F1 even when only one reference class has an observed model outcome", () => {
  const rows = createRows(cases);
  dispatched(rows, 0, 1, attempt(rows[0].modelId, "convex"));
  const score = reconstructReport(study, cases, rows, true).models[0].overall;
  expect(score.accuracy).toBe(1); expect(score.macroF1).toBe(1 / 3);
  expect(score.classification.classes.concave.f1).toBe(0); expect(score.classification.classes.neither.f1).toBe(0);
  expect(score.status).toBe("provisional");
});

it("reconstructs complete 800-case/model scores and eight disjoint 100-case depth partitions", () => {
  const rows = createRows(cases), tasks = new Map(cases.map(task => [task.id, task]));
  for (const [index, row] of rows.entries()) dispatched(rows, index, index + 1, attempt(row.modelId, tasks.get(row.caseId)!.label));
  const report = reconstructReport(study, cases, rows, true);
  expect(report).toMatchObject({ state: "complete", dispatched: 2400, cumulativeSends: 2405, rowsSha256: sha256(rows) });
  for (const model of report.models) {
    expect(model.overall).toMatchObject({ planned: 800, dispatched: 800, modelOutcomes: 800, correct: 800, wrongValid: 0, unusable: 0,
      providerFailures: 0, unknownRemote: 0, unattempted: 0, status: "complete", accuracy: 1, macroF1: 1 });
    expect(model.byDepth.reduce((sum, slice) => sum + slice.score.modelOutcomes, 0)).toBe(800);
    for (const slice of model.byDepth) {
      expect(slice.score).toMatchObject({ planned: 100, modelOutcomes: 100, correct: 100, status: "complete", accuracy: 1, macroF1: 1 });
      expect(slice.realizedDepths.reduce((sum, value) => sum + value.count, 0)).toBe(100);
      expect(slice.realizedDepths.map(value => value.depth)).toEqual([slice.requestedDepth, slice.requestedDepth + 1]);
    }
  }
});

it("retains terminal receipt-only sends as unknown infrastructure with no invented model outcome", () => {
  const rows = createRows(cases); dispatched(rows, 0, 1, null);
  const running = reconstructReport(study, cases, rows, false), terminal = reconstructReport(study, cases, rows, true);
  expect(running.models[0].overall).toMatchObject({ dispatched: 1, inFlight: 1, unknownRemote: 0, providerFailures: 0, modelOutcomes: 0, accuracy: null, status: "unavailable" });
  expect(terminal.models[0].overall).toMatchObject({ dispatched: 1, inFlight: 0, unknownRemote: 1, providerFailures: 1, modelOutcomes: 0, accuracy: null, status: "unavailable" });
  expect(terminal).toMatchObject({ state: "unavailable", dispatched: 1, cumulativeSends: 6 });
  expect(rows[0].result).toBeNull();
});

it("rejects repeated/order-shifted trial identities and altered dispatch, timing or accepted-settings bindings", () => {
  const rows = createRows(cases); dispatched(rows, 0, 1, attempt(rows[0].modelId, "convex"));
  dispatched(rows, 1, 2, attempt(rows[1].modelId, "convex")); validateRows(study, cases, rows);
  for (const changed of [rows.slice(1), [rows[0], ...rows.slice(0, -1)], [rows[1], rows[0], ...rows.slice(2)]])
    expect(() => validateRows(study, cases, changed)).toThrow("exactly once");
  const receipts: Partial<DeepReceipt>[] = [{ studyId: "other" }, { caseId: "other" }, { modelId: "gpt-6-luna" }, { referenceSha256: sha256("other") },
    { requestBodySha256: sha256("other") }, { ordinal: 2 }, { ordinal: 0 }, { ordinal: 3 }, { authorizedAt: "invalid" },
    { authorizedAt: "2026-11-08T00:09:00.000Z" }, { remoteOutcomeUntilRetained: "response-received" as "unknown" }];
  for (const mutation of receipts) expect(() => validateRows(study, cases, rows.map((row, index) => index === 0 ? { ...row, dispatch: { ...row.dispatch!, ...mutation } } : row))).toThrow();
  const attempts: Partial<DeepAttempt>[] = [{ inferenceRequests: 0 }, { methodId: "other" as DeepAttempt["methodId"] }, { inferenceTimeoutMs: 180000 as 600000 },
    { startedAt: "invalid" }, { finishedAt: "invalid" }, { startedAt: "2026-11-08T00:12:00.900Z" }, { finishedAt: "2026-11-08T00:12:00.100Z" },
    { normalized: null }, { normalized: { ...rows[0].result!.normalized!, reportedModelId: "other" } },
    { normalized: { ...rows[0].result!.normalized!, effective: { ...rows[0].result!.normalized!.effective, maxOutputTokens: 16384 } } },
    { normalized: { ...rows[0].result!.normalized!, effective: { ...rows[0].result!.normalized!.effective, reasoningEffort: "high" } } }];
  for (const mutation of attempts) expect(() => validateRows(study, cases, rows.map((row, index) => index === 0 ? { ...row, result: { ...row.result!, ...mutation } } : row))).toThrow();
  expect(() => validateRows(study, cases, rows.map((row, index) => index === 0 ? { ...row, dispatch: null } : row))).toThrow("original dispatch");
});

it("recognizes only retained answer/invalid/refused/truncated outcomes as model evidence", () => {
  expect(hasModelOutcome(null)).toBe(false);
  for (const kind of ["answer", "invalid", "refused", "truncated"] as const) expect(hasModelOutcome(attempt("gpt-6-astra", "convex", kind))).toBe(true);
  expect(hasModelOutcome(infrastructure("gpt-6-astra"))).toBe(false);
  expect(hasModelOutcome({ ...attempt("gpt-6-astra", "convex"), inferenceRequests: 0 })).toBe(false);
});

it("rejects corrupt terminal records before treating pending receipts as unknown infrastructure", () => {
  const rows = createRows(cases); dispatched(rows, 0, 1, null);
  const terminal = { studyId: study.id, finishedAt, stopped: true, failures: 0, authorizedSends: 1 };
  expect(() => validateTerminal(terminal, study, rows)).not.toThrow();
  for (const bad of [null, "", [], {}, { ...terminal, studyId: "other" }, { ...terminal, authorizedSends: 2 },
    { ...terminal, finishedAt: "invalid" }, { ...terminal, finishedAt: "2026-11-08T00:00:00.000Z" }, { ...terminal, stopped: false },
    { ...terminal, failures: 13 }, { ...terminal, failures: -1 }]) expect(() => validateTerminal(bad, study, rows)).toThrow();
});

it("exports only the audited aggregate with every depth matching independent arithmetic and the landing schema", () => {
  const rows = createRows(cases);
  dispatched(rows, 0, 1, attempt("gpt-6-astra", "convex"));
  dispatched(rows, 3, 2, attempt("gpt-6-astra", "neither"));
  dispatched(rows, 6, 3, attempt("gpt-6-astra", "convex", "invalid"));
  dispatched(rows, 9, 4, infrastructure("gpt-6-astra"));
  const report = reconstructReport(study, cases, rows, true);
  const failures = [rows[3], rows[6]], audit: OutcomeAudit = { verdict: "pass", reviewer: "Synthetic arithmetic reviewer", checkedAt: "2026-11-08T00:15:00.000Z",
    reportSha256: sha256(report), rowsSha256: sha256(rows), inspectedWrongOrUnusable: failures.map(row => `${row.modelId}:${row.caseId}`),
    diagnoses: failures.map(row => ({ modelId: row.modelId, caseId: row.caseId, referenceSha256: row.dispatch!.referenceSha256,
      requestBodySha256: row.dispatch!.requestBodySha256, resultSha256: sha256(row.result), note: "Synthetic bound failure diagnosis." })),
    correctLabelExplanationsInspected: 1, explanationFindings: [] };
  const summary = parseDeepStudySummary(buildPublicSummary(study, cases, rows, report, audit));
  expect(summary.models).toHaveLength(3);
  const astra = summary.models[0];
  expect(astra.overall).toMatchObject({ planned: 800, dispatched: 4, modelOutcomes: 3, correct: 1, wrongValid: 1, unusable: 1, providerFailures: 1, unknownRemote: 1, unattempted: 796, inFlight: 0, status: "provisional" });
  expect(astra.overall.accuracy).toBe(1 / 3);
  expect(astra.overall.macroF1).toBe(1 / 6);
  for (const [index, slice] of astra.byDepth.entries()) {
    expect(slice.score.planned).toBe(100);
    expect(slice.score.correct).toBe(index === 0 ? 1 : 0);
    expect(slice.score.modelOutcomes).toBe(index === 0 ? 3 : 0);
    expect(slice.score.accuracy).toBe(index === 0 ? 1 / 3 : null);
    expect(slice.score.macroF1).toBe(index === 0 ? 1 / 6 : null);
  }
  const encoded = JSON.stringify(summary);
  expect(encoded).not.toContain(cases[0].expression); expect(encoded).not.toContain("rawResponse"); expect(encoded).not.toContain("Synthetic protocol fixture.");
  const badAudits = [{ ...audit, diagnoses: [] }, { ...audit, correctLabelExplanationsInspected: 0 }, { ...audit, inspectedWrongOrUnusable: [] },
    { ...audit, checkedAt: "2026-11-08T00:00:00.000Z" },
    { ...audit, explanationFindings: [{ modelId: rows[3].modelId, caseId: rows[3].caseId, resultSha256: sha256(rows[3].result), note: "Wrong-label row belongs in diagnoses." }] },
    { ...audit, reportSha256: sha256("other") }, { ...audit, rowsSha256: sha256("other") },
    { ...audit, diagnoses: audit.diagnoses.map((row, index) => index === 0 ? { ...row, referenceSha256: sha256("other") } : row) },
    { ...audit, diagnoses: audit.diagnoses.map((row, index) => index === 0 ? { ...row, resultSha256: sha256("other") } : row) }];
  for (const bad of badAudits) expect(() => buildPublicSummary(study, cases, rows, report, bad)).toThrow();
  const changed = { ...report, models: report.models.map((model, index) => index === 0 ? { ...model, overall: { ...model.overall, correct: 2 } } : model) };
  expect(() => buildPublicSummary(study, cases, rows, changed, audit)).toThrow("reconstructed");
});

it("requires explicit research CLI arguments and protects private generated artifacts", () => {
  for (const command of ["run", "controls"]) {
    expect(() => parseDeepArguments([command])).toThrow("missing");
    expect(parseDeepArguments([command, "--accept-charges"]).acceptCharges).toBe(true);
    expect(() => parseDeepArguments([command, "--accept-charges", "--accept-charges"])).toThrow("repeated");
  }
  for (const args of [[], ["run", "--output", "x"], ["freeze", "--population", "x"], ["report", "--accept-charges"],
    ["prepare", "--source", "x", "--python", "x", "--output", "/tmp/public", "--deadline", finishedAt]]) expect(() => parseDeepArguments(args)).toThrow();
  expect(parseDeepArguments(["freeze", "--population", "p", "--review", "r"]).command).toBe("freeze");
});
