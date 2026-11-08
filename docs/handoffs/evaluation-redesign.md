# Evaluation workspace redesign

The evaluation page now leads with the tests, followed by model connection and an explicit workload review. The implementation preserves the existing execution controller, provider client, scoring adapter, comparison groups, and private-run operations.

## Experience

- New evaluation: choose one of six certified suites, inspect its real test expressions and domains, search or filter by measured depth, then choose a provider/model and approve the displayed request budget.
- Visuals: interactive illustrative convex/concave/neither curves, actual depth coverage with test counts, a persistent workload summary, and retained performance charts.
- Runs and analysis: foreground progress/cancellation, a prominent save-access action, and Overview / Test cases / Diagnostics views. Settled execution detail is collapsible so scores lead.
- Test cases: search retained tasks, filter incorrect/unusable/incomplete outcomes, and inspect certificates and each trial’s raw answer. Service failures remain distinct from model errors.
- Optional provider access/metadata/paid compatibility checks remain available under a disclosure. Credentials stay in page memory and paid operations still require explicit consent.

## Preview contract

`bun scripts/export-suite-previews.ts` regenerates `apps/web/public/suite-previews.json` from all six verified version-1 catalog populations. The artifact contains 273 task IDs, canonical expressions, domains, measured depths, and families. Only aggregate class counts are public in the preview; per-task reference answers, certificates, prompts, provider details, and run data are excluded.

The browser checks the catalog suite identity, case count, and depths before displaying a preview. A mismatch produces an explicit unavailable message. Other answer profiles receive separate verified run identities at preparation; the review explains this distinction. Preview data is not included in provider requests. Custom task authoring and arbitrary suite generation remain outside this frontend change.

## Verification

- Web lint, TypeScript/route generation, and production build passed.
- All 70 web tests passed, including three new contract tests comparing every preview task and aggregate class count with the retained source populations, rejecting stale catalog identities, and preventing extra public fields.
- Production browser exercised test-suite selection, model/review flow, charge gating, an isolated 27-trial completed evaluation, outcome filtering and raw-answer inspection, diagnostics, and 390px/1440px layouts without page overflow. The fixture used mocked inference and an in-memory store; no paid call or shared run-store write occurred. The completed fixture retained 21 correct, four incorrect, and two truncated outcomes, with accuracy 21/27 and displayed macro-F1 0.810.
- Cancellation settled with four cancelled trials, 23 unattempted trials, zero returned model outcomes, unavailable scores, and publication disabled. Reopening this private fixture required its ID/access code and no provider credential. Starting another run selects the new retained result rather than leaving the previous report selected.
- Final setup and result layouts were checked at 390px and 1440px. No production runtime errors were observed. Chromium emitted an unused CSS-preload warning for a prefetched navigation route; this framework prefetch behavior is outside the evaluation redesign.

Live provider inference, billing, and hosted deployment were not re-tested for this UI change. Earlier development-only HMR errors during intermediate file writes do not describe the final production build.
