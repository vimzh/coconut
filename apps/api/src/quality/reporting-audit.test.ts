// Check the independent audit against hand-calculated outcomes and deliberately rehashed report corruption.
import { beforeAll, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { scoreEvaluation } from "../scoring";
import { fixtureRun, replaceReply, type Mutable } from "./fixtures";
import { auditRetainedMetrics } from "./reporting-audit";
import type { RunRecord } from "../runs/types";

let base: Mutable<RunRecord>;
beforeAll(async () => { base = await fixtureRun(); });

function refreshHash(record: Mutable<RunRecord>) {
  const { id, ...content } = record.report!;
  if (!id) throw new Error("Fixture needs a report identity.");
  record.report!.id = `report-v1-${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

it("reproduces the retained hand-calculated mixed fixture including retries and missing fields", async () => {
  const input = await Bun.file(new URL("../../data/scoring/mixed-v1.input.json", import.meta.url)).json();
  const report = await Bun.file(new URL("../../data/scoring/mixed-v1.report.json", import.meta.url)).json();
  const record: RunRecord = { ...base, id: input.evidence.runId, suite: input.suite, evidence: input.evidence, report };
  const audit = auditRetainedMetrics(record);
  expect(audit.macroF1).toBeCloseTo(76 / 105, 12);
  expect(audit.accuracy).toBe(2 / 3);
  expect(audit.outcomes.empty).toBe(1);
  expect(audit.plannedTrials).toBe(9);
  expect(report.overall.diagnostics.usage.attempts.total).toBe(10);
  expect(report.overall.classification.spread.macroF1.sampleStandardDeviation).toBeCloseTo(Math.sqrt(57) / 18, 12);
});

it("checks complete, partial and unavailable populations without promoting excluded work to answers", async () => {
  expect(auditRetainedMetrics(base)).toMatchObject({ populationStatus: "complete", includedModelOutcomes: 9, correct: 9 });
  const partial = structuredClone(base);
  replaceReply(partial, 0, 0, { status: "provider-error", text: "", message: "Controlled unavailable response." });
  partial.report = structuredClone(await scoreEvaluation({ suite: partial.suite, evidence: partial.evidence })) as Mutable<NonNullable<RunRecord["report"]>>;
  expect(auditRetainedMetrics(partial)).toMatchObject({ populationStatus: "provisional", includedModelOutcomes: 8, correct: 8, wrongValid: 0 });
  const unavailable = structuredClone(base);
  for (const trial of unavailable.evidence.trials) { trial.attempts = []; trial.finalAttempt = null; trial.elapsedMs = null; }
  unavailable.results = [];
  unavailable.report = structuredClone(await scoreEvaluation({ suite: unavailable.suite, evidence: unavailable.evidence })) as Mutable<NonNullable<RunRecord["report"]>>;
  expect(auditRetainedMetrics(unavailable)).toMatchObject({ populationStatus: "unavailable", macroF1: null, accuracy: null, includedModelOutcomes: 0 });
});

it("detects altered classification, trial spread, directional errors, usage, and latency after content rehashing", () => {
  const mutations = [
    (run: Mutable<RunRecord>) => { run.report!.overall.classification.classes.convex.recall = 0.5; },
    (run: Mutable<RunRecord>) => { run.report!.overall.classification.confusion.rows.convex.counts.neither = 1; },
    (run: Mutable<RunRecord>) => { run.report!.overall.classification.spread.macroF1.mean = 0.5; },
    (run: Mutable<RunRecord>) => { run.report!.overall.classification.directionalErrors.convexToNeither.numerator = 1; },
    (run: Mutable<RunRecord>) => { run.report!.overall.diagnostics.usage.attempts.fields.input.missing = 0; },
    (run: Mutable<RunRecord>) => { run.report!.overall.diagnostics.latency.p95Ms = 2; },
    (run: Mutable<RunRecord>) => { run.report!.byDepth[0].macroF1Difference = 0.5; },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(base); mutate(altered); refreshHash(altered);
    expect(() => auditRetainedMetrics(altered)).toThrow();
  }
});

it("rejects missing retained reports and changed evidence identities", () => {
  expect(() => auditRetainedMetrics({ ...base, report: null })).toThrow("required");
  const changed = structuredClone(base); changed.evidence.model.settingsId = "other-setting";
  expect(() => auditRetainedMetrics(changed)).toThrow();
});
