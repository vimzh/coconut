# Module 11 handoff: landing and methodology

## Status and delivered boundary

**Landing and methodology routes are implemented; focused checks, integrated production build and browser checks pass.** Their public explanation matches the implemented visitor journey and ranking policy. This does not imply routed-provider live verification, a mathematical-failure finding or final scientific readiness.

The [technical plan](../plans/11-landing-and-methodology.md) was written before implementation. It records the blank-brief copy diagnosis, design direction, factual boundaries, skill application and ownership. This work used Copywriting, Frontend Design and Unslop for frontend work; Ponytail was not applied. The plan preserves attribution for the adapted Unslop review guidance by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.

## Implemented files and design

- `apps/web/src/app/page.tsx`: replaces the name-only scaffold with the landing explanation, evaluation/leaderboard actions, illustrative labels, the three-step workflow and key/charge/comparison guidance.
- `apps/web/src/app/methodology/page.tsx`: indexed document explaining domains, suites/depth, mathematical certification, trials/settings, scoring populations, uncertainty and retained-run behavior.
- `apps/web/src/components/marketing/curvature-illustration.tsx`: accessible native SVG of `log(1 + exp(x²))` on `[-1,1]`, with a dashed chord and a correctly bounded gap region. It is explicitly illustrative, not a model result. The user-requested follow-up below replaces the original quadratic hero.
- `apps/web/src/components/marketing/curvature-examples.tsx`: shared `x²`, `-x²`, `x³` examples with derivative reasons and an explicit separation from evaluated populations.

The pages reuse the existing `AppShell`, buttons, tables, IBM Plex Sans/Mono and neutral/teal tokens. No shared component, layout, stylesheet, dependency, inference API or neighboring route was rewritten. Components are at module scope; the new pages/components need no client state. The landing's asymmetric hero spends visual emphasis on mathematical content. The document uses a compact section index on wide screens and ordinary reading order on narrow screens.

Spacing, color, icons, copy, type, layout, details, visuals and motion were reviewed in the required order. Existing design tokens were preserved; no decorative icons, gradients, glows, animated effects, fake score previews, testimonials or unsupported superiority claims were added. Actual desktop/mobile screenshots and browser structure checks confirm the restrained design and readable mathematical illustration.

## Claim-to-evidence review

| Public fact | Evidence checked | Restriction retained |
| --- | --- | --- |
| Three labels apply on the exact interval; affine/constant overlap excluded | Mathematical/protocol handoffs and current prompt contract | A sufficient-rule failure is inconclusive; it never proves neither. |
| Teaching examples `x²`, `-x²`, `x³` on `[-1,1]` | Existing exact verifier returned verified convex/concave/neither for the three raw expressions | Explicitly separate illustrations from evaluated suites; one pictured chord is not a global proof. |
| `x³` changes class on `[0,1]` / `[-1,0]` | Existing numerical certifier verified convex/concave; independent derivative `6x` | The whole supplied interval governs the label. |
| Leaf/operation depth and the nested `exp(x²)` example | Existing native certificate reported depth 2 for the independently verified example | Simplification/rebalancing can preserve the function while changing raw depth. |
| Challenge 72 tasks / eight families / 24 groups / depths 3,4,5,6,14 | Retained `challenge-v1.json`, [challenge design](../research/challenge-design-v1.md), D-12 | Every family occupies one depth; no causal depth-difficulty claim. Related variants are grouped, not counted as independent tasks. |
| Separate 27-case smooth and 75-case exact references | Retained smooth/exact artifacts and generator handoffs | Different suite/prompt versions remain distinct comparison populations. Screening remains exploratory. |
| Global interval certification plus independent challenge formulas/identities | Numerical extension handoff, current certifier and independent analytic construction | Trusted arithmetic/rules and unresolved-reference exclusions are stated; no formal-proof or human-review claim. |
| Three fresh trials, one attempt, default 4,096 and explicit 16,384 ceilings | Current protocol profiles, reasoning extension and module 07/08 contracts | Format/effort/budget changes stay separately identified; output ceilings are not actual usage or equal compute. |
| Pooled fixed-three macro-F1 and outcome denominators | Module 04 handoff/current scorer | Unusable model replies lower protocol performance; infrastructure/missing work is separate. Neither alone proves a mathematical failure. |
| Group-preserving uncertainty and stronger failure criteria | Frozen [quality criteria](../research/quality-criteria-v1.md) | Conditional support, fixed-family/exchangeability limits and independent failure review remain explicit. No measured interval, ranking or model-failure result is invented. |
| Visitor key/charges, private seven-day records, separate access code and no paid resumption | Provider/inference handoffs, current run/store/routes and D-09 plan | Server transit is disclosed; no claim that the key goes directly from browser to provider. Remote charges after interruption remain uncertain. |
| OpenAI live evidence; routed providers live-unverified | Module 06/07 handoffs | Controlled software tests/catalog search are not described as live inference permission. |

Required prior-work attribution remains in project/submission provenance documentation. The new application files, comments, rendered page copy and metadata contain no prohibited source names, titles, authors or links. Product methodology uses original wording and the project's own terminology.

## Verification results

- Focused ESLint: `bun run lint src/app/page.tsx src/app/methodology/page.tsx src/components/marketing` from `apps/web` — **pass**.
- No-write TypeScript: `bun run --bun tsc --noEmit --incremental false` from `apps/web` — **pass**. This does not run Next type generation or write `.next`/incremental caches.
- React server-render smoke check: **pass** for both route components. Home produced one `main`, one `h1`, one accessible SVG and the agreed CTA hrefs; methodology produced one `main`, one `h1`, three explanatory tables, section navigation, profile ceilings and the family/depth restriction. The check also required illustration/retention disclosure and rejected prohibited source wording.
- Mathematical checks: exact verifier **3/3 verified**; numerical certifier **3/3 verified** for two cubic domain variants and the nested example. The retained nested certificate actually reported depth **2**.
- Source restriction/effect scan and `git diff --check` — **pass**.

The smoke check rendered the components through `react-dom/server` with `renderToStaticMarkup`; it did not contact the API or manufacture a measured report. No low-value copy snapshot tests were added. No paid provider calls, provider/environment-key reads, image generation, commits or deployment occurred.

Example server-render reproduction from `apps/web`:

```sh
bun -e 'import {createElement} from "react"; import {renderToStaticMarkup} from "react-dom/server"; import Home from "./src/app/page"; import Methodology from "./src/app/methodology/page"; for (const [name, Page] of [["home", Home], ["methodology", Methodology]]) { const html=renderToStaticMarkup(createElement(Page)); if ((html.match(/<main\b/g)??[]).length!==1 || (html.match(/<h1\b/g)??[]).length!==1 || !html.includes("href=\"/evaluate\"") || !html.includes("href=\"/leaderboard\"")) throw Error("Invalid page structure/actions"); console.log(name, Buffer.byteLength(html)); }'
```

## Integration and remaining validation

The primary and secondary CTA hrefs are `/evaluate` and `/leaderboard`; methodology is `/methodology`, with local section anchors. All destinations now exist in the passing production build. The actual production leaderboard, anonymous result, evaluator and methodology routes were opened in the browser; empty/error/404 states and the first complete measured report were inspected separately from illustrative landing content.

The integrated production build passed with Next type generation/build serialized. Actual browser reference: Paseo 0.15.2 / Electron 44.2.0 / Chromium 152.0.7977.76 on macOS. Landing checks at 1440×1000 and 768×1024 found one main, one h1, one accessible SVG, valid local anchors and no document overflow; the narrow 390×844 layout and evaluated destination were also inspected. Methodology checks found its three tables, section links, correct limits and no narrow-screen document overflow. Skip navigation is keyboard accessible. Browser-native 200% zoom and an operating-system reduced-motion toggle are not separately verified; source styles provide visible focus and reduced-motion handling.

Reconcile publication/ranking wording once the final leaderboard handoff lands, and update provider-status or empirical wording only when new retained evidence supports it. Preserve the documented distinction between a useful correctly implemented evaluator and a supported mathematical-failure claim. Missing central evidence continues to govern final readiness; this frontend work supplies no gate override.

## Follow-up: nested hero function and coconut mark

On 8 November 2026, the user requested a more involved landing function and a funny coconut logo. The hero now shows `f(x) = log(1 + exp(x²))` on `[-1,1]`. Its label remains illustrative and separate from measured suites. Curve points, the chord at `x = ±0.8`, endpoint dots, and the gap region are calculated from the same expression; vertical ticks use `y = 324 - 180 f(x)`.

Independent differentiation gives `f''(x) = 2s + 4x²s(1-s)`, where `s = exp(x²)/(1 + exp(x²))`. Since `0 < s < 1`, this is strictly positive. The existing `certifyReference` returned verified convex, operation depth 4, and an eight-cell interval cover; `checkNumericalCertificate` replay passed. Floating-point SVG sampling is only a drawing approximation, not certification.

The original asset `apps/web/public/coconut.svg` is a tilted, grinning coconut with asymmetric eyes and a bent straw. It uses black/white and one brown tone, has a transparent exterior, and was rendered successfully at 40px. `AppShell` and the pitch header use the asset through Next.js Image; the root metadata also selects it as the browser icon. The pitch applies grayscale to preserve its black-and-white palette. Existing wordmarks, routes, components, and public interfaces remain intact.

Verification: frontend lint, type checking, all 58 existing frontend tests, and production build passed. Homepage and pitch were inspected in the browser at 1440×900 and 390×844; logo loading, icon metadata, formula/domain copy, and absence of horizontal overflow were checked. SVG curve/chord geometry was checked against the displayed function. No dependency, backend source, model call, or credential was involved. At that checkpoint, the preview used port 3210; the earlier production process on 3200 had not been interrupted.

## Follow-up: clearer pitch cards and preview on port 3200

The next visual revision on 8 November 2026 gives slide 2 three distinct colored cards with larger graphs on white panels, stronger borders, and aligned explanations. Redundant labels above slide titles and the repeated header tagline were removed. The interval is stated above the cards; chord notation and quantifiers follow them. The cup explanation precedes the formal inequality.

The current local preview runs with `bun run dev` from `apps/web` at `http://localhost:3200/pitch`. The older local production frontend returned 404 for `/pitch`; it and the temporary development preview on 3210 were replaced by this development server. Subsequent frontend edits now update on the default port.

Verification: frontend lint, type checking, build, and all 58 tests passed. All six slides fit at 1280×720 and 1440×900. At 390×844, slides scroll vertically with navigation visible and no horizontal or card overflow. The second slide has three white graph panels, no obsolete small labels, and correct animated tracer positions after the layout change. `GET /pitch` on port 3200 returns 200.

## Follow-up: Helvetica Neue across the website

The user-supplied `helvetica-neue-5.zip` provides the website's new main typeface. Its Roman, Medium, and Bold faces are self-hosted through `next/font/local` in the root layout with weights 400, 500, and 700 and `display: swap`. The global Tailwind sans token uses that font, including the pitch. Existing Georgia math notation and IBM Plex Mono code/numeric styles remain. The replaced IBM Plex Sans imports and dependency were removed.

The three supplied OTF files were converted to WOFF2 with FontTools in an isolated `uv run --no-project --with 'fonttools[woff]'` environment. Their combined size decreased from 1,500,804 to 494,316 bytes. Weight metadata, glyph order, and Unicode character maps were checked against the source files after conversion; no subsetting was applied. The assets are in `apps/web/src/app/fonts/`; font requests stay on the application origin.

Verification: `bun run --filter @coconut/web lint`, `typecheck`, `test` (58 passing), and `build` all passed. `bun install --frozen-lockfile --ignore-scripts` passed with Bun 1.4.4; the lockfile change only removes the replaced font package. Browser checks confirmed all three font faces load and main headings use Helvetica Neue. All six pitch slides fit at 1280×720. At 390×844, pitch navigation remains visible, cards have no horizontal overflow, and the homepage, methodology, evaluator, and leaderboard use the font without document overflow. The pitch's math equations still use Georgia. No browser errors were observed during these checks; no model requests were made.

## Follow-up: landing-page grain

The requested noise texture uses a static, monochrome 160px SVG tile in `apps/web/public/noise.svg`. A landing-only CSS module applies it at 8% opacity with multiply blending through a fixed, viewport-sized pseudo-element. The layer covers the header, cards, graphs, and footer throughout scrolling. `pointer-events: none` preserves interactions, and the existing keyboard skip link stays above the layer. The shared shell interface, page text, graph geometry, and other routes are unchanged. No animation, JavaScript, or dependency was added for the effect.

Verification: frontend lint, type checking, production build, and all 58 existing tests passed. Browser checks at 1440×900 and 390×844 confirmed full viewport coverage at the top and footer, with no horizontal overflow. The SVG decoded with varying grayscale pixels and no color tint. Link hit testing and client navigation to `/evaluate` succeeded; the texture was absent after that navigation. Desktop and mobile screenshots were inspected for legible text and graph detail.

## Follow-up: sage paper and faded corners

The revised landing surface uses a pale sage base, warm ivory fading from all four corners, and a 768px texture combining fine grain with softer, uneven green mottling. The corner fades are background layers behind the content; the static texture still covers the full viewport with pointer events disabled. Landing-scoped color tokens tint the cards, ink, borders, and controls. An optional `surfaceClassName` on `AppShell` applies the theme to its outer surface, including the header and footer, while preserving the existing main-content `className` behavior. Other routes keep their previous colors and surfaces.

Verification: frontend lint, type checking, production build, and all 58 existing tests passed. The updated SVG parses and decodes in the browser. Screenshots at 1440×900 and 390×844 were inspected; no horizontal or card overflow was found, and the texture and corner backgrounds persist through footer scrolling. A browser canvas check of the entire texture tile composited over the sage base found a minimum 4.85:1 contrast for the darker muted-text color. Link hit testing and client navigation to `/evaluate` passed; that route retains its neutral background with no paper texture or corner fades. Copy, mathematical expressions, and graph geometry were not changed.
