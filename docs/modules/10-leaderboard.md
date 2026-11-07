# Module 10: Leaderboard

## Status

Dependent

## Type

Product Experience

## Purpose

Provide public model comparisons whose eligibility, comparison boundaries, and evidence can be understood and independently checked.

## Finished Outcome

A public leaderboard presents only eligible, published results under explicit comparison and repeated-run rules. Empty groups have honest empty states. Every ranked result identifies the benchmark configuration, execution identity, and completeness supporting its position.

## Why It Comes Here

Module 03 fixes suites and depth coverage; module 04 fixes scoring; module 08 supplies execution evidence and publication rules. This module applies those outputs to public comparisons and can proceed alongside 09 after its own prerequisites pass.

## Prerequisites

- Completed module 03 handoff with D-04 resolved.
- Completed module 04 handoff with D-05 resolved.
- Completed module 08 handoff with D-09 resolved and preserved execution/identity evidence.

## Build Readiness Gate

Read prerequisite handoffs. Confirm suite identity, comparison profiles, scoring, completeness, visibility, and provider/model evidence. Resolve D-10 before accepting ranked entries. Preserve D-09's access, retention, and publication authority.

## Scope

### Included

Eligibility, comparable groups, repeat-run representation, ties and uncertainty disclosure, honest ranking presentation, evidence access, and public empty states.

### Not Included

New scoring metrics, altered suites, execution, saved-run access policy, publication authority, and account features are outside scope. The leaderboard does not add external or invented runs to populate its initial page.

## Detailed Work

### Comparison identity

Define comparable groups from agreed profiles: benchmark/suite version and instances, depth/class coverage, method, trial counts, generation constraints, and relevant budgets. Preserve the distinctions required by D-03 through D-05.

Display the requested model, connected service, and serving/effective identity when reported, following D-07. Unknown metadata must remain unknown. Decide under D-10 whether missing identity evidence prevents ranking or requires a visible comparison limitation. Do not infer that identical display names prove identical execution.

### Eligibility and completeness

Require platform execution evidence and publication status permitted by D-09. Define the evidence required for eligibility, including accounted-for work, expected trial counts, version identity, and inspectable scoring inputs. Distinguish a complete run containing recorded errors from an interrupted run with missing work, using 08's actual completion contract.

Apply D-05's treatment of unusable answers and execution failures without independently rescoring them. D-10 must decide whether particular error patterns affect eligibility and how they are disclosed. Missing or unverifiable evidence must never become a successful answer, invented score, or complete comparison.

Explain exclusions where the visitor may see the run without exposing private records. Honor publication changes and retention consequences under D-09; a public score must not outlive its required evidence.

### Repeats, ties, and interpretation

Resolve how multiple eligible runs of the same model and comparison profile are represented. Prevent selective best-run presentation from masquerading as the agreed comparison policy. Disclose repeat counts and aggregation when applicable, without changing the metric definitions owned by 04.

Resolve ordering for equal scores and how the agreed spread or uncertainty information is shown. Do not imply a meaningful performance difference solely from incidental display order or tiny differences unsupported by the protocol. Preserve per-depth interpretation and identify which comparisons the evidence can support.

### Public states and evidence

Give visitors enough explanation to identify a comparison group, understand its score, and inspect supporting results permitted by the publication policy. With no eligible entries, show the actual empty state and qualification rules. Failed loading must be distinguishable from no results. Examples, placeholders, and unverified manual values must never appear as measured entries.

## User Experience

Visitors can see which results are comparable, what earned a rank, how repeats and errors were handled, and what evidence remains incomplete. They can read the page without supplying provider credentials.

## Decisions to Resolve

- **D-10**, owned by 10: eligibility, comparable groups, repeat submissions, ties/uncertainty, error eligibility, and disclosure. Ranked publication and module 12 wait for its resolution.

## Technical Plan Required Before Coding

Inspect the repository and create `docs/plans/10-leaderboard.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Do not choose those details in this product document.

## Deliverables

Public comparison behavior, D-10 resolution, checked eligibility/ranking examples, empty-state evidence, and `docs/handoffs/10-leaderboard.md`.

## Completion Criteria

- Every ranked entry is published, eligible, and traceable to retained evidence.
- Incomparable profiles remain distinguishable.
- Repeats, ties, errors, and uncertainty follow recorded policy.
- Empty or failed states contain no invented measurements or leaked private data.

## Validation

Check matching and mismatched profiles, duplicate submissions, ties, repeated runs, missing identity, recorded provider errors, interruption, revoked publication, unavailable evidence, no entries, and loading failure. Independently compare displayed scores and order with D-05 and D-10 examples.

## Implementation Handoff

Record the plan, implemented paths, D-10, exact commands/results, tested environments, limitations, evidence references, and expected comparison outcomes for 12.

## Dependencies and Handoff

Module 12 receives the reproducible public comparison checks and publication boundaries. Module 11 may describe only the eligibility and comparison behavior actually implemented.

## Risks and Open Questions

Provider routing, incomplete metadata, and small trial budgets can weaken comparisons. Preserve the resulting limits even when they make rankings less decisive.
