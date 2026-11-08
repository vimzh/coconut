import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImportReference } from "../randomized/admission";
import { IMPORT_DOMAIN } from "../randomized/admission";
import { diagnosePopulationCase } from "./population-diagnostics";
import type { PopulationDiagnostics } from "./population-diagnostics";
import { populationCoverage } from "./population-coverage";
import { populationCores, populationDisposition, populationQuota } from "./population";
import type { PopulationCase, PopulationSelection } from "./population";
import { POPULATION_DEPTHS, populationSeed } from "./population-source";
import { populationBatchOrigin, replayPopulationBatch, retainPopulationBatch } from "./population-source";
import { feasibilityCountGate } from "./feasibility";
import { parseCandidateCsv, sha256, SOURCE_REVISION } from "../randomized/source";

async function diagnostics(expression: string): Promise<PopulationDiagnostics> {
  const result = await diagnosePopulationCase(expression);
  if (!("simplifiedExactHash" in result)) throw new Error(`Unexpected diagnostic failure: ${result.reason}`);
  return result;
}

describe("final population frozen schedule", () => {
  test("eight levels, rotating hundred-case quotas and disjoint bounded seeds", () => {
    expect(POPULATION_DEPTHS).toEqual([5, 10, 20, 40, 80, 160, 320, 512]);
    const total = { convex: 0, concave: 0, neither: 0 }, seeds = new Set<number>();
    for (let level = 0; level < 8; level++) {
      const quota = populationQuota(level);
      expect(quota.convex + quota.concave + quota.neither).toBe(100);
      for (const label of ["convex", "concave", "neither"] as const) total[label] += quota[label];
      for (let batch = 0; batch < 128; batch++) seeds.add(populationSeed(level, batch));
    }
    expect(total).toEqual({ convex: 267, concave: 267, neither: 266 });
    expect(seeds.size).toBe(1024);
    expect(populationSeed(7, 0)).toBe(1570000);
    expect(populationSeed(7, 64)).toBe(1570064);
    expect(populationBatchOrigin(63, 64)).toBe("retained");
    expect(populationBatchOrigin(64, 64)).toBe("fresh");
    expect(() => populationSeed(7, 128)).toThrow();
    expect(() => populationQuota(-1)).toThrow();
  });
});

describe("bounded exact simplification", () => {
  test("rejects cancellation and inverse-operation padding as duplicate canonical tasks", async () => {
    const base = await diagnostics("x^2");
    for (const expression of ["log(exp(x^2))+0", "1*(-(-x^2))", "exp(log(x^2+1))-1", "(sqrt(x^2))^2"])
      expect((await diagnostics(expression)).simplifiedExactHash).toBe(base.simplifiedExactHash);
    expect((await diagnostics("x^2+x^2")).simplifiedExactHash).toBe((await diagnostics("2*x^2")).simplifiedExactHash);
    expect((await diagnostics("x^2-x^2")).simplifiedExactHash).toBe((await diagnostics("0")).simplifiedExactHash);
    expect((await diagnostics("x+x+2")).simplifiedExactHash).toBe((await diagnostics("2*(x+1)")).simplifiedExactHash);
  });

  test("never erases undefined operands and preserves task binding", async () => {
    const invalid = await diagnosePopulationCase("0*log(x)");
    expect(invalid).toEqual({ status: "unavailable", reason: "diagnostics-require-valid-original-domain" });
    const result = await diagnostics("exp(log(x^2+1))");
    expect(result.simplificationRules["exp-log-valid-domain"]).toBe(1);
    expect(result.raw.astDepth).toBeGreaterThan(result.simplified.astDepth);
    expect(result.pairwiseSemanticInequivalence).toBe("unknown");
    expect(result.pointValues.length).toBe(3);
  });

  test("reports inactive branches and related affine variants separately from equality", async () => {
    const base = await diagnostics("x^2");
    const variant = await diagnostics("-3*x^2+7");
    expect(variant.relatedShapeHash).toBe(base.relatedShapeHash);
    expect(variant.simplifiedExactHash).not.toBe(base.simplifiedExactHash);
    const maximum = await diagnostics("max(x^2+2,1)");
    expect(maximum.simplificationRules["range-dominated-max"]).toBe(1);
    expect(maximum.simplifiedExactHash).toBe((await diagnostics("x^2+2")).simplifiedExactHash);
  });
});

test("admission rejects prior exposure, exact/simplified repeats and missing proof before filling quotas", async () => {
  const diag = await diagnostics("x^2"), reference: ImportReference = { policy: "deep-import-reference-v1", status: "verified", label: "convex",
    expressionSha256: diag.expressionSha256, domain: IMPORT_DOMAIN, coreHashes: ["a".repeat(64)], shapeHash: "b".repeat(64) };
  const selection: PopulationSelection = { exact: new Set(), cores: new Set(), simplified: new Set(), priorExact: new Set(), priorCores: new Set(),
    priorSimplified: new Set(), priorRelatedShapes: new Set() };
  const input = { exactHash: "c".repeat(64), reference, diagnostics: diag, selection, label: "convex" as const,
    counts: { convex: 0, concave: 0, neither: 0 }, quota: populationQuota(0) };
  expect(populationDisposition(input).disposition).toBe("admitted");
  selection.priorCores.add("b".repeat(64));
  expect(populationDisposition(input).disposition).toBe("prior-exposure");
  selection.priorCores.clear(); selection.simplified.add(diag.simplifiedExactHash);
  expect(populationDisposition(input)).toEqual({ disposition: "duplicate", reason: "bounded-simplified-duplicate" });
  selection.simplified.clear();
  selection.priorRelatedShapes.add(diag.relatedShapeHash);
  expect(populationDisposition(input).disposition).toBe("prior-exposure");
  selection.priorRelatedShapes.clear();
  expect(populationDisposition({ ...input, reference: { ...reference, status: "unverified", reason: "strict-witness-unresolved" } }).disposition).toBe("unverified");
  expect(populationDisposition({ ...input, counts: { ...input.counts, convex: 34 } }).disposition).toBe("quota-filled");
  expect(populationCores(reference)).toEqual(["a".repeat(64), "b".repeat(64)]);
});

test("coverage groups transitive related cores and counts only certified pointwise distinctions", async () => {
  const make = async (expression: string, id: string, cores: string[]): Promise<PopulationCase> => ({ id, expression,
    label: "convex", domain: IMPORT_DOMAIN, referenceSha256: "a".repeat(64), coreHashes: cores, requestedDepth: 5, actualDepth: 5,
    astDepth: 4, nonlinearPath: 2, nodeCount: 8, diagnostics: await diagnostics(expression) });
  const cases = [await make("x^2", "a", ["one"]), await make("2*x^2+3", "b", ["one", "two"]), await make("exp(x)+10", "c", ["two"])];
  const result = populationCoverage(cases);
  expect(result.relatedGroupCount).toBe(1);
  expect(result.relatedGroupSizes).toEqual([3]);
  expect(result.expressionCharacters).toEqual({ min: 3, max: 9, mean: 19 / 3 });
  expect(result.mechanismClassification).toBe("not-individually-established");
  expect(result.rigorousPointwiseInequivalence).toEqual({ totalPairs: 3, rigorouslySeparatedPairs: 3, unknownPairs: 0 });
  expect(populationCoverage([]).caseCount).toBe(0);
});

test("the full bounded source proof count can rule out required quotas without model calls", () => {
  const rows = Array.from({ length: 64 }, () => (["convex", "concave", "neither"] as const).flatMap(label =>
    Array.from({ length: 4 }, () => ({ label, status: label === "concave" ? "verified" as const : "unverified" as const })))).flat();
  const result = feasibilityCountGate(rows, 64);
  expect(result.received).toBe(768);
  expect(result.quota).toEqual({ convex: 33, concave: 34, neither: 33 });
  expect(result.verifiedCounts).toEqual({ convex: 0, concave: 256, neither: 0 });
  expect(result.quotaUpperBound).toBe("insufficient");
  expect(result.finalBoundImpossible).toBe(true);
  expect(() => feasibilityCountGate(rows.slice(1), 64)).toThrow();
  expect(feasibilityCountGate([], 0).quotaUpperBound).toBe("incomplete");
});

test("source retention preserves bytes and replay rejects changed parameters even with rewritten receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "population-source-"));
  try {
    const directory = join(root, "batch-0"); await mkdir(directory);
    const csv = "latex,tree,depth,nodes,convexity,jensen\n" + (["convex", "concave", "neither"] as const).flatMap(label =>
      Array.from({ length: 4 }, (_, i) => `x+${i},scalar tree,5,5,${label},not_evaluable\n`)).join("");
    const args = ["scripts/generate_dataset.py", "--depths", "5", "--n-per-class", "4", "--seed", "1500000", "--dim", "1",
      "--max-children", "2", "--attempts-per-instance", "20", "--out", directory];
    const receipt = { version: "1", policy: "final-population-source-v1", requestedDepth: 5, depthOrdinal: 0, batchOrdinal: 0, seed: 1500000,
      source: { revision: SOURCE_REVISION, permission: "not-declared-no-redistribution", files: { "scripts/generate_dataset.py": "a".repeat(64) },
        environment: { python: "3.13.17", packages: { numpy: "2.1.2", pandas: "2.3.1", tqdm: "4.67.1" } } }, args, startedAt: "2026-11-08T00:00:00.000Z" };
    const batch = { ...receipt, state: "complete", finishedAt: "2026-11-08T00:00:01.000Z", sourceFileSha256: sha256(csv), stdout: "",
      candidates: parseCandidateCsv(csv, 5, 4) };
    await writeFile(join(directory, "synthesized_depth5_n1.csv"), csv);
    await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt)); await writeFile(join(directory, "batch.json"), JSON.stringify(batch));
    expect((await replayPopulationBatch(directory, 0, 0)).candidates.length).toBe(12);
    const retained = await retainPopulationBatch({ root, output: join(root, "retained"), depthOrdinal: 0, batchOrdinal: 0 });
    expect(retained.sourceFileSha256).toBe(sha256(csv));
    await expect(retainPopulationBatch({ root, output: join(root, "missing-prefix"), depthOrdinal: 0, batchOrdinal: 63 })).rejects.toThrow();
    args[8] = "2";
    await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt)); await writeFile(join(directory, "batch.json"), JSON.stringify(batch));
    await expect(replayPopulationBatch(directory, 0, 0)).rejects.toThrow("source batch");
  } finally { await rm(root, { recursive: true, force: true }); }
});
