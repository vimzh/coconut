// Offline generation and full replay of smooth suites; artifacts are never overwritten.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { DEFAULT_NUMERICAL_REQUEST, generateNumericalSuite } from "./suite";
import { validateNumericalSuite } from "./manifest";

const usage = "Usage: generate --output <new-path> [--request <json-path>] | verify --input <json-path>";

async function readJson(path: string): Promise<unknown> {
  const maximum = 32 * 1024 * 1024;
  const tooLarge = () => new Error("Numerical JSON input exceeds 32 MiB.");
  if ((await stat(path)).size > maximum) throw tooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    if (size > maximum) throw tooLarge();
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown;
}

export async function runNumericalCli(args: readonly string[]): Promise<void> {
  const command = args[0];
  if (command !== "generate" && command !== "verify") throw new Error(usage);
  const allowed = command === "generate" ? ["--output", "--request"] : ["--input"];
  const options = new Map<string, string>();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowed.includes(flag) || options.has(flag) || !value || value.startsWith("--")) throw new Error(usage);
    options.set(flag, value);
  }
  if (command === "verify") {
    const path = options.get("--input");
    if (!path) throw new Error(usage);
    const suite = await validateNumericalSuite(await readJson(path));
    console.log(JSON.stringify({ id: suite.id, backend: suite.backend, summary: suite.summary }));
    return;
  }
  const output = options.get("--output");
  if (!output) throw new Error(usage);
  const requestPath = options.get("--request");
  const result = await generateNumericalSuite(requestPath ? await readJson(requestPath) : DEFAULT_NUMERICAL_REQUEST);
  if (result.status !== "complete") throw new Error(`Numerical generation incomplete: ${result.reason}; accepted ${result.summary.accepted}.`);
  const suite = await validateNumericalSuite(result.suite);
  await writeFile(output, `${JSON.stringify(suite)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ id: suite.id, backend: suite.backend, summary: suite.summary }));
}

if (import.meta.main) {
  try { await runNumericalCli(Bun.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
