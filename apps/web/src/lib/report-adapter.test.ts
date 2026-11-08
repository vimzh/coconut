// Existing synthetic scoring artifacts exercise projection behavior; they are never application results.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import source from "../../../api/data/scoring/mixed-v1.input.json";
import report from "../../../api/data/scoring/mixed-v1.report.json";
import numericalSuite from "../../../api/data/suites/smooth-v2.json";
import challengeSuite from "../../../api/data/suites/challenge-v1.json";
import {
  adaptRunView,
  adaptRunViews,
  buildReportExport,
  groupReportRuns,
  ReportInputError,
  reportSlice,
  usageSeries,
} from "./report-adapter";

function fixture() {
  return structuredClone({
    publishedAt: null,
    record: {
      version: "1",
      id: source.evidence.runId,
      state: "completed",
      createdAt: "2026-11-08T00:00:00.000Z",
      request: {
        suiteKey: "reference-v1",
        provider: source.evidence.model.provider,
        modelId: source.evidence.model.modelId,
        servingProvider: null,
        profileId: source.evidence.profileId,
        concurrency: 1,
      },
      prompts: [
        {
          generation: {
            maxOutputTokens: 4096,
            sampling: "provider-default",
            reasoning: "provider-default",
            tools: "none",
          },
        },
      ],
      suite: source.suite,
      evidence: source.evidence,
      report,
      results: [],
      failure: null,
    },
  });
}
function set(value: unknown, path: readonly string[], replacement: unknown) {
  let current = value as Record<string, unknown>;
  for (const key of path.slice(0, -1))
    current = current[key] as Record<string, unknown>;
  current[path[path.length - 1]] = replacement;
}

describe("retained report browser projection", () => {
  it("displays oversized invalid replies throughout the server's retained-text budget", () => {
    for (const length of [65537, 131072]) {
      const view = fixture();
      // Keep Bun/native backend modules outside the browser compiler's dependency graph.
      const scorer = new URL("../../../api/src/scoring/index.ts", import.meta.url).href;
      const protocol = new URL("../../../api/src/protocol/index.ts", import.meta.url).href;
      const result = spawnSync("bun", ["-e", `const {scoreEvaluation}=await import(${JSON.stringify(scorer)});const {extractAnswer}=await import(${JSON.stringify(protocol)});const v=await Bun.stdin.json();const t=v.record.evidence.trials[0];t.attempts[t.finalAttempt-1].outcome=extractAnswer({status:"completed",text:"x".repeat(${length})},v.record.evidence.profileId);v.record.report=await scoreEvaluation({suite:v.record.suite,evidence:v.record.evidence});console.log(JSON.stringify(v));`], { input: JSON.stringify(view), encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const retained = JSON.parse(result.stdout);
      const projected = adaptRunView(retained);
      assert.equal(projected.trials[0].outcome, "invalid");
      assert.equal(projected.trials[0].rawText?.length, length);
      assert.equal(projected.overall!.macroF1, retained.record.report.overall.classification.macroF1);
    }
  });
  it("exports the same selected detail, curves, depth, and usage view without recomputing aggregates", () => {
    const detailRun = adaptRunView(fixture()),
      curve = { ...detailRun, id: "second-run" };
    const output = buildReportExport({
      detailRun,
      curveRuns: [curve],
      depth: 5,
      usageField: "reasoning",
      usageSemantics: "fixture.reasoning-subset",
    });
    assert.deepEqual(output.curveRunIds, [curve.id]);
    assert.deepEqual(
      output.runs.map((run) => run.id),
      [curve.id, detailRun.id],
    );
    assert.equal(
      output.runs.every((run) => run.overall === null),
      true,
    );
    assert.equal(
      output.runs[0].depths[0].slice!.macroF1,
      detailRun.depths[0].slice!.macroF1,
    );
    assert.equal(output.runs[0].trials.length, 9);
    assert.deepEqual(output.usageView, {
      field: "reasoning",
      semantics: "fixture.reasoning-subset",
    });
    assert.equal(detailRun.overall !== null, true);
    assert.throws(
      () =>
        buildReportExport({
          detailRun,
          curveRuns: [{ ...curve, groupKey: "different-group" }],
          depth: null,
          usageField: "output",
          usageSemantics: null,
        }),
      ReportInputError,
    );
    assert.throws(
      () =>
        buildReportExport({
          detailRun,
          curveRuns: [curve, { ...detailRun, overall: null }],
          depth: null,
          usageField: "output",
          usageSemantics: null,
        }),
      ReportInputError,
    );
  });

  it("retains the independent analytic reference alongside interval evidence", () => {
    const input = fixture();
    set(input, ["record", "report"], null);
    set(input, ["record", "suite"], challengeSuite);
    set(input, ["record", "evidence", "suiteId"], challengeSuite.id);
    set(
      input,
      ["record", "evidence", "trials"],
      challengeSuite.cases.flatMap((entry) =>
        Array.from({ length: 3 }, (_, trialIndex) => ({
          caseId: entry.id,
          trialIndex,
          finalAttempt: null,
          elapsedMs: null,
          attempts: [],
        })),
      ),
    );
    const result = adaptRunView(input);
    assert.equal(
      result.cases[0].proof.independent?.policy,
      "analytic-curvature-v1",
    );
    assert.deepEqual(
      result.cases[0].proof.independent?.globalSecond,
      challengeSuite.cases[0].analyticCertificate.globalSecond,
    );
    assert.equal(result.generatorVersion, "challenge-v1");
  });

  it("projects retained interval certificates without inventing scores for unattempted work", () => {
    const input = fixture();
    set(input, ["record", "report"], null);
    set(input, ["record", "suite"], numericalSuite);
    set(input, ["record", "evidence", "suiteId"], numericalSuite.id);
    set(
      input,
      ["record", "evidence", "trials"],
      numericalSuite.cases.flatMap((entry) =>
        Array.from({ length: 3 }, (_, trialIndex) => ({
          caseId: entry.id,
          trialIndex,
          finalAttempt: null,
          elapsedMs: null,
          attempts: [],
        })),
      ),
    );
    const result = adaptRunView(input);
    assert.equal(result.cases[0].proof.kind, "interval");
    assert.equal(result.cases[0].proof.precision, 192);
    assert.equal(
      result.cases[0].proof.steps,
      numericalSuite.cases[0].certificate.cover.length,
    );
    assert.equal(
      result.trials.every(
        (trial) => trial.outcome === "unattempted" && trial.rawText === null,
      ),
      true,
    );
    assert.equal(
      result.depths.every((point) => point.slice === null),
      true,
    );
  });

  it("preserves exact scorer metrics, denominators, spread, and missing cost totals", () => {
    const result = adaptRunView(fixture()),
      slice = result.overall!;
    assert.equal(slice.macroF1, report.overall.classification.macroF1);
    assert.equal(slice.accuracy.value, 2 / 3);
    assert.equal(slice.population.includedTrials, 9);
    assert.equal(
      slice.spread.sampleStandardDeviation,
      report.overall.classification.spread.macroF1.sampleStandardDeviation,
    );
    assert.equal(slice.cost.total, null);
    assert.equal(slice.cost.groups[0].amount, "0.0003");
    assert.equal(slice.cost.groups[1].amount, "0.000044");
    assert.equal(slice.latency.p95Ms, 90);
    assert.equal(slice.agreement.value, 1 / 3);
  });

  it("keeps the confusion matrix orientation, unusable column, and class support", () => {
    const result = adaptRunView(fixture());
    assert.deepEqual(result.overall!.confusion.convex.counts, {
      convex: 2,
      concave: 0,
      neither: 0,
      unusable: 1,
    });
    assert.equal(result.overall!.confusion.convex.rowRates!.unusable, 1 / 3);
    assert.equal(result.overall!.classes.convex.support, 3);
    assert.equal(result.overall!.outcomes.empty.numerator, 1);
    assert.equal(result.overall!.outcomes.empty.denominator, 9);
  });

  it("preserves nonuniform measured depth positions and null report gaps", () => {
    const input = fixture();
    set(input, ["record", "report"], null);
    set(input, ["record", "suite", "request", "depths"], [80, 5, 10]);
    const result = adaptRunView(input);
    assert.deepEqual(
      result.depths.map((point) => point.depth),
      [5, 10, 80],
    );
    assert.equal(result.overall, null);
    assert.equal(
      result.depths.every((point) => point.slice === null),
      true,
    );
    assert.equal(reportSlice(result, 10), null);
    assert.deepEqual(
      usageSeries(result, "output", "fixture.output").map(
        (point) => point.value,
      ),
      [null, null, null],
    );
  });

  it("keeps model series distinct within a shared population and separates changed settings/profile/suite identities", () => {
    const a = adaptRunView(fixture()),
      changed = fixture();
    for (const path of [
      ["record", "id"],
      ["record", "evidence", "runId"],
      ["record", "report", "identity", "runId"],
    ])
      set(changed, path, "second-fixture-run");
    for (const path of [
      ["record", "request", "modelId"],
      ["record", "evidence", "model", "modelId"],
      ["record", "report", "identity", "model", "modelId"],
    ])
      set(changed, path, "second-fixture-model");
    const b = adaptRunView(changed);
    assert.equal(a.groupKey, b.groupKey);
    assert.equal(groupReportRuns([a, b]).length, 1);
    for (const field of ["settingsId", "profileId", "suiteId"]) {
      const input = fixture();
      if (field === "settingsId")
        for (const path of [
          ["record", "evidence", "model", field],
          ["record", "report", "identity", "model", field],
        ])
          set(input, path, "different-settings");
      if (field === "profileId") {
        for (const path of [
          ["record", "request", field],
          ["record", "suite", "request", field],
          ["record", "evidence", field],
          ["record", "report", "identity", field],
          ["record", "report", "identity", "workload", field],
        ])
          set(input, path, "one-shot-json-v2-high");
        set(
          input,
          ["record", "report", "identity", "workload", "maxOutputTokens"],
          16384,
        );
        set(
          input,
          ["record", "prompts", "0", "generation", "maxOutputTokens"],
          16384,
        );
        set(
          input,
          ["record", "prompts", "0", "generation", "reasoning"],
          "high",
        );
      }
      if (field === "suiteId")
        for (const path of [
          ["record", "suite", "id"],
          ["record", "evidence", field],
          ["record", "report", "identity", field],
        ])
          set(input, path, "different-suite");
      assert.notEqual(adaptRunView(input).groupKey, a.groupKey);
    }
    assert.throws(
      () => adaptRunViews([fixture(), fixture()]),
      ReportInputError,
    );
  });

  it("uses one reported token semantic group without adding reasoning to output", () => {
    const result = adaptRunView(fixture());
    assert.equal(
      usageSeries(result, "output", "fixture.output")[0].value,
      6.125,
    );
    assert.equal(
      usageSeries(result, "reasoning", "fixture.reasoning-subset")[0].value,
      3.5,
    );
    assert.equal(
      usageSeries(result, "output", "missing-semantic-group")[0].value,
      null,
    );
    assert.equal(usageSeries(result, "output", "fixture.output", 80).length, 0);
    assert.equal(
      reportSlice(result, 5)?.macroF1,
      result.depths[0].slice?.macroF1,
    );
  });

  it("retains actual task/domain/proof and raw/extracted trial evidence while dropping diagnostic messages", () => {
    const input = fixture();
    set(input, ["record", "failure"], {
      code: "internal",
      message: "private diagnostic",
    });
    const result = adaptRunView(input);
    assert.deepEqual(
      result.cases[0].domain,
      source.suite.cases[0].reference.domain,
    );
    assert.equal(
      result.cases[0].expression,
      source.suite.cases[0].certificate.renderedExpression,
    );
    assert.equal(result.cases[0].proof.kind, "structural");
    assert.equal(result.trials[0].attempts, 2);
    assert.equal(
      result.trials[0].rawText,
      source.evidence.trials[0].attempts[1].outcome.rawText,
    );
    assert.equal(result.trials[0].label, "convex");
    assert.equal(JSON.stringify(result).includes("private diagnostic"), false);
    const partial = fixture();
    set(partial, ["record", "report"], null);
    const first = partial.record.evidence.trials[0];
    set(first, ["attempts"], [first.attempts[0]]);
    set(first, ["finalAttempt"], 1);
    const failedTrial = adaptRunView(partial).trials[0];
    assert.equal(failedTrial.outcome, "provider-error");
    assert.equal(failedTrial.label, null);
    assert.equal(failedTrial.errorKind, "timeout");
  });

  it("rejects mismatched identities, invalid numbers, denominators, duplicate depths and missing logical records", () => {
    for (const [path, value] of [
      [["record", "report", "identity", "suiteId"], "wrong-suite"],
      [["record", "report", "identity", "generatorVersion"], "wrong-generator"],
      [["record", "report", "overall", "classification", "macroF1"], NaN],
      [["record", "report", "overall", "classification", "macroF1"], 1.01],
      [
        [
          "record",
          "report",
          "overall",
          "classification",
          "population",
          "excludedTrials",
        ],
        1,
      ],
      [
        ["record", "suite", "request", "depths"],
        [5, 5],
      ],
      [["record", "evidence", "trials"], []],
    ] as const) {
      const input = fixture();
      set(input, path, value);
      assert.throws(() => adaptRunView(input), ReportInputError);
    }
    let reads = 0;
    const input = fixture();
    Object.defineProperty(input.record, "report", {
      enumerable: true,
      get() {
        reads++;
        throw new Error("private getter");
      },
    });
    assert.throws(() => adaptRunView(input), ReportInputError);
    assert.equal(reads, 0);
  });
});
