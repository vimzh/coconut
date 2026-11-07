// Summarize supplied execution timing, usage, costs, and case length coverage.
import { computeCost } from "./cost";
import { computeUsage } from "./usage";
import type { ExpressionLength, ExpressionTokenEvidence, TokenizerIdentity, TrialEvidence } from "./types";

interface LengthSummary {
  readonly count: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly mean: number | null;
}

interface TokenizerGroup {
  readonly tokenizer: TokenizerIdentity;
  readonly compatible: boolean;
  readonly suppliedCases: number;
  readonly reportingCases: number;
  readonly missingCases: number;
  readonly summary: LengthSummary;
  readonly perCase: readonly { readonly caseId: string; readonly count: number | null }[];
}

function summarize(values: readonly number[]): LengthSummary {
  if (values.length === 0) return { count: 0, min: null, max: null, mean: null };
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  const count = BigInt(values.length);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: Number(sum / count) + Number(sum % count) / values.length,
  };
}

function expressionTokens(
  lengths: readonly ExpressionLength[], tokenizations: readonly ExpressionTokenEvidence[], modelId: string,
) {
  const cases = new Map(lengths.map((length) => [length.caseId, length]));
  const groups = new Map<string, { tokenizer: TokenizerIdentity; values: Map<string, number> }>();
  const supplied = new Set<string>();
  const compatible = new Set<string>();
  for (const evidence of tokenizations) {
    const length = cases.get(evidence.caseId);
    if (length === undefined) throw new Error(`Expression token evidence names unknown case ${evidence.caseId}.`);
    if (length.expressionSha256 !== evidence.expressionSha256) {
      throw new Error(`Expression token evidence hash does not match case ${evidence.caseId}.`);
    }
    const { tokenizer } = evidence;
    const key = JSON.stringify([tokenizer.id, tokenizer.version, tokenizer.modelId]);
    let group = groups.get(key);
    if (group === undefined) {
      group = { tokenizer, values: new Map() };
      groups.set(key, group);
    }
    if (group.values.has(evidence.caseId)) throw new Error(`Duplicate expression token evidence for case ${evidence.caseId}.`);
    group.values.set(evidence.caseId, evidence.count);
    supplied.add(evidence.caseId);
    if (tokenizer.modelId === modelId) compatible.add(evidence.caseId);
  }
  const summaries = [...groups].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, group]): TokenizerGroup => {
      const matches = group.tokenizer.modelId === modelId;
      const reporting = matches ? group.values.size : 0;
      return {
        tokenizer: { ...group.tokenizer },
        compatible: matches,
        suppliedCases: group.values.size,
        reportingCases: reporting,
        missingCases: lengths.length - reporting,
        summary: summarize(matches ? [...group.values.values()] : []),
        perCase: [...group.values].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(([caseId, count]) => ({ caseId, count: matches ? count : null })),
      };
    });
  return {
    totalCases: lengths.length,
    compatibleCases: compatible.size,
    missingCases: lengths.length - supplied.size,
    incompatibleCases: supplied.size - compatible.size,
    groups: summaries,
  };
}

function latency(trials: readonly TrialEvidence[]) {
  const times: number[] = [];
  let eligible = 0;
  let infrastructureTrials = 0;
  let infrastructureAttempts = 0;
  let timeoutTrials = 0;
  let timeoutAttempts = 0;
  let unattemptedTrials = 0;
  for (const trial of trials) {
    for (const attempt of trial.attempts) {
      if (["provider-error", "interrupted", "cancelled"].includes(attempt.outcome.kind)) infrastructureAttempts++;
      if (attempt.errorKind === "timeout") timeoutAttempts++;
    }
    if (trial.attempts.some((attempt) => attempt.errorKind === "timeout")) timeoutTrials++;
    if (trial.finalAttempt === null) {
      unattemptedTrials++;
      continue;
    }
    const final = trial.attempts[trial.finalAttempt - 1];
    if (["provider-error", "interrupted", "cancelled"].includes(final.outcome.kind)) {
      infrastructureTrials++;
      continue;
    }
    eligible++;
    if (trial.elapsedMs !== null) times.push(trial.elapsedMs);
  }
  times.sort((left, right) => left - right);
  const quantile = (p: number): number | null => times.length === 0 ? null : times[Math.ceil(p * times.length) - 1];
  return {
    eligible,
    reporting: times.length,
    missing: eligible - times.length,
    p50Ms: quantile(0.5),
    p95Ms: quantile(0.95),
    infrastructureTrials,
    infrastructureAttempts,
    timeoutTrials,
    timeoutAttempts,
    unattemptedTrials,
  };
}

export function computeDiagnostics(
  trials: readonly TrialEvidence[],
  lengths: readonly ExpressionLength[],
  tokenizations: readonly ExpressionTokenEvidence[],
  modelId: string,
) {
  const orderedLengths = [...lengths].sort((left, right) => left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0);
  return {
    usage: computeUsage(trials),
    cost: computeCost(trials),
    latency: latency(trials),
    lengths: {
      cases: lengths.length,
      expressionCharacters: summarize(lengths.map((length) => length.expressionCharacters)),
      nodeCount: summarize(lengths.map((length) => length.nodeCount)),
      promptCharacters: summarize(lengths.map((length) => length.promptCharacters)),
      perCase: orderedLengths.map((length) => ({ ...length })),
      expressionTokens: expressionTokens(orderedLengths, tokenizations, modelId),
    },
    intermediateSteps: {
      status: "not-applicable" as const,
      reason: "Current one-shot profiles expose no ordered intermediate steps or step-checking contract.",
    },
  };
}

export type DiagnosticsReport = ReturnType<typeof computeDiagnostics>;
