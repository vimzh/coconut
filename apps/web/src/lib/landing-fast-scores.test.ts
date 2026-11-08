// Verify every newly displayed value against the independent audit and keep other settings unfilled.
import assert from "node:assert/strict";
import { it } from "node:test";
import snapshot from "../../public/fast-model-scores.json";
import audit from "../../../api/data/quality/fast-table-fill-audit-v1.json";
import summary from "../../../api/data/quality/fast-table-fill-v1.json";
import { getFastScreeningCell } from "./landing-fast-scores";
import { getLandingPilotScore } from "./landing-pilots";

it("projects all thirteen complete audited cells and their actual per-depth slices", () => {
  assert.equal(snapshot.cells.length, 13);
  assert.equal(snapshot.inferenceRequests, 351);
  assert.equal(snapshot.cumulativeConservativeRequests, 8511);
  for (const cell of snapshot.cells) {
    const checked = audit.cells.find(row => row.cell === cell.key && row.modelId === cell.modelId)!;
    assert.ok(checked);
    assert.equal(cell.complete, true);
    assert.equal(cell.macroF1, checked.macroF1);
    assert.equal(cell.plannedTrials, checked.planned);
    assert.equal(cell.includedTrials, checked.included);
    const retained = summary.reports.find(row => row.cell === cell.key && row.modelId === cell.modelId)!;
    assert.deepEqual(cell.byDepth, retained.byDepth.map(slice => ({ depth: slice.depth, macroF1: slice.classification.macroF1,
      plannedTrials: slice.classification.population.plannedTrials, includedTrials: slice.classification.population.includedTrials })));
    if (cell.key === "screening-standard") assert.deepEqual(getFastScreeningCell(cell.modelId, 0), cell);
    else assert.equal(getLandingPilotScore(cell.modelId, Number(cell.key.replace("depth", ""))), checked.macroF1);
  }
});

it("keeps missing and different-setting scores unavailable", () => {
  assert.equal(getFastScreeningCell("gpt-5.4-mini", 1), null);
  assert.equal(getFastScreeningCell("gpt-5.4-mini", 3), null);
  assert.equal(getFastScreeningCell("untested-model", 0), null);
  assert.equal(getLandingPilotScore("untested-model", 216), null);
  assert.equal(getLandingPilotScore("gpt-6-luna", 256), null);
});
