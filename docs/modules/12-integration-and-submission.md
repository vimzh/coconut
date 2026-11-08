# Module 12: Integration and Submission

## Status

Dependent — local product integration in progress. Deployment and hackathon submission/material preparation are excluded by the current user instruction; the historical entry requirements below remain contextual. See the [current plan](../plans/12-integration-and-submission.md).

## Type

Readiness

## Purpose

Verify the complete project in a clean environment and prepare accurate, reproducible hackathon materials. This module owns final evidence and packaging, not unfinished mathematical or product behavior.

## Finished Outcome

A runnable, verified project with documented launch steps, complete evidence for the visitor journey, honest benchmark findings, and prepared submission materials. Actual entry submission and agreement acceptance require separate user authorization.

## Why It Comes Here

Readiness depends on the evaluation interface, leaderboard, and landing page being complete and on their transitive engine and provider prerequisites. A collection of isolated module checks does not establish that the integrated journey works.

## Prerequisites

- Completed [09 Evaluation interface](09-evaluation-interface.md), [10 Leaderboard](10-leaderboard.md), and [11 Landing and methodology](11-landing-and-methodology.md) with all prerequisite handoffs.
- Go verdicts for G-MATH, every promised service under G-PROVIDERS, and G-SIGNAL.
- Completed [14 Benchmark quality and pitfall remediation](14-benchmark-quality-and-pitfall-remediation.md), resolved D-12, and G-QUALITY Go with critical defects repaired and affected artifacts revalidated. Numbering does not place this gate after packaging.
- Resolved D-01 through D-11 where required by the implemented product.
- Current [hackathon.md](../../hackathon.md) and access to the authenticated challenge instructions before packaging is finalized.

## Build Readiness Gate

Read every handoff and inspect the actual repository state. Confirm that decisions, benchmark versions, and user-visible descriptions agree. Inventory missing evidence before beginning the final verification plan. If a promised capability remains unproven, return the blocker to its owner and keep readiness open.

Write this module's technical plan before making integration changes. Live-provider verification requires controlled credentials and an authorized budget. Do not copy secrets into reports or submission files.

## Scope

### Included

- Clean setup, launch, required checks, and end-to-end verification.
- Cross-module consistency, credential boundaries, and truthful public results.
- Reproducibility of the main reported benchmark finding.
- Prepared code archive, README, results/transcripts, description, and video materials.
- Source provenance, permitted reuse, and actual event-format verification.

### Not Included

- Expanding the benchmark into another domain, adding provider services, or introducing unrelated user features.
- Quietly fixing an upstream no-go by weakening its acceptance rules.
- Accepting legal agreements, uploading the entry, or publishing the website without the corresponding authorization.

## Detailed Work

### Verify the integrated user journey

Start from documented installation and launch steps in a clean supported environment. Confirm that a visitor can read the methodology, connect each promised service with their own credentials, search for a runnable model, understand the planned workload, start the evaluation, follow progress, and inspect correct results.

Exercise the decided saved-run access and publication behavior. Check that publishing creates an eligible leaderboard entry only when the decided evidence requirements pass. Confirm that another visitor can inspect the allowed public comparison without gaining access to private runs or credentials.

### Reproduce the scientific result

Use the frozen suite, protocol, prompt/extractor/scorer versions, model identity, and trial configuration recorded by module 08. Independently recalculate the reported metrics and inspect the failure examples used to explain the limitation. Account for every planned trial and retained error.

Document expected variation rather than promising identical stochastic answers. Preserve both successful and failed observations. If the evidence cannot support the main finding, reopen G-SIGNAL with its owner instead of writing a stronger claim.

### Check operational and public-content boundaries

Verify interruption, timeout, cancellation, revoked access, unsupported capability, empty leaderboard, and provider failure paths. Check credential redaction throughout the integrated flow and any exported artifacts. Confirm that missing metadata remains unknown rather than becoming a fabricated value.

Inspect the landing page, visible methodology, result screens, and leaderboard against the actual protocol. The landing page must not mention or link the paper. Internal source provenance and submission materials must still identify adapted work and explain the project's original implementation and findings.

### Prepare the entry

Recheck the authenticated challenge instructions, agreement, and current official requirements; record what was verified and any remaining access limitation. The researched baseline in `hackathon.md` calls for one ZIP up to 50 MB, a short description, and an accessible video link up to five minutes. Verify the actual size limit and contents before declaring the package ready.

Include code, required small supporting files, launch/reproduction instructions, dependency and configuration details, and permitted results/transcripts. Exclude credentials, private data, videos, installed dependencies, and disposable build material. Inspect the archive after extraction in a clean location.

Prepare the README's task overview, grading validation, model/run settings, uncertainty, cost/runtime evidence, data licenses, prior-work disclosure, human review, and main finding. Prepare the description and walkthrough against measured evidence. If no recording exists, record that as unfinished; a script is not a completed video.

## User Experience

The intended flow works from first visit through result inspection and permitted leaderboard publication. The project can be launched and its main finding understood and reproduced without relying on undocumented developer state.

## Decisions to Resolve

No new product decisions are owned here. Verify all upstream decisions and current submission requirements. Escalate a required scope change to its owner and the user rather than introducing it during final packaging.

## Technical Plan Required Before Coding

Write `docs/plans/12-integration-and-submission.md` after repository inspection. Identify affected files, interfaces, necessary integration changes, dependencies, failure handling, test environments, and package preparation. Include exact build, lint, type-check, test, launch, and end-to-end verification commands, with authorized live-call limits where relevant.

## Deliverables

- Runnable artifact and clean setup/reproduction instructions.
- Integrated verification report and independent metric checks.
- Inspected submission archive, description, README, and completed video/link or an explicit remaining blocker.
- `docs/handoffs/12-integration-and-submission.md` with final readiness status.

## Completion Criteria

- All promised providers and the complete journey have actual verification evidence.
- All critical gates pass and required decisions are recorded.
- Relevant build, lint, type-check, and test checks have actual outcomes; unresolved failures block readiness or receive an explicit scoped explanation.
- Public claims and eligibility match retained evidence and policies.
- The archive opens, meets the verified limit, and reproduces the documented setup without secrets or private data.
- Required submission materials are complete and provenance is accurate.
- Unperformed submission or deployment actions are reported as unperformed, not implied by package readiness.

## Validation

Cover the ordinary journey, empty and incompatible catalogs, invalid/revoked credentials, insufficient credit, interrupted runs, invalid model answers, and incomplete ranking attempts. Verify browser/viewport references from D-11 and access/visibility from D-09. Inspect final rendered content and extracted archive contents. Recalculate the main reported metrics from retained outcomes.

## Implementation Handoff

Record the plan path, implemented artifacts, gate/decision status, exact commands and outcomes, tested environments, reproduction evidence, package and video locations, verified event requirements, known limitations, and remaining user actions. Include no credential material.

## Dependencies and Handoff

[Module 13](13-f1-metrics-and-final-reporting.md) audits the completed reporting and submission evidence after this module. Metrics and charts must already be implemented by modules 04 and 09; include them in this integration pass and the prepared artifacts. Module 13 introduces no second implementation or routine repackaging pass.

The user receives a reviewable runnable project and prepared entry materials. Any remaining blocked check, missing recording, live-service limitation, or authenticated-instruction uncertainty must be stated precisely. Actual submission and any separately authorized publication are later actions.

## Risks and Open Questions

Provider behavior, stochastic variation, event instructions, and reuse permissions may invalidate earlier assumptions. The recorded deadline in `hackathon.md` constrains delivery but does not justify skipping correctness, provenance, or credential checks. If the work cannot meet the current requirements, report the incomplete state honestly.
