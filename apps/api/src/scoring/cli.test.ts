// Exercise scoring through the actual Bun process and its JSON file boundary.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, readdir, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractAnswer } from "../protocol";
import { generateSuite } from "../suites";
import type { FrozenSuite } from "../suites";
import type { RunEvidence } from "./types";
import { MAX_SCORING_INPUT_BYTES } from "./cli";

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
let suite: FrozenSuite;
let directory: string;

function fixtureRunEvidence(answered = true): RunEvidence {
  return {
    runId: "scoring-cli-fixture-v1",
    suiteId: suite.id,
    protocolVersion: "1",
    profileId: suite.request.profileId,
    model: { provider: "fixture", modelId: "fixture-model", endpointId: "fixture-endpoint", settingsId: "fixture-settings" },
    run: { elapsedMs: null, concurrency: null },
    expressionTokens: [],
    trials: suite.cases.flatMap((entry) => Array.from({ length: 3 }, (_, trialIndex) => ({
      caseId: entry.id,
      trialIndex,
      finalAttempt: answered ? 1 : null,
      elapsedMs: null,
      attempts: answered ? [{
        sequence: 1,
        outcome: extractAnswer({
          status: "completed",
          text: JSON.stringify({ label: entry.label, explanation: "Controlled fixture answer." }),
        }, suite.request.profileId),
        errorKind: null,
        elapsedMs: null,
        usage: { input: null, output: null, reasoning: null },
        cost: null,
      }] : [],
    }))),
  };
}

async function run(...args: string[]) {
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    cwd: directory, stdout: "pipe", stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function writeInput(value: unknown = { suite, evidence: fixtureRunEvidence() }): Promise<string> {
  const path = join(directory, "input.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

beforeAll(async () => {
  const generated = await generateSuite({
    seed: "scoring-cli-test-v1", depths: [5], casesPerClass: 1,
    profileId: "one-shot-json-v1", purpose: "evaluation",
  });
  if (generated.status !== "complete") throw new Error("Scoring CLI fixture suite did not complete.");
  suite = generated.suite;
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "coconut-scoring-cli-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("scoring CLI", () => {
  it("writes a compact JSON report and prints its score and identity", async () => {
    const output = join(directory, "report.json");
    const result = await run("--input", await writeInput(), "--output", output);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const contents = await readFile(output, "utf8");
    const report = JSON.parse(contents);
    expect(contents).toBe(`${JSON.stringify(report)}\n`);
    expect(report.overall.classification.macroF1).toBe(1);
    expect(report.byDepth).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toEqual({
      id: report.id,
      status: report.overall.classification.population.status,
      macroF1: 1,
    });
  });

  it("reports explicit unattempted trials as an unavailable score", async () => {
    const output = join(directory, "report.json");
    const input = await writeInput({ suite, evidence: fixtureRunEvidence(false) });
    const result = await run("--output", output, "--input", input);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(await readFile(output, "utf8"));
    expect(report.overall.classification.macroF1).toBeNull();
    expect(JSON.parse(result.stdout)).toEqual({ id: report.id, status: "unavailable", macroF1: null });
  });

  it("refuses to overwrite an existing file", async () => {
    const output = join(directory, "report.json");
    const original = "retained existing content\n";
    await writeFile(output, original);
    const result = await run("--input", await writeInput(), "--output", output);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("existing files cannot be overwritten");
    expect(await readFile(output, "utf8")).toBe(original);
  });

  it("rejects missing, repeated, unknown, and misplaced arguments", async () => {
    const invalidArguments = [
      [], ["unknown"], ["--input"], ["--output"],
      ["--input", ""], ["--input", "input.json"], ["--output", "report.json"],
      ["--input", "input.json", "--unknown", "report.json"],
      ["--input", "input.json", "--input", "other.json", "--output", "report.json"],
      ["--input", "input.json", "--output", "report.json", "--output", "other.json"],
      ["--input", "--output", "report.json"],
      ["--input", "input.json", "--output", "report.json", "unexpected"],
    ];
    for (const args of invalidArguments) {
      const result = await run(...args);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Usage:");
    }
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects malformed JSON and unreadable files without creating a report", async () => {
    const malformed = join(directory, "malformed.json");
    await writeFile(malformed, "{invalid JSON");
    for (const input of [malformed, join(directory, "missing.json")]) {
      const result = await run("--input", input, "--output", join(directory, "report.json"));
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Cannot read JSON file "${input}"`);
    }
    expect(await readdir(directory)).toEqual(["malformed.json"]);
  });

  it("rejects oversized files before loading or parsing their contents", async () => {
    const input = join(directory, "oversized.json");
    await writeFile(input, "");
    await truncate(input, MAX_SCORING_INPUT_BYTES + 1);
    const result = await run("--input", input, "--output", join(directory, "report.json"));
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("byte file limit");
    expect(await readdir(directory)).toEqual(["oversized.json"]);
  });

  it("rejects invalid UTF-8 without repairing identity strings", async () => {
    const input = join(directory, "invalid-utf8.json");
    const bytes = Buffer.from(JSON.stringify({ suite, evidence: fixtureRunEvidence() }));
    bytes[bytes.indexOf("fixture-model")] = 0xff;
    await writeFile(input, bytes);
    const result = await run("--input", input, "--output", join(directory, "report.json"));
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Cannot read JSON file");
    expect(await readdir(directory)).toEqual(["invalid-utf8.json"]);
  });

  it("rejects empty envelopes, wrong identities, and missing trial records without creating a report", async () => {
    const evidence = fixtureRunEvidence();
    const invalidInputs = [
      {},
      { suite, evidence: { ...evidence, trials: [] } },
      { suite, evidence: { ...evidence, suiteId: "wrong-suite" } },
      { suite, evidence: { ...evidence, trials: evidence.trials.slice(1) } },
    ];
    for (const value of invalidInputs) {
      const result = await run("--input", await writeInput(value), "--output", join(directory, "report.json"));
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Scoring CLI failed:");
    }
    expect(await readdir(directory)).toEqual(["input.json"]);
  });
});
