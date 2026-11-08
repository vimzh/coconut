# 14b upstream integration and adaptive pilot handoff

Implementation checkpoint: `d12bdf4` (2026-11-08). See the [plan](../plans/14b-randomized-certified-evaluation.md) and [source/admission research record](../research/upstream-import-integration-v1.md). The current 27-task three-response product, historical data, native numerical limits and public UI are unchanged.

## Implemented boundary

- Original external-process adapter, pinned source/environment checks before and after generation, serial batch/seed schedule, finite CSV/process/input bounds and retained source artifacts.
- Independent exact-display scalar parser and separately named deep reference policy. Whole-interval domain/curvature proofs and strict opposite-label exclusion are mandatory; neither requires two rigorous Jensen violations. Unknown/overflow never supplies a reference label.
- First-admitted three-class selection, complete candidate/rejection ledger, exact and significant-core/full-shape exposure signatures, source/reference replay and panel-local evidence retention.
- Separate single-response adaptive runner, neutral request-body bindings, official isolated SDK, max reasoning, no retries, immutable synced dispatch receipts, bounded accounting, atomic panel publication and owner-bound lock recovery. Ordinary three-trial reports/ranking are not reused.
- Credential-free per-panel and aggregate single-trial scoring. Wrong valid labels require independent transcript/reference review before an error endpoint; output/service failures stop for diagnosis.

## Verified first development population

At requested source depth 216, four serial batches supplied 24 candidates: eight per class. Nine exact displayed functions verified (two convex, two concave, five neither); fifteen remained unresolved for strict opposite-label exclusion. The first verified nonduplicate task in each class forms the three-question panel. Selection was complete before any model response.

| Label | Realized source depth | Expression-tree depth | Variable-dependent nonlinear path | Parsed nodes | Reference |
| --- | --- | --- | --- | --- | --- |
| Neither | 216 | 422 | 201 | 1,247 | Strict opposite Jensen gaps on [−1, 1]. |
| Convex | 216 | 665 | 211 | 2,049 | Whole-interval composition proof with structural strictness. |
| Concave | 217 | 670 | 239 | 2,071 | Whole-interval composition proof with structural strictness. |

These are distinct measurements. In particular, requested 216 does not mean 216 verified nonlinear stages. This is a bounded, admission-conditioned development population, not a final 800-task suite or a general difficulty result.

Independent review rehashed all four source batches, replayed all 24 references and first-admitted membership, checked all accepted domains, and directly reevaluated the neither witnesses at 512 bits. The retained Jensen gaps are strictly negative for endpoints 13/16 and 15/16 and strictly positive for endpoints −1 and −7/8, each at t=1/2. Convex and concave structural strictness passed the reviewed rule policy.

Final admission bundle SHA256: `99d603a5390921ca94798db1b21da4d901447caf60d310f33e40e127573bb71e`. Panel ID: `adaptive-panel-08191d9b1e1dffb8a5537f2aa7b5d06f4a00c87813318ee3c297219b78aa54b0`.

Earlier offline preparations were retained as superseded before inference after independent review repaired domain propagation, parser ambiguity and arithmetic bounds. All four CSV batches reproduced byte-for-byte in three generation passes; these are the same 24 distinct source candidates, not model-informed replacements. Private receipts retain all environment versions, arguments, source/output hashes and rejection details.

## Verification

| Command/check | Actual outcome |
| --- | --- |
| `bun run test` at the implementation checkpoint | 765 API tests and 77 frontend tests passed. |
| `bun run lint` | API and frontend passed. |
| `bun run typecheck` | API and frontend passed. |
| `bun run build` | API bundle and optimized Next build passed. |
| `bun run numerics:test` | 40 tests passed, including 11 new deep-reference tests. |
| `bun run numerics:lint` | Passed. |
| Final targeted randomized tests | 19 passed, including an additional hand-calculated 800-case single-response regression after the full checkpoint; final API lint/typecheck passed. |
| Generation/replay | Four batch CSVs identical across three generation passes; complete current admission replay passed. |
| Independent reviews | Mathematical and integration findings repaired before any inference; final code/actual-admission reviews found no blocker in their scoped checks. |

Tests include invalid original domains hidden behind zero products/division, ambiguous number/bracket syntax, arithmetic limits, two-sign witnesses, exact display semantics, one-trial hand calculations, incomplete populations, budget/midpoint/stop rules, actual SDK request privacy, receipt-before-send behavior, write failures, unknown provider states, exclusive locks and dead-owner recovery. The existing SDK/header-isolation, frozen dependency and historical numerical policies are preserved.

## Private reproduction commands

Generation dependencies are installed in a separate environment; do not install upstream provider/model extras or vendor its source. The external checkout must be clean at the pinned revision. Paths below are examples; retain receipts rather than depending on the original machine's checkout path.

```sh
git clone https://github.com/yepengliu/ConvexBench /tmp/external-generator
git -C /tmp/external-generator checkout --detach 6f156c8c9b6b0b85f6a191bd4eb912e12e670082
uv venv --python 3.13 /tmp/coconut-14b-generator-env
uv pip install --python /tmp/coconut-14b-generator-env/bin/python numpy==2.1.2 pandas==2.3.1 tqdm==4.67.1
bun apps/api/src/randomized/cli.ts prepare --checkout /path/to/pinned-checkout --python /tmp/coconut-14b-generator-env/bin/python --output /new/private/panel-candidates --depth 216 --panel 1
bun apps/api/src/randomized/cli.ts replay --bundle /new/private/panel-candidates/admission.json
```

The live workflow is run from `apps/api` so Bun loads the configured development environment without printing or copying its credential. It uses one fixed private study root, refusing a second `init` or any started-panel rerun. Provide a genuine independent admission review bound to the actual bundle hash before `freeze`; do not manufacture approval fields.

```sh
cd apps/api
bun src/randomized/cli.ts init
bun src/randomized/cli.ts freeze --bundle /private/panel-candidates/admission.json --review /private/admission-review.json
bun src/randomized/cli.ts run --panel 1 --accept-charges true
bun src/randomized/cli.ts review --panel 1 --review /private/actual-outcome-review.json
bun src/randomized/cli.ts status
```

Never rerun these paid commands against the completed retained panel. `unlock` removes only a demonstrably dead local process's lock; it does not resume requests or erase receipts. A started incomplete panel remains blocked for explicit evidence diagnosis.

The private study root is `apps/api/data/private/randomized-v1/`; its retained panel contains the exact source CSVs, candidates, references, admission review, frozen prompts, dispatch receipts and outcomes. Original preparations are `apps/api/data/private/imported-216-development-v{1,2,3}/`. These paths and the configured environment file remain excluded from Git. Upstream source/output clearance remains unresolved; no generated questions or transcripts are public application assets.

## Pilot and gate disposition

The first panel was frozen after independent admission review, with the new shared allowance at 0/30. Requested model is `gpt-6-astra`, profile `one-shot-json-v2-max`, 16,384 output tokens, 180-second inference deadline, one response/task and no retries. It is now terminal under the frozen **inconclusive-panel stop rule**:

| Outcome | Actual count |
| --- | --- |
| Planned questions | 3 |
| Dispatched inference attempts | 2 |
| Complete valid correct answers | 1 (neither) |
| Wrong valid / unusable answers | 0 / 0 |
| Infrastructure timeouts | 1 (convex; remote outcome unknown) |
| Unattempted questions | 1 (concave) |
| Retries / probes / deeper panels | 0 / 0 / 0 |

The neither answer completed in 143,419.49375 ms; the convex operation ended after 181,022.542833 ms including metadata, under the 180-second inference bound. Requested/reported Astra identity, max reasoning, output cap and disabled truncation were verified for the completed answer. Known usage is 2,624 input and 8,647 output tokens, including 8,307 reasoning tokens as a subset of output. Timeout usage and billed costs are unknown, not zero.

The mechanical score projection is provisional: accuracy **1/1 included outcomes**, with **1/3 planned coverage**. Fixed-three-class macro-F1 is **1/3**, because convex and concave have no included support; this is not two wrong classifications or a completed benchmark score. Independent extraction/reference/arithmetic/visible-text review confirmed the one correct label and its simplifying argument; no explanation error was substantiated. The long source expression has a valid short reduction, so size/depth alone is not evidence of intrinsic difficulty.

Canonical terminal result SHA256: `0a5a05e75728a986cfdb4b4583d04916dc61245e50384488b76585d7aedfd604`. The independent review is retained with all three reference bindings and an empty verified-wrong list. The CLI's final decision is `stop: inconclusive`, with no error/all-correct interval endpoints. See the [safe terminal summary](../research/imported-pilot-summary-v1.json); raw replies and source expressions remain private.

**Pilot-signal verdict: inconclusive; no verified mathematical-failure signal.** There was no escalation to 512/1000 or midpoint, replacement, retry or final-study dispatch. Conservative shared-development accounting is **2/30**, including the unknown send; **28 remain**. The stopped search does not automatically authorize spending them: a further diagnostic/settings change needs a separately frozen amendment and must retain these two sends.

## Scoped gates and remaining limits

- **G-RANDOM: scoped technical Go** for the pinned external scalar adapter and independently replayed `deep-import-reference-v1` population on [−1, 1], demonstrated at requested 216. This does not certify arbitrary upstream syntax, future depths, the final 800 or public distribution rights. Fifteen unresolved strictness cases remain excluded and visible.
- **G-SPLIT: scoped Go for the known development-exposure handoff.** The new 24 proposals, including rejected/quota-filled ones, have exact/significant-core/full-shape indices. The twelve previously documented seed-0 smoke expressions at requested 5/20/100/512 were reconstructed in a separate retained ledger; depth-512 display lengths match the earlier record exactly (14,289/14,794/9,511). The current three accepted questions have no exact/significant-core/full-shape match against those twelve. The final split is not yet built; Phase 15 must consume both known exposure indices and check every final case. No structural independence, public/training nonexposure or contamination-free claim follows.
- **Public incorporation/redistribution clearance: unresolved.** No upstream software/output license was found. The source remains external and all generated expressions/transcripts remain outside public/submission bundles. This is an explicit limitation, not an inferred permission grant.
- **Empirical deadline diagnosis remains open.** The timeout is a resource/compatibility observation. It cannot be counted as a wrong mathematical label or a greenlight based on a below-100 score. Higher-depth feasibility and a complete frontier-error panel are unestablished.

Known earlier-exposure evidence is retained at `apps/api/data/private/known-source-smokes-v1/`, including source receipts, hashes, parser signatures and the exact pilot-overlap check. Local production web was rebuilt and restarted on port 3200; this module adds no UI surface or public result row.

Phase 15 remains separate and unimplemented. It must establish fresh full-population feasibility, exclude all recorded development questions/related cores, freeze 100 admitted cases at each of its eight requested levels and reconcile the remaining shared allowance before any final dispatch. No 800-case launch is authorized by this inconclusive pilot.
