// Generate finite, balanced certified imports and replay the exact displayed tasks.
import { chmod, lstat, mkdir, open, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { certifyImported, IMPORT_DOMAIN, importImplementation, scalarDisplay } from "../../apps/api/src/randomized/admission";
import { boundedProcess, IMPORT_LIMITS, inspectSource, parseCandidateCsv, readBoundedFile, sha256, SOURCE_REVISION } from "../../apps/api/src/randomized/source";
import { sameData, sha256 as hash } from "../../apps/api/src/quality/data";
import type { ImportReference, ImportedCase, TasksArtifact, TasksBatch, TasksLedgerEntry, TasksRequest } from "./types";

export const TASKS_FILE_BYTES = 256 * 1024 * 1024;
const LABELS = ["convex", "concave", "neither"] as const;
const integer = (value: number, min: number, max: number) => Number.isSafeInteger(value) && value >= min && value <= max;
export function validateRequest(request: TasksRequest): void {
  if (!request || !Array.isArray(request.depths) || !request.depths.length || request.depths.length > 1000 ||
      request.depths.some(depth => !integer(depth, 1, 1000)) || new Set(request.depths).size !== request.depths.length ||
      !integer(request.casesPerDepth, 1, 1000) || request.depths.length * request.casesPerDepth > 1000 ||
      !integer(request.seed, 0, 0xffffffff) || !integer(request.maxBatches, 1, 128))
    throw new Error("Use unique depths 1..1000, cases-per-depth 1..1000, at most 1000 total cases, uint32 seed and max-batches 1..128.");
  if (!sameData(Object.keys(request).sort(), ["casesPerDepth", "depths", "maxBatches", "seed"])) throw new Error("Unknown generation request fields.");
}
export const batchSeed = (seed: number, depthOrdinal: number, batch: number): number =>
  Number.parseInt(sha256(`configurable-import-tasks-v1:${seed}:${depthOrdinal}:${batch}`).slice(0, 8), 16);
export function classQuota(count: number, depthOrdinal: number): Record<ImportedCase["label"], number> {
  const quotas = { convex: Math.floor(count / 3), concave: Math.floor(count / 3), neither: Math.floor(count / 3) };
  for (let i = 0; i < count % 3; i++) quotas[LABELS[(depthOrdinal + i) % 3]]++;
  return quotas;
}
function taskFor(expression: string, candidate: TasksBatch["candidates"][number], reference: ImportReference): ImportedCase {
  if (reference.status !== "verified" || reference.expressionSha256 !== sha256(expression) || reference.label !== candidate.label ||
      !sameData(reference.domain, IMPORT_DOMAIN) || reference.policy !== "deep-import-reference-v1" || !reference.proof ||
      !integer(reference.astDepth!, 1, 4096) || !integer(reference.nonlinearPath!, 0, reference.astDepth!) || !integer(reference.nodeCount!, 1, 16384) ||
      !Array.isArray(reference.coreHashes) || reference.coreHashes.some(value => !/^[a-f0-9]{64}$/.test(value)) ||
      (reference.shapeHash !== undefined && !/^[a-f0-9]{64}$/.test(reference.shapeHash)))
    throw new Error("Verified reference lacks exact identity, structure or proof evidence.");
  const coreHashes = [...new Set([...reference.coreHashes, ...(reference.shapeHash ? [reference.shapeHash] : [])])].sort();
  return { id: `task-${hash({ expression, domain: IMPORT_DOMAIN })}`, label: candidate.label, expression, domain: IMPORT_DOMAIN,
    referenceSha256: hash(reference), coreHashes, requestedDepth: candidate.requestedDepth, actualDepth: candidate.actualDepth,
    astDepth: reference.astDepth!, nonlinearPath: reference.nonlinearPath!, nodeCount: reference.nodeCount! };
}
export interface GenerationDependencies {
  readonly certify: typeof certifyImported;
  readonly source: unknown;
  readonly implementation: Readonly<Record<string, string>>;
  readonly batch: (depth: number, depthOrdinal: number, batch: number, seed: number) => Promise<{ csv: string }>;
}
function finish(content: Omit<TasksArtifact, "id">): TasksArtifact { return { ...content, id: `tasks-${hash(content)}` }; }
export async function generatePopulation(request: TasksRequest, dependencies: GenerationDependencies, signal?: AbortSignal): Promise<TasksArtifact> {
  validateRequest(request);
  const cases: ImportedCase[] = [], references: Record<string, ImportReference> = {}, batches: TasksBatch[] = [], ledger: TasksLedgerEntry[] = [];
  const exact = new Set<string>(); let failure: string | null = null;
  try {
    for (const [depthOrdinal, depth] of request.depths.entries()) {
      const quota = classQuota(request.casesPerDepth, depthOrdinal), counts = { convex: 0, concave: 0, neither: 0 };
      for (let batch = 0; batch < request.maxBatches && LABELS.some(label => counts[label] < quota[label]); batch++) {
        signal?.throwIfAborted(); const seed = batchSeed(request.seed, depthOrdinal, batch);
        const { csv } = await dependencies.batch(depth, depthOrdinal, batch, seed);
        const candidates = parseCandidateCsv(csv, depth, 4);
        batches.push({ depthOrdinal, batch, seed, csvSha256: sha256(csv), candidates });
        for (const candidate of candidates) {
          signal?.throwIfAborted();
          const expression = scalarDisplay(candidate.expression), expressionSha256 = sha256(expression);
          let disposition: TasksLedgerEntry["disposition"], reason: string | null = null, task: ImportedCase | null = null;
          if (exact.has(expressionSha256)) disposition = "duplicate";
          else if (counts[candidate.label] >= quota[candidate.label]) disposition = "quota-filled";
          else {
            let reference: ImportReference;
            try { reference = await dependencies.certify(expression, candidate.label, signal); }
            catch (error) {
              ledger.push({ depthOrdinal, batch, seed, ordinal: candidate.ordinal, label: candidate.label, expressionSha256,
                disposition: "unverified", caseId: null, reason: error instanceof Error ? error.message : "Reference process failed." });
              throw error;
            }
            if (reference.status !== "verified") { disposition = "unverified"; reason = reference.reason ?? reference.status; }
            else { task = taskFor(expression, candidate, reference); disposition = "admitted"; counts[candidate.label]++; cases.push(task); references[task.id] = reference; }
          }
          exact.add(expressionSha256);
          ledger.push({ depthOrdinal, batch, seed, ordinal: candidate.ordinal, label: candidate.label, expressionSha256, disposition, caseId: task?.id ?? null, reason });
        }
      }
      if (LABELS.some(label => counts[label] !== quota[label])) throw new Error(`Depth ${depth} exhausted ${request.maxBatches} batches before its class quotas were filled.`);
    }
  } catch (error) { failure = error instanceof Error ? error.message : "Generation failed."; }
  cases.sort((a, b) => request.depths.indexOf(a.requestedDepth) - request.depths.indexOf(b.requestedDepth) || LABELS.indexOf(a.label) - LABELS.indexOf(b.label));
  return finish({ version: "1", policy: "configurable-import-tasks-v1", state: failure ? "incomplete" : "complete", request: structuredClone(request), domain: IMPORT_DOMAIN,
    provenance: { source: dependencies.source, implementation: dependencies.implementation, permissions: "private-local-only-export-permissions-unresolved" }, cases, references, batches, ledger, failure });
}

export async function verifyTasks(artifact: TasksArtifact, certify = certifyImported, signal?: AbortSignal, readBatch?: (batch: TasksBatch) => Promise<string>): Promise<TasksArtifact> {
  if (!artifact || artifact.version !== "1" || artifact.policy !== "configurable-import-tasks-v1" || artifact.state !== "complete" || artifact.failure !== null)
    throw new Error("A complete certified task artifact is required for inference.");
  validateRequest(artifact.request);
  const { id, ...content } = artifact;
  if (id !== finish(content).id || !sameData(artifact.domain, IMPORT_DOMAIN) || artifact.provenance?.permissions !== "private-local-only-export-permissions-unresolved" ||
      !sameData(artifact.provenance.implementation, await implementationIdentity()) ||
      !artifact.provenance.source || (artifact.provenance.source as { revision?: string }).revision !== SOURCE_REVISION ||
      !Array.isArray(artifact.cases) || artifact.cases.length !== artifact.request.depths.length * artifact.request.casesPerDepth ||
      !Array.isArray(artifact.batches) || artifact.batches.length > artifact.request.depths.length * artifact.request.maxBatches || !Array.isArray(artifact.ledger))
    throw new Error("Task identity, implementation, domain or population changed.");
  let cursor = 0;
  // Rebuild selection from retained CSV rows; this also binds all seeds and requested/source depths.
  const replay = await generatePopulation(artifact.request, { source: artifact.provenance.source, implementation: artifact.provenance.implementation, certify,
    batch: async (depth, depthOrdinal, batch, seed) => {
      const retained = artifact.batches[cursor++];
      if (!retained || retained.depthOrdinal !== depthOrdinal || retained.batch !== batch || retained.seed !== seed ||
          !Array.isArray(retained.candidates) || retained.candidates.length !== 12 || !/^[a-f0-9]{64}$/.test(retained.csvSha256)) throw new Error("Retained generation schedule changed.");
      if (!readBatch) throw new Error("Retained CSV batch evidence is required for replay.");
      const csv = await readBatch(retained);
      if (typeof csv !== "string" || sha256(csv) !== retained.csvSha256 || !sameData(parseCandidateCsv(csv, depth, 4), retained.candidates))
        throw new Error("Retained candidate metadata or CSV hash changed.");
      return { csv };
    } }, signal);
  if (cursor !== artifact.batches.length || !sameData(replay, artifact)) throw new Error("Task selection, certificates, counts or structural metadata changed during independent replay.");
  return artifact;
}
export async function implementationIdentity(): Promise<Record<string, string>> {
  const inherited = await importImplementation();
  for (const name of ["scripts/tasks/population.ts", "scripts/tasks/types.ts"]) inherited[name] = sha256(await readFile(new URL(`../../${name}`, import.meta.url)));
  return inherited;
}
export async function loadTasks(path: string, signal?: AbortSignal): Promise<TasksArtifact> {
  signal?.throwIfAborted();
  const info = await lstat(path);
  if (!info.isFile() || info.size > TASKS_FILE_BYTES) throw new Error("Task input must be an unlinked file no larger than 256 MiB.");
  const bytes = await readFile(path);
  if (bytes.length > TASKS_FILE_BYTES) throw new Error("Task input grew beyond 256 MiB while reading.");
  const artifact: TasksArtifact = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const evidence = `${resolve(path)}.evidence`, parent = await realpath(dirname(evidence));
  if (!(await lstat(evidence)).isDirectory() || await realpath(evidence) !== join(parent, evidence.slice(evidence.lastIndexOf(sep) + 1)))
    throw new Error("Generation evidence must be an unlinked sibling directory.");
  validateRequest(artifact.request);
  if (!Array.isArray(artifact.batches) || artifact.batches.length > artifact.request.depths.length * artifact.request.maxBatches)
    throw new Error("Retained batch population exceeds the request bounds.");
  const requestReceipt = JSON.parse(await readBoundedFile(join(evidence, "request.json")));
  if (!sameData(requestReceipt, { request: artifact.request, source: artifact.provenance.source, implementation: artifact.provenance.implementation }))
    throw new Error("Original generation request receipt changed or disagrees with the artifact.");
  if (!sameData(JSON.parse(await readBoundedFile(join(evidence, "ledger.json"))), artifact.ledger))
    throw new Error("Original admission ledger changed or disagrees with the artifact.");
  let originalEvidence: string | null = null;
  // Check every original receipt before starting any reference subprocess. Historical output paths permit relocation.
  for (const batch of artifact.batches) {
    signal?.throwIfAborted();
    if (!integer(batch.depthOrdinal, 0, artifact.request.depths.length - 1) || !integer(batch.batch, 0, artifact.request.maxBatches - 1) ||
        batch.seed !== batchSeed(artifact.request.seed, batch.depthOrdinal, batch.batch)) throw new Error("Original batch schedule changed.");
    const depth = artifact.request.depths[batch.depthOrdinal], name = `depth-${batch.depthOrdinal}-batch-${batch.batch}`;
    const directory = join(evidence, name);
    if (!(await lstat(directory)).isDirectory() || await realpath(directory) !== join(await realpath(evidence), name)) throw new Error("Linked batch evidence is forbidden.");
    const receipt = JSON.parse(await readBoundedFile(join(directory, "receipt.json")));
    const originalOutput = Array.isArray(receipt.args) ? receipt.args.at(-1) : null;
    if (typeof originalOutput !== "string" || !isAbsolute(originalOutput) || resolve(originalOutput) !== originalOutput || basename(originalOutput) !== name ||
        !basename(dirname(originalOutput)).endsWith(".evidence") || (originalEvidence !== null && dirname(originalOutput) !== originalEvidence) ||
        !sameData(receipt, { depth, depthOrdinal: batch.depthOrdinal, batch: batch.batch, seed: batch.seed, args: generatorArgs(depth, batch.seed, originalOutput) }))
      throw new Error("Original batch receipt or generator arguments changed.");
    originalEvidence = dirname(originalOutput);
  }
  return verifyTasks(artifact, certifyImported, signal, async batch => {
    const depth = artifact.request.depths[batch.depthOrdinal];
    const directory = join(evidence, `depth-${batch.depthOrdinal}-batch-${batch.batch}`);
    if (!(await lstat(directory)).isDirectory() || await realpath(directory) !== join(await realpath(evidence), `depth-${batch.depthOrdinal}-batch-${batch.batch}`)) throw new Error("Linked batch evidence is forbidden.");
    return readBoundedFile(join(directory, `synthesized_depth${depth}_n1.csv`));
  });
}
function generatorArgs(depth: number, seed: number, directory: string): string[] {
  return ["scripts/generate_dataset.py", "--depths", String(depth), "--n-per-class", "4", "--seed", String(seed), "--dim", "1", "--max-children", "2", "--attempts-per-instance", "20", "--out", directory];
}
async function privateTree(directory: string): Promise<void> {
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await privateTree(join(directory, entry.name));
    else if (entry.isFile()) await chmod(join(directory, entry.name), 0o600);
    else throw new Error("Unexpected linked generation evidence.");
  }
}
export async function generateTasks(input: { request: TasksRequest; output: string; source: string; python: string; signal?: AbortSignal }): Promise<TasksArtifact> {
  validateRequest(input.request);
  if (!input.source || !input.python) throw new Error("Supply --source and --python, or COCONUT_GENERATOR_SOURCE and COCONUT_GENERATOR_PYTHON; use the pinned external checkout and isolated interpreter.");
  for (const path of [input.output, `${input.output}.evidence`]) {
    try { await lstat(path); throw new Error("Output or evidence already exists; choose a new JSON path."); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const source = await inspectSource(input.source, input.python), implementation = await implementationIdentity();
  const output = resolve(input.output), evidence = `${output}.evidence`, handle = await open(output, "wx", 0o600);
  try {
    await mkdir(evidence, { mode: 0o700 });
    await writeFile(join(evidence, "request.json"), JSON.stringify({ request: input.request, source, implementation }), { flag: "wx", mode: 0o600 });
    const artifact = await generatePopulation(input.request, { source, implementation, certify: certifyImported,
      batch: async (depth, depthOrdinal, batch, seed) => {
        const directory = join(evidence, `depth-${depthOrdinal}-batch-${batch}`); await mkdir(directory, { mode: 0o700 });
        const args = generatorArgs(depth, seed, directory);
        await writeFile(join(directory, "receipt.json"), JSON.stringify({ depth, depthOrdinal, batch, seed, args }), { flag: "wx", mode: 0o600 });
        try {
          const stdout = await boundedProcess(input.python, args, resolve(input.source), IMPORT_LIMITS.batchTimeoutMs, input.signal);
          await writeFile(join(directory, "stdout.txt"), stdout, { flag: "wx", mode: 0o600 });
          if (!sameData(source, await inspectSource(input.source, input.python))) throw new Error("Source or environment changed during generation.");
          return { csv: await readBoundedFile(join(directory, `synthesized_depth${depth}_n1.csv`)) };
        } finally { await privateTree(directory); }
      } }, input.signal);
    const text = JSON.stringify(artifact, null, 2) + "\n";
    if (Buffer.byteLength(text) > TASKS_FILE_BYTES) throw new Error("Task artifact exceeded the 256 MiB bound; retained batch evidence remains available.");
    await handle.writeFile(text); await handle.sync();
    await writeFile(join(evidence, "ledger.json"), JSON.stringify(artifact.ledger), { flag: "wx", mode: 0o600 });
    if (artifact.state !== "complete") await writeFile(join(evidence, "failure.json"), JSON.stringify({ reason: artifact.failure }), { flag: "wx", mode: 0o600 });
    return artifact;
  } catch (error) {
    await writeFile(join(evidence, "failure.json"), JSON.stringify({ reason: error instanceof Error ? error.message : "Generation failed." }), { flag: "wx", mode: 0o600 }).catch(() => {});
    throw error;
  } finally { await handle.close(); }
}
