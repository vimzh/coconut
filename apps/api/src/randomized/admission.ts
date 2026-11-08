// Bind exact displayed scalar tasks to independently replayable references and complete exposure records.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ImportedCase } from "./types";
import { pilotHash } from "./pilot";
import { boundedProcess, generateSourceBatch, IMPORT_LIMITS, parseCandidateCsv, readBoundedFile, sha256, SOURCE_REVISION } from "./source";

const repository = new URL("../../../../", import.meta.url).pathname;
const referenceWorker = new URL("../../../../services/numerics/import_reference.py", import.meta.url).pathname;
const referencePython = new URL("../../../../services/numerics/.venv/bin/python", import.meta.url).pathname;
export const IMPORT_DOMAIN = Object.freeze({ min: "-1", max: "1" });

export interface ImportReference {
  readonly status: "verified" | "unverified" | "rejected";
  readonly policy: "deep-import-reference-v1";
  readonly expressionSha256: string;
  readonly domain: { readonly min: string; readonly max: string };
  readonly label: ImportedCase["label"];
  readonly astDepth?: number; readonly nonlinearPath?: number; readonly nodeCount?: number;
  readonly coreHashes?: readonly string[]; readonly proof?: unknown; readonly reason?: string;
  readonly shapeHash?: string;
}
export interface AdmissionEntry {
  readonly batch: number; readonly ordinal: number; readonly label: ImportedCase["label"];
  readonly expressionSha256: string; readonly originalDisplaySha256: string; readonly sourceTreeSha256: string;
  readonly actualDepth: number; readonly numericalStatus: string;
  readonly reference: ImportReference | null; readonly disposition: "admitted" | "duplicate" | "quota-filled" | "unverified";
  readonly reason: string | null;
}
export interface ImportBundle {
  readonly version: "1"; readonly policy: "serial-import-admission-v1";
  readonly state: "ready" | "incomplete"; readonly createdAt: string;
  readonly requestedDepth: number; readonly panelOrdinal: number;
  readonly domain: typeof IMPORT_DOMAIN; readonly normalization: "strip-outer-scalar-assignment-v1";
  readonly sourceBindings: readonly string[]; readonly implementation: Readonly<Record<string, string>>;
  readonly accepted: readonly ImportedCase[];
  readonly references: Readonly<Record<string, ImportReference>>;
  readonly candidates: readonly AdmissionEntry[];
  readonly exposure: { readonly exactHashes: readonly string[]; readonly coreHashes: readonly string[] };
}

export function scalarDisplay(expression: string): string {
  const prefix = "$f(x) = ";
  return expression.startsWith(prefix) && expression.endsWith("$") ? expression.slice(prefix.length, -1) : expression;
}

function relatedCores(reference: ImportReference): readonly string[] {
  return [...new Set([...(reference.coreHashes ?? []), ...(reference.shapeHash && /^[a-f0-9]{64}$/.test(reference.shapeHash) ? [reference.shapeHash] : [])])].sort();
}

export async function certifyImported(expression: string, label: ImportedCase["label"], signal?: AbortSignal): Promise<ImportReference> {
  const input = { expression, label, domain: IMPORT_DOMAIN };
  const text = await boundedProcess(referencePython, ["-I", referenceWorker], repository, IMPORT_LIMITS.referenceTimeoutMs, signal, JSON.stringify(input));
  const result: ImportReference = JSON.parse(text);
  if (!result || !["verified", "unverified", "rejected"].includes(result.status) || result.policy !== "deep-import-reference-v1" ||
    result.expressionSha256 !== sha256(expression) || result.label !== label || pilotHash(result.domain) !== pilotHash(IMPORT_DOMAIN))
    throw new Error("Independent reference identity does not match the exact displayed task.");
  if (result.status === "verified" && (!result.proof || !Number.isSafeInteger(result.astDepth) || result.astDepth! < 1 || result.astDepth! > 4096 ||
    !Number.isSafeInteger(result.nonlinearPath) || result.nonlinearPath! < 0 || result.nonlinearPath! > result.astDepth! ||
    !Number.isSafeInteger(result.nodeCount) || result.nodeCount! < 1 || result.nodeCount! > 16384 ||
    !Array.isArray(result.coreHashes) || result.coreHashes.some(value => !/^[a-f0-9]{64}$/.test(value))))
    throw new Error("Independent reference is missing bounded structure or proof evidence.");
  return result;
}

export async function importImplementation() {
  const names = ["services/numerics/import_syntax.py", "services/numerics/import_reference.py", "services/numerics/uv.lock", "apps/api/src/randomized/source.ts", "apps/api/src/randomized/admission.ts"];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, sha256(await readFile(join(repository, name)))])));
}

export async function prepareImportedPanel(input: { checkout: string; python: string; output: string; requestedDepth: number; panelOrdinal: number; signal?: AbortSignal }): Promise<ImportBundle> {
  if (!Number.isSafeInteger(input.requestedDepth) || input.requestedDepth < 1 || input.requestedDepth > 1000 ||
    !Number.isSafeInteger(input.panelOrdinal) || input.panelOrdinal < 1 || input.panelOrdinal > 9) throw new Error("Invalid bounded panel schedule.");
  const output = resolve(input.output), implementation = await importImplementation();
  await mkdir(output, { recursive: false, mode: 0o700 });
  await writeFile(join(output, "schedule.json"), JSON.stringify({ version: "1", requestedDepth: input.requestedDepth, panelOrdinal: input.panelOrdinal,
    seedRule: "140000 + 100*panelOrdinal + batchOrdinal", batches: 4, perClass: 2, domain: IMPORT_DOMAIN, limits: IMPORT_LIMITS, implementation }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const candidates: AdmissionEntry[] = [], accepted: ImportedCase[] = [], references: Record<string, ImportReference> = {}, sourceBindings: string[] = [];
  const exact = new Set<string>(), cores = new Set<string>();
  let fatal: unknown;
  try {
    for (let batchOrdinal = 0; batchOrdinal < 4; batchOrdinal++) {
      input.signal?.throwIfAborted();
      const batch = await generateSourceBatch({ ...input, output: join(output, `batch-${batchOrdinal}`), batchOrdinal });
      sourceBindings.push(pilotHash(batch));
      for (const candidate of batch.candidates) {
        input.signal?.throwIfAborted();
        const expression = scalarDisplay(candidate.expression), expressionSha256 = sha256(expression), identity = pilotHash({ expression, domain: IMPORT_DOMAIN });
        let reference: ImportReference | null = null, reason: string | null = null, processFailure: unknown;
        try { reference = await certifyImported(expression, candidate.label, input.signal); }
        catch (error) { input.signal?.throwIfAborted(); processFailure = error; reason = error instanceof Error ? error.message : "Reference process failed."; }
        for (const core of reference ? relatedCores(reference) : []) cores.add(core);
        const disposition = exact.has(identity) ? "duplicate" : reference?.status !== "verified" ? "unverified"
          : accepted.some(row => row.label === candidate.label) ? "quota-filled" : "admitted";
        exact.add(identity);
        candidates.push({ batch: batchOrdinal, ordinal: candidate.ordinal, label: candidate.label, expressionSha256,
          originalDisplaySha256: sha256(candidate.expression), sourceTreeSha256: candidate.treeSha256, actualDepth: candidate.actualDepth,
          numericalStatus: candidate.numericalStatus, reference, disposition, reason: reason ?? reference?.reason ?? null });
        if (disposition === "admitted") {
          const id = `imported-${identity}`;
          accepted.push({ id, label: candidate.label, expression, domain: IMPORT_DOMAIN, referenceSha256: pilotHash(reference),
            coreHashes: relatedCores(reference!), requestedDepth: candidate.requestedDepth, actualDepth: candidate.actualDepth,
            astDepth: reference!.astDepth!, nonlinearPath: reference!.nonlinearPath!, nodeCount: reference!.nodeCount! });
          references[id] = reference!;
        }
        // Each outcome is durable before proceeding to another proposal or source batch.
        await writeFile(join(output, `candidate-${batchOrdinal}-${candidate.ordinal}.json`), JSON.stringify(candidates.at(-1), null, 2) + "\n", { flag: "wx", mode: 0o600 });
        if (processFailure) throw processFailure;
      }
      if (accepted.length === 3) break;
    }
  } catch (error) { fatal = error; }
  const bundle: ImportBundle = { version: "1", policy: "serial-import-admission-v1", state: !fatal && accepted.length === 3 ? "ready" : "incomplete",
    createdAt: new Date().toISOString(), requestedDepth: input.requestedDepth, panelOrdinal: input.panelOrdinal, domain: IMPORT_DOMAIN,
    normalization: "strip-outer-scalar-assignment-v1", implementation, sourceBindings, accepted, references, candidates,
    exposure: { exactHashes: [...exact].sort(), coreHashes: [...cores].sort() } };
  await writeFile(join(output, "admission.json"), JSON.stringify(bundle, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  if (fatal) {
    await writeFile(join(output, "failure.json"), JSON.stringify({ reason: fatal instanceof Error ? fatal.message : "Import failed.", state: "incomplete" }) + "\n", { flag: "wx", mode: 0o600 });
    throw fatal;
  }
  return bundle;
}

export async function replayImportedPanel(path: string, signal?: AbortSignal, requireCompletePanel = true): Promise<ImportBundle> {
  const bundle: ImportBundle = JSON.parse(await readBoundedFile(path));
  if (bundle.version !== "1" || bundle.policy !== "serial-import-admission-v1" || !["ready", "incomplete"].includes(bundle.state) ||
    (requireCompletePanel && bundle.state !== "ready") || bundle.accepted.length > 3 ||
    new Set(bundle.accepted.map(row => row.label)).size !== bundle.accepted.length || (bundle.state === "ready") !== (bundle.accepted.length === 3) ||
    pilotHash(bundle.implementation) !== pilotHash(await importImplementation()) || pilotHash(bundle.domain) !== pilotHash(IMPORT_DOMAIN) ||
    bundle.sourceBindings.length < 1 || bundle.sourceBindings.length > 4 || bundle.candidates.length !== 6 * bundle.sourceBindings.length)
    throw new Error("A complete, unchanged, three-class independently admitted panel is required.");
  const directory = resolve(path, ".."), accepted: ImportedCase[] = [], exact = new Set<string>(), cores = new Set<string>();
  for (let batchOrdinal = 0; batchOrdinal < bundle.sourceBindings.length; batchOrdinal++) {
    const batch = JSON.parse(await readBoundedFile(join(directory, `batch-${batchOrdinal}`, "batch.json")));
    const csv = await readBoundedFile(join(directory, `batch-${batchOrdinal}`, `synthesized_depth${bundle.requestedDepth}_n1.csv`));
    const candidates = parseCandidateCsv(csv, bundle.requestedDepth);
    if (pilotHash(batch) !== bundle.sourceBindings[batchOrdinal] || batch.source.revision !== SOURCE_REVISION || batch.sourceFileSha256 !== sha256(csv) ||
      batch.requestedDepth !== bundle.requestedDepth || batch.panelOrdinal !== bundle.panelOrdinal || batch.batchOrdinal !== batchOrdinal ||
      batch.seed !== 140000 + 100 * bundle.panelOrdinal + batchOrdinal || pilotHash(batch.candidates) !== pilotHash(candidates))
      throw new Error("Retained source batch or ordinal schedule changed.");
    for (const candidate of candidates) {
      const entry = bundle.candidates[batchOrdinal * 6 + candidate.ordinal], expression = scalarDisplay(candidate.expression);
      const identity = pilotHash({ expression, domain: IMPORT_DOMAIN }), reference = await certifyImported(expression, candidate.label, signal);
      const disposition = exact.has(identity) ? "duplicate" : reference.status !== "verified" ? "unverified"
        : accepted.some(row => row.label === candidate.label) ? "quota-filled" : "admitted";
      if (entry.batch !== batchOrdinal || entry.ordinal !== candidate.ordinal || entry.label !== candidate.label || entry.expressionSha256 !== sha256(expression) ||
        entry.originalDisplaySha256 !== sha256(candidate.expression) || entry.sourceTreeSha256 !== candidate.treeSha256 || entry.actualDepth !== candidate.actualDepth ||
        entry.disposition !== disposition || pilotHash(entry.reference) !== pilotHash(reference)) throw new Error("Candidate order, selection or independent replay changed.");
      exact.add(identity); for (const core of relatedCores(reference)) cores.add(core);
      if (disposition === "admitted") {
        const id = `imported-${identity}`;
        accepted.push({ id, label: candidate.label, expression, domain: IMPORT_DOMAIN, referenceSha256: pilotHash(reference), coreHashes: relatedCores(reference),
          requestedDepth: candidate.requestedDepth, actualDepth: candidate.actualDepth, astDepth: reference.astDepth!, nonlinearPath: reference.nonlinearPath!, nodeCount: reference.nodeCount! });
        if (pilotHash(bundle.references[id]) !== pilotHash(reference)) throw new Error("Accepted reference binding changed.");
      }
    }
    if (accepted.length === 3 && batchOrdinal !== bundle.sourceBindings.length - 1) throw new Error("Generation continued after the first admitted panel.");
  }
  if (pilotHash(accepted) !== pilotHash(bundle.accepted) || pilotHash(bundle.exposure) !== pilotHash({ exactHashes: [...exact].sort(), coreHashes: [...cores].sort() }))
    throw new Error("First-admitted membership or exposure accounting changed.");
  return bundle;
}

export function checkImportExposure(tasks: readonly Pick<ImportedCase, "id" | "expression" | "domain" | "coreHashes">[], prior: readonly ImportBundle["exposure"][]) {
  const exact = new Set(prior.flatMap(row => row.exactHashes)), cores = new Set(prior.flatMap(row => row.coreHashes));
  return {
    exactMatches: tasks.filter(task => exact.has(pilotHash({ expression: task.expression, domain: task.domain }))).map(task => task.id),
    relatedCores: tasks.filter(task => task.coreHashes.some(core => cores.has(core))).map(task => task.id),
    limitation: "Exact and significant structural-core checks do not prove mathematical independence or absence of public/training exposure.",
  };
}
