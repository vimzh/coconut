// Verify the table against retained public scorer evidence and its exact comparison contracts.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import snapshot from "../../public/landing-scores.json";
import { directoryModels } from "./model-directory-data";
import { getLandingScores, landingScoreColumns, landingScoresAsOf } from "./landing-scores";
import { createLandingScoreSnapshot, selectLandingMeasurement } from "../../../../scripts/export-landing-scores";

describe("landing score evidence", () => {
  it("shows five fixed comparisons across the unchanged 45-model lineup", () => {
    assert.equal(snapshot.models.length, 45);
    assert.equal(new Set(directoryModels.map((model) => model.id)).size, 45);
    assert.equal(directoryModels.filter((model) => model.openrouter !== null).length, 10);
    assert.equal(directoryModels.filter((model) => model.openai).length, 36);
    assert.deepEqual(snapshot.models.map((model) => model.modelId), directoryModels.map((model) => model.id));
    assert.deepEqual(landingScoreColumns.map((column) => [column.group, column.label, column.profileId]), [
      ["Screening", "Standard", "one-shot-json-v1"],
      ["Screening", "Medium", "one-shot-json-v2-medium"],
      ["Screening", "High", "one-shot-json-v2-high"],
      ["Confirmation", "High", "one-shot-json-v2-high"],
      ["Confirmation", "Max", "one-shot-json-v2-max"],
    ]);
    assert.deepEqual(snapshot.columns.map((_, index) => snapshot.models.filter((model) => model.scores[index] !== null).length), [23, 23, 19, 3, 3]);
    assert.equal(landingScoresAsOf, "2026-11-08T10:28:38.142Z");
    for (const [index, column] of snapshot.columns.entries()) {
      const contract = column.comparison;
      assert.equal(contract.concurrency, 4);
      assert.equal(contract.method, "one-shot");
      assert.equal(contract.workload.trialsPerInstance, 3);
      assert.equal(contract.workload.maxOutputTokens, index === 0 ? 4096 : 16384);
      assert.equal(contract.caseCount, index < 3 ? 9 : 72);
      assert.equal(contract.workload.logicalCalls, index < 3 ? 27 : 216);
      assert.equal(contract.population, index < 3 ? "screening" : "confirmation");
      assert.equal(contract.profileId, column.profileId);
    }
    assert.deepEqual(getLandingScores("untested-model"), [null, null, null, null, null]);
    assert.deepEqual(getLandingScores("deepseek/deepseek-v4.1-flash"), [null, null, null, null, null]);
  });

  it("preserves scorer macro-F1, accuracy, populations and all additional settings", async () => {
    assert.deepEqual(snapshot.sources.map((source) => source.records), [171, 8, 2, 0]);
    assert.equal(snapshot.measurements.length, 181);
    assert.equal(new Set(snapshot.measurements.map((measurement) => measurement.runId)).size, 181);
    const columnIds = new Set(snapshot.columns.map((column) => column.comparisonId));
    const catalogIds = new Set(directoryModels.map((model) => model.id));
    const additional = snapshot.measurements.filter((measurement) => catalogIds.has(measurement.modelId) && !columnIds.has(measurement.comparisonId));
    assert.equal(additional.length, 53);
    assert.equal(new Set(additional.map((measurement) => measurement.modelId)).size, 19);
    for (const model of snapshot.models) {
      assert.deepEqual(getLandingScores(model.modelId), model.scores);
      for (const [index, runId] of model.selectedRunIds.entries()) {
        if (runId === null) { assert.equal(model.scores[index], null); continue; }
        const measurement = snapshot.measurements.find((candidate) => candidate.runId === runId);
        assert.ok(measurement);
        assert.equal(measurement.comparisonId, snapshot.columns[index].comparisonId);
        assert.equal(measurement.modelId, model.modelId);
        assert.equal(measurement.provider, "openai");
        assert.equal(measurement.complete, true);
        assert.equal(measurement.scoredPopulation, "complete");
        assert.equal(measurement.infrastructureFailures, 0);
        assert.equal(measurement.includedTrials, measurement.plannedTrials);
        assert.equal(model.scores[index], measurement.macroF1);
      }
    }
    const luna = snapshot.measurements.find((measurement) => measurement.runId === "ca142293-bbab-4bb9-a149-95adad364447");
    assert.ok(luna);
    const source = JSON.parse(await readFile(fileURLToPath(new URL(`../../../../${luna.sourcePath}`, import.meta.url)), "utf8"));
    assert.equal(luna.macroF1, source.record.report.overall.classification.macroF1);
    assert.equal(luna.accuracy, source.record.report.overall.classification.accuracy.value);
    assert.equal(getLandingScores("gpt-6-luna")[3], 0.9976689976689976);
    assert.deepEqual(getLandingScores("gpt-6-astra").slice(3), [1, 1]);
    assert.deepEqual(getLandingScores("gpt-6.1-sol").slice(3), [1, 1]);
  });

  it("selects the earliest complete run rather than the best, with deterministic ties and no failed-score substitute", () => {
    const source = snapshot.measurements[0];
    const early = { ...source, runId: "earlier", createdAt: "2026-11-08T01:00:00Z", macroF1: 0.2 };
    const late = { ...source, runId: "later", createdAt: "2026-11-08T02:00:00Z", macroF1: 1 };
    const failed = { ...early, runId: "failed", complete: false, macroF1: 0 };
    const missing = { ...early, runId: "missing-report", macroF1: null };
    const otherSuite = { ...early, runId: "other-suite", comparisonId: "different-suite" };
    assert.equal(selectLandingMeasurement([late, early, failed, missing, otherSuite], source.comparisonId)?.runId, "earlier");
    assert.equal(selectLandingMeasurement([failed, missing, otherSuite], source.comparisonId), null);
    assert.equal(selectLandingMeasurement([{ ...early, runId: "b" }, { ...early, runId: "a" }], source.comparisonId)?.runId, "a");
    assert.equal(selectLandingMeasurement([{ ...early, macroF1: 0 }], source.comparisonId)?.macroF1, 0);
  });

  it("reproduces every projected score, full identity and source hash from the retained archives", async () => {
    assert.deepEqual(await createLandingScoreSnapshot(), snapshot);
    const serialized = JSON.stringify(snapshot);
    for (const privateField of ["rawText", "accessCode", "acceptCharges", "prompts", "apiKey"])
      assert.equal(serialized.includes(`"${privateField}"`), false);
  });
});
