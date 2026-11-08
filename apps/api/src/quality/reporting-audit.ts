// Independently assert retained report arithmetic; this audit is never used to score or rank a run.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Label } from "../math";
import type { RunRecord } from "../runs/types";
import type { ScoringReport, SliceReport, TrialEvidence, TokenField } from "../scoring";
import { bindEvidence, parseEvidence } from "../scoring/evidence";

const labels = ["convex", "concave", "neither"] as const;
const returned = new Set(["answer", "invalid", "refused", "truncated"]);
const columns = [...labels, "unusable"] as const;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const rate = (n: number, d: number) => ({ numerator: n, denominator: d, value: d ? n / d : null });
const digest = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

function checkNumber(actual: number | null, expected: number | null): void {
  if (actual === null || expected === null) assert.equal(actual, expected);
  else assert.ok(Math.abs(actual - expected) <= 1e-12, "Reported numeric metric differs from independent arithmetic.");
}

function population(trials: readonly TrialEvidence[], references: Map<string, { label: Label; depth: number }>) {
  const matrix = Object.fromEntries(labels.map(label => [label, { convex: 0, concave: 0, neither: 0, unusable: 0 }])) as Record<Label, Record<typeof columns[number], number>>;
  const outcomes: Record<string, number> = Object.fromEntries(["answer", "invalid", "empty", "conflicting", "refused", "truncated", "provider-error", "interrupted", "cancelled", "unattempted"].map(key => [key, 0]));
  let included = 0, correct = 0;
  for (const trial of trials) {
    const outcome = trial.finalAttempt === null ? null : trial.attempts[trial.finalAttempt - 1].outcome;
    const category = outcome === null ? "unattempted" : outcome.kind !== "invalid" ? outcome.kind : outcome.reason === "empty" ? "empty" : outcome.reason === "duplicate-field" ? "conflicting" : "invalid";
    outcomes[category]++;
    if (outcome === null || !returned.has(outcome.kind)) continue;
    included++;
    const reference = references.get(trial.caseId)!.label;
    const prediction = outcome.kind === "answer" ? outcome.label : "unusable";
    matrix[reference][prediction]++;
    if (reference === prediction) correct++;
  }
  const classes = Object.fromEntries(labels.map(label => {
    const tp = matrix[label][label], support = columns.reduce((n, key) => n + matrix[label][key], 0);
    const fp = labels.filter(other => other !== label).reduce((n, other) => n + matrix[other][label], 0), fn = support - tp;
    return [label, { tp, fp, fn, support, precision: tp + fp ? tp / (tp + fp) : null, recall: support ? tp / support : null,
      f1: included === 0 ? null : 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0 }];
  })) as ScoringReport["overall"]["classification"]["classes"];
  return { matrix, classes, outcomes, included, correct, planned: trials.length,
    macroF1: included ? labels.reduce((n, label) => n + classes[label].f1!, 0) / 3 : null,
    status: included === 0 ? "unavailable" : included === trials.length ? "complete" : "provisional" };
}

function checkPopulation(report: SliceReport["classification"], trials: readonly TrialEvidence[], references: Map<string, { label: Label; depth: number }>) {
  const expected = population(trials, references);
  assert.deepEqual(report.population, { plannedTrials: expected.planned, includedTrials: expected.included, excludedTrials: expected.planned - expected.included, correctTrials: expected.correct, status: expected.status });
  checkNumber(report.macroF1, expected.macroF1);
  assert.deepEqual(report.accuracy, rate(expected.correct, expected.included));
  assert.deepEqual(report.classes, expected.classes);
  assert.deepEqual(report.confusion.columns, columns);
  assert.deepEqual(report.absentReferenceClasses, labels.filter(label => !expected.classes[label].support));
  for (const label of labels) {
    assert.deepEqual(report.confusion.rows[label].counts, expected.matrix[label]);
    const support = expected.classes[label].support;
    assert.deepEqual(report.confusion.rows[label].rowRates, support ? Object.fromEntries(columns.map(key => [key, expected.matrix[label][key] / support])) : null);
  }
  assert.deepEqual(report.directionalErrors, { convexToNeither: rate(expected.matrix.convex.neither, expected.classes.convex.support), concaveToNeither: rate(expected.matrix.concave.neither, expected.classes.concave.support) });
  for (const [category, count] of Object.entries(expected.outcomes)) assert.deepEqual(report.outcomes[category as keyof typeof report.outcomes], rate(count, ["answer", "invalid", "empty", "conflicting", "refused", "truncated"].includes(category) ? expected.included : expected.planned));
  return expected;
}

function checkSpread(report: { count: number; mean: number | null; min: number | null; max: number | null; sampleStandardDeviation: number | null }, values: number[]) {
  assert.equal(report.count, values.length);
  const average = mean(values);
  checkNumber(report.mean, average);
  checkNumber(report.min, values.length ? Math.min(...values) : null);
  checkNumber(report.max, values.length ? Math.max(...values) : null);
  checkNumber(report.sampleStandardDeviation, values.length < 2 ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - average!) ** 2, 0) / (values.length - 1)));
}

function usage(values: readonly (TokenField | null)[]) {
  const semantics = [...new Set(values.flatMap(value => value ? [value.semantics] : []))].sort();
  const reporting = values.filter(value => value !== null).length;
  return { reporting, missing: values.length - reporting, groups: semantics.map(key => {
    const counts = values.flatMap(value => value?.semantics === key ? [value.count] : []), total = counts.reduce((a, b) => a + b, 0);
    return { semantics: key, reporting: counts.length, total, mean: total / counts.length };
  }) };
}

function checkSlice(slice: SliceReport, trials: readonly TrialEvidence[], references: Map<string, { label: Label; depth: number }>) {
  const expected = checkPopulation(slice.classification, trials, references), classes = slice.classification;
  const eligible: ReturnType<typeof population>[] = [];
  assert.equal(classes.trials.length, 3);
  for (let index = 0; index < 3; index++) {
    const rows = trials.filter(trial => trial.trialIndex === index), computed = checkPopulation(classes.trials[index].metrics as typeof classes, rows, references);
    const complete = computed.status === "complete" && rows.length === new Set(trials.map(trial => trial.caseId)).size;
    assert.equal(classes.trials[index].trialIndex, index); assert.equal(classes.trials[index].eligibleForSpread, complete);
    if (complete) eligible.push(computed);
  }
  assert.equal(classes.spread.plannedReplicates, 3); assert.equal(classes.spread.eligibleReplicates, eligible.length);
  checkSpread(classes.spread.macroF1, eligible.map(row => row.macroF1!));
  for (const label of labels) checkSpread(classes.spread.recall[label], eligible.flatMap(row => row.classes[label].recall === null ? [] : [row.classes[label].recall!]));
  let agreeingPairs = 0, eligibleInstances = 0;
  const instanceIds = [...new Set(trials.map(trial => trial.caseId))];
  for (const id of instanceIds) {
    const outcomes = trials.filter(trial => trial.caseId === id).map(trial => trial.finalAttempt === null ? null : trial.attempts[trial.finalAttempt - 1].outcome);
    if (outcomes.length !== 3 || outcomes.some(outcome => outcome?.kind !== "answer")) continue;
    eligibleInstances++;
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
      const left = outcomes[a], right = outcomes[b];
      if (left?.kind === "answer" && right?.kind === "answer" && left.label === right.label) agreeingPairs++;
    }
  }
  assert.deepEqual(classes.agreement, { eligibleInstances, totalInstances: instanceIds.length, agreeingPairs, totalPairs: eligibleInstances * 3, value: eligibleInstances ? agreeingPairs / (eligibleInstances * 3) : null });
  const attempts = trials.flatMap(trial => trial.attempts), diagnostics = slice.diagnostics;
  assert.equal(diagnostics.usage.attempts.total, attempts.length); assert.equal(diagnostics.usage.logicalTrials.total, trials.length);
  for (const field of ["input", "output", "reasoning"] as const) {
    assert.deepEqual(diagnostics.usage.attempts.fields[field], usage(attempts.map(attempt => attempt.usage[field])));
    const logical = usage(trials.map(trial => {
      const values = trial.attempts.map(attempt => attempt.usage[field]);
      return !values.length || values.some(value => value === null) || new Set(values.map(value => value!.semantics)).size !== 1 ? null
        : { count: values.reduce((sum, value) => sum + value!.count, 0), semantics: values[0]!.semantics };
    }));
    assert.deepEqual(diagnostics.usage.logicalTrials.fields[field], { complete: logical.reporting, missing: logical.missing, groups: logical.groups });
  }
  const finalModel = trials.filter(trial => trial.finalAttempt !== null && returned.has(trial.attempts[trial.finalAttempt - 1].outcome.kind));
  const times = finalModel.flatMap(trial => trial.elapsedMs === null ? [] : [trial.elapsedMs]).sort((a, b) => a - b);
  const infrastructure = trials.filter(trial => trial.finalAttempt !== null && !returned.has(trial.attempts[trial.finalAttempt - 1].outcome.kind));
  assert.deepEqual(diagnostics.latency, { eligible: finalModel.length, reporting: times.length, missing: finalModel.length - times.length,
    p50Ms: times.length ? times[Math.ceil(times.length / 2) - 1] : null, p95Ms: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null,
    infrastructureTrials: infrastructure.length, infrastructureAttempts: attempts.filter(attempt => !returned.has(attempt.outcome.kind)).length,
    timeoutTrials: trials.filter(trial => trial.attempts.some(attempt => attempt.errorKind === "timeout")).length,
    timeoutAttempts: attempts.filter(attempt => attempt.errorKind === "timeout").length, unattemptedTrials: trials.filter(trial => trial.finalAttempt === null).length });
  const knownCosts = attempts.filter(attempt => attempt.cost !== null).length;
  assert.equal(diagnostics.cost.attempts, attempts.length); assert.equal(diagnostics.cost.reporting, knownCosts); assert.equal(diagnostics.cost.missing, attempts.length - knownCosts);
  if (!knownCosts) { assert.equal(diagnostics.cost.total, null); assert.deepEqual(diagnostics.cost.groups, []); }
  assert.equal(diagnostics.intermediateSteps.status, "not-applicable");
  return expected;
}

function checkLengths(record: RunRecord, slice: SliceReport, depth?: number) {
  const cases = record.suite.cases.filter(entry => depth === undefined || entry.depth === depth), ids = new Set(cases.map(entry => entry.id));
  const expected = cases.map(entry => ({ caseId: entry.id, depth: entry.depth,
    expressionSha256: createHash("sha256").update(entry.certificate.renderedExpression).digest("hex"),
    expressionCharacters: [...entry.certificate.renderedExpression].length, nodeCount: entry.certificate.nodeCount,
    promptCharacters: record.prompts[record.suite.cases.findIndex(candidate => candidate.id === entry.id)].messages.reduce((sum, message) => sum + [...message.content].length, 0) })).sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0);
  const summarize = (values: number[]) => ({ count: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, mean: mean(values) });
  const lengths = slice.diagnostics.lengths;
  assert.equal(lengths.cases, cases.length); assert.deepEqual(lengths.perCase, expected);
  for (const field of ["expressionCharacters", "nodeCount", "promptCharacters"] as const) assert.deepEqual(lengths[field], summarize(expected.map(entry => entry[field])));
  const tokens = record.evidence.expressionTokens.filter(entry => ids.has(entry.caseId));
  const supplied = new Set(tokens.map(entry => entry.caseId));
  const compatible = new Set(tokens.filter(entry => entry.tokenizer.modelId === record.evidence.model.modelId).map(entry => entry.caseId));
  const tokenReport = lengths.expressionTokens;
  assert.equal(tokenReport.totalCases, cases.length); assert.equal(tokenReport.compatibleCases, compatible.size);
  assert.equal(tokenReport.missingCases, cases.length - supplied.size); assert.equal(tokenReport.incompatibleCases, supplied.size - compatible.size);
  const groupKeys = [...new Set(tokens.map(entry => JSON.stringify([entry.tokenizer.id, entry.tokenizer.version, entry.tokenizer.modelId])))].sort();
  assert.deepEqual(tokenReport.groups, groupKeys.map(key => {
    const selected = tokens.filter(entry => JSON.stringify([entry.tokenizer.id, entry.tokenizer.version, entry.tokenizer.modelId]) === key);
    const tokenizer = selected[0].tokenizer, matches = tokenizer.modelId === record.evidence.model.modelId;
    return { tokenizer, compatible: matches, suppliedCases: selected.length, reportingCases: matches ? selected.length : 0,
      missingCases: cases.length - (matches ? selected.length : 0), summary: summarize(matches ? selected.map(entry => entry.count) : []),
      perCase: selected.map(entry => ({ caseId: entry.caseId, count: matches ? entry.count : null })).sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0) };
  }));
}

export function auditRetainedMetrics(record: RunRecord) {
  const report = record.report;
  assert.ok(report, "A retained scoring report is required for this arithmetic audit.");
  const { id, ...content } = report;
  const evidence = bindEvidence(parseEvidence(record.evidence), record.suite);
  assert.equal(id, `report-v1-${digest(content)}`);
  assert.equal(report.identity.evidenceSha256, digest(evidence));
  assert.deepEqual(report.identity.model, record.evidence.model);
  assert.equal(report.identity.runId, record.id); assert.equal(report.identity.suiteId, record.suite.id);
  assert.equal(record.evidence.trials.length, record.suite.cases.length * 3);
  const references = new Map(record.suite.cases.map(entry => [entry.id, { label: entry.label, depth: entry.depth }]));
  const overall = checkSlice(report.overall, evidence.trials, references);
  checkLengths(record, report.overall);
  assert.equal(report.byDepth.length, record.suite.request.depths.length);
  assert.equal(report.baselineDepth, record.suite.request.depths[0]);
  const baseline = population(evidence.trials.filter(trial => references.get(trial.caseId)!.depth === report.baselineDepth), references).macroF1;
  for (const [index, slice] of report.byDepth.entries()) {
    assert.equal(slice.depth, record.suite.request.depths[index]);
    const point = checkSlice(slice, evidence.trials.filter(trial => references.get(trial.caseId)!.depth === slice.depth), references);
    checkLengths(record, slice, slice.depth);
    checkNumber(slice.macroF1Difference, point.macroF1 === null || baseline === null ? null : point.macroF1 - baseline);
  }
  return { runId: record.id, scoringReportId: report.id, sourceSha256: digest(record), state: record.state,
    plannedTrials: overall.planned, includedModelOutcomes: overall.included, correct: overall.correct,
    wrongValid: overall.outcomes.answer - overall.correct, populationStatus: overall.status,
    macroF1: overall.macroF1, accuracy: report.overall.classification.accuracy.value,
    outcomes: overall.outcomes, inferenceRequests: record.results.reduce((sum, row) => sum + row.result.inferenceRequests, 0),
    checks: "identity hashes; class metrics; all outcome denominators; confusion and directional errors; trial spread/agreement; every depth; token semantics and coverage; latency quantiles; observed cost coverage; expression/prompt lengths and tokenizer provenance" };
}
