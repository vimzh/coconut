// Prevent familiar AST numbers or stale suite identities from being advertised as stages.
import assert from "node:assert/strict";
import { test } from "node:test";
import composition from "../../public/composition-scores.json";
import artifact from "../../../api/data/suites/composition-v1.json";
import { getNonlinearStages, getStageLevels } from "./benchmark-depth";

test("binds nonlinear stage labels to the frozen suite and retained metadata", () => {
  assert.equal(composition.suiteId, artifact.id);
  const levels = getStageLevels(artifact.id)!;
  for (const task of artifact.cases) {
    assert.equal(getNonlinearStages(artifact.id, task.depth), task.stageCount);
  }
  for (const model of composition.models) {
    assert.deepEqual(levels.map(({ stages, astDepth }) => [stages, astDepth]), model.byStage.map(({ stages, astDepth }) => [stages, astDepth]));
  }
  assert.deepEqual(levels.map(({ astDepth }) => getNonlinearStages(artifact.id, astDepth)), [2, 4, 6]);
  assert.equal(getNonlinearStages(artifact.id, 216), null);
  assert.equal(getNonlinearStages(`${artifact.id}-changed`, 7), null);
  assert.equal(getStageLevels("reference-v1"), null);
});
