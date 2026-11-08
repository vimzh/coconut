# Mini Module 14a: Product Flow Cleanup

## Status and Order

Complete — implemented and locally verified; see the [handoff](../handoffs/14a-product-flow-cleanup.md). The sequence remains **14a → [14b upstream integration](14b-randomized-certified-evaluation.md) → Phase 15 implementation and new Phase 15 model runs**. This presentation and navigation cleanup does not depend on certifying the future deep benchmark.

## Goal

A visitor understands one current benchmark, can inspect its results, and can run that same workload with their own key. The main journey is **understand the task → view current results → inspect an answer → optionally run the benchmark**.

The current default remains `composition-v1`: 27 tasks, 2/4/6 nonlinear stages, three responses per task and 81 requests per model. The future 800-task, single-trial workload belongs to [Phase 15](15-deep-composition-stress-evaluation.md) and must not appear runnable or measured during this cleanup.

## Scoped Changes

| Surface | Required cleanup | Check |
| --- | --- | --- |
| Home | Present the current benchmark and its audited results first. Make **View results** the primary action and **Run this benchmark** the secondary action. Keep one short mathematical explanation/example and remove repeated explanations from the main page. | Both actions reach the matching implemented result/setup; the visible task count, stages, trials and request count agree. |
| Historical results | Remove the older score tables and structural-depth pilots from the UI, per the latest user instruction. Preserve their tracked JSON data and each study's identity, settings and limitations for offline inspection. | Only the current benchmark table is rendered on home; historical JSON remains unchanged and is never pooled with the current benchmark. |
| Evaluation setup | Show the recommended current suite by default. Place the other six suite choices under **Advanced workloads** rather than displaying seven competing choices equally. Preserve selection and make an already selected advanced suite visible in the summary. | Selecting any existing suite still works; the selected suite, workload and charge review always agree. |
| Settings and launch | Keep model/provider, workload, requested reasoning setting, charges, launch and cancellation easy to find. Collapse technical identifiers and secondary configuration details. Preserve private-access saving and interruption guidance. | The visitor knows what will run and what can be charged before approval; moving controls does not change their values or behavior. |
| Results | Make accuracy, correct/total counts and completion easy to read alongside the existing macro-F1. Show wrong labels, unusable responses and service failures distinctly. Put detailed diagnostics/reference certificates behind existing tabs or disclosure controls. | Every metric retains its actual definition and denominator; incomplete reports stay visibly incomplete; task/answer/reference inspection remains reachable. |
| Terminology | Use **nonlinear composition stages** where verified metadata supports that measure; label ordinary AST values **expression-tree depth**. Name tasks, responses, model settings and benchmark versions consistently across home, setup, results and methodology. | Never relabel AST depths 7/13/19 as stage counts; the current benchmark's verified stage counts are 2/4/6. Planned depths through 512 remain documentation targets. |

Keep the existing visual language and component interfaces. Use restrained hierarchy, spacing and concise copy; no new design system, dependencies, decorative visuals, extra wizard or general-purpose configuration framework. If a displayed stage count lacks retained metadata, show the actual AST measure explicitly rather than guessing a conversion.

## Boundaries

Preserve all task artifacts, prompts, reference answers, profiles, three-trial execution, request limits, credentials, saved runs, exports, publication rules and ranking eligibility. This module changes how existing information is presented. It does not delete historical evidence, recompute scores, change the D-05 primary scoring policy, invent prices/results, advertise provider inference as live-verified without evidence, or change a benchmark version's mathematical meaning. The landing-page restriction on prior-work references remains in force; attribution stays in project/submission documentation.

Use existing public/published evidence for the default results view. Keep private transcripts and access codes private. Where a static score summary lacks a public answer-inspection destination, label it as a summary and retain inspection in the authorized run report rather than adding a misleading link.

No paid model calls, new benchmark generation, background execution, resumption, accounts, provider additions, deployment or submission are needed for this cleanup. Keep current operational limitations clear in the relevant flow rather than repeating long warnings across the page.

## Implementation Checkpoints

1. **Map and trim.** Read the [current flow diagram](../graphs/product-flow.svg), [interface module](09-evaluation-interface.md), [landing module](11-landing-and-methodology.md) and actual code. Write a short `docs/plans/14a-product-flow-cleanup.md` with the final page order, disclosures, affected files and exact verification commands. Reuse the current audited composition data. Verification: every visible claim and action maps to current code/evidence.
2. **Simplify the main path.** Update home/results navigation and the default-versus-advanced suite presentation, reusing existing components. Review methodology and README wording only where needed to match the new navigation and current workload. Apply the frontend-design and unslop skills for the actual UI work. Verification: default and advanced selections retain their exact configuration, current results remain reachable and historical data is retained in JSON.
3. **Verify and hand off.** Run affected existing frontend tests plus `bun run --filter @coconut/web lint`, `bun run --filter @coconut/web typecheck` and `bun run --filter @coconut/web build`. Check desktop and narrow mobile layouts in a browser, keyboard/focus behavior, disclosure controls, anchors and result filters. Use fixtures/retained evidence; do not dispatch inference for a navigation check. Record screenshots and actual outcomes in `docs/handoffs/14a-product-flow-cleanup.md`.

Likely ownership is the home page, existing marketing result components, evaluation suite/configuration components, results dashboard, related styles/tests and directly affected wording. Inspect callers before editing; change only files needed for this journey. Backend policy, the 14b generator, mathematical generation and the Phase 15 runner remain outside this mini module.

## Done When

- The home page has one obvious current benchmark and one main results destination; older tables are absent from the UI and their data remains in tracked JSON.
- The default evaluation shows 27 tasks × 3 responses = 81 requests; selecting an advanced workload shows its own actual count and version.
- A visitor can explain what is measured, find the reference behind an answer, distinguish failed answers from service failures, and understand provider charges before launch.
- Composition stages, AST depth, task counts, trials, versions and metric names agree across the touched surfaces; score values and publication boundaries are preserved.
- Mobile/desktop/browser checks and relevant tests, lint, types and build pass or have explicit, explained limitations. The handoff records completion before Module 14b implementation begins; the sequence is 14a → 14b → 15.

The handoff should identify one place for Phase 15 to introduce its new benchmark once implemented; it must not build or promise that future workload as part of the cleanup.
