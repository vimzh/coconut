// Offline CLI checks bind generation, replay, strict inputs, and nonreplacement behavior.
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./composition-suite";

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function harness() {
  const directory = mkdtempSync(join(tmpdir(), "coconut-suite-cli-")); directories.push(directory);
  const output = join(directory, "suite.json"), logs: string[] = [], errors: string[] = [];
  return { output, logs, errors, options: { out: (line: string) => logs.push(line), error: (line: string) => errors.push(line) } };
}

describe("composition suite terminal commands", () => {
  it("generates, fully replays, and refuses to replace the fixed certified population", async () => {
    const fixture = harness();
    expect(await runCli(["generate", "--output", fixture.output], fixture.options)).toBe(0);
    const retained = readFileSync(fixture.output, "utf8"), suite = JSON.parse(retained);
    expect(suite.generatorVersion).toBe("composition-v1"); expect(suite.cases).toHaveLength(27);
    expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(0);
    expect(JSON.parse(fixture.logs[0]).id).toBe(JSON.parse(fixture.logs[1]).id);
    expect(await runCli(["generate", "--output", fixture.output], fixture.options)).toBe(1);
    expect(readFileSync(fixture.output, "utf8")).toBe(retained);
    suite.cases[0].stageCount = 100; writeFileSync(fixture.output, JSON.stringify(suite));
    expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(1);
  }, 30000);

  it("uses a separately certified identity for an explicit supported profile", async () => {
    const fixture = harness();
    expect(await runCli(["generate", "--output", fixture.output, "--profile", "one-shot-json-v2-high"], fixture.options)).toBe(0);
    const suite = JSON.parse(readFileSync(fixture.output, "utf8"));
    expect(suite.request.profileId).toBe("one-shot-json-v2-high"); expect(suite.cases).toHaveLength(27);
    expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(0);
  }, 30000);

  it("rejects missing, duplicate, unsupported, and malformed arguments", async () => {
    const fixture = harness();
    for (const args of [[], ["generate"], ["verify"], ["generate", "--output"], ["generate", "--input", fixture.output],
      ["generate", "--output", fixture.output, "--output", fixture.output], ["verify", "--input", fixture.output, "--profile", "one-shot-json-v1"],
      ["generate", "--output", fixture.output, "--profile", "unknown"], ["--help", "--output", fixture.output]]) expect(await runCli(args, fixture.options)).toBe(1);
  });

  it("rejects oversized, invalid JSON, invalid UTF-8 and missing input safely", async () => {
    const fixture = harness();
    expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(1);
    for (const bytes of [Buffer.from("{invalid-private-input"), Buffer.from([0xff])]) {
      writeFileSync(fixture.output, bytes); expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(1);
    }
    truncateSync(fixture.output, 32 * 1024 * 1024 + 1);
    expect(await runCli(["verify", "--input", fixture.output], fixture.options)).toBe(1);
    expect(fixture.errors.join()).not.toContain("invalid-private-input");
  });

  it("provides help without a native runtime or input artifact", async () => {
    const fixture = harness();
    expect(await runCli(["--help"], fixture.options)).toBe(0);
    expect(fixture.logs.join()).toContain("No model calls"); expect(fixture.errors).toEqual([]);
  });
});
