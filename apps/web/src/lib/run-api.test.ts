// Fixture-only run client checks cover stream truthfulness and independent private access.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  cancelRun, deleteRun, exportRun, loadPrivateRun, loadPublicRun, loadRunPolicy,
  loadRunSuites, parseRunViewMeta, RunApiError, setRunPublication, startRun,
  type RunEvent, type RunProgress, type RunRequest,
} from "./run-api";

const key = "sk-fixture-visitor-credential-1234";
const accessCode = "a".repeat(43);
const id = "run-fixture-1";
const expiresAt = "2026-11-15T00:00:00.000Z";
const publishedAt = "2026-11-08T00:00:00.000Z";
const input: RunRequest = { suiteKey: "screening-v1", provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", concurrency: 2, acceptCharges: true };
const pending: RunProgress = { plannedTrials: 3, startedTrials: 0, activeTrials: 0, finishedTrials: 0, modelOutcomes: 0, infrastructureFailures: 0, remainingTrials: 3, inferenceRequests: 0 };
const finished: RunProgress = { plannedTrials: 3, startedTrials: 3, activeTrials: 0, finishedTrials: 3, modelOutcomes: 3, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: 3 };
const report = { reportVersion: "1", identity: { runId: id }, note: "Measured ∂² and Ω values" };
const started = { type: "started", runId: id, accessCode, progress: pending, expiresAt };
const ended = { type: "finished", runId: id, state: "completed", progress: finished, report };
const policy = {
  version: "1", policyId: "foreground-runs-v1", trialsPerInstance: 3, attemptsPerTrial: 1,
  retries: 0, maxConcurrency: 12, defaultConcurrency: 4, maxActiveRuns: 4, maxCases: 75,
  metadataTimeoutMs: 20_000, inferenceTimeoutMs: 180_000, runTimeoutMs: 3_600_000,
  retentionDays: 7, visibility: "private-until-explicit-publication", resumption: "unsupported",
  credentials: "Keep provider credentials in the current operation.", charges: "Visitor pays provider charges.", cancellation: "Remote charges can remain unknown.",
};
const suite = { key: "screening-v1", name: "Exploratory screening", description: "A fixed screening population.", suiteId: "suite-fixture", caseCount: 9, depths: [2, 5, 11], generatorVersion: "1", promptVersion: "1", recommended: false };
const originalFetch = globalThis.fetch;
const originalOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
let calls: { url: string; init: RequestInit }[];
let responses: Response[];

function runView(published: string | null = null) {
  return { record: { version: "1", id, state: "completed", expiresAt, progress: finished, report }, publishedAt: published };
}
function ndjson(events: readonly unknown[], trailingNewline = true): Response {
  return new Response(events.map((event) => JSON.stringify(event)).join("\n") + (trailingNewline ? "\n" : ""), { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
function streamed(chunks: readonly Uint8Array[], contentType = "application/json", onCancel = () => {}): Response {
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < chunks.length) controller.enqueue(chunks[offset++]);
      else controller.close();
    },
    cancel: onCancel,
  }), { headers: { "content-type": contentType } });
}
function failure(code: RunApiError["code"], status: number | null = null) {
  return (error: unknown) => error instanceof RunApiError && error.code === code && error.status === status && !error.message.includes(key) && !error.message.includes(accessCode) && !("cause" in error);
}
beforeEach(() => {
  calls = []; responses = [];
  process.env.NEXT_PUBLIC_API_ORIGIN = "http://localhost:3201";
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error(`Fixture rejected ${key}`);
    return next;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_API_ORIGIN;
  else process.env.NEXT_PUBLIC_API_ORIGIN = originalOrigin;
});

describe("run browser API", () => {
  it("loads anonymous, bounded policy and suite projections without retaining unknown diagnostics", async () => {
    responses.push(Response.json({ ...policy, diagnostic: "private message" }), Response.json({ version: "1", suites: [{ ...suite, diagnostic: "private message" }] }));
    assert.deepEqual(await loadRunPolicy(), policy);
    assert.deepEqual(await loadRunSuites(), [suite]);
    assert.deepEqual(calls.map((call) => call.url), ["http://localhost:3201/runs/policy", "http://localhost:3201/runs/suites"]);
    for (const call of calls) {
      assert.equal(new Headers(call.init.headers).has("authorization"), false);
      assert.equal(call.init.credentials, "omit"); assert.equal(call.init.cache, "no-store");
      assert.equal(call.init.redirect, "error"); assert.equal(call.init.referrerPolicy, "no-referrer");
    }
  });

  it("rejects incompatible policies, duplicate suites, and invalid depth populations", async () => {
    for (const body of [{ ...policy, retries: 1 }, { ...policy, resumption: "supported" }, { ...policy, defaultConcurrency: 13 }]) {
      responses.push(Response.json(body));
      await assert.rejects(loadRunPolicy(), failure("unexpected-response"));
    }
    for (const suites of [[suite, suite], [{ ...suite, depths: [2, 2] }], [{ ...suite, caseCount: 76 }], [{ ...suite, recommended: "yes" }]]) {
      responses.push(Response.json({ version: "1", suites }));
      await assert.rejects(loadRunSuites(), failure("unexpected-response"));
    }
  });

  it("uses exact consented request fields and keeps provider credentials in Authorization", async () => {
    responses.push(ndjson([started, ended]));
    const signal = new AbortController().signal, events: RunEvent[] = [];
    await startRun(input, key, (event) => events.push(event), signal);
    assert.deepEqual(JSON.parse(calls[0].init.body as string), input);
    assert.equal(calls[0].url, "http://localhost:3201/runs");
    assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${key}`);
    assert.equal(new Headers(calls[0].init.headers).get("accept"), "application/x-ndjson");
    assert.equal(calls[0].init.signal, signal);
    assert.equal(String(calls[0].init.body).includes(key), false);
    assert.deepEqual(events, [started, ended]);
  });

  it("decodes split UTF-8 and split JSON incrementally, including heartbeat and active remaining counts", async () => {
    const active = { type: "progress", runId: id, state: "running", progress: { ...pending, startedTrials: 2, activeTrials: 2 } };
    const bytes = new TextEncoder().encode([started, { type: "heartbeat" }, active, ended].map((event) => JSON.stringify(event)).join("\r\n") + "\r\n");
    responses.push(streamed(Array.from(bytes, (byte) => new Uint8Array([byte])), "application/x-ndjson"));
    const events: RunEvent[] = [];
    await startRun(input, key, (event) => events.push(event));
    assert.equal(events.length, 4);
    assert.deepEqual(events[2], active);
    assert.equal((events[3] as typeof ended).report.note, report.note);
  });

  it("rejects invalid charge acknowledgement, unknown fields, invalid concurrency, and implicit routed settings before fetch", async () => {
    for (const request of [
      { ...input, acceptCharges: false }, { ...input, credential: key }, { ...input, concurrency: 0 },
      { ...input, concurrency: 13 }, { ...input, provider: "unknown" }, { ...input, suiteKey: "unknown" },
      { ...input, profileId: "unknown" }, { ...input, modelId: key },
      { ...input, provider: "openrouter", modelId: "owner/model", servingProvider: null },
      { ...input, provider: "hugging-face", modelId: "owner/model", servingProvider: "auto" },
      { ...input, provider: "openrouter", modelId: "owner/model", servingProvider: "route", profileId: "one-shot-json-v2-high" },
    ]) await assert.rejects(startRun(request as RunRequest, key, () => {}), failure("invalid-input"));
    assert.equal(calls.length, 0);
  });

  it("sends cancellation independently and keeps the original stream open until its terminal event", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let streamCancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel() { streamCancelled = true; } });
    responses.push(new Response(stream, { headers: { "content-type": "application/x-ndjson" } }), Response.json({ cancellationRequested: true }));
    const runController = new AbortController(), cancellationController = new AbortController();
    let signalStarted!: () => void;
    const didStart = new Promise<void>((resolve) => { signalStarted = resolve; });
    const events: RunEvent[] = [];
    const running = startRun(input, key, (event) => { events.push(event); if (event.type === "started") signalStarted(); }, runController.signal);
    controller.enqueue(new TextEncoder().encode(JSON.stringify(started) + "\n"));
    await didStart;
    assert.deepEqual(await cancelRun(id, accessCode, cancellationController.signal), { cancellationRequested: true });
    assert.equal(streamCancelled, false); assert.equal(runController.signal.aborted, false);
    assert.equal(calls[1].url, `http://localhost:3201/runs/${id}/cancel`);
    assert.equal(new Headers(calls[1].init.headers).get("authorization"), `Bearer ${accessCode}`);
    assert.equal(calls[1].init.body, "{}"); assert.equal(calls[1].init.signal, cancellationController.signal);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...ended, state: "cancelled", progress: pending }) + "\n"));
    controller.close(); await running;
    assert.equal(events.at(-1)?.type, "finished");
  });

  it("keeps private access separate for load, export, publication, and deletion; public reads are anonymous", async () => {
    responses.push(Response.json(runView()), Response.json(runView()), Response.json(runView(publishedAt)), Response.json(runView(publishedAt)), Response.json({ deleted: true }));
    const value = await loadPrivateRun(id, accessCode);
    assert.deepEqual(parseRunViewMeta(value), { id, state: "completed", expiresAt, progress: finished, publishedAt: null });
    const exported = await exportRun(id, accessCode);
    assert.equal(exported.type.split(";", 1)[0], "application/json");
    assert.deepEqual(JSON.parse(await exported.text()), runView());
    await setRunPublication(id, accessCode, true);
    await loadPublicRun(id);
    await deleteRun(id, accessCode);
    assert.deepEqual(calls.map((call) => call.url), [`http://localhost:3201/runs/${id}`, `http://localhost:3201/runs/${id}/export`, `http://localhost:3201/runs/${id}/publication`, `http://localhost:3201/runs/${id}/public`, `http://localhost:3201/runs/${id}`]);
    assert.deepEqual(JSON.parse(calls[2].init.body as string), { published: true });
    assert.equal(calls[4].init.method, "DELETE");
    for (const index of [0, 1, 2, 4]) {
      assert.equal(new Headers(calls[index].init.headers).get("authorization"), `Bearer ${accessCode}`);
      assert.equal(calls[index].url.includes(accessCode), false);
      assert.equal(String(calls[index].init.body).includes(accessCode), false);
    }
    assert.equal(new Headers(calls[3].init.headers).has("authorization"), false);
  });

  it("rejects invalid private identifiers and access codes without making requests", async () => {
    for (const runId of ["../other", "run?secret=1", accessCode, ""]) await assert.rejects(loadPrivateRun(runId, accessCode), failure("invalid-input"));
    for (const code of [key, "short", "a".repeat(42), "a".repeat(44), " ".repeat(43)]) await assert.rejects(cancelRun(id, code), failure("invalid-input"));
    await assert.rejects(setRunPublication(id, accessCode, "yes" as unknown as boolean), failure("invalid-input"));
    assert.equal(calls.length, 0);
  });

  it("rejects mismatched or malformed record metadata and contradictory publication responses", async () => {
    for (const value of [
      {}, { ...runView(), record: { ...runView().record, version: "2" } },
      { ...runView(), record: { ...runView().record, id: "other" } },
      { ...runView(), record: { ...runView().record, expiresAt: "never" } },
      { ...runView(), record: { ...runView().record, progress: { ...finished, remainingTrials: 1 } } },
      { ...runView(), record: { ...runView().record, progress: pending } },
    ]) { responses.push(Response.json(value)); await assert.rejects(loadPrivateRun(id, accessCode), failure("unexpected-response")); }
    responses.push(Response.json(runView()), Response.json(runView()), Response.json({ deleted: false }), Response.json({ cancellationRequested: "yes" }));
    await assert.rejects(setRunPublication(id, accessCode, true), failure("unexpected-response"));
    await assert.rejects(loadPublicRun(id), failure("unexpected-response"));
    await assert.rejects(deleteRun(id, accessCode), failure("unexpected-response"));
    await assert.rejects(cancelRun(id, accessCode), failure("unexpected-response"));
  });

  it("discards raw server diagnostics and accepts an error terminal without claiming completion", async () => {
    const diagnostic = "untrusted private upstream message";
    responses.push(ndjson([started, { type: "error", runId: id, code: "run-failed", message: diagnostic }, { type: "error", runId: null, code: "run-failed", message: diagnostic }]));
    const events: RunEvent[] = [];
    await startRun(input, key, (event) => events.push(event));
    assert.deepEqual(events.map((event) => event.type), ["started", "error"]);
    assert.equal(JSON.stringify(events).includes(diagnostic), false);
    assert.equal((events[1] as Extract<RunEvent, { type: "error" }>).code, "run-failed");
    responses.push(ndjson([{ type: "error", runId: null, code: "run-failed", message: diagnostic }]));
    await startRun(input, key, () => {});
  });

  it("rejects unknown, out-of-order, conflicting, regressing, and impossible progress events", async () => {
    const active = { type: "progress", runId: id, state: "running", progress: { ...pending, startedTrials: 1, activeTrials: 1 } };
    const malformed = [
      [started, { type: "mystery" }], [ended], [started, started], [started, { ...active, runId: "other" }],
      [started, { ...active, progress: { ...active.progress, remainingTrials: 2 } }],
      [started, { ...active, progress: { ...active.progress, startedTrials: 0 } }],
      [started, active, { ...active, progress: pending }], [started, { ...ended, state: "running" }],
      [started, { ...ended, report: { reportVersion: "1", identity: { runId: "other" } } }],
      [started, ended, { type: "heartbeat" }], [started, { ...active, unexpected: "extra" }],
    ];
    for (const events of malformed) {
      responses.push(ndjson(events));
      await assert.rejects(startRun(input, key, () => {}), failure("unexpected-response"));
    }
  });

  it("rejects truncated lines, missing terminal events, empty streams, malformed JSON, and invalid UTF-8", async () => {
    for (const response of [
      ndjson([started]), ndjson([started, ended], false),
      new Response("", { headers: { "content-type": "application/x-ndjson" } }),
      new Response("private unparseable text\n", { headers: { "content-type": "application/x-ndjson" } }),
      streamed([new Uint8Array([0xc3, 0x28, 10])], "application/x-ndjson"),
    ]) {
      responses.push(response);
      await assert.rejects(startRun(input, key, () => {}), failure("unexpected-response"));
    }
  });

  it("rejects provider-key reflection and private-code reflection, including encoded forms", async () => {
    responses.push(ndjson([{ ...started, runId: accessCode }]));
    await assert.rejects(startRun(input, key, () => {}), failure("unexpected-response"));
    for (const form of [key, encodeURIComponent(key), btoa(key)]) {
      responses.push(ndjson([started, { ...ended, report: { ...report, diagnostic: form } }]));
      await assert.rejects(startRun(input, key, () => {}), failure("unexpected-response"));
    }
    for (const form of [accessCode, btoa(accessCode)]) {
      responses.push(Response.json({ ...runView(), private: form }));
      await assert.rejects(loadPrivateRun(id, accessCode), failure("unexpected-response"));
      responses.push(ndjson([started, { ...ended, report: { ...report, diagnostic: form } }]));
      await assert.rejects(startRun(input, key, () => {}), failure("unexpected-response"));
    }
  });

  it("permits retained records over the provider-client budget while enforcing actual JSON and export limits", async () => {
    responses.push(Response.json({ ...runView(), padding: "x".repeat(1_048_577) }));
    assert.equal(parseRunViewMeta(await loadPrivateRun(id, accessCode)).id, id);
    const chunk = new Uint8Array(1024 * 1024);
    let jsonCancelled = false, exportCancelled = false;
    responses.push(streamed(Array.from({ length: 66 }, () => chunk), "application/json", () => { jsonCancelled = true; }));
    await assert.rejects(loadPrivateRun(id, accessCode), failure("response-too-large"));
    assert.equal(jsonCancelled, true);
    responses.push(streamed(Array.from({ length: 258 }, () => chunk), "application/json", () => { exportCancelled = true; }));
    await assert.rejects(exportRun(id, accessCode), failure("response-too-large"));
    assert.equal(exportCancelled, true);
  });

  it("bounds each NDJSON line and the aggregate stream before parsing oversized data", async () => {
    for (const bytes of [new Uint8Array(4 * 1024 * 1024 + 1), new Uint8Array(64 * 1024 * 1024 + 1)]) {
      let cancelled = false;
      responses.push(streamed([bytes, new Uint8Array([10])], "application/x-ndjson", () => { cancelled = true; }));
      await assert.rejects(startRun(input, key, () => {}), failure("response-too-large"));
      assert.equal(cancelled, true);
    }
  });

  it("does not hide HTTP, content-type, JSON, or network failures and never retries", async () => {
    responses.push(Response.json({ error: { message: key } }, { status: 404 }), new Response("private text", { headers: { "content-type": "text/plain" } }), new Response("private text", { headers: { "content-type": "application/json" } }));
    await assert.rejects(loadPrivateRun(id, accessCode), failure("http-error", 404));
    await assert.rejects(loadRunPolicy(), failure("unexpected-response"));
    await assert.rejects(loadRunPolicy(), failure("unexpected-response"));
    await assert.rejects(loadRunPolicy(), failure("network-error"));
    assert.equal(calls.length, 4);
  });

  it("rejects unsafe API origins before transmitting any credential", async () => {
    for (const origin of ["http://remote.example", "https://example.invalid/path", "https://user:password@example.invalid", "https://example.invalid?q=1", "https://example.invalid#fragment", "file:///tmp/run"]) {
      process.env.NEXT_PUBLIC_API_ORIGIN = origin;
      await assert.rejects(startRun(input, key, () => {}), failure("configuration"));
    }
    assert.equal(calls.length, 0);
    for (const origin of ["http://127.0.0.1:3201", "http://[::1]:3201", "https://api.example.invalid"]) {
      process.env.NEXT_PUBLIC_API_ORIGIN = origin;
      responses.push(Response.json(policy)); await loadRunPolicy();
      assert.equal(calls.at(-1)?.url, `${origin}/runs/policy`);
    }
  });

  it("honors abort before fetch and while an NDJSON reader is awaiting data", async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(startRun(input, key, () => {}, controller.signal), failure("cancelled"));
    assert.equal(calls.length, 0);
    let cancelled = false;
    responses.push(new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }), { headers: { "content-type": "application/x-ndjson" } }));
    const pendingController = new AbortController();
    const running = startRun(input, key, () => {}, pendingController.signal);
    await new Promise<void>((resolve) => setImmediate(resolve));
    pendingController.abort();
    await assert.rejects(running, failure("cancelled"));
    assert.equal(cancelled, true);
  });

  it("honors abort while a retained-record reader is awaiting data", async () => {
    let cancelled = false;
    responses.push(new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }), { headers: { "content-type": "application/json" } }));
    const controller = new AbortController();
    const loading = loadPrivateRun(id, accessCode, controller.signal);
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(loading, failure("cancelled"));
    assert.equal(cancelled, true);
  });
});
