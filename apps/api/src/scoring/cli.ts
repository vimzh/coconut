// Score retained evaluation evidence and create a report without overwriting files.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { scoreEvaluation } from "./index";

const usage = "Usage: --input <json-path> --output <new-json-path>";
export const MAX_SCORING_INPUT_BYTES = 134_217_728;

function parseArguments(args: readonly string[]): { input: string; output: string } {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (flag !== "--input" && flag !== "--output") throw new Error(`Unknown argument "${flag}". ${usage}`);
    if (options.has(flag)) throw new Error(`Duplicate argument "${flag}". ${usage}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Argument "${flag}" requires a path. ${usage}`);
    options.set(flag, value);
  }
  const input = options.get("--input");
  const output = options.get("--output");
  if (!input) throw new Error(`Missing --input. ${usage}`);
  if (!output) throw new Error(`Missing --output. ${usage}`);
  return { input, output };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readJson(path: string): Promise<unknown> {
  try {
    const tooLarge = () => new Error(`Scoring input exceeds the ${MAX_SCORING_INPUT_BYTES}-byte file limit.`);
    if ((await stat(path)).size > MAX_SCORING_INPUT_BYTES) throw tooLarge();
    const chunks: Buffer[] = [];
    let bytes = 0;
    // Bound bytes during reading as well, in case the file grows after stat.
    for await (const chunk of createReadStream(path)) {
      bytes += chunk.length;
      if (bytes > MAX_SCORING_INPUT_BYTES) throw tooLarge();
      chunks.push(chunk);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))) as unknown;
  } catch (error) {
    throw new Error(`Cannot read JSON file "${path}": ${message(error)}`);
  }
}

export async function runCli(args: readonly string[]): Promise<void> {
  const options = parseArguments(args);
  const report = await scoreEvaluation(await readJson(options.input));
  try {
    await writeFile(options.output, `${JSON.stringify(report)}\n`, { flag: "wx" });
  } catch (error) {
    throw new Error(`Cannot create report file "${options.output}"; existing files cannot be overwritten: ${message(error)}`);
  }
  console.log(JSON.stringify({
    id: report.id,
    status: report.overall.classification.population.status,
    macroF1: report.overall.classification.macroF1,
  }));
}

if (import.meta.main) {
  try {
    await runCli(Bun.argv.slice(2));
  } catch (error) {
    console.error(`Scoring CLI failed: ${message(error)}`);
    process.exitCode = 1;
  }
}
