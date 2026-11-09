// Generate or replay the certified composition suite offline, without replacing existing artifacts.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { generateCompositionSuite, getCompositionRequest, validateCompositionSuite } from "../apps/api/src/composition";
import { getProfile } from "../apps/api/src/protocol";

const usage = "Usage: bun scripts/composition-suite.ts generate --output <new-json-path> [--profile <profile-id>] | verify --input <json-path>";
const help = `${usage}\nOffline certification requires the installed numerical runtime. Default profile: one-shot-json-v1. Generation refuses existing output files. Verification fully replays the fixed population. No model calls are made.`;
const maximum = 32 * 1024 * 1024;

async function readJson(path: string): Promise<unknown> {
  if ((await stat(path)).size > maximum) throw new Error();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    if (size > maximum) throw new Error();
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown;
}

export async function runCli(args: readonly string[], options: { out?: (message: string) => void; error?: (message: string) => void } = {}): Promise<number> {
  const out = options.out ?? console.log, error = options.error ?? console.error;
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) { out(help); return 0; }
  let failure = usage;
  try {
    const command = args[0], values = new Map<string, string>();
    if (command !== "generate" && command !== "verify") throw new Error();
    const allowed = command === "generate" ? ["--output", "--profile"] : ["--input"];
    for (let index = 1; index < args.length; index += 2) {
      const flag = args[index], value = args[index + 1];
      if (!allowed.includes(flag) || values.has(flag) || !value || value.startsWith("--")) throw new Error();
      values.set(flag, value);
    }
    const path = values.get(command === "generate" ? "--output" : "--input");
    if (!path) throw new Error();
    failure = "Composition certification failed. Check the profile, artifact, and installed numerical runtime; verification requires an unchanged reproducible suite.";
    const suite = command === "verify" ? await validateCompositionSuite(await readJson(path)) : await (async () => {
      const profile = getProfile(values.get("--profile") ?? "one-shot-json-v1");
      const result = await generateCompositionSuite(getCompositionRequest(profile.id));
      if (result.status !== "complete") throw new Error();
      return validateCompositionSuite(result.suite);
    })();
    if (command === "generate") {
      failure = "The output must be a new writable file. Existing artifacts are never replaced.";
      await writeFile(path, `${JSON.stringify(suite)}\n`, { flag: "wx", mode: 0o600 });
    }
    out(JSON.stringify({ id: suite.id, profile: suite.request.profileId, cases: suite.cases.length, depths: suite.request.depths, summary: suite.summary }));
    return 0;
  } catch { error(failure); return 1; }
}

if (import.meta.main) process.exitCode = await runCli(Bun.argv.slice(2));
