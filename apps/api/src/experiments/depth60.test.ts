// Fixed-study fixtures preserve the original pilot and require terminal accounting before additional dispatch.
import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createInferenceClient, type InferenceResult } from "../inference";
import { buildPrompt } from "../protocol";
import { qualityDataHash } from "../quality";
import { assertDepth60Manifest, checkDepth100Gate, checkDepth60PriorPilot, checkDepth60Suite, countDepth60UnknownSends, createDepth60Manifest, DEPTH60_ADDITIONAL_MODELS, DEPTH60_MODELS, depth60Concurrency, depth60Dispatch, depth60Rows, exportDepth60Summary, isDepth60ModelOutcome, runDepth60Pool } from "./depth60";
import { validateFrozenSuite } from "../suites";
import type { FrozenSuite } from "../suites/types";

let suite: FrozenSuite, pilot: ReturnType<typeof createDepth60Manifest>, bindings: Record<string, string>, additionalBindings: Record<string, string>;
let retained: Parameters<typeof checkDepth60PriorPilot>[2], progress: Parameters<typeof checkDepth60PriorPilot>[3], audit: Parameters<typeof checkDepth60PriorPilot>[4], retainedText: string;
let depth100Population: Parameters<typeof checkDepth100Gate>[0], depth100Manifest: Parameters<typeof checkDepth100Gate>[1], depth100Retained: Parameters<typeof checkDepth100Gate>[2], depth100Progress: Parameters<typeof checkDepth100Gate>[3], depth100Bindings: Parameters<typeof checkDepth100Gate>[4];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function syntheticPrior(source: Parameters<typeof checkDepth60PriorPilot>[3]) {
  // Only public identities/reports are reused. These minimal outcomes are fixtures, never retained provider replies.
  const rows = source.rows.map(row => ({ modelId: row.modelId, caseId: row.caseId, trialIndex: row.trialIndex, dispatched: true,
    result: { requested: { modelId: row.modelId, profileId: "one-shot-json-v1" }, failure: null, inferenceRequests: 1, evidence: { outcome: { kind: row.outcome } } } as unknown as NonNullable<Parameters<typeof checkDepth60PriorPilot>[2]["rows"][number]["result"]> }));
  const retained = { ...source, rows }, progress = { ...source, rows: rows.map(row => ({ modelId: row.modelId, caseId: row.caseId, trialIndex: row.trialIndex, resultSha256: sha(JSON.stringify(row.result)), outcome: row.result.evidence.outcome.kind, failure: null })) };
  return { retained, progress, text: JSON.stringify(retained) };
}
beforeAll(async () => {
  const root = new URL("../../data/", import.meta.url), text = (path: string) => readFile(new URL(path, root), "utf8");
  suite = await validateFrozenSuite(JSON.parse(await text("suites/depth60-v1.json")));
  const pilotText = await text("experiments/depth60-matrix-v1.json"), progressText = await text("experiments/depth60-progress-v1.json"), auditText = await text("quality/depth60-results-audit-v1.json");
  const parsedPilot = JSON.parse(pilotText); pilot = parsedPilot;
  const pilotFixture = syntheticPrior(JSON.parse(progressText)); progress = pilotFixture.progress; retained = pilotFixture.retained; retainedText = pilotFixture.text;
  audit = { ...JSON.parse(auditText), sourceFileSha256: sha(retainedText) };
  bindings = { suiteId: suite.id, suiteFileSha256: parsedPilot.suiteFileSha256, reviewFileSha256: parsedPilot.reviewFileSha256, priorProgressFileSha256: parsedPilot.priorProgressFileSha256 };
  const matrix100Text = await text("experiments/depth100-matrix-v1.json"), progress100Text = await text("experiments/depth100-progress-v1.json"), population100Text = await text("research/depth100-population-v1.json"), review100Text = await text("quality/depth100-reference-review-v1.json");
  depth100Bindings = { priorProgress: sha(JSON.stringify(progress)), population: sha(population100Text), review: sha(review100Text) };
  depth100Manifest = { ...JSON.parse(matrix100Text), priorProgressFileSha256: depth100Bindings.priorProgress };
  const coordinatedFixture = syntheticPrior({ ...JSON.parse(progress100Text), manifestSha256: sha(JSON.stringify(depth100Manifest)) });
  depth100Progress = coordinatedFixture.progress; depth100Retained = coordinatedFixture.retained; depth100Population = JSON.parse(population100Text);
  additionalBindings = { ...bindings, originalPilotManifestFileSha256: sha(pilotText), originalPilotProgressFileSha256: sha(JSON.stringify(progress)), originalPilotResultFileSha256: sha(retainedText), originalPilotAuditFileSha256: sha(JSON.stringify(audit)),
    promptsSha256: sha(JSON.stringify(suite.cases.map(entry => buildPrompt(entry.reference, "one-shot-json-v1")))), depth100ManifestFileSha256: sha(JSON.stringify(depth100Manifest)), depth100ProgressFileSha256: sha(JSON.stringify(depth100Progress)), depth100ResultFileSha256: sha(coordinatedFixture.text), depth100FinishedAt: JSON.parse(progress100Text).finishedAt };
});

test("pilot requires its exact depth and balanced label population", async () => {
  const suite = await validateFrozenSuite(await Bun.file(new URL("../../data/suites/depth60-v1.json", import.meta.url)).json());
  expect(() => checkDepth60Suite(suite)).not.toThrow();
  expect(() => checkDepth60Suite({ ...suite, cases: suite.cases.slice(1) })).toThrow();
  expect(() => checkDepth60Suite({ ...suite, cases: suite.cases.map(row => ({ ...row, depth: 59 })) })).toThrow();
});

test("pilot bounds concurrency, retains cancellation boundary, and surfaces work failures", async () => {
  const controller = new AbortController();
  let active = 0, peak = 0, completed = 0;
  await runDepth60Pool([0, 1, 2, 3, 4, 5], 2, controller.signal, async () => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    completed++; active--;
    if (completed === 2) controller.abort();
  });
  expect(peak).toBe(2);
  expect(completed).toBe(3);
  await expect(runDepth60Pool([0], 13, new AbortController().signal, async () => {})).rejects.toThrow();
  await expect(runDepth60Pool([0], 1, new AbortController().signal, async () => { throw new Error("Persistence failed"); })).rejects.toThrow();
  const started: number[] = [];
  await expect(runDepth60Pool([0, 1, 2, 3], 2, new AbortController().signal, async row => {
    started.push(row);
    if (row === 0) throw new Error("Inference failed");
    await new Promise(resolve => setTimeout(resolve, 1));
  })).rejects.toThrow();
  expect(started.every(row => row < 2)).toBe(true);
});

test("preserves the complete original manifest and freezes only the four fixed additional model IDs", () => {
  expect(DEPTH60_MODELS).toEqual(["gpt-4.1-mini", "gpt-4o-mini"]);
  expect(qualityDataHash(createDepth60Manifest(suite, bindings, "pilot", pilot.frozenAt))).toBe(qualityDataHash(pilot));
  expect(() => assertDepth60Manifest(pilot, suite, bindings)).not.toThrow();
  const manifest = createDepth60Manifest(suite, additionalBindings, "additional");
  expect(manifest.models).toEqual(["gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.6-luna", "gpt-6-luna"]);
  expect(manifest).toMatchObject({ methodId: "depth60-additional-v1", priorInferenceRequests: 7962, maxInferenceRequests: 108, cumulativeInferenceCeiling: 8070, sharedCeiling: 8192, initialConcurrency: 4, maxConcurrency: 12, maxOutputTokens: 4096, inferenceDeadlineMs: 180000, retries: 0 });
  expect(() => assertDepth60Manifest(manifest, suite, additionalBindings, "additional")).not.toThrow();
  for (const change of [{ maxInferenceRequests: 107 }, { cumulativeInferenceCeiling: 8016 }, { initialConcurrency: 2 }, { inferenceDeadlineMs: 600000 }, { profileId: "one-shot-json-v2-high" }]) expect(() => assertDepth60Manifest({ ...manifest, ...change } as unknown as ReturnType<typeof createDepth60Manifest>, suite, additionalBindings, "additional")).toThrow("configuration");
  expect(() => createDepth60Manifest(suite, { ...additionalBindings, promptsSha256: "0".repeat(64) }, "additional")).toThrow("exact prompt");
});

test("requires the original 54 outcomes and the coordinated terminal depth100 sends before admitting new work", () => {
  expect(() => checkDepth60PriorPilot(suite, pilot, retained, progress, audit, retainedText)).not.toThrow();
  expect(() => checkDepth60PriorPilot(suite, pilot, { ...retained, rows: retained.rows.slice(1) }, progress, audit, retainedText)).toThrow("54 unique");
  expect(() => checkDepth60PriorPilot(suite, pilot, retained, progress, { ...audit, sourceFileSha256: "0".repeat(64) }, retainedText)).toThrow("source hashes");
  expect(() => checkDepth60PriorPilot(suite, pilot, retained, { ...progress, rows: [progress.rows[0], ...progress.rows.slice(0, -1)] }, audit, retainedText)).toThrow("54 unique");
  expect(() => checkDepth100Gate(depth100Population, depth100Manifest, depth100Retained, depth100Progress, depth100Bindings)).not.toThrow();
  expect(() => checkDepth100Gate(depth100Population, depth100Manifest, depth100Retained, { ...depth100Progress, rows: depth100Progress.rows.slice(1) }, depth100Bindings)).toThrow("54 unique complete");
  expect(() => checkDepth100Gate(depth100Population, { ...depth100Manifest, cumulativeInferenceCeiling: 7961 }, depth100Retained, depth100Progress, depth100Bindings)).toThrow("7962");
  expect(() => checkDepth100Gate(depth100Population, depth100Manifest, depth100Retained, { ...depth100Progress, rows: [{ ...depth100Progress.rows[0], failure: { code: "timeout" } }, ...depth100Progress.rows.slice(1)] }, depth100Bindings)).toThrow("terminal source hashes");
});

test("binds all 108 new dispatches to unique model/case/trial identities and exact original prompts", () => {
  const rows = depth60Rows(suite, "additional");
  expect(rows).toHaveLength(108); expect(new Set(rows.map(row => `${row.modelId}:${row.caseId}:${row.trialIndex}`)).size).toBe(108);
  expect(rows.slice(0, 4).map(row => row.modelId)).toEqual([...DEPTH60_ADDITIONAL_MODELS]);
  for (const model of DEPTH60_ADDITIONAL_MODELS) expect(rows.filter(row => row.modelId === model)).toHaveLength(27);
  for (const row of rows) {
    const prompt = buildPrompt(suite.cases.find(entry => entry.id === row.caseId)!.reference, "one-shot-json-v1"), body = { model: row.modelId, input: prompt.messages, max_output_tokens: 4096, store: false, truncation: "disabled" }, text = JSON.stringify(body);
    expect(depth60Dispatch(row, suite, text, "additional")).toEqual({ modelId: row.modelId, caseId: row.caseId, trialIndex: row.trialIndex, requestBodySha256: sha(text) });
  }
  const row = rows[0], body = { model: row.modelId, input: buildPrompt(suite.cases[0].reference, "one-shot-json-v1").messages, max_output_tokens: 4096, store: false, truncation: "disabled" };
  expect(() => depth60Dispatch(row, suite, JSON.stringify({ ...body, model: rows[1].modelId }), "additional")).toThrow("model/case/trial");
  expect(() => depth60Dispatch(row, suite, JSON.stringify({ ...body, input: [] }), "additional")).toThrow("exact prompt");
  expect(() => depth60Dispatch({ ...row, trialIndex: 3 }, suite, JSON.stringify(body), "additional")).toThrow();
});

test("raises concurrency only after one sufficient initial response per model", () => {
  const headers = DEPTH60_ADDITIONAL_MODELS.map(modelId => ({ modelId, values: { "x-ratelimit-remaining-requests": "108", "x-ratelimit-remaining-tokens": "100000" } }));
  expect(depth60Concurrency("additional", headers)).toBe(12); expect(depth60Concurrency("additional", headers.slice(1))).toBe(4);
  expect(depth60Concurrency("additional", [{ ...headers[0], values: { ...headers[0].values, "x-ratelimit-remaining-requests": "107" } }, ...headers.slice(1)])).toBe(4);
  expect(depth60Concurrency("additional", [headers[0], headers[0], ...headers.slice(2)])).toBe(4);
  expect(depth60Concurrency("pilot", DEPTH60_MODELS.map(modelId => ({ modelId, values: { "x-ratelimit-remaining-requests": "54", "x-ratelimit-remaining-tokens": "100000" } })))).toBe(12);
});

test("retains incomplete summaries before unsuccessful exit and refuses unsafe or repeated exports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "depth60-additional-")), file = pathToFileURL(join(directory, "progress.json")), credential = "synthetic-depth60-credential-123456789";
  const summary = { state: "interrupted", inferenceRequests: 4, plannedTrials: 108, unattemptedTrials: 104, unknownRemoteInferenceRequests: 4 };
  try {
    await expect(exportDepth60Summary(file, summary, credential, true)).rejects.toThrow("were exported");
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(summary);
    await expect(exportDepth60Summary(file, { state: "settled" }, credential, false)).rejects.toThrow();
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(summary);
    const unsafe = pathToFileURL(join(directory, "unsafe.json")); await expect(exportDepth60Summary(unsafe, { secret: credential }, credential, true)).rejects.toThrow("Unsafe"); expect(await Bun.file(unsafe).exists()).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("stops before persistence for excluded provider states even with no failure and counts their sends as unknown", async () => {
  for (const status of ["queued", "in_progress", "incomplete", "cancelled"]) {
    const controller = new AbortController(), rows = depth60Rows(suite); let posts = 0, persisted = 0;
    await runDepth60Pool(rows, 1, controller.signal, async row => {
      const infer = createInferenceClient(async (url, init) => {
        if (init.method === "GET") return Response.json({ id: new URL(url).pathname.split("/").at(-1), object: "model" });
        posts++; row.dispatched = true;
        return Response.json({ model: row.modelId, status, output: [], max_output_tokens: 4096, truncation: "disabled" });
      });
      row.result = await infer({ selection: { provider: "openai", modelId: row.modelId, servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, prompt: buildPrompt(suite.cases.find(entry => entry.id === row.caseId)!.reference, "one-shot-json-v1"), acceptCharges: true }, "synthetic-depth60-stop-fixture-123456789", controller.signal);
      expect(row.result.failure).toBe(null); expect(row.result.inferenceRequests).toBe(1);
      if (!isDepth60ModelOutcome(row.result)) controller.abort();
      expect(controller.signal.aborted).toBe(true); await Promise.resolve(); persisted++;
    });
    expect(posts).toBe(1); expect(persisted).toBe(1); expect(rows.filter(row => row.result === null)).toHaveLength(53);
    expect(countDepth60UnknownSends(rows)).toBe(1);
    const result = rows[0].result!;
    const knownNotSent: InferenceResult = { ...result, inferenceRequests: 0, failure: { code: "permission-denied", remoteOutcome: "not-sent", message: "Controlled fixture." } };
    expect(isDepth60ModelOutcome(knownNotSent)).toBe(false); expect(countDepth60UnknownSends([{ ...rows[0], result: knownNotSent }])).toBe(0);
    for (const kind of ["answer", "invalid", "refused", "truncated"] as const) expect(isDepth60ModelOutcome({ ...result, evidence: { ...result.evidence, outcome: { ...result.evidence.outcome, kind } } } as InferenceResult)).toBe(true);
  }
});
