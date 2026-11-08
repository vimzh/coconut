# CoconutEval pitch

Five slides for a short live presentation. The browser deck is at `/pitch`; use Left/Right, Page Up/Page Down, Home/End, or the bottom-right arrow buttons. On narrow screens, scroll within a slide. This is a web presentation, not a `.pptx` export.

The copy below paraphrases the project documentation. Mathematical examples are illustrative and separate from scored tasks. The six use cases describe applications and analogies, not measured transfer to optimization or agent workflows.

## Slide 1 — CoconutEval

**An evaluation of mathematical reasoning**

**CoconutEval.**

How well does a language model understand the shape of a function?

`f(x) = x²`, with `x ∈ [−1, 1]`

Classify the function as convex, concave, or neither on the given interval.

### Speaker notes

We give a model a mathematical expression and ask it to classify the function over a specified interval. The opening example is convex: its second derivative is 2 throughout the interval. The curve-and-chord drawing introduces the shape intuition; the drawing itself is not the proof.

The audience is hackathon judges and people evaluating language models. The goal is to explain what CoconutEval measures and lead into a live evaluation or retained report. Present this as a narrow, inspectable measurement rather than a test of general intelligence.

## Slide 2 — First, the shapes

**Convex, concave, or neither.**

A chord is a straight line segment joining two points on a graph.

For a function `f: D → ℝ`, with `D = [−1, 1]`, take any `x, y ∈ D` and `t ∈ [0, 1]`. Let `z = tx + (1 − t)y`.

| Answer | Illustrative function | Standard definition on D | Graph interpretation (paraphrase) |
| --- | --- | --- | --- |
| Convex | `f(x) = x²` | `f(z) ≤ t f(x) + (1 − t)f(y)` for every permitted x, y and t. | The graph lies on or below every chord. |
| Concave | `f(x) = −x²` | `f(z) ≥ t f(x) + (1 − t)f(y)` for every permitted x, y and t. | The graph lies on or above every chord. |
| Neither | `f(x) = x³` | Neither convex nor concave on D. | Some chords lie above the graph; others lie below it. |

Show a labeled graph beside each example. Solid lines show the functions. Dashed lines join actual graph points: `(-1, 1)` to `(1, 1)` for x²; `(-1, -1)` to `(1, -1)` for −x²; and `(-1, -1)` to `(0, 0)` and `(0, 0)` to `(1, 1)` for x³.

Each inequality must hold for every x, y and t above. Affine functions satisfy both; this evaluation excludes them.

### Speaker notes

Begin with the drawings before introducing nested expressions. The formulas use the standard definitions, checked against [Stanford’s convex-functions lecture notes, slide 3–2](https://see.stanford.edu/materials/lsocoee364a/03ConvexFunctions.pdf#page=2) and the [official CVXPY curvature documentation](https://www.cvxpy.org/tutorial/dcp/index.html#curvature). The graph descriptions are paraphrases. The general definition requires a convex domain; the displayed interval D satisfies that requirement. The condition must hold for every permitted pair and weight, not just the selected chords in the drawings.

Here z is a point between x and y. The right-hand side is the height of their chord at z. Convexity compares the function’s height with that chord height; concavity reverses the inequality. This is the definition, not a requirement to look like a bowl or dome.

Nested expressions combine operations whose signs, ranges, and domains affect the final answer. Our task requires a label for the whole supplied interval. For example, `x³` is neither on `[-1, 1]`, but convex on `[0, 1]`.

The three displayed examples have second derivatives 2, −2, and 6x respectively. Affine and constant functions can be both convex and concave, so the benchmark excludes their overlapping labels. Certified global evidence establishes convex/concave cases; evidence against both properties establishes neither. Failure of a sufficient composition rule alone does not prove neither.

The platform includes separately versioned task populations. Preserve their suite identities and settings when showing results. Operation depth is recorded, but it varies with family and size and is not an isolated measure of mathematical difficulty.

## Slide 3 — Why it matters

**One missed condition can change the answer.**

### Three technical applications in mathematical optimization

1. **Optimal control:** check whether a control cost and its constraints form a convex problem.
2. **Inverse problems:** check whether adding a regularizer keeps a data-fitting objective convex.
3. **Resource allocation:** check costs and capacity constraints before choosing a convex solver.

### Hypothetical agent scenarios

1. **A travel-planning agent:** a traveller wants a cheaper flight to Delhi, arriving before 6 pm, with at least 90 minutes between flights. A route arrives at 5 pm but has a 45-minute layover. Booking it would break the connection rule.
2. **A customer-support agent:** a store allows refund requests within 30 days for unopened items or items that arrived damaged. A customer reports a damaged delivery on day 12, after opening the box. Rejecting it solely because the box was opened would miss the exception.
3. **A coding agent:** a developer asks an agent to let managers export invoices, alongside admins. Both roles must belong to the invoice’s workspace. Adding ‘or manager’ outside that check could admit a manager from another workspace.

**These examples explain why conditions matter. CoconutEval tests function classification. We have not tested whether its scores predict success in these workflows.**

### Speaker notes

Convexity is relevant when deciding whether an optimization formulation has the structure required by a selected method. The entire formulation matters, including its feasible region; classifying a scalar objective does not validate a complete control, inverse-problem, or allocation system. These examples name why curvature knowledge is useful, not systems CoconutEval has tested.

The nontechnical examples make the dependency pattern familiar: an early condition must still hold after later steps are combined. They are proposed illustrations for this pitch. There is no retained evidence that CoconutEval predicts performance in travel planning, customer support, or coding agents.

These scenarios use hypothetical rules and numbers. In the travel example, meeting the price and arrival goals does not satisfy the connection requirement. In the refund example, the damage exception overrides the unopened-item condition within the 30-day window. In the coding example, workspace membership must cover both roles: `same workspace AND (admin OR manager)`.

## Slide 4 — How it works

**Verify, ask, and score.**

1. **Verify the reference answer:** generate a function and interval. Verify its label before adding it to the evaluation.
2. **Ask the model:** send the expression and interval in three fresh requests. Keep the reference answer and proof out of the prompt.
3. **Score and inspect the answers:** report macro-F1 and each class’s recall. Track unusable replies and provider failures separately. Read the wrong answers.

### Where the minus sign sits matters

| Expression on `[-1, 1]` | Reference label |
| --- | --- |
| `−(x − 1)²` | Concave |
| `(−(x − 1))²` | Convex |

Draw both functions beside their expressions, with axes and dashed chords. The first squares the term, then negates it. The second negates the term, then squares it.

Examples on `[-1, 1]`. These are not measured model errors.

**The evidence so far:** all labels were correct in four reviewed frontier-model confirmation runs. Some exploratory runs with older or non-frontier models had errors. We have not established a frontier-model limitation.

### Speaker notes

The sign examples have second derivatives −2 and 2. They demonstrate what a scope error would change. Their labels follow from those derivatives; the sign of a function’s values alone does not establish curvature. Do not describe them as actual failed model transcripts.

Use the retained [replication review](research/openai-replication-review-v1.md) as the evidence source. Its documented checkpoint records four completed high/max confirmation cells for the two predeclared frontier identities, each with 216 correct labels out of 216 and macro-F1 1. The valid wrong labels occurred in a smaller exploratory screen using older/non-frontier settings. Those observations do not establish that frontier models fail this task.

The review separates mathematical mistakes, expression/domain misreadings, answer-label inconsistencies, formatting issues, unresolved cases, and truncations. Do not collapse them into a single explanation such as “models forget indentation.” Mathematical operator scope is directly relevant here; code indentation and general agent reliability are separate claims needing separate experiments. A correct label also does not establish a correct explanation.

If newer results are used during the presentation, update this document and the deck from a retained, reviewed result together. The [interior experiment plan](research/interior-experiment-v1.md) alone is not model-performance evidence. The [first matrix reconciliation](research/experiment-reconciliation-v1.md) documents infrastructure failures and incomplete prefixes; those are not mathematical model failures.

## Slide 5 — Reading the score

**What does the score tell us?**

Macro-F1 averages the F1 scores for convex, concave, and neither. A higher value means better classification on the tested tasks.

### High score: verify these three things

1. **All three classes are handled well:** check that recall is high for convex, concave, and neither.
2. **The interval is used correctly:** check answers to tasks that depend on the interval’s endpoints.
3. **The expression is read correctly:** check explanations for correct use of parentheses and minus signs.

### Low score: check these three causes

1. **One class is often missed:** check whether the model keeps choosing the same label.
2. **The expression or interval is misread:** look for a missed restriction or a misplaced minus sign.
3. **The reply cannot be scored as a label:** check for invalid JSON or a reply cut short by its output limit.

Read the answers, per-class recall, and variation across trials. A high score alone does not prove correct reasoning or reliable agent behavior.

**Explore CoconutEval** → `/evaluate`

### Speaker notes

The examples describe behaviors to inspect; an aggregate F1 score alone does not prove that a model used a particular reasoning process or handled an example absent from its suite. Macro-F1 averages the three class F1 scores equally. Inspect support and per-class recall to see whether a high aggregate hides weaknesses in a particular class.

Our scorer counts unusable returned answers against the corresponding reference class. Infrastructure errors and unattempted work are separate and can leave reports provisional or unavailable. A low score therefore requires checking answer validity and budget exhaustion before attributing failures to mathematics. Three fresh trials describe repeat-request variation, not three new mathematical problems. See the [scoring handoff](handoffs/04-scoring-and-depth-analysis.md).

## Design and implementation brief

- White `#ffffff` canvas; black `#111111` text; gray `#585858` secondary type, `#dedede` rules, and `#ededed` coordinate grid.
- Existing IBM Plex Sans for the narrative and IBM Plex Mono for labels/counts. System Georgia/Times for mathematical expressions. No new font or presentation dependency.
- Draw each teaching function beside its explanation, including both minus-sign examples. The shared SVG component samples the actual expressions on the stated interval, shows axes and selected chords, and provides a specific accessible graph description. The homepage and methodology use the same definition examples.
- The shared coconut mascot is `apps/web/public/coconut.svg`. The pitch header renders it in grayscale to keep the deck monochrome; the main site uses its original brown shell.
- Keep five slides, a centered opening, persistent bottom-right arrows, a slide counter, and keyboard navigation. Clamp navigation at the first and last slides. Keep the presentation separate from the workbench layout.
- Animate the teaching graphs: a point traces each curve as it draws, followed by the dashed chord, endpoints, and any shaded region or annotation. Each sequence finishes within 2.2 seconds, then stays still. Replay when a graph returns after leaving the viewport or a pitch slide opens again. Axes and definitions stay in place. Reduced-motion settings show the complete static plot immediately.
- Preserve keyboard focus, readable narrow-screen layouts, and scrolling for dense slides. Use the existing colors and typography for motion; add no animation dependency.

## Evidence and attribution

This pitch paraphrases [the project idea](idea.md), [the scoring contract](handoffs/04-scoring-and-depth-analysis.md), [the challenge design](research/challenge-design-v1.md), [the quality criteria](research/quality-criteria-v1.md), and [the retained replication review](research/openai-replication-review-v1.md). It makes no numerical claim beyond the reviewed checkpoint identified above. Prior-work provenance remains in the project and submission documentation; this pitch does not replace it.

## Verification

Verified on 8 November 2026:

- `bun run --filter @coconut/web lint`: passed.
- `bun run --filter @coconut/web typecheck`: passed.
- `bun run --filter @coconut/web test`: 58 tests passed.
- `bun run --filter @coconut/web build`: passed; `/pitch` is statically generated.
- Browser checks: all five slides at 1440×900, 1280×720, and 390×844; previous/next buttons, Left/Right boundaries, Home/End, Page Up/Page Down, and scroll reset. Dense slides scroll within the mobile viewport while controls remain available. Screenshots were inspected and the console had no application errors.
- The standard-definition update adds the quantified inequalities and a shared graph component for five teaching functions. Independent SVG checks covered all 405 sampled points, six chord endpoint pairs, their midpoint inequalities, and accessible labels. The homepage, methodology, and pitch use the same definition examples.
- Updated pitch layouts fit at 1440×900 and 1280×720 without scrolling. Mobile slides scroll vertically without horizontal overflow, with navigation always visible. Updated homepage and methodology examples were checked on desktop and mobile.
- Graph animation checks: tracer positions match the plotted path at sampled progress points on all seven teaching graphs. Curve/chord/endpoint sequences finish with no running animations and retain the full static graph. Viewport exit/re-entry and pitch-slide return restart the sequence; mobile navigation stays visible.
- Reduced-motion styles were verified through browser CSS media-rule simulation: complete curves, chords and endpoints remain visible, with no animation or tracer. Changing the operating-system motion preference and testing other browser engines remain unverified.
- The expanded agent scenarios preserve all six use cases. Technical applications and agent scenarios occupy separate rows on desktop and stack on narrow screens. The slide fits at 1440×900 and 1280×720; at 390×844, its content scrolls with navigation visible and no horizontal overflow. Frontend lint, type checks, build, and all 58 tests pass.

The preview uses port 3210 because the existing server on 3200 serves an earlier production build. The default application port remains 3200; restarting that server with the new build makes `/pitch` available there. No backend changes or paid model requests were needed. Native PowerPoint export and verification in other browser engines are outside this implementation.
