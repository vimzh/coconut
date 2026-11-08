// Synthetic summaries verify public policy without publishing invented application results.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import retained from "../../../api/data/scoring/mixed-v1.report.json";
import { buildLeaderboard, LeaderboardInputError } from "./leaderboard";

const now = Date.parse("2026-11-08T04:00:00.000Z");
function fixture(id = "run-one", model = "test-model") {
  const report = structuredClone(retained);
  report.identity.runId = id;
  report.identity.model.provider = "openai";
  report.identity.model.modelId = model;
  report.identity.model.endpointId = "openai/direct";
  return {
    version: "1",
    id,
    state: "completed",
    createdAt: "2026-11-08T01:00:00.000Z",
    publishedAt: "2026-11-08T02:00:00.000Z" as string | null,
    expiresAt: "2026-11-15T01:00:00.000Z",
    request: {
      suiteKey: "reference-v1",
      profileId: report.identity.profileId,
      provider: "openai",
      modelId: model,
      servingProvider: null,
      concurrency: 3,
    },
    suite: {
      id: report.identity.suiteId,
      population: "reference",
      caseCount: 3,
      depths: [5],
      generatorVersion: "1",
      depthPolicyVersion: "1",
      protocolVersion: "1",
      verifierVersion: "1",
      promptVersion: "exact-v1",
    },
    progress: {
      plannedTrials: 9,
      startedTrials: 9,
      activeTrials: 0,
      finishedTrials: 9,
      modelOutcomes: 9,
      infrastructureFailures: 0,
      remainingTrials: 0,
      inferenceRequests: 9,
    },
    observation: {
      reportedModelIds: [model],
      reportedServingProviders: [] as string[],
      modelIdentityMissing: 0,
      contextFitUnverified: 0,
      outputLimitUnverified: 0,
      schemaUnverified: 0,
    },
    report,
  };
}
const board = (...runs: ReturnType<typeof fixture>[]) =>
  buildLeaderboard({ version: "1", runs }, now);

describe("public comparison policy", () => {
  it("keeps the exact scorer value, counted unusable answers and observed trial spread", () => {
    const value = fixture(),
      [group] = board(value),
      [entry] = group.entries;
    assert.equal(entry.rank, 1);
    assert.equal(entry.macroF1, retained.overall.classification.macroF1);
    assert.equal(
      entry.accuracy,
      retained.overall.classification.accuracy.value,
    );
    assert.equal(entry.unusable, 1);
    assert.equal(
      entry.trialMin,
      retained.overall.classification.spread.macroF1.min,
    );
    assert.equal(value.report.identity.runId, value.id);
  });
  it("uses earliest created eligible publication rather than the highest repeated score", () => {
    const early = fixture("early"),
      late = fixture("late");
    late.createdAt = "2026-11-08T01:30:00.000Z";
    late.report.overall.classification.macroF1 = 1;
    const rows = board(late, early)[0].entries;
    assert.equal(rows.find((row) => row.id === "early")?.rank, 1);
    assert.equal(rows.find((row) => row.id === "late")?.rank, null);
    assert.equal(
      rows.find((row) => row.id === "late")?.representativeId,
      "early",
    );
    assert.deepEqual(rows[0].repeatedRunIds, ["early", "late"]);
  });
  it("uses competition ties on unrounded numbers and does not tie close rounded display values", () => {
    const a = fixture("a", "model-a"),
      b = fixture("b", "model-b"),
      c = fixture("c", "model-c");
    a.report.overall.classification.macroF1 = 0.8;
    b.report.overall.classification.macroF1 = 0.8;
    c.report.overall.classification.macroF1 = 0.799999999;
    const rows = board(c, b, a)[0].entries;
    assert.deepEqual(
      rows.map((row) => [row.id, row.rank]),
      [
        ["a", 1],
        ["b", 1],
        ["c", 3],
      ],
    );
  });
  it("separates suite, execution settings, population and profile identities", () => {
    const a = fixture("a"),
      b = fixture("b"),
      c = fixture("c"),
      d = fixture("d");
    b.suite.id = "another-suite";
    b.report.identity.suiteId = b.suite.id;
    c.report.identity.model.settingsId = "another-settings";
    d.request.profileId = "one-shot-schema-v1";
    d.report.identity.profileId = "one-shot-schema-v1";
    d.report.identity.workload.profileId = "one-shot-schema-v1";
    assert.equal(board(a, b, c, d).length, 4);
  });
  it("keeps the separate interior population unranked even with complete execution evidence", () => {
    const run = fixture();
    run.suite.population = "exploratory";
    run.suite.generatorVersion = "interior-v1";
    run.report.identity.generatorVersion = "interior-v1";
    const entry = board(run)[0].entries[0];
    assert.equal(entry.rank, null);
    assert.equal(entry.eligible, false);
    assert.equal(entry.macroF1, run.report.overall.classification.macroF1);
    run.suite.population = "reference";
    assert.equal(board(run)[0].entries[0].eligible, false);
  });

  it("keeps reserve generator evidence unranked even when its population is forged as confirmation", () => {
    for (const population of ["exploratory", "confirmation", "reference"]) {
      const run = fixture();
      run.request.suiteKey = "reserve-v1";
      run.suite.population = population;
      run.suite.generatorVersion = "reserve-v1";
      run.report.identity.generatorVersion = "reserve-v1";
      const entry = board(run)[0].entries[0];
      assert.equal(entry.eligible, false);
      assert.equal(entry.rank, null);
      assert.equal(entry.representativeId, null);
      assert.equal(entry.macroF1, run.report.overall.classification.macroF1);
      assert.match(entry.reasons.join(" "), /exploratory.*unranked/);
    }
  });

  it("keeps an exploratory population unranked independently of its suite key and generator", () => {
    const run = fixture();
    run.suite.population = "exploratory";
    const entry = board(run)[0].entries[0];
    assert.equal(entry.eligible, false);
    assert.equal(entry.rank, null);
    assert.equal(entry.macroF1, retained.overall.classification.macroF1);
  });

  it("rejects a substituted reserve generator when it contradicts the retained report", () => {
    const run = fixture();
    run.request.suiteKey = "reserve-v1";
    run.suite.generatorVersion = "reserve-v1";
    run.report.identity.generatorVersion = "reserve-v1";
    run.suite.generatorVersion = "1";
    assert.throws(() => board(run), LeaderboardInputError);
  });

  it("leaves screening scores visible without assigning ranks", () => {
    const run = fixture();
    run.suite.population = "screening";
    const row = board(run)[0].entries[0];
    assert.equal(row.rank, null);
    assert.equal(row.macroF1, retained.overall.classification.macroF1);
    assert.match(row.reasons.join(" "), /exploratory/);
  });
  it("excludes withdrawn or expired evidence and unstable execution identities", () => {
    for (const mutate of [
      (run: ReturnType<typeof fixture>) => {
        run.publishedAt = null;
      },
      (run: ReturnType<typeof fixture>) => {
        run.expiresAt = "2026-11-08T03:59:59.000Z";
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.reportedModelIds = [];
        run.observation.modelIdentityMissing = 9;
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.reportedModelIds.push("other");
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.reportedServingProviders = ["a", "b"];
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.contextFitUnverified = 1;
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.outputLimitUnverified = 1;
      },
      (run: ReturnType<typeof fixture>) => {
        run.observation.schemaUnverified = 1;
      },
    ]) {
      const run = fixture();
      mutate(run);
      assert.equal(board(run)[0].entries[0].eligible, false);
    }
  });
  it("requires routed serving identity but permits an honestly unknown direct provider label", () => {
    const direct = fixture();
    assert.equal(board(direct)[0].entries[0].eligible, true);
    const routed = fixture();
    routed.request.provider = "openrouter";
    routed.report.identity.model.provider = "openrouter";
    routed.report.identity.model.endpointId = "openrouter/direct";
    assert.equal(board(routed)[0].entries[0].eligible, false);
    routed.observation.reportedServingProviders = ["test-provider"];
    assert.equal(board(routed)[0].entries[0].eligible, true);
  });
  it("does not turn interrupted work or recorded provider failures into complete rankings", () => {
    const run = fixture();
    run.state = "interrupted";
    run.progress.modelOutcomes = 8;
    run.progress.infrastructureFailures = 1;
    run.report.overall.classification.population.includedTrials = 8;
    run.report.overall.classification.population.excludedTrials = 1;
    run.report.overall.classification.population.status = "provisional";
    assert.equal(board(run)[0].entries[0].rank, null);
  });
  it("does not choose an ineligible early repeat as the representative", () => {
    const early = fixture("early"),
      late = fixture("late");
    early.observation.contextFitUnverified = 1;
    late.createdAt = "2026-11-08T02:00:00.000Z";
    assert.equal(
      board(early, late)[0].entries.find((row) => row.rank === 1)?.id,
      "late",
    );
  });
  it("distinguishes a valid empty population from malformed or contradictory evidence", () => {
    assert.deepEqual(board(), []);
    for (const input of [
      null,
      {},
      { version: "1", runs: [{}] },
      { version: "1", runs: [fixture(), fixture()] },
    ])
      assert.throws(() => buildLeaderboard(input, now), LeaderboardInputError);
    const wrongIdentity = fixture();
    wrongIdentity.report.identity.runId = "other";
    assert.throws(() => board(wrongIdentity), LeaderboardInputError);
    const accessed = fixture();
    Object.defineProperty(accessed, "id", {
      get() {
        throw new Error("Getter must not run");
      },
    });
    assert.throws(() => board(accessed), LeaderboardInputError);
    const wrongProgress = fixture();
    wrongProgress.progress.finishedTrials = 8;
    assert.throws(() => board(wrongProgress), LeaderboardInputError);
  });
});
