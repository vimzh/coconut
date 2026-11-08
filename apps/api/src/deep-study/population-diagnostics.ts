// Bind bounded simplification diagnostics to the exact expression and declared interval.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IMPORT_DOMAIN, importImplementation } from "../randomized/admission";
import { pilotHash } from "../randomized/pilot";
import { boundedProcess, sha256 } from "../randomized/source";

const repository = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const worker = resolve(repository, "apps/api/src/deep-study/population-diagnostics.py");
export const CONTROL_EXPRESSION = "x^{2}";
export interface StructuralCoverage {
  readonly astDepth: number; readonly nonlinearPath: number; readonly nodeCount: number;
  readonly uniqueSubtrees: number; readonly branchNodes: number; readonly operations: Readonly<Record<string, number>>;
}
export interface PopulationDiagnostics {
  readonly version: "1"; readonly policy: "bounded-exact-diagnostics-v1"; readonly expressionSha256: string; readonly expressionCharacters: number;
  readonly domain: typeof IMPORT_DOMAIN; readonly simplifiedExactHash: string; readonly relatedShapeHash: string; readonly rawShapeHash: string;
  readonly raw: StructuralCoverage; readonly simplified: StructuralCoverage; readonly simplificationRules: Readonly<Record<string, number>>;
  readonly pointValues: readonly { readonly x: string; readonly status: "enclosed" | "unknown"; readonly value?: { readonly min: string; readonly max: string }; readonly reason?: string }[];
  readonly mechanismClassification: "not-individually-established"; readonly derivativeScales: "not-assessed"; readonly rangeScales: "not-assessed";
  readonly equivalenceStatus: "bounded-no-known-equivalence"; readonly pairwiseSemanticInequivalence: "unknown";
}

export type PopulationDiagnosticResult = PopulationDiagnostics | { readonly status: "unavailable"; readonly reason: string };

export async function diagnosePopulationCase(expression: string, signal?: AbortSignal): Promise<PopulationDiagnosticResult> {
  const text = await boundedProcess(resolve(repository, "services/numerics/.venv/bin/python"), ["-I", worker], repository, 20000, signal,
    JSON.stringify({ expression, domain: IMPORT_DOMAIN }));
  const result = JSON.parse(text);
  if (result.status === "unavailable") {
    // An unresolved original domain or exact bound is retained as an admission rejection.
    if (typeof result.reason !== "string") throw new Error("Diagnostic failure is missing its retained reason.");
    return result;
  }
  if (result.version !== "1" || result.policy !== "bounded-exact-diagnostics-v1" || result.expressionSha256 !== sha256(expression) ||
    result.expressionCharacters !== expression.length ||
    pilotHash(result.domain) !== pilotHash(IMPORT_DOMAIN) || ![result.simplifiedExactHash, result.relatedShapeHash, result.rawShapeHash].every(value => /^[a-f0-9]{64}$/.test(value)) ||
    result.equivalenceStatus !== "bounded-no-known-equivalence" || result.pairwiseSemanticInequivalence !== "unknown" ||
    result.mechanismClassification !== "not-individually-established" || result.derivativeScales !== "not-assessed" || result.rangeScales !== "not-assessed" ||
    ![result.raw, result.simplified].every(row => row && [row.astDepth, row.nonlinearPath, row.nodeCount, row.uniqueSubtrees, row.branchNodes]
      .every(value => Number.isSafeInteger(value) && value >= 0)) || !Array.isArray(result.pointValues))
    throw new Error("Structural diagnostics do not match the exact task or bounded policy.");
  return result;
}

export async function populationImplementation() {
  const files = ["population.ts", "population-source.ts", "population-diagnostics.ts", "population-diagnostics.py", "population-coverage.ts", "feasibility.ts"];
  return { ...await importImplementation(), ...Object.fromEntries(await Promise.all(files.map(async name =>
    [`apps/api/src/deep-study/${name}`, sha256(await readFile(resolve(repository, "apps/api/src/deep-study", name)))]))) };
}
