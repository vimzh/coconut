// Run a pinned external generator without importing its implementation or provider dependencies.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const SOURCE_REVISION = "6f156c8c9b6b0b85f6a191bd4eb912e12e670082";
export const IMPORT_LIMITS = Object.freeze({ fileBytes: 64 * 1024 * 1024, fieldCharacters: 16 * 1024 * 1024,
  expressionCharacters: 131072, proposalsPerPanel: 24, batchTimeoutMs: 120000, referenceTimeoutMs: 20000 });
export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export function boundedProcess(command: string, args: readonly string[], cwd: string, timeout: number, signal?: AbortSignal, input = ""): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = execFile(command, [...args], { cwd, timeout, killSignal: "SIGKILL", maxBuffer: 1048576, signal,
      env: { PATH: process.env.PATH, LANG: "C.UTF-8", PYTHONNOUSERSITE: "1", PYTHONHASHSEED: "0" } }, (error, stdout) => {
      if (error) reject(new Error(`External process failed (${error.code ?? "interrupted"}); inspect the retained batch receipt.`));
      else resolvePromise(stdout);
    });
    child.stdin?.on("error", () => reject(new Error("External process closed its input before completion.")));
    child.stdin?.end(input);
  });
}

export interface GeneratedCandidate {
  readonly ordinal: number; readonly expression: string; readonly treeSha256: string;
  readonly requestedDepth: number; readonly actualDepth: number; readonly sourceNodes: number;
  readonly label: "convex" | "concave" | "neither"; readonly numericalStatus: "verified" | "not_evaluable";
}

// RFC-style quoted fields permit the generator's multiline tree presentation, never executable input.
export function parseCandidateCsv(text: string, requestedDepth: number, perClass = 2): readonly GeneratedCandidate[] {
  if (!Number.isSafeInteger(requestedDepth) || requestedDepth < 1 || requestedDepth > 1000 ||
      !Number.isSafeInteger(perClass) || perClass < 1 || perClass > 8 || Buffer.byteLength(text) > IMPORT_LIMITS.fileBytes)
    throw new Error("Invalid bounded source population.");
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const pushField = () => { row.push(field); field = ""; closed = false; if (row.length > 6) throw new Error("Too many CSV fields."); };
  for (let index = 0; index < text.length; index++) {
    const c = text[index];
    if (quoted) {
      if (c === '"') { if (text[index + 1] === '"') { field += '"'; index++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === '"') { if (field !== "" || closed) throw new Error("Invalid CSV quoting."); quoted = true; }
    else if (c === ",") pushField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[index + 1] === "\n") index++;
      pushField(); rows.push(row); row = [];
      if (rows.length > perClass * 3 + 1) throw new Error("Too many source rows.");
    } else { if (closed) throw new Error("Trailing text after a quoted field."); field += c; }
    if (field.length > IMPORT_LIMITS.fieldCharacters) throw new Error("CSV field exceeds the finite import bound.");
  }
  if (quoted) throw new Error("Unterminated CSV field.");
  if (field !== "" || row.length || closed) { pushField(); rows.push(row); }
  if (JSON.stringify(rows.shift()) !== JSON.stringify(["latex", "tree", "depth", "nodes", "convexity", "jensen"]) || rows.length !== perClass * 3)
    throw new Error("Source schema or complete class population does not match.");
  return rows.map((values, ordinal) => {
    const [expression, tree, depthText, nodesText, label, numericalStatus] = values;
    const actualDepth = Number(depthText), sourceNodes = Number(nodesText);
    if (values.length !== 6 || !expression || expression.length > IMPORT_LIMITS.expressionCharacters || !tree ||
      !/^\d+$/.test(depthText) || ![requestedDepth, requestedDepth + 1].includes(actualDepth) ||
      !/^\d+$/.test(nodesText) || !Number.isSafeInteger(sourceNodes) || sourceNodes < 1 || sourceNodes > 16384 ||
      label !== ["convex", "concave", "neither"][Math.floor(ordinal / perClass)] ||
      !["verified", "not_evaluable"].includes(numericalStatus)) throw new Error("Source row violates its frozen depth, class or size contract.");
    return { ordinal, expression, treeSha256: sha256(tree), requestedDepth, actualDepth, sourceNodes,
      label: label as GeneratedCandidate["label"], numericalStatus: numericalStatus as GeneratedCandidate["numericalStatus"] };
  });
}

export async function readBoundedFile(path: string): Promise<string> {
  const info = await lstat(path);
  if (!info.isFile() || info.size > IMPORT_LIMITS.fileBytes) throw new Error("Source file is missing, linked or oversized.");
  const bytes = await readFile(path);
  if (bytes.length > IMPORT_LIMITS.fileBytes) throw new Error("Source file exceeded its bound while reading.");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function inspectSource(checkout: string, python: string) {
  const directory = resolve(checkout);
  const revision = (await boundedProcess("git", ["rev-parse", "HEAD"], directory, 10000)).trim();
  const status = (await boundedProcess("git", ["status", "--porcelain", "--untracked-files=all"], directory, 10000)).trim();
  if (revision !== SOURCE_REVISION || status.split("\n").some(line => line && line !== "?? uv.lock"))
    throw new Error("The external checkout must match the clean pinned source revision.");
  const files = (await boundedProcess("git", ["ls-files", "-z"], directory, 10000)).split("\0").filter(Boolean);
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const info = await lstat(join(directory, file));
    if (!info.isFile() || info.size > IMPORT_LIMITS.fileBytes) throw new Error("Invalid pinned source file.");
    hashes[file] = sha256(await readFile(join(directory, file)));
  }
  const environment = JSON.parse(await boundedProcess(python, ["-c", "import sys,importlib.metadata as m,json;print(json.dumps({'python':sys.version.split()[0],'packages':{d.metadata['Name']:d.version for d in m.distributions()}}))"], directory, 20000));
  if (environment.python !== "3.13.17" || environment.packages.numpy !== "2.1.2" || environment.packages.pandas !== "2.3.1" || environment.packages.tqdm !== "4.67.1")
    throw new Error("Use the recorded isolated generation interpreter and dependency versions.");
  return { revision, files: hashes, environment, permission: "not-declared-no-redistribution" };
}

export async function generateSourceBatch(input: { checkout: string; python: string; output: string; requestedDepth: number; panelOrdinal: number; batchOrdinal: number; signal?: AbortSignal }) {
  const { requestedDepth, panelOrdinal, batchOrdinal } = input;
  if (![requestedDepth, panelOrdinal, batchOrdinal].every(Number.isSafeInteger) || requestedDepth < 1 || requestedDepth > 1000 || panelOrdinal < 1 || panelOrdinal > 9 || batchOrdinal < 0 || batchOrdinal > 3)
    throw new Error("Invalid frozen generation schedule.");
  const source = await inspectSource(input.checkout, input.python), output = resolve(input.output);
  await mkdir(output, { recursive: false, mode: 0o700 });
  const seed = 140000 + panelOrdinal * 100 + batchOrdinal;
  const args = ["scripts/generate_dataset.py", "--depths", String(requestedDepth), "--n-per-class", "2", "--seed", String(seed), "--dim", "1", "--max-children", "2", "--attempts-per-instance", "20", "--out", output];
  const receipt = { version: "1", policy: "external-serial-source-v1", requestedDepth, panelOrdinal, batchOrdinal, seed, source, args, startedAt: new Date().toISOString() };
  await writeFile(join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  try {
    const stdout = await boundedProcess(input.python, args, resolve(input.checkout), IMPORT_LIMITS.batchTimeoutMs, input.signal);
    if (sha256(JSON.stringify(await inspectSource(input.checkout, input.python))) !== sha256(JSON.stringify(source)))
      throw new Error("Pinned source or generation environment changed during the batch.");
    const path = join(output, `synthesized_depth${requestedDepth}_n1.csv`), text = await readBoundedFile(path);
    const candidates = parseCandidateCsv(text, requestedDepth);
    const result = { ...receipt, state: "complete", finishedAt: new Date().toISOString(), sourceFileSha256: sha256(text), stdout, candidates };
    await writeFile(join(output, "batch.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return result;
  } catch (error) {
    await writeFile(join(output, "failure.json"), JSON.stringify({ state: "failed", finishedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : "Generation failed." }) + "\n", { flag: "wx", mode: 0o600 });
    throw error;
  }
}
