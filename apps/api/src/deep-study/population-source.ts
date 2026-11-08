// Keep the final population's seed schedule separate from the frozen development sampler.
import { mkdir, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { writeArtifact } from "../randomized/artifacts";
import { pilotHash } from "../randomized/pilot";
import { boundedProcess, IMPORT_LIMITS, inspectSource, parseCandidateCsv, readBoundedFile, sha256, SOURCE_REVISION } from "../randomized/source";

export const POPULATION_DEPTHS = [5, 10, 20, 40, 80, 160, 320, 512] as const;
export const POPULATION_SCHEDULE = Object.freeze({ perClass: 4, batchesPerDepth: 128, casesPerDepth: 100,
  seedRule: "1500000 + 10000*depthOrdinal + batchOrdinal", dimension: 1, maxChildren: 2, attemptsPerInstance: 20 });

export function populationSeed(depthOrdinal: number, batchOrdinal: number) {
  if (!Number.isSafeInteger(depthOrdinal) || depthOrdinal < 0 || depthOrdinal >= POPULATION_DEPTHS.length ||
    !Number.isSafeInteger(batchOrdinal) || batchOrdinal < 0 || batchOrdinal >= POPULATION_SCHEDULE.batchesPerDepth)
    throw new Error("Invalid final-population source ordinal.");
  return 1500000 + 10000 * depthOrdinal + batchOrdinal;
}

export function populationBatchOrigin(batchOrdinal: number, completedRetainedBatches: number): "retained" | "fresh" {
  if (!Number.isSafeInteger(batchOrdinal) || batchOrdinal < 0 || batchOrdinal >= POPULATION_SCHEDULE.batchesPerDepth ||
    !Number.isSafeInteger(completedRetainedBatches) || completedRetainedBatches < 0 || completedRetainedBatches > POPULATION_SCHEDULE.batchesPerDepth)
    throw new Error("Invalid retained source-prefix boundary.");
  return batchOrdinal < completedRetainedBatches ? "retained" : "fresh";
}

export async function retainedPopulationSource(root: string, requestedDepth: number) {
  const directory = resolve(root), summary = JSON.parse(await readBoundedFile(join(directory, "feasibility.json")));
  if (summary.version !== "1" || summary.policy !== "deepest-source-feasibility-v1" || summary.state !== "complete" ||
    summary.requestedDepth !== requestedDepth || summary.completedBatches !== 64 || summary.received !== 768 ||
    summary.completeReferencePopulation !== true || !Array.isArray(summary.batches) || summary.batches.length !== 64)
    throw new Error("Retained source root must bind its complete historical 64-batch prefix.");
  const depthOrdinal = POPULATION_DEPTHS.findIndex(depth => depth === requestedDepth);
  if (depthOrdinal < 0) throw new Error("Retained source prefix has an unknown requested depth.");
  for (let batchOrdinal = 0; batchOrdinal < 64; batchOrdinal++) {
    const batch = await replayPopulationBatch(join(directory, `batch-${batchOrdinal}`), depthOrdinal, batchOrdinal);
    const binding = summary.batches[batchOrdinal], expectedPath = `batch-${batchOrdinal}/references.json`;
    if (binding.path !== expectedPath) throw new Error("Historical source-prefix ordinal changed.");
    const references = JSON.parse(await readBoundedFile(join(directory, expectedPath)));
    if (pilotHash(references) !== binding.sha256 || references.batchOrdinal !== batchOrdinal || references.sourceBinding !== pilotHash(batch) ||
      !Array.isArray(references.candidates) || references.candidates.length !== 12)
      throw new Error("Historical source-prefix binding changed.");
  }
  return { root: directory, completedBatches: 64, summarySha256: pilotHash(summary) };
}

export async function generatePopulationBatch(input: { checkout: string; python: string; output: string;
  depthOrdinal: number; batchOrdinal: number; signal?: AbortSignal }) {
  const seed = populationSeed(input.depthOrdinal, input.batchOrdinal), requestedDepth = POPULATION_DEPTHS[input.depthOrdinal];
  const source = await inspectSource(input.checkout, input.python), output = resolve(input.output);
  await mkdir(output, { mode: 0o700 });
  const args = ["scripts/generate_dataset.py", "--depths", String(requestedDepth), "--n-per-class", String(POPULATION_SCHEDULE.perClass),
    "--seed", String(seed), "--dim", "1", "--max-children", "2", "--attempts-per-instance", "20", "--out", output];
  const receipt = { version: "1", policy: "final-population-source-v1", requestedDepth, depthOrdinal: input.depthOrdinal,
    batchOrdinal: input.batchOrdinal, seed, source, args, startedAt: new Date().toISOString() };
  await writeArtifact(join(output, "receipt.json"), receipt);
  try {
    const stdout = await boundedProcess(input.python, args, resolve(input.checkout), IMPORT_LIMITS.batchTimeoutMs, input.signal);
    if (pilotHash(source) !== pilotHash(await inspectSource(input.checkout, input.python)))
      throw new Error("Pinned source or generation environment changed during the final batch.");
    const csv = await readBoundedFile(join(output, `synthesized_depth${requestedDepth}_n1.csv`));
    const result = { ...receipt, state: "complete", finishedAt: new Date().toISOString(), sourceFileSha256: sha256(csv), stdout,
      candidates: parseCandidateCsv(csv, requestedDepth, POPULATION_SCHEDULE.perClass) };
    await writeArtifact(join(output, "batch.json"), result);
    return result;
  } catch (error) {
    await writeArtifact(join(output, "failure.json"), { state: "failed", reason: error instanceof Error ? error.message : "Source batch failed." });
    throw error;
  }
}

export async function replayPopulationBatch(path: string, depthOrdinal: number, batchOrdinal: number) {
  const batch: Awaited<ReturnType<typeof generatePopulationBatch>> = JSON.parse(await readBoundedFile(join(path, "batch.json")));
  const receipt = JSON.parse(await readBoundedFile(join(path, "receipt.json")));
  const csv = await readBoundedFile(join(path, `synthesized_depth${POPULATION_DEPTHS[depthOrdinal]}_n1.csv`));
  const candidates = parseCandidateCsv(csv, POPULATION_DEPTHS[depthOrdinal], POPULATION_SCHEDULE.perClass);
  const args = ["scripts/generate_dataset.py", "--depths", String(POPULATION_DEPTHS[depthOrdinal]), "--n-per-class", "4", "--seed",
    String(populationSeed(depthOrdinal, batchOrdinal)), "--dim", "1", "--max-children", "2", "--attempts-per-instance", "20", "--out"];
  const expectedReceipt = { version: batch.version, policy: batch.policy, requestedDepth: batch.requestedDepth, depthOrdinal: batch.depthOrdinal,
    batchOrdinal: batch.batchOrdinal, seed: batch.seed, source: batch.source, args: batch.args, startedAt: batch.startedAt };
  const environment = batch.source?.environment;
  if (batch.policy !== "final-population-source-v1" || batch.state !== "complete" || batch.seed !== populationSeed(depthOrdinal, batchOrdinal) ||
    batch.requestedDepth !== POPULATION_DEPTHS[depthOrdinal] || batch.depthOrdinal !== depthOrdinal || batch.batchOrdinal !== batchOrdinal ||
    pilotHash(receipt) !== pilotHash(expectedReceipt) || !Array.isArray(batch.args) || batch.args.length !== args.length + 1 ||
    pilotHash(batch.args.slice(0, -1)) !== pilotHash(args) || typeof batch.args.at(-1) !== "string" || !batch.args.at(-1)!.startsWith("/") ||
    batch.source?.revision !== SOURCE_REVISION || batch.source.permission !== "not-declared-no-redistribution" ||
    !batch.source.files || Object.keys(batch.source.files).length < 1 || !Object.values(batch.source.files).every(value => /^[a-f0-9]{64}$/.test(value)) ||
    environment?.python !== "3.13.17" || environment.packages?.numpy !== "2.1.2" || environment.packages?.pandas !== "2.3.1" ||
    environment.packages?.tqdm !== "4.67.1" || batch.sourceFileSha256 !== sha256(csv) || pilotHash(batch.candidates) !== pilotHash(candidates))
    throw new Error("Retained final-population source batch or candidate order changed.");
  return batch;
}

export async function retainPopulationBatch(input: { root: string; output: string; depthOrdinal: number; batchOrdinal: number }) {
  const source = join(resolve(input.root), `batch-${input.batchOrdinal}`), output = resolve(input.output);
  const batch = await replayPopulationBatch(source, input.depthOrdinal, input.batchOrdinal);
  await mkdir(output, { mode: 0o700 });
  for (const name of ["receipt.json", "batch.json", `synthesized_depth${POPULATION_DEPTHS[input.depthOrdinal]}_n1.csv`]) {
    const text = await readBoundedFile(join(source, name)), file = await open(join(output, name), "wx", 0o600);
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  }
  const retained = await replayPopulationBatch(output, input.depthOrdinal, input.batchOrdinal);
  if (pilotHash(batch) !== pilotHash(retained)) throw new Error("Source batch changed while being retained for final admission.");
  await writeArtifact(join(output, "retention.json"), { version: "1", sourceDirectory: source, sourceBinding: pilotHash(batch),
    copiedFiles: ["receipt.json", "batch.json", `synthesized_depth${batch.requestedDepth}_n1.csv`],
    independentReferences: "recomputed-by-final-population-builder" });
  return retained;
}
