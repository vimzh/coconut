// Independent confusion counts verify the scores used in the fixed-depth pilot columns.
import assert from "node:assert/strict";
import { it } from "node:test";
import depth60 from "../../../api/data/quality/depth60-landing-v1.json";
import depth100 from "../../../api/data/quality/depth100-results-audit-v1.json";
import depth216 from "../../../api/data/quality/depth216-results-audit-v1.json";
import { getLandingPilotScore } from "./landing-pilots";

it("projects complete depth-60 results without substituting missing model scores", () => {
  for (const model of depth60.models)
    assert.equal(getLandingPilotScore(model.modelId, 60), model.populationStatus === "complete" ? model.macroF1 : null);
  assert.equal(getLandingPilotScore("untested-model", 60), null);
  assert.equal(getLandingPilotScore("untested-model", 100), null);
  assert.equal(getLandingPilotScore("untested-model", 216), null);
});

it("verifies depth-100 and depth-216 macro-F1 from its audited confusion counts", () => {
  const labels = ["convex", "concave", "neither"] as const;
  for (const [depth, study] of [[100, depth100], [216, depth216]] as const) for (const model of study.models) {
    const macroF1 = labels.reduce((sum, label) => {
      const tp = model.confusion[label][label];
      const fp = labels.reduce((count, other) => count + (other === label ? 0 : model.confusion[other][label]), 0);
      const fn = labels.reduce((count, other) => count + (other === label ? 0 : model.confusion[label][other]), model.confusion[label].unusable);
      return sum + (2 * tp + fp + fn === 0 ? 0 : 2 * tp / (2 * tp + fp + fn));
    }, 0) / 3;
    assert.ok(Math.abs(getLandingPilotScore(model.modelId, depth)! - macroF1) < 1e-12);
    assert.equal(model.correct + model.wrongValid + model.invalid, model.planned);
  }
});
