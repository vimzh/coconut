// Read the frozen landing scores; missing exact-setting evidence remains unavailable.
import snapshot from "../../public/landing-scores.json";
import { directoryModels } from "./model-directory-data";

interface LandingScoreColumn {
  readonly key: string;
  readonly label: string;
  readonly group: "Screening" | "Confirmation";
  readonly profileId: string;
  readonly requests: number;
  readonly depths: readonly number[];
}

if (snapshot.version !== "1" || snapshot.metric !== "pooled-macro-f1-v1" || snapshot.columns.length !== 5)
  throw new Error("Regenerate the landing score snapshot with bun scripts/export-landing-scores.ts.");
if (new Set(directoryModels.map((model) => model.id)).size !== directoryModels.length || snapshot.models.length !== directoryModels.length ||
  snapshot.models.some((model, index) => model.modelId !== directoryModels[index].id))
  throw new Error("The landing score snapshot does not match the model lineup. Run bun scripts/export-landing-scores.ts.");

export const landingScoreColumns: readonly LandingScoreColumn[] = Object.freeze(snapshot.columns.map((column): LandingScoreColumn => {
  if (column.group !== "Screening" && column.group !== "Confirmation")
    throw new Error("The landing score snapshot contains an unknown comparison group.");
  return Object.freeze({ key: column.key, label: column.label, group: column.group, profileId: column.profileId, requests: column.comparison.workload.logicalCalls, depths: Object.freeze([...column.comparison.depths]) });
}));

export const landingScoresAsOf = snapshot.evidenceThrough;
const missingScores: readonly null[] = Object.freeze([null, null, null, null, null]);
const scoresByModel = new Map<string, readonly (number | null)[]>();

for (const model of snapshot.models) {
  if (scoresByModel.has(model.modelId) || model.scores.length !== landingScoreColumns.length || model.selectedRunIds.length !== model.scores.length ||
    model.scores.some((score, index) => score !== null && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) || (score === null) !== (model.selectedRunIds[index] === null)))
    throw new Error("The landing score snapshot contains invalid model scores.");
  scoresByModel.set(model.modelId, Object.freeze([...model.scores]));
}

export function getLandingScores(modelId: string): readonly (number | null)[] {
  return scoresByModel.get(modelId) ?? missingScores;
}

export function getLandingRunCount(modelId: string): number {
  return snapshot.measurements.filter((measurement) => measurement.modelId === modelId).length;
}
