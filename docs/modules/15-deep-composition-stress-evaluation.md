# Module 15: Deep Composition Stress Evaluation

## Status

In progress — 14a and 14b are complete within their handoff boundaries. The separate population builder, structural/exposure diagnostics, one-response research transport, immutable execution ledger, score reconstruction and landing projection are implemented. Full 800-case admission, independent reference review, live compatibility and final model evidence remain pending. See the [implementation plan](../plans/15-deep-composition-stress-evaluation.md). No new scores follow from implemented infrastructure.

## Purpose

Investigate whether GPT-6 Astra misclassifies functions when long dependent compositions combine domain restrictions, sign changes, monotonicity decisions and competing curvature contributions. Construct difficult, unambiguous mathematics whose reference answers can be checked independently. Expression length and visual complexity alone do not establish difficulty.

The user-directed MVP now reuses the pinned upstream generator through Module 14b's import/admission path, following its small Astra development pilot. This is an adapted benchmark study; a below-100 pilot score triggers outcome review and does not complete this phase.

The user requests substantial mathematical complexity and wants to expose errors in Astra. The research objective is to discover and explain such errors; admission to the frozen evaluation must not depend on whether Astra answers a particular case incorrectly. A completed suite with no observed errors is a valid outcome and supplies no mathematical-failure finding.

## Fixed Evaluation Target — D-13

| Dimension | Decision |
| --- | --- |
| Requested generator depth | Eight settings: **5, 10, 20, 40, 80, 160, 320 and 512**, under the pinned upstream convention. Retain realized upstream depth (D or D+1), raw AST depth and actual nonlinear path separately; these buckets are not claims of exact nonlinear-stage counts. |
| Population | **100 distinct function/domain pairs per level; 800 total.** Every evaluated model receives the same frozen population. These counts are construction targets until certification and distinctness checks pass. |
| Labels | Each level has 33 cases per label plus one extra, rotating convex/concave/neither in the listed level order. Total: 267 convex / 267 concave / 266 neither. |
| Construction | Reuse the pinned upstream sampling policy consistently across settings and models. Report actual atom/structure/mechanism coverage and related cores; no invented five-family or 20-per-family quota. |
| Models | User-confirmed roster: Astra `gpt-6-astra`, Mini `gpt-5.4-mini`, Luna `gpt-6-luna` through OpenAI; **M = 3**, **2,400 final sends**. Every cell covers all eight levels with the same cases. Verify inference access and retain reported identities. This roster is separate from the historical leaderboard. |
| Trials | **One fresh response per task**, one attempt, zero automatic retries; **800 scored inference requests per model/settings cell**. |
| Development population | Separate cases and core clusters; at most 30 development inference sends shared with Module 14b's adaptive search: at most nine three-question panels (27 sends) plus at most three inference probes. Start at 216, escalate to 512/1000 only on complete all-correct panels, and use bounded exploratory interval probes after a verified deeper error. Prior sends reduce the remaining allowance. |
| Phase ceiling | **2,430 sends** across the confirmed three-model roster, including the 30-send development allowance shared with 14b. The earlier two sends remain charged, including the unknown remote outcome. Roster/settings additions require an explicit manifest amendment and separate accounting. |
| Scores | Accuracy, fixed-three-class macro-F1, per-class support/recall and confusion matrices, overall and per composition level. |
| Interpretation | Single-trial descriptive results on a fixed synthetic suite; no repeated-trial stability, universal failure depth, causal depth effect or general model ranking. |

D-13 is a new research design for this phase. It replaces the proposed three-trial budget for this new population only. Existing D-03/D-05 profiles, D-12 criteria, historical runs and the three-trial `composition-v1` repair remain unchanged. Define a separate single-trial protocol/report identity before execution; never present two unattempted repeats as a complete ordinary three-trial run.

The user's eight-level amendment replaces this phase's original 10/30/100-stage, 300-case design before any phase-15 model dispatch. Lower performance at higher stages is a hypothesis to test, not an admission rule or required score shape. Retain flat, improving and nonmonotonic curves as observed.

The subsequent upstream-first amendment explicitly replaces exact nonlinear-stage equality and the five-family construction quota with the source generator's requested/realized depth convention and measured structural coverage. The later adaptive-search amendment replaces the fixed 24-question pilot with bounded exploration starting at 216, then 512/1000 and midpoint panels as applicable. The eight final requested numbers, 100 admitted cases per bucket, single responses and 30 + 800 × M ceiling remain fixed. Search depths are not automatically final buckets: changing final depths requires an explicit pre-freeze amendment with counts and budget. Historical datasets and depth definitions remain unchanged; the adapted study gets new source, depth-policy, suite and report identities.

## Dependencies and Current Feasibility Boundary

The user-directed order is **14a cleanup → 14b upstream integration and Astra pilot → 15 deep evaluation**. The [completed 14b handoff](../handoffs/14b-randomized-certified-evaluation.md) provides scoped integration/exposure Go verdicts, but its actual depth-216 pilot is inconclusive: one correct answer, one timeout and one unattempted question. It used two of the 30 shared development sends, including one unknown remote outcome; 28 remain. No mathematical-failure greenlight or complete pilot comparison follows, and further diagnostics require a separately frozen amendment. Public source/output redistribution clearance remains unresolved. Require both the cleanup handoff and the completed 14b integration/quality handoff with scoped G-RANDOM/G-SPLIT Go verdicts and an explicit pilot-signal verdict before this phase's implementation. A negative pilot-signal verdict cannot be presented as a model failure; it is distinct from technical admission readiness. The cleanup clarifies the current 27-task/three-trial product; it does not implement this phase's 800-task/single-trial workload. Module 14b's bounded pilot occurs before this phase and consumes the shared development allowance; it does not require this phase's 800-case implementation.

Reuse modules 01–04 for references, prompts, generation and scoring; 07–08 for bounded inference and evidence; and 14 for quality checks. Read the [idea](../idea.md), [roadmap](../ROADMAP.md), [quality criteria](../research/quality-criteria-v1.md), [composition repair plan](../plans/composition-repair-v1.md) and [current composition implementation](../../apps/api/src/composition/candidates.ts) before implementation. Coordinate with active repair work and retain all existing artifacts.

[Module 14b](14b-randomized-certified-evaluation.md) supplies the pinned upstream integration, independent actual-domain admission, candidate/rejection and exposure records, and the small Astra pilot. Its handoff states supported bounds; this phase then owns full target feasibility, final admission of 100 cases per requested bucket, final freeze and execution. A pilot counterexample or scoped integration Go does not establish 800 verified questions or general model failure. Any additional model-assisted checks must fit the unspent shared development allocation or a separate pre-run amendment, not a second implicit budget.

The current repaired generator has 27 cases at 2/4/6 nonlinear stages, with operation-tree depths 7/13/19. Its two atoms share strong monotonicity, convexity and contraction properties; extending those same patterns is not evidence of added reasoning difficulty. The native verifier remains bounded by operation depth 32 and 256 node occurrences. Generating upstream samples at requested depth 512 does not admit them under this policy or establish labels on Coconut's chosen interval.

Prefer bounded, family-specific analytic or exact certificates with an independently written checker for deep cases. They must prove the actual rendered functions, not just intended generator labels. Native certification can provide overlapping evidence where admitted; a retained native resource-limit result is not a deep reference proof. If a new numerical policy is necessary, version its limits and verification separately and retain rejection boundaries. Do not widen ordinary application admission to accommodate the study.

## What Mathematical Complexity Must Mean

These are mechanism diagnostics for the imported population, not promises that every upstream family or question contains every mechanism. Independently establish the applicable domain and reference evidence before admitting each case. Do not rebuild a new grammar merely to satisfy the earlier speculative mechanism quotas.

| Mechanism target | Required dependency | Diagnostic control |
| --- | --- | --- |
| Domain and range propagation | A later logarithm, reciprocal or square root requires nontrivial bounds on a composed inner function throughout the closed interval. | Related interval variants change the relevant rule or class while every admitted input remains real-valued and defined. |
| Sign and monotonicity transitions | Increasing/decreasing outer functions interact with inner curvature and sign regimes at multiple dependent stages. | Sign/interval controls defeat fixed sign-parity or outer-operation label rules. |
| Nonmonotone outer operations | Squaring or another supported nonmonotone operation requires reasoning about the inner range, including zero crossings where appropriate. | Controls distinguish the same operation on positive, negative and crossing ranges. |
| Competing branches | Two or more genuinely variable-dependent branches contribute curvature with opposing signs; dominance changes by certified parameter regime. | All three classes share outer structure and overlapping parameter ranges; an outer sum/product alone cannot determine the label. |
| Interior curvature transitions | Strict opposite curvature or Jensen witnesses occur inside the interval; endpoint/midpoint checks alone are inconclusive. | Include independently certified convex/concave cases of comparable form; fail simple sparse-probe baselines on neither cases. |

Record which mechanisms are present and why they may be demanding before scored responses are inspected. Do not claim that each case has two interacting mechanisms unless that is actually established; admission is governed by the frozen source/validity/quota policy, not observed model failures. Sharing mechanisms does not create new families. Formulas distinguished only by affine offsets, positive output scaling, reflection, negation, reparameterization or common cores remain related clusters rather than independent support.

For the separate nonlinear-path diagnostic, count only stages consuming variable-dependent expressions; do not equate it with upstream requested/realized depth. Also record raw AST depth, flattened/bounded-simplified depth, node occurrences, unique subtrees, branching and rendered input length. Audit reassociated sums, affine maps, double negation, zero/one arithmetic, inverse pairs, known closed forms, constant branches and inactive branches. Report unknown equivalence explicitly. Do not add wrappers or enormous coefficients to reach a depth or context limit.

Exclude ill-defined domains, affine overlap, contradictions and unsupported operations. Bind exact rendered coefficients and strict witnesses to the chosen interval. Floating-point overflow is acceptable only when a valid independent symbolic reference establishes the actual task; retain numerical confirmation as unavailable rather than inventing it. Numerical ambiguity or an exhausted verifier alone supplies no label. Allow any valid simplification or mathematical solution method.

## Cross-Depth Comparability

Use the same pinned upstream grammar/sampling configuration, label-allocation rule, domain-generation policy and parameter rules at all eight requested settings. Measure the actual family/atom/structure mix rather than asserting a five-family balance. Retain shared-core/prefix relationships as clusters. Such related cases do not supply independent depth samples. Keep realized-depth distributions and mechanism coverage visible so a changing family mix or easier outer layer cannot masquerade as a depth effect.

Record input tokens/characters, branching, derivative/range scales, numerical margins, simplified structure and certification rejection rates by level. Depth and input size will generally co-vary; matched families alone do not isolate a causal depth effect. Representation/length controls can support a separate analysis, but must have their own identities and cannot silently replace the frozen inputs.

Report actual per-level accuracy and macro-F1 with class counts and completion. Do not sort, smooth or change cases to force descending scores. A low score caused by context overflow, output truncation or a deadline is a budget/compatibility observation, not a demonstrated wrong mathematical classification. Freeze the treatment of unsupported model/level cells before scoring and show them as unavailable rather than dropping them from the curve.

## Development, Freeze and Fresh Evaluation

1. **Establish feasibility.** Produce an independently checked domain and reference argument for each mechanism and target level, including counterexamples to tempting incorrect rules. Measure certification work, rational/interval growth and rendered input size. Verification: replay actual ASTs and compare the independent proof and evaluator; unresolved disagreements block admission.
2. **Consume the development search.** Reuse Module 14b's complete adaptive Astra ledger and reviewed signal verdict; do not rerun its panels or count a second 30-call allowance. The algorithm/settings/seeds are frozen before search and each panel before dispatch; chosen depths are adaptive, not predeclared final measurements. Any further work must fit the remaining shared allowance. Verification: reconcile all search/probe sends and keep exposed cases/groups outside the final population. A below-100 score without an independently verified wrong valid label is not a mathematical-failure signal; interval narrowing does not establish a monotonic threshold.
3. **Freeze the construction and holdout.** Freeze family definitions, parameter distributions, label counts, rejection rules, seeds, prompts, protocol, the finite model/settings roster, numeric total send ceiling, token/time budgets and reference/source hashes. Construct the fresh 800-case evaluation with no model feedback; use deterministic candidate ordering and bounded attempts. Verification: replay every reference, check split separation beyond IDs/seeds, record accepted/rejected/unverified counts and verify distinctness and coverage. If targets cannot be met, record incomplete generation; any smaller design needs a named, pre-run amendment.
4. **Execute once.** Run all frozen cases on every model in the roster, including Astra, using fresh conversations, the existing isolated official SDK transport and a new single-trial research identity. Persist dispatch receipts before sends, cap aggregate concurrency across all models at 12 and stop new dispatches on evidence persistence or systemic provider failure. Verification: unique model/case/trial identities, request-body/prompt bindings, bounded attempts and a reconciled terminal ledger. No rerun, task replacement or post-result settings change within the scored cell.
5. **Audit and report.** Independently reconstruct every confusion count and score from original retained outcomes and reference bindings. Inspect all wrong/unusable replies and separately flag incorrect explanations accompanying correct labels. Verification: report arithmetic matches, each failure diagnosis has a transcript/reference binding, and all displayed claims match completed evidence.

Model effort, output ceiling and per-call/overall deadlines must be explicit before either population is dispatched. Check supported reasoning settings and reserve enough output capacity for the intended task. Never manufacture a limitation by silently reducing effort, shortening deadlines or deliberately exhausting the context window. Preserve reported usage, settings and unknown effective values; do not equate a common token ceiling with equal compute.

Development is adaptive and must be disclosed. New holdout parameters from an exposed core do not establish independent mathematical cases. Public availability and split separation do not prove absence of training exposure.

## Grader, Evidence and Claim Contract

The deterministic grader accepts only a valid complete protocol answer and compares its label with the certified reference. Validate every reference answer as a pass, both alternative labels as failures, and malformed/conflicting/refused/truncated outcomes under the declared extraction policy. Keep explanations outside the official label score; never repair grades after reading them. Model-visible content contains only neutral instructions, the exact expression and interval; test the actual outgoing body for metadata/reference leakage.

For each model and depth, distinguish planned requests, dispatched attempts, retained model outcomes, valid-correct, valid-wrong, invalid, refused, truncated, infrastructure, unknown and unattempted counts. For complete model outcomes, accuracy is correct/100 at that level and correct/800 overall per model. Unusable model replies remain failures; infrastructure/missing evidence makes the score provisional or unavailable rather than a fabricated mathematical error. Always display planned/completed coverage with the score.

One trial makes trial spread, agreement across repeats and repeated-error frequency unavailable. Keep this phase exploratory and unranked. Independently checked completed wrong labels may establish point counterexamples; they do not satisfy D-12's stronger repeated-error G-SIGNAL criterion. Preserve that criterion and its verdict rather than weakening it to match the new budget. A correct-label reply with incorrect mathematics gets a separate explanation finding.

The 800-case target exceeds the existing 256-case offline quality-report limit. Partition offline checks into eight 100-case strata and version any aggregate report with an explicit 800-case bound per model; reconcile cross-depth duplicates/clusters in bounded batches. Preserve native batch/process limits. Do not silently increase global caps or omit cases beyond the existing report limit.

## Verification and Delivery Checkpoints

| Checkpoint | Required evidence before proceeding |
| --- | --- |
| Mathematical feasibility | Deep-family proof replay, independent domain/curvature checks, strict opposite-label exclusions, measured resource bounds and actionable rejection behavior. |
| Generator quality | Requested settings 5/10/20/40/80/160/320/512 with actual source-depth/nonlinear-path diagnostics, frozen 100-per-setting admission, consistent upstream configuration, distinctness/exposure ledger, declared shortcut checks and independent reference replay. |
| Single-trial integration | New identities, no mutation of ordinary three-trial profiles, correct completeness/denominators, privacy and extraction fixtures, independent hand-calculated metric examples. |
| Live study | Frozen manifest, verified model access, reconciled sends, exact request bindings, all attempts/outcomes retained and no hidden retries. |
| Final evidence | Credential-free score replay, transcript-linked diagnoses, reviewed references and correctly qualified claims; all-success outcomes retained honestly. |

Before coding, write `docs/plans/15-deep-composition-stress-evaluation.md` with concrete file ownership, interfaces, chosen proof policies, finite work bounds and exact new CLI/replay commands. Reuse the current scoring and transport paths wherever their contracts fit. Implement mathematical generation/certification and single-trial execution as separately owned workstreams after interfaces agree; do not rewrite the UI or leaderboard to conduct the experiment.

Run applicable new reference/generator/protocol/scoring tests, existing affected regressions, `bun run lint`, `bun run typecheck` and `bun run build`; run `bun run numerics:test` and `bun run numerics:lint` if numerical code changes. Record actual results, not planned checks as passes.

Deliver the frozen suite, independent references, split/exposure and quality ledgers, versioned single-trial runner/report, private dispatch/response evidence and a safe reproducible results bundle. Write `docs/handoffs/15-deep-composition-stress-evaluation.md` with implemented scope, exact commands, outcomes, resource/cost evidence and remaining limitations. No implementation, certification or model failure is established by this phase document.

## Time and Submission Boundaries

Timebox initial full-population deep-certification feasibility to two hours of implementation after the 14b handoff. If targets through requested depth 512 cannot be admitted reliably, stop expansion and document a smaller proposed population/depth amendment before its scored run. Preserve the target and reasons; do not substitute a smaller or easier suite under the same identity. The hackathon delivery plan should reserve the last four hours before the deadline for clean reproduction, packaging and the video; actual scheduling must use time remaining when implementation starts.

This phase supplies evaluation evidence to modules 12/13 and submission planning. It does not authorize external submission, deployment, changed agreements or invented failure claims. Keep prior-work attribution and AI/human review provenance accurate in submission documentation. The single-trial choice must remain explicit, including its difference from the event guide's multiple-trial recommendation; this phase does not certify submission eligibility.
