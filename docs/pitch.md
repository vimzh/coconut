# CoconutEval pitch

Five slides for a short live presentation. The browser deck is at `/pitch`; use Left/Right, Page Up/Page Down, Home/End, or the bottom-right arrow buttons. On narrow screens, scroll within a slide. This is a web presentation, not a `.pptx` export.

The copy below paraphrases the project documentation. Mathematical examples are illustrative and separate from scored tasks. The six use cases describe applications and analogies, not measured transfer to optimization or agent workflows.

## Slide 1 — CoconutEval

**A mathematical lens on model reasoning**

**CoconutEval.**

How well does a language model understand the shape of a function?

`f(x) = x²`, with `x ∈ [−1, 1]`

One function. A stated domain. A verifiable answer.

### Speaker notes

We give a model a mathematical expression and ask it to classify the function over a specified interval. The opening example is convex: its second derivative is 2 throughout the interval. The curve-and-chord drawing introduces the shape intuition; the drawing itself is not the proof.

The audience is hackathon judges and people evaluating language models. The goal is to explain what CoconutEval measures and lead into a live evaluation or retained report. Present this as a narrow, inspectable measurement rather than a test of general intelligence.

## Slide 2 — First, the shapes

**Convex, concave, or neither.**

A chord is a straight line segment between two points on a curve. CoconutEval asks which relationship holds on the whole interval.

| Answer | Illustrative function on `[-1, 1]` | Meaning |
| --- | --- | --- |
| Convex | `x²` | Bowl-shaped: every chord lies on or above the curve. |
| Concave | `−x²` | Dome-shaped: every chord lies on or below the curve. |
| Neither | `x³` | Here, the bend changes direction. Both conditions fail somewhere in the interval. |

Show a small graph beside each example. Dashed chords sit above the convex curve and below the concave curve; the cubic shows both relationships on different parts of the interval.

### Speaker notes

Begin with the drawings before introducing nested expressions. A chord joins any two points of a graph with a straight segment. A convex function stays on or below every such segment; a concave function stays on or above it. The condition must hold for every pair in the stated interval, not just the chord in the illustration. “Bowl” and “dome” are visual intuition, not a requirement to have a turning point or a global minimum/maximum.

Nested expressions combine operations whose signs, ranges, and domains affect the final answer. Our task requires a label for the whole supplied interval. For example, `x³` is neither on `[-1, 1]`, but convex on `[0, 1]`.

The three displayed examples have second derivatives 2, −2, and 6x respectively. Affine and constant functions can be both convex and concave, so the benchmark excludes their overlapping labels. Certified global evidence establishes convex/concave cases; evidence against both properties establishes neither. Failure of a sufficient composition rule alone does not prove neither.

The platform includes separately versioned task populations. Preserve their suite identities and settings when showing results. Operation depth is recorded, but it varies with family and size and is not an isolated measure of mathematical difficulty.

## Slide 3 — Why it matters

**One missed condition can change the answer.**

### Three technical applications in mathematical optimization

1. **Optimal control:** check a quadratic control objective together with its penalties and feasible region.
2. **Inverse problems:** track curvature when a data-fitting loss is composed with a regularizer.
3. **Resource allocation:** verify the objective and constraints before relying on a convex formulation.

### Three everyday agent analogies

1. **A travel-planning agent:** keep a connection-time requirement intact when rearranging an itinerary.
2. **A customer-support agent:** apply a refund policy together with its nested eligibility exceptions.
3. **A coding agent:** preserve scope and prerequisites when editing a conditional workflow.

**Applications and analogies. This evaluation measures curvature classification; transfer to these workflows remains untested.**

### Speaker notes

Convexity is relevant when deciding whether an optimization formulation has the structure required by a selected method. The entire formulation matters, including its feasible region; classifying a scalar objective does not validate a complete control, inverse-problem, or allocation system. These examples name why curvature knowledge is useful, not systems CoconutEval has tested.

The nontechnical examples make the dependency pattern familiar: an early condition must still hold after later steps are combined. They are proposed illustrations for this pitch. There is no retained evidence that CoconutEval predicts performance in travel planning, customer support, or coding agents.

## Slide 4 — How it works

**We ask a small question. Every condition still counts.**

1. **Certify the task:** generate a function and interval. Admit it only with reference evidence.
2. **Ask the model:** send the expression and domain in three fresh trials. Hide reference labels and proofs.
3. **Check every answer:** report macro-F1 and recall. Separate unusable replies from provider failures. Inspect wrong labels.

### A sign changes the shape

| Expression on `[-1, 1]` | Reference label |
| --- | --- |
| `−(x − 1)²` | Concave |
| `(−(x − 1))²` | Convex |

Parentheses, operator scope, and the domain all belong to the task.

**The evidence so far:** four completed high/max frontier confirmation runs were label-perfect. Exploratory errors in older/non-frontier settings do not establish a frontier limitation.

### Speaker notes

The sign examples have second derivatives −2 and 2. They demonstrate what a scope error would change; do not describe them as actual failed model transcripts.

Use the retained [replication review](research/openai-replication-review-v1.md) as the evidence source. Its documented checkpoint records four completed high/max confirmation cells for the two predeclared frontier identities, each with 216 correct labels out of 216 and macro-F1 1. The valid wrong labels occurred in a smaller exploratory screen using older/non-frontier settings. Those observations do not establish that frontier models fail this task.

The review separates mathematical mistakes, expression/domain misreadings, answer-label inconsistencies, formatting issues, unresolved cases, and truncations. Do not collapse them into a single explanation such as “models forget indentation.” Mathematical operator scope is directly relevant here; code indentation and general agent reliability are separate claims needing separate experiments. A correct label also does not establish a correct explanation.

If newer results are used during the presentation, update this document and the deck from a retained, reviewed result together. The [interior experiment plan](research/interior-experiment-v1.md) alone is not model-performance evidence. The [first matrix reconciliation](research/experiment-reconciliation-v1.md) documents infrastructure failures and incomplete prefixes; those are not mathematical model failures.

## Slide 5 — Reading the score

**A score starts the investigation.**

### With a high score, look for

1. **Distinguishes the classes:** gets convex, concave, and neither right rather than favoring one label.
2. **Respects the stated domain:** recognizes `x³` as neither on `[-1, 1]`, and convex on `[0, 1]`.
3. **Preserves operator scope:** distinguishes `−(x − 1)²` from `(−(x − 1))²`.

### With a low score, check for

1. **Defaults to a label:** predicts neither even when the whole interval is certified convex.
2. **Overlooks a condition:** misses a domain restriction or moves a minus sign outside its scope.
3. **Fails the answer contract:** returns invalid JSON or runs out of output budget. Inspect these separately.

Read the transcripts, class recall, and trial variation alongside the score. Results describe the tested suite and settings; general agent reliability remains a separate question.

**Explore CoconutEval** → `/evaluate`

### Speaker notes

The examples describe behaviors to inspect; an aggregate F1 score alone does not prove that a model used a particular reasoning process or handled an example absent from its suite. Macro-F1 averages the three class F1 scores equally. Inspect support and per-class recall to see whether a high aggregate hides weaknesses in a particular class.

Our scorer counts unusable returned answers against the corresponding reference class. Infrastructure errors and unattempted work are separate and can leave reports provisional or unavailable. A low score therefore requires checking answer validity and budget exhaustion before attributing failures to mathematics. Three fresh trials describe repeat-request variation, not three new mathematical problems. See the [scoring handoff](handoffs/04-scoring-and-depth-analysis.md).

## Design and implementation brief

- White `#ffffff` canvas; black `#111111` text; gray `#585858` secondary type, `#dedede` rules, and `#ededed` coordinate grid.
- Existing IBM Plex Sans for the narrative and IBM Plex Mono for labels/counts. System Georgia/Times for mathematical expressions. No new font or presentation dependency.
- The signature visual is a restrained function-and-chord study. Other slides use readable columns, equations, and rules rather than decorative graphics.
- Keep five slides, a centered opening, persistent bottom-right arrows, a slide counter, and keyboard navigation. Clamp navigation at the first and last slides. Keep the presentation separate from the workbench layout.
- Preserve keyboard focus, readable narrow-screen layouts, and scrolling for dense slides. No animation is required.

## Evidence and attribution

This pitch paraphrases [the project idea](idea.md), [the scoring contract](handoffs/04-scoring-and-depth-analysis.md), [the challenge design](research/challenge-design-v1.md), [the quality criteria](research/quality-criteria-v1.md), and [the retained replication review](research/openai-replication-review-v1.md). It makes no numerical claim beyond the reviewed checkpoint identified above. Prior-work provenance remains in the project and submission documentation; this pitch does not replace it.

## Verification

Verified on 8 November 2026:

- `bun run --filter @coconut/web lint`: passed.
- `bun run --filter @coconut/web typecheck`: passed.
- `bun run --filter @coconut/web test`: 58 tests passed.
- `bun run --filter @coconut/web build`: passed; `/pitch` is statically generated.
- Browser checks: all five slides at 1440×900, 1280×720, and 390×844; previous/next buttons, Left/Right boundaries, Home/End, Page Up/Page Down, and scroll reset. Dense slides scroll within the mobile viewport while controls remain available. Screenshots were inspected and the console had no application errors.
- The introductory-shapes update adds three labeled curve/chord diagrams before the use cases. Its desktop/mobile screenshots were inspected, the full slide fits at 1280×720, and frontend lint/type checks/build and all 58 existing tests pass again.

The preview uses port 3210 because the existing server on 3200 serves an earlier production build. The default application port remains 3200; restarting that server with the new build makes `/pitch` available there. No backend changes or paid model requests were needed. Native PowerPoint export and verification in other browser engines are outside this implementation.
