// Exercise the real offline command's privacy, file bounds, and immutable output boundary.
import { beforeAll, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureRun } from "./fixtures";
import { MAX_AUDIT_INPUT_BYTES } from "./audit-cli";

let fixture: Awaited<ReturnType<typeof fixtureRun>>;
beforeAll(async () => { fixture = await fixtureRun(); });

async function command(args: string[]) {
  const child = Bun.spawn([process.execPath, new URL("audit-cli.ts", import.meta.url).pathname, ...args], {
    env: { PATH: process.env.PATH ?? "" }, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exit };
}

it("audits a retained private export offline and writes only safe findings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coconut-audit-cli-"));
  try {
    const input = join(dir, "run.json"), output = join(dir, "audit.json");
    await writeFile(input, JSON.stringify({ record: fixture, publishedAt: null }));
    const result = await command(["run", "--input", input, "--output", output]);
    expect(result.exit).toBe(0); expect(result.stderr).toBe("");
    const report = JSON.parse(await readFile(output, "utf8"));
    expect(report.denominators.validCorrect).toBe(9);
    expect(JSON.parse(result.stdout)).toEqual({ id: report.id, verdict: report.gate.verdict, blockers: report.gate.blockers.length });
    expect(JSON.stringify(report)).not.toContain("Controlled fixture.");
    expect(JSON.stringify(report)).not.toContain("rawText");
    expect((await stat(output)).mode & 0o777).toBe(0o600);
    const first = await readFile(output, "utf8");
    const repeat = await command(["run", "--input", input, "--output", output]);
    expect(repeat.exit).toBe(1); expect(repeat.stderr).toContain("cannot be overwritten");
    expect(await readFile(output, "utf8")).toBe(first);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 30000);

it("audits a suite without a run and preserves unavailable live claims", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coconut-audit-suite-"));
  try {
    const input = join(dir, "suite.json"), output = join(dir, "audit.json");
    await writeFile(input, JSON.stringify(fixture.suite));
    const result = await command(["suite", "--input", input, "--output", output]);
    expect(result.exit).toBe(0);
    const report = JSON.parse(await readFile(output, "utf8"));
    expect(report.suiteId).toBe(fixture.suite.id);
    expect(report.population.cases).toBe(3);
    expect(report.signal).toBeUndefined();
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 30000);

it("rejects malformed, non-UTF8, oversized and non-file inputs without echoing diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coconut-audit-input-"));
  try {
    const input = join(dir, "input.json"), output = join(dir, "audit.json");
    for (const contents of ["private-provider-diagnostic", new Uint8Array([0xc3, 0x28])]) {
      await writeFile(input, contents);
      const result = await command(["run", "--input", input, "--output", output]);
      expect(result.exit).toBe(1); expect(result.stderr).not.toContain("private-provider-diagnostic");
    }
    await truncate(input, MAX_AUDIT_INPUT_BYTES + 1);
    expect((await command(["run", "--input", input, "--output", output])).exit).toBe(1);
    expect((await command(["run", "--input", dir, "--output", output])).exit).toBe(1);
    await writeFile(input, JSON.stringify({ record: { version: "private-diagnostic" } }));
    const invalid = await command(["run", "--input", input, "--output", output]);
    expect(invalid.exit).toBe(1); expect(invalid.stderr).not.toContain("private-diagnostic");
    expect(await Bun.file(output).exists()).toBe(false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("rejects missing, unknown and repeated flags before reading files", async () => {
  for (const args of [[], ["unknown"], ["run"], ["run", "--input"], ["run", "--input", "a", "--input", "b", "--output", "c"], ["run", "--input", "a", "--output", "c", "--key", "private-diagnostic"]]) {
    const result = await command(args);
    expect(result.exit).toBe(1); expect(result.stderr).toContain("Usage:"); expect(result.stderr).not.toContain("private-diagnostic");
  }
});
