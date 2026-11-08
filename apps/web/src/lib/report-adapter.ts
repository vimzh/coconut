// Project retained run views into safe chart/table inputs; the backend remains the sole scorer.
import { REPORT_COLUMNS, REPORT_LABELS, REPORT_OUTCOMES } from "./report-types";
import type {
  ReportCase,
  ReportColumn,
  ReportLabel,
  ReportOutcome,
  ReportRate,
  ReportRun,
  ReportSlice,
  ReportSpread,
  ReportTrial,
  UsageField,
} from "./report-types";

type Data = Record<string, unknown>;
export class ReportInputError extends Error {
  constructor() {
    super(
      "The saved run contains invalid or inconsistent reporting evidence. Reload the original run; no score was accepted.",
    );
    this.name = "ReportInputError";
  }
}
function invalid(): never {
  throw new ReportInputError();
}
function record(value: unknown): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((entry) => !("value" in entry)))
    invalid();
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, entry]) => [key, entry.value]),
  );
}
function text(value: unknown, max = 4096): string {
  return typeof value === "string" && value.length <= max ? value : invalid();
}
function nullableText(value: unknown, max = 4096): string | null {
  return value === null ? null : text(value, max);
}
function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : invalid();
}
function count(value: unknown): number {
  const n = number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : invalid();
}
function nullableNumber(value: unknown): number | null {
  return value === null ? null : number(value);
}
function unit(value: unknown): number | null {
  const n = nullableNumber(value);
  return n === null || (n >= 0 && n <= 1) ? n : invalid();
}
function array(value: unknown, max = 10000): unknown[] {
  return Array.isArray(value) && value.length <= max ? value : invalid();
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : invalid();
}
function mapped<T extends string, V>(
  keys: readonly T[],
  value: unknown,
  parse: (value: unknown) => V,
): Record<T, V> {
  const input = record(value);
  return Object.fromEntries(
    keys.map((key) => [key, parse(input[key])]),
  ) as Record<T, V>;
}
function rate(value: unknown): ReportRate {
  const x = record(value),
    numerator = count(x.numerator),
    denominator = count(x.denominator),
    v = unit(x.value);
  if (numerator > denominator || (denominator === 0) !== (v === null))
    invalid();
  return { numerator, denominator, value: v };
}
function spread(value: unknown): ReportSpread {
  const x = record(value);
  return {
    count: count(x.count),
    mean: unit(x.mean),
    min: unit(x.min),
    max: unit(x.max),
    sampleStandardDeviation: unit(x.sampleStandardDeviation),
  };
}
function costTotal(value: unknown) {
  const x = record(value),
    amount = text(x.amount, 128);
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) invalid();
  return {
    kind: choice(x.kind, ["billed", "estimated"]),
    currency: text(x.currency, 32),
    amount,
  };
}
function slice(value: unknown): ReportSlice {
  const x = record(value),
    c = record(x.classification),
    d = record(x.diagnostics),
    p = record(c.population);
  const population = {
    plannedTrials: count(p.plannedTrials),
    includedTrials: count(p.includedTrials),
    excludedTrials: count(p.excludedTrials),
    correctTrials: count(p.correctTrials),
    status: choice(p.status, ["complete", "provisional", "unavailable"]),
  };
  if (
    population.includedTrials + population.excludedTrials !==
      population.plannedTrials ||
    population.correctTrials > population.includedTrials
  )
    invalid();
  const macroF1 = unit(c.macroF1);
  if (
    (population.status === "unavailable") !== (macroF1 === null) ||
    (population.includedTrials === 0) !== (macroF1 === null)
  )
    invalid();
  if (
    (population.status === "complete") !==
    (population.includedTrials === population.plannedTrials &&
      population.includedTrials > 0)
  )
    invalid();
  const classes = mapped(REPORT_LABELS, c.classes, (value) => {
    const a = record(value);
    return {
      precision: unit(a.precision),
      recall: unit(a.recall),
      f1: unit(a.f1),
      support: count(a.support),
    };
  });
  const matrix = record(c.confusion);
  if (JSON.stringify(array(matrix.columns)) !== JSON.stringify(REPORT_COLUMNS))
    invalid();
  const confusion = mapped(REPORT_LABELS, matrix.rows, (value) => {
    const a = record(value);
    return {
      counts: mapped(REPORT_COLUMNS, a.counts, count),
      rowRates:
        a.rowRates === null
          ? null
          : mapped(REPORT_COLUMNS, a.rowRates, (v) => unit(v) ?? invalid()),
    };
  });
  for (const label of REPORT_LABELS) {
    if (
      REPORT_COLUMNS.reduce(
        (sum, key) => sum + confusion[label].counts[key],
        0,
      ) !== classes[label].support
    )
      invalid();
    if ((classes[label].support === 0) !== (confusion[label].rowRates === null))
      invalid();
  }
  if (
    REPORT_LABELS.reduce((sum, label) => sum + classes[label].support, 0) !==
    population.includedTrials
  )
    invalid();
  const a = record(c.agreement),
    u = record(record(d.usage).logicalTrials),
    latency = record(d.latency),
    costs = record(d.cost);
  const usage = {
    total: count(u.total),
    fields: mapped(
      ["input", "output", "reasoning"] as const,
      u.fields,
      (value) => {
        const f = record(value);
        return {
          complete: count(f.complete),
          missing: count(f.missing),
          groups: array(f.groups).map((entry) => {
            const g = record(entry);
            return {
              semantics: text(g.semantics, 256),
              reporting: count(g.reporting),
              total: count(g.total),
              mean: number(g.mean),
            };
          }),
        };
      },
    ),
  };
  for (const field of Object.values(usage.fields))
    if (
      field.complete + field.missing !== usage.total ||
      field.groups.some((g) => g.mean < 0)
    )
      invalid();
  const outcomes = mapped(REPORT_OUTCOMES, c.outcomes, rate);
  if (
    REPORT_OUTCOMES.reduce((sum, key) => sum + outcomes[key].numerator, 0) !==
    population.plannedTrials
  )
    invalid();
  if (
    count(a.eligibleInstances) > count(a.totalInstances) ||
    count(a.agreeingPairs) > count(a.totalPairs)
  )
    invalid();
  if (
    count(latency.reporting) + count(latency.missing) !==
      count(latency.eligible) ||
    (latency.p50Ms !== null && number(latency.p50Ms) < 0) ||
    (latency.p95Ms !== null && number(latency.p95Ms) < 0)
  )
    invalid();
  if (count(costs.reporting) + count(costs.missing) !== count(costs.attempts))
    invalid();
  return {
    population,
    macroF1,
    accuracy: rate(c.accuracy),
    classes,
    confusion,
    outcomes,
    spread: spread(record(c.spread).macroF1),
    recallSpread: mapped(REPORT_LABELS, record(c.spread).recall, spread),
    agreement: {
      eligibleInstances: count(a.eligibleInstances),
      totalInstances: count(a.totalInstances),
      agreeingPairs: count(a.agreeingPairs),
      totalPairs: count(a.totalPairs),
      value: unit(a.value),
    },
    usage,
    latency: {
      eligible: count(latency.eligible),
      reporting: count(latency.reporting),
      missing: count(latency.missing),
      p50Ms: nullableNumber(latency.p50Ms),
      p95Ms: nullableNumber(latency.p95Ms),
    },
    cost: {
      attempts: count(costs.attempts),
      reporting: count(costs.reporting),
      missing: count(costs.missing),
      total: costs.total === null ? null : costTotal(costs.total),
      groups: array(costs.groups).map((entry) => {
        const g = record(entry),
          pricing = g.pricing === null ? null : record(g.pricing);
        return {
          ...costTotal(g),
          reporting: count(g.reporting),
          missingAttempts: count(g.missingAttempts),
          source: pricing === null ? null : text(pricing.source),
          date: pricing === null ? null : text(pricing.date),
        };
      }),
    },
  };
}
function caseView(value: unknown): ReportCase {
  const x = record(value),
    reference = record(x.reference),
    domain = record(reference.domain),
    c = record(x.certificate),
    witnesses = record(c.witnesses);
  const proofWitnesses = Object.entries(witnesses)
    .filter(([kind]) =>
      ["positive", "negative", "againstConvexity", "againstConcavity"].includes(
        kind,
      ),
    )
    .map(([kind, value]) => {
      const w = record(value),
        values: Record<string, string> = {};
      for (const key of ["x", "y", "midpoint", "fX", "fY", "fMidpoint", "gap"])
        if (w[key] !== undefined) values[key] = text(w[key]);
      if (w.second !== undefined) {
        const second = record(w.second);
        values.secondMin = text(second.min);
        values.secondMax = text(second.max);
      }
      return { kind, values };
    });
  const depth = count(x.depth);
  if (count(c.depth) !== depth) invalid();
  const independent =
    x.analyticCertificate === undefined ? null : record(x.analyticCertificate);
  const globalSecond =
    independent?.globalSecond === null || independent === null
      ? null
      : record(independent.globalSecond);
  return {
    id: text(x.id),
    depth,
    family: text(x.family),
    label: choice(x.label, REPORT_LABELS),
    expression: text(c.renderedExpression, 1_048_576),
    domain: { min: text(domain.min), max: text(domain.max) },
    proof: {
      version: text(c.version),
      nodeCount: count(c.nodeCount),
      kind: c.cover === undefined ? "structural" : "interval",
      precision: c.precision === undefined ? null : count(c.precision),
      steps:
        c.cover === undefined ? array(c.trace).length : array(c.cover).length,
      witnesses: proofWitnesses,
      independent:
        independent === null
          ? null
          : {
              policy: text(independent.policy),
              globalSecond:
                globalSecond === null
                  ? null
                  : {
                      min: text(globalSecond.min),
                      max: text(globalSecond.max),
                    },
              witnesses: array(independent.witnesses).map((entry) => {
                const w = record(entry);
                return { x: text(w.x), min: text(w.min), max: text(w.max) };
              }),
            },
    },
  };
}
function trialView(value: unknown, execution: Data | undefined): ReportTrial {
  const t = record(value),
    attempts = array(t.attempts, 2),
    final = t.finalAttempt === null ? null : count(t.finalAttempt);
  if (
    (attempts.length === 0) !== (final === null) ||
    (final !== null && final !== attempts.length)
  )
    invalid();
  const last = final === null ? null : record(attempts[final - 1]),
    outcome = last === null ? null : record(last.outcome);
  const kind =
    outcome === null
      ? "unattempted"
      : choice(outcome.kind, [
          "answer",
          "invalid",
          "refused",
          "truncated",
          "provider-error",
          "interrupted",
          "cancelled",
        ]);
  const result = execution === undefined ? null : record(execution.result),
    effective = result === null ? null : record(result.effective);
  const failure =
    result?.failure === null || result === null ? null : record(result.failure);
  return {
    caseId: text(t.caseId),
    trialIndex: count(t.trialIndex),
    outcome: kind,
    attempts: attempts.length,
    rawText: outcome === null ? null : text(outcome.rawText, 131072),
    label: kind === "answer" ? choice(outcome!.label, REPORT_LABELS) : null,
    explanation: kind === "answer" ? text(outcome!.explanation, 16384) : null,
    invalidReason: kind === "invalid" ? text(outcome!.reason, 128) : null,
    elapsedMs: nullableNumber(t.elapsedMs),
    errorKind: last === null ? null : nullableText(last.errorKind, 128),
    failureCode: failure === null ? null : text(failure.code, 128),
    reportedModelId:
      result === null ? null : nullableText(result.reportedModelId, 256),
    reportedServingProvider:
      result === null
        ? null
        : nullableText(result.reportedServingProvider, 256),
    reasoningEffort:
      effective === null ? null : nullableText(effective.reasoningEffort, 64),
  };
}

export function adaptRunView(input: unknown): ReportRun {
  try {
    const view = record(input),
      r = record(view.record),
      request = record(r.request),
      suite = record(r.suite),
      suiteRequest = record(suite.request),
      evidence = record(r.evidence),
      model = record(evidence.model);
    if (
      r.version !== "1" ||
      (suite.formatVersion !== "1" && suite.formatVersion !== "2")
    )
      invalid();
    const id = text(r.id),
      suiteId = text(suite.id),
      profileId = text(request.profileId),
      provider = text(request.provider),
      modelId = text(request.modelId),
      settingsId = text(model.settingsId),
      endpointId = text(model.endpointId);
    if (
      evidence.runId !== id ||
      evidence.suiteId !== suiteId ||
      evidence.profileId !== profileId ||
      suiteRequest.profileId !== profileId ||
      suite.protocolVersion !== evidence.protocolVersion ||
      model.provider !== provider ||
      model.modelId !== modelId
    )
      invalid();
    const cases = array(suite.cases, 1000).map(caseView),
      depths = array(suiteRequest.depths, 1000).map(count);
    if (
      new Set(cases.map((c) => c.id)).size !== cases.length ||
      new Set(depths).size !== depths.length ||
      cases.some((c) => !depths.includes(c.depth))
    )
      invalid();
    const executions = new Map<string, Data>();
    for (const value of array(r.results, 3000)) {
      const x = record(value),
        key = JSON.stringify([text(x.caseId), count(x.trialIndex)]);
      if (executions.has(key)) invalid();
      executions.set(key, x);
    }
    const trials = array(evidence.trials, 3000).map((t) => {
      const x = record(t);
      return trialView(
        t,
        executions.get(JSON.stringify([text(x.caseId), count(x.trialIndex)])),
      );
    });
    if (
      new Set(trials.map((t) => JSON.stringify([t.caseId, t.trialIndex])))
        .size !== trials.length ||
      trials.some(
        (t) => !cases.some((c) => c.id === t.caseId) || t.trialIndex > 2,
      )
    )
      invalid();
    if (trials.length !== cases.length * 3) invalid();
    const report = r.report === null ? null : record(r.report),
      identity = report === null ? null : record(report.identity);
    if (
      report !== null &&
      (report.reportVersion !== "1" ||
        report.scorerVersion !== "1" ||
        report.policyId !== "pooled-macro-f1-v1" ||
        identity?.runId !== id ||
        identity.suiteId !== suiteId ||
        identity.profileId !== profileId)
    )
      invalid();
    if (identity !== null)
      for (const key of ["provider", "modelId", "endpointId", "settingsId"])
        if (record(identity.model)[key] !== model[key]) invalid();
    const protocolVersion = text(evidence.protocolVersion),
      generatorVersion = text(suite.generatorVersion),
      verifierVersion = text(suite.verifierVersion),
      depthPolicyVersion = text(suite.depthPolicyVersion);
    if (
      identity !== null &&
      (identity.protocolVersion !== protocolVersion ||
        identity.generatorVersion !== generatorVersion ||
        identity.verifierVersion !== verifierVersion ||
        identity.depthPolicyVersion !== depthPolicyVersion)
    )
      invalid();
    const certification =
      suite.formatVersion === "2"
        ? [
            text(suite.promptVersion),
            text(record(suite.backend).id),
            text(record(suite.backend).pythonFlint),
            text(record(suite.backend).flint),
            text(record(suite.backend).policyVersion),
          ]
        : null;
    const generation = record(record(array(r.prompts, 1000)[0]).generation);
    const settings = {
      maxOutputTokens: count(generation.maxOutputTokens),
      sampling: text(generation.sampling, 64),
      reasoning: text(generation.reasoning, 64),
      tools: text(generation.tools, 64),
      concurrency: count(request.concurrency),
    };
    if (settings.maxOutputTokens < 1 || settings.concurrency < 1) invalid();
    if (identity !== null) {
      const workload = record(identity.workload);
      if (
        identity.method !== "one-shot" ||
        workload.profileId !== profileId ||
        workload.protocolVersion !== protocolVersion ||
        workload.maxOutputTokens !== settings.maxOutputTokens
      )
        invalid();
      if (suite.formatVersion === "2") {
        const claimed = record(identity.certification),
          backend = record(claimed.backend),
          expected = record(suite.backend);
        if (
          claimed.promptVersion !== suite.promptVersion ||
          ["id", "pythonFlint", "flint", "policyVersion"].some(
            (key) => backend[key] !== expected[key],
          )
        )
          invalid();
      } else if (identity.certification !== undefined) invalid();
    }
    const groupKey = JSON.stringify([
      suiteId,
      profileId,
      settingsId,
      protocolVersion,
      generatorVersion,
      verifierVersion,
      depthPolicyVersion,
      certification,
    ]);
    const reportedDepths =
      report === null
        ? []
        : array(report.byDepth).map((value) => {
            const x = record(value);
            return {
              depth: count(x.depth),
              slice: slice(x),
              macroF1Difference: nullableNumber(x.macroF1Difference),
            };
          });
    if (
      report !== null &&
      (reportedDepths.length !== depths.length ||
        reportedDepths.some((d) => !depths.includes(d.depth)) ||
        new Set(reportedDepths.map((d) => d.depth)).size !== depths.length)
    )
      invalid();
    const overall = report === null ? null : slice(report.overall);
    if (overall !== null && overall.population.plannedTrials !== trials.length)
      invalid();
    for (const point of reportedDepths)
      if (
        point.slice.population.plannedTrials !==
        cases.filter((entry) => entry.depth === point.depth).length * 3
      )
        invalid();
    return {
      id,
      state: choice(r.state, [
        "running",
        "cancelling",
        "completed",
        "cancelled",
        "timed-out",
        "failed",
        "interrupted",
      ]),
      createdAt: text(r.createdAt, 64),
      publishedAt: nullableText(view.publishedAt, 64),
      suiteKey: text(request.suiteKey),
      suiteId,
      profileId,
      provider,
      modelId,
      servingProvider: nullableText(request.servingProvider, 256),
      endpointId,
      settingsId,
      protocolVersion,
      generatorVersion,
      verifierVersion,
      depthPolicyVersion,
      promptVersion:
        suite.formatVersion === "2" ? text(suite.promptVersion) : null,
      settings,
      reportId: report === null ? null : text(report.id),
      evidenceSha256: identity === null ? null : text(identity.evidenceSha256),
      groupKey,
      overall,
      depths: depths
        .map(
          (depth) =>
            reportedDepths.find((d) => d.depth === depth) ?? {
              depth,
              slice: null,
              macroF1Difference: null,
            },
        )
        .sort((a, b) => a.depth - b.depth),
      cases,
      trials,
    };
  } catch (error) {
    if (error instanceof ReportInputError) throw error;
    throw new ReportInputError();
  }
}
export function adaptRunViews(
  inputs: readonly unknown[],
): readonly ReportRun[] {
  const result = inputs.map(adaptRunView);
  if (new Set(result.map((r) => r.id)).size !== result.length) invalid();
  return result;
}
export function groupReportRuns(
  runs: readonly ReportRun[],
): readonly { key: string; runs: readonly ReportRun[] }[] {
  const groups = new Map<string, ReportRun[]>();
  for (const run of runs) {
    const group = groups.get(run.groupKey) ?? [];
    group.push(run);
    groups.set(run.groupKey, group);
  }
  return [...groups].map(([key, runs]) => ({ key, runs }));
}
export function reportSlice(
  run: ReportRun,
  depth: number | null,
): ReportSlice | null {
  return depth === null
    ? run.overall
    : (run.depths.find((entry) => entry.depth === depth)?.slice ?? null);
}
export function usageSeries(
  run: ReportRun,
  field: UsageField,
  semantics: string,
  depth: number | null = null,
) {
  return run.depths
    .filter((entry) => depth === null || entry.depth === depth)
    .map((entry) => {
      const fieldValue = entry.slice?.usage.fields[field],
        group = fieldValue?.groups.find((g) => g.semantics === semantics);
      return {
        depth: entry.depth,
        value: group?.mean ?? null,
        reporting: group?.reporting ?? null,
        total: entry.slice?.usage.total ?? null,
      };
    });
}
export function buildReportExport(input: {
  detailRun: ReportRun;
  curveRuns: readonly ReportRun[];
  depth: number | null;
  usageField: UsageField;
  usageSemantics: string | null;
}) {
  const { detailRun, curveRuns, depth, usageField, usageSemantics } = input;
  if (
    curveRuns.some((run) => run.groupKey !== detailRun.groupKey) ||
    (curveRuns.length > 1 &&
      curveRuns.some((run) => run.overall?.population.status !== "complete"))
  )
    invalid();
  const selected = curveRuns.some((run) => run.id === detailRun.id)
    ? curveRuns
    : [...curveRuns, detailRun];
  return {
    format: "coconut-report-view-v1",
    detailRunId: detailRun.id,
    curveRunIds: curveRuns.map((run) => run.id),
    depth,
    usageView: { field: usageField, semantics: usageSemantics },
    runs: selected.map((run) => ({
      ...run,
      overall: depth === null ? run.overall : null,
      depths: run.depths.filter(
        (point) => depth === null || point.depth === depth,
      ),
      cases: run.cases.filter(
        (entry) => depth === null || entry.depth === depth,
      ),
      trials: run.trials.filter(
        (trial) =>
          depth === null ||
          run.cases.some(
            (entry) => entry.id === trial.caseId && entry.depth === depth,
          ),
      ),
    })),
  };
}
export type { ReportColumn, ReportLabel, ReportOutcome };
