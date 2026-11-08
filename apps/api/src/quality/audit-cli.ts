// Audit retained suites or runs offline without exposing replies or replacing existing evidence.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import type { RunRecord } from "../runs/types";
import { auditRun, auditSuite } from "./index";

export const MAX_AUDIT_INPUT_BYTES = 134_217_728;
const usage = "Usage: <suite|run> --input <json-file> --output <new-json-file>";

function argumentsFor(args: readonly string[]) {
  const [kind, ...flags] = args;
  if (kind !== "suite" && kind !== "run") throw new Error(usage);
  const options = new Map<string, string>();
  for (let i = 0; i < flags.length; i += 2) {
    const flag = flags[i], value = flags[i + 1];
    if ((flag !== "--input" && flag !== "--output") || options.has(flag) || !value || value.startsWith("--")) throw new Error(usage);
    options.set(flag, value);
  }
  const input = options.get("--input"), output = options.get("--output");
  if (!input || !output) throw new Error(usage);
  return { kind, input, output };
}

async function readInput(path: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_AUDIT_INPUT_BYTES) throw new Error("Audit input must be a regular JSON file within 128 MiB.");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    if (bytes > MAX_AUDIT_INPUT_BYTES) throw new Error("Audit input exceeds 128 MiB.");
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))) as unknown;
}

export async function runAuditCli(args: readonly string[]): Promise<void> {
  const options = argumentsFor(args);
  let input: unknown;
  try { input = await readInput(options.input); }
  catch { throw new Error("Audit input could not be read as bounded UTF-8 JSON. No input contents were printed."); }
  let report: Awaited<ReturnType<typeof auditSuite>> | Awaited<ReturnType<typeof auditRun>>;
  try {
    if (options.kind === "suite") report = await auditSuite(input as RunRecord["suite"]);
    else {
      const envelope = input as { record?: RunRecord } | null;
      const record = envelope && typeof envelope === "object" && Object.hasOwn(envelope, "record") ? envelope.record : input;
      report = await auditRun(record as RunRecord);
    }
  } catch { throw new Error("Audit rejected the retained evidence or could not replay its mathematical certificates. Check the source artifact and native runtime; no input diagnostics were printed."); }
  try { await writeFile(options.output, `${JSON.stringify(report)}\n`, { flag: "wx", mode: 0o600 }); }
  catch { throw new Error("Audit could not create its report. Choose a writable new output file; existing files cannot be overwritten."); }
  console.log(JSON.stringify({ id: report.id, verdict: report.gate.verdict, blockers: report.gate.blockers.length }));
}

if (import.meta.main) {
  try { await runAuditCli(Bun.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : "Audit failed."); process.exitCode = 1; }
}
