# Module 04: Scoring and Depth Analysis

## Status

Dependent

## Type

Foundation

## Purpose

Turn reference labels and model outcomes into correct, inspectable measurements without hiding unusable answers or infrastructure failures.

## Finished Outcome

A documented scoring policy produces independently checked overall and depth-level results, repeated-trial summaries, and explicit completeness information from fixed evaluation records.

## Why It Comes Here

Scoring needs 02's answer outcomes and trial profiles. It can proceed in parallel with 03 using controlled fixtures, without waiting for live providers or generated reference suites. Module 08 later supplies real run records.

## Prerequisites

Module 02 handoff and resolved D-02 and D-03: accepted labels, unusable-answer categories, method profiles, repeated-trial counts, and comparison budgets.

## Build Readiness Gate

Read the source documents and 02 handoff. Confirm every outcome category has an explicit proposed scoring treatment and that the fixtures cover selected trial profiles. Resolve D-05 before dependent reporting uses scores. Write the technical plan before implementation; live model access is not required for readiness.

## Scope

### Included

Primary score, denominators, aggregation, depth breakdowns, spread, supporting metrics, completeness rules, and independent scoring fixtures.

### Not Included

Reference-label verification (01), extraction changes (02), suite composition (03), returned usage/timing capture (07), run execution (08), or leaderboard eligibility/ranking policy (10).

## Detailed Work

### Define each reported measure

Choose and describe the primary metric in plain language and with sufficient precision for independent calculation. Define its unit of observation, numerator, denominator, trial aggregation, and weighting across depths and classes. Make unequal depth or class coverage visible. Decide which supporting metrics explain the three-way task and why each is useful, rather than collecting unrelated measurements.

Define spread across repeated trials and how it is presented when there are too few observations. Do not imply certainty unsupported by the data. Preserve method, suite, and budget identity alongside a result; an overall percentage without its evaluated population is insufficient evidence.

### Account for unusable and missing work

Map every 02 outcome to the decided failure policy. Invalid, refused, conflicting, empty, and truncated replies must remain counted and visible under that policy; never silently remove them to improve the score. Show how each category affects the denominator and completion evidence.

Distinguish a model's wrong or unusable answer from authentication failures, unavailable services, transport failures, and cancelled or unattempted work. Infrastructure errors are not evidence of model mathematical failure. Define which incomplete records can have a provisional score, how that status is labeled, and when no score can be reported. Empty inputs and zero denominators must have an explicit nonnumeric outcome, not invented accuracy.

A retry does not become an independent trial merely because it produced another response. Consume the execution evidence supplied by 07 and 08 according to the selected profile. Missing records, duplicate logical answers, conflicting reference information, or incompatible protocol versions must fail clearly rather than being silently repaired.

### Make depth analysis auditable

Compute per-depth results with population counts, answer-quality counts, and completeness information consistent with the overall result. Preserve the depth supplied by the suite owner; scoring does not redefine difficulty. Decide how trial-level and instance-level aggregation interact and make the relationship independently reproducible.

Where supplied execution records contain usage or timing, keep those observations distinguishable from mathematical performance. Do not infer missing prices, usage, model identity, or elapsed work. Any selected supporting calculation needs an explicit definition and unavailable-data behavior. Publication eligibility and repeated-submission aggregation remain decisions for 10.

## User Experience

A visitor can understand the reported score, inspect its counts, compare depth-level behavior, and see whether a result is complete. Provider errors and unusable replies remain visible, so a score cannot imply more successful evaluation than occurred.

## Decisions to Resolve

- **D-05, owner 04:** primary score, aggregation across trials/depths, missing-answer/error policy, spread, and supporting metrics. Blocks 08, 10, and 11.

Update the registry with the chosen definitions, worked calculations, and limitations before dependent use.

## Technical Plan Required Before Coding

Inspect the current repository and write `docs/plans/04-scoring-and-depth-analysis.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Keep scorer verification independent of live services.

## Deliverables

Published scoring definitions, resolved D-05, independently calculated fixtures, reproducible depth/trial summaries, explicit completeness behavior, and the implementation handoff.

## Completion Criteria

Fixture results match independent expected calculations. Every outcome has an observable treatment, totals reconcile with breakdowns, and empty or incompatible inputs cannot yield misleading scores. The same frozen input and policy version always produce the same report.

## Validation

Use hand-calculated cases with all-correct, all-wrong, mixed-class, unequal-depth, and repeated-trial outcomes. Include invalid answers, refusals, truncation, empty replies, provider errors, duplicate records, missing trials, and entirely empty inputs. Check interrupted runs and cancelled work separately from completed failures. Confirm denominator changes are explained and adding a failure cannot silently improve the result through exclusion. Test spread boundaries and inconsistent version/reference evidence. All scorer tests must run without live credentials or paid calls.

## Implementation Handoff

Write `docs/handoffs/04-scoring-and-depth-analysis.md` with plan and implemented artifact paths, D-05 resolution, exact commands/results, supported environments tested, and known limitations. Supply policy version, fixture inputs and independent expected outputs, outcome-to-score mapping, aggregation definitions, and required result/completeness fields.

## Dependencies and Handoff

08 receives deterministic reporting requirements; 10 receives score interpretation and completeness evidence; 11 receives public metric explanations and worked examples. Consumers must preserve denominators, policy identity, and the distinction between infrastructure errors and model performance.

## Risks and Open Questions

Different weighting and failure policies can change apparent rankings. Resolve them before viewing results intended for comparison. Sparse trials limit conclusions about variability even when the arithmetic is correct.
