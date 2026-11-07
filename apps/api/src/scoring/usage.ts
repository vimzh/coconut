// Keep provider token semantics separate across attempts and complete logical trials.
import type { TokenField, TrialEvidence } from "./types";

const fields = ["input", "output", "reasoning"] as const;
type UsageField = typeof fields[number];

interface UsageGroup {
  readonly semantics: string;
  readonly reporting: number;
  readonly total: number;
  readonly mean: number;
}

interface FieldUsage {
  readonly reporting: number;
  readonly missing: number;
  readonly groups: readonly UsageGroup[];
}

interface LogicalFieldUsage {
  readonly complete: number;
  readonly missing: number;
  readonly groups: readonly UsageGroup[];
}

export interface UsageReport {
  readonly attempts: {
    readonly total: number;
    readonly fields: Readonly<Record<UsageField, FieldUsage>>;
  };
  readonly logicalTrials: {
    readonly total: number;
    readonly fields: Readonly<Record<UsageField, LogicalFieldUsage>>;
  };
}

function sumCounts(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new Error("Combined token usage exceeds the safe integer range.");
  return total;
}

function summarize(values: readonly (TokenField | null)[]): FieldUsage {
  const groups = new Map<string, { total: number; reporting: number }>();
  let reporting = 0;
  for (const value of values) {
    if (value === null) continue;
    reporting++;
    const group = groups.get(value.semantics) ?? { total: 0, reporting: 0 };
    group.total = sumCounts(group.total, value.count);
    group.reporting++;
    groups.set(value.semantics, group);
  }
  return {
    reporting,
    missing: values.length - reporting,
    groups: [...groups].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([semantics, group]) => ({ semantics, ...group, mean: group.total / group.reporting })),
  };
}

function logicalUsage(trial: TrialEvidence, field: UsageField): TokenField | null {
  if (trial.attempts.length === 0) return null;
  let total = 0;
  let semantics: string | null = null;
  for (const attempt of trial.attempts) {
    const value = attempt.usage[field];
    if (value === null || (semantics !== null && value.semantics !== semantics)) return null;
    semantics = value.semantics;
    total = sumCounts(total, value.count);
  }
  return { semantics: semantics!, count: total };
}

export function computeUsage(trials: readonly TrialEvidence[]): UsageReport {
  const attempts = trials.flatMap((trial) => trial.attempts);
  const attemptFields = {} as Record<UsageField, FieldUsage>;
  const logicalFields = {} as Record<UsageField, LogicalFieldUsage>;
  for (const field of fields) {
    attemptFields[field] = summarize(attempts.map((attempt) => attempt.usage[field]));
    const summary = summarize(trials.map((trial) => logicalUsage(trial, field)));
    logicalFields[field] = { complete: summary.reporting, missing: summary.missing, groups: summary.groups };
  }
  return {
    attempts: { total: attempts.length, fields: attemptFields },
    logicalTrials: { total: trials.length, fields: logicalFields },
  };
}
