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

## Small Astra Development Pilot — D-16

| Item | Frozen rule |
| --- | --- |
| Model | Requested ID `gpt-6-astra`, with successful inference access and reported identity retained. |
| Population | **24 admitted development questions: one convex, one concave and one neither at each of the eight requested depths.** These are separate from the final 800. |
| Selection | Fix seeds, candidate order, admission/quota rules and every pilot case before reading any Astra pilot answer. Do not hand-pick known model failures. |
| Responses | One fresh independent request per question, one attempt, zero automatic retries. Complete the frozen pilot rather than stopping at its first wrong answer. |
| Budget | 24 pilot sends count inside the existing shared 30-send development allowance. At most six sends remain for inference compatibility probes or separately recorded development work; not six automatic replacements. Metadata-only reads are not inference. |
| Settings | Freeze a verified supported reasoning profile, output ceiling and deadlines before dispatch. Use a strong supported Astra effort, preserve unsupported/unknown settings, and do not lower compute or time limits to induce failures. |
| Concurrency | At most 12 aggregate active inference requests across the pilot and any coordinated development work. Reconcile all earlier/concurrent sends first. |
| Evidence | Persist dispatch receipts before sends, retain every reply/outcome/settings/usage and record exact prompt/source/reference hashes. |
| Scores | Accuracy, macro-F1, confusion counts and full planned/completed/model-outcome coverage. Report 24 questions as a development pilot, not an 800-case result. |

All 24 actual references and the complete input/budget checks must pass before pilot inference. If a stratum cannot be admitted or cannot fit the supported input limits, report the pilot incomplete/unsupported; any smaller design is a named amendment frozen before its own calls, not a silent substitution.

### Pilot decision

| Observation | Decision and allowed claim |
| --- | --- |
| Complete pilot, score below 100, at least one wrong valid label whose reference/domain and visible response are independently rechecked, with no unresolved grading/configuration defect | **Pilot signal found.** Report the exact observed counterexample(s) and proceed toward Phase 15's fresh population. This is the MVP's small-pilot signal, not repeated-error or general-reliability evidence. |
| Score below 100 solely because of truncation, refusal, malformed output or service/missing work | Diagnose budget, format or infrastructure. No mathematical-failure signal; incomplete work cannot be called a complete score. |
| Any reference, rendering, domain, extraction or request-construction defect | Repair the defect, retain exposed outcomes and version any new pilot. Do not count an incorrect reference as a model failure. |
| Complete pilot with all correct labels | Record 100 and no observed classification limitation. Do not discard successes, conceal the result or repeatedly regenerate until a favorable failure appears. |
| Partial/unsupported pilot | Preserve every send and outcome, report missing coverage, and make no complete-pilot finding. |

Below 100 is a screening threshold, not proof that the entire evaluation is finished. Keep the technical integration verdict separate from pilot signal. A correct label with a bad explanation gets a separate explanation finding, not a repaired classification grade. Review all wrong/unusable replies; do not infer hidden reasoning or intent.

## Handoff to Phase 15

The order remains **14a cleanup → 14b integration and Astra development pilot → 15 fresh deep study**. The pilot consumes development work before Phase 15, rather than creating a new budget or waiting for Phase 15 implementation.

Deliver a scoped G-RANDOM integration verdict covering only supported upstream imports and actual-domain reference replay, and a G-SPLIT verdict covering the declared exposure/group checks. A supported technical handoff can exist with a negative or unresolved pilot signal; it cannot claim Astra failed. Missing signal does not justify expanding calls, changing final membership or weakening references.

Phase 15 uses the pinned generator/import policy and creates a fresh frozen 800-case population. Pilot cases and related exposed groups do not count as its unseen cases. It owns full-depth/population feasibility, final model matrix, complete execution and independent score replay. The adapted upstream depth convention is the explicit D-13 amendment above; case counts, trials and total call ceiling remain unchanged.

D-12's historical three-trial, repeated-error and uncertainty gates remain unchanged. A single wrong pilot answer can support a point counterexample; no inherited leaderboard ranking, repeated-failure frequency or eligible uncertainty interval follows. Do not initiate the final 800-case dispatch automatically because a pilot point counterexample exists; first satisfy its frozen reference, population and budget requirements.

## Required Plan, Checks and Deliverables

Before coding, write `docs/plans/14b-randomized-certified-evaluation.md` naming the pinned upstream source/environment, permission/provenance evidence, owned importer/reference/runner files, exact offline/pilot/replay commands and finite budgets. Reuse the existing renderer/parser, mathematical helpers, label extractor, scorer and SDK transport where their contracts fit. Avoid new UI, provider stacks, sampling frameworks and speculative abstractions.

Minimum implementation checks:

- Pinned generation replay; correct requested/realized depth and class accounting; cancellation and finite-attempt exhaustion remain observable.
- Exact rendering/domain/reference agreement, strict label exclusion/witnesses, invalid domains, affine overlap and unresolved/overflow boundaries.
- Exact duplicates, shared-core exposure and first-admitted quota selection; pilot/final leakage and actual request-body privacy.
- Hand-calculated perfect/wrong/majority/unusable/provisional scoring fixtures, correct 24/800 denominators, one-trial identity, unique dispatches and zero retries.
- A pilot containing only output failures cannot satisfy the mathematical-signal rule; an all-correct pilot remains visible.
- Relevant affected tests, `bun run lint`, `bun run typecheck` and `bun run build`; numerical tests/lint if numerical code changes. Record actual results and limits.

Deliver the pinned-source/import specification, admitted artifacts and reference evidence, candidate/exposure ledger, complete frozen pilot manifest and retained outcomes, independent arithmetic/reference/visible-text review, scoped gate verdicts and `docs/handoffs/14b-randomized-certified-evaluation.md`. Include reproduction commands, reported model/settings, actual sends, usage/runtime and unresolved licensing or admission gaps.

This document's current checkpoint is documentation-only: source/link/contract checks are applicable now; implementation and Astra results remain pending.
