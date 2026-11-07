// Exercise the public scorer across frozen suites, retained evidence, and expected reports.
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { extractAnswer } from "../protocol";
import { generateSuite, type FrozenSuite } from "../suites";
import { MAX_PROVIDER_ERROR_CODE_UNITS, MAX_RETAINED_REPLY_CODE_UNITS, MAX_RETAINED_TEXT_CODE_UNITS, scoreEvaluation, ScoringInputError, type RunEvidence } from "./index";

type Mutable<T> = T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
type Input = Mutable<{ suite: FrozenSuite; evidence: RunEvidence }>;
const artifact = new URL("../../data/scoring/mixed-v1.input.json", import.meta.url);
const expectedArtifact = new URL("../../data/scoring/mixed-v1.report.json", import.meta.url);
const original = await Bun.file(artifact).json() as Input;
const fixture = (): Input => structuredClone(original);

function evidence(suite: FrozenSuite): Mutable<RunEvidence> {
  return {
    ...structuredClone(original.evidence), suiteId: suite.id, profileId: suite.request.profileId, expressionTokens: [],
    trials: suite.cases.flatMap((entry) => [0, 1, 2].map((trialIndex) => ({
      caseId: entry.id, trialIndex, finalAttempt: 1, elapsedMs: 10,
      attempts: [{
        sequence: 1, outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: entry.label, explanation: "Controlled fixture." }) }, suite.request.profileId),
        errorKind: null, elapsedMs: 5, usage: { input: null, output: null, reasoning: null }, cost: null,
      }],
    }))),
  };
}

async function twoDepths(): Promise<Input> {
  const generated = await generateSuite({ ...original.suite.request, seed: "scoring-depth-fixture", depths: [5, 10] });
  if (generated.status !== "complete") throw new Error("Controlled suite incomplete.");
  return { suite: structuredClone(generated.suite) as Input["suite"], evidence: evidence(generated.suite) };
}

describe("public scoring integration", () => {
  it("reproduces the retained report and independently calculated counts and diagnostics", async () => {
    const report = await scoreEvaluation(fixture());
    expect(report).toEqual(await Bun.file(expectedArtifact).json());
    expect(report.id).toBe("report-v1-ea4995968ffe665adffe3ff72973f3de18140176b6e3b49af21cef01076e84dc");
    const classification = report.overall.classification;
    expect(classification.macroF1).toBeCloseTo(76 / 105, 12);
    expect(classification.accuracy).toEqual({ numerator: 6, denominator: 9, value: 2 / 3 });
    expect(classification.spread.macroF1.mean).toBeCloseTo(11 / 18, 12);
    expect(classification.spread.macroF1.sampleStandardDeviation).toBeCloseTo(Math.sqrt(57) / 18, 12);
    expect(classification.agreement).toEqual({ eligibleInstances: 2, totalInstances: 3, agreeingPairs: 2, totalPairs: 6, value: 1 / 3 });
    expect(classification.population.plannedTrials).toBe(9);
    expect(classification.population.includedTrials).toBe(9);
    expect(report.overall.diagnostics.usage.attempts.total).toBe(10);
    expect(report.overall.diagnostics.cost.groups.map(({ amount }) => amount)).toEqual(["0.0003", "0.000044"]);
    expect(report.overall.diagnostics.cost.total).toBeNull();
    expect(report.overall.diagnostics.latency).toMatchObject({ eligible: 9, p50Ms: 50, p95Ms: 90, timeoutAttempts: 1 });
    expect(report.overall.diagnostics.lengths.expressionTokens).toMatchObject({ compatibleCases: 1, incompatibleCases: 1, missingCases: 1 });
    expect(report.overall.diagnostics.intermediateSteps.status).toBe("not-applicable");
    expect(report.identity.model.provider).toBe("fixture");
    expect(Object.isFrozen(report.overall.classification.classes.convex)).toBe(true);
  });

  it("canonicalizes record and property order and binds changed evidence to a new identity", async () => {
    const reordered = fixture();
    reordered.evidence.trials.reverse();
    reordered.evidence.expressionTokens.reverse();
    const canonical = await scoreEvaluation(fixture());
    const actual = await scoreEvaluation({ evidence: reordered.evidence, suite: reordered.suite });
    expect(JSON.stringify(actual)).toBe(JSON.stringify(canonical));
    const changed = fixture();
    changed.evidence.runId = "fixture-new-run";
    expect((await scoreEvaluation(changed)).id).not.toBe(canonical.id);
  });

  it("scores all 225 logical trials of the checked-in reference suite without provider calls", async () => {
    const suite = await Bun.file(new URL("../../data/suites/reference-v1.json", import.meta.url)).json() as FrozenSuite;
    const report = await scoreEvaluation({ suite, evidence: evidence(suite) });
    expect(report.overall.classification.macroF1).toBe(1);
    expect(report.overall.classification.population).toEqual({ plannedTrials: 225, includedTrials: 225, excludedTrials: 0, correctTrials: 225, status: "complete" });
    expect(report.identity.workload).toMatchObject({ logicalCalls: 225, maxAttempts: 450 });
    expect(report.byDepth.map((slice) => [slice.depth, slice.classification.population.plannedTrials, slice.macroF1Difference]))
      .toEqual([5, 10, 20, 40, 80].map((depth) => [depth, 45, 0]));
    expect(report.overall.diagnostics.lengths.cases).toBe(75);
    expect(report.overall.diagnostics.lengths.nodeCount.max).toBe(469);
    expect(report.overall.diagnostics.lengths.expressionCharacters.max! < report.overall.diagnostics.lengths.promptCharacters.max!).toBe(true);
    expect(report.overall.diagnostics.lengths.expressionTokens.compatibleCases).toBe(0);
    expect(report.overall.diagnostics.usage.attempts.fields.reasoning).toEqual({ reporting: 0, missing: 225, groups: [] });
  });

  it("preserves every depth, signed F1 differences, and unavailable shallow baselines", async () => {
    for (const degraded of [true, false]) {
      const input = await twoDepths();
      for (const trial of input.evidence.trials) {
        const depth = input.suite.cases.find((entry) => entry.id === trial.caseId)!.depth;
        if ((depth === 10) === degraded) {
          trial.attempts[0].outcome = extractAnswer({ status: "completed", text: '{"label":"convex","explanation":"Controlled fixture."}' }, input.evidence.profileId);
        }
      }
      const report = await scoreEvaluation(input);
      expect(report.byDepth.map(({ depth }) => depth)).toEqual([5, 10]);
      expect(report.byDepth[1].macroF1Difference).toBeCloseTo(degraded ? -5 / 6 : 5 / 6, 12);
    }
    const input = await twoDepths();
    for (const trial of input.evidence.trials) {
      if (input.suite.cases.find((entry) => entry.id === trial.caseId)!.depth === 5) {
        trial.attempts = []; trial.finalAttempt = null; trial.elapsedMs = null;
      }
    }
    const report = await scoreEvaluation(input);
    expect(report.baselineDepth).toBe(5);
    expect(report.byDepth.map(({ macroF1Difference }) => macroF1Difference)).toEqual([null, null]);
    expect(report.byDepth[0].classification.population.status).toBe("unavailable");
    expect(report.byDepth[1].classification.macroF1).toBe(1);
    expect(report.overall.classification.population.status).toBe("provisional");
  });

  it("includes unusable replies without scoring retries as extra trials", async () => {
    const input = fixture();
    input.evidence = evidence(input.suite);
    const perfect = await scoreEvaluation(input);
    input.evidence.trials[0].attempts[0].outcome = extractAnswer({ status: "truncated", text: '{"label":"convex","explanation":"Looks complete."}' }, input.evidence.profileId);
    const failed = await scoreEvaluation(input);
    expect(failed.overall.classification.population.includedTrials).toBe(9);
    expect(failed.overall.classification.macroF1).toBeLessThan(perfect.overall.classification.macroF1!);
    expect(failed.overall.classification.confusion.rows.convex.counts.unusable).toBe(1);
    expect(failed.overall.classification.classes.convex.fn).toBe(1);
  });

  it("pools unequal depth populations instead of averaging depth-level F1", async () => {
    const input = await twoDepths();
    let retained = false;
    for (const trial of input.evidence.trials) {
      if (input.suite.cases.find((entry) => entry.id === trial.caseId)!.depth !== 10) continue;
      if (!retained) {
        trial.attempts[0].outcome = extractAnswer({ status: "completed", text: '{"label":"neither","explanation":"Controlled fixture."}' }, input.evidence.profileId);
        retained = true;
      } else { trial.attempts = []; trial.finalAttempt = null; trial.elapsedMs = null; }
    }
    const report = await scoreEvaluation(input);
    // The 9 perfect shallow outcomes plus one C→N give F1=(6/7,1,6/7).
    expect(report.overall.classification.macroF1).toBeCloseTo(19 / 21, 12);
    expect(report.overall.classification.population).toMatchObject({ includedTrials: 10, excludedTrials: 8, status: "provisional" });
    expect(report.byDepth.map((slice) => slice.classification.macroF1)).toEqual([1, 0]);
    expect(report.overall.classification.macroF1).not.toBe(0.5);
  });

  it("snapshots caller-owned evidence before asynchronous suite replay", async () => {
    const input = fixture();
    const pending = scoreEvaluation(input);
    input.evidence.runId = "changed-after-call";
    input.evidence.trials.splice(0);
    const report = await pending;
    expect(report.identity.runId).toBe("fixture-mixed-v1");
    expect(report.overall.classification.population.plannedTrials).toBe(9);
  });
});

describe("scoring evidence trust boundary", () => {
  const alterations: [string, (input: Input) => void][] = [
    ["suite identity", (input) => { input.evidence.suiteId = "different-suite"; }],
    ["protocol version", (input) => { Object.assign(input.evidence, { protocolVersion: "2" }); }],
    ["profile", (input) => { input.evidence.profileId = "one-shot-schema-v1"; }],
    ["duplicate trial", (input) => { input.evidence.trials[1] = structuredClone(input.evidence.trials[0]); }],
    ["missing trial", (input) => { input.evidence.trials.pop(); }],
    ["unknown case", (input) => { input.evidence.trials[0].caseId = "unknown-case"; }],
    ["trial index", (input) => { input.evidence.trials[0].trialIndex = 3; }],
    ["conflicting reference field", (input) => { Object.assign(input.evidence.trials[0], { label: "concave" }); }],
    ["attempt sequence", (input) => { input.evidence.trials[0].attempts[0].sequence = 0; }],
    ["excess attempts", (input) => { input.evidence.trials[0].attempts.push(structuredClone(input.evidence.trials[0].attempts[1])); }],
    ["best attempt selection", (input) => { input.evidence.trials[0].finalAttempt = 1; }],
    ["unattempted contradiction", (input) => { input.evidence.trials[0].finalAttempt = null; }],
    ["unattempted elapsed time", (input) => { const trial = input.evidence.trials[0]; trial.attempts = []; trial.finalAttempt = null; }],
    ["retry after model response", (input) => { input.evidence.trials[0].attempts[0] = { ...input.evidence.trials[0].attempts[1], sequence: 1 }; }],
    ["forged label", (input) => { const value = input.evidence.trials[1].attempts[0].outcome; if (value.kind === "answer") value.label = "concave"; }],
    ["forged invalid reason", (input) => { const value = input.evidence.trials[2].attempts[0].outcome; if (value.kind === "invalid") value.reason = "malformed-json"; }],
    ["outcome profile", (input) => { Object.assign(input.evidence.trials[0].attempts[1].outcome, { profileId: "one-shot-schema-v1" }); }],
    ["unknown outcome kind", (input) => { Object.assign(input.evidence.trials[0].attempts[1].outcome, { kind: "conflicting" }); }],
    ["negative usage", (input) => { input.evidence.trials[0].attempts[0].usage.input!.count = -1; }],
    ["unknown usage", (input) => { Object.assign(input.evidence.trials[0].attempts[0].usage, { total: 5 }); }],
    ["infinite elapsed", (input) => { input.evidence.trials[0].elapsedMs = Infinity; }],
    ["wrong error category", (input) => { input.evidence.trials[0].attempts[1].errorKind = "timeout"; }],
    ["missing error category", (input) => { input.evidence.trials[0].attempts[0].errorKind = null; }],
    ["cost currency", (input) => { input.evidence.trials[0].attempts[0].cost!.currency = "usd"; }],
    ["unknown cost kind", (input) => { Object.assign(input.evidence.trials[0].attempts[0].cost!, { kind: "free" }); }],
    ["negative cost", (input) => { Object.assign(input.evidence.trials[0].attempts[0].cost!, { amount: "-1" }); }],
    ["missing estimate usage", (input) => { input.evidence.trials[1].attempts[0].usage.input = null; }],
    ["token expression hash", (input) => { input.evidence.expressionTokens[0].expressionSha256 = "0".repeat(64); }],
    ["duplicate tokens", (input) => { input.evidence.expressionTokens.push(structuredClone(input.evidence.expressionTokens[0])); }],
    ["tokenizer version", (input) => { input.evidence.expressionTokens[0].tokenizer.version = ""; }],
    ["suite reference", (input) => { input.suite.cases[0].reference.domain.min = "-2"; }],
  ];
  for (const [name, alter] of alterations) {
    it(`rejects ${name}`, async () => {
      const input = fixture(); alter(input);
      await expect(scoreEvaluation(input)).rejects.toThrow();
    });
  }

  it("rejects empty/extra envelopes and illustrative suites", async () => {
    for (const input of [null, [], {}, { ...fixture(), extra: true }, { suite: original.suite, evidence: [] }]) {
      await expect(scoreEvaluation(input)).rejects.toBeInstanceOf(ScoringInputError);
    }
    const generated = await generateSuite({ ...original.suite.request, purpose: "illustration" });
    if (generated.status !== "complete") throw new Error("Fixture suite incomplete.");
    await expect(scoreEvaluation({ suite: generated.suite, evidence: evidence(generated.suite) })).rejects.toThrow("Illustrative");
  });

  it("rejects getters, sparse arrays, symbols and extra fields without invoking accessors", async () => {
    let calls = 0;
    const getter = () => { calls++; throw new Error("Getter must not run."); };
    for (const modify of [
      (input: Input) => Object.defineProperty(input, "evidence", { get: getter }),
      (input: Input) => Object.defineProperty(input.evidence.model, "modelId", { get: getter }),
      (input: Input) => Object.defineProperty(input.evidence.trials, "0", { get: getter }),
      (input: Input) => Object.defineProperty(input.evidence.trials[0].attempts[0].outcome, "rawText", { get: getter }),
      (input: Input) => { delete input.evidence.trials[0]; },
      (input: Input) => { Object.assign(input.evidence, { [Symbol("extra")]: true }); },
      (input: Input) => { Object.defineProperty(input.evidence.expressionTokens, "extra", { value: true }); },
    ]) {
      const input = fixture(); modify(input);
      await expect(scoreEvaluation(input)).rejects.toThrow();
    }
    expect(calls).toBe(0);
  });

  it("binds local token counts to exact expression bytes and preserves missing-data coverage", async () => {
    const input = fixture();
    const expression = input.suite.cases[0].certificate.renderedExpression;
    expect(input.evidence.expressionTokens[0].expressionSha256).toBe(createHash("sha256").update(expression).digest("hex"));
    const report = await scoreEvaluation(input);
    expect(report.overall.diagnostics.lengths.expressionTokens.groups.filter((group) => !group.compatible)[0].summary.count).toBe(0);
    expect(report.overall.diagnostics.usage.logicalTrials.fields.output).toMatchObject({ complete: 8, missing: 1 });
  });

  it("bounds retained evidence while preserving oversized-answer extraction failures", async () => {
    const input = fixture();
    const attempt = input.evidence.trials[1].attempts[0];
    attempt.outcome = extractAnswer({ status: "completed", text: "x".repeat(MAX_RETAINED_REPLY_CODE_UNITS) }, input.evidence.profileId);
    const report = await scoreEvaluation(input);
    expect(report.overall.classification.outcomes.invalid.numerator).toBe(1);
    attempt.outcome = extractAnswer({ status: "interrupted", text: "x".repeat(MAX_RETAINED_REPLY_CODE_UNITS + 1) }, input.evidence.profileId);
    await expect(scoreEvaluation(input)).rejects.toThrow("Retained raw reply exceeds");
    attempt.outcome = extractAnswer({ status: "provider-error", text: "", message: "x".repeat(MAX_PROVIDER_ERROR_CODE_UNITS + 1) }, input.evidence.profileId);
    attempt.errorKind = "transport";
    await expect(scoreEvaluation(input)).rejects.toThrow("Provider error message");
  });

  it("rejects aggregate retained text before report hashing", async () => {
    const generated = await generateSuite({ ...original.suite.request, casesPerClass: 15 });
    if (generated.status !== "complete") throw new Error("Controlled suite incomplete.");
    const input = { suite: generated.suite, evidence: evidence(generated.suite) };
    const raw = "x".repeat(MAX_RETAINED_REPLY_CODE_UNITS);
    expect(input.evidence.trials.length * raw.length).toBeGreaterThan(MAX_RETAINED_TEXT_CODE_UNITS);
    for (const trial of input.evidence.trials) {
      trial.attempts[0].outcome = extractAnswer({ status: "completed", text: raw }, input.evidence.profileId);
    }
    await expect(scoreEvaluation(input)).rejects.toThrow("evidence budget");
  });
});
