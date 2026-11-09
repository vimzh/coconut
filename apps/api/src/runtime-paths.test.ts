// Execute the production bundle outside the checkout's working directory to catch broken asset paths.
import { expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiRoot } from "./runtime-paths";

// Cold certification shares CPU with the full suite; this checks asset resolution, not startup latency.
it("loads certified suite artifacts and the native worker from the built API", async () => {
  const output = await mkdtemp(fileURLToPath(new URL(".runtime-check-", apiRoot)));
  try {
    const build = await Bun.build({ entrypoints: [fileURLToPath(new URL("src/index.ts", apiRoot))], target: "bun", outdir: output });
    expect(build.success).toBe(true);
    const child = Bun.spawn([process.execPath, "-e", `const {default:api}=await import(${JSON.stringify(join(output, "index.js"))});const r=await api.fetch(new Request("http://localhost:3201/runs/suites"));const data=await r.json();console.log(JSON.stringify({status:r.status,data}));`], {
      cwd: tmpdir(), env: { PATH: process.env.PATH ?? "" }, stdout: "pipe", stderr: "pipe",
    });
    const [out, errors, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(exit).toBe(0);
    expect(errors).toBe("");
    const result = JSON.parse(out);
    expect(result.status).toBe(200);
    expect(result.data.suites.map((suite: { key: string; caseCount: number }) => [suite.key, suite.caseCount])).toEqual([["composition-v1", 27], ["reference-v1", 75], ["smooth-v2", 27], ["challenge-v1", 72], ["screening-v1", 9], ["interior-v1", 72], ["reserve-v1", 18]]);
    expect(result.data.suites.find((suite: { key: string }) => suite.key === "composition-v1")).toMatchObject({
      recommended: true, depths: [7, 13, 19], generatorVersion: "composition-v1", promptVersion: "smooth-v2",
    });
  } finally { await rm(output, { recursive: true, force: true }); }
}, 120000);
