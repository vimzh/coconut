// Offline SDK fixtures exercise the terminal boundary through the actual engine and SQLite store.
import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInferenceClient } from "../apps/api/src/inference";
import { buildNumericalPrompts } from "../apps/api/src/numerics";
import { createRunStore, loadRunSuite, type RunSuite, type RunView } from "../apps/api/src/runs";
import { runCli } from "./evaluate";

const credential = "terminal-fixture-credential-abcdefghijkl";
const directories: string[] = [];
let suite: RunSuite, labels: Map<string, string>;
beforeAll(async () => {
  suite = await loadRunSuite("composition-v1", "one-shot-json-v1");
  const prompts = await buildNumericalPrompts(suite.cases.map(entry => entry.reference), "one-shot-json-v1", "smooth-v2");
  labels = new Map(prompts.map((prompt, index) => [prompt.messages[1].content, suite.cases[index].label]));
}, 30000);
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });

function harness(mode: "counterexample" | "network" | "correct" | "throw" = "correct") {
  const parent = mkdtempSync(join(tmpdir(), "coconut-terminal-")); directories.push(parent);
  const output = join(parent, "run"), logs: string[] = [], errors: string[] = [];
  let calls = 0, metadata = 0, peak = 0, active = 0;
  const inferenceClient = createInferenceClient(async (_url, init) => {
    if (mode === "throw") throw new Error(`Private failure: ${credential}`);
    if (mode === "network") throw new TypeError(`Private network diagnostic: ${credential}`);
    if (init.method === "GET") { metadata++; return Response.json({ id: "fixture-model", object: "model" }); }
    calls++; active++; peak = Math.max(peak, active);
    const receipt = JSON.parse(readFileSync(join(output, "receipt.json"), "utf8"));
    expect(receipt.type).toBe("started"); expect(receipt.budget.maxInferenceRequests).toBe(81);
    expect(receipt.request.acceptCharges).toBe(true); expect(receipt.accessCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const body = JSON.parse(init.body as string), expected = labels.get(body.input[1].content);
    let text = JSON.stringify({ label: expected, explanation: "Private fixture reply." });
    if (mode === "counterexample") text = calls === 1 ? JSON.stringify({ label: expected === "convex" ? "concave" : "convex", explanation: "Private wrong reply." }) : "Private malformed reply.";
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return Response.json({ model: "fixture-model", status: "completed", max_output_tokens: 4096, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }],
      usage: { input_tokens: 500, output_tokens: 40 } });
  });
  const args = ["--suite", "composition-v1", "--model", "fixture-model", "--credential-env", "TEST_KEY", "--output", output, "--accept-charges", "--concurrency", "2"];
  const options = { env: { TEST_KEY: credential }, out: (line: string) => logs.push(line), error: (line: string) => errors.push(line), inferenceClient, loadSuite: async () => suite };
  return { output, parent, args, options, logs, errors, get calls() { return calls; }, get metadata() { return metadata; }, get peak() { return peak; } };
}
const readView = (output: string) => JSON.parse(readFileSync(join(output, "run.json"), "utf8")) as RunView;

describe("terminal evaluation", () => {
  it("retains 81 fresh trials, including wrong valid and invalid replies, without claiming perfect accuracy", async () => {
    const fixture = harness("counterexample");
    expect(await runCli(fixture.args, fixture.options)).toBe(0);
    const view = readView(fixture.output), report = JSON.parse(readFileSync(join(fixture.output, "report.json"), "utf8"));
    expect(fixture.calls).toBe(81); expect(fixture.metadata).toBe(81); expect(fixture.peak).toBeLessThanOrEqual(2);
    expect(view.record.state).toBe("completed"); expect(view.record.results).toHaveLength(81);
    expect(view.record.evidence.trials.every(trial => trial.attempts.length === 1 && trial.finalAttempt === 1)).toBe(true);
    expect(view.record.report?.overall.classification).toMatchObject({ macroF1: 0, population: { plannedTrials: 81, includedTrials: 81, status: "complete" }, outcomes: { invalid: { numerator: 80 } } });
    expect(view.record.results[0].result.evidence.outcome.kind).toBe("answer");
    expect(report.id).toBe(view.record.report?.id); expect(view.publishedAt).toBeNull();
    const receipt = JSON.parse(readFileSync(join(fixture.output, "receipt.json"), "utf8"));
    const store = createRunStore({ path: join(fixture.output, "runs.sqlite") });
    try { expect(store.read(receipt.runId, receipt.accessCode)?.record.report?.id).toBe(report.id); expect(store.listPublic()).toEqual([]); }
    finally { store.close(); }
    for (const file of ["receipt.json", "run.json", "report.json", "runs.sqlite"]) expect(statSync(join(fixture.output, file)).mode & 0o777).toBe(0o600);
    expect(statSync(fixture.output).mode & 0o777).toBe(0o700);
    expect(fixture.logs.join()).not.toContain(receipt.accessCode); expect(fixture.logs.join()).not.toContain("Private");
    expect(JSON.stringify(view)).not.toContain(credential); expect(fixture.errors).toEqual([]);
  }, 30000);

  it("rejects absent consent, missing environment credentials, duplicate and unknown arguments before provider access", async () => {
    const fixture = harness();
    const invalid = [fixture.args.filter(arg => arg !== "--accept-charges"), [...fixture.args, "--model", "other"], [...fixture.args, "--key", credential],
      [...fixture.args, "--accept-charges"], fixture.args.map(arg => arg === "2" ? "13" : arg), fixture.args.map(arg => arg === "composition-v1" ? "reference-v1" : arg),
      fixture.args.filter((_, index) => index !== 4 && index !== 5), [...fixture.args, "--help"]];
    for (const args of invalid) expect(await runCli(args, fixture.options)).toBe(1);
    expect(await runCli(fixture.args, { ...fixture.options, env: {} })).toBe(1);
    expect(fixture.calls).toBe(0); expect(fixture.metadata).toBe(0); expect(existsSync(fixture.output)).toBe(false);
    expect(fixture.errors.join()).not.toContain(credential);
  });

  it("refuses existing directories, files, and symlinks without overwriting or calling the provider", async () => {
    for (const kind of ["directory", "file", "symlink"]) {
      const fixture = harness();
      if (kind === "directory") { const store = createRunStore({ path: join(fixture.output, "existing.sqlite") }); store.close(); }
      if (kind === "file") writeFileSync(fixture.output, "retained");
      if (kind === "symlink") symlinkSync(fixture.parent, fixture.output);
      expect(await runCli(fixture.args, fixture.options)).toBe(1);
      expect(fixture.calls).toBe(0); expect(fixture.metadata).toBe(0);
      if (kind === "file") expect(readFileSync(fixture.output, "utf8")).toBe("retained");
    }
  }, 30000);

  it("retains partial cancellation evidence and returns failure after SIGINT", async () => {
    const fixture = harness();
    const args = fixture.args.map(arg => arg === "2" ? "1" : arg);
    let interrupted = false;
    expect(await runCli(args, { ...fixture.options, out: line => {
      fixture.logs.push(line);
      if (!interrupted && JSON.parse(line).finishedTrials === 1) { interrupted = true; process.emit("SIGINT"); }
    } })).toBe(1);
    const view = readView(fixture.output);
    expect(fixture.calls).toBe(1); expect(view.record.state).toBe("cancelled");
    expect(view.record.progress).toMatchObject({ plannedTrials: 81, finishedTrials: 1, remainingTrials: 80 });
    expect(view.record.evidence.trials.filter(trial => trial.finalAttempt === null)).toHaveLength(80);
    expect(view.record.report?.overall.classification.population.status).toBe("provisional");
  }, 30000);

  it("retains safe infrastructure failure evidence without retries or raw exception messages", async () => {
    const fixture = harness("network");
    expect(await runCli(fixture.args.map(arg => arg === "2" ? "1" : arg), fixture.options)).toBe(1);
    const view = readView(fixture.output);
    expect(fixture.calls).toBe(0); expect(view.record.state).toBe("failed");
    expect(view.record.progress).toMatchObject({ startedTrials: 1, finishedTrials: 1, remainingTrials: 80, infrastructureFailures: 1 });
    expect(view.record.report?.overall.classification.population.status).toBe("unavailable");
    expect(JSON.stringify(view)).not.toContain(credential); expect([...fixture.logs, ...fixture.errors].join()).not.toContain(credential);
  }, 30000);

  it("exports the retained failed record when terminal persistence throws, without repeating inference", async () => {
    const fixture = harness();
    expect(await runCli(fixture.args, { ...fixture.options, createStore: options => {
      const store = createRunStore(options);
      return { ...store, save: record => { if (record.state === "completed") throw new Error(credential); return store.save(record); } };
    } })).toBe(1);
    const view = readView(fixture.output);
    expect(fixture.calls).toBe(81); expect(view.record.state).toBe("failed");
    expect(view.record.results).toHaveLength(81); expect(view.record.report).toBeNull();
    expect(readFileSync(join(fixture.output, "report.json"), "utf8")).toBe("null\n");
    expect([...fixture.logs, ...fixture.errors].join()).not.toContain(credential);
  }, 30000);

  it("does not dispatch if the private start receipt cannot be written", async () => {
    const fixture = harness();
    expect(await runCli(fixture.args, { ...fixture.options, createStore: options => {
      writeFileSync(join(fixture.output, "receipt.json"), "preserve-existing-receipt");
      return createRunStore(options);
    } })).toBe(1);
    expect(fixture.calls).toBe(0); expect(fixture.metadata).toBe(0);
    expect(readFileSync(join(fixture.output, "receipt.json"), "utf8")).toBe("preserve-existing-receipt");
    expect(readView(fixture.output).record.state).toBe("cancelled");
  }, 30000);

  it("flushes the receipt before both directory entries and stops before provider access if either sync fails", async () => {
    for (const failAt of [1, 2]) {
      const fixture = harness(), synced: string[] = [];
      expect(await runCli(fixture.args, { ...fixture.options, syncDirectory: path => {
        expect(JSON.parse(readFileSync(join(fixture.output, "receipt.json"), "utf8")).type).toBe("started");
        synced.push(path);
        if (synced.length === failAt) throw new Error(credential);
      } })).toBe(1);
      expect(synced).toEqual([fixture.output, fixture.parent].slice(0, failAt));
      expect(fixture.calls).toBe(0); expect(fixture.metadata).toBe(0);
      expect(readView(fixture.output).record.state).toBe("cancelled");
      expect(fixture.errors.join()).toContain("No provider requests were started");
      expect([...fixture.logs, ...fixture.errors].join()).not.toContain(credential);
    }
  }, 30000);

  it("checks credential reflection, suite failure, pre-cancellation, and safe setup exceptions before dispatch", async () => {
    const fixture = harness();
    expect(await runCli(fixture.args.map(arg => arg === "fixture-model" ? credential : arg), fixture.options)).toBe(1);
    expect(await runCli(fixture.args, { ...fixture.options, loadSuite: async () => { throw new Error(credential); } })).toBe(1);
    expect(await runCli(fixture.args, { ...fixture.options, signal: AbortSignal.abort() })).toBe(1);
    expect(existsSync(fixture.output)).toBe(false);
    expect(await runCli(fixture.args, { ...fixture.options, createStore: () => { throw new Error(credential); } })).toBe(1);
    expect(fixture.calls).toBe(0); expect([...fixture.logs, ...fixture.errors].join()).not.toContain(credential);
  });

  it("shows offline help without loading suites or reading credentials", async () => {
    const lines: string[] = [];
    expect(await runCli(["--help"], { env: {}, out: line => lines.push(line), loadSuite: async () => { throw new Error("must not load"); } })).toBe(0);
    expect(lines.join()).toContain("81 maximum inference requests"); expect(lines.join()).toContain("--credential-env");
  });
});
