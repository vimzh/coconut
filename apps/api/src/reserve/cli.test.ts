// Exercise offline CLI creation, full replay, strict decoding and file-size boundaries.
import { expect, it } from "bun:test";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function command(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, new URL("cli.ts", import.meta.url).pathname, ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exit };
}

it("creates and fully replays a profile-bound reserve artifact without overwriting files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coconut-reserve-"));
  try {
    const output = join(directory, "reserve.json");
    const args = ["generate", "--profile", "one-shot-json-v2-max", "--output", output];
    const generated = await command(args);
    expect(generated.exit).toBe(0);
    expect(JSON.parse(generated.stdout).request.profileId).toBe("one-shot-json-v2-max");
    const original = await readFile(output, "utf8"), verified = await command(["verify", "--input", output]);
    expect(verified.exit).toBe(0);
    expect(JSON.parse(verified.stdout).id).toBe(JSON.parse(generated.stdout).id);
    const repeated = await command(args);
    expect(repeated.exit).toBe(1);
    expect(repeated.stderr).toContain("EEXIST");
    expect(await readFile(output, "utf8")).toBe(original);
    const altered = JSON.parse(original);
    altered.cases[0].analyticCertificate.label = "neither";
    await writeFile(output, JSON.stringify(altered));
    const tampered = await command(["verify", "--input", output]);
    expect(tampered.exit).toBe(1);
    expect(tampered.stderr).toContain("reproduction");
    await writeFile(output, new Uint8Array([0xc3, 0x28]));
    const malformed = await command(["verify", "--input", output]);
    expect(malformed.exit).toBe(1);
    expect(malformed.stderr).toMatch(/utf|encod|byte/i);
    const oversized = await open(output, "w");
    try { await oversized.truncate(32 * 1024 * 1024 + 1); } finally { await oversized.close(); }
    const bounded = await command(["verify", "--input", output]);
    expect(bounded.exit).toBe(1);
    expect(bounded.stderr).toContain("32 MiB");
    for (const invalid of [[], ["verify"], ["generate"], ["generate", "--output", output, "--population", "confirmation"], ["generate", "--output", output, "--output", output], ["generate", "--profile", "unknown", "--output", output], ["verify", "--input", output, "--profile", "one-shot-json-v1"]]) expect((await command(invalid)).exit).toBe(1);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60000);
