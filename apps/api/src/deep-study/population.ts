// Admit an immutable shared population by source ordinal, independent proof and exposure policy.
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { certifyImported, IMPORT_DOMAIN, scalarDisplay } from "../randomized/admission";
import type { ImportReference } from "../randomized/admission";
import { writeArtifact } from "../randomized/artifacts";
import { pilotHash } from "../randomized/pilot";
import { readBoundedFile, sha256, SOURCE_REVISION } from "../randomized/source";
import type { GeneratedCandidate } from "../randomized/source";
import type { ImportedCase } from "../randomized/types";
import { CONTROL_EXPRESSION, diagnosePopulationCase, populationImplementation } from "./population-diagnostics";
import type { PopulationDiagnosticResult, PopulationDiagnostics } from "./population-diagnostics";
import { populationCoverage } from "./population-coverage";
import { generatePopulationBatch, POPULATION_DEPTHS, POPULATION_SCHEDULE, populationBatchOrigin, replayPopulationBatch, retainPopulationBatch,
  retainedPopulationSource } from "./population-source";

const LABELS = ["convex", "concave", "neither"] as const;
type Label = typeof LABELS[number];
export type PopulationCounts = Record<Label, number>;
export interface PopulationCase extends ImportedCase { readonly diagnostics: PopulationDiagnostics }
interface PriorExposure { readonly exactHashes: readonly string[]; readonly coreHashes: readonly string[] }
interface SmokeExposureRow { readonly exactHashOnDeclaredImportDomain: string; readonly coreHashes: readonly string[] }
export interface PopulationCandidate {
  readonly batch: number; readonly ordinal: number; readonly label: Label; readonly exactHash: string;
  readonly expressionSha256: string; readonly originalDisplaySha256: string; readonly sourceTreeSha256: string;
  readonly actualDepth: number; readonly numericalStatus: GeneratedCandidate["numericalStatus"];
  readonly reference: ImportReference; readonly diagnostics: PopulationDiagnosticResult;
  readonly disposition: "admitted" | "duplicate" | "prior-exposure" | "quota-filled" | "unverified";
  readonly reason: string | null;
}
interface Stratum {
  readonly version: "1"; readonly requestedDepth: number; readonly depthOrdinal: number; readonly state: "ready" | "incomplete";
  readonly quota: PopulationCounts; readonly counts: PopulationCounts; readonly sourceBindings: readonly string[];
  readonly candidateBindings: readonly { readonly path: string; readonly sha256: string }[];
  readonly accepted: readonly PopulationCase[]; readonly references: Readonly<Record<string, ImportReference>>;
  readonly received: number; readonly coverage: ReturnType<typeof populationCoverage>;
}
export interface PopulationBundle {
  readonly version: "1"; readonly policy: "final-population-admission-v2"; readonly state: "ready" | "incomplete";
  readonly createdAt: string; readonly implementation: Readonly<Record<string, string>>; readonly schedule: typeof POPULATION_SCHEDULE;
  readonly priorExposure: readonly { readonly path: string; readonly sha256: string }[];
  readonly controlExposure: { readonly path: string; readonly sha256: string };
  readonly strata: readonly { readonly requestedDepth: number; readonly path: string; readonly sha256: string;
    readonly received: number; readonly admitted: number; readonly counts: PopulationCounts }[];
  readonly counts: PopulationCounts; readonly admitted: number; readonly received: number;
  readonly coverage: ReturnType<typeof populationCoverage>;
  readonly exposure: { readonly exactCount: number; readonly coreCount: number; readonly simplifiedExactCount: number };
  readonly equivalenceStatus: "bounded-no-known-equivalence"; readonly pairwiseSemanticInequivalence: "unknown";
}

export function populationQuota(depthOrdinal: number): PopulationCounts {
  if (!Number.isSafeInteger(depthOrdinal) || depthOrdinal < 0 || depthOrdinal >= POPULATION_DEPTHS.length)
    throw new Error("Invalid population depth ordinal.");
  const quota = { convex: 33, concave: 33, neither: 33 };
  quota[LABELS[depthOrdinal % 3]]++;
  return quota;
}

export function populationCores(reference: ImportReference): string[] {
  return [...new Set([...(reference.coreHashes ?? []), ...(reference.shapeHash ? [reference.shapeHash] : [])])].sort();
}

export interface PopulationSelection {
  readonly exact: Set<string>; readonly simplified: Set<string>; readonly cores: Set<string>;
  readonly priorExact: Set<string>; readonly priorCores: Set<string>;
  readonly priorSimplified: Set<string>; readonly priorRelatedShapes: Set<string>;
}
export function populationDisposition(input: { exactHash: string; reference: ImportReference; diagnostics: PopulationDiagnosticResult;
  label: Label; counts: PopulationCounts; quota: PopulationCounts; selection: PopulationSelection }): Pick<PopulationCandidate, "disposition" | "reason"> {
  const { reference, diagnostics, selection } = input;
  const simplified = "simplifiedExactHash" in diagnostics ? diagnostics.simplifiedExactHash : null;
  if (selection.exact.has(input.exactHash) || simplified && selection.simplified.has(simplified))
    return { disposition: "duplicate", reason: selection.exact.has(input.exactHash) ? "exact-duplicate" : "bounded-simplified-duplicate" };
  if (selection.priorExact.has(input.exactHash) || populationCores(reference).some(core => selection.priorCores.has(core)) ||
    "simplifiedExactHash" in diagnostics && (selection.priorSimplified.has(diagnostics.simplifiedExactHash) || selection.priorRelatedShapes.has(diagnostics.relatedShapeHash)))
    return { disposition: "prior-exposure", reason: "known-development-expression-or-related-core" };
  if (reference.status !== "verified" || !simplified)
    return { disposition: "unverified", reason: reference.reason ?? ("reason" in diagnostics ? diagnostics.reason : "independent-reference-unverified") };
  if (input.counts[input.label] >= input.quota[input.label]) return { disposition: "quota-filled", reason: null };
  return { disposition: "admitted", reason: null };
}

function remember(selection: PopulationSelection, entry: PopulationCandidate) {
  selection.exact.add(entry.exactHash);
  for (const core of populationCores(entry.reference)) selection.cores.add(core);
  if ("simplifiedExactHash" in entry.diagnostics) selection.simplified.add(entry.diagnostics.simplifiedExactHash);
}

function acceptedCase(candidate: GeneratedCandidate, expression: string, entry: PopulationCandidate): PopulationCase {
  const reference = entry.reference;
  if (entry.disposition !== "admitted" || reference.status !== "verified" || !("simplifiedExactHash" in entry.diagnostics))
    throw new Error("Only independently certified, nonduplicate candidates may enter the frozen population.");
  return { id: `final-${entry.exactHash}`, label: candidate.label, expression, domain: IMPORT_DOMAIN,
    referenceSha256: pilotHash(reference), coreHashes: populationCores(reference), requestedDepth: candidate.requestedDepth,
    actualDepth: candidate.actualDepth, astDepth: reference.astDepth!, nonlinearPath: reference.nonlinearPath!, nodeCount: reference.nodeCount!,
    diagnostics: entry.diagnostics };
}

async function controlExposure() {
  const expression = CONTROL_EXPRESSION, reference = await certifyImported(expression, "convex"), diagnostics = await diagnosePopulationCase(expression);
  if (reference.status !== "verified" || !("simplifiedExactHash" in diagnostics)) throw new Error("Original compatibility control could not be certified for predeclared exclusion.");
  return { expression, domain: IMPORT_DOMAIN, reference, diagnostics, exposure: { exactHashes: [pilotHash({ expression, domain: IMPORT_DOMAIN })],
    coreHashes: populationCores(reference), simplifiedExactHashes: [diagnostics.simplifiedExactHash], relatedShapeHashes: [diagnostics.relatedShapeHash] } };
}

async function selectionFromPrior(paths: readonly string[], control: Awaited<ReturnType<typeof controlExposure>>): Promise<PopulationSelection> {
  if (paths.length < 2) throw new Error("Retain both the development proposal and earlier smoke exposure indices before generation.");
  const selection: PopulationSelection = { exact: new Set(), simplified: new Set(), cores: new Set(), priorExact: new Set(control.exposure.exactHashes),
    priorCores: new Set(control.exposure.coreHashes), priorSimplified: new Set(control.exposure.simplifiedExactHashes), priorRelatedShapes: new Set(control.exposure.relatedShapeHashes) };
  let completeProposals = false, completeSmokes = false;
  for (const path of paths) {
    const raw = JSON.parse(await readBoundedFile(path)), exposure: PriorExposure = raw.exposure;
    if (!exposure || ![exposure.exactHashes, exposure.coreHashes].every(items => Array.isArray(items) && items.length > 0 &&
      items.every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))))
      throw new Error("Known-development exposure index is missing complete bounded signatures.");
    if (raw.policy === "serial-import-admission-v1" && raw.candidates?.length === 24 && raw.sourceBindings?.length === 4 && exposure.exactHashes.length === 24)
      completeProposals = true;
    if (Array.isArray(raw.rows) && raw.rows.length === 12 && exposure.exactHashes.length === 12 &&
      raw.rows.every((row: SmokeExposureRow) => row && typeof row.exactHashOnDeclaredImportDomain === "string" && Array.isArray(row.coreHashes)) &&
      pilotHash([...new Set(raw.rows.map((row: SmokeExposureRow) => row.exactHashOnDeclaredImportDomain))].sort()) === pilotHash([...exposure.exactHashes].sort()) &&
      pilotHash([...new Set(raw.rows.flatMap((row: SmokeExposureRow) => row.coreHashes))].sort()) === pilotHash([...exposure.coreHashes].sort())) completeSmokes = true;
    for (const hash of exposure.exactHashes) selection.priorExact.add(hash);
    for (const hash of exposure.coreHashes) selection.priorCores.add(hash);
  }
  if (!completeProposals || !completeSmokes) throw new Error("Both the complete 24-proposal development index and 12-question smoke index are required.");
  return selection;
}

function emptyCounts(): PopulationCounts { return { convex: 0, concave: 0, neither: 0 }; }
function pathWithin(directory: string, relative: string) {
  if (typeof relative !== "string" || !relative || relative.startsWith("/") || relative.split(/[\\/]/).some(part => part === ".."))
    throw new Error("Population artifact path escapes its retained directory.");
  return join(directory, relative);
}

export async function preparePopulation(input: { checkout: string; python: string; output: string; priorExposurePaths: readonly string[];
  retainedBatchRoots?: Readonly<Partial<Record<number, string>>>; deadlineAt?: string; signal?: AbortSignal }): Promise<PopulationBundle> {
  const output = resolve(input.output), control = await controlExposure(), selection = await selectionFromPrior(input.priorExposurePaths, control);
  const implementation = await populationImplementation(), started = Date.now();
  const deadline = input.deadlineAt === undefined ? started + 7200000 : Date.parse(input.deadlineAt);
  if (!Number.isFinite(deadline) || deadline <= started || deadline > started + 7200000)
    throw new Error("Population deadline must be a future timestamp within the remaining two-hour feasibility window.");
  if (Object.keys(input.retainedBatchRoots ?? {}).some(key => !POPULATION_DEPTHS.some(depth => String(depth) === key)))
    throw new Error("A retained source root must belong to a prescribed final depth.");
  const retainedSources = Object.fromEntries(await Promise.all(Object.entries(input.retainedBatchRoots ?? {}).map(async ([depth, root]) => {
    if (typeof root !== "string" || !root) throw new Error("Retained source root is missing its declared directory.");
    return [depth, await retainedPopulationSource(root, Number(depth))];
  })));
  await mkdir(output, { mode: 0o700 });
  await writeArtifact(join(output, "control-exposure.json"), control);
  const controlBinding = { path: "control-exposure.json", sha256: pilotHash(control) };
  const priorExposure: { path: string; sha256: string }[] = [];
  for (let index = 0; index < input.priorExposurePaths.length; index++) {
    const retained = JSON.parse(await readBoundedFile(input.priorExposurePaths[index])), path = `prior-exposure-${index}.json`;
    await writeArtifact(join(output, path), retained); priorExposure.push({ path, sha256: pilotHash(retained) });
  }
  await writeArtifact(join(output, "schedule.json"), { version: "1", schedule: POPULATION_SCHEDULE, depths: POPULATION_DEPTHS,
    implementation, priorExposure, controlExposure: controlBinding, retainedSources, timeboxMs: 7200000, deadlineAt: new Date(deadline).toISOString(),
    domain: IMPORT_DOMAIN, ordering: "depth-then-batch-then-source-row-first-admitted-quota" });
  const strata: PopulationBundle["strata"][number][] = [], allCases: PopulationCase[] = [];
  let fatal: unknown;
  for (let depthOrdinal = 0; depthOrdinal < POPULATION_DEPTHS.length && !fatal; depthOrdinal++) {
    const requestedDepth = POPULATION_DEPTHS[depthOrdinal], relative = `depth-${requestedDepth}`, directory = join(output, relative);
    await mkdir(directory, { mode: 0o700 });
    const accepted: PopulationCase[] = [], references: Record<string, ImportReference> = {}, counts = emptyCounts(), quota = populationQuota(depthOrdinal);
    const sourceBindings: string[] = [], candidateBindings: { path: string; sha256: string }[] = [];
    try {
      for (let batchOrdinal = 0; batchOrdinal < POPULATION_SCHEDULE.batchesPerDepth; batchOrdinal++) {
        input.signal?.throwIfAborted();
        if (Date.now() >= deadline) throw new Error("Final population feasibility timebox exhausted; retained population is incomplete.");
        const retained = retainedSources[requestedDepth];
        const batch = populationBatchOrigin(batchOrdinal, retained?.completedBatches ?? 0) === "retained"
          ? await retainPopulationBatch({ root: retained.root, output: join(directory, `batch-${batchOrdinal}`), depthOrdinal, batchOrdinal })
          : await generatePopulationBatch({ ...input, output: join(directory, `batch-${batchOrdinal}`), depthOrdinal, batchOrdinal });
        sourceBindings.push(pilotHash(batch));
        for (const candidate of batch.candidates) {
          input.signal?.throwIfAborted();
          const expression = scalarDisplay(candidate.expression), exactHash = pilotHash({ expression, domain: IMPORT_DOMAIN });
          await writeArtifact(join(directory, `processing-${batchOrdinal}-${candidate.ordinal}.json`),
            { batch: batchOrdinal, ordinal: candidate.ordinal, label: candidate.label, exactHash, startedAt: new Date().toISOString() });
          const reference = await certifyImported(expression, candidate.label, input.signal);
          await writeArtifact(join(directory, `reference-${batchOrdinal}-${candidate.ordinal}.json`), reference);
          const diagnostics = await diagnosePopulationCase(expression, input.signal);
          await writeArtifact(join(directory, `diagnostics-${batchOrdinal}-${candidate.ordinal}.json`), diagnostics);
          const entry: PopulationCandidate = { batch: batchOrdinal, ordinal: candidate.ordinal, label: candidate.label, exactHash,
            expressionSha256: sha256(expression), originalDisplaySha256: sha256(candidate.expression), sourceTreeSha256: candidate.treeSha256,
            actualDepth: candidate.actualDepth, numericalStatus: candidate.numericalStatus, reference, diagnostics,
            ...populationDisposition({ exactHash, reference, diagnostics, label: candidate.label, counts, quota, selection }) };
          const path = `candidate-${batchOrdinal}-${candidate.ordinal}.json`;
          // Retain the independent outcome before exposing the next proposal to admission.
          await writeArtifact(join(directory, path), entry); candidateBindings.push({ path, sha256: pilotHash(entry) }); remember(selection, entry);
          if (entry.disposition === "admitted") {
            const task = acceptedCase(candidate, expression, entry);
            accepted.push(task); references[task.id] = reference; counts[candidate.label]++;
          }
        }
        console.log(JSON.stringify({ event: "population-batch-complete", requestedDepth, batchOrdinal,
          received: sourceBindings.length * POPULATION_SCHEDULE.perClass * 3, admitted: accepted.length, counts, quota }));
        if (accepted.length === 100) break;
      }
    } catch (error) { fatal = error; }
    const stratum: Stratum = { version: "1", requestedDepth, depthOrdinal, state: !fatal && accepted.length === 100 ? "ready" : "incomplete",
      quota, counts, sourceBindings, candidateBindings, accepted, references, received: sourceBindings.length * POPULATION_SCHEDULE.perClass * 3,
      coverage: populationCoverage(accepted) };
    await writeArtifact(join(directory, "stratum.json"), stratum);
    strata.push({ requestedDepth, path: `${relative}/stratum.json`, sha256: pilotHash(stratum), received: stratum.received, admitted: accepted.length, counts });
    allCases.push(...accepted);
    console.log(JSON.stringify({ event: "population-stratum-complete", requestedDepth, state: stratum.state,
      received: stratum.received, admitted: accepted.length, counts }));
  }
  const counts = emptyCounts(); for (const task of allCases) counts[task.label]++;
  const bundle: PopulationBundle = { version: "1", policy: "final-population-admission-v2", createdAt: new Date().toISOString(),
    state: !fatal && strata.length === 8 && strata.every(row => row.admitted === 100) ? "ready" : "incomplete", implementation,
    schedule: POPULATION_SCHEDULE, priorExposure, controlExposure: controlBinding, strata, counts, admitted: allCases.length, received: strata.reduce((sum, row) => sum + row.received, 0),
    coverage: populationCoverage(allCases), exposure: { exactCount: selection.exact.size, coreCount: selection.cores.size, simplifiedExactCount: selection.simplified.size },
    equivalenceStatus: "bounded-no-known-equivalence", pairwiseSemanticInequivalence: "unknown" };
  await writeArtifact(join(output, "population.json"), bundle);
  if (fatal) {
    await writeArtifact(join(output, "failure.json"), { state: "incomplete", reason: fatal instanceof Error ? fatal.message : "Population construction failed." });
    throw fatal;
  }
  return bundle;
}

async function readPopulation(path: string) {
  const bundle: PopulationBundle = JSON.parse(await readBoundedFile(path)), directory = dirname(resolve(path));
  if (bundle.version !== "1" || bundle.policy !== "final-population-admission-v2" || !["ready", "incomplete"].includes(bundle.state) ||
    pilotHash(bundle.schedule) !== pilotHash(POPULATION_SCHEDULE) || pilotHash(bundle.implementation) !== pilotHash(await populationImplementation()) ||
    !Array.isArray(bundle.strata) || bundle.strata.length > 8 || bundle.equivalenceStatus !== "bounded-no-known-equivalence" ||
    bundle.pairwiseSemanticInequivalence !== "unknown") throw new Error("Final population version, implementation or declared policy changed.");
  const strata: Stratum[] = [];
  for (const [index, binding] of bundle.strata.entries()) {
    const stratum: Stratum = JSON.parse(await readBoundedFile(pathWithin(directory, binding.path)));
    if (pilotHash(stratum) !== binding.sha256 || stratum.version !== "1" || stratum.depthOrdinal !== index ||
      stratum.requestedDepth !== POPULATION_DEPTHS[index] || binding.requestedDepth !== stratum.requestedDepth ||
      binding.admitted !== stratum.accepted.length || binding.received !== stratum.received || pilotHash(binding.counts) !== pilotHash(stratum.counts) ||
      pilotHash(stratum.quota) !== pilotHash(populationQuota(index)) || stratum.accepted.length > 100 || stratum.sourceBindings.length > POPULATION_SCHEDULE.batchesPerDepth ||
      stratum.received !== stratum.sourceBindings.length * POPULATION_SCHEDULE.perClass * 3 || stratum.candidateBindings.length > stratum.received ||
      !["ready", "incomplete"].includes(stratum.state) || stratum.state === "ready" &&
      (stratum.accepted.length !== 100 || stratum.candidateBindings.length !== stratum.received)) throw new Error("Retained population stratum binding or quota changed.");
    strata.push(stratum);
  }
  const cases = strata.flatMap(row => row.accepted), counts = emptyCounts(); for (const task of cases) counts[task.label]++;
  if (cases.length !== bundle.admitted || new Set(cases.map(row => row.id)).size !== cases.length || pilotHash(counts) !== pilotHash(bundle.counts) ||
    bundle.received !== strata.reduce((sum, row) => sum + row.received, 0) ||
    (bundle.state === "ready") !== (strata.length === 8 && strata.every(row => row.state === "ready")) ||
    bundle.state === "ready" && (bundle.admitted !== 800 || counts.convex !== 267 || counts.concave !== 267 || counts.neither !== 266))
    throw new Error("Final population completeness or shared label denominator changed.");
  for (const binding of bundle.priorExposure) {
    const retained = JSON.parse(await readBoundedFile(pathWithin(directory, binding.path)));
    if (pilotHash(retained) !== binding.sha256) throw new Error("Known-development exposure binding changed.");
  }
  const control = JSON.parse(await readBoundedFile(pathWithin(directory, bundle.controlExposure.path)));
  if (pilotHash(control) !== bundle.controlExposure.sha256 || control.expression !== CONTROL_EXPRESSION)
    throw new Error("Original compatibility control exposure binding changed.");
  return { bundle, directory, strata, cases };
}

export async function loadPopulationCases(path: string): Promise<readonly PopulationCase[]> {
  return (await readPopulation(path)).cases;
}

export async function replayPopulation(path: string, signal?: AbortSignal): Promise<PopulationBundle> {
  const { bundle, directory, strata, cases } = await readPopulation(path);
  const control = await controlExposure();
  if (pilotHash(control) !== bundle.controlExposure.sha256) throw new Error("Original compatibility control reference or diagnostics changed.");
  const selection = await selectionFromPrior(bundle.priorExposure.map(row => pathWithin(directory, row.path)), control);
  for (const [depthOrdinal, stratum] of strata.entries()) {
    const accepted: PopulationCase[] = [], counts = emptyCounts(), root = dirname(pathWithin(directory, bundle.strata[depthOrdinal].path));
    let processed = 0;
    for (let batchOrdinal = 0; batchOrdinal < stratum.sourceBindings.length; batchOrdinal++) {
      signal?.throwIfAborted();
      const batch = await replayPopulationBatch(join(root, `batch-${batchOrdinal}`), depthOrdinal, batchOrdinal);
      if (pilotHash(batch) !== stratum.sourceBindings[batchOrdinal] || batch.source.revision !== SOURCE_REVISION)
        throw new Error("Final source provenance binding changed.");
      for (const candidate of batch.candidates) {
        const binding = stratum.candidateBindings[processed++];
        if (!binding) {
          if (bundle.state === "incomplete") break;
          throw new Error("Complete population lost a received candidate outcome.");
        }
        const entry: PopulationCandidate = JSON.parse(await readBoundedFile(pathWithin(root, binding.path)));
        const expression = scalarDisplay(candidate.expression), reference = await certifyImported(expression, candidate.label, signal);
        const diagnostics = await diagnosePopulationCase(expression, signal), exactHash = pilotHash({ expression, domain: IMPORT_DOMAIN });
        const expected: PopulationCandidate = { batch: batchOrdinal, ordinal: candidate.ordinal, label: candidate.label, exactHash,
          expressionSha256: sha256(expression), originalDisplaySha256: sha256(candidate.expression), sourceTreeSha256: candidate.treeSha256,
          actualDepth: candidate.actualDepth, numericalStatus: candidate.numericalStatus, reference, diagnostics,
          ...populationDisposition({ exactHash, reference, diagnostics, label: candidate.label, counts, quota: stratum.quota, selection }) };
        if (pilotHash(entry) !== binding.sha256 || pilotHash(entry) !== pilotHash(expected)) throw new Error("Final proposal order, proof, diagnostics or first-admitted membership changed.");
        remember(selection, entry);
        if (entry.disposition === "admitted") {
          const task = acceptedCase(candidate, expression, entry);
          if (pilotHash(stratum.references[task.id]) !== pilotHash(reference)) throw new Error("Admitted exact-task reference changed.");
          accepted.push(task); counts[candidate.label]++;
        }
      }
      if (accepted.length === 100 && batchOrdinal !== stratum.sourceBindings.length - 1) throw new Error("Source generation continued after the prescribed quota was filled.");
    }
    if (pilotHash(accepted) !== pilotHash(stratum.accepted) || pilotHash(counts) !== pilotHash(stratum.counts) ||
      pilotHash(populationCoverage(accepted)) !== pilotHash(stratum.coverage)) throw new Error("Retained stratum membership or coverage changed.");
  }
  if (pilotHash(bundle.exposure) !== pilotHash({ exactCount: selection.exact.size, coreCount: selection.cores.size, simplifiedExactCount: selection.simplified.size }) ||
    pilotHash(populationCoverage(cases)) !== pilotHash(bundle.coverage)) throw new Error("Final exposure or effective coverage accounting changed.");
  return bundle;
}
