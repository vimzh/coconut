// Synthetic expansion fixtures verify retained authorizations, bounded dispatch and full-population scoring.
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createModelSelectionClient } from "../apps/api/src/discovery";
import { parseOpenAIModel } from "../apps/api/src/discovery/catalog";
import { parseInferenceResponse } from "../apps/api/src/inference/adapters";
import type { Label } from "../apps/api/src/math";
import { extractAnswer } from "../apps/api/src/protocol";
import { sha256 } from "../apps/api/src/quality/data";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { buildBody, createRows, MODELS, reconstructReport as screenReport, selectCases, SETTINGS,
  type Attempt, type Manifest, type ModelId, type Row } from "./cheap-depth-screen";
import { assertExpansion, createExpansion, initialRows, operatorSha256, parseRetryAfter, reconstructReport, scheduleRows } from "./cheap-depth-expand";

const DEPTHS = [5, 10, 20, 40, 80, 160, 320, 512] as const, LABELS = ["convex", "concave", "neither"] as const;
const screenFrozen = "2026-11-08T00:00:00.000Z", oldStarted = "2026-11-08T00:00:01.000Z", oldAuthorized = "2026-11-08T00:00:01.500Z",
  oldFinished = "2026-11-08T00:00:02.000Z", expandedFrozen = "2026-11-08T00:01:00.000Z", newStarted = "2026-11-08T00:01:01.000Z",
  newAuthorized = "2026-11-08T00:01:01.500Z", newFinished = "2026-11-08T00:01:02.000Z";
const pin = (modelId: ModelId) => MODELS.find(model => model.modelId === modelId)!.reportedIds.at(-1)!;
function population(): ImportedCase[] {
  return DEPTHS.flatMap((requestedDepth, d) => LABELS.flatMap((label, l) => Array.from({ length: 33 + Number(d % 3 === l) }, (_, n) => {
    const id = `expand-fixture-${requestedDepth}-${label}-${n}`;
    return { id, label, expression: `${label === "concave" ? "-x^2" : label === "convex" ? "x^2" : "x^3"}+${300 * d + 100 * l + n + 1}`,
      domain: { min: "-1", max: "1" }, referenceSha256: sha256({ reference: id }), coreHashes: [sha256({ core: id })],
      requestedDepth, actualDepth: requestedDepth + n % 2, astDepth: 2, nonlinearPath: 1, nodeCount: 4 };
  })));
}
function attempt(modelId: ModelId, label: Label, kind: "answer" | "invalid" | "truncated" = "answer", fresh = false, reportedId = pin(modelId)): Attempt {
  const text = kind === "invalid" ? "not-json-fixture" : JSON.stringify({ label, explanation: "Offline expansion fixture." });
  const rawResponse = { model: reportedId, status: kind === "truncated" ? "incomplete" : "completed", max_output_tokens: 8192,
    truncation: "disabled", ...(modelId === "gpt-5.6-luna" ? { reasoning: { effort: "none" } } : {}),
    ...(kind === "truncated" ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    output: [{ type: "message", role: "assistant", status: kind === "truncated" ? "incomplete" : "completed", content: [{ type: "output_text", text }] }] };
  const metadata = parseOpenAIModel({ id: modelId, object: "model" }, { provider: "openai", modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" });
  const normalized = parseInferenceResponse(rawResponse, { selection: { provider: "openai" }, prompt: {
    responseFormat: { kind: "prompted-json" }, generation: { maxOutputTokens: 8192 } } }, metadata);
  return { methodId: SETTINGS.methodId, startedAt: fresh ? newStarted : oldStarted, finishedAt: fresh ? newFinished : oldFinished,
    inferenceTimeoutMs: 180000, inferenceRequests: 1, httpStatus: 200, failure: null, rawResponse, normalized,
    outcome: extractAnswer(normalized.reply, SETTINGS.extractionProfile) };
}
function infrastructure(modelId: ModelId, code: "network-error" | "rate-limited" = "network-error"): Attempt {
  const failure = { code, remoteOutcome: code === "rate-limited" ? "response-received" as const : "unknown" as const };
  return { methodId: SETTINGS.methodId, startedAt: newStarted, finishedAt: newFinished, inferenceTimeoutMs: 180000, inferenceRequests: 1,
    httpStatus: code === "rate-limited" ? 429 : null, failure, rawResponse: code === "rate-limited" ? { error: { message: "Offline rate fixture" } } : null,
    normalized: null, outcome: extractAnswer({ status: "provider-error", text: "", message: code }, SETTINGS.extractionProfile) };
}
async function fixture() {
  const cases = population(), parentIds = cases.filter(task => task.requestedDepth < 320 || Number(task.id.split("-").at(-1)) <
    3 + Number(task.label === (task.requestedDepth === 320 ? "convex" : "concave"))).map(task => task.id), selected = selectCases(cases, parentIds);
  const metadata = await Promise.all(MODELS.map(async model => {
    const result = await createModelSelectionClient(async (_url, init) => { expect(init.method).toBe("GET"); return Response.json({ id: model.modelId, object: "model" }); })(
      { provider: "openai", modelId: model.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, "sk-expand-offline-fixture-123456789");
    return { ...result, checkedAt: "2026-11-07T23:59:00.000Z", expiresAt: "2026-11-08T00:59:00.000Z" };
  }));
  const content = { version: "1" as const, frozenAt: screenFrozen, settings: SETTINGS, models: MODELS, operatorSha256: sha256("screen-source-fixture"),
    apiImplementationSha256: sha256("api-source-fixture"), parentId: "certified-parent-fixture", parentManifestSha256: sha256("parent-manifest-fixture"),
    parentReportSha256: sha256("parent-report-fixture"), populationSnapshotSha256: sha256("population-snapshot-fixture"), cases: selected,
    caseBindingsSha256: sha256(selected), requestBindingsSha256: sha256(selected.flatMap(task => MODELS.map(model => sha256(buildBody(task, model.modelId))))), metadata };
  const manifest: Manifest = { ...content, id: `cheap-depth-screen-v1-${sha256(content)}` }, rows = createRows(selected);
  for (const [index, row] of rows.entries()) {
    const task = selected[Math.floor(index / 3)]; row.dispatch = { studyId: manifest.id, ordinal: index + 1, modelId: row.modelId, caseId: row.caseId,
      trialIndex: 0, referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildBody(task, row.modelId)), authorizedAt: oldAuthorized, remoteOutcomeUntilRetained: "unknown" };
    row.result = attempt(row.modelId, task.label);
  }
  return { cases, manifest, rows, report: { ...screenReport(selected, rows, true), studyId: manifest.id, evidenceCutoffAt: oldFinished, sealed: true } };
}

async function expanded() {
  const old = await fixture(), bindings = { frozenAt: expandedFrozen, operatorSha256: sha256("expansion-source-fixture"),
    apiImplementationSha256: old.manifest.apiImplementationSha256, screenOperatorSha256: old.manifest.operatorSha256,
    screenRootSnapshotSha256: sha256("screen-root-fixture"), parentId: old.manifest.parentId,
    parentManifestSha256: old.manifest.parentManifestSha256, parentReportSha256: old.manifest.parentReportSha256,
    populationSnapshotSha256: old.manifest.populationSnapshotSha256 };
  const expansion = createExpansion(old.cases, old.manifest, old.rows, old.report, bindings);
  return { ...old, expansion, fullRows: initialRows(expansion), bindings };
}
function authorize(rows: Row[], index: number, cases: readonly ImportedCase[], studyId: string) {
  const row = rows[index], task = cases.find(task => task.id === row.caseId)!;
  row.dispatch = { studyId, ordinal: rows.filter(row => row.dispatch !== null).length + 1, modelId: row.modelId, caseId: row.caseId,
    trialIndex: 0, referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildBody(task, row.modelId)),
    authorizedAt: newAuthorized, remoteOutcomeUntilRetained: "unknown" };
}
const signal = () => new AbortController().signal;
type Scheduled = { result: Attempt; retryAfterMs?: number };

test("binds all800 original cases and240 inherited attempts, leaving exactly2160 new one-trial cells", async () => {
  const base = await expanded(), old = structuredClone(base.rows), e = base.expansion;
  expect(Bun.version).toBe("1.4.4"); expect(() => assertExpansion(e)).not.toThrow(); expect(e.cases).toEqual(base.cases);
  expect(e.cases).toHaveLength(800); expect(LABELS.map(label => e.cases.filter(task => task.label === label).length)).toEqual([267, 267, 266]);
  expect(DEPTHS.map(depth => e.cases.filter(task => task.requestedDepth === depth).length)).toEqual(DEPTHS.map(() => 100));
  expect(base.fullRows).toHaveLength(2400); expect(base.fullRows.filter(row => !row.dispatch)).toHaveLength(2160);
  for (const model of MODELS) {
    expect(e.pins[model.modelId]).toBe(pin(model.modelId)); expect(base.fullRows.filter(row => row.modelId === model.modelId)).toHaveLength(800);
    expect(base.fullRows.filter(row => row.modelId === model.modelId && !row.dispatch)).toHaveLength(720);
  }
  for (const row of old) expect(base.fullRows.find(full => full.modelId === row.modelId && full.caseId === row.caseId)).toEqual(row);
  expect(e.screenManifest.settings.maxOutputTokens).toBe(8192); expect(e.screenManifest.settings.inferenceTimeoutMs).toBe(180000);
  expect(e.settings).toMatchObject({ maxRequests: 2400, priorRequests: 240, maxNewRequests: 2160, concurrencyCaps: [120, 96, 72], retries: 0 }); expect(base.rows).toEqual(old);
  const expectedHash = createHash("sha256").update(await readFile(new URL("./cheap-depth-expand.ts", import.meta.url))).digest("hex");
  expect(await operatorSha256()).toBe(expectedHash);
});

test("rejects missing/duplicated parent or baseline identities and any changed frozen old receipt or grade", async () => {
  const base = await expanded(), e = base.expansion;
  for (const cases of [base.cases.slice(1), [...base.cases.slice(1), base.cases[1]]])
    expect(() => createExpansion(cases, base.manifest, base.rows, base.report, base.bindings)).toThrow();
  for (const rows of [base.rows.slice(1), [...base.rows.slice(1), base.rows[1]]])
    expect(() => createExpansion(base.cases, base.manifest, rows, base.report, base.bindings)).toThrow();
  expect(() => assertExpansion({ ...e, cases: e.cases.map((task, n) => n ? task : { ...task, referenceSha256: sha256("changed") }) })).toThrow();
  expect(() => assertExpansion({ ...e, baselineRows: e.baselineRows.map((row, n) => n ? row : { ...row,
    dispatch: { ...row.dispatch!, requestBodySha256: sha256("changed") } }) })).toThrow();
  expect(() => assertExpansion({ ...e, baselineRows: e.baselineRows.map((row, n) => n ? row : { ...row,
    result: { ...row.result!, outcome: { ...row.result!.outcome, kind: "invalid" } } as Attempt }) })).toThrow();
  expect(() => assertExpansion({ ...e, screenOperatorSha256: sha256("changed") })).toThrow();
  expect(() => assertExpansion({ ...e, pins: { ...e.pins, "gpt-4.1-mini": "different-served-model" } })).toThrow();
  expect(() => assertExpansion(JSON.parse(JSON.stringify(e)))).not.toThrow();
  const failedPrior = base.rows.map((row, index) => index === 3 ? { ...row, result: { ...infrastructure(row.modelId), startedAt: oldStarted, finishedAt: oldFinished } } : row);
  const failedReport = { ...screenReport(base.manifest.cases, failedPrior, true), studyId: base.manifest.id, evidenceCutoffAt: oldFinished, sealed: true };
  const retainedFailure = createExpansion(base.cases, base.manifest, failedPrior, failedReport, base.bindings), merged = initialRows(retainedFailure);
  expect(merged.find(row => row.modelId === failedPrior[3].modelId && row.caseId === failedPrior[3].caseId)).toEqual(failedPrior[3]);
  expect(merged.filter(row => !row.dispatch)).toHaveLength(2160);
});

test("reuses every old authorization without resending, with at most120 active new calls and no settings change", async () => {
  const base = await expanded(), rows = base.fullRows, retained = structuredClone(base.rows), starts: number[] = [], release = Promise.withResolvers<void>(), filled = Promise.withResolvers<void>();
  let active = 0, peak = 0;
  const pending = scheduleRows(rows, { pins: base.expansion.pins, signal: signal(), persistControl: async () => { throw new Error("Unexpected control transition"); }, execute: async index => {
    expect(rows[index].dispatch).toBeNull(); active++; peak = Math.max(peak, active); starts.push(index); authorize(rows, index, base.cases, base.expansion.id);
    if (active === 120) filled.resolve(); await release.promise; active--;
    const task = base.cases.find(task => task.id === rows[index].caseId)!; return { result: attempt(rows[index].modelId, task.label, "answer", true) };
  } });
  await filled.promise; expect(active).toBe(120); expect(starts).toHaveLength(120); release.resolve(); const state = await pending;
  expect(state.stopped).toBe(false); expect(peak).toBe(120); expect(active).toBe(0); expect(starts).toHaveLength(2160); expect(new Set(starts).size).toBe(2160);
  expect(rows.map(row => row.dispatch!.ordinal).sort((a, b) => a - b)).toEqual(Array.from({ length: 2400 }, (_, n) => n + 1));
  for (const old of retained) expect(rows.find(row => row.modelId === old.modelId && row.caseId === old.caseId)).toEqual(old);
  const report = reconstructReport(base.cases, rows, base.expansion.pins, true);
  for (const model of report.models) { expect(model.overall.planned).toBe(800); expect(model.overall.dispatched).toBe(800); expect(model.overall.modelOutcomes).toBe(800);
    expect(model.overall.correct).toBe(800); expect(model.overall.accuracy).toBe(1); expect(model.overall.macroF1).toBe(1);
    const settings: Record<string, unknown> = model.settings; expect(settings.maxRequests).not.toBe(240); expect(settings.concurrency).not.toBe(24);
    expect(model.byDepth.map(depth => depth.score.planned)).toEqual(DEPTHS.map(() => 100)); }
});

test("scores inherited and new outcomes under800/100 denominators while keeping identity/unknown infrastructure separate", async () => {
  const base = await expanded(), rows = base.fullRows, modelId = "gpt-4.1-mini", eligible = (label: Label) => rows.flatMap((row, index) => row.modelId === modelId && !row.dispatch && base.cases.find(task => task.id === row.caseId)!.label === label ? [index] : []);
  const correct = eligible("convex")[0], wrong = eligible("concave")[0], [invalid, network, missing, drift] = eligible("neither").slice(0, 4);
  for (const [index, result] of [[correct, attempt(modelId, "convex", "answer", true)], [wrong, attempt(modelId, "convex", "answer", true)],
    [invalid, attempt(modelId, "neither", "invalid", true)], [network, infrastructure(modelId)],
    [drift, attempt(modelId, "neither", "answer", true, "gpt-4.1-mini")]] as const) { authorize(rows, index, base.cases, base.expansion.id); rows[index].result = result; }
  authorize(rows, missing, base.cases, base.expansion.id);
  const report = reconstructReport(base.cases, rows, base.expansion.pins, true), model = report.models.find(model => model.modelId === modelId)!;
  expect(model.overall).toMatchObject({ planned: 800, dispatched: 86, modelOutcomes: 83, correct: 81, wrongValid: 1, unusable: 1, providerFailures: 3, identityFailures: 1, unknownRemote: 2, unattempted: 714, accuracy: 81 / 83 });
  expect(model.overall.macroF1).toBeCloseTo((56 / 57 + 54 / 55 + 52 / 53) / 3, 12);
  const live = reconstructReport(base.cases, rows, base.expansion.pins, false).models.find(model => model.modelId === modelId)!;
  expect(live.overall).toMatchObject({ providerFailures: 2, unknownRemote: 1, inFlight: 1 });
  expect(rows[drift].result?.rawResponse).toEqual(attempt(modelId, "neither", "answer", true, "gpt-4.1-mini").rawResponse);
});

test("drains each generation before120→96→72, respects cooldown and stops on a further429 without retry", async () => {
  const base = await expanded(), rows = base.fullRows, caps = [120, 96, 72], counts = [0, 0, 0], starts: { index: number; generation: number; at: number }[] = [];
  const gates = new Map<number, ReturnType<typeof Promise.withResolvers<Scheduled>>>(), latches = caps.map(() => Promise.withResolvers<void>()), events: { kind: string; generation: number; from: number; to: number; cooldownMs: number }[] = [];
  let now = 100000, active = 0, peak = 0; const sleeps: number[] = [];
  const pending = scheduleRows(rows, { pins: base.expansion.pins, signal: signal(), now: () => now, sleep: async ms => { sleeps.push(ms); now += ms; },
    persistControl: async event => { events.push(event); }, execute: async (index, generation) => {
      active++; peak = Math.max(peak, active); starts.push({ index, generation, at: now }); authorize(rows, index, base.cases, base.expansion.id);
      const gate = Promise.withResolvers<Scheduled>(); gates.set(index, gate); if (++counts[generation] === caps[generation]) latches[generation].resolve();
      try { return await gate.promise; } finally { active--; }
    } });
  const successful = (index: number): Scheduled => ({ result: attempt(rows[index].modelId, base.cases.find(task => task.id === rows[index].caseId)!.label, "answer", true) });
  await latches[0].promise; const first = starts[0]; gates.get(first.index)!.resolve({ result: infrastructure(rows[first.index].modelId, "rate-limited"), retryAfterMs: 5000 });
  await Bun.sleep(0); now += 6000;
  for (const row of starts.filter(row => row.generation === 0).slice(1, 31)) gates.get(row.index)!.resolve(successful(row.index));
  await Bun.sleep(0); expect(counts[1]).toBe(0);
  for (const row of starts.filter(row => row.generation === 0)) gates.get(row.index)!.resolve(successful(row.index));
  await latches[1].promise; expect(active).toBe(96); expect(starts.filter(row => row.generation === 1).every(row => row.at >= 105000)).toBe(true);
  const second = starts.find(row => row.generation === 1)!; gates.get(second.index)!.resolve({ result: infrastructure(rows[second.index].modelId, "rate-limited"), retryAfterMs: 7000 });
  await Bun.sleep(0); for (const row of starts.filter(row => row.generation === 1)) gates.get(row.index)!.resolve(successful(row.index));
  await latches[2].promise; expect(active).toBe(72); expect(sleeps).toContain(7000); expect(starts.filter(row => row.generation === 2).every(row => row.at >= 113000)).toBe(true);
  const last = starts.find(row => row.generation === 2)!; gates.get(last.index)!.resolve({ result: infrastructure(rows[last.index].modelId, "rate-limited") });
  await Bun.sleep(0); for (const row of starts.filter(row => row.generation === 2)) gates.get(row.index)!.resolve(successful(row.index));
  const result = await pending; expect(result).toMatchObject({ stopped: true, stopReason: "rate-limited-at-72", cap: 72, dispatched: 288 });
  expect(peak).toBe(120); expect(active).toBe(0); expect(new Set(starts.map(row => row.index)).size).toBe(288);
  expect(events).toMatchObject([{ kind: "rate-cap", generation: 1, from: 120, to: 96, cooldownMs: 5000 }, { kind: "rate-cap", generation: 2, from: 96, to: 72, cooldownMs: 7000 }, { kind: "stop-fresh", generation: 2, from: 72, to: 72 }]);
});

test("stale prior-generation429 replies extend the cooldown without another reduction or any retry", async () => {
  const base = await expanded(), rows = base.fullRows, seen: number[] = [], nextStarts: number[] = [], events: { kind: string }[] = []; let now = 100000;
  const state = await scheduleRows(rows, { pins: base.expansion.pins, signal: signal(), now: () => now, sleep: async ms => { now += ms; },
    persistControl: async event => { events.push(event); }, execute: async (index, generation) => {
      seen.push(index); authorize(rows, index, base.cases, base.expansion.id);
      if (generation === 0) return { result: infrastructure(rows[index].modelId, "rate-limited"), retryAfterMs: seen.length === 1 ? 5000 : 12000 };
      nextStarts.push(now); return { result: attempt(rows[index].modelId, "convex", "answer", true) };
    } });
  expect(state).toMatchObject({ stopped: false, cap: 96, generation: 1, dispatched: 2160 }); expect(events.filter(event => event.kind === "rate-cap")).toHaveLength(1);
  expect(nextStarts.length).toBe(2040); expect(nextStarts.every(at => at >= 112000)).toBe(true);
  expect(seen).toHaveLength(2160); expect(new Set(seen).size).toBe(2160); expect(rows.filter(row => row.result?.failure?.code === "rate-limited")).toHaveLength(120);
});

test("non-rate infrastructure and accepted-alias identity drift stop fresh work while active peers drain", async () => {
  for (const kind of ["provider", "identity", "excess-delay"] as const) {
    const base = await expanded(), rows = base.fullRows, first = rows.findIndex(row => !row.dispatch), starts: number[] = [], release = Promise.withResolvers<void>(), filled = Promise.withResolvers<void>(), fail = Promise.withResolvers<void>();
    let active = 0, aborted = 0;
    const pending = scheduleRows(rows, { pins: base.expansion.pins, signal: signal(), abort: () => { aborted++; }, persistControl: async () => {}, execute: async index => {
      starts.push(index); active++; authorize(rows, index, base.cases, base.expansion.id); if (active === 120) filled.resolve();
      await (index === first ? fail.promise : release.promise); active--;
      return { result: index === first ? kind === "provider" ? infrastructure(rows[index].modelId) : kind === "excess-delay" ? infrastructure(rows[index].modelId, "rate-limited") : attempt(rows[index].modelId, "convex", "answer", true, "gpt-4.1-mini") : attempt(rows[index].modelId, "convex", "answer", true),
        ...(index === first && kind === "excess-delay" ? { retryAfterMs: 1800001 } : {}) };
    } });
    await filled.promise; fail.resolve(); await Bun.sleep(0); expect(starts).toHaveLength(120); expect(active).toBe(119); expect(aborted).toBe(0);
    release.resolve(); const result = await pending; expect(result.stopped).toBe(true); expect(starts).toHaveLength(120); expect(new Set(starts).size).toBe(120); expect(active).toBe(0);
    if (kind === "excess-delay") expect(result).toMatchObject({ stopReason: "retry-after-exceeds-phase", cap: 120 });
    expect(rows[first].result?.failure === null).toBe(kind === "identity");
  }
});

test("persistence and control-journal failures stop fresh work without aborting authorized peer wires", async () => {
  for (const kind of ["receipt", "control"] as const) {
    const base = await expanded(), rows = base.fullRows, first = rows.findIndex(row => !row.dispatch), starts: number[] = [], stop = new AbortController(), wire = new AbortController();
    const fail = Promise.withResolvers<void>(), release = Promise.withResolvers<void>(), filled = Promise.withResolvers<void>(); let active = 0, stopped = 0;
    const pending = scheduleRows(rows, { pins: base.expansion.pins, signal: stop.signal, abort: () => { stopped++; stop.abort(); },
      persistControl: async () => { throw new Error("Synthetic control persistence failure"); }, execute: async index => {
        starts.push(index); active++; if (active === 120) filled.resolve();
        try {
          if (index === first) { await fail.promise; if (kind === "receipt") throw new Error("Synthetic receipt persistence failure"); }
          else await release.promise;
          expect(wire.signal.aborted).toBe(false); authorize(rows, index, base.cases, base.expansion.id);
          return { result: index === first ? infrastructure(rows[index].modelId, "rate-limited") : attempt(rows[index].modelId, "convex", "answer", true) };
        } finally { active--; }
      } });
    void pending.catch(() => {}); await filled.promise; fail.resolve(); await Bun.sleep(0);
    expect(stop.signal.aborted).toBe(true); expect(wire.signal.aborted).toBe(false); expect(active).toBe(119); expect(starts).toHaveLength(120);
    release.resolve(); await expect(pending).rejects.toThrow("persistence failure"); expect(active).toBe(0); expect(stopped).toBe(1); expect(starts).toHaveLength(120);
    expect(rows.filter(row => row.result)).toHaveLength(kind === "receipt" ? 359 : 360);
  }
});

test("changed receipt/ref/body/result identity or a repeated/gapped ordinal cannot enter full-population scores", async () => {
  const base = await expanded(), rows = base.fullRows, first = rows.findIndex(row => !row.dispatch);
  authorize(rows, first, base.cases, base.expansion.id); rows[first].result = attempt(rows[first].modelId, "convex", "answer", true);
  expect(rows[first].dispatch!.ordinal).toBe(241); expect(() => reconstructReport(base.cases, rows, base.expansion.pins, true)).not.toThrow();
  for (const changed of [{ referenceSha256: sha256("changed") }, { requestBodySha256: sha256("changed") }, { ordinal: 240 }, { ordinal: 242 }, { caseId: "unknown-fixture" }]) {
    const copy = structuredClone(rows); copy[first].dispatch = { ...copy[first].dispatch!, ...changed };
    expect(() => reconstructReport(base.cases, copy, base.expansion.pins, true)).toThrow();
  }
  const grade = structuredClone(rows); grade[first].result = { ...grade[first].result!, outcome: { ...grade[first].result!.outcome, kind: "invalid" } } as Attempt;
  expect(() => reconstructReport(base.cases, grade, base.expansion.pins, true)).toThrow();
  const duplicate = structuredClone(rows); duplicate[first + 1] = duplicate[first]; expect(() => reconstructReport(base.cases, duplicate, base.expansion.pins, true)).toThrow();
  expect(() => reconstructReport(base.cases.slice(1), rows, base.expansion.pins, true)).toThrow();
});

test("a pre-stopped phase makes no new calls and refuses any partial or repeated scheduling state", async () => {
  const base = await expanded(), stop = new AbortController(); stop.abort(); let calls = 0;
  const options = { pins: base.expansion.pins, signal: stop.signal, persistControl: async () => {}, execute: async (index: number) => { calls++; return { result: attempt(base.fullRows[index].modelId, "convex", "answer", true) }; } };
  expect(await scheduleRows(base.fullRows, options)).toMatchObject({ stopped: true, dispatched: 0 }); expect(calls).toBe(0);
  const missingOld = structuredClone(base.fullRows), oldIndex = missingOld.findIndex(row => row.dispatch); missingOld[oldIndex].result = null;
  await expect(scheduleRows(missingOld, { ...options, signal: signal() })).rejects.toThrow(); expect(calls).toBe(0);
  const duplicate = structuredClone(base.fullRows); duplicate[1] = duplicate[0]; await expect(scheduleRows(duplicate, { ...options, signal: signal() })).rejects.toThrow();
  expect(parseRetryAfter("1.25", 100000)).toBe(1250); expect(parseRetryAfter("Thu, 01 Jan 1970 00:02:00 GMT", 100000)).toBe(20000);
  expect(parseRetryAfter(null, 100000)).toBeUndefined(); expect(parseRetryAfter("invalid", 100000)).toBeUndefined();
});
