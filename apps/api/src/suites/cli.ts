// Local generation and replay verification of frozen suite artifacts.
import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_SUITE_REQUEST, generateSuite, validateFrozenSuite } from "./index";

const usage = "Usage: generate --output <new-path> [--request <json-path>] | verify --input <json-path>";

type Options =
  | { command: "generate"; output: string; request?: string }
  | { command: "verify"; input: string };

function parseArguments(args: readonly string[]): Options {
  const command = args[0];
  if (command !== "generate" && command !== "verify") throw new Error(usage);
  const allowed = command === "generate" ? ["--output", "--request"] : ["--input"];
  const options = new Map<string, string>();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    if (!allowed.includes(flag)) throw new Error(`Unknown argument "${flag}". ${usage}`);
    if (options.has(flag)) throw new Error(`Duplicate argument "${flag}". ${usage}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Argument "${flag}" requires a path. ${usage}`);
    options.set(flag, value);
  }
  if (command === "generate") {
    const output = options.get("--output");
    if (!output) throw new Error(`Missing --output. ${usage}`);
    return { command, output, request: options.get("--request") };
  }
  const input = options.get("--input");
  if (!input) throw new Error(`Missing --input. ${usage}`);
  return { command, input };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Cannot read JSON file "${path}": ${message(error)}`);
  }
}

export async function runCli(args: readonly string[]): Promise<void> {
  const options = parseArguments(args);
  if (options.command === "verify") {
    const suite = await validateFrozenSuite(await readJson(options.input));
    console.log(JSON.stringify({ id: suite.id, summary: suite.summary }));
    return;
  }

  const request = options.request ? await readJson(options.request) : DEFAULT_SUITE_REQUEST;
  const result = await generateSuite(request);
  if (result.status !== "complete") {
    throw new Error(`Suite generation incomplete: ${result.reason}; accepted ${result.summary.accepted} cases.`);
  }
  const suite = await validateFrozenSuite(result.suite);
  try {
    await writeFile(options.output, `${JSON.stringify(suite)}\n`, { flag: "wx" });
  } catch (error) {
    throw new Error(`Cannot create suite file "${options.output}"; existing files cannot be overwritten: ${message(error)}`);
  }
  console.log(JSON.stringify({ id: suite.id, summary: suite.summary }));
}

if (import.meta.main) {
  try {
    await runCli(Bun.argv.slice(2));
  } catch (error) {
    console.error(`Suite CLI failed: ${message(error)}`);
    process.exitCode = 1;
  }
}
