# Module 08: Run Execution and Results

## Status

Dependent

## Type

Integration

## Purpose

Join frozen tasks, individual model calls, and scoring into complete, inspectable evaluation runs, then test whether actual results support the benchmark's intended signal.

## Finished Outcome

An executable pipeline runs the selected suite and repeated-trial profile, preserves inspectable results under a decided access policy, and records an evidence-backed G-SIGNAL Go or No-go.

## Why It Comes Here

This module joins the generation, scoring, and inference branches. It follows 03, 04, and 07; the interface and leaderboard can then consume actual run evidence instead of invented records.

## Prerequisites

Handoffs from 03, 04, and 07 with resolved D-02 through D-08 as relevant. Obtain frozen suites, score rules, compatible model/provider identity, credential lifecycle, individual-call behavior, and profile budgets. Required provider evidence must pass G-PROVIDERS.

## Build Readiness Gate

Confirm prerequisite contracts agree on instance, trial, response, and outcome identity. Resolve D-09 before saving visitor records. Confirm live-test credentials and an explicit paid-call budget before executing G-SIGNAL; documentation or fixture work authorizes no paid calls. Write the technical plan before coding.

## Scope

### Included

Run lifecycle, repeated-trial coordination, selected multi-step methods, progress evidence, interruption behavior, saved-result inspection, access/publication policy, and G-SIGNAL.

### Not Included

Changing prompts, suites, metrics, or individual-call retries; credential policy ownership (05); interface layout (09); leaderboard eligibility (10); or submission (12).

## Detailed Work

### Execute the complete agreed workload

Bind each run to its actual frozen instances, protocol/profile, trial count, settings, model, and serving provider evidence. Establish expected work and call limits before starting. Execute all required trials and, only where D-03 selected them, the defined multi-step methods. Preserve the relationship between steps and their final answer without changing instructions during a run.

Represent pending, active, completed, failed, and interrupted work consistently. Distinguish logical trials from individual attempts governed by D-08. Retried calls must not silently inflate trials, duplicate outcomes, or exceed the agreed budget. Progress must reflect recorded work and expose failed or unfinished items. Exhausted credentials, provider failures, and incompatible settings cannot become successful completion.

### Preserve and inspect results

Retain enough evidence to reconstruct the task, visible prompt, returned answer, extraction outcome, reference label, score, settings, timing, and available usage. Apply D-06 redaction throughout saved records, errors, and inspection. Do not invent unavailable provider metadata or treat local fixtures as measured model results.

Resolve saved-run access, visibility, retention, explicit publication behavior, and interrupted-record handling in D-09. Explain whether and how a visitor can return to a record and what happens when credentials must be entered again. If continuation is permitted, preserve completed work and identity; if it is not, report that limit clearly. Do not rerun paid work or publish results through an implicit recovery path.

Provide underlying answers and depth/trial breakdowns using 04's policy. Incomplete runs retain visible incompleteness and cannot acquire a complete score or leaderboard eligibility by losing failed records. Public visibility follows D-09; ranking remains subject to D-10.

### Establish G-SIGNAL honestly

First verify the executable pipeline with complete controlled fixtures, including failures. Then freeze the suite/protocol and evaluate an available frontier model under the agreed repeated-trial budget. Record the candidate, availability evidence, actual provider identity, full settings, inputs, outcomes, and reproducibility limits.

Inspect failure transcripts and reference evidence to distinguish mathematical limitations from ambiguous tasks, extraction artifacts, grader defects, and infrastructure failures. Record Go only when the evidence supports a meaningful limitation under the frozen comparison conditions. A model performing well, insufficient trials, or unresolved confounds can produce No-go. Preserve all results; revisions require a new documented suite/protocol version, never selective deletion or weaker grading.

## User Experience

A visitor can follow a real run, understand interrupted or failed work, inspect answers and scores, and access or publish results according to the stated policy. Completion reflects the agreed workload.

## Decisions to Resolve

- **D-09, owner 08:** saved-run access, visibility, retention, explicit publication, and interrupted-record policy. Blocks 09, 10, and 12.
- **G-SIGNAL, owner 08:** evidence-backed Go or No-go. Blocks unsupported failure claims and final hackathon readiness.

## Technical Plan Required Before Coding

Inspect the repository and write `docs/plans/08-run-execution-and-results.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Coordinate overlapping ownership before implementation.

## Deliverables

Executable run pipeline, inspectable saved results, resolved D-09, lifecycle verification, real G-SIGNAL evidence and verdict, and the implementation handoff.

## Completion Criteria

Controlled complete and interrupted runs reconcile expected work, outcomes, and scores. Access and redaction match decisions. G-SIGNAL has a supported verdict; No-go remains a recorded blocker to failure claims and final readiness. Fixture success alone never establishes live model performance.

## Validation

Exercise complete trials, empty workload rejection, mixed failures, rate limits, lost credentials, cancellation between steps, interruption after partial completion, and duplicate completion events. Verify budgets, record access, retention/publication behavior, redaction, and independent score reproduction. Record live provider evidence under authorized limits separately from fixture results.

## Implementation Handoff

Write `docs/handoffs/08-run-execution-and-results.md` with plan/artifact paths, decisions, exact commands/results, tested environments, and limitations. Supply exact run identities, lifecycle meanings, inspection/access rules, complete and interrupted fixtures, authorized live-run evidence, reproducibility inputs, and G-SIGNAL verdict.

## Dependencies and Handoff

09 receives connection-to-results behavior; 10 receives authentic records and publication controls; 12 receives runnable evidence and gate status. Preserve incomplete states, credential boundaries, versions, and paid-call limits.

## Risks and Open Questions

Provider changes may limit reproduction. Frontier-model evidence may not reveal the intended limitation. Neither uncertainty authorizes fabricated scores, retrospective selection, or a claimed gate pass.
