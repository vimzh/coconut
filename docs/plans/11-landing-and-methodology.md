# Module 11 technical plan: landing and methodology

## Scope and readiness

Build the home and methodology routes using the existing `AppShell`, shadcn controls, IBM Plex typography and neutral/teal tokens. Ownership is limited to `apps/web/src/app/page.tsx`, `apps/web/src/app/methodology/page.tsx`, `apps/web/src/components/marketing/`, this plan and the corresponding handoff. Shared layout/styles, other routes, dependencies and API implementations stay under their existing owners.

Read the full module 11 requirements, idea, discovery/inference handoffs, frozen quality criteria, challenge design, module 09 design plan, current shell/controls/styles, and installed Next.js 16.4.5 page/server-component/metadata/link guidance. The idea's implementation-status paragraph is older than the actual run/API work; implemented source and current handoffs determine operational wording. Performance results are pending and cannot supply landing-page claims. OpenRouter/Hugging Face software paths have fixture verification, with live inference still unresolved.

Copywriting diagnosis **A: blank brief**. The existing home route contains only the product name. No product-marketing context file exists in the inspected project. The intended reader evaluates language models; the primary action is `/evaluate`, with `/leaderboard` secondary. Factual proof comes from certified suite artifacts and retained protocol/software evidence, not invented customers, model scores or failure guarantees. The page voice is formal, plain and specific.

## Design direction

- **Product:** evaluate how a selected language model classifies scalar functions on exact intervals.
- **Character:** exact, calm, inspectable.
- **World:** mathematical instruments, function plots and experiment records.
- **Moments:** one native SVG curve/chord illustration; compact formula/interval examples and the actual suite comparison table.
- **Signature:** an explicit interval readout beside each mathematical object, making the domain part of the task rather than a footnote.

Preserve the established six tokens: background `#f7f8f8`, surface `#ffffff`, raised neutral `#edf0f1`, ink `#18242a`, secondary `#526269`, accent `#146b73`. Use existing border/focus variables. IBM Plex Sans carries headings/body; IBM Plex Mono carries expressions, intervals and numerical settings. Hero type is 36–56px, document titles 30–36px, body 16–18px, compact captions 12–14px. Spacing follows the 4px scale, section gaps 48–80px and controls at least 40px tall.

The audit found an empty scaffold, with no existing decorative slop to preserve or remove. Keep the real shell and palette. The non-generic choice is to make a mathematically exact curve/chord construction the hero's main visual. It uses the product's actual subject and needs no generated bitmap. A live result preview can be considered only once retained measured data supports it.

The landing uses an asymmetric text/visual split. The methodology uses a compact section index beside a readable document on wide screens, stacking in reading order on narrow screens. A single reading column would reduce navigation chrome but make long methodological sections harder to locate; the indexed document is the chosen alternative. No animation, gradients, decorative icons, testimonials, model-performance charts or badge grids are needed.

The required Unslop review is applied in order: spacing, color, icons, copy, type, layout, details, visuals and motion. The user expressly authorized autonomous execution, so its optional direction-confirmation pause does not apply. Relevant signs/tokens/visuals/reference guidance was read, and a supplied visual reference was inspected for composition/restraint. Credit: Unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. This documentation preserves attribution; the application receives original subject-specific content.

## Content and evidence contracts

1. **Task/examples:** the mutually exclusive labels apply on a stated interval, with affine/constant overlap excluded. Illustrative `x²`, `-x²`, and `x³` on `[-1,1]` have independent derivative/midpoint arguments and remain clearly separate from evaluated suites. A drawn chord illustrates the definition; one sampled chord is never offered as a global proof.
2. **Suites/depth:** challenge 72 tasks/eight families/24 related parameter groups at depths 3/4/5/6/14; smooth reference 27 at 7/9/11; exact reference 75 at 5/10/20/40/80. Each challenge family occupies one depth, so depth and family cannot be separated. Tracks and versioned settings remain separate populations. Screening is exploratory.
3. **References:** smooth tasks use a complete interval cover and rigorous second-derivative enclosures; neither requires strict signs in both directions. The challenge also retains independently derived formulas/polynomial identities. Exact piecewise tasks use exact arithmetic/composition and strict witnesses. Unsupported or unresolved references receive no ordinary class label. Explain trusted arithmetic/rule limits without claiming formal/human approval.
4. **Execution/scoring:** one task per fresh request, three trials, brief JSON justification and final label; explanations do not override official grades. Pooled fixed-three macro-F1 is primary, with accuracy, class recall, confusion counts and outcome populations. Invalid/refused/truncated model replies remain unsuccessful included outcomes; provider failures, interruptions, cancellation and unattempted work stay separate and yield incomplete evidence.
5. **Settings/uncertainty:** original profiles use 4,096 output tokens and provider-default reasoning/sampling. Explicit-effort profiles use 16,384 output tokens and distinct identities. Token limits are ceilings, not charges or equal-compute guarantees. Trial spread is descriptive; eligible group-preserving resampling remains conditional on its declared support and fixed families. No unsupported model ordering or mathematical-failure claim appears.
6. **Visitor operation/privacy:** visitor keys and charges; searchability differs from executable permission; routed live execution remains unverified. Provider keys pass through the evaluation server for the selected foreground operation and are excluded from saved records. Separate access codes protect private seven-day records. Publication is explicit/reversible. Disconnect/cancellation can leave remote charges uncertain; paid work does not resume after refresh/restart.

## Implementation and verification

1. Write this plan and review the evidence-led copy/claim map before implementation. Check that every number matches the actual artifacts and every CTA matches the agreed route.
2. Add small module-scope marketing components for the exact illustrative SVG and three mathematical examples. Keep page composition server-rendered; introduce no new client state or dependencies. Check illustrative references through the existing verifier and review the SVG's coordinates analytically.
3. Build the two routes with shared shell/buttons/tables, accessible headings/landmarks, keyboard-visible links and mobile stacking. Keep reference/source attribution out of application code, comments, strings and assets.
4. Run focused web ESLint, `bun run --bun tsc --noEmit --incremental false`, server-render smoke checks, reference-wording/claim scans, relative-link checks and `git diff --check`. Do not invoke Next type generation/build concurrently with other frontend work. The coordinator owns integrated production build and browser views at 1440/768/390px.
5. Record exact outcomes and remaining browser/integration/provider/performance limits in `docs/handoffs/11-landing-and-methodology.md`. Link destinations may be implemented concurrently; verify them against the final integrated app before claiming completion.

No paid calls, provider/environment-key reads, deployment or commits belong to this workstream. No low-value snapshot test is added for static copy; the smoke check must instead verify headings, CTA destinations, illustration labeling, supported suite/settings facts, and absence of unsupported/prohibited claims.

## Follow-up: richer illustration and coconut branding

The user requests a more involved homepage function and a funny coconut logo. Replace only the hero illustration with `log(1 + exp(x²))` on `[-1,1]`; introductory teaching examples remain simple. For `s = exp(x²)/(1 + exp(x²))`, independently differentiating gives `f'' = 2s + 4x²s(1-s) > 0`. Check this reference through the existing native certifier and redraw the curve, chord endpoints, gap fill, and axis labels from the same displayed function. Floating-point drawing samples illustrate the certified property; they are not the proof.

Add an original transparent SVG coconut mascot at `apps/web/public/coconut.svg`. Integrate it into `AppShell` and the pitch header using Next.js Image. Keep the existing wordmarks, interfaces, palette, layouts, and navigation. The asset is the playful accent; no animation, gradients, extra dependencies, or generated bitmap is needed. This explicit follow-up authorizes the small shared-header edits excluded from the original module scope.

Verify mathematical certification, rendered curve/label agreement, logo loading and small-size legibility, homepage/pitch desktop and narrow layouts, and frontend lint/type checks/tests/build. Update the module handoff with actual outcomes and commit this cohesive checkpoint under the current repository instructions. This follow-up makes no inference request or measured capability claim.
