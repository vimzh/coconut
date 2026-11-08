// Synthetic projections exercise evidence states without inventing live model results.
import assert from "node:assert/strict";
import { test } from "node:test";
import published from "../../public/deep-study-scores.json";
import { deepStudyTaskCounts, deepStudyTaskTotal, parseDeepStudySummary, requestedGeneratorDepths, type DeepStudyScore, type DeepStudySummary } from "./deep-study-summary";

function score(planned: number, observed = planned): DeepStudyScore {
  return {
    planned, dispatched: observed, modelOutcomes: observed, correct: observed,
    wrongValid: 0, unusable: 0, providerFailures: 0, unknownRemote: 0,
    inFlight: 0, unattempted: planned - observed,
    accuracy: observed === 0 ? null : 1, macroF1: observed === 0 ? null : 1,
    status: observed === planned ? "complete" : observed > 0 ? "provisional" : "planned",
  };
}

function fixture(): DeepStudySummary {
  return {
    version: "1", studyId: "synthetic-study", state: "complete",
    depthMeasure: "requested-generator-depth", requestedDepths: [...requestedGeneratorDepths],
    tasksPerDepth: 100, trialsPerTask: 1,
    cohortId: "synthetic-cohort", cohortSourceId: "synthetic-source",
    cohortSha256: "a".repeat(64), reportSha256: "b".repeat(64),
    audit: { verdict: "pass", reportSha256: "b".repeat(64), referenceReviewSha256: "c".repeat(64) },
    models: [{
      modelId: "synthetic-model", reportedModelIds: ["synthetic-model-version"],
      settings: { profileId: "synthetic-profile", reasoning: "default", maxOutputTokens: 4096, inferenceTimeoutMs: 180000 },
      overall: score(800),
      byDepth: requestedGeneratorDepths.map(requestedDepth => ({ requestedDepth, realizedDepths: [{ depth: requestedDepth, count: 100 }], score: score(100) })),
    }],
  };
}

test("accepts the public projection and preserves the requested generator axis", () => {
  const result = parseDeepStudySummary(published);
  assert.deepEqual(result.requestedDepths, [5, 10, 20, 40, 80, 160, 320, 512]);
  assert.equal(deepStudyTaskTotal(result), result.version === "1" ? 800 : 620);
  assert.equal(result.trialsPerTask, 1);
  if (result.state === "planned") {
    assert.equal(result.models.every(model => model.overall.dispatched === 0), true);
    assert.equal(result.audit.verdict, "pending");
  }
});

function amendedFixture(): DeepStudySummary {
  const data = fixture();
  data.version = "2"; delete data.tasksPerDepth;
  data.plannedTasksPerModel = 620;
  data.taskCounts = requestedGeneratorDepths.map((requestedDepth, index) => ({ requestedDepth, tasks: index < 6 ? 100 : 10 }));
  data.models[0].overall = score(620);
  data.models[0].byDepth.forEach((slice, index) => {
    const tasks = data.taskCounts![index].tasks;
    slice.score = score(tasks); slice.realizedDepths = [{ depth: slice.requestedDepth, count: tasks }];
  });
  return data;
}

test("accepts the amended 620-task study with explicit 10-task high-depth populations", () => {
  const result = parseDeepStudySummary(amendedFixture());
  assert.equal(deepStudyTaskTotal(result), 620);
  assert.deepEqual(deepStudyTaskCounts(result).map(row => row.tasks), [100, 100, 100, 100, 100, 100, 10, 10]);
  assert.equal(result.models[0].overall.planned, 620);
  assert.equal(result.models[0].byDepth[6].score.planned, 10);
  assert.equal(result.models[0].byDepth[7].score.planned, 10);
});

test("keeps retained interruptions outside accuracy in an amended study", () => {
  const data = amendedFixture(); data.state = "incomplete";
  data.models[0].byDepth[1].score = { ...score(100, 96), dispatched: 100, unattempted: 0, providerFailures: 4, unknownRemote: 4 };
  data.models[0].overall = { ...score(620, 616), dispatched: 620, unattempted: 0, providerFailures: 4, unknownRemote: 4 };
  const result = parseDeepStudySummary(data);
  assert.equal(result.models[0].overall.accuracy, 1);
  assert.equal(result.models[0].overall.status, "provisional");
  assert.equal(result.models[0].overall.unknownRemote, 4);
  assert.equal(result.models[0].byDepth[7].score.status, "complete");
});

test("rejects stale or conflicting populations in amended exports", () => {
  for (const mutate of [
    (data: DeepStudySummary) => { data.tasksPerDepth = 100; },
    (data: DeepStudySummary) => { delete data.taskCounts; },
    (data: DeepStudySummary) => { data.plannedTasksPerModel = 800; },
    (data: DeepStudySummary) => { data.taskCounts![6].tasks = 100; },
    (data: DeepStudySummary) => { data.taskCounts![0].tasks = 10; },
    (data: DeepStudySummary) => { data.taskCounts![7].requestedDepth = 320; },
    (data: DeepStudySummary) => { data.models[0].overall.planned = 800; },
    (data: DeepStudySummary) => { data.models[0].byDepth[6].score = score(100); },
    (data: DeepStudySummary) => { data.models[0].byDepth[7].realizedDepths[0].count = 100; },
  ]) {
    const data = amendedFixture(); mutate(data);
    assert.throws(() => parseDeepStudySummary(data), /Invalid deep study summary/);
  }
});

test("accepts an audited complete projection without recomputing canonical macro-F1", () => {
  const data = fixture();
  data.models[0].byDepth.forEach(slice => {
    slice.score = { ...slice.score, correct: 50, wrongValid: 50, accuracy: 0.5, macroF1: 0.49 };
  });
  data.models[0].overall = { ...data.models[0].overall, correct: 400, wrongValid: 400, accuracy: 0.5, macroF1: 0.49 };
  assert.equal(parseDeepStudySummary(data).models[0].overall.macroF1, 0.49);
});

test("partial scores separate incorrect labels, unusable replies and infrastructure from missing evidence", () => {
  const data = fixture();
  data.state = "running";
  const partial: DeepStudyScore = {
    planned: 100, dispatched: 7, modelOutcomes: 4, correct: 2, wrongValid: 1, unusable: 1,
    providerFailures: 2, unknownRemote: 1, inFlight: 1, unattempted: 93,
    accuracy: 0.5, macroF1: 0.4, status: "provisional",
  };
  data.models[0].byDepth.forEach((slice, index) => { slice.score = index === 0 ? partial : score(100, 0); });
  data.models[0].overall = { ...partial, planned: 800, unattempted: 793 };
  const result = parseDeepStudySummary(data);
  assert.equal(result.models[0].overall.accuracy, 0.5);
  assert.equal(result.models[0].overall.modelOutcomes, 4);
  assert.equal(result.models[0].overall.providerFailures, 2);
  assert.equal(result.models[0].overall.inFlight, 1);
  assert.equal(result.models[0].overall.unattempted, 793);

  data.models[0].overall.accuracy = 2 / 800;
  assert.throws(() => parseDeepStudySummary(data), /wrong denominator/);
});

test("does not publish absent model replies as zero scores or a complete population", () => {
  const data = fixture();
  data.state = "unavailable";
  data.models[0].byDepth.forEach(slice => {
    slice.score = { ...score(100, 0), dispatched: 100, providerFailures: 100, unattempted: 0, status: "unavailable" };
  });
  data.models[0].overall = { ...score(800, 0), dispatched: 800, providerFailures: 800, unattempted: 0, status: "unavailable" };
  assert.equal(parseDeepStudySummary(data).models[0].overall.macroF1, null);
  data.models[0].overall.macroF1 = 0;
  assert.throws(() => parseDeepStudySummary(data), /scores without model outcomes/);
  data.models[0].overall.macroF1 = null;
  data.state = "complete";
  assert.throws(() => parseDeepStudySummary(data), /incomplete model evidence/);
});

test("requires passed audit and matching report, reference and source bindings", () => {
  for (const mutate of [
    (data: DeepStudySummary) => { data.audit.verdict = "pending"; },
    (data: DeepStudySummary) => { data.audit.reportSha256 = "d".repeat(64); },
    (data: DeepStudySummary) => { data.audit.referenceReviewSha256 = null; },
    (data: DeepStudySummary) => { data.cohortSourceId = null; },
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => parseDeepStudySummary(data), /audit|bindings/);
  }
});

test("rejects conflicting counts, depth semantics and mislabeled completion", () => {
  for (const mutate of [
    (data: DeepStudySummary) => { data.models[0].overall.correct--; },
    (data: DeepStudySummary) => { data.models[0].overall.unknownRemote = 1; },
    (data: DeepStudySummary) => { data.models[0].byDepth[0].realizedDepths = [{ depth: 7, count: 100 }]; },
    (data: DeepStudySummary) => { data.models[0].byDepth[0].score = score(100, 99); },
    (data: DeepStudySummary) => { data.models.push(structuredClone(data.models[0])); },
    (data: DeepStudySummary) => { data.state = "planned"; },
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => parseDeepStudySummary(data), /Invalid deep study summary/);
  }
});
