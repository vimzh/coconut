// Offline challenge generation and replay use bounded files and refuse artifact replacement.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { getProfile } from "../protocol";
import { generateChallengeSuite, getChallengeRequest, validateChallengeSuite } from "./suite";

const usage = "Usage: generate --output <new-path> [--population confirmation|screening] [--profile <profile-id>] | verify --input <json-path>";

async function readJson(path: string): Promise<unknown> {
  const maximum = 32 * 1024 * 1024;
  if ((await stat(path)).size > maximum) throw new Error("Challenge input exceeds 32 MiB.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    if (size > maximum) throw new Error("Challenge input exceeds 32 MiB.");
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown;
}

export async function runChallengeCli(args: readonly string[]): Promise<void> {
  const command = args[0];
  if (command !== "generate" && command !== "verify") throw new Error(usage);
  const allowed = command === "generate" ? ["--output", "--population", "--profile"] : ["--input"];
  const options = new Map<string, string>();
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!allowed.includes(flag) || options.has(flag) || !value || value.startsWith("--")) throw new Error(usage);
    options.set(flag, value);
  }
  if (command === "verify") {
    const input = options.get("--input");
    if (!input) throw new Error(usage);
    const suite = await validateChallengeSuite(await readJson(input));
    console.log(JSON.stringify({ id: suite.id, request: suite.request, summary: suite.summary, familyCoverage: suite.familyCoverage }));
    return;
  }
  const output = options.get("--output"), population = options.get("--population") ?? "confirmation";
  if (!output || (population !== "confirmation" && population !== "screening")) throw new Error(usage);
  const profile = getProfile(options.get("--profile") ?? "one-shot-json-v1");
  const result = await generateChallengeSuite(getChallengeRequest(population, profile.id));
  if (result.status !== "complete") throw new Error(`Challenge generation incomplete: ${result.reason}; accepted ${result.summary.accepted}; rejections ${JSON.stringify(result.summary.rejections)}.`);
  const suite = await validateChallengeSuite(result.suite);
  await writeFile(output, `${JSON.stringify(suite)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ id: suite.id, request: suite.request, summary: suite.summary, familyCoverage: suite.familyCoverage }));
}

if (import.meta.main) {
  try { await runChallengeCli(Bun.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
