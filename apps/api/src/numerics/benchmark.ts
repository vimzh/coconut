// Measures identical algebraic workloads and a separate smooth workload, including process overhead.
import { cpus } from "node:os";
import { writeFile } from "node:fs/promises";
import { verifyReference } from "../math";
import { certifyReferences } from "./backend";
import { createSmoothCandidate } from "./candidates";
import { DEFAULT_NUMERICAL_REQUEST } from "./suite";
import type { NumericalReference, SmoothExpression } from "./types";

const x: SmoothExpression = { op: "variable" };
const constant = (value: string): SmoothExpression => ({ op: "constant", value });

function algebraicReferences(): NumericalReference[] {
  return Array.from({ length: 16 }, (_, index) => {
    const shifted: SmoothExpression = { op: "add", left: x, right: constant(`${index + 1}/32`) };
    return [
      { expression: { op: "square", arg: shifted } as SmoothExpression, domain: { min: "-1", max: "1" }, claimedLabel: "convex" as const },
      { expression: { op: "multiply", left: shifted, right: shifted } as SmoothExpression, domain: { min: "-1", max: "1" }, claimedLabel: "convex" as const },
    ];
  }).flat();
}

function counts(results: readonly { readonly status: string }[]) {
  return Object.fromEntries(["verified", "unverified", "excluded", "rejected"].map((status) => [status, results.filter((entry) => entry.status === status).length]));
}

function timing(values: readonly number[], count: number) {
  const ordered = [...values].sort((a, b) => a - b);
  const medianMs = ordered[Math.floor(ordered.length / 2)];
  return { samplesMs: values, medianMs, medianMsPerCase: medianMs / count };
}

export async function runNumericalBenchmark(output: string): Promise<void> {
  const references = algebraicReferences();
  const smooth = DEFAULT_NUMERICAL_REQUEST.depths.flatMap((depth) => (["convex", "concave", "neither"] as const).flatMap((label) =>
    Array.from({ length: DEFAULT_NUMERICAL_REQUEST.casesPerClass }, (_, ordinal) =>
      createSmoothCandidate(DEFAULT_NUMERICAL_REQUEST.seed, label, depth, ordinal, 0).reference)));
  const coldStart = performance.now();
  const cold = await certifyReferences([references[0]]);
  const coldSingleCaseMs = performance.now() - coldStart;
  const exactTimes: number[] = [], nativeTimes: number[] = [], smoothTimes: number[] = [];
  let exact = references.map(verifyReference);
  let native = await certifyReferences(references);
  let smoothResults = await certifyReferences(smooth);
  for (let repetition = 0; repetition < 5; repetition++) {
    let start = performance.now();
    exact = references.map(verifyReference);
    exactTimes.push(performance.now() - start);
    start = performance.now();
    native = await certifyReferences(references);
    nativeTimes.push(performance.now() - start);
    start = performance.now();
    smoothResults = await certifyReferences(smooth);
    smoothTimes.push(performance.now() - start);
  }
  const verified = cold[0];
  if (verified.status !== "verified") throw new Error("Benchmark calibration case did not certify.");
  const report = {
    experimentVersion: "1", seed: DEFAULT_NUMERICAL_REQUEST.seed,
    environment: { bun: Bun.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? "unreported", backend: verified.certificate.backend },
    policy: {
      repetitions: 5, nativeProcess: "new-per-batch",
      nativeTimingIncludes: "serialization, process startup, certification, and result validation",
      exactTimingIncludes: "in-process verification of identical references", modelCalls: 0,
    },
    coldSingleCase: { count: 1, elapsedMs: coldSingleCaseMs, status: verified.status },
    matchedAlgebraic: {
      description: "16 shifted squares and the same 16 functions expressed as nonconstant products; 32 identical inputs for both engines",
      count: references.length,
      exact: { outcomes: counts(exact), ...timing(exactTimes, references.length) },
      native: { outcomes: counts(native), ...timing(nativeTimes, references.length) },
    },
    smooth: { count: smooth.length, outcomes: counts(smoothResults), ...timing(smoothTimes, smooth.length) },
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(report));
}

if (import.meta.main) {
  try {
    if (Bun.argv.length !== 4 || Bun.argv[2] !== "--output" || Bun.argv[3].startsWith("--")) throw new Error("Usage: --output <new-json-path>");
    await runNumericalBenchmark(Bun.argv[3]);
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
