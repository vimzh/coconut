// Exercise the actual Bun CLI process and its artifact file boundary.
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
const request = {
  seed: "cli-test-v1", depths: [5], casesPerClass: 1,
  profileId: "one-shot-json-v1", purpose: "illustration",
};
let directory: string;

async function run(...args: string[]) {
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    cwd: directory, stdout: "pipe", stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function writeRequest(value: unknown = request): Promise<string> {
  const path = join(directory, "request.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "coconut-suite-cli-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("suite CLI", () => {
  it("generates compact JSON, then verifies identity and coverage through replay", async () => {
    const output = join(directory, "suite.json");
    const requestPath = await writeRequest();
    const generated = await run("generate", "--request", requestPath, "--output", output);
    expect(generated.exitCode).toBe(0);
    expect(generated.stderr).toBe("");
    const contents = await readFile(output, "utf8");
    const suite = JSON.parse(contents);
    expect(contents).toBe(`${JSON.stringify(suite)}\n`);
    expect(suite.request).toEqual(request);
    expect(suite.summary.accepted).toBe(3);
    expect(suite.summary.coverage).toHaveLength(3);
    expect(JSON.parse(generated.stdout)).toEqual({ id: suite.id, summary: suite.summary });

    const verified = await run("verify", "--input", output);
    expect(verified.exitCode).toBe(0);
    expect(verified.stderr).toBe("");
    expect(JSON.parse(verified.stdout)).toEqual({ id: suite.id, summary: suite.summary });

    suite.summary.accepted++;
    await writeFile(output, JSON.stringify(suite));
    const altered = await run("verify", "--input", output);
    expect(altered.exitCode).toBe(1);
    expect(altered.stdout).toBe("");
    expect(altered.stderr).toContain("Suite CLI failed:");
  });

  it("refuses to overwrite an existing file", async () => {
    const output = join(directory, "suite.json");
    const original = "retained existing content\n";
    await writeFile(output, original);
    const result = await run("generate", "--output", output, "--request", await writeRequest());
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("existing files cannot be overwritten");
    expect(await readFile(output, "utf8")).toBe(original);
  });

  it("rejects missing, repeated, unknown, and misplaced arguments", async () => {
    const invalidArguments = [
      [], ["unknown"], ["generate"], ["verify"],
      ["generate", "--output"], ["verify", "--input", ""],
      ["generate", "--input", "suite.json"],
      ["verify", "--input", "suite.json", "--request", "request.json"],
      ["generate", "--output", "suite.json", "--output", "another.json"],
      ["generate", "--output", "--unknown"],
      ["generate", "--output", "suite.json", "unexpected"],
    ];
    for (const args of invalidArguments) {
      const result = await run(...args);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Usage:");
    }
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects malformed request and suite JSON without writing a suite", async () => {
    const input = join(directory, "malformed.json");
    await writeFile(input, "{invalid JSON");
    for (const args of [
      ["generate", "--output", join(directory, "suite.json"), "--request", input],
      ["verify", "--input", input],
    ]) {
      const result = await run(...args);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Cannot read JSON file "${input}"`);
    }
    expect(await readdir(directory)).toEqual(["malformed.json"]);
  });

  it("fails clearly for missing files and invalid request or suite data", async () => {
    const input = join(directory, "missing.json");
    const missing = await run("verify", "--input", input);
    expect(missing.exitCode).toBe(1);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain(`Cannot read JSON file "${input}"`);

    const invalid = await writeRequest({ ...request, depths: [] });
    const generated = await run("generate", "--output", join(directory, "suite.json"), "--request", invalid);
    expect(generated.exitCode).toBe(1);
    expect(generated.stdout).toBe("");
    expect(generated.stderr).toContain("Suite CLI failed:");
    const verified = await run("verify", "--input", invalid);
    expect(verified.exitCode).toBe(1);
    expect(verified.stdout).toBe("");
    expect(verified.stderr).toContain("Suite CLI failed:");
    expect(await readdir(directory)).toEqual(["request.json"]);
  });
});
