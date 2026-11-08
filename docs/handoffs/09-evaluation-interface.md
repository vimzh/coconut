# Evaluation interface QA handoff

## Implemented contract and D-11

The [implementation plan](../plans/09-evaluation-interface.md) defines the delivered Next.js/shadcn interface. Provider controls separate anonymous search, access, metadata, optional charged compatibility and launch. The workbench displays actual workload/profile limits, resets charge consent, synchronously prevents duplicate launch and preserves a separate private-run handle. The shared dashboard projects retained scorer values into numeric-depth F1 and class-recall curves, labeled confusion counts, usage/agreement, outcome/resource summaries and task/proof/raw-trial inspection. Filters drive tables and exports together; missing values remain missing.

**D-11 is resolved for local reference testing:** clear evaluation/task/trial terminology; supported browser reference Chromium 152.0.7977.76 in Paseo 0.15.2 / Electron 44.2.0 on macOS; desktop 1280×800, wide 1440×1000, tablet 768×1024 and narrow 390×844 checks across the interface. Other browser engines are not claimed as verified. Keyboard/focus, explicit consent, private access after refresh and interruption without resumption follow the plan. Native browser 200% zoom and OS reduced-motion overrides remain unverified.

Frontend Design, Copywriting and Unslop informed the existing restrained typography, neutral/teal palette and layout. Adapted Unslop guidance attribution is recorded in the plan: Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0. Backend Ponytail guidance was not applied to frontend work.

## Verification

The final pre-extension integrated checkpoint passed **648 API tests / 24,459 assertions**, **57 frontend tests**, root lint/type checks, API bundle, Next production build, **29 native Python tests**, Ruff and frozen dependency installation. Provider access remains separately classified: OpenAI has live API evidence; OpenRouter and Hugging Face have fixture/catalog evidence without live inference verification.

Independent arithmetic and browser projection audits covered all 212 original retained RunViews, 652 depth slices and 1,956 filtered exports. Two complete actual published high-effort runs were checked in the production public dashboard: exact values/counts, profile/settings identity, descriptive depth filters, reasoning-token coverage and raw answers. See the [reporting audit](../research/reporting-audit-v1.md) and [leaderboard handoff](10-leaderboard.md). A 65,536-versus-131,072 retained-reply limit mismatch and mobile outcome-grid overflow were repaired and verified; the latter now fits the 390px viewport. These checks do not imply a model-failure finding.

## Browser journey evidence

Browser verification on 2026-11-08 covered the local production web build on
port 3200 and read-only API configuration from port 3201.

- Desktop and mobile workbench layouts had no observed horizontal overflow.
- The page exposes its work population, limits, privacy rule, and explicit
  charge approval before a run can start.
- Keyboard interaction reached the skip link, charge approval, Start evaluation,
  and cancellation.
- An in-memory, port-3203 fixture was used only in one browser tab to test the
  browser-facing run protocol. It generated a 3-case, 9-trial evaluation with a
  fake cancellable inference client and a dummy credential; it did not use the
  normal data store, provider API, provider key, public results, or paid calls.
- In that exercise, launch changed the UI to running and disabled repeat start.
  Cancellation settled to a retained partial record (4 cancelled, 5
  unattempted), with unavailable scores, visible evidence, and publication
  disabled. No console errors were observed.

See `docs/research/browser-verification-v1.md` for scope, evidence, and
remaining verification gaps. Reduced-motion preference behavior and live
provider operations remain unverified by browser testing.
