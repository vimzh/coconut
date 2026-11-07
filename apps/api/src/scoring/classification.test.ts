import { describe, expect, it } from "bun:test";
import type { Label } from "../math";
import { extractAnswer, type AnswerOutcome, type InvalidAnswerReason } from "../protocol";
import { scoreClassifications } from "./classification";
import type { Observation } from "./types";

const labels = ["convex", "concave", "neither"] as const;
const identity = { protocolVersion: "1", profileId: "one-shot-json-v1", rawText: "" } as const;

function answer(label: Label): AnswerOutcome {
  return extractAnswer({ status: "completed", text: JSON.stringify({ label, explanation: "Fixture answer." }) }, identity.profileId);
}

function invalid(reason: InvalidAnswerReason): AnswerOutcome {
  return { ...identity, kind: "invalid", reason };
}

function fixture(references: readonly Label[], trials: readonly (readonly (AnswerOutcome | null)[])[]): Observation[] {
  return references.flatMap((referenceLabel, index) => trials.map((predictions, trialIndex) => ({
    caseId: `case-${index}`, depth: 1, referenceLabel, trialIndex, outcome: predictions[index],
  })));
}

function repeated(references: readonly Label[], predictions: readonly (AnswerOutcome | null)[]): Observation[] {
  return fixture(references, [predictions, predictions, predictions]);
}

describe("pooled classification metrics", () => {
  it("scores all-correct balanced trials and retains raw and normalized matrix counts", () => {
    const report = scoreClassifications(repeated(labels, labels.map(answer)));
    expect(report.population).toEqual({
      plannedTrials: 9, includedTrials: 9, excludedTrials: 0, correctTrials: 9, status: "complete",
    });
    expect(report.macroF1).toBe(1);
    expect(report.accuracy).toEqual({ numerator: 9, denominator: 9, value: 1 });
    expect(report.absentReferenceClasses).toEqual([]);
    expect(report.confusion.columns).toEqual(["convex", "concave", "neither", "unusable"]);
    for (const label of labels) {
      expect(report.classes[label]).toEqual({ tp: 3, fp: 0, fn: 0, support: 3, precision: 1, recall: 1, f1: 1 });
      expect(report.confusion.rows[label].counts[label]).toBe(3);
      expect(report.confusion.rows[label].rowRates?.[label]).toBe(1);
      expect(report.spread.recall[label]).toEqual({ count: 3, mean: 1, min: 1, max: 1, sampleStandardDeviation: 0 });
    }
    expect(report.outcomes.answer).toEqual({ numerator: 9, denominator: 9, value: 1 });
    expect(report.spread.macroF1).toEqual({ count: 3, mean: 1, min: 1, max: 1, sampleStandardDeviation: 0 });
    expect(report.agreement).toEqual({ eligibleInstances: 3, totalInstances: 3, agreeingPairs: 9, totalPairs: 9, value: 1 });
  });

  it("scores entirely wrong answers and uses included source support for directional errors", () => {
    const report = scoreClassifications(repeated(labels, [answer("concave"), answer("neither"), answer("convex")]));
    expect(report.macroF1).toBe(0);
    expect(report.accuracy.value).toBe(0);
    for (const label of labels) expect(report.classes[label]).toMatchObject({ tp: 0, fp: 3, fn: 3, support: 3, f1: 0 });
    expect(report.directionalErrors).toEqual({
      convexToNeither: { numerator: 0, denominator: 3, value: 0 },
      concaveToNeither: { numerator: 3, denominator: 3, value: 1 },
    });
    expect(report.agreement.value).toBe(1);
  });

  it("distinguishes fixed-class macro-F1 from accuracy on imbalanced observations", () => {
    const references: Label[] = ["convex", "convex", "convex", "convex", "concave", "neither"];
    const report = scoreClassifications(repeated(references, references.map(() => answer("convex"))));
    expect(report.macroF1).toBeCloseTo(4 / 15, 12);
    expect(report.accuracy.value).toBeCloseTo(2 / 3, 12);
    expect(report.classes.convex).toEqual({ tp: 12, fp: 6, fn: 0, support: 12, precision: 2 / 3, recall: 1, f1: 4 / 5 });
    expect(report.classes.concave).toEqual({ tp: 0, fp: 0, fn: 3, support: 3, precision: null, recall: 0, f1: 0 });
    expect(report.classes.neither).toEqual(report.classes.concave);
    expect(report.agreement.value).toBe(1);
  });

  it("matches hand-calculated pooled F1, trial variation, unusable effects, and pair agreement", () => {
    const report = scoreClassifications(fixture(labels, [
      labels.map(answer),
      [answer("convex"), answer("convex"), answer("convex")],
      [invalid("malformed-json"), answer("concave"), answer("neither")],
    ]));
    expect(report.confusion.rows.convex.counts).toEqual({ convex: 2, concave: 0, neither: 0, unusable: 1 });
    expect(report.confusion.rows.concave.counts).toEqual({ convex: 1, concave: 2, neither: 0, unusable: 0 });
    expect(report.confusion.rows.neither.counts).toEqual({ convex: 1, concave: 0, neither: 2, unusable: 0 });
    expect(report.classes.convex).toEqual({ tp: 2, fp: 2, fn: 1, support: 3, precision: 1 / 2, recall: 2 / 3, f1: 4 / 7 });
    expect(report.classes.concave.f1).toBe(4 / 5);
    expect(report.classes.neither.f1).toBe(4 / 5);
    expect(report.macroF1).toBeCloseTo(76 / 105, 12);
    expect(report.accuracy.value).toBe(2 / 3);
    expect(report.trials.map((trial) => trial.metrics.macroF1)).toEqual([1, 1 / 6, 2 / 3]);
    expect(report.spread).toMatchObject({ plannedReplicates: 3, eligibleReplicates: 3 });
    expect(report.spread.macroF1.mean).toBeCloseTo(11 / 18, 12);
    expect(report.spread.macroF1.mean).not.toBeCloseTo(report.macroF1!, 4);
    expect(report.spread.macroF1.sampleStandardDeviation).toBeCloseTo(Math.sqrt(57) / 18, 12);
    expect(report.spread.macroF1.min).toBe(1 / 6);
    expect(report.spread.macroF1.max).toBe(1);
    for (const label of labels) {
      expect(report.spread.recall[label].mean).toBeCloseTo(2 / 3, 12);
      expect(report.spread.recall[label].sampleStandardDeviation).toBeCloseTo(Math.sqrt(1 / 3), 12);
    }
    expect(report.agreement).toEqual({ eligibleInstances: 2, totalInstances: 3, agreeingPairs: 2, totalPairs: 6, value: 1 / 3 });
  });

  it("retains all three class F1s when reference classes are absent", () => {
    const report = scoreClassifications(repeated(["convex", "concave"], [answer("convex"), answer("concave")]));
    expect(report.macroF1).toBe(2 / 3);
    expect(report.accuracy.value).toBe(1);
    expect(report.absentReferenceClasses).toEqual(["neither"]);
    expect(report.classes.neither).toEqual({ tp: 0, fp: 0, fn: 0, support: 0, precision: null, recall: null, f1: 0 });
    expect(report.confusion.rows.neither.rowRates).toBeNull();
    expect(report.spread.recall.neither).toEqual({ count: 0, mean: null, min: null, max: null, sampleStandardDeviation: null });
    const convexOnly = scoreClassifications(repeated(["convex"], [answer("convex")]));
    expect(convexOnly.directionalErrors.concaveToNeither).toEqual({ numerator: 0, denominator: 0, value: null });
  });

  it("gives no mathematical score for empty populations or explicitly unattempted plans", () => {
    for (const report of [scoreClassifications([]), scoreClassifications(repeated(["convex"], [null]))]) {
      expect(report.population.status).toBe("unavailable");
      expect(report.population.includedTrials).toBe(0);
      expect(report.macroF1).toBeNull();
      expect(report.accuracy).toEqual({ numerator: 0, denominator: 0, value: null });
      for (const label of labels) {
        expect(report.classes[label].f1).toBeNull();
        expect(report.classes[label].recall).toBeNull();
        expect(report.confusion.rows[label].rowRates).toBeNull();
      }
      expect(report.spread.eligibleReplicates).toBe(0);
      expect(report.spread.macroF1).toEqual({ count: 0, mean: null, min: null, max: null, sampleStandardDeviation: null });
      expect(report.agreement.value).toBeNull();
    }
    const unattempted = scoreClassifications(repeated(["convex"], [null]));
    expect(unattempted.population).toMatchObject({ plannedTrials: 3, excludedTrials: 3 });
    expect(unattempted.outcomes.unattempted).toEqual({ numerator: 3, denominator: 3, value: 1 });
  });
});

describe("outcome and completion populations", () => {
  it("keeps all mutually exclusive categories and reconciles counts, support, and row rates", () => {
    const duplicate = extractAnswer({
      status: "completed", text: '{"label":"convex","label":"concave","explanation":"Fixture."}',
    }, identity.profileId);
    const outcomes: (AnswerOutcome | null)[] = [
      answer("convex"), invalid("malformed-json"), invalid("empty"), duplicate,
      { ...identity, kind: "refused" }, { ...identity, kind: "truncated" },
      { ...identity, kind: "provider-error", message: "Fixture transport error." },
      { ...identity, kind: "interrupted" }, { ...identity, kind: "cancelled" }, null,
      invalid("invalid-label"), invalid("invalid-explanation"),
    ];
    const observations: Observation[] = outcomes.map((outcome, index) => ({
      caseId: `case-${Math.floor(index / 3)}`, depth: 1, referenceLabel: "convex", trialIndex: index % 3, outcome,
    }));
    const report = scoreClassifications(observations);
    expect(report.population).toEqual({
      plannedTrials: 12, includedTrials: 8, excludedTrials: 4, correctTrials: 1, status: "provisional",
    });
    expect(report.outcomes.invalid).toEqual({ numerator: 3, denominator: 8, value: 3 / 8 });
    for (const category of ["answer", "empty", "conflicting", "refused", "truncated"] as const) {
      expect(report.outcomes[category]).toEqual({ numerator: 1, denominator: 8, value: 1 / 8 });
    }
    for (const category of ["provider-error", "interrupted", "cancelled", "unattempted"] as const) {
      expect(report.outcomes[category]).toEqual({ numerator: 1, denominator: 12, value: 1 / 12 });
    }
    expect(Object.values(report.outcomes).reduce((sum, outcome) => sum + outcome.numerator, 0)).toBe(12);
    expect(labels.reduce((sum, label) => sum + report.classes[label].support, 0)).toBe(8);
    expect(report.confusion.rows.convex.counts).toEqual({ convex: 1, concave: 0, neither: 0, unusable: 7 });
    expect(report.confusion.rows.convex.rowRates).toEqual({ convex: 1 / 8, concave: 0, neither: 0, unusable: 7 / 8 });
    expect(report.classes.convex).toMatchObject({ tp: 1, fp: 0, fn: 7, support: 8, f1: 2 / 9 });
    expect(report.macroF1).toBe(2 / 27);
    expect(report.accuracy.value).toBe(1 / 8);
    expect(report.agreement.eligibleInstances).toBe(0);
  });

  it("includes every invalid reason without inventing predictions or dropping support", () => {
    const reasons: InvalidAnswerReason[] = [
      "empty", "response-too-large", "malformed-json", "duplicate-field", "invalid-shape", "invalid-label", "invalid-explanation",
    ];
    const report = scoreClassifications(repeated(reasons.map(() => "concave"), reasons.map(invalid)));
    expect(report.population).toMatchObject({ plannedTrials: 21, includedTrials: 21, excludedTrials: 0, status: "complete" });
    expect(report.classes.concave).toEqual({ tp: 0, fp: 0, fn: 21, support: 21, precision: null, recall: 0, f1: 0 });
    expect(report.outcomes.empty.numerator).toBe(3);
    expect(report.outcomes.conflicting.numerator).toBe(3);
    expect(report.outcomes.invalid.numerator).toBe(15);
    expect(report.confusion.rows.concave.counts.unusable).toBe(21);
    expect(report.macroF1).toBe(0);
  });

  it("keeps scores provisional and spread unavailable when only one replicate is complete", () => {
    const report = scoreClassifications(fixture(labels, [
      labels.map(answer),
      [answer("convex"), answer("concave"), { ...identity, kind: "provider-error", message: "Fixture failure." }],
      [answer("convex"), answer("concave"), { ...identity, kind: "cancelled" }],
    ]));
    expect(report.population).toEqual({
      plannedTrials: 9, includedTrials: 7, excludedTrials: 2, correctTrials: 7, status: "provisional",
    });
    expect(report.macroF1).toBe(1);
    expect(report.accuracy.value).toBe(1);
    expect(report.trials.map((trial) => trial.eligibleForSpread)).toEqual([true, false, false]);
    expect(report.trials[1].metrics.population).toMatchObject({ plannedTrials: 3, includedTrials: 2, status: "provisional" });
    expect(report.spread.macroF1).toEqual({ count: 1, mean: 1, min: 1, max: 1, sampleStandardDeviation: null });
    expect(report.agreement).toEqual({ eligibleInstances: 2, totalInstances: 3, agreeingPairs: 6, totalPairs: 6, value: 1 });
  });

  it("computes sample spread with two eligible matched replicates", () => {
    const report = scoreClassifications(fixture(labels, [
      labels.map(answer),
      [answer("concave"), answer("neither"), answer("convex")],
      [answer("convex"), answer("concave"), null],
    ]));
    expect(report.spread.eligibleReplicates).toBe(2);
    expect(report.spread.macroF1).toMatchObject({ count: 2, mean: 1 / 2, min: 0, max: 1 });
    expect(report.spread.macroF1.sampleStandardDeviation).toBeCloseTo(Math.sqrt(1 / 2), 12);
  });

  it("counts valid three-way disagreement and excludes all unusable instances from agreement", () => {
    const report = scoreClassifications(fixture(["convex", "concave"], [
      [answer("convex"), answer("concave")],
      [answer("concave"), invalid("empty")],
      [answer("neither"), answer("concave")],
    ]));
    expect(report.agreement).toEqual({ eligibleInstances: 1, totalInstances: 2, agreeingPairs: 0, totalPairs: 3, value: 0 });
    const oneTrial = scoreClassifications(fixture(["convex"], [[answer("convex")]]), 1);
    expect(oneTrial.agreement).toEqual({ eligibleInstances: 1, totalInstances: 1, agreeingPairs: 0, totalPairs: 0, value: null });
    expect(oneTrial.spread.macroF1.sampleStandardDeviation).toBeNull();
  });

  it("produces identical classification summaries regardless of record order", () => {
    const observations = fixture(labels, [
      labels.map(answer), [answer("convex"), invalid("empty"), answer("neither")],
      [null, answer("concave"), answer("convex")],
    ]);
    const before = structuredClone(observations);
    expect(scoreClassifications([...observations].reverse())).toEqual(scoreClassifications(observations));
    expect(observations).toEqual(before);
  });
});
