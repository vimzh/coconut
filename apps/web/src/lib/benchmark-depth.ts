// Stage labels come only from the retained metadata for this exact benchmark identity.
import composition from "../../public/composition-scores.json";

export function getStageLevels(suiteId: string): readonly { stages: number; astDepth: number }[] | null {
  return suiteId === composition.suiteId ? composition.models[0].byStage : null;
}

export function getNonlinearStages(suiteId: string, expressionTreeDepth: number): number | null {
  return getStageLevels(suiteId)?.find((level) => level.astDepth === expressionTreeDepth)?.stages ?? null;
}
