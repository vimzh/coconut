import { describe, expect, it } from "bun:test";
import type { AnswerOutcome } from "../protocol";
import { computeCost, validateCostEvidence } from "./cost";
import { computeDiagnostics } from "./diagnostics";
import type { AttemptEvidence, CostEvidence, ExpressionLength, ExpressionTokenEvidence, TrialEvidence } from "./types";

const identity = { protocolVersion: "1", profileId: "one-shot-json-v1", rawText: "" } as const;
const answer: AnswerOutcome = { ...identity, kind: "answer", label: "convex", explanation: "Fixture." };
const failed: AnswerOutcome = { ...identity, kind: "provider-error", message: "Fixture transport failure." };
const emptyUsage = { input: null, output: null, reasoning: null };
const token = (count: number, semantics = "tokens-v1") => ({ count, semantics });

function attempt(overrides: Partial<AttemptEvidence> = {}): AttemptEvidence {
  return { sequence: 1, outcome: answer, errorKind: null, elapsedMs: null, usage: emptyUsage, cost: null, ...overrides };
}

function trial(attempts: readonly AttemptEvidence[], elapsedMs: number | null = null, caseId = "case-a"): TrialEvidence {
  return { caseId, trialIndex: 0, finalAttempt: attempts.length || null, elapsedMs, attempts };
}

function diagnostics(trials: readonly TrialEvidence[]) {
  return computeDiagnostics(trials, [], [], "fixture-model");
}

const pricing: CostEvidence = {
  kind: "estimated", currency: "USD", source: "Fixture rates", date: "2026-11-07",
  inputPerMillion: "1", outputPerMillion: "2", inputSemantics: "tokens-v1", outputSemantics: "tokens-v1",
};

describe("usage and cost diagnostics", () => {
  it("retains retry usage, field coverage, and complete logical-trial totals without inventing reasoning", () => {
    const report = diagnostics([
      trial([
        attempt({ outcome: failed, usage: { input: token(2), output: token(1), reasoning: null } }),
        attempt({ sequence: 2, usage: { input: token(3), output: token(4), reasoning: token(2) } }),
      ]),
      trial([attempt({ usage: { input: token(7, "other-input"), output: null, reasoning: token(0) } })]),
      trial([]),
    ]).usage;
    expect(report.attempts.total).toBe(3);
    expect(report.attempts.fields.input).toEqual({
      reporting: 3, missing: 0,
      groups: [
        { semantics: "other-input", reporting: 1, total: 7, mean: 7 },
        { semantics: "tokens-v1", reporting: 2, total: 5, mean: 2.5 },
      ],
    });
    expect(report.attempts.fields.output).toEqual({
      reporting: 2, missing: 1, groups: [{ semantics: "tokens-v1", reporting: 2, total: 5, mean: 2.5 }],
    });
    expect(report.attempts.fields.reasoning).toEqual({
      reporting: 2, missing: 1, groups: [{ semantics: "tokens-v1", reporting: 2, total: 2, mean: 1 }],
    });
    expect(report.logicalTrials.total).toBe(3);
    expect(report.logicalTrials.fields.input.complete).toBe(2);
    expect(report.logicalTrials.fields.input.missing).toBe(1);
    expect(report.logicalTrials.fields.output).toEqual({
      complete: 1, missing: 2, groups: [{ semantics: "tokens-v1", reporting: 1, total: 5, mean: 5 }],
    });
    expect(report.logicalTrials.fields.reasoning).toEqual({
      complete: 1, missing: 2, groups: [{ semantics: "tokens-v1", reporting: 1, total: 0, mean: 0 }],
    });
  });

  it("makes mixed-semantics logical usage unavailable while retaining each attempt group", () => {
    const report = diagnostics([trial([
      attempt({ outcome: failed, usage: { ...emptyUsage, input: token(2) } }),
      attempt({ sequence: 2, usage: { ...emptyUsage, input: token(3, "other") } }),
    ])]).usage;
    expect(report.attempts.fields.input.groups).toHaveLength(2);
    expect(report.logicalTrials.fields.input).toEqual({ complete: 0, missing: 1, groups: [] });
    expect(() => diagnostics([trial([
      attempt({ usage: { ...emptyUsage, input: token(Number.MAX_SAFE_INTEGER) } }),
      attempt({ sequence: 2, usage: { ...emptyUsage, input: token(1) } }),
    ])])).toThrow("safe integer");
  });

  it("calculates tiny estimates and large bills exactly, including retries", () => {
    const estimate = { ...pricing, inputPerMillion: "0.000000000001", outputPerMillion: "0" } as const;
    const estimated = computeCost([trial([
      attempt({ outcome: failed, usage: { input: token(1), output: token(0), reasoning: null }, cost: estimate }),
      attempt({ sequence: 2, usage: { input: token(1), output: token(0), reasoning: null }, cost: estimate }),
    ])]);
    expect(estimated.total?.amount).toBe("0.000000000000000002");
    expect(estimated.total?.kind).toBe("estimated");
    expect(estimated.groups[0].reporting).toBe(2);
    const billed = computeCost([trial([
      attempt({ cost: { kind: "billed", currency: "USD", amount: "9007199254740993.000000000000000001" } }),
      attempt({ sequence: 2, cost: { kind: "billed", currency: "USD", amount: "0.000000000000000009" } }),
    ])]);
    expect(billed.total).toEqual({
      kind: "billed", currency: "USD", pricing: null, amount: "9007199254740993.00000000000000001",
    });
    expect(computeCost([trial([attempt({ cost: { kind: "billed", currency: "USD", amount: "0.000" } })])]).total?.amount).toBe("0");
  });

  it("does not present partial costs or incompatible currencies, kinds, or dated pricing as a full total", () => {
    const paid = attempt({ cost: { kind: "billed", currency: "USD", amount: "0.1" } });
    const partial = computeCost([trial([paid]), trial([attempt()])]);
    expect(partial).toEqual({
      attempts: 2, reporting: 1, missing: 1, total: null,
      groups: [{ kind: "billed", currency: "USD", pricing: null, amount: "0.1", reporting: 1, missingAttempts: 1 }],
    });
    const usage = { input: token(10), output: token(5), reasoning: null };
    for (const other of [
      attempt({ cost: { kind: "billed", currency: "EUR", amount: "0.2" } }),
      attempt({ usage, cost: pricing }),
    ]) {
      const mixed = computeCost([trial([paid]), trial([other])]);
      expect(mixed.reporting).toBe(2);
      expect(mixed.missing).toBe(0);
      expect(mixed.groups).toHaveLength(2);
      expect(mixed.total).toBeNull();
    }
    const mixedPricing = computeCost([
      trial([attempt({ usage, cost: pricing })]),
      trial([attempt({ usage, cost: { ...pricing, date: "2026-11-06" } })]),
    ]);
    expect(mixedPricing.groups).toHaveLength(2);
    expect(mixedPricing.total).toBeNull();
    const samePricing = computeCost([
      trial([attempt({ usage, cost: pricing })]),
      trial([attempt({ usage, cost: { ...pricing, inputPerMillion: "1.000", outputPerMillion: "2.0" } })]),
    ]);
    expect(samePricing.groups).toHaveLength(1);
    expect(samePricing.total?.amount).toBe("0.00004");
  });

  it("rejects invalid decimal precision, missing usage, semantic mismatches, and invalid pricing dates", () => {
    for (const amount of ["-1", "-0", "1e-3", ".1", "01", "1.", "0.0000000000000000001"]) {
      expect(() => validateCostEvidence(attempt({ cost: { kind: "billed", currency: "USD", amount } }))).toThrow();
    }
    const usage = { input: token(1), output: token(1), reasoning: null };
    expect(() => validateCostEvidence(attempt({ cost: pricing }))).toThrow("observed input and output");
    expect(() => validateCostEvidence(attempt({ usage, cost: { ...pricing, inputSemantics: "wrong" } }))).toThrow("semantics");
    expect(() => validateCostEvidence(attempt({ usage, cost: { ...pricing, inputPerMillion: "0.0000000000001" } }))).toThrow("12 fractional");
    expect(() => validateCostEvidence(attempt({ usage, cost: { ...pricing, date: "2026-02-30" } }))).toThrow("YYYY-MM-DD");
    expect(() => validateCostEvidence(attempt({ usage, cost: { ...pricing, source: " " } }))).toThrow("source");
  });

  it("does not turn all-unattempted work into zero observed usage or cost", () => {
    const report = diagnostics([trial([]), trial([])]);
    expect(report.usage.attempts).toEqual({ total: 0, fields: {
      input: { reporting: 0, missing: 0, groups: [] },
      output: { reporting: 0, missing: 0, groups: [] },
      reasoning: { reporting: 0, missing: 0, groups: [] },
    } });
    expect(report.usage.logicalTrials.fields.input).toEqual({ complete: 0, missing: 2, groups: [] });
    expect(report.cost).toEqual({ attempts: 0, reporting: 0, missing: 0, groups: [], total: null });
    expect(report.latency.p50Ms).toBeNull();
    expect(report.latency.p95Ms).toBeNull();
    expect(report.latency.unattemptedTrials).toBe(2);
    expect(report.intermediateSteps.status).toBe("not-applicable");
  });
});

describe("timing and length diagnostics", () => {
  it("uses nearest-rank latency over returned logical outcomes, including unusable replies", () => {
    const outcomes: AnswerOutcome[] = [
      { ...identity, kind: "invalid", reason: "empty" },
      { ...identity, kind: "refused" },
      { ...identity, kind: "truncated" },
    ];
    const timed = Array.from({ length: 20 }, (_, index) => trial([
      attempt({ outcome: outcomes[index] ?? answer, elapsedMs: 999 }),
    ], index + 1));
    const report = diagnostics([
      ...timed,
      trial([attempt()]),
      trial([attempt({ outcome: failed, errorKind: "timeout" })], 9999),
      trial([attempt({ outcome: { ...identity, kind: "cancelled" } })], 8888),
      trial([]),
    ]).latency;
    expect(report).toEqual({
      eligible: 21, reporting: 20, missing: 1, p50Ms: 10, p95Ms: 19,
      infrastructureTrials: 2, infrastructureAttempts: 2, timeoutTrials: 1, timeoutAttempts: 1, unattemptedTrials: 1,
    });
    expect(diagnostics([trial([attempt() ], 0)]).latency.p50Ms).toBe(0);
    const retry = diagnostics([trial([
      attempt({ outcome: failed, errorKind: "timeout", elapsedMs: 100 }),
      attempt({ sequence: 2, elapsedMs: 200 }),
    ], 350)]).latency;
    expect(retry.p50Ms).toBe(350);
    expect(retry.infrastructureTrials).toBe(0);
    expect(retry.infrastructureAttempts).toBe(1);
    expect(retry.timeoutAttempts).toBe(1);
  });

  const lengths: ExpressionLength[] = ["a", "b", "c", "d"].map((id, index) => ({
    caseId: `case-${id}`, depth: 5, expressionSha256: id.repeat(64),
    expressionCharacters: 3 + 2 * index, nodeCount: 2 + index, promptCharacters: 100 + 10 * index,
  }));
  function measured(caseIndex: number, count: number, version = "1", modelId = "fixture-model"): ExpressionTokenEvidence {
    return {
      caseId: lengths[caseIndex].caseId, expressionSha256: lengths[caseIndex].expressionSha256,
      tokenizer: { id: "fixture-tokenizer", version, modelId }, count,
    };
  }

  it("separates raw, prompt, node, and tokenizer measurements with explicit model coverage", () => {
    const report = computeDiagnostics([], [...lengths].reverse(), [
      measured(0, 0), measured(1, 11, "1", "different-model"), measured(3, 9, "2"),
    ], "fixture-model").lengths;
    expect(report.expressionCharacters).toEqual({ count: 4, min: 3, max: 9, mean: 6 });
    expect(report.nodeCount).toEqual({ count: 4, min: 2, max: 5, mean: 3.5 });
    expect(report.promptCharacters).toEqual({ count: 4, min: 100, max: 130, mean: 115 });
    expect(report.perCase.map((entry) => entry.caseId)).toEqual(["case-a", "case-b", "case-c", "case-d"]);
    const tokens = report.expressionTokens;
    expect([tokens.totalCases, tokens.compatibleCases, tokens.missingCases, tokens.incompatibleCases]).toEqual([4, 2, 1, 1]);
    expect(tokens.groups).toHaveLength(3);
    const mismatched = tokens.groups.find((group) => !group.compatible)!;
    expect(mismatched.suppliedCases).toBe(1);
    expect(mismatched.reportingCases).toBe(0);
    expect(mismatched.missingCases).toBe(4);
    expect(mismatched.summary).toEqual({ count: 0, min: null, max: null, mean: null });
    expect(mismatched.perCase).toEqual([{ caseId: "case-b", count: null }]);
    const firstVersion = tokens.groups.find((group) => group.compatible && group.tokenizer.version === "1")!;
    expect(firstVersion.summary).toEqual({ count: 1, min: 0, max: 0, mean: 0 });
    expect(firstVersion.perCase).toEqual([{ caseId: "case-a", count: 0 }]);
    expect(computeDiagnostics([], lengths, [], "fixture-model").lengths.expressionTokens.missingCases).toBe(4);
  });

  it("rejects stale expression hashes, unknown cases, and duplicate tokenizer measurements", () => {
    const measurement = measured(0, 3);
    expect(() => computeDiagnostics([], lengths, [{ ...measurement, expressionSha256: "wrong" }], "fixture-model")).toThrow("hash");
    expect(() => computeDiagnostics([], lengths, [{ ...measurement, caseId: "unknown" }], "fixture-model")).toThrow("unknown case");
    expect(() => computeDiagnostics([], lengths, [measurement, measurement], "fixture-model")).toThrow("Duplicate");
  });

  it("keeps missing length and tokenizer summaries unavailable", () => {
    const report = computeDiagnostics([], [], [], "fixture-model").lengths;
    expect(report.expressionCharacters).toEqual({ count: 0, min: null, max: null, mean: null });
    expect(report.expressionTokens).toEqual({ totalCases: 0, compatibleCases: 0, missingCases: 0, incompatibleCases: 0, groups: [] });
  });

  it("keeps grouping and large-count means independent of evidence order", () => {
    const measurements = [measured(0, Number.MAX_SAFE_INTEGER), measured(1, 1), measured(2, 1)];
    const first = computeDiagnostics([], lengths, measurements, "fixture-model");
    const reversed = computeDiagnostics([], [...lengths].reverse(), [...measurements].reverse(), "fixture-model");
    expect(first).toEqual(reversed);
    expect(first.lengths.expressionTokens.groups[0].summary.mean).toBe(3002399751580331);
  });

  it("stores only supplied measurements across many sparse tokenizer groups", () => {
    const manyLengths = Array.from({ length: 1000 }, (_, index): ExpressionLength => ({
      ...lengths[0], caseId: `case-${index.toString().padStart(4, "0")}`,
    }));
    const measurements = manyLengths.map((length, index): ExpressionTokenEvidence => ({
      caseId: length.caseId, expressionSha256: length.expressionSha256, count: index,
      tokenizer: {
        id: `tokenizer-${index.toString().padStart(4, "0")}`, version: "1",
        modelId: index % 2 === 0 ? "fixture-model" : "different-model",
      },
    }));
    const first = computeDiagnostics([], manyLengths, measurements, "fixture-model").lengths;
    const reversed = computeDiagnostics([], [...manyLengths].reverse(), [...measurements].reverse(), "fixture-model").lengths;
    expect(first).toEqual(reversed);
    expect(first.perCase).toHaveLength(1000);
    const tokens = first.expressionTokens;
    expect(tokens.groups).toHaveLength(1000);
    expect(tokens.groups.reduce((total, group) => total + group.perCase.length, 0)).toBe(1000);
    expect([tokens.totalCases, tokens.compatibleCases, tokens.missingCases, tokens.incompatibleCases]).toEqual([1000, 500, 0, 500]);
    expect(tokens.groups.every((group) => group.suppliedCases === 1)).toBe(true);
    expect(tokens.groups.every((group) => group.reportingCases === (group.compatible ? 1 : 0))).toBe(true);
    expect(tokens.groups.every((group) => group.missingCases === (group.compatible ? 999 : 1000))).toBe(true);
    expect(tokens.groups[1].perCase).toEqual([{ caseId: "case-0001", count: null }]);
  });
});
