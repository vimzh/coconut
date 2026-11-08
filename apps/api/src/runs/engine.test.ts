// Real SQLite and SDK fixtures verify full trial accounting without making provider calls.
import { beforeAll, describe, expect, it } from "bun:test";
import { createInferenceClient } from "../inference";
import { buildPrompt } from "../protocol";
import { generateSuite } from "../suites/generator";
import { createRunService } from "./engine";
import { parseRunRequest } from "./policy";
import { createRunStore } from "./store";
import type { RunEvent, RunRequest, RunSuite } from "./types";

const credential = "fixture-provider-credential-abcdefghijkl";
const request: RunRequest = { suiteKey: "reference-v1", provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", concurrency: 2, acceptCharges: true };
let suite: RunSuite;
beforeAll(async () => {
  const result = await generateSuite({ seed: "run-engine-fixture", depths: [5], casesPerClass: 1, profileId: request.profileId, purpose: "evaluation" });
  if (result.status !== "complete") throw new Error("Fixture suite did not verify.");
  suite = result.suite;
});

function harness(mode: "correct" | "invalid" | "authentication" | "rate-limit" | "network" = "correct") {
  const store = createRunStore({ path: ":memory:" });
  let calls = 0, active = 0, peak = 0;
  const labels = new Map(suite.cases.map(entry => [buildPrompt(entry.reference, request.profileId).messages[1].content, entry.label]));
  const inferenceClient = createInferenceClient(async (_url, init) => {
    if (mode === "network") throw new TypeError("Controlled connection failure.");
    if (init.method === "GET") return mode === "authentication" ? Response.json({ error: {} }, { status: 401 }) : Response.json({ id: request.modelId, object: "model" });
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    if (mode === "rate-limit") return new Response("Not JSON", { status: 429 });
    const body = JSON.parse(init.body as string);
    return Response.json({ model: "fixture-model", status: "completed", max_output_tokens: 4096, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: mode === "invalid" ? "malformed JSON" : JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Controlled provider fixture." }) }] }],
      usage: { input_tokens: 500, output_tokens: 40, output_tokens_details: { reasoning_tokens: 10 } },
    });
  });
  const service = createRunService({ store, inferenceClient, loadSuite: async () => suite });
  return { store, service, inferenceClient, get calls() { return calls; }, get peak() { return peak; } };
}

describe("bounded foreground evaluation", () => {
  it("records all three fresh trials and reproduces an exact complete report", async () => {
    const fixture = harness(), events: RunEvent[] = [];
    try {
      const view = await fixture.service.execute(request, credential, undefined, event => events.push(event));
      const start = events.find(event => event.type === "started");
      if (!start || start.type !== "started") throw new Error("Missing start event.");
      expect(view.record.state).toBe("completed");
      expect(view.record.progress).toEqual({ plannedTrials: 9, startedTrials: 9, activeTrials: 0, finishedTrials: 9, modelOutcomes: 9, infrastructureFailures: 0, remainingTrials: 0, inferenceRequests: 9 });
      expect(view.record.evidence.trials).toHaveLength(9);
      expect(new Set(view.record.evidence.trials.map(trial => `${trial.caseId}:${trial.trialIndex}`)).size).toBe(9);
      expect(view.record.evidence.trials.every(trial => trial.attempts.length === 1 && trial.finalAttempt === 1)).toBe(true);
      expect(view.record.report?.overall.classification).toMatchObject({ macroF1: 1, population: { plannedTrials: 9, includedTrials: 9, status: "complete" } });
      expect(fixture.calls).toBe(9);
      expect(fixture.peak).toBe(2);
      expect(fixture.store.read(view.record.id, start.accessCode)?.record.report?.id).toBe(view.record.report?.id);
      expect(fixture.store.readPublic(view.record.id)).toBeNull();
      expect(JSON.stringify(view)).not.toContain(credential);
      expect(JSON.stringify(view)).not.toContain(start.accessCode);
      for (const event of events) if ("progress" in event) {
        expect(event.progress.remainingTrials + event.progress.finishedTrials).toBe(event.progress.plannedTrials);
        expect(event.progress.activeTrials).toBeLessThanOrEqual(event.progress.remainingTrials);
        expect(Object.values(event.progress).every(value => Number.isInteger(value) && value >= 0)).toBe(true);
      }
    } finally { fixture.store.close(); }
  });

  it("keeps malformed completed replies in the full model population with their actual zero score", async () => {
    const fixture = harness("invalid");
    try {
      const view = await fixture.service.execute(request, credential);
      expect(view.record.state).toBe("completed");
      expect(view.record.report?.overall.classification).toMatchObject({ macroF1: 0, population: { status: "complete", includedTrials: 9 }, outcomes: { invalid: { numerator: 9 } } });
      expect(fixture.calls).toBe(9);
    } finally { fixture.store.close(); }
  });

  it("stops on rejected credentials and leaves unattempted trials explicit", async () => {
    const fixture = harness("authentication");
    try {
      const view = await fixture.service.execute({ ...request, concurrency: 1 }, credential);
      expect(view.record.state).toBe("failed");
      expect(view.record.progress).toMatchObject({ finishedTrials: 1, infrastructureFailures: 1, remainingTrials: 8, inferenceRequests: 0 });
      expect(view.record.evidence.trials.filter(trial => trial.finalAttempt === null)).toHaveLength(8);
      expect(view.record.report?.overall.classification.population).toMatchObject({ plannedTrials: 9, includedTrials: 0, excludedTrials: 9, status: "unavailable" });
      expect(fixture.calls).toBe(0);
    } finally { fixture.store.close(); }
  });

  it("does not call infrastructure-only work a successful complete evaluation or retry its trials", async () => {
    const fixture = harness("rate-limit");
    try {
      const view = await fixture.service.execute(request, credential);
      expect(view.record.state).toBe("failed");
      expect(view.record.progress).toMatchObject({ finishedTrials: 9, remainingTrials: 0, infrastructureFailures: 9, inferenceRequests: 9 });
      expect(view.record.report?.overall.classification.population.status).toBe("unavailable");
      expect(fixture.calls).toBe(9);
    } finally { fixture.store.close(); }
  });

  it("stops dispatching after a connection failure and retains all unattempted work", async () => {
    const fixture = harness("network");
    try {
      const view = await fixture.service.execute({ ...request, concurrency: 1 }, credential);
      expect(view.record.state).toBe("failed");
      expect(view.record.failure?.code).toBe("network-error");
      expect(view.record.progress).toMatchObject({ startedTrials: 1, finishedTrials: 1, infrastructureFailures: 1, remainingTrials: 8, inferenceRequests: 0 });
      expect(view.record.evidence.trials.filter(trial => trial.finalAttempt === null)).toHaveLength(8);
      expect(fixture.calls).toBe(0);
    } finally { fixture.store.close(); }
  });

  it("retains a terminal failed state when scoring throws after paid work has settled", async () => {
    const fixture = harness(), events: RunEvent[] = [];
    const service = createRunService({ store: fixture.store, inferenceClient: fixture.inferenceClient, loadSuite: async () => suite,
      score: async () => { throw new Error("Controlled scorer failure."); } });
    try {
      await expect(service.execute(request, credential, undefined, event => events.push(event))).rejects.toThrow("could not finalize");
      const start = events.find(event => event.type === "started");
      if (!start || start.type !== "started") throw new Error("Missing receipt.");
      const record = fixture.store.read(start.runId, start.accessCode)!.record;
      expect(record.state).toBe("failed");
      expect(record.failure?.code).toBe("finalization-failed");
      expect(record.results).toHaveLength(9);
      expect(record.report).toBeNull();
      expect(service.activeRuns).toBe(0);
      expect(service.cancel(start.runId, start.accessCode)).toBe(false);
      expect(events.at(-1)?.type).toBe("error");
      expect(fixture.calls).toBe(9);
    } finally { fixture.store.close(); }
  });

  it("records failure after a rejected final save without repeating inference", async () => {
    const fixture = harness(), events: RunEvent[] = [];
    const store = { ...fixture.store, save: (record: Parameters<typeof fixture.store.save>[0]) => {
      if (record.state === "completed") throw new Error("Controlled final storage failure.");
      return fixture.store.save(record);
    } };
    const service = createRunService({ store, inferenceClient: fixture.inferenceClient, loadSuite: async () => suite });
    try {
      await expect(service.execute(request, credential, undefined, event => events.push(event))).rejects.toThrow("could not finalize");
      const start = events.find(event => event.type === "started");
      if (!start || start.type !== "started") throw new Error("Missing receipt.");
      expect(fixture.store.read(start.runId, start.accessCode)?.record).toMatchObject({ state: "failed", report: null, failure: { code: "finalization-failed" } });
      expect(fixture.calls).toBe(9);
    } finally { fixture.store.close(); }
  });

  it("authenticates cancellation separately and preserves completed work without resumption", async () => {
    const fixture = harness();
    let code = "", id = "", cancelled = false;
    try {
      const view = await fixture.service.execute({ ...request, concurrency: 1 }, credential, undefined, event => {
        if (event.type === "started") { code = event.accessCode; id = event.runId; }
        if (event.type === "progress" && event.progress.finishedTrials === 1 && !cancelled) {
          cancelled = true;
          expect(fixture.service.cancel(id, "wrong-code")).toBe(false);
          expect(fixture.service.cancel(id, code)).toBe(true);
        }
      });
      expect(view.record.state).toBe("cancelled");
      expect(view.record.progress).toMatchObject({ finishedTrials: 1, remainingTrials: 8, inferenceRequests: 1, activeTrials: 0 });
      expect(view.record.report?.overall.classification.population).toMatchObject({ status: "provisional", plannedTrials: 9, includedTrials: 1 });
      expect(view.record.evidence.trials).toHaveLength(9);
      expect(fixture.calls).toBe(1);
      expect(fixture.service.cancel(id, code)).toBe(false);
    } finally { fixture.store.close(); }
  });

  it("rejects invalid setup and a pre-aborted launch before storing or dispatching paid work", async () => {
    const fixture = harness();
    try {
      for (const input of [{ ...request, concurrency: 0 }, { ...request, acceptCharges: false }, { ...request, suiteKey: "../secret" }, { ...request, key: credential }]) await expect(fixture.service.execute(input, credential)).rejects.toThrow();
      await expect(fixture.service.execute(request, credential, AbortSignal.abort())).rejects.toThrow("cancelled");
      expect(fixture.calls).toBe(0);
      expect(fixture.service.activeRuns).toBe(0);
      expect(fixture.store.listPublic()).toEqual([]);
    } finally { fixture.store.close(); }
  });

  it("fails safely when inference evidence is unavailable instead of fabricating an answer", async () => {
    const fixture = harness();
    const service = createRunService({ store: fixture.store, loadSuite: async () => suite, inferenceClient: async () => { throw new Error("private credential diagnostic"); } });
    try {
      const view = await service.execute({ ...request, concurrency: 1 }, credential);
      expect(view.record.state).toBe("failed");
      expect(view.record.progress).toMatchObject({ startedTrials: 1, activeTrials: 0, finishedTrials: 0, remainingTrials: 9 });
      expect(view.record.report?.overall.classification.population.status).toBe("unavailable");
      expect(view.record.results).toHaveLength(0);
      expect(JSON.stringify(view)).not.toContain("private credential diagnostic");
    } finally { fixture.store.close(); }
  });
});

it("keeps strict data validation and explicit routing in the run launch contract", () => {
  expect(parseRunRequest(request)).toEqual(request);
  expect(() => parseRunRequest({ ...request, provider: "openrouter", modelId: "owner/model", servingProvider: "auto" })).toThrow();
  expect(() => parseRunRequest({ ...request, provider: "hugging-face", modelId: "owner/model", servingProvider: "host", profileId: "one-shot-json-v2-high" })).toThrow("currently require OpenAI");
});
