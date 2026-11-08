// Real Bun sockets verify foreground streaming and cancellation with no external provider traffic.
import { expect, it } from "bun:test";
import { Hono } from "hono";
import { createInferenceClient } from "../inference";
import { buildPrompt } from "../protocol";
import { generateSuite } from "../suites/generator";
import { createRunService } from "./engine";
import { createRunRoutes } from "./routes";
import { createRunStore } from "./store";
import type { RunEvent, RunRequest } from "./types";

const providerKey = "N".repeat(43);
const request: RunRequest = { suiteKey: "reference-v1", provider: "openai", modelId: "fixture-native-http", servingProvider: null, profileId: "one-shot-json-v1", concurrency: 1, acceptCharges: true };

async function within<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Native HTTP fixture exceeded its deadline.")), ms); })]); }
  finally { clearTimeout(timer); }
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = performance.now() + 3000;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error("Native run did not settle before its fixture deadline.");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function frames(response: Response) {
  const reader = response.body!.getReader(), decoder = new TextDecoder();
  let pending = "";
  return {
    reader,
    async next(): Promise<RunEvent> {
      while (!pending.includes("\n")) {
        const part = await within(reader.read());
        if (part.done) throw new Error("Run stream closed before its terminal event.");
        pending += decoder.decode(part.value, { stream: true });
      }
      const end = pending.indexOf("\n"), line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      return JSON.parse(line) as RunEvent;
    },
  };
}

async function harness() {
  const generated = await generateSuite({ seed: "native-runs-http-v1", depths: [5], casesPerClass: 1, profileId: request.profileId, purpose: "evaluation" });
  if (generated.status !== "complete") throw new Error("Native fixture suite did not certify.");
  const suite = generated.suite, store = createRunStore({ path: ":memory:" });
  const entered = Promise.withResolvers<void>(), aborted = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const labels = new Map(suite.cases.map(entry => [buildPrompt(entry.reference, request.profileId).messages[1].content, entry.label]));
  let completedCalls = 0, inferenceCalls = 0;
  const client = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: request.modelId, object: "model" });
    inferenceCalls++; entered.resolve();
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { aborted.resolve(); reject(new Error("Fixture upstream abort.")); };
      if (init.signal!.aborted) { cancel(); return; }
      init.signal!.addEventListener("abort", cancel, { once: true });
      void release.promise.then(() => { init.signal!.removeEventListener("abort", cancel); resolve(); });
    });
    completedCalls++;
    const body = JSON.parse(init.body as string);
    return Response.json({ model: request.modelId, status: "completed", max_output_tokens: 4096, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Native HTTP fixture." }) }] }],
      usage: { input_tokens: 100, output_tokens: 30, output_tokens_details: { reasoning_tokens: 0 } } });
  });
  const service = createRunService({ store, inferenceClient: client, loadSuite: async () => suite });
  const app = new Hono(); app.route("/runs", createRunRoutes({ store, service }));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const base = `http://127.0.0.1:${server.port}/runs`;
  return { store, service, server, base, entered, aborted, release,
    get completedCalls() { return completedCalls; }, get inferenceCalls() { return inferenceCalls; },
    async close() { release.resolve(); await server.stop(true); await until(() => service.activeRuns === 0); store.close(); },
  };
}

async function launch(fixture: Awaited<ReturnType<typeof harness>>, signal?: AbortSignal) {
  const response = await within(fetch(fixture.base, { method: "POST", signal, headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" }, body: JSON.stringify(request) }));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  expect(response.headers.get("cache-control")).toContain("no-store");
  const stream = frames(response), started = await stream.next();
  if (started.type !== "started") throw new Error(`Expected first started frame, got ${started.type}.`);
  return { response, stream, started };
}

it("streams the first started frame before inference finishes, then retains a complete private report", async () => {
  const fixture = await harness();
  try {
    const { stream, started } = await launch(fixture);
    expect(fixture.completedCalls).toBe(0);
    await within(fixture.entered.promise);
    expect(fixture.inferenceCalls).toBe(1);
    fixture.release.resolve();
    let final: RunEvent;
    do { final = await stream.next(); } while (final.type !== "finished");
    if (final.type !== "finished") throw new Error("Missing terminal report.");
    expect(final.state).toBe("completed");
    expect(final.report.overall.classification).toMatchObject({ macroF1: 1, population: { plannedTrials: 9, includedTrials: 9, status: "complete" } });
    expect(fixture.inferenceCalls).toBe(9);
    const body = await (await fetch(`${fixture.base}/${started.runId}/export`, { headers: { Authorization: `Bearer ${started.accessCode}` } })).text();
    expect(body).not.toContain(providerKey); expect(body).not.toContain(started.accessCode);
    expect(JSON.parse(body).record.evidence.trials).toHaveLength(9);
    expect((await fetch(`${fixture.base}/${started.runId}/public`)).status).toBe(404);
    expect((await fetch(`${fixture.base}/${started.runId}`, { headers: { Authorization: `Bearer ${providerKey}` } })).status).toBe(404);
    await stream.reader.cancel();
  } finally { await fixture.close(); }
}, 10000);

it("authenticates explicit cancellation independently and keeps the original stream through its terminal event", async () => {
  const fixture = await harness();
  try {
    const { stream, started } = await launch(fixture);
    await within(fixture.entered.promise);
    const cancel = (code: string) => fetch(`${fixture.base}/${started.runId}/cancel`, {
      method: "POST", headers: { Authorization: `Bearer ${code}`, "Content-Type": "application/json" }, body: "{}",
    });
    const prematurePublication = await fetch(`${fixture.base}/${started.runId}/publication`, {
      method: "POST", headers: { Authorization: `Bearer ${started.accessCode}`, "Content-Type": "application/json" }, body: '{"published":true}',
    });
    expect(prematurePublication.status).toBe(409);
    const malformedCancel = await fetch(`${fixture.base}/${started.runId}/cancel`, {
      method: "POST", headers: { Authorization: `Bearer ${started.accessCode}`, "Content-Type": "application/json" }, body: '{"unexpected":true}',
    });
    expect(malformedCancel.status).toBe(400);
    expect((await cancel(providerKey)).status).toBe(404);
    expect(fixture.completedCalls).toBe(0);
    const response = await cancel(started.accessCode);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ cancellationRequested: true });
    await within(fixture.aborted.promise);
    let final: RunEvent;
    do { final = await stream.next(); } while (final.type !== "finished");
    if (final.type !== "finished") throw new Error("Cancellation closed the stream without a terminal event.");
    expect(final.state).toBe("cancelled");
    const retained = fixture.store.read(started.runId, started.accessCode)!.record;
    expect(retained.progress).toMatchObject({ plannedTrials: 9, startedTrials: 1, activeTrials: 0, finishedTrials: 1, remainingTrials: 8, inferenceRequests: 1 });
    expect(retained.evidence.trials).toHaveLength(9);
    expect(retained.evidence.trials.filter(trial => trial.finalAttempt === null)).toHaveLength(8);
    expect(fixture.inferenceCalls).toBe(1);
    expect(fixture.completedCalls).toBe(0);
    expect((await cancel(started.accessCode)).status).toBe(200);
    await stream.reader.cancel();
  } finally { await fixture.close(); }
}, 10000);

it("propagates a real client disconnect to the upstream abort signal and retains every planned trial", async () => {
  const fixture = await harness(), caller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const launched = await launch(fixture, caller.signal);
    reader = launched.stream.reader;
    await within(fixture.entered.promise);
    caller.abort();
    await within(fixture.aborted.promise);
    await until(() => fixture.service.activeRuns === 0);
    const retained = fixture.store.read(launched.started.runId, launched.started.accessCode)!.record;
    expect(retained.state).toBe("cancelled");
    expect(retained.progress).toMatchObject({ plannedTrials: 9, activeTrials: 0, finishedTrials: 1, remainingTrials: 8, inferenceRequests: 1 });
    expect(retained.evidence.trials).toHaveLength(9);
    expect(retained.evidence.trials.filter(trial => trial.finalAttempt === null)).toHaveLength(8);
    expect(retained.report?.overall.classification.population).toMatchObject({ status: "unavailable", plannedTrials: 9 });
    expect(fixture.inferenceCalls).toBe(1);
    expect(fixture.completedCalls).toBe(0);
    expect(JSON.stringify(retained)).not.toContain(providerKey);
  } finally {
    caller.abort(); await reader?.cancel().catch(() => {}); await fixture.close();
  }
}, 10000);
