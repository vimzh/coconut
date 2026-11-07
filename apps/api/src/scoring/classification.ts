// Pools logical outcomes while retaining unusable replies, coverage, and repeated-trial variation.
import type { Label } from "../math";
import type { AnswerOutcome } from "../protocol";
import type { Observation, Rate } from "./types";

const labels = ["convex", "concave", "neither"] as const;
const columns = ["convex", "concave", "neither", "unusable"] as const;
type PredictionColumn = typeof columns[number];
type OutcomeCategory = AnswerOutcome["kind"] | "empty" | "conflicting" | "unattempted";

interface ClassMetrics {
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly support: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly f1: number | null;
}

interface ClassificationMetrics {
  readonly population: {
    readonly plannedTrials: number;
    readonly includedTrials: number;
    readonly excludedTrials: number;
    readonly correctTrials: number;
    readonly status: "complete" | "provisional" | "unavailable";
  };
  readonly macroF1: number | null;
  readonly accuracy: Rate;
  readonly classes: Readonly<Record<Label, ClassMetrics>>;
  readonly absentReferenceClasses: readonly Label[];
  readonly confusion: {
    readonly columns: typeof columns;
    readonly rows: Readonly<Record<Label, {
      readonly counts: Readonly<Record<PredictionColumn, number>>;
      readonly rowRates: Readonly<Record<PredictionColumn, number>> | null;
    }>>;
  };
  readonly directionalErrors: { readonly convexToNeither: Rate; readonly concaveToNeither: Rate };
  readonly outcomes: Readonly<Record<OutcomeCategory, Rate>>;
}

interface Spread {
  readonly count: number;
  readonly mean: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly sampleStandardDeviation: number | null;
}

export interface ClassificationReport extends ClassificationMetrics {
  readonly trials: readonly {
    readonly trialIndex: number;
    readonly eligibleForSpread: boolean;
    readonly metrics: ClassificationMetrics;
  }[];
  readonly spread: {
    readonly plannedReplicates: number;
    readonly eligibleReplicates: number;
    readonly macroF1: Spread;
    readonly recall: Readonly<Record<Label, Spread>>;
  };
  readonly agreement: {
    readonly eligibleInstances: number;
    readonly totalInstances: number;
    readonly agreeingPairs: number;
    readonly totalPairs: number;
    readonly value: number | null;
  };
}

function labelRecord<T>(make: (label: Label) => T): Record<Label, T> {
  return { convex: make("convex"), concave: make("concave"), neither: make("neither") };
}

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator };
}

function isIncluded(outcome: AnswerOutcome | null): boolean {
  return outcome !== null && ["answer", "invalid", "refused", "truncated"].includes(outcome.kind);
}

function outcomeCategory(outcome: AnswerOutcome | null): OutcomeCategory {
  if (outcome === null) return "unattempted";
  if (outcome.kind !== "invalid") return outcome.kind;
  if (outcome.reason === "empty") return "empty";
  if (outcome.reason === "duplicate-field") return "conflicting";
  return "invalid";
}

function scorePopulation(observations: readonly Observation[]): ClassificationMetrics {
  const counts = labelRecord(() => ({ convex: 0, concave: 0, neither: 0, unusable: 0 }));
  const outcomeCounts: Record<OutcomeCategory, number> = {
    answer: 0, invalid: 0, empty: 0, conflicting: 0, refused: 0, truncated: 0,
    "provider-error": 0, interrupted: 0, cancelled: 0, unattempted: 0,
  };
  let includedTrials = 0;
  let correctTrials = 0;
  for (const observation of observations) {
    const outcome = observation.outcome;
    outcomeCounts[outcomeCategory(outcome)]++;
    if (!isIncluded(outcome)) continue;
    includedTrials++;
    const prediction = outcome?.kind === "answer" ? outcome.label : "unusable";
    counts[observation.referenceLabel][prediction]++;
    if (prediction === observation.referenceLabel) correctTrials++;
  }

  const classes = labelRecord((label): ClassMetrics => {
    const tp = counts[label][label];
    const support = columns.reduce((sum, column) => sum + counts[label][column], 0);
    const fp = labels.reduce((sum, reference) => sum + counts[reference][label], 0) - tp;
    const fn = support - tp;
    const f1Denominator = 2 * tp + fp + fn;
    return {
      tp, fp, fn, support,
      precision: rate(tp, tp + fp).value,
      recall: rate(tp, support).value,
      f1: includedTrials === 0 ? null : f1Denominator === 0 ? 0 : 2 * tp / f1Denominator,
    };
  });
  const returnedCategories: readonly OutcomeCategory[] = ["answer", "invalid", "empty", "conflicting", "refused", "truncated"];
  const outcomes = {} as Record<OutcomeCategory, Rate>;
  for (const category of Object.keys(outcomeCounts) as OutcomeCategory[]) {
    const denominator = returnedCategories.includes(category) ? includedTrials : observations.length;
    outcomes[category] = rate(outcomeCounts[category], denominator);
  }
  return {
    population: {
      plannedTrials: observations.length, includedTrials,
      excludedTrials: observations.length - includedTrials, correctTrials,
      status: includedTrials === 0 ? "unavailable" : includedTrials === observations.length ? "complete" : "provisional",
    },
    macroF1: includedTrials === 0 ? null : labels.reduce((sum, label) => sum + classes[label].f1!, 0) / 3,
    accuracy: rate(correctTrials, includedTrials),
    classes,
    absentReferenceClasses: labels.filter((label) => classes[label].support === 0),
    confusion: {
      columns,
      rows: labelRecord((label) => ({
        counts: counts[label],
        rowRates: classes[label].support === 0 ? null : {
          convex: counts[label].convex / classes[label].support,
          concave: counts[label].concave / classes[label].support,
          neither: counts[label].neither / classes[label].support,
          unusable: counts[label].unusable / classes[label].support,
        },
      })),
    },
    directionalErrors: {
      convexToNeither: rate(counts.convex.neither, classes.convex.support),
      concaveToNeither: rate(counts.concave.neither, classes.concave.support),
    },
    outcomes,
  };
}

function summarize(values: readonly number[]): Spread {
  const count = values.length;
  if (count === 0) return { count, mean: null, min: null, max: null, sampleStandardDeviation: null };
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  return {
    count, mean, min: Math.min(...values), max: Math.max(...values),
    sampleStandardDeviation: count < 2 ? null : Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1),
    ),
  };
}

export function scoreClassifications(observations: readonly Observation[], trialsPerInstance = 3): ClassificationReport {
  const instances = new Map<string, Observation[]>();
  for (const observation of observations) {
    const instance = instances.get(observation.caseId);
    if (instance) instance.push(observation);
    else instances.set(observation.caseId, [observation]);
  }
  const trials = Array.from({ length: trialsPerInstance }, (_, trialIndex) => {
    const trialObservations = observations.filter((observation) => observation.trialIndex === trialIndex);
    const metrics = scorePopulation(trialObservations);
    return {
      trialIndex, metrics,
      eligibleForSpread: metrics.population.status === "complete" && trialObservations.length === instances.size,
    };
  });
  const eligibleTrials = trials.filter((trial) => trial.eligibleForSpread);
  let eligibleInstances = 0;
  let agreeingPairs = 0;
  let totalPairs = 0;
  for (const instance of instances.values()) {
    if (instance.length !== trialsPerInstance || instance.some((row) => row.outcome?.kind !== "answer")) continue;
    eligibleInstances++;
    const predictions = labelRecord(() => 0);
    for (const row of instance) {
      if (row.outcome?.kind === "answer") predictions[row.outcome.label]++;
    }
    agreeingPairs += labels.reduce((sum, label) => sum + predictions[label] * (predictions[label] - 1) / 2, 0);
    totalPairs += trialsPerInstance * (trialsPerInstance - 1) / 2;
  }
  return {
    ...scorePopulation(observations), trials,
    spread: {
      plannedReplicates: trialsPerInstance,
      eligibleReplicates: eligibleTrials.length,
      macroF1: summarize(eligibleTrials.map((trial) => trial.metrics.macroF1!)),
      recall: labelRecord((label) => summarize(eligibleTrials.flatMap((trial) => {
        const recall = trial.metrics.classes[label].recall;
        return recall === null ? [] : [recall];
      }))),
    },
    agreement: {
      eligibleInstances, totalInstances: instances.size, agreeingPairs, totalPairs,
      value: rate(agreeingPairs, totalPairs).value,
    },
  };
}
