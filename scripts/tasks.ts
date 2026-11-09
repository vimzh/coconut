// Offline command entrypoint for configurable certified task populations.
import { generateTasks, loadTasks, validateRequest } from "./tasks/population";
import type { TasksRequest } from "./tasks/types";
const HELP = `Usage:
  bun scripts/tasks.ts generate --depths <1,2,...> --cases-per-depth <1..1000> --seed <uint32> --output <new-json> [--source <checkout>] [--python <interpreter>] [--max-batches <1..128>]
  bun scripts/tasks.ts verify --input <json>

At most 1000 total tasks; depths must be distinct integers 1..1000.
Source/interpreter default to COCONUT_GENERATOR_SOURCE / COCONUT_GENERATOR_PYTHON.
Generation retains private batch evidence beside the JSON. Export permissions remain unresolved.
`;
export async function main(args: readonly string[]): Promise<void> {
  if (args.length === 0 || args.includes("--help")) { console.log(HELP); return; }
  const [command, ...rest] = args;
  if (!["generate", "verify"].includes(command)) throw new Error("Expected generate or verify; use --help.");
  const allowed = command === "generate" ? ["depths", "cases-per-depth", "seed", "output", "source", "python", "max-batches"] : ["input"];
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index].slice(2), value = rest[index + 1];
    if (!rest[index].startsWith("--") || !allowed.includes(key) || options.has(key) || value === undefined || value.startsWith("--") || !value.trim())
      throw new Error("Unknown, repeated or missing argument; use --help.");
    options.set(key, value);
  }
  const required = (name: string): string => { const value = options.get(name); if (value === undefined) throw new Error(`Missing --${name}; use --help.`); return value; };
  const number = (value: string): number => { if (!/^\d+$/.test(value)) throw new Error("Integer arguments require decimal digits."); return Number(value); };
  const controller = new AbortController(), cancel = () => controller.abort(new Error("Task operation interrupted; retain private evidence."));
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  try {
    if (command === "verify") {
      const artifact = await loadTasks(required("input"), controller.signal);
      console.log(`Verified ${artifact.cases.length} certified tasks: ${artifact.id}`); return;
    }
    const request: TasksRequest = { depths: required("depths").split(",").map(number), casesPerDepth: number(required("cases-per-depth")), seed: number(required("seed")), maxBatches: number(options.get("max-batches") ?? "128") };
    validateRequest(request);
    const artifact = await generateTasks({ request, output: required("output"), source: options.get("source") ?? process.env.COCONUT_GENERATOR_SOURCE ?? "", python: options.get("python") ?? process.env.COCONUT_GENERATOR_PYTHON ?? "", signal: controller.signal });
    if (artifact.state !== "complete") throw new Error(`${artifact.failure} Incomplete artifact and evidence retained at ${required("output")}.`);
    console.log(`Generated ${artifact.cases.length} certified tasks: ${artifact.id}\nPrivate artifact: ${required("output")}`);
  } finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); }
}
if (import.meta.main) main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : "Task command failed."); process.exitCode = 1; });
