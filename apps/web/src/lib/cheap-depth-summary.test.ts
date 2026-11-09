// Preserve the audited fast-study scores and their distinct question and reasoning budgets.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cheapDepthSummary } from "./cheap-depth-summary";
import { deepStudySummary, deepStudyTaskTotal } from "./deep-study-summary";

test("publishes the completed 800-question fast study with all audited score slices", () => {
  const study = cheapDepthSummary;
  assert.equal(study.state, "complete");
  assert.equal(study.audit.reportSha256, "4236053a3e8a950707d0727f647150d86d0879ed800151c0a7468ba0395605e5");
  assert.equal(study.cohortSha256, "cc9a5447bf3668bf69de0d97d371fe57748aa508af51633363e82ab05c786b18");
  assert.equal(study.audit.referenceReviewSha256, "f03e692a7ef943c35c6929a1c35eb9f3df6ed815010aa1ca15f3f0fed12eea53");
  const expected = [
    { id: "gpt-4.1-mini", correct: 320, wrong: 464, unusable: 16, f1: 0.39587489830820527, depths: [45, 35, 37, 37, 40, 39, 44, 43], scores: [40.32, 35.71, 36.24, 36.67, 41.46, 36.05, 36.83, 34.11] },
    { id: "gpt-4o-mini", correct: 282, wrong: 468, unusable: 50, f1: 0.30265679073931384, depths: [34, 40, 27, 32, 31, 39, 41, 38], scores: [34.09, 33.36, 22.67, 20.61, 18.56, 30.02, 33.34, 29.74] },
    { id: "gpt-5.6-luna", correct: 296, wrong: 504, unusable: 0, f1: 0.30106801369098024, depths: [54, 37, 36, 35, 34, 32, 34, 34], scores: [54.95, 35.06, 29.65, 26.42, 18.57, 16.16, 18.57, 18.63] },
  ];
  assert.deepEqual(study.models.map(model => model.modelId), expected.map(row => row.id));
  study.models.forEach((model, index) => {
    const row = expected[index];
    assert.deepEqual([model.overall.correct, model.overall.wrongValid, model.overall.unusable, model.overall.macroF1], [row.correct, row.wrong, row.unusable, row.f1]);
    assert.equal(model.overall.accuracy, row.correct / 800);
    assert.equal(model.overall.status, "complete");
    assert.equal(model.overall.modelOutcomes, 800);
    assert.equal(model.settings.maxOutputTokens, 8192);
    assert.equal(model.settings.inferenceTimeoutMs, 180000);
    assert.equal(model.settings.reasoning, index === 2 ? "none" : null);
    assert.deepEqual(model.byDepth.map(slice => slice.score.correct), row.depths);
    assert.deepEqual(model.byDepth.map(slice => Number((slice.score.macroF1! * 100).toFixed(2))), row.scores);
    assert.ok(model.byDepth.every(slice => slice.score.planned === 100 && slice.score.modelOutcomes === 100));
  });
});

test("keeps the original 620-task study and the new fast population separate", () => {
  assert.equal(deepStudyTaskTotal(deepStudySummary), 620);
  assert.equal(deepStudyTaskTotal(cheapDepthSummary), 800);
  assert.notEqual(deepStudySummary.cohortSha256, cheapDepthSummary.cohortSha256);
  assert.equal(deepStudySummary.audit.referenceReviewSha256, cheapDepthSummary.audit.referenceReviewSha256);
  for (const model of deepStudySummary.models) {
    assert.equal(model.settings.maxOutputTokens, 32768);
    assert.equal(model.byDepth[6].score.planned, 10);
    assert.equal(model.byDepth[7].score.planned, 10);
  }
});
