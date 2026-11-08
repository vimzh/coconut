// Measure the complete bounded deepest source population before spending on model responses.
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { certifyImported, scalarDisplay } from "../randomized/admission";
import { writeArtifact } from "../randomized/artifacts";
import { pilotHash } from "../randomized/pilot";
import { readBoundedFile, sha256 } from "../randomized/source";
import { populationQuota } from "./population";
import { populationImplementation } from "./population-diagnostics";
import { generatePopulationBatch, POPULATION_SCHEDULE } from "./population-source";

const HISTORICAL_FEASIBILITY_SCHEDULE = Object.freeze({ ...POPULATION_SCHEDULE, batchesPerDepth: 64 });

type Label = "convex" | "concave" | "neither";
interface ReferenceOutcome { readonly label: Label; readonly status: "verified" | "unverified" | "rejected" }

export function feasibilityCountGate(outcomes: readonly ReferenceOutcome[], completedBatches: number) {
  if (!Number.isSafeInteger(completedBatches) || completedBatches < 0 || completedBatches > 64 || outcomes.length !== completedBatches * 12)
    throw new Error("Feasibility counts must include every source row of every completed batch.");
  const counts = { convex: 0, concave: 0, neither: 0 }, received = { convex: 0, concave: 0, neither: 0 };
  for (const outcome of outcomes) {
    if (!(outcome.label in counts) || !["verified", "unverified", "rejected"].includes(outcome.status)) throw new Error("Invalid retained reference outcome.");
    received[outcome.label]++; if (outcome.status === "verified") counts[outcome.label]++;
  }
  if (Object.values(received).some(count => count !== completedBatches * 4)) throw new Error("Feasibility outcome classes are incomplete.");
  const quota = populationQuota(7), remainingPerClass = (64 - completedBatches) * 4;
  const finalBoundImpossible = (Object.keys(counts) as Label[]).some(label => counts[label] + remainingPerClass < quota[label]);
  return { requestedDepth: 512, completedBatches, received: outcomes.length, verifiedCounts: counts, quota,
    possibleAdditionalPerClass: remainingPerClass, finalBoundImpossible,
    completeReferencePopulation: completedBatches === 64,
    quotaUpperBound: completedBatches === 64 ? finalBoundImpossible ? "insufficient" : "not-yet-ruled-out" : "incomplete",
    limitation: "Verified counts are an upper bound before development-exposure, exact-duplicate and simplified-duplicate exclusions; they do not certify a final admitted population or model performance." };
}

export async function runDeepestFeasibility(input: { checkout: string; python: string; output: string; deadlineAt: string;
  earlierCsvPaths: readonly string[]; signal?: AbortSignal }) {
  const output = resolve(input.output), deadline = Date.parse(input.deadlineAt);
  if (!Number.isFinite(deadline) || deadline <= Date.now() || input.earlierCsvPaths.length !== 3)
    throw new Error("The deepest feasibility sweep requires the absolute approved deadline and three retained preliminary CSV bindings.");
  const earlier = [];
  for (const path of input.earlierCsvPaths) earlier.push({ path, sha256: sha256(await readBoundedFile(path)) });
  await mkdir(output, { mode: 0o700 });
  await writeArtifact(join(output, "plan.json"), { version: "1", policy: "deepest-source-feasibility-v1", requestedDepth: 512,
    depthOrdinal: 7, schedule: HISTORICAL_FEASIBILITY_SCHEDULE, deadlineAt: input.deadlineAt, earlier, implementation: await populationImplementation(),
    sourceRows: 768, modelCalls: 0, selection: "all-received-source-rows-independent-reference-no-model-results" });
  const outcomes: ReferenceOutcome[] = [], batches: { readonly path: string; readonly sha256: string }[] = [];
  let fatal: unknown;
  try {
    for (let batchOrdinal = 0; batchOrdinal < 64; batchOrdinal++) {
      input.signal?.throwIfAborted();
      if (Date.now() >= deadline) throw new Error("Approved population feasibility deadline reached.");
      const batch = await generatePopulationBatch({ ...input, output: join(output, `batch-${batchOrdinal}`), depthOrdinal: 7, batchOrdinal });
      if (batchOrdinal < 3 && batch.sourceFileSha256 !== earlier[batchOrdinal].sha256)
        throw new Error("Repeated fixed-seed feasibility batch changed its retained source CSV.");
      const entries = [];
      for (const candidate of batch.candidates) {
        input.signal?.throwIfAborted();
        if (Date.now() >= deadline) throw new Error("Approved population feasibility deadline reached during independent references.");
        const expression = scalarDisplay(candidate.expression), reference = await certifyImported(expression, candidate.label, input.signal);
        const entry = { batchOrdinal, ordinal: candidate.ordinal, label: candidate.label, expressionSha256: sha256(expression),
          reference, referenceSha256: pilotHash(reference) };
        await writeArtifact(join(output, `batch-${batchOrdinal}`, `reference-${candidate.ordinal}.json`), entry);
        entries.push(entry);
      }
      const binding = { batchOrdinal, sourceBinding: pilotHash(batch), candidates: entries.map(row => ({ ordinal: row.ordinal,
        label: row.label, referenceSha256: row.referenceSha256, status: row.reference.status, reason: row.reference.reason ?? null })) };
      const path = `batch-${batchOrdinal}/references.json`;
      await writeArtifact(join(output, path), binding); batches.push({ path, sha256: pilotHash(binding) });
      outcomes.push(...entries.map(row => ({ label: row.label, status: row.reference.status })));
      await writeArtifact(join(output, `progress-${batchOrdinal}.json`), feasibilityCountGate(outcomes, batches.length));
      console.log(JSON.stringify({ batchOrdinal, ...feasibilityCountGate(outcomes, batches.length) }));
    }
  } catch (error) { fatal = error; }
  const result = { version: "1", policy: "deepest-source-feasibility-v1", state: !fatal && batches.length === 64 ? "complete" : "incomplete",
    finishedAt: new Date().toISOString(), batches, ...feasibilityCountGate(outcomes, batches.length),
    failure: fatal instanceof Error ? fatal.message : fatal ? "Feasibility sweep failed." : null };
  await writeArtifact(join(output, "feasibility.json"), result);
  if (fatal) throw fatal;
  return result;
}
