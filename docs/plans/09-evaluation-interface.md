# Module 09 technical plan: evaluation interface

## Scope and readiness

Build the visitor journey in the existing `apps/web` Next.js App Router application. The product object is a retained evaluation run, not a compatibility probe. Every score, chart point, outcome count, and download must come from the same retained report/evidence population.

Read before implementation: `docs/idea.md`, the complete module 09 specification, module 04/05/06 handoffs, the installed Next.js 16.4.5 guides for client boundaries/CSS/fonts, and the required frontend-design and unslop skills. Module 06 is complete under `model-selection-v1`; OpenRouter and Hugging Face live-inference gates remain unresolved. The module 07/08 contracts and D-08/D-09 must be checked when their handoffs land before connecting the launch, cancellation, retention, or publication controls. Shared components and the visual foundation can proceed independently; this plan does not claim the integrated journey is already verified.

Assumptions: Coconut remains the public product name; a visitor supplies and pays for each provider operation; keys live only in the current page's memory; there is no account system or automatic publication. The latter must be reconciled against D-09 before saved-result interactions ship. No synthetic score may be presented as measured product performance.

## Design direction and D-11

- **Product:** a workbench for people testing how models classify convexity over explicit domains.
- **Character:** exact, calm, inspectable.
- **World:** mathematical instruments and experiment records; the visible material is an expression, its domain, a measured depth, and the evidence behind a point.
- **Moments:** a wide macro-F1-versus-depth plot, followed by a labeled confusion matrix. All other interface surfaces remain quiet.
- **Signature:** the selected depth in the plot is repeated as a small `depth = …` readout beside the evidence table, linking the overview to individual tasks. It appears only when an actual measured slice is selected.

The initial scaffold has no established palette or components to preserve and no decorative slop to remove. Two candidate layouts were considered: a sequential setup wizard, which simplifies first use but hides experiment settings during inspection; and a workbench with a setup column and a wide evidence area, which keeps the selected experiment visible. Use the workbench on desktop, with the same sections in document order on narrow screens. Keep the first visit focused on connection/setup rather than drawing an empty chart scaffold.

The restrained design spends its visual emphasis on measured data. Revise the generic dashboard default by omitting KPI-card grids, decorative illustrations, speculative sparklines, and a full-height navigation rail. Use a compact horizontal product navigation, a 304px setup column where useful, and one dominant plot with the corresponding table directly below it.

### Tokens

| Role | Value | Use |
| --- | --- | --- |
| Background | `#f7f8f8` | Quiet neutral canvas |
| Surface | `#ffffff` | Panels, inputs, chart fields |
| Raised neutral | `#edf0f1` | Hover/selection surfaces and grid |
| Ink | `#18242a` | Primary text and primary button |
| Secondary | `#526269` | Supporting text; muted labels must retain readable contrast |
| Accent | `#146b73` | Selected controls, focus, primary measured series |

Use `#dce2e4` for borders, `#a43e3a` only for errors, and `#98651f` only for cautions. Class charts may additionally use muted steel `#557389` and ochre `#a46a2a`, with explicit labels and distinct dashes. Avoid assigning meaning through color alone. The heatmap uses one accent hue with count labels rather than a rainbow.

Use IBM Plex Sans 400/500/600 for interface text and restrained 28–36px page titles. Use IBM Plex Mono 400/500 for expression/domain text, chart ticks, exact values, and evidence identifiers. Load fonts from pinned local Fontsource packages so production builds do not fetch external fonts. Body text is 14–16px; secondary text 13–14px; data captions 12px. Use tabular figures, sentence case, and normal tracking below display sizes.

Spacing uses a 4px scale: 8/12px inside controls, 16/24px inside panels, 24/32px page edges, 32/48px between major sections. Controls are 36–40px tall with 8px corners; panels have 12px corners. The desktop plot has at least 320px height and two thirds of the content width. No gradients, glows, glass, bouncing controls, looping animations, or layout animation. Feedback transitions are limited to color/border/opacity and respect reduced motion.

```text
┌ Coconut ───── Evaluate ─ Leaderboard ─ Methodology ─────────────┐
│ Evaluation workbench                        Run state / action │
├──────────────────────┬────────────────────────────────────────┤
│ Provider + credential│ Run identity, completeness, populations │
│ Model + route        │                                        │
│ Suite + profile      │       Macro-F1 versus measured depth    │
│ Workload + consent   │       precise numeric x positions       │
│ Intentional launch   │                                        │
│                      ├────────────────────────────────────────┤
│                      │ Exact depth values / selected evidence │
├──────────────────────┴────────────────────────────────────────┤
│ Class recall / confusion matrix / usage and agreement          │
│ Task, answer, interpretation, validation, execution outcome     │
└───────────────────────────────────────────────────────────────┘
```

D-11 terminology: **Provider**, **Model**, **Serving provider**, **Evaluation suite**, **Answer format**, **Trials**, **Planned requests**, **Check access**, **Check compatibility**, **Start evaluation**, **Request cancellation**, **Disconnect**, **Partial results**, and **Evidence**. Authentication success is “Access checked”; only observed compatible inference supports “Compatibility checked.” Missing metadata says “Unknown” or “Not reported,” never zero. A provisional score stays labeled “Partial results.” Saved-result/publication wording remains conditional on D-09.

Browser reference: current installed Chromium, desktop 1440×1000, tablet 768×1024, and narrow viewport 390×844. Record actual browser/version in the handoff. Verify keyboard-only navigation, 200% zoom, and reduced-motion emulation. These are validation references, not a claim of a completed cross-browser certification. Use browser-native form controls where possible; Tailwind 4 requires modern browsers.

## Architecture and ownership

- Keep the existing `src/` convention and `@/*` alias to `./src/*`.
- `src/components/ui/*`: small shadcn/ui primitives for buttons, inputs, labels, native selects, cards, badges, tabs, tables, and chart composition. Module 09 owns these shared components; module 10 imports them without creating a second chart stack.
- `src/lib/utils.ts`: the standard `cn()` class utility.
- `src/components/app-shell.tsx`: shared navigation/skip link/content shell; accepts page content rather than knowing execution state.
- `src/app/layout.tsx`, `src/app/globals.css`, `postcss.config.mjs`, and `components.json`: root-owned font, CSS/token, and shadcn setup.
- Route-level evaluation state, safe API adapter, reporting data adapter, report panels, and evidence inspection belong in focused modules under `src/components/evaluation/` and `src/lib/`, after module 08 exposes its contract. Keep secrets out of report objects and props sent from server-rendered pages.
- Landing/methodology and leaderboard routes reuse the shell and primitives. They do not own provider or scoring policy.

Only stateful controls/charts require `"use client"`. The shell can remain a server component with an explicit active-page prop. Keep components at module scope. Do not copy API execution/scoring implementations into the browser.

## shadcn/ui setup and compatibility

Checked 8 November 2026 against the official [chart documentation](https://ui.shadcn.com/docs/components/radix/chart), [Next.js installation](https://ui.shadcn.com/docs/installation/next), and [Tailwind 4 / React 19 guidance](https://ui.shadcn.com/docs/tailwind-v4). The chart component now targets Recharts 3. The official `new-york-v4` registry currently pins `recharts@3.8.0`; its peer range accepts React 19, including this repository's React 19.3.0. The installed Next.js 16.4.5 CSS guide prescribes `@tailwindcss/postcss` and a root CSS import. Preserve the pinned Next/React versions.

Copy the required official registry primitives into the established source tree and adapt their `cn` import to `@/lib/utils`; retain their public APIs. Use ordinary named color variables, a fixed minimum chart height, explicit numeric axes, and per-chart `accessibilityLayer`. Replace any generic `transition-all` styling with scoped color transitions. Native select avoids a separate custom select interaction and animation dependency. No table abstraction or form-state library is needed for this scope.

Root-owned exact setup commands, run from `apps/web`:

```sh
bun add --exact class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 lucide-react@1.70.0 radix-ui@1.8.1 recharts@3.8.0 react-is@19.3.0 @fontsource/ibm-plex-sans@5.3.0 @fontsource/ibm-plex-mono@5.3.0
bun add --dev --exact tailwindcss@4.3.5 @tailwindcss/postcss@4.3.5 postcss@8.5.32
```

Use `components.json` style `new-york`, RSC/TSX enabled, icon library `lucide`, Tailwind CSS at `src/app/globals.css`, and aliases `@/components`, `@/components/ui`, `@/lib`, and `@/lib/utils`. Manual registry copying avoids a CLI initialization replacing the scaffold or root-owned styles. For future additions after setup, use the pinned CLI: `bunx shadcn@4.23.0 add <needed-component>` from `apps/web`, inspect its diff, and preserve local interaction/style refinements.

The CSS contract is shadcn's named tokens: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, `--chart-1` through `--chart-5`, and the sans/mono font tokens. Map them through Tailwind 4 `@theme inline`. All authored class names consume these tokens rather than introducing a competing palette.

## Interaction and failure contracts

1. Load the nonsecret provider/model policies. A policy failure blocks dependent paid actions and explains how to retry the read.
2. Keep credential input in current-page memory. Disconnect clears it and aborts active requests. Refresh requires re-entry. Do not use cookies, local/session storage, query strings, analytics, console logging, or saved reports for secrets.
3. Separate anonymous Hugging Face search, metadata selection, access checks, consented compatibility probes, and evaluation launch. Preserve catalog-only/unknown/blocked/failed distinctions and explicit serving routes. No silent model or profile substitution.
4. Show suite/version, measured depth coverage, one-shot reasoning method, three trials, profile/output limits, planned requests, concurrency, retry policy, and charge responsibility before launch. Display no unsupported currency estimate. Disable duplicate launch immediately while the operation is pending.
5. Consume the foreground execution progress and cancellation contract from 08. Planned/active/completed/failed/remaining counts require actual backend evidence. Do not infer ETA or progress from elapsed time. Explain remote-request uncertainty when interruption occurs after dispatch.
6. Preserve completed evidence under D-09, with distinct cancellation-requested, cancellation-settled, partial, failed, missing/expired credential, and unavailable-record states. Do not promise resumption or publication until the backend policy supports it.

## Reporting contract

Use module 04's `pooled-macro-f1-v1` values through module 08 without recomputing a different score in the UI. Preserve comparison identity (suite/protocol/profile/model/provider/settings), report completeness, included/planned counts, unusable outcomes, and each planned depth. Fixed class labels are convex, concave, and neither.

- The headline line plot uses a numeric depth axis and a 0–1 macro-F1 y-axis. Use straight segments with measured-point markers, no interpolation, no smoothing, no connection across null values, and no animated paths. Tooltips show exact retained values, included/planned observations, and eligible trial spread. Selectable series must share the full comparison boundary; labels/line dashes supplement color.
- Per-class recall uses the same depth positions and class color mapping. A labeled confusion matrix places reference labels on rows and predicted labels on columns, including unusable answers. Counts and a clearly named rate denominator stay visible.
- Usage and trial-agreement trends retain units, semantics, and reporting/eligibility counts. Missing token/cost/timing values remain absent. Do not mix billed and estimated cost or currencies. Compact outcome bars have explicit counts and populations; latency p50/p95 identifies eligible/reporting populations.
- Every chart has a readable table built from the same filtered values. Filters preserve comparison boundaries and drive charts/tables/exports together. Downloaded data contains safe evidence only. Individual task inspection shows domain, reference label, validation evidence, returned text, interpreted answer, and final execution outcome.

Empty, pending, failed, partial, unavailable, and not-applicable are separate states. A new visitor gets a useful connection/setup prompt; a failed read gets an actionable error; missing evidence gets an explicit reason. A chart must never fill missing points with zeros or substitute synthetic data.

## Sequenced build and verification

1. **Foundation:** write this plan, install pinned dependencies under root ownership, add tokens and focused shadcn primitives/shell. Check imports and public interfaces with web lint/typecheck/build; no live provider calls.
2. **Journey:** reconcile 07/08 handoffs and D-08/D-09, then implement policies, connection, selection, workload acknowledgement, foreground execution, cancellation, and retained-result access. Verify with native API fixtures for each distinct state and duplicate-launch/cancellation boundaries.
3. **Evidence views:** add the report adapter, central depth plot/table, recall/matrix, usage/agreement, outcome and latency/cost detail, and individual evidence. Verify exact values/nulls/counts against scorer outputs, including unequal depth spacing, unavailable baseline, missing class denominators, partial coverage, and incompatible cost/usage groups.
4. **Refinement and browser verification:** apply unslop in order—spacing, color, icons, copy, type, layout, details, visuals, motion. Inspect at most three deliberate screenshot passes, with wide/narrow views in each pass. Check labels, keyboard focus, table scrolling, tooltip values, selected-series labels, reduced motion, and absence of credential text from visible errors/records.
5. **Handoff:** record final D-11, actual browser/version/viewports, reproducible supported journey, test outcomes, remaining service/deployment gaps, and screenshots in `docs/handoffs/09-evaluation-interface.md`. Coordinate chart reuse with 10 and terminology with 11.

Exact routine commands from repository root:

```sh
bun install --frozen-lockfile
bun run --filter @coconut/web lint
bun run --filter @coconut/web typecheck
bun run --filter @coconut/web build
bun run test
bun run --filter @coconut/api dev
bun run --filter @coconut/web dev
git diff --check
```

Run type generation and production build sequentially because both write `.next` types. Use focused web adapter/behavior tests once those files exist; do not add tests that only mirror trivial primitives. Paid verification is owned by the authorized development testing workstream, with explicit bounded workload/evidence; this foundation work makes no paid calls. No deploy or commit is performed by this component workstream.

### Foundation checkpoint

The shared controls, chart context/tooltips/legends, `cn()` utility, and server-rendered `AppShell` are implemented. The shell accepts `activePage` (`evaluate`, `leaderboard`, or `methodology`), `children`, and an optional content `className`. Navigation uses the corresponding route paths; the home link remains `/`.

The focused ESLint command `bun run lint src/components/ui src/components/app-shell.tsx src/lib/utils.ts` passes. `bun run --bun tsc --noEmit --incremental false` passes against the installed dependencies without writing Next.js generated types or an incremental cache. `git diff --check` passes. Integrated Next.js type generation/build and browser screenshots are coordinated by the main workstream after root CSS/layout setup and route integration; those checks are not claimed by this foundation checkpoint.

## Provider setup component contract

`ProviderSetup` is a controlled client component. Its state contains `provider`, `credential`, `modelId`, nullable `servingProvider`, and `profileId`; `onChange` receives the complete next state. Optional `disabled`, `onSelection`, and `onDisconnect` props let the evaluation workspace coordinate a run. The component owns transient policy/access/search/selection feedback and abort controllers, while the page owns the credential. Disconnect aborts pending operations, clears the credential, and invalidates selection; refresh never restores a key.

The focused `provider-api` client uses `NEXT_PUBLIC_API_ORIGIN` (default loopback port 3201), fixed provider routes, omitted cookies, no-store requests, rejected redirects, bounded JSON reads, and explicit cancellation. Credentials are separate operation arguments and appear only in Authorization for access/selection; anonymous Hugging Face search never receives them. Narrow frontend projections validate the fields rendered by the controls and discard arbitrary diagnostic messages. Unexpected responses produce a fixed actionable error rather than a successful state.

Provider policies supply profile choices and token caps. Explicit reasoning profiles remain visible but unavailable for routed providers; no alternate profile/model/serving route is selected silently. Model search is anonymous, catalog-only and unknown routing stay distinct, metadata lookup makes no inference call, and a separate checkbox plus intentional button is required for a compatibility probe. Targeted lint, a no-write TypeScript check, and fixture-only API-client tests verify this component; no live provider call is part of this workstream.

Provider setup checkpoint: `bun test apps/web/src/lib/provider-api.test.ts` passes 9 fixture-only tests. Focused web ESLint and `bun run --bun tsc --noEmit --incremental false` pass. Parent integration owns the Next.js build and browser checks; these controls have made no live provider/model requests during implementation. `ProviderSelectionResult` is a validated browser projection rather than a saved raw server record; launch must independently resolve its request under the current credential. The parent should handle `onDisconnect` by aborting its own foreground run, in addition to the setup component's operation cancellation and key clearing.

## Reporting component checkpoint

`ResultsDashboard` is a named client component with the exact prop `runs: readonly ReportRun[]`. Root routes adapt retained `{ record, publishedAt }` envelopes with `adaptRunView()` or `adaptRunViews()` from `src/lib/report-adapter.ts`. The adapter checks consumed report shapes, bounded numbers/populations, identities, matrix orientation, and logical-record membership. It is a browser projection, not independent mathematical certification or cryptographic authentication; the backend scorer remains the only metric source.

Focused reporting modules live in `src/components/results/`: the dominant numeric-depth macro-F1 chart/table, class recall and labeled 3×4 confusion matrix, semantic-specific token usage and trial agreement, outcome/resource summaries, and the task/proof/trial inspector. Numeric depths are positioned accurately, curves are linear, nulls stay gaps, animations are disabled, series retain stable styles, and exact tooltips/tables expose counts and descriptive trial spread. The proof inspector includes structural/interval evidence and independent analytic reference data when retained.

Comparison population, selected run, selected series, and depth controls preserve suite/protocol/profile/settings/certification boundaries. They select existing overall/depth report slices rather than recalculating aggregates. Incomplete/unavailable runs are inspected individually, while multiple model curves require complete observed populations; this reporting rule does not establish leaderboard eligibility. Usage field/semantic choices are recorded in filtered JSON exports. Exports include the selected detail run and explicitly selected curve run IDs, contain only validated projection fields, and omit unknown diagnostics/access codes. Cost groups preserve decimal strings, billed/estimated kind, currency, source/date, and coverage.

Fixture-only adapter tests cover exact retained metrics, nonuniform depths/null gaps, class/matrix/outcome populations, separate comparison identities, usage semantics, missing costs, structural/interval/analytic evidence, raw answers, malformed inputs, filtered exports, and unknown diagnostic omission. `bun test apps/web/src/lib/report-adapter.test.ts` passes 10 tests. Focused web lint, `bun run --bun tsc --noEmit --incremental false`, and a fixture-only server-render smoke check pass; the latter renders eight reporting tables with exact source metrics and raw answers. Root integration still owns production build, browser screenshots, actual measured-run viewing, and the complete journey handoff; no paid call or completed-journey claim is made here.

## Refinement provenance

The required unslop design review follows the skill by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed CC BY 4.0. Its principles are adapted here for evidence-backed scientific reporting; this documentation records the attribution, without adding decoration or methodology claims to the application.
