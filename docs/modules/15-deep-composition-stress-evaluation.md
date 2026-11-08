# Module 15: Deep Composition Stress Evaluation

## Status

Planned — complete [mini module 14a's product flow cleanup](14a-product-flow-cleanup.md) first. The evaluation design is agreed; deep reference certification, task construction, protocol implementation and model evidence are pending. This document creates a phase, not a completed evaluation or an instruction to dispatch calls now.

## Purpose

Investigate whether GPT-6 Astra misclassifies functions when long dependent compositions combine domain restrictions, sign changes, monotonicity decisions and competing curvature contributions. Construct difficult, unambiguous mathematics whose reference answers can be checked independently. Expression length and visual complexity alone do not establish difficulty.

The user requests substantial mathematical complexity and wants to expose errors in Astra. The research objective is to discover and explain such errors; admission to the frozen evaluation must not depend on whether Astra answers a particular case incorrectly. A completed suite with no observed errors is a valid outcome and supplies no mathematical-failure finding.

## Fixed Evaluation Target — D-13

| Dimension | Decision |
| --- | --- |
| Composition stages | Eight target levels: **5, 10, 20, 40, 80, 160, 320 and 512** successive, variable-dependent nonlinear stages on the longest dependency path. |
| Population | **100 distinct function/domain pairs per level; 800 total.** Every evaluated model receives the same frozen population. These counts are construction targets until certification and distinctness checks pass. |
| Labels | Each level has 33 cases per label plus one extra, rotating convex/concave/neither in the listed level order. Total: 267 convex / 267 concave / 266 neither. |
| Mechanisms | Target five reviewed mechanism families, 20 cases per family per level, with every label in every family/level. Report actual mathematical families and related-task clusters separately. |
| Models | Required primary requested ID `gpt-6-astra` through OpenAI. Freeze a finite roster of M model/settings cells before dispatch; every cell covers all eight levels with the same cases. Verify inference access and retain reported identities. Do not assume the historical leaderboard is the new roster. |
| Trials | **One fresh response per task**, one attempt, zero automatic retries; **800 scored inference requests per model/settings cell**. |
| Development population | Separate cases and core clusters; at most 30 development inference sends, including any inference capability probes. Retain every attempt and revision. |
| Phase ceiling | At most **30 + 800 × M new inference sends**, with the development allowance shared across the roster; Astra alone permits at most 830. Freeze M and the resulting numeric ceiling, then reconcile earlier and concurrent sends before dispatch. Roster/settings additions require an explicit manifest amendment and separate accounting. |
| Scores | Accuracy, fixed-three-class macro-F1, per-class support/recall and confusion matrices, overall and per composition level. |
| Interpretation | Single-trial descriptive results on a fixed synthetic suite; no repeated-trial stability, universal failure depth, causal depth effect or general model ranking. |

D-13 is a new research design for this phase. It replaces the proposed three-trial budget for this new population only. Existing D-03/D-05 profiles, D-12 criteria, historical runs and the three-trial `composition-v1` repair remain unchanged. Define a separate single-trial protocol/report identity before execution; never present two unattempted repeats as a complete ordinary three-trial run.

The user's eight-level amendment replaces this phase's original 10/30/100-stage, 300-case design before any phase-15 model dispatch. Lower performance at higher stages is a hypothesis to test, not an admission rule or required score shape. Retain flat, improving and nonmonotonic curves as observed.

## Dependencies and Current Feasibility Boundary

The user-directed order is **14a cleanup → 15 evaluation**. Require the cleanup handoff before implementation or new Phase 15 model runs. The cleanup clarifies the current 27-task/three-trial product; it does not implement this phase's 800-task/single-trial workload.

Reuse modules 01–04 for references, prompts, generation and scoring; 07–08 for bounded inference and evidence; and 14 for quality checks. Read the [idea](../idea.md), [roadmap](../ROADMAP.md), [quality criteria](../research/quality-criteria-v1.md), [composition repair plan](../plans/composition-repair-v1.md) and [current composition implementation](../../apps/api/src/composition/candidates.ts) before implementation. Coordinate with active repair work and retain all existing artifacts.

[Module 16](16-randomized-certified-evaluation.md) owns reusable randomized generation, candidate/rejection accounting, structural split integrity and shortcut/control diagnostics. Its scoped G-RANDOM/G-SPLIT results precede freezing this study's population as randomized and checked for the declared shortcuts. Offline Module 16 work and this phase's deep-proof feasibility may proceed alongside each other after applicable prerequisites; Module 16 depends on this phase's target definition, not its completed experiment. The immediate 14a cleanup requirement, D-13 stage/case/trial targets and 30 + 800 × M ceiling remain unchanged. Any model-assisted generator checks or extra paired/reduction requests must fit that development/final allocation or a separate pre-run amendment, not a second implicit budget.

The current repaired generator has 27 cases at 2/4/6 nonlinear stages, with operation-tree depths 7/13/19. Its two atoms share strong monotonicity, convexity and contraction properties; extending those same patterns is not evidence of added reasoning difficulty. The native verifier remains bounded by operation depth 32 and 256 node occurrences. Targets through 512 nonlinear stages cannot be admitted by that policy merely by setting larger target numbers.

Prefer bounded, family-specific analytic or exact certificates with an independently written checker for deep cases. They must prove the actual rendered functions, not just intended generator labels. Native certification can provide overlapping evidence where admitted; a retained native resource-limit result is not a deep reference proof. If a new numerical policy is necessary, version its limits and verification separately and retain rejection boundaries. Do not widen ordinary application admission to accommodate the study.

## What Mathematical Complexity Must Mean

These are mechanism targets, not formulas already proved or empirically difficult. For each family, derive a valid parameter region and all three label regimes before admitting cases.

| Mechanism target | Required dependency | Diagnostic control |
| --- | --- | --- |
| Domain and range propagation | A later logarithm, reciprocal or square root requires nontrivial bounds on a composed inner function throughout the closed interval. | Related interval variants change the relevant rule or class while every admitted input remains real-valued and defined. |
| Sign and monotonicity transitions | Increasing/decreasing outer functions interact with inner curvature and sign regimes at multiple dependent stages. | Sign/interval controls defeat fixed sign-parity or outer-operation label rules. |
| Nonmonotone outer operations | Squaring or another supported nonmonotone operation requires reasoning about the inner range, including zero crossings where appropriate. | Controls distinguish the same operation on positive, negative and crossing ranges. |
| Competing branches | Two or more genuinely variable-dependent branches contribute curvature with opposing signs; dominance changes by certified parameter regime. | All three classes share outer structure and overlapping parameter ranges; an outer sum/product alone cannot determine the label. |
| Interior curvature transitions | Strict opposite curvature or Jensen witnesses occur inside the interval; endpoint/midpoint checks alone are inconclusive. | Include independently certified convex/concave cases of comparable form; fail simple sparse-probe baselines on neither cases. |

Require at least two interacting mechanisms in each final case and record the reason an expert expects it to be demanding before testing that case. Sharing mechanisms does not create new families. Formulas distinguished only by affine offsets, positive output scaling, reflection, negation, reparameterization or common cores remain related clusters rather than independent support.

Each counted stage must consume a variable-dependent expression. Count nonlinear stages separately from raw AST depth, flattened/bounded-simplified depth, node occurrences, unique subtrees, branching and rendered input length. Audit reassociated sums, nested affine maps, double negation, zero/one arithmetic, inverse pairs, repeated atoms with known closed forms, constant branches and inactive piecewise branches. Report unknown equivalence explicitly. Do not add wrappers or enormous coefficients to reach a depth or context limit.

Exclude ill-defined domains, affine overlap, contradictions, numerical overflow and unsupported operations. Use exact coefficients and certified margins, retaining conditioning/range diagnostics. A narrow genuine curvature transition may be a task mechanism; numerical ambiguity or an exhausted verifier is not an admitted reference label. Allow any valid simplification or mathematical solution method.

## Cross-Depth Comparability

Use the same five reviewed family definitions, family weights, label-allocation rule, domain-generation policy and parameter-sampling rules at all eight levels. Extend matched construction paths where mathematically justified and retain shared-core/prefix relationships as clusters. Such related cases do not supply independent depth samples. Keep the number and placement of challenging mechanisms visible so a change in family mix or an easier outer layer cannot masquerade as a depth effect.

Record input tokens/characters, branching, derivative/range scales, numerical margins, simplified structure and certification rejection rates by level. Depth and input size will generally co-vary; matched families alone do not isolate a causal depth effect. Representation/length controls can support a separate analysis, but must have their own identities and cannot silently replace the frozen inputs.

Report actual per-level accuracy and macro-F1 with class counts and completion. Do not sort, smooth or change cases to force descending scores. A low score caused by context overflow, output truncation or a deadline is a budget/compatibility observation, not a demonstrated wrong mathematical classification. Freeze the treatment of unsupported model/level cells before scoring and show them as unavailable rather than dropping them from the curve.

## Development, Freeze and Fresh Evaluation

1. **Establish feasibility.** Produce an independently checked domain and reference argument for each mechanism and target level, including counterexamples to tempting incorrect rules. Measure certification work, rational/interval growth and rendered input size. Verification: replay actual ASTs and compare the independent proof and evaluator; unresolved disagreements block admission.
2. **Explore on development cases.** Use separate source clusters to investigate observed mistakes and candidate mechanisms, within the 30-send ceiling. Retain successes, failures, truncations, unsupported cells and all model-informed changes. Verification: an exposure ledger binds every request, construction revision and visible-text diagnosis. Do not spend the final population during development.
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
| Generator quality | Exact 5/10/20/40/80/160/320/512 stage measurements, frozen 100-per-level coverage, matched cross-depth family/parameter rules, distinctness/cluster ledger, simplification and label-cue controls, independent construction replay. |
| Single-trial integration | New identities, no mutation of ordinary three-trial profiles, correct completeness/denominators, privacy and extraction fixtures, independent hand-calculated metric examples. |
| Live study | Frozen manifest, verified model access, reconciled sends, exact request bindings, all attempts/outcomes retained and no hidden retries. |
| Final evidence | Credential-free score replay, transcript-linked diagnoses, reviewed references and correctly qualified claims; all-success outcomes retained honestly. |

Before coding, write `docs/plans/15-deep-composition-stress-evaluation.md` with concrete file ownership, interfaces, chosen proof policies, finite work bounds and exact new CLI/replay commands. Reuse the current scoring and transport paths wherever their contracts fit. Implement mathematical generation/certification and single-trial execution as separately owned workstreams after interfaces agree; do not rewrite the UI or leaderboard to conduct the experiment.

Run applicable new reference/generator/protocol/scoring tests, existing affected regressions, `bun run lint`, `bun run typecheck` and `bun run build`; run `bun run numerics:test` and `bun run numerics:lint` if numerical code changes. Record actual results, not planned checks as passes.

Deliver the frozen suite, independent references, split/exposure and quality ledgers, versioned single-trial runner/report, private dispatch/response evidence and a safe reproducible results bundle. Write `docs/handoffs/15-deep-composition-stress-evaluation.md` with implemented scope, exact commands, outcomes, resource/cost evidence and remaining limitations. No implementation, certification or model failure is established by this phase document.

## Time and Submission Boundaries

Timebox initial deep-certification feasibility to two hours of implementation. If targets through 512 stages cannot be verified reliably, stop expansion and document a smaller proposed population/depth amendment before its scored run. Preserve the target and reasons; do not substitute a smaller or easier suite under the same identity. The hackathon delivery plan should reserve the last four hours before the deadline for clean reproduction, packaging and the video; actual scheduling must use time remaining when implementation starts.

This phase supplies evaluation evidence to modules 12/13 and submission planning. It does not authorize external submission, deployment, changed agreements or invented failure claims. Keep prior-work attribution and AI/human review provenance accurate in submission documentation. The single-trial choice must remain explicit, including its difference from the event guide's multiple-trial recommendation; this phase does not certify submission eligibility.
