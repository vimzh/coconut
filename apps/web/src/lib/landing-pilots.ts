// Fixed-depth studies retain their own populations and default reasoning settings.
import depth60 from "../../../api/data/quality/depth60-landing-v1.json";
import depth100 from "../../../api/data/quality/depth100-results-audit-v1.json";
import depth100Matrix from "../../../api/data/experiments/depth100-matrix-v1.json";

if (depth100.verdict !== "pass" || depth60.profileId !== "one-shot-json-v1" || depth100Matrix.profileId !== "one-shot-json-v1")
  throw new Error("The landing pilot results need a passed audit and the recorded default profile.");

export const landingPilotDepths = [60, 100] as const;
export const archivedPilotModelIds = new Set([...depth60.models, ...depth100.models].map((model) => model.modelId));

export function getLandingPilotScore(modelId: string, depth: number): number | null {
  if (depth === 60) {
    const model = depth60.models.find((entry) => entry.modelId === modelId);
    return model?.populationStatus === "complete" ? model.macroF1 : null;
  }
  if (depth === 100) {
    const model = depth100.models.find((entry) => entry.modelId === modelId);
    return model && model.correct + model.wrongValid + model.invalid === model.planned ? model.macroF1 : null;
  }
  return null;
}
