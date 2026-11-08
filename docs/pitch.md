# CoconutEval pitch

**Testing model curvature decisions against certified answers.**

Judge-facing narration and recording brief for the **micro1 Eval Hackathon 2026**. Target length: **4 minutes 40 seconds**, leaving 20 seconds for transitions. Read the speaker script; tables, evidence notes, and preparation items are supporting material. This document updates the pitch narrative; the existing six-slide browser deck at `/pitch` is maintained separately.

Project explanations below are **paraphrases** of the linked project records. Event requirements are **paraphrased** from official sources, except for the rubric's criterion names. Evidence is pinned to the reviewed checkpoints below, checked on **8 November 2026**. The ongoing experiment ledger is not a final result.

**Current position:** the evaluation and its reference checks are demonstrable. The reviewed frontier confirmation runs are label-perfect. A meaningful frontier-model limitation has **not** been established. Stronger pitch wording requires new, retained, independently reviewed evidence.

## Five-slide speaking script

### 1. One mathematical decision with practical consequences

**0:00–0:40 · Problem and relevance**

On screen: CoconutEval, an expression with its exact interval, and the three possible labels. Use the existing restrained visual style and labeled teaching graphs.

**Speaker script**

> CoconutEval tests a specific mathematical decision: is a function convex, concave, or neither on this exact interval?
>
> Engineers use curvature when deciding whether an optimization formulation fits a convex solver. Misclassifying an objective can send them toward an unsuitable method or an unjustified guarantee.
>
> We isolate that decision in a reproducible evaluation. The same function can have different answers on different intervals. A model must preserve the domain and the meaning of every nested operation.

Presenter note: control costs, regularized inverse problems, and resource allocation explain the motivation. A scalar classification does not validate a complete optimization problem; constraints and the feasible region also matter. Travel, refund, and coding-agent scenarios are optional analogies, with no measured transfer claim.

### 2. A precise task with a checkable answer

**0:40–1:25 · Task design**

On screen: the following teaching examples, followed by the actual challenge's family/class coverage. These examples are illustrative, not measured model failures.

| Function and interval | Correct label | Reason |
| --- | --- | --- |
| `x²` on `[-1, 1]` | Convex | Second derivative is `2`. |
| `−x²` on `[-1, 1]` | Concave | Second derivative is `−2`. |
| `x³` on `[-1, 1]` | Neither | Second derivative `6x` changes sign inside the interval. |

**Speaker script**

> A model receives an exact expression and interval. It returns one JSON label and a short explanation. We grade the label; the explanation is retained for inspection.
>
> The confirmation challenge has 72 tasks across eight function families and 24 parameter clusters. Every family includes all three labels. Affine functions are excluded because they can be both convex and concave.
>
> Each task gets three fresh requests. The reference answer and certificate stay out of the prompt. A separate nine-task screen is exploratory. Its scores do not replace the confirmation results.

Evidence: [challenge handoff](handoffs/14-benchmark-quality-and-pitfall-remediation.md), [prompt and answer contract](handoffs/02-evaluation-protocol-and-answers.md). There are 72 tasks per confirmation cell, not 216 independent mathematical problems. Depth varies with family and expression size; depth plots do not isolate a causal effect of nesting.

### 3. Establish the reference before judging the model

**1:25–2:20 · Grader reliability**

On screen: `expression + interval → reference certification → fresh model replies → deterministic scoring`. Briefly show a retained certificate and a correct/wrong-answer test.

**Speaker script**

> Before asking a model, we establish the reference answer. Independent analytic checks and native interval arithmetic agree on the admitted challenge cases.
>
> Global derivative bounds establish convex or concave cases. Opposite strict curvature witnesses establish neither. An inconclusive composition rule never becomes a neither label.
>
> The grader deterministically compares the returned label with the reference. Existing tests cover correct and deliberately wrong labels, malformed answers, tampered evidence, and independently calculated metrics.
>
> We report macro-F1 alongside accuracy and per-class recall. Unusable model replies count against the score. Provider errors and missing work remain separate and make results incomplete. Explanations cannot silently override a wrong label.

Evidence: [reference validation and coverage](handoffs/14-benchmark-quality-and-pitfall-remediation.md), [extractor validation](handoffs/02-evaluation-protocol-and-answers.md), [scorer fixtures and independent arithmetic](handoffs/04-scoring-and-depth-analysis.md). The score measures protocol-compliant classification, not the correctness of every explanation. A mathematical-failure claim requires transcript review in addition to a wrong grade.

### 4. Show the measured result and a real error

**2:20–4:00 · Model evidence and transcript walkthrough**

On screen: the four frontier confirmation rows below, followed by one older-model screening example. Label the two populations visibly.

| Requested frontier model | Reasoning setting / profile | Correct / planned | Macro-F1 |
| --- | --- | ---: | ---: |
| `gpt-6-astra` | High / `one-shot-json-v2-high` | 216 / 216 | 1.000 |
| `gpt-6-astra` | Max / `one-shot-json-v2-max` | 216 / 216 | 1.000 |
| `gpt-6.1-sol` | High / `one-shot-json-v2-high` | 216 / 216 | 1.000 |
| `gpt-6.1-sol` | Max / `one-shot-json-v2-max` | 216 / 216 | 1.000 |

**Speaker script**

> We tested two predeclared frontier models with high and max reasoning settings. Each of these four completed confirmation runs returned 216 correct labels out of 216. Macro-F1 was one in every run.
>
> A separate review checked 48 selected frontier explanations and found no substantiated false explicit mathematical claim. That sample covers only part of the available explanations.
>
> These results show that the current confirmation suite is saturated under these settings. We have not established a frontier-model limitation.
>
> Older-model screening did produce reviewed errors. For one reciprocal-exponential function on the interval one to two, GPT-4.1 returned concave. Its sign argument overlooked a leading minus sign; the certified curvature is positive throughout the interval. This is exploratory evidence.
>
> One full-suite comparator reply had a correct visible curvature argument but invalid JSON. It remains invalid under the protocol; it does not demonstrate a failure to understand curvature.
>
> The lesson so far is that a wrong grade needs a diagnosis. Any harder challenge must be separately versioned and independently checked before we draw a stronger conclusion.

**Walkthrough evidence, not spoken verbatim**

- Frontier table source: [partial replication review](research/openai-replication-review-v1.md), ledger snapshot **2026-11-08 05:39:39.281 UTC**. It reviews all 26 completed/published cells available at that boundary; it is not the final matrix. The four frontier rows use the same 72 mathematical tasks, three trials each, and a **16,384-output-token ceiling**. There is one inference attempt per trial and no automatic SDK retry. Compare settings separately.
- Each displayed frontier cell has 100% accuracy and trial-index macro-F1 range `[1, 1]` across three trials. Zero observed variation on this fixed population does not prove zero future error or model superiority.
- The [explanation review](research/frontier-explanation-review-v1.md) inspected 24 explanations per model on the max profile: the same 24 distinct tasks, trial zero. It left 384 of those two runs' 432 explanations uninspected. The review was AI-assisted and supplies no human expert approval or hidden-reasoning claim.
- Screening example: `f(x) = 1/(7/4 + exp(x))` on `[1, 2]`; requested `gpt-4.1`, reported `gpt-4.1-2025-04-14`, profile `one-shot-json-v1`, trial `0`. Reference **convex**, returned label **concave**. Independently differentiating gives `f''(x) = exp(x)(exp(x) − 7/4)/(7/4 + exp(x))³ > 0` throughout this interval. The reply's displayed factorization has a leading minus sign, but its conclusion treats the inner negative factor as making the entire expression negative. This is a paraphrase of the visible sign error, not an inference about hidden reasoning.
- Transcript binding: run `eeb3579f-555a-4c8d-9522-0ceff5879a4a`; case `case-challenge-v1-a94d876e228b7db42bb3dbaff40a74faafd8b8922df532959524338ad25d8993`; attempt `d3bf6023-f85d-418f-a03c-a6af08a6fae0`; transcript SHA-256 `4bd39436c2366d4417285118475a02d42e04dee47d20fdf09a24026a08bb8054`. The [tracked review artifact](../apps/api/data/quality/replication-review-v1.json) pins the transcript and reference hashes but omits raw replies. Anonymous retrieval of the [local published run view](http://localhost:3201/runs/eeb3579f-555a-4c8d-9522-0ceff5879a4a/public) confirmed the visible error during pitch preparation. Display its retained export when recording; a hash-only diagnosis is insufficient evidence for judges.
- The comparator formatting example is `gpt-6-luna`, high: 215 correct labels and one invalid JSON reply in 216 outcomes. The review attributes that invalid reply to unescaped LaTeX delimiters despite a correct visible convexity argument. Preserve its official invalid grade.
- Screening contains nine tasks in three parameter clusters. Its older-model errors cannot establish frontier failure or a ranked comparison. Truncation, cancellation, and service failures also cannot establish mathematical errors.

### 5. Give the judge a reproducible artifact

**4:00–4:40 · Contribution, reproduction, and close**

On screen: the evaluation interface, one inspectable report/export, and the verification commands below.

**Speaker script**

> CoconutEval combines certified function coverage with a runnable evaluation workbench and inspectable scoring evidence. Visitors use their own model credentials. Reports retain the task, response, settings, and outcome.
>
> The curvature task builds on disclosed prior work. Our contribution is the certified task coverage and the implementation connecting reference checks, repeated requests, retained outcomes, and reproducible reporting.
>
> Judges can verify the frozen suite and run grader checks without model charges. Live reruns use explicit credentials and recorded settings. The evidence shows both older-model errors and frontier successes.

Recording action: open an actual completed report, inspect a raw answer, then show its export. Use existing retained results; the walkthrough does not require starting a paid run. Include prior-work credit in the recording or accompanying submission materials, as detailed below.

## Short written description

CoconutEval evaluates whether language models classify scalar functions as convex, concave, or neither on exact intervals. Its confirmation challenge contains 72 certified tasks across eight families, with three fresh trials per task and deterministic label grading. Four reviewed high/max runs across `gpt-6-astra` and `gpt-6.1-sol` each achieved 216/216 correct labels; older-model exploratory screening produced independently reviewed errors. The current confirmation suite does not establish a frontier-model limitation. CoconutEval provides certified references, inspectable outcomes, and reproducible scoring, with prior-work adaptation disclosed.

Use this description with the pinned snapshot. Later evidence needs a new reviewed result and an updated description; a scheduled run or mutable progress count is insufficient.

## Coverage of the official judging rubric

Criterion names and points below follow the [Participant Guide, PDF page 17](https://hrcdn.net/s3_pub/istreet-assets/R_8vs8ejamSPapSbUxmcWQ/Eval_Hackathon_Participant_Guide.pdf#page=17). The coverage and gaps are our assessment, not predicted scores.

| Criterion | Points | Pitch evidence | Remaining gap or limit |
| --- | ---: | --- | --- |
| Real-world relevance | 15 | Slide 1 connects curvature to choosing optimization methods. | Synthetic scalar tasks; practical impact and transfer are not measured. Add the participant's own domain-specific rationale. |
| Task design | 20 | Slide 2 defines exact intervals, exclusive labels, family coverage, and separate populations. | Related parameters and domain variants share clusters; depth is confounded. Do not describe them as independent capabilities. |
| Grader reliability | 20 | Slide 3 shows certification, deterministic extraction, right/wrong fixtures, and independent metric checks. | Supply a per-task reference-pass/wrong-answer-fail record with the final artifact. Label grading does not validate explanations. |
| Evidence of model limitations | 15 | Slide 4 reports repeated frontier tests and an identified screening error. | **Central gap:** no supported frontier mathematical-failure finding in the reviewed evidence. Older-model errors and format failures do not fill it. |
| Reproducibility | 15 | Slide 5 shows frozen artifacts, commands, retained identities, and exports. | Final clean-package replay, durable raw transcripts, full-run runtime/cost, and final matrix reconciliation remain to be supplied. |
| Human expertise and review | 10 | Mathematical boundary choices and independent AI-assisted checks are documented. | No participant-level human review attestation is established by those checks. The participant must review every task, reference, and grading rule and disclose AI assistance truthfully. |
| Insight / hot take | 5 | Slide 4 separates classification, mathematical diagnosis, format, and budget effects. | Current insight concerns measurement and saturation. A frontier failure mechanism still requires new evidence. |
| **Total** | **100** | | |

The [official event page](https://www.hackerrank.com/event/micro1-eval-hackathon) and [FAQ](https://www.micro1.ai/hackathon/faq) also emphasize meaningful frontier failures, defensible grading, and reproducibility. Strong presentation cannot replace the missing scientific finding.

## Reproduction and evidence preparation

From the repository root, using Bun **1.4.4**, Node.js **24 LTS**, and `uv` as documented in the [README](../README.md):

```sh
bun install --frozen-lockfile
bun run numerics:setup
bun run challenge:verify --input apps/api/data/suites/challenge-v1.json
bun test apps/api/src/challenge apps/api/src/protocol apps/api/src/scoring
bun run dev
```

The verification and test commands make no provider requests. The retained default suite is bound to `one-shot-json-v1`; the frontier table uses separately identified high/max artifacts containing the same mathematical cases. Reproducing the table requires its exact profile-bound suite, manifest, capabilities, settings, and outcome records from the [replication review](research/openai-replication-review-v1.md), rather than changing a profile name in an existing artifact.

For the final evidence bundle:

- Retain representative raw transcripts for every reported model, with task/trial/profile identities and checked references. Record when a task has no observed failure; do not manufacture one. Hash-only reviews cannot replace raw evidence, and seven-day application retention is insufficient for a durable submission archive.
- Include exact model identities, dates, reasoning settings, token ceilings, three-trial score spread, completion counts, and separately reported unusable/infrastructure outcomes. Preserve failed and incomplete experiments alongside completed replications. Retained results establish historical observations; stochastic live reruns may differ.
- Report observed wall time and provider-backed usage/cost coverage for the exact full runs. **No defensible full-run cost/runtime estimate is supplied by this pitch.** Missing prices or cost evidence must remain unavailable; token ceilings are not a currency budget.
- Disclose that OpenAI has live execution evidence. OpenRouter and Hugging Face adapters have fixture coverage, with live inference still unverified under the development restriction. Do not record a cross-provider success claim.

## Attribution and participant review

The task and prompt design build on **Yepeng Liu, Yu Huang, Yu-Xiang Wang, Yingbin Liang, and Yuheng Bu, _ConvexBench: Can LLMs Recognize Convex Functions?_** See the project's [source and adaptation record](research/prompt-adaptation.md) for the paper link, exact wording changes, and reuse limits. Coconut's instructions are independently worded. Wording changes alone are not an original evaluation method, and this pitch does not claim to reproduce the earlier benchmark's results.

The project-specific contribution comprises certified scalar interval populations, independent analytic/native reference checks, versioned prompts and comparisons, visitor-owned execution, and retained scoring evidence. Distinguish these implementation contributions from the earlier task idea. Before submission, the participant must confirm what existed before the event, what was built during it, and the rights for every incorporated asset or dependency.

AI tools assisted implementation, documentation, and mathematical review. The linked independent reviews explicitly describe AI-assisted work; they do not establish human approval. Add the participant's actual expertise, review scope, corrections, and approval record before representing the human-review requirement as complete. This pitch supplies no invented credentials or personal review history.

## Submission requirements and remaining preparation

The [official FAQ](https://www.micro1.ai/hackathon/faq) specifies one ZIP up to **50 MB**, containing code and small supporting files with a README; a video link of **five minutes or less** that opens without permission; and a short description. Keep videos and credentials out of the ZIP. The deadline is **9 November 2026, 05:15 UTC / 10:45 AM IST**. The FAQ recommends **5–10 tasks**, with no maximum; our 72-task population is not a size requirement. Feature a few representative tasks in the video while preserving the full reported population.

Before recording or packaging:

1. Check the authenticated HackerRank challenge's **Instructions** at the [submission portal](https://hr.gs/micro1-eval-hackathon). They were not accessible through the public research tools, so this document does not verify additional form fields or kickoff-specific formatting.
2. Finish a separately versioned terminal experiment review and update result claims only from that evidence. If frontier results remain perfect, retain that finding and the explicit limitation on the pitch.
3. Prepare the participant's human-review and provenance disclosures, per-task grader checks, durable transcripts, clean-environment replay, and actual runtime/cost coverage.
4. Rehearse the spoken script with the evidence views, synchronize the browser deck if used, and verify the recording's duration and public playback. The ZIP, recording, and submission are not created by this document.

## Verification of this document

Checked on **8 November 2026**:

- Re-read the existing pitch, idea, roadmap, relevant handoffs, prompt provenance, and pinned replication/explanation reviews. Checked the official event page, FAQ, and full 22-page Participant Guide.
- Ran `bun run challenge:verify --input apps/api/data/suites/challenge-v1.json`: passed; 72 accepted tasks and complete declared family/class coverage. This is reference replay, not a new model result.
- Ran `bun test apps/api/src/challenge apps/api/src/protocol apps/api/src/scoring`: **172 passed, 0 failed, 6,504 assertions** across 11 files.
- Checked all 11 relative Markdown link occurrences: no missing targets. The speaking script contains **526 words**; the 4:40 target allows pauses and screen changes but still needs a recorded rehearsal.
- `git diff --check -- docs/pitch.md`: passed. This documentation-only update does not rerun or claim new frontend lint/build/browser verification.

No application source change, live model request, deployment, recording, archive creation, or hackathon submission is part of this documentation update.

## Existing browser deck reference

The following teaching and implementation notes are preserved from the existing six-slide deck. They describe the browser presentation, not additional material to read in the five-part recording script. Their verification results are historical implementation checkpoints; the new narrative has not been synchronized with or browser-verified against that deck.

### Browser slide 3: why convexity matters

**Check the objective and the constraints.**

### Three technical applications in mathematical optimization

1. **Optimal control:** check whether a control cost and its constraints form a convex problem.
2. **Inverse problems:** check whether adding a regularizer keeps a data-fitting objective convex.
3. **Resource allocation:** check costs and capacity constraints before choosing a convex solver.

Each application has a small illustrative diagram: a state/action feedback loop, a fit-plus-regularizer objective, and a fixed capacity divided among three demands. These are conceptual schematics, not measured performance plots.

**CoconutEval measures scalar function classification. These applications are illustrative; transfer to full optimization systems remains untested.**

#### Speaker notes

Convexity is relevant when deciding whether an optimization formulation has the structure required by a selected method. The entire formulation matters, including its feasible region; classifying a scalar objective does not validate a complete control, inverse-problem, or allocation system. These examples name why curvature knowledge is useful, not systems CoconutEval has tested.

### Browser slide 4: agent scenarios

**Check the whole rule.**

Show three cards. Each separates the request, a visual rule check, and the decision:

| Agent | Request | Rule check | Decision |
| --- | --- | --- | --- |
| Travel planner | Find a cheaper flight to Delhi that arrives before 6 pm. | Required connection: 90 min. Proposed connection: 45 min, shown at half the required bar length. The route arrives at 5 pm. | Reject this route. The arrival works; the connection breaks the rule. |
| Customer support | An opened item reportedly arrived damaged. The refund request comes on day 12. | Day 12 is within the 30-day window. Unopened fails, but reported damage is the policy’s OR exception. | Check the damage exception. Opening the box alone is not a reason to reject. |
| Coding agent | Let managers export invoices alongside admins. Both roles must belong to the invoice’s workspace. | A workspace boundary encloses `Admin OR Manager`, with membership required for both. | Keep the workspace check. A separate “or manager” could let someone from another workspace export invoices. |

**These examples explain why conditions matter. We have not tested whether CoconutEval scores predict success in these agent workflows.**

#### Speaker notes and detailed scenarios

1. **A travel-planning agent:** a traveller wants a cheaper flight to Delhi, arriving before 6 pm, with at least 90 minutes between flights. A route arrives at 5 pm but has a 45-minute layover. Booking it would break the connection rule.
2. **A customer-support agent:** a store allows refund requests within 30 days for unopened items or items that arrived damaged. A customer reports a damaged delivery on day 12, after opening the box. Rejecting it solely because the box was opened would miss the exception.
3. **A coding agent:** a developer asks an agent to let managers export invoices, alongside admins. Both roles must belong to the invoice’s workspace. Adding ‘or manager’ outside that check could admit a manager from another workspace.

The nontechnical examples make the dependency pattern familiar: an early condition must still hold after later steps are combined. They are proposed illustrations for this pitch. There is no retained evidence that CoconutEval predicts performance in travel planning, customer support, or coding agents.

These scenarios use hypothetical rules and numbers. In the travel example, meeting the price and arrival goals does not satisfy the connection requirement. In the refund example, the damage exception overrides the unopened-item condition within the 30-day window. In the coding example, workspace membership must cover both roles: `same workspace AND (admin OR manager)`.

### Browser design and implementation brief

- White `#ffffff` chrome and `#fafcfb` canvas; dark ink `#182422`, secondary type `#53605b`, and quiet `#dce6df` borders. Pale mint `#eaf5ef`, blue `#edf3fb`, and amber `#fff5df` cards group the examples. Dark green, blue, and amber curves identify convex, concave, and neither alongside their text labels.
- Existing IBM Plex Sans for the narrative and IBM Plex Mono for labels/counts. System Georgia/Times for mathematical expressions. No new font or presentation dependency.
- Draw each teaching function beside its explanation, including both minus-sign examples. The shared SVG component samples the actual expressions on the stated interval, shows axes and selected chords, and provides a specific accessible graph description. The homepage and methodology use the same definition examples.
- The shared coconut mascot is `apps/web/public/coconut.svg`. The pitch and main site use its original brown shell.
- Keep six slides, a centered opening, persistent bottom-right arrows, a slide counter, and keyboard navigation. Give optimization and agent scenarios their own slides. Clamp navigation at the first and last slides. Keep the presentation separate from the workbench layout.
- Animate the teaching graphs: a point traces each curve as it draws, followed by the dashed chord, endpoints, and any shaded region or annotation. Each sequence finishes within 2.2 seconds, then stays still. Replay when a graph returns after leaving the viewport or a pitch slide opens again. Axes and definitions stay in place. Reduced-motion settings show the complete static plot immediately.
- Use finite diagram and check animations: the optimization connectors draw once, and each agent card reveals its conditions before the outcome. Slides fade in and replay their visual sequence on return. Preserve keyboard focus, readable narrow-screen layouts, and scrolling for dense slides. Add no animation dependency.
- Design refinement follows frontend-design and [unslop by Damir Sokolovsky](https://heydamir.design/unslop), adapted to these mathematical explanations. Unslop guidance is licensed under CC BY 4.0.

### Historical browser verification

Verified on 8 November 2026:

- `bun run --filter @coconut/web lint`: passed.
- `bun run --filter @coconut/web typecheck`: passed.
- `bun run --filter @coconut/web test`: 58 tests passed.
- `bun run --filter @coconut/web build`: passed; `/pitch` is statically generated.
- Browser checks: all six slides at 1440×900, 1280×720, and 390×844; previous/next buttons, Left/Right boundaries, Home/End, Page Up/Page Down, and scroll reset. Dense slides scroll within the mobile viewport while controls remain available. Screenshots were inspected and the console had no application errors.
- The standard-definition update adds the quantified inequalities and a shared graph component for five teaching functions. Independent SVG checks covered all 405 sampled points, six chord endpoint pairs, their midpoint inequalities, and accessible labels. The homepage, methodology, and pitch use the same definition examples.
- Updated pitch layouts fit at 1440×900 and 1280×720 without scrolling. Mobile slides scroll vertically without horizontal overflow, with navigation always visible. Updated homepage and methodology examples were checked on desktop and mobile.
- Graph animation checks: tracer positions match the plotted path at sampled progress points on all seven teaching graphs. Curve/chord/endpoint sequences finish with no running animations and retain the full static graph. Viewport exit/re-entry and pitch-slide return restart the sequence; mobile navigation stays visible.
- Reduced-motion styles were verified through browser CSS media-rule simulation: complete curves, chords, endpoints, scenario checks, and decisions remain visible. The new scenario slide has zero animations under the simulated setting. Changing the operating-system motion preference and testing other browser engines remain unverified.
- The six-slide revision preserves all six use cases and moves the agent scenarios to their own slide. All slides fit at 1440×900 and 1280×720; at 390×844, content scrolls with navigation visible and no horizontal or card overflow. Scenario animations finish before 2.2 seconds and then stay still. Bar lengths preserve the 90/45-minute comparison and day-12/30-day window. Frontend lint, type checks, build, and all 58 tests pass.

The preview uses port 3210 because the existing server on 3200 serves an earlier production build. The default application port remains 3200; restarting that server with the new build makes `/pitch` available there. No backend changes or paid model requests were needed. Native PowerPoint export and verification in other browser engines are outside this implementation.
