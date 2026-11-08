// Store behavior is checked through real SQLite, complete synthetic evidence and private filesystem boundaries.
import { Database } from "bun:sqlite";
import { beforeAll, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InferenceResult } from "../inference";
import { buildNumericalPrompts } from "../numerics/prompt";
import { calculateWorkload, extractAnswer } from "../protocol";
import { scoreEvaluation } from "../scoring";
import { loadRunSuite } from "./registry";
import { createRunStore, RUN_STORE_LIMITS, RunStoreError } from "./store";
import type { RunRecord, RunStore } from "./types";

const time = Date.parse("2026-11-08T00:00:00.000Z");
let initial: RunRecord, completed: RunRecord;
beforeAll(async () => {
  const suite = await loadRunSuite("screening-v1", "one-shot-json-v1");
  const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), suite.request.profileId);
  const workload = calculateWorkload(suite.request.profileId, suite.cases.length);
  initial = {
    version: "1", id: "run-store-fixture", revision: 0, createdAt: new Date(time).toISOString(), updatedAt: new Date(time).toISOString(), expiresAt: new Date(time + RUN_STORE_LIMITS.retentionMs).toISOString(),
    state: "running", request: { suiteKey: "screening-v1", provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", concurrency: 2, acceptCharges: true }, suite, prompts, workload,
    progress: { plannedTrials: workload.logicalCalls, startedTrials: 0, activeTrials: 0, finishedTrials: 0, modelOutcomes: 0, infrastructureFailures: 0, remainingTrials: workload.logicalCalls, inferenceRequests: 0 }, results: [],
    evidence: { runId: "run-store-fixture", suiteId: suite.id, protocolVersion: "1", profileId: suite.request.profileId,
      model: { provider: "openai", modelId: "fixture-model", endpointId: "fixture-endpoint", settingsId: "fixture-settings" }, run: { elapsedMs: null, concurrency: 2 }, expressionTokens: [],
      trials: suite.cases.flatMap((entry) => [0, 1, 2].map((trialIndex) => ({ caseId: entry.id, trialIndex, finalAttempt: null, elapsedMs: null, attempts: [] }))) }, report: null, failure: null,
  };
  const results = suite.cases.flatMap((entry, caseIndex) => [0, 1, 2].map((trialIndex) => {
    const evidence = { sequence: 1, outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: entry.label, explanation: "Synthetic store fixture." }) }, suite.request.profileId),
      errorKind: null, elapsedMs: 10, usage: { input: null, output: null, reasoning: null }, cost: null };
    const result: InferenceResult = {
      version: "1", policyId: "individual-inference-v1", attemptId: `fixture-${caseIndex}-${trialIndex}`, startedAt: new Date(time).toISOString(), finishedAt: new Date(time + 10).toISOString(), requested: { provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: suite.request.profileId },
      selection: null, metadata: null, prompt: prompts[caseIndex], reportedModelId: null, reportedServingProvider: null,
      effective: { maxOutputTokens: null, reasoningEffort: null, truncation: null, nativeSchemaAccepted: null }, finishReason: "stop", contextFit: "unverified", evidence, failure: null, httpAttempts: 1, inferenceRequests: 1,
      budget: { maxInferenceRequests: 1, maxOutputTokens: 4096, metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, retries: 0 },
    };
    return { caseId: entry.id, trialIndex, result };
  }));
  const evidence = { ...initial.evidence, run: { elapsedMs: 100, concurrency: 2 }, trials: results.map((entry) => ({ caseId: entry.caseId, trialIndex: entry.trialIndex, finalAttempt: 1, elapsedMs: 10, attempts: [entry.result.evidence] })) };
  completed = { ...initial, state: "completed", results, evidence, progress: { ...initial.progress, startedTrials: workload.logicalCalls, finishedTrials: workload.logicalCalls, modelOutcomes: workload.logicalCalls, remainingTrials: 0, inferenceRequests: workload.logicalCalls }, report: await scoreEvaluation({ suite, evidence }) };
});

function memory(now: () => number = () => time): RunStore { return createRunStore({ path: ":memory:", now }); }
function expectCode(work: () => unknown, code: RunStoreError["code"]) {
  try { work(); throw new Error("Expected safe store failure."); }
  catch (error) { expect(error).toBeInstanceOf(RunStoreError); expect((error as RunStoreError).code).toBe(code); }
}

it("returns the private code once, isolates access and owns seven-day timestamps", () => {
  const store = memory();
  try {
    const created = store.create({ ...initial, createdAt: "2000-01-01T00:00:00.000Z", expiresAt: "2000-01-02T00:00:00.000Z" });
    expect(created.accessCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.view.record.createdAt).toBe(new Date(time).toISOString());
    expect(Date.parse(created.view.record.expiresAt) - time).toBe(RUN_STORE_LIMITS.retentionMs);
    expect(store.read(initial.id, created.accessCode)).toEqual(created.view);
    for (const code of ["", "wrong", "x".repeat(43), created.accessCode.slice(1)]) {
      expect(store.read(initial.id, code)).toBeNull(); expect(store.publish(initial.id, code, true)).toBeNull(); expect(store.remove(initial.id, code)).toBe(false);
    }
    expect(store.read("missing", created.accessCode)).toBeNull();
    expect(store.readPublic(initial.id)).toBeNull();
    expect(Object.isFrozen(created.view.record.suite)).toBe(true);
    expect(JSON.stringify(created.view)).not.toContain(created.accessCode);
    expectCode(() => store.create(initial), "conflict");
  } finally { store.close(); }
  expectCode(() => store.read(initial.id, "x".repeat(43)), "closed");
  store.close();
});

it("rejects a workload key that mislabels the retained generator or population", () => {
  const store = memory();
  try {
    for (const suiteKey of ["reference-v1", "smooth-v2", "challenge-v1", "interior-v1", "reserve-v1", "composition-v1"] as const) {
      expectCode(() => store.create({ ...initial, request: { ...initial.request, suiteKey } }), "invalid-record");
    }
  } finally { store.close(); }
});

it("performs revision CAS and preserves the request, suite and expiry", () => {
  const store = memory();
  try {
    const created = store.create(initial), first = store.save({ ...created.view.record, state: "cancelling" });
    expect(first.record.revision).toBe(1);
    expectCode(() => store.save(created.view.record), "conflict");
    expectCode(() => store.save({ ...first.record, request: { ...first.record.request, concurrency: 3 } }), "invalid-record");
    const altered = structuredClone(first.record);
    Object.assign(altered.suite.cases[0].certificate, { nodeCount: 999 });
    expectCode(() => store.save(altered), "invalid-record");
    expectCode(() => store.save({ ...first.record, expiresAt: new Date(time + 1).toISOString() }), "invalid-record");
    expect(store.read(initial.id, created.accessCode)?.record.revision).toBe(1);
  } finally { store.close(); }
});

it("publishes only complete results, allows explicit revocation and removes all visibility on deletion", () => {
  const store = memory();
  try {
    const running = store.create(initial);
    expectCode(() => store.publish(initial.id, running.accessCode, true), "ineligible");
    const provisional = structuredClone(completed);
    Object.assign(provisional.report!.overall.classification.population, { status: "provisional" });
    expectCode(() => store.save({ ...provisional, revision: running.view.record.revision }), "invalid-record");
    expectCode(() => store.publish(initial.id, running.accessCode, true), "ineligible");
    const saved = store.save({ ...completed, revision: running.view.record.revision });
    const published = store.publish(initial.id, running.accessCode, true)!;
    expect(published.record.revision).toBe(saved.record.revision);
    expect(published.publishedAt).toBe(new Date(time).toISOString());
    expect(store.readPublic(initial.id)).toEqual(published);
    expect(store.listPublic()).toEqual([published]);
    expect(store.publish(initial.id, running.accessCode, false)?.publishedAt).toBeNull();
    expect(store.readPublic(initial.id)).toBeNull(); expect(store.listPublic()).toHaveLength(0);
    store.publish(initial.id, running.accessCode, true);
    expect(store.remove(initial.id, running.accessCode)).toBe(true);
    expect(store.readPublic(initial.id)).toBeNull(); expect(store.read(initial.id, running.accessCode)).toBeNull(); expect(store.listPublic()).toHaveLength(0);
  } finally { store.close(); }
});

it("rejects altered scores, report identities and stale evidence even when the report content hash is refreshed", () => {
  const store = memory();
  try {
    const created = store.create(initial);
    for (const change of [
      (record: RunRecord) => Object.assign(record.report!.overall.classification, { macroF1: 0.5 }),
      (record: RunRecord) => Object.assign(record.report!.identity.model, { settingsId: "other-settings" }),
      (record: RunRecord) => Object.assign(record.report!.identity, { evidenceSha256: "0".repeat(64) }),
      (record: RunRecord) => Object.assign(record.report!.overall.classification.population, { includedTrials: 0 }),
    ]) {
      const altered = structuredClone({ ...completed, revision: created.view.record.revision });
      change(altered);
      const { id, ...content } = altered.report!;
      expect(id).toStartWith("report-v1-");
      Object.assign(altered.report!, { id: `report-v1-${createHash("sha256").update(JSON.stringify(content)).digest("hex")}` });
      expectCode(() => store.save(altered), "invalid-record");
    }
    expect(store.read(initial.id, created.accessCode)?.record.state).toBe("running");
    expect(store.listPublic()).toHaveLength(0);
  } finally { store.close(); }
});

it("binds saved prompts and result identities to the admitted suite and requested model", () => {
  const store = memory();
  try {
    const created = store.create(initial);
    const differentPrompt = structuredClone(created.view.record);
    Object.assign(differentPrompt.prompts[0].messages[1], { content: differentPrompt.prompts[1].messages[1].content });
    expectCode(() => store.save(differentPrompt), "invalid-record");
    for (const change of [
      (record: RunRecord) => Object.assign(record.results[0].result, { prompt: record.prompts[1] }),
      (record: RunRecord) => Object.assign(record.results[0].result.requested, { modelId: "other-model" }),
    ]) {
      const altered = structuredClone({ ...completed, revision: created.view.record.revision });
      change(altered);
      expectCode(() => store.save(altered), "invalid-record");
    }
  } finally { store.close(); }
});

it("expires private and public evidence at the exact retention boundary", () => {
  let clock = time;
  const store = memory(() => clock);
  try {
    const created = store.create(completed); store.publish(completed.id, created.accessCode, true);
    clock += RUN_STORE_LIMITS.retentionMs - 1;
    expect(store.readPublic(completed.id)).not.toBeNull();
    clock++;
    expect(store.read(completed.id, created.accessCode)).toBeNull(); expect(store.readPublic(completed.id)).toBeNull(); expect(store.listPublic()).toHaveLength(0);
    expectCode(() => store.save(created.view.record), "conflict");
    expect(store.remove(completed.id, created.accessCode)).toBe(false);
  } finally { store.close(); }
});

it("recovers running work as interrupted without rerunning or dropping completed outcomes", () => {
  const store = memory();
  try {
    const first = completed.results[0], trial = completed.evidence.trials.find((item) => item.caseId === first.caseId && item.trialIndex === first.trialIndex)!;
    const partial: RunRecord = { ...initial, state: "cancelling", results: [first], evidence: { ...initial.evidence, trials: initial.evidence.trials.map((item) => item.caseId === trial.caseId && item.trialIndex === trial.trialIndex ? trial : item) },
      progress: { ...initial.progress, startedTrials: 3, activeTrials: 2, finishedTrials: 1, modelOutcomes: 1, remainingTrials: initial.workload.logicalCalls - 1, inferenceRequests: 3 } };
    const created = store.create(partial);
    expect(store.recoverInterrupted()).toBe(1);
    const recovered = store.read(initial.id, created.accessCode)!.record;
    expect(recovered.state).toBe("interrupted"); expect(recovered.progress.activeTrials).toBe(0);
    expect(recovered.progress.remainingTrials).toBe(initial.workload.logicalCalls - 1);
    expect(recovered.results).toEqual([first]); expect(recovered.evidence).toEqual(partial.evidence);
    expect(recovered.failure?.code).toBe("server-interrupted"); expect(recovered.revision).toBe(1);
    expect(store.recoverInterrupted()).toBe(0);
    expectCode(() => store.save({ ...recovered, state: "running" }), "invalid-record");
  } finally { store.close(); }
});

it("rejects getters, leaked credential fields, malformed evidence and oversized data before persistence", () => {
  const store = memory();
  try {
    let reads = 0;
    const getter = Object.defineProperty({ ...initial }, "state", { enumerable: true, get() { reads++; return "running"; } });
    expectCode(() => store.create(getter), "invalid-record"); expect(reads).toBe(0);
    const credential = structuredClone(initial);
    Object.assign(credential.prompts[0].generation, { api_key: "fixture-never-persist" });
    expectCode(() => store.create(credential), "invalid-record");
    expectCode(() => store.create({ ...initial, progress: { ...initial.progress, remainingTrials: 0 } }), "invalid-record");
    const missing = { ...initial, evidence: { ...initial.evidence, trials: initial.evidence.trials.slice(1) } };
    expectCode(() => store.create(missing), "invalid-record");
    const oversized = structuredClone(initial);
    Object.assign(oversized.prompts[0].messages[0], { content: Array(4200).fill("x".repeat(65536)) });
    expectCode(() => store.create(oversized), "storage-limit");
    expect(store.listPublic()).toHaveLength(0);
  } finally { store.close(); }
}, 30000);

it("uses private files, stores hashes only and detects corrupt or oversized rows without exposing contents", () => {
  const directory = mkdtempSync(join(tmpdir(), "coconut-store-")), path = join(directory, "private", "runs.sqlite");
  const store = createRunStore({ path, now: () => time });
  const inspect = new Database(path);
  try {
    const created = store.create(initial);
    expect(statSync(join(directory, "private")).mode & 0o777).toBe(0o700); expect(statSync(path).mode & 0o777).toBe(0o600);
    const row = inspect.query<{ access_hash: string; payload: string }, []>("SELECT access_hash,payload FROM runs").get()!;
    expect(row.access_hash).toBe(createHash("sha256").update(created.accessCode).digest("hex"));
    expect(row.payload).not.toContain(created.accessCode); expect(readFileSync(path).includes(Buffer.from(created.accessCode))).toBe(false);
    inspect.query("UPDATE runs SET payload=?,bytes=? WHERE id=?").run("private-corrupt-diagnostic", 26, initial.id);
    expect(store.read(initial.id, "x".repeat(43))).toBeNull();
    expectCode(() => store.read(initial.id, created.accessCode), "corrupt-record");
    expectCode(() => store.save(created.view.record), "corrupt-record");
    inspect.query("UPDATE runs SET bytes=? WHERE id=?").run(RUN_STORE_LIMITS.maxRecordBytes + 1, initial.id);
    expectCode(() => store.read(initial.id, created.accessCode), "storage-limit");
    expect(store.remove(initial.id, created.accessCode)).toBe(true);
  } finally { inspect.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});

it("enforces record capacity and revision conflicts across real database connections", () => {
  const directory = mkdtempSync(join(tmpdir(), "coconut-store-capacity-")), path = join(directory, "runs.sqlite");
  const first = createRunStore({ path, now: () => time }), second = createRunStore({ path, now: () => time }), inspect = new Database(path);
  try {
    const created = first.create(initial);
    first.save({ ...created.view.record, state: "cancelling" });
    expectCode(() => second.save(created.view.record), "conflict");
    expect(second.read(initial.id, created.accessCode)?.record.revision).toBe(1);
    inspect.transaction(() => {
      for (let i = 1; i < RUN_STORE_LIMITS.maxRecords; i++) inspect.query("INSERT INTO runs SELECT ?,revision,created_ms,expires_ms,state,access_hash,published_at,bytes,sha256,request_hash,suite_hash,payload FROM runs WHERE id=?").run(`capacity-${i}`, initial.id);
    })();
    const newRecord = { ...initial, id: "capacity-new", evidence: { ...initial.evidence, runId: "capacity-new" } };
    expectCode(() => first.create(newRecord), "storage-limit");
  } finally { inspect.close(); second.close(); first.close(); rmSync(directory, { recursive: true, force: true }); }
});

it("rejects shared directories and symlink targets with safe fixed errors", () => {
  const directory = mkdtempSync(join(tmpdir(), "coconut-store-path-"));
  try {
    chmodSync(directory, 0o755);
    expectCode(() => createRunStore({ path: join(directory, "runs.sqlite") }), "storage-error");
    expect(statSync(directory).mode & 0o777).toBe(0o755);
    chmodSync(directory, 0o700);
    const target = join(directory, "target"), link = join(directory, "runs.sqlite");
    writeFileSync(target, "preserve-this-file"); symlinkSync(target, link);
    expectCode(() => createRunStore({ path: link }), "storage-error");
    expect(readFileSync(target, "utf8")).toBe("preserve-this-file");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
