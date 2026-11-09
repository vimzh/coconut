// Admission/replay tests exercise finite selection without a provider or external checkout.
import { describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { certifyImported, IMPORT_DOMAIN } from "../../apps/api/src/randomized/admission";
import { sha256, SOURCE_REVISION } from "../../apps/api/src/randomized/source";
import { sha256 as hash } from "../../apps/api/src/quality/data";
import { batchSeed, classQuota, generatePopulation, generateTasks, implementationIdentity, loadTasks, validateRequest, verifyTasks } from "./population";
import { main } from "../tasks";
import type { ImportedCase, ImportReference, TasksArtifact, TasksRequest } from "./types";
type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const request: TasksRequest = { depths: [5, 40, 512], casesPerDepth: 4, seed: 42, maxBatches: 2 };
const labels = ["convex", "concave", "neither"] as const;
function csv(depth: number, ordinal: number, batch: number, duplicate = false): string {
  return "latex,tree,depth,nodes,convexity,jensen\n" + labels.flatMap(label => Array.from({ length: 4 }, (_, index) =>
    `"${duplicate ? "same" : `${ordinal}_${batch}_${label}_${index}`}^2",tree,${depth},3,${label},verified`)).join("\n") + "\n";
}
async function certificate(expression: string, label: ImportedCase["label"]): Promise<ImportReference> {
  return { status: "verified", policy: "deep-import-reference-v1", expressionSha256: sha256(expression), domain: IMPORT_DOMAIN, label,
    astDepth: 2, nonlinearPath: 1, nodeCount: 3, coreHashes: [sha256(expression)], proof: { test: true } };
}
async function population(input = request, certify = certificate, duplicate = false) {
  return generatePopulation(input, { source: { revision: SOURCE_REVISION }, implementation: await implementationIdentity(), certify,
    batch: async (depth, ordinal, batch) => ({ csv: csv(depth, ordinal, batch, duplicate) }) });
}
function rehash(artifact: TasksArtifact): TasksArtifact { const { id: _id, ...content } = artifact; void _id; return { ...content, id: `tasks-${hash(content)}` }; }

describe("configurable certified populations", () => {
  it("is deterministic, preserves input depth order and rotates balanced remainders", async () => {
    const result = await population(); expect(result).toEqual(await population()); expect(result.state).toBe("complete");
    expect(result.cases.map(row => row.requestedDepth)).toEqual([5, 5, 5, 5, 40, 40, 40, 40, 512, 512, 512, 512]);
    expect(result.cases.map(row => row.label)).toEqual(["convex", "convex", "concave", "neither", "convex", "concave", "concave", "neither", "convex", "concave", "neither", "neither"]);
    expect(classQuota(2, 2)).toEqual({ convex: 1, concave: 0, neither: 1 });
    expect(batchSeed(42, 0, 0)).not.toBe(batchSeed(42, 1, 0)); expect(batchSeed(42, 0, 0)).not.toBe(batchSeed(42, 0, 1));
    expect(await verifyTasks(result, certificate, undefined, async batch => csv(result.request.depths[batch.depthOrdinal], batch.depthOrdinal, batch.batch))).toEqual(result);
  });
  it("admits the requested 800-task population without a hidden small-panel cap", async () => {
    const result = await population({ depths: [40, 512], casesPerDepth: 400, seed: 4294967295, maxBatches: 128 });
    expect(result.state).toBe("complete"); expect(result.cases).toHaveLength(800);
    expect(result.batches).toHaveLength(68);
    expect(result.cases.filter(row => row.requestedDepth === 40 && row.label === "convex")).toHaveLength(134);
    expect(result.cases.filter(row => row.requestedDepth === 512 && row.label === "concave")).toHaveLength(134);
    expect(await verifyTasks(result, certificate, undefined, async batch => csv(result.request.depths[batch.depthOrdinal], batch.depthOrdinal, batch.batch))).toEqual(result);
  });
  it("rejects malformed CLI flags and unavailable source setup before generation", async () => {
    for (const args of [["unknown"], ["generate", "--depths", "5", "--depths", "40"], ["verify"],
      ["generate", "--depths", "5.5", "--cases-per-depth", "3", "--seed", "0", "--output", "/unused"],
      ["generate", "--depths", "5", "--cases-per-depth", "3", "--seed", "0", "--output", "/unused", "--mystery", "1"]])
      await expect(main(args)).rejects.toThrow();
    await expect(generateTasks({ request, output: "/unused", source: "", python: "" })).rejects.toThrow("COCONUT_GENERATOR_SOURCE");
  });
  it("rejects invalid requests before generating", () => {
    for (const input of [{ ...request, depths: [] }, { ...request, depths: [5, 5] }, { ...request, depths: [0] }, { ...request, depths: [1001] },
      { ...request, casesPerDepth: 0 }, { ...request, casesPerDepth: 334 }, { ...request, seed: -1 }, { ...request, seed: 2 ** 32 }, { ...request, maxBatches: 129 }])
      expect(() => validateRequest(input)).toThrow();
  });
  it("retains finite rejection evidence, global duplicates and explicit underfill", async () => {
    const rejected = await population(request, async (expression, label) => ({ ...await certificate(expression, label), status: "unverified", reason: "finite-proof-budget" }));
    expect(rejected.state).toBe("incomplete"); expect(rejected.batches).toHaveLength(2); expect(rejected.ledger).toHaveLength(24);
    expect(rejected.ledger.some(row => row.reason === "finite-proof-budget")).toBe(true); await expect(verifyTasks(rejected, certificate)).rejects.toThrow();
    const duplicates = await population({ ...request, depths: [5, 40], casesPerDepth: 1 }, certificate, true);
    expect(duplicates.state).toBe("incomplete"); expect(duplicates.cases).toHaveLength(1); expect(duplicates.ledger.filter(row => row.disposition === "duplicate").length).toBeGreaterThan(12);
  });
  it("rejects rehashed tampering in certificates, seed schedules, structural metadata and counts", async () => {
    const result = await population();
    const changes = [
      (value: Mutable<TasksArtifact>) => { value.cases[0].astDepth++; },
      (value: Mutable<TasksArtifact>) => { value.cases.pop(); },
      (value: Mutable<TasksArtifact>) => { value.batches[0].seed++; },
      (value: Mutable<TasksArtifact>) => { value.request.seed++; },
      (value: Mutable<TasksArtifact>) => { value.cases[0].domain.min = "0"; },
      (value: Mutable<TasksArtifact>) => { value.references[value.cases[0].id].proof = { test: false }; },
      (value: Mutable<TasksArtifact>) => { value.batches[0].csvSha256 = "a".repeat(64); },
      (value: Mutable<TasksArtifact>) => { value.cases[1] = value.cases[0]; },
    ];
    for (const change of changes) { const altered = structuredClone(result) as Mutable<TasksArtifact>; change(altered); await expect(verifyTasks(rehash(altered), certificate, undefined, async batch => csv(result.request.depths[batch.depthOrdinal], batch.depthOrdinal, batch.batch))).rejects.toThrow(); }
  });
  it("replays exact displayed expressions with the real independent certifier and bounded loader", async () => {
    const directory = await mkdtemp(join(tmpdir(), "coconut-tasks-test-"));
    try {
      const result = await generatePopulation({ depths: [5], casesPerDepth: 3, seed: 0, maxBatches: 1 }, {
        source: { revision: SOURCE_REVISION }, implementation: await implementationIdentity(), certify: certifyImported,
        batch: async () => ({ csv: "latex,tree,depth,nodes,convexity,jensen\n" + labels.flatMap(label => Array.from({ length: 4 }, (_, i) =>
          `"${label === "convex" ? `${i + 1}*x^2` : label === "concave" ? `-${i + 1}*x^2` : `${i + 1}*x*x*x`}",tree,5,3,${label},verified`)).join("\n") + "\n" }),
      });
      expect(result.state).toBe("complete"); const path = join(directory, "tasks.json"); await writeFile(path, JSON.stringify(result), { mode: 0o600 });
      await mkdir(`${path}.evidence`); await mkdir(join(`${path}.evidence`, "depth-0-batch-0"));
      const realCsv = "latex,tree,depth,nodes,convexity,jensen\n" + labels.flatMap(label => Array.from({ length: 4 }, (_, i) =>
        `"${label === "convex" ? `${i + 1}*x^2` : label === "concave" ? `-${i + 1}*x^2` : `${i + 1}*x*x*x`}",tree,5,3,${label},verified`)).join("\n") + "\n";
      await writeFile(join(`${path}.evidence`, "depth-0-batch-0", "synthesized_depth5_n1.csv"), realCsv);
      await writeFile(join(`${path}.evidence`, "request.json"), JSON.stringify({ request: result.request, source: result.provenance.source, implementation: result.provenance.implementation }));
      await writeFile(join(`${path}.evidence`, "ledger.json"), JSON.stringify(result.ledger));
      const originalOutput = join(`${path}.evidence`, "depth-0-batch-0");
      const batchReceipt = { depth: 5, depthOrdinal: 0, batch: 0, seed: result.batches[0].seed,
        args: ["scripts/generate_dataset.py", "--depths", "5", "--n-per-class", "4", "--seed", String(result.batches[0].seed), "--dim", "1", "--max-children", "2", "--attempts-per-instance", "20", "--out", originalOutput] };
      const receiptPath = join(originalOutput, "receipt.json"); await writeFile(receiptPath, JSON.stringify(batchReceipt));
      expect(await loadTasks(path)).toEqual(result); expect((await stat(path)).mode & 0o777).toBe(0o600);
      const relocated = join(directory, "relocated.json"); await cp(path, relocated); await cp(`${path}.evidence`, `${relocated}.evidence`, { recursive: true });
      expect(await loadTasks(relocated)).toEqual(result);
      const correlated = structuredClone(result) as Mutable<TasksArtifact>;
      correlated.request.seed++;
      for (const batch of correlated.batches) batch.seed = batchSeed(correlated.request.seed, batch.depthOrdinal, batch.batch);
      for (const entry of correlated.ledger) entry.seed = batchSeed(correlated.request.seed, entry.depthOrdinal, entry.batch);
      await writeFile(path, JSON.stringify(rehash(correlated))); await expect(loadTasks(path)).rejects.toThrow("Original generation request receipt");
      const changedSource = structuredClone(result) as Mutable<TasksArtifact>; changedSource.provenance.source = { revision: SOURCE_REVISION, modified: true };
      await writeFile(path, JSON.stringify(rehash(changedSource))); await expect(loadTasks(path)).rejects.toThrow("Original generation request receipt");
      await writeFile(path, JSON.stringify(result));
      await writeFile(receiptPath, JSON.stringify({ ...batchReceipt, args: batchReceipt.args.with(4, "8") }));
      await expect(loadTasks(path)).rejects.toThrow("Original batch receipt"); await writeFile(receiptPath, JSON.stringify(batchReceipt));
      const csvPath = join(`${path}.evidence`, "depth-0-batch-0", "synthesized_depth5_n1.csv");
      await writeFile(csvPath, realCsv + "tampered"); await expect(loadTasks(path)).rejects.toThrow(); await writeFile(csvPath, realCsv);
      const before = await readFile(path, "utf8");
      await expect(generateTasks({ request, output: path, source: "unused", python: "unused" })).rejects.toThrow();
      expect(await readFile(path, "utf8")).toBe(before);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 30000);
});
