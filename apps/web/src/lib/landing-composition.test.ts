// Public composition cells must remain exact projections of the independently audited population.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import results from "../../public/composition-scores.json";
import audit from "../../../api/data/quality/composition-results-audit-v1.json";

test("binds every composition cell to its complete audited trials and separate stage axis", () => {
  const text = readFileSync(new URL("../../../api/data/quality/composition-results-audit-v1.json", import.meta.url), "utf8");
  assert.equal(results.auditFileSha256, createHash("sha256").update(text).digest("hex"));
  assert.equal(audit.verdict, "pass");
  assert.equal(results.suiteId, audit.suiteId);
  assert.deepEqual(results.models, audit.models);
  assert.equal(results.tasks, 27);
  assert.equal(results.clusters, 9);
  assert.equal(results.trialsPerTask, 3);
  assert.deepEqual(results.models.map(row => row.modelId), ["gpt-5.4-mini", "gpt-6-luna"]);
  for (const model of results.models) {
    assert.equal(model.planned, 81);
    assert.deepEqual(model.byStage.map(row => [row.stages, row.astDepth, row.planned]), [[2, 7, 27], [4, 13, 27], [6, 19, 27]]);
    assert.equal(model.byStage.reduce((sum, row) => sum + row.correct, 0), model.correct);
  }
});
