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

Implement macro-F1 as the headline classification metric, alongside accuracy and per-class precision/recall/F1/support, in this module's first scorer implementation. Implement the diagnostics below from controlled fixtures now; module 08 supplies actual run evidence and module 09 presents the results. Module 13 only audits the completed reporting. Resolve all populations and conventions in D-05 before comparison runs.

Define spread across repeated trials and how it is presented when there are too few observations. Do not imply certainty unsupported by the data. Preserve method, suite, and budget identity alongside a result; an overall percentage without its evaluated population is insufficient evidence.

### Required diagnostics

Report macro-F1 and class recall as depth curves with counts, protocol identity, and repeated-trial spread. Preserve every tested depth; do not select only favorable slices.

Define two project rates to quantify the paper's directional-error observation: convex-to-neither count divided by included convex support, and concave-to-neither count divided by included concave support. Keep them separate and show numerators and denominators. An absent source class produces an unavailable rate.

For each model, profile, and depth, report mean provider-reported reasoning tokens over attempts with that field, the number of reporting attempts, and total attempts. Separately report input and output tokens, their field semantics, and missing usage counts. Never infer reasoning tokens from explanation length, output tokens, or an absent field. Preserve attempt-level totals including retries, and separately define logical-trial aggregates. Token counts alone do not establish a reasoning failure mode.

Measure raw expression length separately from the full prompt. Record the tokenizer/model identifier and version for local token counts; provider full-prompt usage is not expression-only length. Missing compatible tokenizers produce unavailable expression-token counts, with character/node counts reported separately. If decomposition is later supported, measure that representation under the same declared tokenizer. Context-limit comparisons require verified model limits and the actual full request budget, not just expression length.

First-error position and recursive-step counts are not applicable to the current one-shot profiles. If a separately approved method exposes intermediate outputs, require a versioned step-checking rubric, ordered step identifiers, actual step count, and independently checked local references. Report the first incorrect step's index and index/total-steps ratio, alongside counts of error-free, failed, and uncheckable traces. Missing traces cannot be treated as error-free. Granularity comparisons require matched suites and disclosed call/token budgets. Do not fabricate hidden reasoning or introduce new calls in this module to populate these fields.

### Project additions

These are our reporting choices, not claims about metrics defined by the paper:

- **Accuracy and class detail:** retain accuracy, per-class precision/F1/support, and a confusion matrix overall and by depth. Matrix rows are reference classes and columns are predicted classes; add an explicit unusable-answer column. Show raw counts and row-normalized rates. Empty rows are unavailable; infrastructure outcomes remain in a separate completion table. This convention preserves support without inventing a fourth reference class.
- **Answer and execution reliability:** report counts/rates for invalid replies, refusals, truncation, and empty/conflicting answers over returned model outcomes. Report provider errors, cancelled and unattempted work separately against planned logical trials. Define mutually exclusive outcome categories using 02/04; retries never inflate trial counts.
- **Trial agreement:** for each instance with all planned trials returning valid labels, compute agreeing unordered trial pairs divided by all unordered trial pairs, then average across eligible instances overall and by depth. Report eligible/total instance counts and mark unavailable when fewer than two trials exist. Agreement is not correctness; always show it alongside F1 and unusable-answer counts. This does not authorize majority-vote scoring.
- **Depth degradation:** report the signed macro-F1 difference between each tested depth and the shallowest tested depth within the same model/profile/suite; negative values indicate degradation. Use percentage points when displaying F1 as percentages. Preserve per-depth coverage and do not attribute differences solely to depth when family/class composition also changes. No interpolation or inferred collapse threshold is required.
- **Runtime and cost:** report p50/p95 logical-trial elapsed time under a documented quantile convention and completed-trial population, with failure/timeout counts separately. Distinguish trial latency from total run wall time and concurrency. Report actual billed cost when available, or a clearly labeled estimate using dated pricing, currency, and observed usage. Missing usage/prices stay unknown; include retry costs and never present partial known costs as the complete bill.

### Define the metrics before comparison

For each of the three fixed labels, derive true positives, false positives, and false negatives from reference labels and extracted predictions. Precision is TP / (TP + FP), recall is TP / (TP + FN), and F1 is 2TP / (2TP + FP + FN). Macro-F1 is the unweighted mean of the three class F1 values; do not substitute micro-F1 or support-weighted F1. Support is the number of included reference observations for that class.

Resolve zero denominators, absent classes, and the observation population explicitly in D-05 before comparison runs. Keep the three-label set fixed across models and depth slices; do not silently average over only predicted or present classes. An empty scoring population must produce an unavailable metric, not a fabricated numeric score. Explain any zero-denominator convention and flag missing class coverage.

Specify whether the headline metric pools instance-trial observations or aggregates trial-level metrics. Report repeated-trial variation separately; averaging trial F1 values is not generally equivalent to computing F1 from pooled counts. Include independently calculated examples for the selected policy.

### Preserve failures and comparison identity

Apply D-05 consistently to invalid, refused, empty, conflicting, and truncated model replies. Such replies must remain visible and cannot be dropped to improve F1; document their effect on class false negatives and accuracy. Infrastructure failures, cancellation, and unattempted work remain distinct from model classification errors. Report completeness and the scoring population alongside every metric.

Version the scoring policy and reports from the first implementation. Recompute older retained runs only when their evidence supports the same definitions, marking the new scorer version. Never mix different metric policies as comparable results. D-10 continues to govern ranking; any change to its ranking metric must be recorded before applying it, rather than selected after inspecting scores.

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

Use [scikit-learn's F1 definition](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html) and [confusion-matrix conventions](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.confusion_matrix.html) as independent formula references, not required dependencies. Record reference versions. Paper provenance and the final audit checklist remain in [module 13](13-f1-metrics-and-final-reporting.md).

Inspect the current repository and write `docs/plans/04-scoring-and-depth-analysis.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Keep scorer verification independent of live services.

## Deliverables

Published scoring definitions, resolved D-05, independently calculated fixtures, reproducible depth/trial summaries, explicit completeness behavior, and the implementation handoff.

## Completion Criteria

Macro-F1, per-class precision/recall/F1/support, accuracy, and applicable diagnostics are implemented in the shared scorer with independent fixtures; unavailable and conditional metrics follow explicit evidence rules.

Fixture results match independent expected calculations. Every outcome has an observable treatment, totals reconcile with breakdowns, and empty or incompatible inputs cannot yield misleading scores. The same frozen input and policy version always produce the same report.

## Validation

Use hand-calculated fixtures for perfect predictions, entirely wrong predictions, majority-class-only predictions on imbalanced data, an unpredicted class, an absent reference class, zero denominators, empty populations, invalid replies, provider failures, partial runs, unequal depth coverage, and repeated trials. Verify macro-F1 differs from accuracy where expected, pooled and trial-averaged results follow their stated definitions, and per-class counts reconcile with source outcomes. Supply expected report fixtures for module 08 exports and module 09 views; their integration checks belong to those modules. These checks require no paid calls.

Check directional-error denominators, confusion-matrix row totals, pairwise agreement with unanimous and disagreeing trials, negative/positive depth differences, and missing baseline scores. Test missing reasoning-token fields, tokenizer mismatches, partial usage/cost coverage, retries, latency quantiles, and distinction between trial and run duration. Conditional trace diagnostics need fixtures for first-step/last-step errors, error-free and uncheckable traces; unsupported methods must show not applicable. Do not require live calls to verify calculations.

Use hand-calculated cases with all-correct, all-wrong, mixed-class, unequal-depth, and repeated-trial outcomes. Include invalid answers, refusals, truncation, empty replies, provider errors, duplicate records, missing trials, and entirely empty inputs. Check interrupted runs and cancelled work separately from completed failures. Confirm denominator changes are explained and adding a failure cannot silently improve the result through exclusion. Test spread boundaries and inconsistent version/reference evidence. All scorer tests must run without live credentials or paid calls.

## Implementation Handoff

Write `docs/handoffs/04-scoring-and-depth-analysis.md` with plan and implemented artifact paths, D-05 resolution, exact commands/results, supported environments tested, and known limitations. Supply policy version, fixture inputs and independent expected outputs, outcome-to-score mapping, aggregation definitions, and required result/completeness fields.

## Dependencies and Handoff

08 receives deterministic reporting requirements; 10 receives score interpretation and completeness evidence; 11 receives public metric explanations and worked examples. Consumers must preserve denominators, policy identity, and the distinction between infrastructure errors and model performance.

## Risks and Open Questions

Different weighting and failure policies can change apparent rankings. Resolve them before viewing results intended for comparison. Sparse trials limit conclusions about variability even when the arithmetic is correct.
