# Module 14: Benchmark Quality and Pitfall Remediation

## Status

Dependent — offline automation, reference review and quality criteria implemented; live-experiment verdicts remain evidence-dependent. See the [handoff](../handoffs/14-benchmark-quality-and-pitfall-remediation.md).

## Type

Validation and repair

## Purpose

Detect and fix benchmark weaknesses that deterministic grading alone cannot prevent: artificial difficulty, correlated reference errors, restricted coverage, answer-format confounds, weak statistical evidence, unfair comparisons, misleading metrics, and unsupported relevance claims.

This module implements checks and repairs discovered defects. It does not promise that models will fail or that code can replace mathematical and domain judgment.

## Sequencing and Prerequisites

Begin offline checks after modules 03 and 04 supply frozen-suite and scoring contracts. Inspect their actual handoffs; existing completion claims do not establish benchmark quality. Define the review criteria before model results influence their selection.

Finalize against module 08's run evidence and inherited provider/protocol handoffs. Module 12 requires this module's G-QUALITY verdict before final integration and packaging. Module 13 remains the later reporting audit. Number 14 preserves existing module names; execution order is 08 → 14 → 12 → 13, with 09–11 able to proceed alongside 14 after their prerequisites pass. Neither 08 nor 14 depends on module 12.

## Build Readiness Gate

Read the idea, roadmap, and relevant 01–08 plans and handoffs. Identify implemented checks to reuse and the precise remaining gaps. Write `docs/plans/14-benchmark-quality-and-pitfall-remediation.md` before coding, listing owned files, input/report contracts, bounded analysis, regression fixtures, and exact verification commands.

Resolve D-12: quality criteria, review populations, coverage targets, duplicate/equivalence policy, difficulty diagnostics, uncertainty reporting, and acceptable comparison limitations. Freeze these before confirmatory runs. Existing exploratory runs may inform a new version but cannot retroactively establish a predeclared evaluation. Live calls need separately authorized credentials and a budget; this documentation does not authorize spending.

## Checks and Required Repairs

| Pitfall | Required check | Repair when the check fails |
| --- | --- | --- |
| Structural depth without real difficulty | Inspect raw depth, bounded simplification results, expression size, operation diversity, active pieces, and repeated/cancelling operations. Include deep identity-like and shallow nontrivial fixtures. | Remove padding from generation rules or separate trivial families into disclosed strata. Change coverage claims and generate a new versioned suite when membership changes. Never claim structural depth is a proven measure of difficulty. |
| Duplicate templates and narrow coverage | Audit exact and supported semantic signatures, family membership, and class/depth counts. Separate structural duplicates from mathematical equivalence and record uncheckable cases. | Repair duplicate detection and diversify supported templates within D-01. Reject impossible coverage explicitly. Publish achieved coverage and limits instead of inventing diversity. |
| Generator/verifier sharing the same mistake | Check representative accepted instances and adversarial inputs through hand-derived references or an independently justified method that does not merely call the same curvature rules. Compare exact Jensen evidence and certificate replay. | Fix the responsible rule/validator, add a regression case, and recheck all affected instances. Invalidate affected suites and scores; reopen G-MATH if its accepted boundary is unsound. Agreement between two wrappers around the same code is insufficient. |
| Verifier selection bias | Summarize accepted/rejected/uncertain cases by supported family and label, and document excluded operations/domains. | Narrow claims to the actual accepted subset or extend support through module 01 with new evidence. Never turn unverified cases into neither or extrapolate to general mathematical reasoning. |
| Format and token-limit confounds | Reconcile correct/wrong extracted labels, invalid formatting, refusals, truncation, and provider failures separately. Inspect failure transcripts without silently repairing answers. Check profile compatibility and budget exhaustion. | Fix adapter/extractor defects under the existing contract. If the task instructions, accepted format, or generation budget are the cause, define a new protocol/profile and retain old results separately. Report diagnostic human judgments separately from official grades. |
| Too few or dependent observations | Count distinct instances and families as well as trials; inspect per-class/depth support, repeated-trial variation, and dependence. | Add independently useful tasks in a new suite or collect additional trials under a predeclared, authorized profile. Otherwise qualify conclusions and withhold unsupported ordering. More retries are not more independent trials. |
| Unfair model comparisons | Compare exact suite, profile, settings, trial counts, token ceilings, schema enforcement, routing/identity, and completion evidence. | Reject incompatible comparison groups or separate them visibly. Endpoint defaults do not establish matched numeric settings or equal compute. Do not change models/settings silently. |
| Metric or denominator artifacts | Reconcile macro-F1, accuracy, class recall, support, confusion counts, unusable outcomes, and incomplete work with independent fixtures. Include majority-only and imbalanced examples. | Repair the shared module 04 scorer and affected consumers, version policy changes, and recompute from retained outcomes. Do not choose favorable metrics or drop failures after inspecting results. |
| Unsupported practical relevance | Map each claimed capability to reviewed task families and explain what errors would mean in a concrete modeling scenario. Check the wording against the bounded scalar domain. | Remove or narrow unsupported claims, obtain domain review, or add reviewed representative tasks within supported scope. Synthetic classification results alone do not prove production usefulness. |
| Leakage and evaluation-driven selection | Inspect model-visible payloads for reference data and unintended label hints; record suite exposure and which runs informed revisions. | Remove leakage, retire contaminated comparisons, and version changed prompts/suites. Preserve exploratory results and evaluate revisions on a separately frozen confirmation suite when making new failure claims. Do not promise that public tasks are contamination-free. |

### Bounded automation and independent review

Use exact, domain-preserving simplifications only where their equivalence is justified; no unbounded general symbolic equivalence engine is required. Report unsupported analysis as unknown. Simplification is a diagnostic and must not silently replace the expression seen by the model or its certificate.

Produce reproducible machine-readable findings with instance/run identifiers, category, evidence, severity, suggested owner, and outcome. Findings must distinguish verified defects, diagnostic warnings, and missing evidence. Reuse the existing verifier, generator signatures, scorer, and retained execution records; do not create a second evaluation stack.

For mathematical validity and relevance, record the reviewer's identity or role, exact reviewed examples and claims, reasoning, and limitations. Automated or model-assisted review must be labeled as such. Never fabricate human approval; unresolved expert review remains an explicit blocker to the claim it supports. Scope limits may be accepted only with a documented rationale and corresponding claim restrictions.

### Statistical evidence

Specify an uncertainty method and its population in D-12 before confirmatory analysis. Preserve the nesting of trials within instances; do not treat all repeated answers as independent tasks. If using resampling, resample instances with their trials together, retain class/depth structure where appropriate, and record the seed, repetition count, and interval method. Compare models on matched instances when making paired claims. Account for sparse family coverage and disclose when evidence cannot support a reliable interval or ordering. Do not interpret a small score difference as a demonstrated capability gap.

### Repair and version discipline

Implement reproducible defects in the responsible shared code path and add a focused regression fixture. Coordinate ownership with active module work; do not overwrite unrelated edits. Update the relevant handoff and rerun only checks affected by the change. Suite/prompt/profile/scoring changes need new identities and must preserve old results. Reference-invalid runs cannot remain ranked; invalidate eligibility with the reason retained. Reassess G-MATH, G-SIGNAL, or provider evidence when a repair invalidates its assumptions.

Run offline repairs and report recalculation before proposing new paid work. Missing expertise, credentials, budget, or provider capability cannot be fixed by inventing evidence. Record the concrete external action needed and complete independent work meanwhile.

## Deliverables

- Reproducible quality checks and adversarial fixtures for the supported scope.
- A finding-and-repair ledger with before/after evidence, owners, changed artifact versions, and regression results.
- Coverage, confound, comparison, and uncertainty reports tied to retained suites/runs.
- Recorded mathematical/domain review and explicit outstanding limitations.
- D-12 resolution and `docs/handoffs/14-benchmark-quality-and-pitfall-remediation.md` with G-QUALITY verdict.

## Validation

Inject identity padding, cancellation, duplicates, incorrect reference claims, label hints, malformed replies, truncation, missing trials, budget mismatches, provider errors, and inconsistent metric inputs into controlled fixtures. Each check must detect its intended problem while accepting an independently checked valid case. Verify fixes with regressions and recheck affected suite/run identities and ranking eligibility. Uncertain equivalence, sparse observations, and unavailable review must remain visible.

Run relevant tests, lint, type checks, and builds for changed source. Record exact commands/results and the distinction between fixture checks and live evidence. Reproduce the quality report from retained inputs without credentials; do not copy secrets or private run data into public reports.

## Completion Criteria and G-QUALITY

G-QUALITY is Go only when supported reference validity, declared coverage, metric correctness, comparison boundaries, and the main capability claims have adequate evidence; verified critical defects are fixed and affected artifacts revalidated. Every pitfall must have a recorded outcome: passed, repaired, accepted scoped limitation, or unresolved. A scoped limitation needs rationale and visible claim restrictions; it cannot waive incorrect references, leakage, fabricated outcomes, or unfair ranking.

Missing evidence needed for a central claim produces a No-go and identifies the decision or external input needed. A No-go blocks final readiness, not independent implementation. Strong model performance does not fail benchmark quality by itself, but it cannot satisfy a claimed model-failure finding: G-SIGNAL remains separately required.

## Implementation Handoff

Record the plan, D-12 criteria, check/fixture paths, reviewed suite/run versions, finding ledger, completed repairs, independent-review evidence, exact verification results, remaining limitations, and G-QUALITY verdict. Modules 09–11 consume corrected reports and claim restrictions; 12 consumes the gate and repair evidence; 13 checks the final reporting against these outputs without repeating this quality review.
