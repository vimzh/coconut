# Module 09: Evaluation Interface

## Status

Dependent — implemented and locally browser-verified; external-provider limits remain explicit. See the [handoff](../handoffs/09-evaluation-interface.md).

## Type

Product Experience

## Purpose

Turn the completed evaluation capabilities into a clear visitor journey from connecting a provider to inspecting evidence-backed results.

## Finished Outcome

Users can connect their own credentials, select a compatible model, launch an evaluation, follow progress, request cancellation, and inspect complete or incomplete outcomes. Errors and publication choices follow earlier modules' decisions.

## Why It Comes Here

Module 06 establishes searchable, truthful selections; module 08 integrates execution and results. This module makes those capabilities usable in the website. It can proceed alongside 10 after its prerequisites pass.

## Prerequisites

- Completed module 06 handoff and resolved D-07.
- Completed module 08 handoff, including inherited prerequisite evidence and resolved D-09.
- Recorded D-06 and D-08 behavior for credentials, interruption, cancellation, and retries.

## Build Readiness Gate

Read prerequisite handoffs and confirm supported configurations, result states, saved-run access rules, and paid-work limits. Resolve D-11 before interaction and browser validation. Do not promise behavior that execution or retention policies cannot fulfill.

## Scope

### Included

Connection, model search/selection, evaluation setup, workload acknowledgment, execution progress, cancellation, actionable errors, saved-result access, and result/evidence inspection.

### Not Included

Provider credential policy, compatibility rules, execution, scoring, publication policy, leaderboard ranking, and methodological content remain owned elsewhere. Accounts, favorites, unrelated search features, and additional model services are not required.

## Detailed Work

### Connection and model selection

Explain that visitors supply credentials and pay their provider. Keep entered secrets out of public displays, saved transcripts, and diagnostic messages. Reflect the D-06 lifetime and re-entry rules accurately, including when an interrupted run cannot continue without renewed credentials.

Allow Hugging Face model search and supported model selection for all three services. Distinguish no results, failed search, unavailable execution, missing permission, unsupported settings, and unknown compatibility using 06's evidence. A selected model that becomes unavailable must produce a visible path to an explicit permitted change, without silent substitution.

### Setup and acknowledgment

Explain suite/version, depth coverage, reasoning method, trial count, generation settings, and the resulting planned workload using the approved protocol. Show request limits and retry implications. Prices or usage estimates may be presented only when supported by evidence; unavailable cost information must remain clear.

Require an intentional launch after the visitor can understand the chosen workload and provider-charge responsibility. Prevent invalid configuration and accidental duplicate launches. Apply D-09's access, retention, visibility, and publication behavior before users rely on saved results; do not imply automatic publication when the decided policy requires an explicit action.

### Progress, interruption, and errors

Display actual planned, active, completed, failed, and remaining work according to 08. Do not fabricate progress percentages or completion times when their basis is unknown. Explain that stopping a run may leave a remote request uncertain under D-08.

Represent cancellation requested, cancellation settled, partial completion, expired credentials, and terminal failure distinctly where the underlying evidence supports that distinction. Preserve inspectable work already completed under D-09. Recovery actions must follow the recorded policy rather than promising unsupported resumption or automatic retries.

### Results and evidence

Present overall and by-depth results using D-05, alongside model/provider identity, suite/protocol versions, selected settings, trial counts, and completeness. Let users inspect the task and domain, reference label and validation evidence, returned model answer, interpreted answer, and individual execution outcome.

Keep invalid answers and provider failures visible. Avoid presenting partial results as eligible complete comparisons. Publication controls and confirmations must match D-09; leaderboard qualification remains 10's responsibility.

### Reporting interface and charts

Use **Next.js** in `apps/web` and **shadcn/ui** for reporting controls, tables, and chart components. Reuse existing components and styling conventions; add only the components needed by this module. Follow the current [shadcn/ui chart documentation](https://ui.shadcn.com/docs/components/chart) when implementing, and record any required dependency/setup changes in the technical plan.

Apply **`/frontend-design`** to establish a deliberate evaluation-dashboard layout before implementation. Apply **`/unslop`** to refine the implemented interface and review its spacing, palette, typography, copy, chart hierarchy, and interaction details. These skills are required for this module's frontend work. Preserve the project's restrained visual language: clear hierarchy, limited colors, no gradients, glows, decorative blobs, or gratuitous animation.

Make the charts a central part of result inspection:

- A prominent macro-F1-versus-depth line chart, with selectable comparable model/profile series and exact values in tooltips.
- Per-class recall curves and a confusion-matrix heatmap with labeled cells and counts/rates.
- Token-usage and trial-agreement trends by depth, plus compact outcome-distribution bars and latency/cost summaries where evidence exists.

Show units, legends, sample counts, comparison identity, and available trial spread. Plot measured depth positions accurately, preserve missing values as gaps, and avoid smoothing or axes that imply unmeasured performance. Keep class/series colors consistent and distinguish series through labels or line styles as well as color. Filters must preserve comparison boundaries and keep charts, tables, and exports synchronized.

Provide readable tables alongside charts, keyboard-accessible controls, visible focus states, responsive layouts, and reduced-motion support. Empty, loading, failed, incomplete, unavailable, and not-applicable states must be distinguishable. Use real retained results; synthetic fixtures belong only in clearly identified development/test views and must never appear as measured leaderboard results.

Build these charts and reporting views in this module, consuming module 04 calculations through module 08. Coordinate reusable chart components with module 10; module 13 audits the result without rebuilding it.

## User Experience

A visitor can finish the journey without internal implementation knowledge. A restrained interface uses consistent terminology, clear hierarchy, readable feedback, and a documented supported browser/viewport reference.

## Decisions to Resolve

- **D-11**, owned by 09: user-facing terminology, browser/viewport reference, and connection-to-results interaction details. Integrated interface validation and 12 wait for resolution.

## Technical Plan Required Before Coding

Include shadcn/ui setup, shared chart/component ownership with module 10, the `/frontend-design` direction, the `/unslop` refinement pass, and screenshot/browser verification.

Inspect the repository and create `docs/plans/09-evaluation-interface.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Preserve existing component conventions where compatible with the requested journey.

## Deliverables

The usable evaluation journey, resolved D-11, browser verification evidence, error/empty/interruption state coverage, and `docs/handoffs/09-evaluation-interface.md`.

## Completion Criteria

- Reporting views use Next.js and shadcn/ui, include the required charts, and complete `/frontend-design` and `/unslop` passes.
- Users can complete the supported connection-to-results journey.
- Workload, credential lifetime, completeness, and publication behavior are understandable before they matter.
- Every visible progress or score claim agrees with retained evidence.
- Required interactions work in the decided browser and viewport conditions.

## Validation

Verify charts against scorer outputs and corresponding tables, including filters, tooltips, missing-value gaps, empty/error states, narrow viewports, keyboard interaction, and reduced motion. Capture and inspect rendered screenshots after the design and refinement passes.

Exercise normal completion, missing/revoked credentials, empty and failed search, unsupported selections, invalid setup, duplicate launch, cancellation, interruption, provider failure, partial results, and unavailable saved records. Check keyboard access, narrow-view readability, and credential absence in visible errors and records. Paid runs need an authorized budget.

## Implementation Handoff

Record the plan, implemented paths, D-11, exact commands/results, tested environments and browser/viewport references, known limitations, and reproducible journey evidence for 12.

## Dependencies and Handoff

Module 12 receives the verified visitor journey and state coverage. Coordinate result/publication terminology with 10 and methodology language with 11 without taking over their policies.

## Risks and Open Questions

Friendly wording can overpromise recovery, access, costs, or cancellation. Validate each such statement against the responsible module's actual behavior.
