// Exercise real CLI boundaries: safe creation, replay, malformed inputs and overwrite protection.
import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function command(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, new URL("cli.ts", import.meta.url).pathname, ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exit };
}

it("creates and replays an interior artifact, refusing tampering and existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coconut-interior-"));
  try {
    const output = join(directory, "screening.json");
    const args = ["generate", "--output", output];
    const generated = await command(args);
    expect(generated.exit).toBe(0);
    const original = await readFile(output, "utf8");
    const verified = await command(["verify", "--input", output]);
    expect(verified.exit).toBe(0);
    expect(JSON.parse(verified.stdout).id).toBe(JSON.parse(generated.stdout).id);
    const repeated = await command(args);
    expect(repeated.exit).toBe(1);
    expect(repeated.stderr).toContain("EEXIST");
    expect(await readFile(output, "utf8")).toBe(original);
    const altered = JSON.parse(original);
    altered.cases[0].analyticCertificate.label = "neither";
    await writeFile(output, JSON.stringify(altered));
    expect((await command(["verify", "--input", output])).exit).toBe(1);
    await writeFile(output, new Uint8Array([0xc3, 0x28]));
    expect((await command(["verify", "--input", output])).exit).toBe(1);
    for (const invalid of [[], ["verify"], ["generate", "--output", output, "--population", "confirmation"],
      ["generate", "--output", output, "--output", output], ["verify", "--input", output, "--profile", "one-shot-json-v1"]]) {
      expect((await command(invalid)).exit).toBe(1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
