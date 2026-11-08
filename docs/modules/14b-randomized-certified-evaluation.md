# Module 14b: Upstream Generator Integration and Astra Pilot

## Status and Order

Planned — user-directed amendment on 2026-11-08. Complete [14a product cleanup](14a-product-flow-cleanup.md) first, then integrate the upstream generator and conduct a small development pilot before [Phase 15](15-deep-composition-stress-evaluation.md). This document changes requirements; it does not implement the adapter or dispatch model calls.

This replaces the earlier requirement to build a new multi-route random generator. The MVP reuses an existing generator and adds the minimum admission, reproduction and execution glue needed for a trustworthy evaluation. The previous research remains in the [research record](../research/randomized-evaluation-design-v1.md); speculative sampling frameworks and extra diagnostic panels are deferred.

## Goal

Use the authors' generator to supply varied deep function candidates, check their exact task meaning, then test a few on `gpt-6-astra`. A pilot score below 100 is an investigation trigger. At least one independently verified wrong valid label on a complete, correctly configured pilot provides a scoped signal to proceed toward the larger evaluation. It does not by itself complete the 800-question study or prove a general/repeated model limitation.

The product contribution is the adapted evaluation, admission checks, execution, retained evidence and analysis. Credit the reused generation method; do not present it as an independently invented generator.

## Source and Existing Evidence

Use [the official upstream repository](https://github.com/yepengliu/ConvexBench) pinned initially to revision `6f156c8c9b6b0b85f6a191bd4eb912e12e670082`. Record any reviewed update as a new source identity. A separate local checkout exists at `/Users/vanshgaur/projects/convexbench-reference`; reproduction must use the pinned remote revision, not depend on this machine-specific path.

An offline feasibility check ran the unmodified CLI with one candidate per class at requested depths 5, 20, 100 and 512, seed 0, Python 3.13.17 and NumPy 2.1.2 / pandas 2.3.1 / tqdm 4.67.1. All twelve candidates were generated. These are exposed development samples, not a certified pilot or a reproduction of the paper's exact dataset.

Requested depth 100 returned realized depths 101/101/100; the three requested-512 samples returned realized depth 512. Their expression lengths were 14,289 / 14,794 / 9,511 characters. Convex/concave numerical checks at 512 were `not_evaluable`; neither was marked `verified`. That flag is the upstream numerical-test result, not Coconut's whole-domain certificate. Expanded tree presentation made the three-case CSV approximately 5.29 MB. Initial inspection hit Python's default CSV field limit; bounded inspection with a 16 MiB field limit succeeded. Retain finite input bounds rather than silently truncating fields.

No code license declaration was found in the inspected revision's tracked files or package metadata. Record the applicable permission/licensing evidence before incorporating or redistributing upstream code in the product/submission. Paper licensing is not automatically a software license. Local inspection and generation do not establish distribution rights. Preserve attribution and avoid copying upstream paper names into application source/comments/assets under the existing project instructions.

## Minimal Integration Contract — D-14

1. Run the pinned generator in an isolated Python environment with recorded dependency versions. Install generation dependencies only; do not import its provider backends or replace Coconut's isolated official SDK transport.
2. Add a thin versioned importer/admission path consuming generated expressions and structure. Freeze source revision, command arguments, seed, batch order, source hashes, requested and actual depth, labels and admission evidence. Use structured parsing with an allowlisted operation set; never evaluate generated strings as code.
3. Preserve the upstream random stream behavior. Generate a frozen batch serially or with a proven equivalent partition scheme. Do not require a new random-number framework or claim parallel order independence the upstream implementation does not provide. Retain the actual files, not just seeds.
4. Resolve every task's exact rendered expression and explicit domain, label semantics and proof before admission. The upstream CSV omits Coconut's finite closed interval; do not attach an interval while assuming its label is unchanged. Exclude affine/constant overlap under the existing exclusive-label contract.
5. For convex/concave candidates, audit and independently replay the applicable symbolic construction/domain rules and exclude the opposite class. Numerical overflow can leave a valid symbolic proof intact; `not_evaluable` is neither a proof failure nor numerical confirmation. For neither, retain and independently check strict violations in both directions on the actual supplied domain. Random samples without violations never prove convexity.
6. Check that the displayed, rounded LaTeX and the internally evaluated coefficients denote the same admitted task. Recheck references for the rendered exact values where needed. Reference disagreement, unknown domains and unresolved witnesses block admission; never turn uncertainty into neither.
7. Set finite proposal, recursion, node, rendered-size, field/file, proof-work and process-time limits in the technical plan. Keep native depth-32/node-256 admission unchanged. Deep imports need their own named reference policy; no fabricated native certificate or global cap increase.
8. Keep labels, certificates, witness coordinates, case/cluster IDs and source/family metadata outside actual provider request bodies. Preserve historical suites, prompts, grades, report identities, credentials and publication boundaries.

This is a candidate-source integration, not an assertion that every upstream label or depth is already suitable. Do not rewrite the upstream generator or add new mathematical families unless a reproduced correctness defect requires a narrowly scoped, separately recorded fix.

## Depth and Population Amendment — D-13 / D-15

Retain the eight requested generator-depth settings **5, 10, 20, 40, 80, 160, 320 and 512**, the final target **100 admitted questions per setting**, one response per question per model, Astra inclusion and the existing **30 + 800 × M** ceiling.

For this new adapted study, replace the previous requirement that each setting equal an exact number of nonlinear stages. Use the pinned upstream convention: a reported depth starts from an affine leaf, increments for scalar wraps including some affine operations, and excludes affine aggregators. Requested D can produce realized D+1 after final negation. Record requested depth, realized upstream depth, raw AST depth, variable-dependent nonlinear path and rendered size separately. Primary bucket labels must say **requested generator depth** and show the realized-depth distribution; never silently describe them as 512 verified nonlinear stages or pool them with earlier AST/stage curves.

Reject candidates outside the recorded D/D+1 rule rather than pretending the request guaranteed their measurement. Keep the upstream structure-sampling policy consistent across depth settings and models. Replace the earlier five-family/20-per-family target with measured atom, structure and shared-core coverage; do not rename sequence patterns as independent families. Final class quotas stay 33 per class plus one extra rotating by setting, total 267 convex / 267 concave / 266 neither over 800.

Choose the first admitted, nonduplicate candidates in a predeclared ordinal/quota policy, within finite proposal bounds. Retain failures/rejections and acceptance counts. Do not choose final cases by Astra correctness. Parameter/domain/sign variants and significant shared cores remain related groups. A different seed or hash does not establish independent mathematics. Track development exposure and check final/pilot overlap conservatively; do not claim structural generalization or contamination-free data.

## Adaptive Astra Development Search — D-16

This replaces the earlier fixed 24-question/eight-depth pilot; it does not add another pilot budget. A verified error below 512 is useful. The initial requested depth is **216**, followed by **512**, then **1000** only if each earlier completed panel contains three valid correct labels.

| Item | Frozen rule |
| --- | --- |
| Model | Requested ID `gpt-6-astra`, with successful inference access and reported identity retained. |
| Panel | Three independently admitted fresh development questions at each queried depth: one convex, one concave and one neither. One response per question, zero retries. Complete each panel before its decision. |
| Initial path | Query 216. If its panel is all correct, query 512. If that panel is also all correct, query 1000. An independently verified wrong valid label at 216 gives an initial signal without requiring a deeper error. |
| Interval exploration | If a higher panel has a verified error and a previously queried lower panel was all correct, investigate that candidate interval using new panels. For the 512–1000 interval, query 750 first, matching the user's proposed coarse midpoint. Otherwise use `floor((L+H)/2)`. Update L on a complete all-correct panel or H on a panel with a verified wrong valid label. |
| Maximum work | At most **nine depth panels × three questions = 27 search sends**, plus at most **three inference compatibility/probe sends**, all within the existing shared **30-send development allowance**. Prior development/probe sends consume this allowance; fewer panels may remain. |
| Stop rules | Stop when a 216 panel supplies a verified error; when the initial path through 1000 is all correct; when a candidate interval is at most 16 requested-depth units wide; at nine panels; or when the remaining budget cannot fund an entire panel. Never exceed requested depth 1000 under this design. |
| Inconclusive panel | Only panels with three valid labels can establish all-correct or error endpoints. Invalid/refused/truncated responses, infrastructure/missing work, unsupported input limits, or unresolved reference defects stop the search for diagnosis. Independently verified point errors in an otherwise inconclusive panel remain reportable, but do not justify interval updates. Do not silently retry or escalate because a score is below 100. |
| Selection | Freeze source, seeds/ordinal schedule, class quotas, candidate limits, depth-selection algorithm, settings and stop rules before the first response. Before each adaptive panel, freeze all three references and prompts. Next depth may depend only on the recorded search rule, not hand-picked equations. |
| Settings | Freeze a strong verified supported Astra reasoning profile, output ceiling and deadlines. Keep them consistent throughout the search; do not induce failure by lowering compute or time limits. A settings change creates a separately identified study and does not reset the budget. |
| Concurrency | At most 12 aggregate active inference requests across coordinated development work; do not launch dependent depth panels before the preceding panel is settled and reviewed. |
| Evidence | Persist dispatch receipts before sends. Retain every panel, reply, score, source/reference hash, settings/usage record, rejected candidate and next-depth/stop decision. |
| Scores | Accuracy, macro-F1, class counts and planned/completed/model-outcome coverage for each three-question panel and the full adaptive development population. Denominators are the actual frozen panels, not the former 24 or the final 800. |

### How to interpret interval narrowing

This is **adaptive exploratory interval narrowing**, not a proven binary search for a threshold. Binary search would require a monotonic predicate; a model making an error on one three-question panel is not such a predicate. Different functions, small panels and one-response variability can produce an error at a shallower depth and all-correct answers deeper. Record any such inversion; stop narrowing and report the observed pattern rather than deleting the inconvenient panel or claiming a unique minimum failure depth.

Here “all correct at L” means only that the three retained questions at L were answered correctly. It does not establish competence at L or below. An error at H establishes only the independently checked observed counterexample(s), not failure on every question at H or above. The 16-unit stopping width is a work-control choice, not statistical resolution or a confidence interval.

Requested depth 1000 and its possible realized 1001 are **new feasibility targets**, not supported by the earlier smoke checks through 512. Check bounded generation, recursion/structure size, exact-domain references, parsing/rendering, context fit and request/read limits before querying any new depth. Report unavailable support without padding depth, truncating the expression or inventing a certificate.

### Development decision

| Observation | Decision and allowed claim |
| --- | --- |
| A complete correctly configured panel has a wrong valid label whose exact expression/domain/reference and visible reply are independently rechecked | **Initial pilot signal found.** At 216 this is enough to stop the search; after deeper escalation the bounded interval exploration may characterize a candidate region. Report all panels and the actual counterexample(s), not a universal failure threshold. |
| A score is below 100 solely because of output formatting, refusal, truncation or missing/service work | Diagnose it; no mathematical-failure endpoint or signal follows. |
| A reference, domain, rendering, extraction or request defect appears | Stop, repair and retain the exposure history. Any new study is versioned; its sends still count against the shared allowance unless separately amended before dispatch. |
| All initial panels through 1000 are correct | Record no observed mathematical-failure signal and stop. Do not extend to arbitrary higher depths or repeatedly regenerate until a mistake appears. |
| An inversion, unsupported depth, exhausted budget or incomplete panel prevents further exploration | Retain the partial search and its reason. Any already independently verified point counterexample remains reportable; missing work is not a completed result. |

A below-100 score is an inspection trigger. A verified wrong classification is the scoped “greenlight” to prepare a larger fresh evaluation, not a completed 800-case result or a waiver of reference, split and budget checks. Keep technical readiness separate from empirical signal. Correct-label explanations can have separate errors; do not change the official label grade.

## Handoff to Phase 15

The order remains **14a cleanup → 14b integration and Astra development pilot → 15 fresh deep study**. The pilot consumes development work before Phase 15, rather than creating a new budget or waiting for Phase 15 implementation.

Deliver a scoped G-RANDOM integration verdict covering only supported upstream imports and actual-domain reference replay, and a G-SPLIT verdict covering the declared exposure/group checks. A supported technical handoff can exist with a negative or unresolved pilot signal; it cannot claim Astra failed. Missing signal does not justify expanding calls, changing final membership or weakening references.

Phase 15 uses the pinned generator/import policy and creates a fresh frozen 800-case population. The exploratory 216/1000/midpoint depths are not automatically added to its eight final buckets; any final depth change must be named and frozen before final generation/scoring, with explicit counts and budget. Pilot cases and related exposed groups do not count as its unseen cases. It owns full-depth/population feasibility, final model matrix, complete execution and independent score replay. The adapted upstream depth convention is the explicit D-13 amendment above; case counts, trials and total call ceiling remain unchanged.

D-12's historical three-trial, repeated-error and uncertainty gates remain unchanged. A single wrong pilot answer can support a point counterexample; no inherited leaderboard ranking, repeated-failure frequency or eligible uncertainty interval follows. Do not initiate the final 800-case dispatch automatically because a pilot point counterexample exists; first satisfy its frozen reference, population and budget requirements.

## Required Plan, Checks and Deliverables

Before coding, write `docs/plans/14b-randomized-certified-evaluation.md` naming the pinned upstream source/environment, permission/provenance evidence, owned importer/reference/runner files, exact offline/pilot/replay commands and finite budgets. Reuse the existing renderer/parser, mathematical helpers, label extractor, scorer and SDK transport where their contracts fit. Avoid new UI, provider stacks, sampling frameworks and speculative abstractions.

Minimum implementation checks:

- Pinned generation replay; correct requested/realized depth and class accounting; cancellation and finite-attempt exhaustion remain observable.
- Exact rendering/domain/reference agreement, strict label exclusion/witnesses, invalid domains, affine overlap and unresolved/overflow boundaries.
- Exact duplicates, shared-core exposure and first-admitted quota selection; pilot/final leakage and actual request-body privacy.
- Hand-calculated perfect/wrong/majority/unusable/provisional scoring fixtures, correct actual-panel/800 denominators, one-trial identity, unique dispatches and zero retries.
- A pilot containing only output failures cannot satisfy the mathematical-signal rule; an all-correct pilot remains visible.
- Relevant affected tests, `bun run lint`, `bun run typecheck` and `bun run build`; numerical tests/lint if numerical code changes. Record actual results and limits.

Deliver the pinned-source/import specification, admitted artifacts and reference evidence, candidate/exposure ledger, initially frozen search-rule manifest, immutable per-panel manifests and the complete adaptive decision/outcome ledger, independent arithmetic/reference/visible-text review, scoped gate verdicts and `docs/handoffs/14b-randomized-certified-evaluation.md`. Include reproduction commands, reported model/settings, actual sends, usage/runtime and unresolved licensing or admission gaps.

This document's current checkpoint is documentation-only: source/link/contract checks are applicable now; implementation and Astra results remain pending.
