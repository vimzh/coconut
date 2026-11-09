// Offline transport fixtures verify authorization ordering, private evidence, and complete score denominators.
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInferenceClient, type InferenceResult } from "../../apps/api/src/inference";
import { sha256 } from "../../apps/api/src/quality/data";
import { buildTaskEvaluationReport, runTaskEvaluation, type TaskEvaluationOptions, type TaskEvaluationRow } from "./evaluation";
import type { TasksArtifact, ImportedCase } from "./types";

const credential = "exact-file-fixture-credential-abcdefghijkl";
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const cases: ImportedCase[] = ["convex", "concave", "neither"].map((label, index) => ({ id: `fixture-${index}`, label: label as ImportedCase["label"],
  expression: ["x^2", "-x^2", "x^3"][index], domain: { min: "-1", max: "1" }, referenceSha256: "a".repeat(64), coreHashes: ["b".repeat(64)],
  requestedDepth: index === 2 ? 2 : 1, actualDepth: index === 2 ? 2 : 1, astDepth: 2, nonlinearPath: 1, nodeCount: 3 }));
const tasks = { version: "1", policy: "configurable-import-tasks-v1", id: "offline-fixture", state: "complete",
  request: { depths: [1, 2], casesPerDepth: 3, seed: 42, maxBatches: 2 }, domain: { min: "-1", max: "1" },
  provenance: { source: {}, implementation: {}, permissions: "private-local-only-export-permissions-unresolved" },
  cases, references: {}, batches: [], ledger: [], failure: null } satisfies TasksArtifact;

function fixture(mode: "correct" | "wrong" | "invalid" | "network" | "reflection" | "auth" = "correct") {
  const parent = mkdtempSync(join(tmpdir(), "coconut-exact-eval-")); directories.push(parent);
  const output = join(parent, "run"), logs: string[] = [], errors: string[] = [];
  let sends = 0, metadata = 0, active = 0, peak = 0;
  const inferenceClient = createInferenceClient(async (_url, init) => {
    expect(existsSync(join(output, "manifest.json"))).toBe(true);
    const dispatches = readdirSync(output).filter(name => name.startsWith("dispatch-"));
    expect(dispatches.length).toBeGreaterThan(0);
    const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
    for (const name of dispatches) expect(JSON.parse(readFileSync(join(output, name), "utf8")).manifestSha256).toBe(sha256(manifest));
    if (init.method === "GET") { metadata++; return mode === "auth" ? Response.json({ error: { message: "rejected" } }, { status: 401 })
      : Response.json({ id: "arbitrary-exact-model", object: "model" }); }
    sends++; active++; peak = Math.max(active, peak);
    if (mode === "network") { active--; throw new Error(credential); }
    const body = JSON.parse(init.body as string);
    expect(body.input[0].content).toContain("Use well-formed Unicode in the explanation.");
    const task = cases.find(task => body.input[1].content.startsWith(`f(x) = ${task.expression}\n`))!;
    const text = mode === "invalid" ? "invalid JSON" : JSON.stringify({ label: mode === "wrong" ? task.label === "convex" ? "concave" : "convex" : task.label,
      explanation: mode === "reflection" ? credential : "Fixture explanation." });
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return Response.json({ model: "arbitrary-exact-model", status: "completed", max_output_tokens: body.max_output_tokens, truncation: "disabled",
      ...(body.reasoning ? { reasoning: body.reasoning } : {}), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }],
      usage: { input_tokens: 23, output_tokens: 15 } });
  });
  const options: TaskEvaluationOptions = { env: { FIXTURE_KEY: credential }, loadTasks: async () => tasks, inferenceClient,
    out: message => logs.push(message), error: message => errors.push(message) };
  const args = ["--input", join(parent, "tasks.json"), "--model", "arbitrary-exact-model", "--credential-env", "FIXTURE_KEY", "--output", output, "--accept-charges"];
  return { parent, output, logs, errors, options, args, get sends() { return sends; }, get metadata() { return metadata; }, get peak() { return peak; } };
}
const json = (output: string, name: string) => JSON.parse(readFileSync(join(output, name), "utf8"));

describe("exact-file terminal evaluation", () => {
  it("retains all trials, binds durable receipts before metadata and inference, and preserves settings/usage", async () => {
    const f = fixture();
    expect(await runTaskEvaluation([...f.args, "--trials", "2", "--concurrency", "2", "--profile", "one-shot-json-v2-low"], f.options)).toBe(0);
    expect(f.sends).toBe(6); expect(f.metadata).toBe(6); expect(f.peak).toBeLessThanOrEqual(2);
    const manifest = json(f.output, "manifest.json"), run = json(f.output, "run.json"), report = json(f.output, "report.json");
    expect(manifest.requests.every((request: { prompt: { messages: { content: string }[] } }) =>
      request.prompt.messages[0].content.includes("Use well-formed Unicode in the explanation."))).toBe(true);
    expect(manifest.profile.reasoning).toBe("low"); expect(manifest.budget).toMatchObject({ maxInferenceRequests: 6, retries: 0, inferenceTimeoutMs: 180000 });
    expect(run.rows).toHaveLength(6); expect(run.rows.every((row: TaskEvaluationRow) => row.result?.evidence.usage?.input?.count === 23)).toBe(true);
    expect(report.overall.classification).toMatchObject({ accuracy: { numerator: 6, denominator: 6, value: 1 }, population: { plannedTrials: 6, status: "complete" } });
    expect(report.overall.classification.trials).toHaveLength(2); expect(report.byRequestedDepth).toHaveLength(2);
    expect(report.rowsSha256).toBe(sha256(run.rows)); expect(run.manifestSha256).toBe(sha256(manifest));
    expect(statSync(f.output).mode & 0o777).toBe(0o700);
    for (const name of readdirSync(f.output)) {
      expect(statSync(join(f.output, name)).mode & 0o777).toBe(0o600);
      expect(readFileSync(join(f.output, name), "utf8")).not.toContain(credential);
    }
    expect(f.errors).toEqual([]);
  });

  it("counts wrong valid and invalid replies as completed zero accuracy", async () => {
    for (const mode of ["wrong", "invalid"] as const) {
      const f = fixture(mode);
      expect(await runTaskEvaluation(f.args, f.options)).toBe(0);
      expect(json(f.output, "report.json").overall.classification).toMatchObject({ accuracy: { value: 0, denominator: 3 }, population: { status: "complete" } });
    }
  });

  it("rejects unknown/duplicate flags, missing consent, invalid trials/concurrency, and missing credentials before provider access", async () => {
    const f = fixture();
    for (const args of [[...f.args, "--key", credential], [...f.args, "--model", "other"], [...f.args, "--trials", "0"], [...f.args, "--trials", "11"],
      [...f.args, "--concurrency", "13"], [...f.args, "--profile", "unknown"], f.args.filter(value => value !== "--accept-charges")]) {
      expect(await runTaskEvaluation(args, f.options)).toBe(1);
    }
    expect(await runTaskEvaluation(f.args, { ...f.options, env: {} })).toBe(1);
    expect(f.metadata).toBe(0); expect(f.sends).toBe(0); expect(existsSync(f.output)).toBe(false);
    expect(f.errors.join()).not.toContain(credential);
  });

  it("rejects failed artifact replay, excess budgets, existing output, and failed directory sync without metadata", async () => {
    const f = fixture();
    expect(await runTaskEvaluation(f.args, { ...f.options, loadTasks: async () => { throw new Error(credential); } })).toBe(1);
    expect(await runTaskEvaluation([...f.args, "--trials", "10"], { ...f.options, loadTasks: async () => ({ ...tasks, cases: Array.from({ length: 1001 }, () => cases[0]) }) })).toBe(1);
    writeFileSync(f.output, "do not overwrite");
    expect(await runTaskEvaluation(f.args, f.options)).toBe(1); expect(readFileSync(f.output, "utf8")).toBe("do not overwrite");
    const g = fixture();
    expect(await runTaskEvaluation(g.args, { ...g.options, syncDirectory: () => { throw new Error(credential); } })).toBe(1);
    expect(f.metadata + g.metadata).toBe(0); expect(f.sends + g.sends).toBe(0);
  });

  it("retains infrastructure failures separately from model accuracy without retries", async () => {
    const f = fixture("network");
    expect(await runTaskEvaluation(f.args, f.options)).toBe(1);
    const report = json(f.output, "report.json");
    expect(f.sends).toBe(3); expect(report.overall.infrastructureFailures).toBe(3);
    expect(report.overall.classification.population).toMatchObject({ plannedTrials: 3, includedTrials: 0, excludedTrials: 3, status: "unavailable" });
    expect(report.overall.classification.accuracy.value).toBeNull();
  });

  it("stops new authorizations after an infrastructure failure and distinguishes metadata from inference sends", async () => {
    for (const mode of ["network", "auth"] as const) {
      const f = fixture(mode);
      expect(await runTaskEvaluation([...f.args, "--trials", "3", "--concurrency", "2"], f.options)).toBe(1);
      const report = json(f.output, "report.json"), run = json(f.output, "run.json");
      expect(f.metadata).toBeLessThanOrEqual(2); expect(f.sends).toBeLessThanOrEqual(2);
      expect(report.overall.authorized).toBeLessThanOrEqual(2); expect(report.overall.unattempted).toBeGreaterThanOrEqual(7);
      expect(report.overall.inferenceRequests.known).toBe(mode === "auth" ? 0 : f.sends);
      expect(run.cancelled).toBe(false);
    }
  });

  it("does not reach metadata when a dispatch authorization cannot be synced", async () => {
    const f = fixture();
    let syncs = 0;
    expect(await runTaskEvaluation(f.args, { ...f.options, syncDirectory: () => {
      if (++syncs === 3) throw new Error(credential);
    } })).toBe(1);
    expect(f.metadata).toBe(0); expect(f.sends).toBe(0);
    expect(json(f.output, "report.json").overall).toMatchObject({ authorized: 0, unattempted: 3 });
  });

  it("cancels active work, preserves unknown dispatched outcomes and unattempted rows", async () => {
    const f = fixture(), abort = new AbortController();
    expect(await runTaskEvaluation([...f.args, "--concurrency", "1"], { ...f.options, signal: abort.signal,
      inferenceClient: async () => { abort.abort(); throw new Error(credential); } })).toBe(1);
    const report = json(f.output, "report.json"), run = json(f.output, "run.json");
    expect(report.overall).toMatchObject({ planned: 3, authorized: 1, unknownRemoteOutcomes: 1, unattempted: 2 });
    expect(run.rows[0].localFailure).toBe("outcome-not-retained"); expect(run.rows[0].result).toBeNull();
    expect(JSON.stringify(run)).not.toContain(credential); expect(f.errors.join()).not.toContain(credential);
  });

  it("rejects reflected credentials and mismatched request bindings while retaining unknown authorization", async () => {
    for (const mode of ["reflection", "binding"] as const) {
      const f = fixture(mode === "reflection" ? mode : "correct");
      const original = f.options.inferenceClient!;
      expect(await runTaskEvaluation([...f.args, "--concurrency", "1"], { ...f.options, inferenceClient: async (...args) => {
        const result = await original(...args);
        return mode === "binding" ? { ...result, requested: { ...result.requested, modelId: "substituted" } } : result;
      } })).toBe(1);
      expect(json(f.output, "report.json").overall).toMatchObject(mode === "reflection"
        ? { authorized: 1, infrastructureFailures: 1, unattempted: 2 }
        : { authorized: 1, unknownRemoteOutcomes: 1, unattempted: 2 });
      for (const name of readdirSync(f.output)) expect(readFileSync(join(f.output, name), "utf8")).not.toContain(credential);
    }
  });

  it("reports deterministic full planned populations for wrong, invalid, infrastructure, and unattempted rows", () => {
    const outcome = (kind: "answer" | "invalid" | "provider-error") => kind === "answer" ? { kind, label: "concave", explanation: "wrong" }
      : kind === "invalid" ? { kind, reason: "malformed-json" } : { kind, message: "Unavailable" };
    const rows: TaskEvaluationRow[] = cases.flatMap(task => [0, 1].map(trialIndex => ({ caseId: task.id, trialIndex, requestSha256: "a".repeat(64),
      dispatch: task.id === "fixture-2" ? null : { authorizedAt: "2026-01-01T00:00:00.000Z", remoteOutcomeUntilRetained: "unknown" },
      result: task.id === "fixture-2" ? null : { failure: task.id === "fixture-1" ? { remoteOutcome: "not-sent" } : null,
        evidence: { outcome: { protocolVersion: "1", profileId: "one-shot-json-v1", rawText: "", ...outcome(task.id === "fixture-1" ? "provider-error" : trialIndex ? "invalid" : "answer") } } } as InferenceResult,
      localFailure: null })));
    const report = buildTaskEvaluationReport(cases, rows, 2);
    expect(report).toEqual(buildTaskEvaluationReport(cases, structuredClone(rows), 2));
    expect(report.overall).toMatchObject({ planned: 6, unattempted: 2, infrastructureFailures: 2 });
    expect(report.overall.classification).toMatchObject({ accuracy: { numerator: 0, denominator: 2, value: 0 }, population: { excludedTrials: 4, status: "provisional" } });
    expect(report.overall.classification.trials).toHaveLength(2);
    expect(() => buildTaskEvaluationReport(cases, rows.slice(1), 2)).toThrow();
  });
});
