# Module 13: Metrics and Final Reporting Audit

## Status

Dependent — independent original-run arithmetic/export audit verified; final replication/integration evidence pending. Submission-material review is outside current user scope. See the [handoff](../handoffs/13-f1-metrics-and-final-reporting.md).

## Type

Readiness

## Purpose

Confirm that the required metrics, charts, and submission reports agree with retained evidence. Implement the requirements in their original owner modules so the final audit does not create a second scoring or UI project.

## Prerequisites

Completed module 12 and upstream handoffs, including module 14's quality/repair evidence and G-QUALITY Go. This audit follows integration and introduces no dependency from earlier modules back to 13.

## Ownership and Scope

| Owner | Work completed before this audit |
| --- | --- |
| [04 Scoring and depth analysis](04-scoring-and-depth-analysis.md) | Headline macro-F1, per-class precision/recall/F1/support, accuracy, diagnostic definitions/calculations, and independent fixtures. |
| [07 Model inference](07-model-inference.md) | Attempt-level usage, reasoning-token availability, timing, and cost evidence. |
| [08 Run execution and results](08-run-execution-and-results.md) | Retained instance/trial/attempt evidence, scorer integration, exports, and run-level timing/completeness. |
| [09 Evaluation interface](09-evaluation-interface.md) | Next.js/shadcn/ui reporting views and charts, `/frontend-design`, `/unslop`, accessibility, and browser checks. |
| [10 Leaderboard](10-leaderboard.md) | Eligible comparisons consuming the shared scorer and chart components under D-10. |
| [11 Landing and methodology](11-landing-and-methodology.md) | Accurate metric interpretation and evidence limits. |
| [12 Integration and submission](12-integration-and-submission.md) | Integrated verification and prepared artifacts containing the completed metrics and charts. |

The linked owner modules contain the implementation requirements. This module verifies their handoffs and outputs; it does not define a parallel scorer, rebuild charts, alter protocols, or initiate paid calls. Missing requirements return to their owner, with only affected checks and artifacts refreshed after a repair.

## Paper Evidence and Applicability

Paraphrased from [ConvexBench v2](https://arxiv.org/html/2602.01075v2), checked on 7 November 2026:

| Paper location | Reported measure or diagnostic | Planned treatment |
| --- | --- | --- |
| Section 5.1; Figure 4 | Macro-F1 across composition depths. | Required. |
| Section 5.1; Figure 5 | One-vs-rest recall for each class across depths. | Required. |
| Section 5.2.2 | Convex/concave predictions shifting to neither. | Quantify with the project-defined rates in module 04. |
| Figure 4; Section 5.2.3 | Average reasoning-token consumption across depths. | Required when reported; otherwise unavailable. |
| Table 1 | Average raw/decomposed expression token lengths. | Raw inputs required where measurable; decomposition conditional. |
| Figure 6 | First incorrect intermediate step. | Conditional on checkable step outputs. |
| Table 2; Figure 7 | Recursive-step counts and decomposition-granularity trade-offs. | Conditional on a future method profile. |

The paper uses different sampling budgets across model groups. Our three-trial one-shot profiles and bounded mathematical subset are adaptations, not a reproduction. Keep metrics separate from method changes; majority voting and agentic methods require new profiles and budgets.

## Audit Checklist

- Confirm [module 14](14-benchmark-quality-and-pitfall-remediation.md) has closed critical findings, preserved version identities, and propagated claim restrictions into the final reports. Reuse its review evidence rather than repeating its pitfall checks.

- Independently reproduce macro-F1, per-class recall/precision/F1/support, accuracy, confusion matrices, directional-error rates, trial agreement, and depth degradation from frozen outcomes under D-05.
- Check token statistics, latency/cost populations, missing-data coverage, retry accounting, and tokenizer provenance. Conditional intermediate-step diagnostics remain not applicable to the current one-shot profiles.
- Compare result views, eligible public comparisons, exports, and submission figures against the same scorer outputs and comparison identity. Check sample counts, trial spread, incomplete results, and unavailable values.
- Confirm Next.js/shadcn/ui chart delivery in module 09, including F1/depth and class-recall curves, confusion heatmaps, and applicable usage/reliability views. Review recorded `/frontend-design` and `/unslop` passes, browser screenshots, keyboard access, responsive behavior, and missing-value gaps.
- Confirm methodology and submission claims identify adaptation boundaries, retain accuracy alongside macro-F1, and contain no fabricated model results, hidden reasoning, or invented usage/cost values.
- Record actual omissions and return defects to their owner. Repeat only affected verification after a fix; successful earlier checks do not need routine repetition.

## Deliverables and Completion Criteria

Write `docs/handoffs/13-f1-metrics-and-final-reporting.md` recording the audited scorer/profile/suite versions, upstream handoffs, report and package locations, exact verification commands/results, limitations, and final verdict. Completion requires every applicable requirement above to have evidence; unsupported conditional metrics must be explicitly not applicable.

This is an audit, not an implementation module. A separate implementation plan is needed only if a discovered defect requires a repair; scope that repair to its owner and preserve existing decisions and comparison versions. Final readiness does not imply deployment or submission occurred.
