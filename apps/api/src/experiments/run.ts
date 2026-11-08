// A frozen operator matrix schedules complete foreground runs and never replaces failed cells with better scores.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { auditRun, qualityDataHash, type SignalCapabilityEvidence } from "../quality";
import { reflectsCredential } from "../providers/responses";
import type { RunEvent, RunRequest } from "../runs/types";
import { effortWasAccepted, type CapabilityObservation } from "./capabilities";
import type { FrozenExperiment } from "./manifest";
import { launchForegroundRun, LOCAL_API, PrivateRunSettlementError, readApplicationJson, readSettledPrivateRun } from "./http";
import { matrixFailureRequiresStop } from "./matrix-policy";

type Cell = FrozenExperiment["cells"][number];
interface CellStatus { id: string; phase: Cell["phase"]; modelId: string; profileId: Cell["profileId"]; state: "pending" | "active" | "completed" | "failed" | "cancelled" | "timed-out" | "interrupted" | "capability-unverified"; runId: string | null; progress: { finished: number; planned: number; inferenceRequests: number }; reportId: string | null; published: boolean; error: string | null }

async function atomicJson(path: string, value: unknown, credential: string) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (reflectsCredential(json, credential)) throw new Error("Unsafe experiment evidence.");
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, json, { mode: 0o600, flag: "wx" }); await rename(temporary, path);
}

export function experimentPaths(output: string): { output: string; capabilities: string; privateRoot: string } {
  const target = resolve(output), stem = basename(target, ".json");
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(stem) || basename(target) !== `${stem}.json`) throw new Error("Use a new JSON output with a lowercase alphanumeric/hyphen basename.");
  return { output: target, capabilities: join(dirname(target), `${stem}-capabilities.json`), privateRoot: new URL(`../../data/private/${stem}/`, import.meta.url).pathname };
}

export function parseFrozenRunArguments(args: readonly string[]): { output: string; manifest?: string; publish: boolean } {
  const values = new Map<string, string>();
  let publish = false, consent = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--publish" && !publish) publish = true;
    else if (arg === "--accept-charges" && !consent) consent = true;
    else if (["--output", "--manifest"].includes(arg) && !values.has(arg) && args[i + 1] && !args[i + 1].startsWith("--")) values.set(arg, args[++i]);
    else throw new Error("Use --output <new-path> --accept-charges, with optional --manifest <path> and --publish.");
  }
  const output = values.get("--output");
  if (!output || !consent) throw new Error("A new output and explicit charge consent are required.");
  return { output, manifest: values.get("--manifest"), publish };
}

export async function runFrozenExperiment(output: string, credential: string, publish: boolean, manifestPath?: string): Promise<void> {
  const paths = experimentPaths(output);
  const manifest = await Bun.file(manifestPath ?? new URL("../../data/experiments/openai-matrix-v1.json", import.meta.url)).json() as FrozenExperiment;
  const calibration = await Bun.file(new URL("../../data/experiments/capabilities-v1.json", import.meta.url)).json() as { state: string; probes: CapabilityObservation[]; errors: unknown[] };
  if (manifest.kind !== "openai-curvature-experiment" || manifest.budget.maxChargedAttempts !== 8192 || manifest.plannedInferenceCeiling + 4 > 8192 || calibration.state !== "complete" || calibration.probes.length !== 183 || calibration.errors.length) throw new Error("The frozen workload or capability evidence is incomplete.");
  const accepted = (cell: Cell) => cell.reasoningEffort === "provider-default" || calibration.probes.some(probe => probe.modelId === cell.modelId && probe.effort === cell.reasoningEffort && effortWasAccepted(probe));
  const scheduledInferenceCeiling = manifest.cells.reduce((sum, cell) => sum + (cell.phase !== "capability-probe" && accepted(cell) ? cell.phase === "confirmation" ? 216 : 27 : 0), 0);
  if (manifest.replication && (manifest.replication.capabilityPolicy !== "reuse-retained-controls-without-new-calls"
    || manifest.replication.retainedControlsSha256 !== qualityDataHash(calibration.probes)
    || !Number.isSafeInteger(manifest.replication.retainedPriorInferenceRequests) || manifest.replication.retainedPriorInferenceRequests < 0
    || manifest.replication.plannedNewMathInferenceRequests !== scheduledInferenceCeiling
    || manifest.plannedInferenceCeiling !== scheduledInferenceCeiling
    || manifest.replication.maximumCumulativeInferenceRequests !== manifest.replication.retainedPriorInferenceRequests + scheduledInferenceCeiling
    || manifest.replication.maximumCumulativeInferenceRequests > manifest.budget.maxChargedAttempts)) throw new Error("Replication workload exceeds or differs from its frozen cumulative budget.");
  const capabilities: SignalCapabilityEvidence = { version: "1", manifestSha256: qualityDataHash(manifest), checkedAt: new Date().toISOString(), probes: calibration.probes };
  const cells = manifest.cells.filter(cell => cell.phase !== "capability-probe");
  const statuses: CellStatus[] = cells.map(cell => ({ id: cell.id, phase: cell.phase, modelId: cell.modelId, profileId: cell.profileId, state: "pending", runId: null, progress: { finished: 0, planned: cell.phase === "confirmation" ? 216 : 27, inferenceRequests: 0 }, reportId: null, published: false, error: null }));
  const root = paths.privateRoot;
  await mkdir(new URL("../../data/private/", import.meta.url), { recursive: true, mode: 0o700 });
  await mkdir(root, { mode: 0o700 });
  await mkdir(`${root}records`, { recursive: true, mode: 0o700 });
  const receipts: Record<string, { runId: string; accessCode: string }> = {};
  await writeFile(paths.output, "{}\n", { flag: "wx", mode: 0o600 });
  const capabilityJson = `${JSON.stringify(capabilities, null, 2)}\n`;
  if (reflectsCredential(capabilityJson, credential)) throw new Error("Unsafe retained controls.");
  await writeFile(paths.capabilities, capabilityJson, { flag: "wx", mode: 0o600 });
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const startedAt = new Date().toISOString();
  let cursor = 0, checkpoint = Promise.resolve(), lastPrinted = 0, lastProgressSave = 0;
  const save = () => {
    checkpoint = checkpoint.then(async () => {
      await atomicJson(`${root}access.json`, receipts, credential);
      await atomicJson(paths.output, { version: "1", manifestSha256: qualityDataHash(manifest), capabilityEvidenceSha256: qualityDataHash(capabilities), startedAt, updatedAt: new Date().toISOString(), state: controller.signal.aborted ? "interrupted" : statuses.every(cell => cell.state !== "pending" && cell.state !== "active") ? "settled" : "running", plannedInferenceCeiling: manifest.plannedInferenceCeiling, capabilitiesInferenceRequests: calibration.probes.reduce((sum, probe) => sum + probe.result.inferenceRequests, 0), capabilityCallsThisExecution: 0, replication: manifest.replication ?? null, cells: statuses }, credential);
    }).catch((error: unknown) => { controller.abort(); throw error; });
    return checkpoint;
  };
  const work = async () => {
    while (!controller.signal.aborted && cursor < cells.length) {
      const index = cursor++, cell = cells[index], status = statuses[index];
      if (!accepted(cell)) { status.state = "capability-unverified"; status.error = "The retained control did not establish this effort/cap; no mathematical score was invented."; await save(); continue; }
      status.state = "active"; await save();
      let receipt: { runId: string; accessCode: string } | null = null;
      const observe = (event: RunEvent) => {
        if (event.type === "started") { receipt = { runId: event.runId, accessCode: event.accessCode }; receipts[cell.id] = receipt; status.runId = event.runId; }
        if ("progress" in event) status.progress = { finished: event.progress.finishedTrials, planned: event.progress.plannedTrials, inferenceRequests: event.progress.inferenceRequests };
        if (event.type === "started" || Date.now() - lastProgressSave >= 5000) {
          lastProgressSave = Date.now();
          // The shared checkpoint rejects the foreground operation if persistence fails.
          void save().catch(() => {});
        }
      };
      try {
        const request: RunRequest = { suiteKey: cell.phase === "confirmation" ? "challenge-v1" : "screening-v1", provider: "openai", modelId: cell.modelId, servingProvider: null, profileId: cell.profileId, concurrency: 4, acceptCharges: true };
        await launchForegroundRun(request, credential, controller.signal, observe);
      } catch { status.error = "The foreground operation did not establish a terminal outcome. No paid retry or replacement run was started."; }
      const saved = receipt as { runId: string; accessCode: string } | null;
      if (!saved) { status.state = "interrupted"; status.error = "No private run receipt was retained; execution remains unresolved."; controller.abort(); await save(); return; }
      try {
        const view = await readSettledPrivateRun(saved.runId, saved.accessCode, credential);
        if (view.record.suite.id !== cell.suiteId || qualityDataHash(view.record.suite) !== cell.suiteSha256 || qualityDataHash(view.record.prompts) !== cell.promptsSha256 || view.record.evidence.model.settingsId !== cell.settingsId) {
          status.state = "failed";
          throw new Error("The executed cell differs from its frozen identity.");
        }
        await atomicJson(`${root}records/${saved.runId}.json`, view, credential);
        status.state = view.record.state;
        status.reportId = view.record.report?.id ?? null;
        status.progress = { finished: view.record.progress.finishedTrials, planned: view.record.progress.plannedTrials, inferenceRequests: view.record.progress.inferenceRequests };
        if (matrixFailureRequiresStop(view.record)) controller.abort();
        if (publish && view.record.state === "completed") {
          try {
            const response = await fetch(`${LOCAL_API}/runs/${saved.runId}/publication`, { method: "POST", headers: { Authorization: `Bearer ${saved.accessCode}`, "Content-Type": "application/json" }, body: '{"published":true}', cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) });
            await readApplicationJson(response, credential); status.published = true;
          } catch { status.error = "The completed execution is retained; its publication needs review."; }
        }
        try {
          const quality = await auditRun(view.record);
          await mkdir(`${root}quality`, { recursive: true, mode: 0o700 });
          await atomicJson(`${root}quality/${saved.runId}.json`, quality, credential);
        } catch { status.error = "Execution evidence is retained; offline quality analysis needs review."; }
      } catch (error) {
        if (status.state === "active") status.state = "interrupted";
        status.error = error instanceof PrivateRunSettlementError ? error.message : "Private receipt retained; final execution evidence could not be verified or stored. Inspect storage and the original run before further paid work.";
        controller.abort();
      }
      await save();
      const done = statuses.filter(cell => cell.state !== "pending" && cell.state !== "active").length;
      if (done > lastPrinted) { lastPrinted = done; console.log(JSON.stringify({ phase: "matrix", settledCells: done, plannedCells: cells.length, modelId: cell.modelId, profileId: cell.profileId, state: status.state })); }
    }
  };
  try {
    await save();
    const settled = await Promise.allSettled(Array.from({ length: 3 }, work));
    if (settled.some(result => result.status === "rejected")) { controller.abort(); throw new Error("Experiment checkpoint could not be retained."); }
    await save();
    console.log(JSON.stringify({ phase: "matrix", state: controller.signal.aborted ? "interrupted" : "settled", completed: statuses.filter(cell => cell.state === "completed").length, planned: cells.length }));
    if (controller.signal.aborted || statuses.some(cell => !["completed", "capability-unverified"].includes(cell.state))) throw new Error("The matrix did not establish all planned eligible evaluation cells.");
  } finally { controller.abort(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (import.meta.main) {
  try {
    const args = parseFrozenRunArguments(Bun.argv.slice(2));
    const credential = process.env.OPENAI_API_KEY;
    if (!credential) throw new Error("The explicitly selected development credential is missing.");
    await runFrozenExperiment(args.output, credential, args.publish, args.manifest);
  } catch { console.error("The frozen experiment could not finish. Inspect its retained ledger and process state before any additional paid work."); process.exitCode = 1; }
}
