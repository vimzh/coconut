// Explicit development calibration observes effort acceptance without selecting mathematical scores.
import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { executeInference, type InferenceResult } from "../inference";
import { buildPrompt, type ReasoningEffort } from "../protocol";
import { reflectsCredential } from "../providers/responses";
import { buildModelCensus } from "./catalog";

export interface CapabilityObservation { readonly modelId: string; readonly effort: ReasoningEffort; readonly result: InferenceResult }
export function effortWasAccepted(observation: CapabilityObservation): boolean {
  const { result, effort } = observation;
  return result.failure === null && result.inferenceRequests === 1 && result.effective.reasoningEffort === effort
    && result.effective.maxOutputTokens === 16384;
}

export async function runCapabilityCalibration(output: string, credential: string): Promise<void> {
  const inventory = await Bun.file(new URL("../../data/experiments/openai-inventory-v1.json", import.meta.url)).json();
  if (inventory.result?.ok !== true || !Array.isArray(inventory.result.value)) throw new Error("The recorded model inventory is unavailable.");
  const census = buildModelCensus(inventory.result.value);
  const tasks = census.included.flatMap(model => model.plannedEfforts.map(effort => ({ modelId: model.modelId, effort })));
  if (tasks.length !== 183) throw new Error("The frozen capability workload changed; review the experiment budget.");
  const startedAt = new Date().toISOString();
  const probes: CapabilityObservation[] = [], errors: { modelId: string; effort: ReasoningEffort; code: string }[] = [];
  let cursor = 0, stopped = false;
  const controller = new AbortController();
  const stop = () => { stopped = true; controller.abort(); };
  const reference = { expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
  await writeFile(output, "{}\n", { flag: "wx", mode: 0o600 });
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const checkpoint = async (state: "running" | "complete" | "interrupted") => {
    const evidence = { version: "1", kind: "effort-capability-observations", state, startedAt, updatedAt: new Date().toISOString(),
      scope: "Verified quadratic control; setting acceptance only. Any returned label is retained, and label correctness is never a selection rule.",
      policy: { plannedControls: tasks.length, maxConcurrency: 12, retries: 0, maxOutputTokens: 16384, inferenceTimeoutMs: 180000 },
      probes, errors, planned: tasks,
      counts: { finished: probes.length + errors.length, inferenceRequests: probes.reduce((sum, row) => sum + row.result.inferenceRequests, 0), accepted: probes.filter(effortWasAccepted).length } };
    const json = `${JSON.stringify(evidence, null, 2)}\n`;
    if (reflectsCredential(json, credential)) throw new Error("Unsafe evidence reflection.");
    const temporary = `${output}.${randomUUID()}.tmp`;
    await writeFile(temporary, json, { flag: "wx", mode: 0o600 });
    await rename(temporary, output);
  };
  let writing = Promise.resolve();
  const save = (state: "running" | "complete" | "interrupted") => { writing = writing.then(() => checkpoint(state)); return writing; };
  try {
    await save("running");
    const settled = await Promise.allSettled(Array.from({ length: 12 }, async () => {
      while (!stopped && cursor < tasks.length) {
        const task = tasks[cursor++];
        const profileId = `one-shot-json-v2-${task.effort}` as const;
        try {
          const result = await executeInference({ selection: { provider: "openai", modelId: task.modelId, servingProvider: null, profileId, verification: "metadata" }, prompt: buildPrompt(reference, profileId), acceptCharges: true }, credential, controller.signal);
          probes.push({ ...task, result });
          if (result.failure?.code === "authentication-rejected" || result.failure?.code === "credit-or-quota-exhausted") stop();
        } catch { errors.push({ ...task, code: "local-calibration-failed" }); stop(); }
        try { await save("running"); } catch { stop(); throw new Error("Capability checkpoint could not be retained."); }
        if ((probes.length + errors.length) % 10 === 0) console.log(JSON.stringify({ phase: "capabilities", finished: probes.length + errors.length, planned: tasks.length, accepted: probes.filter(effortWasAccepted).length }));
      }
    }));
    if (settled.some(result => result.status === "rejected")) throw new Error("Capability evidence could not be retained.");
    await save(stopped ? "interrupted" : "complete");
    console.log(JSON.stringify({ phase: "capabilities", state: stopped ? "interrupted" : "complete", finished: probes.length + errors.length, planned: tasks.length, accepted: probes.filter(effortWasAccepted).length }));
    if (stopped) throw new Error("Capability calibration was interrupted.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output" || !args[1] || args[1].startsWith("--")) throw new Error("Use --output with a new evidence path.");
    const credential = process.env.OPENAI_API_KEY;
    if (!credential) throw new Error("The explicitly selected OpenAI development credential is missing.");
    await runCapabilityCalibration(args[1], credential);
  } catch { console.error("Capability calibration could not finish. Inspect retained evidence before starting any new paid work."); process.exitCode = 1; }
}
