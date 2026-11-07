// Aggregate observed bills and dated usage estimates with exact decimal arithmetic.
import type { AttemptEvidence, CostEvidence, TrialEvidence } from "./types";

interface Decimal {
  readonly units: bigint;
  readonly scale: number;
}

interface Pricing {
  readonly source: string;
  readonly date: string;
  readonly inputPerMillion: string;
  readonly outputPerMillion: string;
  readonly inputSemantics: string;
  readonly outputSemantics: string;
}

interface CostTotal {
  readonly kind: CostEvidence["kind"];
  readonly currency: string;
  readonly pricing: Pricing | null;
  readonly amount: string;
}

interface CostGroup extends CostTotal {
  readonly reporting: number;
  readonly missingAttempts: number;
}

export interface CostReport {
  readonly attempts: number;
  readonly reporting: number;
  readonly missing: number;
  readonly groups: readonly CostGroup[];
  readonly total: CostTotal | null;
}

function decimal(value: string, precision: number, field: string): Decimal {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) {
    throw new Error(`${field} must be a plain nonnegative decimal string.`);
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > precision) throw new Error(`${field} permits at most ${precision} fractional digits.`);
  return { units: BigInt(whole + fraction), scale: fraction.length };
}

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale);
  return {
    units: left.units * 10n ** BigInt(scale - left.scale) + right.units * 10n ** BigInt(scale - right.scale),
    scale,
  };
}

function format(value: Decimal): string {
  if (value.scale === 0) return value.units.toString();
  const digits = value.units.toString().padStart(value.scale + 1, "0");
  const text = `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return text.replace(/\.?0+$/, "");
}

function metadata(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} must be nonblank.`);
}

function validDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function attemptCost(attempt: AttemptEvidence): { total: CostTotal; value: Decimal } | null {
  const cost = attempt.cost;
  if (cost === null) return null;
  metadata(cost.currency, "Cost currency");
  if (cost.kind === "billed") {
    const value = decimal(cost.amount, 18, "Billed amount");
    return { total: { kind: "billed", currency: cost.currency, pricing: null, amount: format(value) }, value };
  }
  metadata(cost.source, "Pricing source");
  if (!validDate(cost.date)) throw new Error("Pricing date must be a valid YYYY-MM-DD date.");
  const inputRate = decimal(cost.inputPerMillion, 12, "Input rate");
  const outputRate = decimal(cost.outputPerMillion, 12, "Output rate");
  const { input, output } = attempt.usage;
  if (input === null || output === null) throw new Error("Estimated cost requires observed input and output usage.");
  if (input.semantics !== cost.inputSemantics || output.semantics !== cost.outputSemantics) {
    throw new Error("Estimated cost pricing semantics must match observed input and output usage.");
  }
  const value = add(
    { units: BigInt(input.count) * inputRate.units, scale: inputRate.scale + 6 },
    { units: BigInt(output.count) * outputRate.units, scale: outputRate.scale + 6 },
  );
  const pricing: Pricing = {
    source: cost.source,
    date: cost.date,
    inputPerMillion: format(inputRate),
    outputPerMillion: format(outputRate),
    inputSemantics: cost.inputSemantics,
    outputSemantics: cost.outputSemantics,
  };
  return { total: { kind: "estimated", currency: cost.currency, pricing, amount: format(value) }, value };
}

export function validateCostEvidence(attempt: AttemptEvidence): void {
  attemptCost(attempt);
}

export function computeCost(trials: readonly TrialEvidence[]): CostReport {
  const attempts = trials.flatMap((trial) => trial.attempts);
  const groups = new Map<string, { total: CostTotal; value: Decimal; reporting: number }>();
  let reporting = 0;
  for (const attempt of attempts) {
    const cost = attemptCost(attempt);
    if (cost === null) continue;
    reporting++;
    const key = JSON.stringify([cost.total.kind, cost.total.currency, cost.total.pricing]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { ...cost, reporting: 1 });
    else {
      group.value = add(group.value, cost.value);
      group.reporting++;
    }
  }
  const summaries = [...groups].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, group]): CostGroup => ({
      ...group.total,
      amount: format(group.value),
      reporting: group.reporting,
      missingAttempts: attempts.length - group.reporting,
    }));
  const complete = summaries.length === 1 && summaries[0].reporting === attempts.length ? summaries[0] : null;
  return {
    attempts: attempts.length,
    reporting,
    missing: attempts.length - reporting,
    groups: summaries,
    total: complete === null ? null : {
      kind: complete.kind, currency: complete.currency, pricing: complete.pricing, amount: complete.amount,
    },
  };
}
