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

## Follow-up: model catalog and Geist Mono

The landing page now includes a searchable model table below the hero. Company marks, model names and IDs, catalog membership, deprecated/open-weight labels, and rounded weekly usage figures are visible. Source buttons select all entries, OpenRouter's ten usage leaders, or the OpenAI catalog. The table has a sticky header and bounded scrolling; changing the search or source resets its scroll position. It reuses the existing table and input components and the sage paper theme.

The user selected OpenRouter's current usage ranking and OpenAI's current models including deprecated entries, excluding retired models. The dated snapshot in `apps/web/src/lib/model-directory-data.ts` was checked at **2026-11-08T08:36:43Z**. Its ten [OpenRouter leaders](https://openrouter.ai/rankings) cover **1–7 November 2026 UTC**, ranked by weekly token volume. Counts retain the source's rounded display strings; they are not exact totals or CoconutEval scores. The table visibly links the source, coverage date, and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. The snapshot is static; it does not claim automatic updates.

The [official OpenAI model catalog](https://developers.openai.com/api/docs/models/all) supplies **36 non-retired text/code catalog entries**: 19 listed, 15 deprecated, and two open-weight entries. Image, audio, transcription, realtime, embedding, moderation, and shut-down entries are excluded. These are the catalog's named entries, without expanding separately dated API versions. GPT-6 Luna's memberships are merged, giving **45 unique rows**. Restricted cyber/life-science models, Chat Latest, and open-weight releases remain catalog listings; they do not establish API permission, hosted inference, or evaluation compatibility. Links lead to source model pages; no inference request, credential read, backend endpoint, or fabricated evaluation score was added.

Eight logos are self-hosted under `apps/web/public/companies/`, with their original asset source URLs retained in `modelCompanies`. The files total 253,194 bytes. Assets came from OpenRouter's displayed company marks or the companies' official sites. The compact MiniMax ICO uses unoptimized Next Image rendering. The data attribution does not relicense company marks.

All existing monospace styling now uses self-hosted **Geist Mono**, pinned at `@fontsource/geist-mono@5.3.0` with regular/medium faces. It replaces the previous monospace package and imports; Helvetica Neue and the pitch's serif math notation remain. Font source: [Fontsource](https://fontsource.org/fonts/geist-mono/about). The font-only frozen install passed with Bun 1.4.4, and unrelated lockfile metadata was preserved.

Final verification: frontend lint, type checking, production build, and **61 tests** passed. Three new tests cover source populations/ranks, duplicate membership, deprecated/open-weight inclusion, and searches across company/name/catalog IDs. Browser checks confirmed 45/10/36 source-filter counts, search/empty states, sticky headers, scroll reset, eight decoded company marks, and loaded Geist Mono 400/500 faces. The landing was inspected at 1440×900 and 390×844; the document also had no horizontal overflow at 320px. The table scrolls within its own region. All six pitch slides still fit at 1280×720, with no document/card overflow at 390×844. A fresh navigation had no browser warnings or errors.

## Follow-up: reference-led green and white identity

The user's visual reference now drives a saturated green surface with white typography and much denser grain. The root background uses `#3c704a`, cards use `#315d3e`, and text uses `#fffdf7`. Header, footer, graph labels/curves, table text, controls, and policy labels follow the landing palette. Company marks keep their original colors on light plates. Helvetica Neue and Geist Mono remain in place.

The texture is a deterministic, seamless 192px SVG with frequency 0.9, two noise octaves, fourfold grayscale contrast, and fixed alpha 0.44. It is painted into backgrounds with soft-light blending, underneath the text and graphs. The former fixed overlay and broad mottling are replaced by this denser material; green tonal variation stays within the new palette. Policy-example color variables let that shared component use the landing theme while retaining its original defaults elsewhere. The effect adds no animation or dependency.

Verification: frontend lint, type checking, production build, and all **61 tests** passed. Desktop and mobile screenshots at 1440×900 and 390×844 were inspected. Browser checks confirmed white copy, graph strokes and policy badges, a completed graph trace, footer coverage, all eight logo paths, and no document/filter overflow. The table retains 45/10/36 source-filter counts, with matching, empty, and cleared searches returning 2/0/45 models. The evaluator retains its neutral background, dark text, and no texture. Landing copy, catalog data, and mathematical geometry were not modified by this styling change.

## Follow-up: React Bits Noise and minimal rounding

The user's preference is minimal corner rounding: landing panels now use 4px, controls/logo plates use 3px, and status badges use 2px. Shared policy styles keep their previous defaults outside the landing theme.

The requested `bun x --bun shadcn@latest add @react-bits/Noise-TS-TW` ran successfully from `apps/web` using Bun 1.4.4. It installed `src/components/Noise.tsx` and registered `https://reactbits.dev/r/{name}.json` in `components.json`. The landing now renders that React Bits component with a fixed full-viewport layer, opacity 0.44, contrast 0.9, 192px tiles, and soft-light blending. `fps={0}` keeps the material static. The layer is hidden from accessibility tools and does not receive pointer events. Pure white foreground tokens keep text crisp under the blend. The former SVG asset and its CSS texture references were removed.

The imported component's ref update was moved from render into its existing effect to satisfy the project's React lint rule. Missing canvas support and failed texture encoding now raise explicit errors. Its upstream license is retained in `src/components/Noise.LICENSE.md`, fetched from the [official React Bits repository](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md); the component links that file. No application dependency or package lock change was required.

Verification: frontend lint, type checking, production build, and the current **66-test** frontend suite passed. Browser checks at 1440×900 and 390×844 confirmed a generated blob texture, full viewport/footer coverage, a static grain position, white foregrounds, and the requested corner radii. Table filters still show 45/10/36 models, search/empty/clear states work, and the narrow table scrolls without document overflow. Link hit testing and client navigation to `/evaluate` passed; the noise layer unmounts on that route. No new unit tests were added for this visual change.

## Follow-up: centered serif headings and compact model scores

The initial revision centered the landing hero, with a Georgia/Times serif heading, centered actions, and the illustrative graph below. Landing section and card headings received the same serif treatment. Helvetica Neue remained the body face and Geist Mono the numeric/code face. This checkpoint retained the saturated green surface, React Bits grain, and minimal corner rounding; the later shader revision below supersedes its palette and hero arrangement.

The user initially confirmed **45 model rows and five score columns**. A custom native table replaced the catalog controls and search. Model identity occupies one line with a 14px company mark on a 20px plate; catalog IDs, usage counts, membership badges, and a second name line were removed. The retained lineup snapshot determines the model population. At this checkpoint, models with results in the displayed settings appeared first without a mixed-setting rank, and all 45 rows remained in normal page flow with horizontal table scrolling on narrow screens. Newer explicit instructions in the parallel landing session hide the 15 deprecated models, add run counts, and sort by Standard screening scores; the public evidence snapshot continues to preserve all 45 models.

Columns are Screening Standard, Screening Medium, Screening High, Confirmation High, and Confirmation Max. They display archived pooled macro-F1 multiplied by 100, rounded to one decimal. Each column binds the full suite, population, profile, settings, output cap, concurrency, method, and three-trial workload. Standard uses a 4,096-token output ceiling; the other columns use 16,384. A cell requires a complete report with every planned attempt included and no infrastructure failures. Among matching records, the earliest creation time wins, then the lexicographically smallest run ID. Missing eligible results display `—`, never a fabricated zero. The snapshot preserves screening as exploratory.

`scripts/export-landing-scores.ts` derives the static snapshot from retained published experiment archives. `apps/web/public/landing-scores.json` preserves 181 compact published measurement summaries and full comparison identities, including 53 measurements outside the five displayed columns on 19 lineup models. All four input indices and 181 input records are tracked. Generation validates source hashes and produces the same artifact deterministically. This historical projection does not depend on the live leaderboard endpoint, which serves a different run store. No inference or credential access is involved.

Verification of the initial checkpoint: `bun run --filter @coconut/web lint`, `typecheck`, `test` (**67 passing**), and `build` passed. Four new tests verify full comparison identities, exact scorer values, retained extra settings, deterministic earliest-complete selection, and complete artifact reproduction against archived source hashes. Desktop browser checks at 1440×900 confirmed 45 rows, five score cells per row, populated column counts of 23/23/19/3/3, one-line model names, loaded 14px logos, Helvetica body text, Geist Mono scores, and centered Georgia headings. There were no filters or document overflow; the JSON endpoint returned 200 with all 45 models and 181 measurements. At 390×844 the document had no overflow and the table scrolled horizontally, but newer concurrent UI changes had already reduced the visible population to 30; final mobile appearance belongs to the following revision's checks.

## Shader palette and landing design follow-up

User approved the blue-black/stone direction after requesting Frontend Design and Unslop. This pass uses Unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. The explicitly requested animated Paper shader is retained despite the skill's general preference against decorative gradients. No new noise overlay was added.

- Landing tokens now use blue-black panels (`#18232a`), stone text/actions (`#f4f1e8`), secondary text (`#c8ced0`), and pale blue chart accents (`#a9c6d3`). Policy outcomes use distinct blue and stone tones. Legacy green selection/button/header overrides were removed locally to the landing route.
- The desktop hero pairs the existing copy and mathematical illustration in two columns; mobile stacks them in reading order. Existing section content/order, centered serif navigation, compact score rows, solid table background and absence of row hover effects are preserved.
- The shader retains the supplied colors, shape and parameters, with a neutral dark tint for text contrast. Reduced-motion preference stops its animation and responds to preference changes.
- Verification: web lint, typecheck, library tests and production build passed. Desktop and 390px mobile browser rendering were inspected; mobile DOM check found no page overflow, all six section headings and four navigation links remain present, panels use the expected blue-black surface, and browser logs contain no errors. The browser's full-page capture repeats its viewport rather than accurately stitching the document, so that capture is not evidence of below-fold appearance.

Later explicit UI instructions removed the landing page’s final information section, table notes/source links and shared footer. Those removals are preserved; the earlier six-heading browser observation describes the preceding rendered checkpoint. Detailed methodology and downloadable archive evidence remain available at their routes.

## Methodology design follow-up

Continued the approved Frontend Design and Unslop direction (Unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0). Methodology composes the landing surface class to share the blue-black/stone palette, serif headings, button/nav treatment and reduced-motion-aware shader. Document-specific CSS provides a solid reading surface, constrained paragraph lengths, seven-link sticky desktop index, compact two-column mobile index, and solid tables without row hover fills. Existing component interfaces and technical content remain unchanged.

Verification: web lint, typecheck, library tests and production build passed. Compared the ordered rendered text of paragraphs, all heading levels, cells and table captions before/after: identical. Browser checks at 390px and 1440px found no document overflow; all seven section anchors resolve, all three tables remain, Methodology is the active navigation link, and the desktop index is sticky. Inspected mobile introduction/index and desktop suites/table screenshots. Console contained development/HMR informational messages with no errors. No paid model calls were made.
