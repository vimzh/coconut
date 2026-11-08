// Freeze every task/settings cell before screening scores or confirmation outcomes exist.
import { writeFile } from "node:fs/promises";
import { buildNumericalPrompts } from "../numerics";
import { buildPrompt, type ProfileId } from "../protocol";
import { qualityDataHash, type SignalExperimentManifest } from "../quality";
import { QUALITY_CRITERIA_SHA256 } from "../quality/data";
import { deriveRunSettingsId } from "../runs/evidence";
import { loadRunSuite } from "../runs/registry";
import { buildModelCensus } from "./catalog";

export interface FrozenExperiment extends SignalExperimentManifest {
  readonly kind: "openai-curvature-experiment";
  readonly census: ReturnType<typeof buildModelCensus>;
  readonly plannedInferenceCeiling: number;
  readonly previousCalibrationAllowance: 4;
  readonly execution: { readonly parallelRuns: 3; readonly runConcurrency: 4; readonly compatibilityConcurrency: 12; readonly retries: 0 };
  readonly interpretation: string;
  readonly capabilityControl: { readonly reference: unknown; readonly purpose: string };
  readonly replication?: {
    readonly kind: "complete-fresh-replication";
    readonly sourceManifestSha256: string;
    readonly sourceLedgerSha256: string;
    readonly reconciliationSha256: string;
    readonly retainedControlsSha256: string;
    readonly retainedPriorInferenceRequests: number;
    readonly plannedNewMathInferenceRequests: number;
    readonly maximumCumulativeInferenceRequests: number;
    readonly capabilityPolicy: "reuse-retained-controls-without-new-calls";
    readonly reason: string;
  };
}

export async function freezeExperiment(output: string): Promise<FrozenExperiment> {
  const inventory = await Bun.file(new URL("../../data/experiments/openai-inventory-v1.json", import.meta.url)).json();
  if (inventory.result?.ok !== true) throw new Error("Model inventory is not verified.");
  const census = buildModelCensus(inventory.result.value);
  const cells: SignalExperimentManifest["cells"][number][] = [];
  const variants = new Map<string, { suiteId: string; suiteSha256: string; promptsSha256: string; generation: ReturnType<typeof buildPrompt>["generation"] }>();
  const reference = { expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
  const capabilityControl = { reference, purpose: "Independently verified quadratic setting-acceptance control, excluded from mathematical screening and confirmation." };
  async function cell(phase: "screening" | "confirmation" | "capability-probe", modelId: string, profileId: ProfileId) {
    const key = `${phase === "capability-probe" ? "control" : phase}:${profileId}`;
    let variant = variants.get(key);
    if (!variant) {
      if (phase === "capability-probe") {
        const prompt = buildPrompt(reference, profileId);
        variant = { suiteId: "quadratic-capability-control-v1", suiteSha256: qualityDataHash(capabilityControl), promptsSha256: qualityDataHash([prompt]), generation: prompt.generation };
      } else {
        const suite = await loadRunSuite(phase === "confirmation" ? "challenge-v1" : "screening-v1", profileId);
        const prompts = await buildNumericalPrompts(suite.cases.map(entry => entry.reference), profileId, "smooth-v2");
        variant = { suiteId: suite.id, suiteSha256: qualityDataHash(suite), promptsSha256: qualityDataHash(prompts), generation: prompts[0].generation };
      }
      variants.set(key, variant);
    }
    const concurrency = phase === "capability-probe" ? 1 : 4;
    const content = { phase, provider: "openai" as const, modelId, servingProvider: null, profileId,
      suiteId: variant.suiteId, suiteSha256: variant.suiteSha256, promptsSha256: variant.promptsSha256,
      settingsId: deriveRunSettingsId({ profileId, concurrency }, variant.generation), reasoningEffort: variant.generation.reasoning,
      maxOutputTokens: variant.generation.maxOutputTokens, concurrency };
    cells.push({ id: `cell-${qualityDataHash(content)}`, ...content });
  }
  // These models/efforts were chosen from documentation before any screening outcome, never by score.
  for (const modelId of ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna"]) for (const effort of ["high", "max"] as const) await cell("confirmation", modelId, `one-shot-json-v2-${effort}`);
  for (const model of census.included) {
    await cell("screening", model.modelId, "one-shot-json-v1");
    for (const effort of model.plannedEfforts) {
      await cell("screening", model.modelId, `one-shot-json-v2-${effort}`);
      await cell("capability-probe", model.modelId, `one-shot-json-v2-${effort}`);
    }
  }
  const plannedInferenceCeiling = cells.reduce((sum, row) => sum + (row.phase === "confirmation" ? 216 : row.phase === "screening" ? 27 : 1), 0);
  if (plannedInferenceCeiling + 4 > 8192 || new Set(cells.map(row => row.id)).size !== cells.length) throw new Error("Experiment matrix exceeds its declared budget or repeats a cell.");
  const manifest: FrozenExperiment = {
    version: "1", kind: "openai-curvature-experiment", policyId: "quality-criteria-v1", criteriaSha256: QUALITY_CRITERIA_SHA256,
    frozenAt: new Date().toISOString(), inventory: { checkedAt: inventory.checkedAt, source: inventory.source, modelIds: inventory.result.value },
    frontier: { modelIds: ["gpt-6-astra", "gpt-6.1-sol"], basis: "The documented most-capable Astra and current Sol models form the predeclared frontier population. Previous Sol and efficient Luna are named comparators, not additional frontier claims.", sourceUrls: ["https://developers.openai.com/api/docs/models/gpt-6-astra", "https://developers.openai.com/api/docs/models/gpt-6.1-sol"] },
    modelEfforts: census.included.map(model => ({ provider: "openai", modelId: model.modelId, plannedEfforts: model.plannedEfforts, documentedEfforts: model.documentedEfforts, sourceUrls: model.sourceUrls })),
    cells, budget: { maxChargedAttempts: 8192, maxConcurrency: 12, inferenceTimeoutMs: 180000, metadataTimeoutMs: 20000 },
    census, plannedInferenceCeiling, previousCalibrationAllowance: 4,
    execution: { parallelRuns: 3, runConcurrency: 4, compatibilityConcurrency: 12, retries: 0 }, capabilityControl,
    interpretation: "Screening is exploratory. Unsupported/unresolved candidate effort cells remain recorded, with no invented score. Capability selection uses parameter acceptance, never correctness of the control label. Confirmation membership/model/effort was fixed before screening outcomes. Profiles, aliases, snapshots, and unequal compute remain distinct; no primary superiority contrast is declared.",
  };
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output" || !args[1]) throw new Error("Use --output with a new manifest path.");
    const result = await freezeExperiment(args[1]);
    console.log(JSON.stringify({ frozenAt: result.frozenAt, hash: qualityDataHash(result), cells: result.cells.length, plannedInferenceCeiling: result.plannedInferenceCeiling }));
  } catch { console.error("The experiment manifest could not be frozen. No evaluation inference was started."); process.exitCode = 1; }
}
