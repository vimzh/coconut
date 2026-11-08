// Private SQLite retention uses hashed access codes, immutable run identities and revision-checked writes.
import { Database } from "bun:sqlite";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parseInferenceRequest } from "../inference/policy";
import { promptFromNumericalCertificate } from "../numerics/prompt";
import { buildPrompt, calculateWorkload, getProfile } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { apiDataFile } from "../runtime-paths";
import { bindEvidence, parseEvidence } from "../scoring/evidence";
import { scoreRetainedEvidence } from "../scoring/scorer";
import { freezeData } from "../suites/generator";
import { runPopulation } from "./policy";
import type { RunRecord, RunStore, RunView } from "./types";

export const RUN_STORE_LIMITS = Object.freeze({ maxRecords: 500, maxRecordBytes: 256 * 1024 * 1024, maxPublicListBytes: 256 * 1024 * 1024, retentionMs: 7 * 24 * 60 * 60 * 1000 });
type ErrorCode = "invalid-record" | "corrupt-record" | "conflict" | "storage-limit" | "storage-error" | "ineligible" | "closed";
const messages: Record<ErrorCode, string> = {
  "invalid-record": "Run evidence does not match the supported retained-record contract.",
  "corrupt-record": "Stored run evidence failed its integrity check.",
  conflict: "Run evidence changed or is no longer available. Read the latest record before saving.",
  "storage-limit": "Run storage exceeds its retained-record or response budget.",
  "storage-error": "Run storage could not be opened or updated. Check its private directory and local database.",
  ineligible: "Only a completed run with a complete report may be published.",
  closed: "Run storage is closed.",
};
export class RunStoreError extends Error {
  constructor(readonly code: ErrorCode) { super(messages[code]); this.name = "RunStoreError"; }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const states = ["running", "cancelling", "completed", "cancelled", "timed-out", "failed", "interrupted"];
const fields = ["version", "id", "revision", "createdAt", "updatedAt", "expiresAt", "state", "request", "suite", "prompts", "workload", "progress", "results", "evidence", "report", "failure"];
const idValid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

// Descriptor traversal rejects accessors/credentials before JSON serialization can execute caller code.
function snapshot(input: unknown): unknown {
  let bytes = 0, nodes = 0;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > 2_000_000 || depth > 128) throw new RunStoreError("storage-limit");
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      if (typeof value === "number" && !Number.isFinite(value)) throw new RunStoreError("invalid-record");
      if (typeof value === "string" && value.length > RUN_STORE_LIMITS.maxRecordBytes) throw new RunStoreError("storage-limit");
      bytes += Buffer.byteLength(JSON.stringify(value));
      if (bytes > RUN_STORE_LIMITS.maxRecordBytes) throw new RunStoreError("storage-limit");
      return value;
    }
    if (!value || typeof value !== "object" || ancestors.has(value)) throw new RunStoreError("invalid-record");
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    if (array ? prototype !== Array.prototype || keys.length !== value.length + 1 : prototype !== Object.prototype && prototype !== null) throw new RunStoreError("invalid-record");
    const result: unknown[] | Record<string, unknown> = array ? [] : {};
    ancestors.add(value); bytes += 2;
    for (const key of keys) {
      if (array && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || key === "__proto__" || !descriptor || !("value" in descriptor) || !descriptor.enumerable ||
        /^(apikey|authorization|credential|credentials|accesscode|accesshash|privateaccesscode|providertoken|tojson)$/i.test(key.replace(/[-_]/g, "")) ||
        (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new RunStoreError("invalid-record");
      bytes += (array ? 1 : Buffer.byteLength(JSON.stringify(key)) + 2);
      if (bytes > RUN_STORE_LIMITS.maxRecordBytes) throw new RunStoreError("storage-limit");
      (result as Record<string, unknown>)[key] = copy(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}

function validate(input: unknown): RunRecord {
  try {
    const data = readDataRecord(input, "Run record"); requireFields(data, fields);
    if (data.version !== "1" || !idValid(data.id) || !integer(data.revision) ||
      !states.includes(data.state as string) || ![data.createdAt, data.updatedAt, data.expiresAt].every(timestamp)) throw new RunStoreError("invalid-record");
    const request = readDataRecord(data.request, "Run request");
    requireFields(request, ["suiteKey", "provider", "modelId", "servingProvider", "profileId", "concurrency", "acceptCharges"]);
    if (!["reference-v1", "smooth-v2", "challenge-v1", "screening-v1", "interior-v1"].includes(request.suiteKey as string) ||
      !["openai", "openrouter", "hugging-face"].includes(request.provider as string) || typeof request.modelId !== "string" || !request.modelId.trim() || request.modelId.length > 256 ||
      (request.servingProvider !== null && (typeof request.servingProvider !== "string" || !request.servingProvider.trim() || request.servingProvider.length > 256)) ||
      !integer(request.concurrency) || request.concurrency < 1 || request.concurrency > 12 || request.acceptCharges !== true) throw new RunStoreError("invalid-record");
    const profile = getProfile(request.profileId), record = data as unknown as RunRecord;
    const suite = readDataRecord(data.suite, "Run suite"), suiteRequest = readDataRecord(suite.request, "Suite request");
    if (!Array.isArray(suite.cases) || suite.cases.length < 1 || suite.cases.length > 75 || suiteRequest.profileId !== profile.id || suiteRequest.purpose !== "evaluation") throw new RunStoreError("invalid-record");
    if (!isDeepStrictEqual(data.workload, calculateWorkload(profile.id, suite.cases.length)) || !Array.isArray(data.prompts) || data.prompts.length !== suite.cases.length) throw new RunStoreError("invalid-record");
    for (const prompt of data.prompts) parseInferenceRequest({ selection: { provider: request.provider, modelId: request.modelId, servingProvider: request.servingProvider, profileId: profile.id, verification: "metadata" }, prompt, acceptCharges: true });
    const retainedSuite = record.suite;
    runPopulation(record.request.suiteKey, retainedSuite);
    const canonicalPrompts = retainedSuite.formatVersion === "2"
      ? retainedSuite.cases.map(entry => promptFromNumericalCertificate(entry.certificate, profile.id, retainedSuite.promptVersion))
      : retainedSuite.cases.map(entry => buildPrompt(entry.reference, profile.id));
    if (!isDeepStrictEqual(record.prompts, canonicalPrompts)) throw new RunStoreError("invalid-record");
    const evidence = bindEvidence(parseEvidence(data.evidence), record.suite);
    if (evidence.runId !== data.id || evidence.model.provider !== request.provider || evidence.model.modelId !== request.modelId) throw new RunStoreError("invalid-record");
    const progress = readDataRecord(data.progress, "Run progress");
    requireFields(progress, ["plannedTrials", "startedTrials", "activeTrials", "finishedTrials", "modelOutcomes", "infrastructureFailures", "remainingTrials", "inferenceRequests"]);
    if (!Object.values(progress).every(integer) || progress.plannedTrials !== record.workload.logicalCalls ||
      (progress.startedTrials as number) > record.workload.logicalCalls || (progress.finishedTrials as number) > (progress.startedTrials as number) ||
      (progress.activeTrials as number) > (progress.startedTrials as number) - (progress.finishedTrials as number) ||
      (progress.modelOutcomes as number) + (progress.infrastructureFailures as number) > (progress.finishedTrials as number) ||
      progress.remainingTrials !== record.workload.logicalCalls - (progress.finishedTrials as number) || (progress.inferenceRequests as number) > (progress.startedTrials as number)) throw new RunStoreError("invalid-record");
    if (!Array.isArray(data.results) || data.results.length !== progress.finishedTrials || data.results.length > record.workload.logicalCalls) throw new RunStoreError("invalid-record");
    const trials = new Map(evidence.trials.map((trial) => [`${trial.caseId}:${trial.trialIndex}`, trial])), seen = new Set<string>();
    for (const entry of record.results) {
      const key = `${entry.caseId}:${entry.trialIndex}`, trial = trials.get(key);
      if (seen.has(key) || !trial || trial.attempts.length !== 1 || entry.result?.version !== "1" || entry.result.requested?.profileId !== profile.id ||
        entry.result.requested.provider !== request.provider || entry.result.requested.modelId !== request.modelId || entry.result.requested.servingProvider !== request.servingProvider ||
        !isDeepStrictEqual(entry.result.evidence, trial.attempts[0]) || !isDeepStrictEqual(entry.result.prompt, record.prompts[Math.floor(evidence.trials.indexOf(trial) / record.workload.trialsPerInstance)])) throw new RunStoreError("invalid-record");
      seen.add(key);
    }
    if (evidence.trials.filter((trial) => trial.attempts.length > 0).length !== data.results.length) throw new RunStoreError("invalid-record");
    if (record.report !== null && (record.report.identity?.runId !== record.id || record.report.identity.suiteId !== record.suite.id || record.report.identity.profileId !== profile.id ||
      record.report.overall?.classification?.population?.plannedTrials !== record.workload.logicalCalls)) throw new RunStoreError("invalid-record");
    if (record.report !== null && !isDeepStrictEqual(record.report, scoreRetainedEvidence(record.suite, evidence, record.prompts))) throw new RunStoreError("invalid-record");
    if (record.failure !== null && (typeof record.failure.code !== "string" || !record.failure.code || record.failure.code.length > 128 || typeof record.failure.message !== "string" || !record.failure.message || record.failure.message.length > 1024)) throw new RunStoreError("invalid-record");
    return record;
  } catch (error) { if (error instanceof RunStoreError) throw error; throw new RunStoreError("invalid-record"); }
}

interface Row {
  id: string; revision: number; created_ms: number; expires_ms: number; state: string; access_hash: string;
  published_at: string | null; bytes: number; actual_bytes: number; sha256: string; request_hash: string; suite_hash: string;
}
const columns = "id,revision,created_ms,expires_ms,state,access_hash,published_at,bytes,length(CAST(payload AS BLOB)) AS actual_bytes,sha256,request_hash,suite_hash";
const eligible = (record: RunRecord) => record.state === "completed" && record.progress.activeTrials === 0 && record.progress.finishedTrials === record.progress.plannedTrials && record.report?.overall.classification.population.status === "complete";

function privatePath(path: string): string {
  if (path === ":memory:") return path;
  const target = resolve(path), directory = dirname(target);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const parent = lstatSync(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o777) !== 0o700) throw new RunStoreError("storage-error");
  const descriptor = openSync(target, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try { if (!fstatSync(descriptor).isFile()) throw new RunStoreError("storage-error"); fchmodSync(descriptor, 0o600); }
  finally { closeSync(descriptor); }
  return target;
}

export function createRunStore(options: { path?: string; now?: () => number } = {}): RunStore {
  const now = options.now ?? Date.now;
  let opened: Database | undefined;
  try {
    opened = new Database(privatePath(options.path ?? fileURLToPath(apiDataFile("private/runs.sqlite"))), { create: true, strict: true });
    opened.run("PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000;");
    opened.run("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, created_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL, state TEXT NOT NULL, access_hash TEXT NOT NULL, published_at TEXT, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, request_hash TEXT NOT NULL, suite_hash TEXT NOT NULL, payload TEXT NOT NULL)");
    opened.run("CREATE INDEX IF NOT EXISTS runs_expiry ON runs(expires_ms)");
  } catch { try { opened?.close(); } catch { /* Preserve the safe initialization failure. */ } throw new RunStoreError("storage-error"); }
  const db = opened;
  let closed = false;
  const clock = () => { const value = now(); if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000 - RUN_STORE_LIMITS.retentionMs) throw new RunStoreError("storage-error"); return value; };
  const operation = <T>(work: (time: number) => T): T => {
    if (closed) throw new RunStoreError("closed");
    try { const time = clock(); db.query("DELETE FROM runs WHERE expires_ms<=?").run(time); return db.transaction(() => work(time)).immediate(); }
    catch (error) { if (error instanceof RunStoreError) throw error; throw new RunStoreError("storage-error"); }
  };
  const row = (id: string) => db.query<Row, [string]>(`SELECT ${columns} FROM runs WHERE id=?`).get(id);
  const authorize = (data: Row | null, accessCode: string): boolean => {
    const valid = typeof accessCode === "string" && /^[A-Za-z0-9_-]{43}$/.test(accessCode);
    const expected = data && /^[a-f0-9]{64}$/.test(data.access_hash) ? Buffer.from(data.access_hash, "hex") : Buffer.alloc(32);
    return timingSafeEqual(Buffer.from(hash(valid ? accessCode : "invalid-access-code"), "hex"), expected) && valid && data !== null;
  };
  const decode = (data: Row): RunView => {
    if (data.bytes > RUN_STORE_LIMITS.maxRecordBytes || data.actual_bytes > RUN_STORE_LIMITS.maxRecordBytes) throw new RunStoreError("storage-limit");
    if (!integer(data.bytes) || data.actual_bytes !== data.bytes) throw new RunStoreError("corrupt-record");
    try {
      const value = db.query<{ payload: string }, [string]>("SELECT payload FROM runs WHERE id=?").get(data.id);
      if (!value || hash(value.payload) !== data.sha256) throw new RunStoreError("corrupt-record");
      const record = validate(snapshot(JSON.parse(value.payload)));
      if (record.id !== data.id || record.revision !== data.revision || record.state !== data.state || Date.parse(record.createdAt) !== data.created_ms || Date.parse(record.expiresAt) !== data.expires_ms ||
        hash(JSON.stringify(record.request)) !== data.request_hash || hash(JSON.stringify(record.suite)) !== data.suite_hash || Date.parse(record.expiresAt) - Date.parse(record.createdAt) !== RUN_STORE_LIMITS.retentionMs ||
        (data.published_at !== null && (!timestamp(data.published_at) || !eligible(record)))) throw new RunStoreError("corrupt-record");
      return freezeData({ record, publishedAt: data.published_at });
    } catch (error) { if (error instanceof RunStoreError && error.code === "storage-limit") throw error; throw new RunStoreError("corrupt-record"); }
  };
  const encode = (record: RunRecord) => {
    const payload = JSON.stringify(record), bytes = Buffer.byteLength(payload);
    if (bytes > RUN_STORE_LIMITS.maxRecordBytes) throw new RunStoreError("storage-limit");
    return { payload, bytes, sha256: hash(payload) };
  };
  const save = (input: RunRecord): RunView => operation((time) => {
    const record = validate(snapshot(input)), previous = row(record.id);
    if (!previous || record.revision !== previous.revision) throw new RunStoreError("conflict");
    decode(previous);
    if (record.revision === Number.MAX_SAFE_INTEGER) throw new RunStoreError("storage-limit");
    if (Date.parse(record.createdAt) !== previous.created_ms || Date.parse(record.expiresAt) !== previous.expires_ms ||
      hash(JSON.stringify(record.request)) !== previous.request_hash || hash(JSON.stringify(record.suite)) !== previous.suite_hash ||
      (!states.slice(0, 2).includes(previous.state) && record.state !== previous.state) || (previous.published_at !== null && !eligible(record))) throw new RunStoreError("invalid-record");
    const updated = { ...record, revision: record.revision + 1, updatedAt: new Date(time).toISOString() }, encoded = encode(updated);
    const changed = db.query("UPDATE runs SET revision=?,state=?,bytes=?,sha256=?,payload=? WHERE id=? AND revision=?").run(updated.revision, updated.state, encoded.bytes, encoded.sha256, encoded.payload, updated.id, record.revision);
    if (changed.changes !== 1) throw new RunStoreError("conflict");
    return freezeData({ record: updated, publishedAt: previous.published_at });
  });

  return {
    create(input) { return operation((time) => {
      const record = validate(snapshot(input));
      if (record.revision !== 0 || row(record.id)) throw new RunStoreError("conflict");
      if (db.query<{ count: number }, []>("SELECT count(*) AS count FROM runs").get()!.count >= RUN_STORE_LIMITS.maxRecords) throw new RunStoreError("storage-limit");
      const created = { ...record, revision: 0, createdAt: new Date(time).toISOString(), updatedAt: new Date(time).toISOString(), expiresAt: new Date(time + RUN_STORE_LIMITS.retentionMs).toISOString() }, encoded = encode(created);
      const accessCode = randomBytes(32).toString("base64url");
      db.query("INSERT INTO runs VALUES (?,?,?,?,?,?,NULL,?,?,?,?,?)").run(created.id, 0, time, time + RUN_STORE_LIMITS.retentionMs, created.state, hash(accessCode), encoded.bytes, encoded.sha256, hash(JSON.stringify(created.request)), hash(JSON.stringify(created.suite)), encoded.payload);
      return { accessCode, view: freezeData({ record: created, publishedAt: null }) };
    }); },
    read(id, accessCode) { return operation(() => { const found = idValid(id) ? row(id) : null; return authorize(found, accessCode) ? decode(found!) : null; }); },
    save,
    publish(id, accessCode, published) { return operation((time) => {
      const found = idValid(id) ? row(id) : null;
      if (!authorize(found, accessCode)) return null;
      const view = decode(found!);
      if (typeof published !== "boolean") throw new RunStoreError("invalid-record");
      if (published && !eligible(view.record)) throw new RunStoreError("ineligible");
      const publishedAt = published ? view.publishedAt ?? new Date(time).toISOString() : null;
      db.query("UPDATE runs SET published_at=? WHERE id=?").run(publishedAt, id);
      return freezeData({ record: view.record, publishedAt });
    }); },
    readPublic(id) { return operation(() => { const found = idValid(id) ? row(id) : null; return found?.published_at ? decode(found) : null; }); },
    listPublic() { return operation(() => {
      const rows = db.query<Row, []>(`SELECT ${columns} FROM runs WHERE published_at IS NOT NULL ORDER BY published_at DESC,id ASC LIMIT 501`).all();
      if (rows.length > RUN_STORE_LIMITS.maxRecords || rows.reduce((sum, entry) => sum + entry.actual_bytes, 0) > RUN_STORE_LIMITS.maxPublicListBytes) throw new RunStoreError("storage-limit");
      return Object.freeze(rows.map(decode));
    }); },
    remove(id, accessCode) { return operation(() => { const found = idValid(id) ? row(id) : null; return authorize(found, accessCode) && db.query("DELETE FROM runs WHERE id=?").run(id).changes === 1; }); },
    recoverInterrupted() { return operation(() => {
      const rows = db.query<Row, []>(`SELECT ${columns} FROM runs WHERE state IN ('running','cancelling')`).all();
      for (const entry of rows) {
        const record = decode(entry).record;
        save({ ...record, state: "interrupted", progress: { ...record.progress, activeTrials: 0, remainingTrials: record.progress.plannedTrials - record.progress.finishedTrials },
          failure: { code: "server-interrupted", message: "The server restarted before this foreground run finished. Start a new run to continue." } });
      }
      return rows.length;
    }); },
    close() { if (!closed) { try { db.close(true); closed = true; } catch { throw new RunStoreError("storage-error"); } } },
  };
}
