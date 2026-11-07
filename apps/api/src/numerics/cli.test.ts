// Exercise artifact creation, replay, and overwrite protection through the real numerical CLI.
import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_NUMERICAL_REQUEST } from "./suite";

async function command(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, new URL("cli.ts", import.meta.url).pathname, ...args], {
    stdin: "ignore", stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exit };
}

it("generates and replays numerical artifacts and refuses altered or existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coconut-numerics-"));
  try {
    const request = join(directory, "request.json"), output = join(directory, "suite.json");
    await writeFile(request, JSON.stringify({ ...DEFAULT_NUMERICAL_REQUEST, depths: [7], casesPerClass: 1 }));
    const generated = await command(["generate", "--request", request, "--output", output]);
    expect(generated.exit).toBe(0);
    const original = await readFile(output, "utf8");
    const verified = await command(["verify", "--input", output]);
    expect(verified.exit).toBe(0);
    expect(JSON.parse(generated.stdout).id).toBe(JSON.parse(verified.stdout).id);
    const repeat = await command(["generate", "--request", request, "--output", output]);
    expect(repeat.exit).toBe(1);
    expect(repeat.stderr).toContain("EEXIST");
    expect(await readFile(output, "utf8")).toBe(original);
    const altered = JSON.parse(original);
    altered.cases[0].label = "neither";
    await writeFile(output, JSON.stringify(altered));
    expect((await command(["verify", "--input", output])).exit).toBe(1);
    for (const args of [[], ["verify"], ["generate", "--input", request], ["verify", "--input", output, "--input", output]]) {
      expect((await command(args)).exit).toBe(1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
