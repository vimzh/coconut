# Module 13 handoff: retained reporting audit

## Status

**Reporting audits passed within the recorded original, replication, P5, remaining-model and failed standard-reserve populations.** Module 12 retains historical production/browser and clean-checkout evidence; current-worktree QA is separate and in progress. A newly frozen 600-second operator-only SDK diagnostic is active and has no terminal review yet. This checkpoint does not declare all scientific gates passed. OpenRouter/Hugging Face live inference remains unverified; deployment and hackathon submission/material preparation remain excluded.

The [independent audit record](../research/reporting-audit-v1.md) describes its AI-assisted reviewer role, exact population, separately written arithmetic, source hashes, commands and limits. No human review is claimed. Module 04 remains the only production scorer; this module checks its retained output without changing any grade, reference or protocol.

## Artifacts and checked contracts

- `apps/api/src/quality/reporting-audit.ts` and its tests independently assert class/F1/accuracy/confusion/outcome counts, directional error rates, three-trial spread/agreement, depth differences, semantic token groups/coverage, latency quantiles, cost coverage and expression/prompt/tokenizer measurements. Report and canonical evidence hashes are checked.
- `apps/api/src/quality/audit-cli.ts` and tests expose bounded offline suite/run audits. Regular-file and streamed byte bounds, fatal UTF-8, safe errors, mode-0600 exclusive output and no-overwrite behavior are verified. No provider client is invoked.
- `apps/api/data/quality/reporting-audit-v1.json` records all 212 original source hashes and execution-count results; its SHA-256 is `8081118a768dbf1aa1514e69f908e36c68f7f0f77f44ff79696355392bc66ba8`.
- `apps/api/data/quality/browser-projection-audit-v1.json` records actual production-adapter/export verification for all 212 originals, 652 depth slices and 1,956 depth/usage-filtered exports. Its SHA-256 is `69e8407e89b3851fa4a10dbfcafc53514700b62eab4148efb3d609c9f492c64c`. Projected class/outcome/usage/latency values and filtered memberships agree with the scorer; this is offline frontend execution, not browser rendering.
- `apps/api/data/quality/challenge-v1.quality.json` and `openai-original-astra-high.quality.json` demonstrate reproducible suite/run quality outputs. The former passes the declared offline suite scope; the latter remains No-go because execution is incomplete and review evidence is missing.

Audited identities: scorer 1 / `pooled-macro-f1-v1`, protocol 1, challenge generator `challenge-v1`, numerical verifier `arb-jet-v1`, measured-operation depth policy and `smooth-v2` instructions. Profile-bound suite, requested model/endpoint/settings, prompt and workload identities remain distinct. The original experiment fixes each exact profile in `openai-matrix-v1.json`; unchanged version-1 profiles use 4,096 output tokens and explicitly identified version-2 reasoning profiles use 16,384.

## Observed outcome and interpretation

The original experiment contains **7,236 planned trials**, **214 included correct model answers**, **7,022 provider errors**, and **225 recorded inference sends** across 212 retained runs. Three reports are provisional; 209 are unavailable; none is complete. No valid wrong label was observed. Correct included prefixes do not establish complete-suite accuracy, ranking eligibility, or absence of future errors. The retained scores remain provisional/unavailable; no infrastructure failure is scored as a mathematical error.

All 212 original report arithmetic checks passed. Reported reasoning tokens are consumed only when explicitly supplied with their semantic identifiers; hidden reasoning is never inferred. Direct OpenAI attempts provide no billed cost evidence, so observed cost totals remain null. Local expression-token counts remain unavailable where no matching tokenizer measurement exists. Intermediate-step, first-error and decomposition diagnostics remain **not applicable** to the current one-shot contract.

The 212 existing quality reports all remain No-go for the incomplete original runs. For that original population, G-SIGNAL is **No-go for a mathematical-failure finding**: there is neither a point counterexample nor repeated wrong labels in the required independent clusters. G-QUALITY for the full original experiment is **No-go pending complete execution and applicable outcome review**. The suite's offline Go is limited to its accepted reference/coverage population and does not override either gate.

## Verification and repair handoff

- `bun test apps/api/src/quality`: **29 passed / 139 assertions**, seven files.
- `bun test apps/api/src/quality/audit-cli.test.ts apps/api/src/quality/reporting-audit.test.ts`: **eight passed / 59 assertions**.
- API lint, type checking and production bundle: **passed**. `git diff --check`: **passed**.
- Actual suite and original-run CLI audits: **completed** with the recorded Go/No-go output. All 212 private RunView exports passed the independent arithmetic loop.
- The hand-calculated mixed fixture reproduces macro-F1 `76/105`, accuracy `2/3`, sample trial-F1 SD `sqrt(57)/18`, ten attempts/nine logical trials and missing-data coverage. Rehashed corrupt metric fixtures are rejected.

The source review found a browser adapter reply-length mismatch: 65,536 accepted in the projection versus 131,072 retained by the inference/scorer contract. The integration owner repaired the shared adapter and reported a focused regression pass. Its final integrated visual/browser verification remains with modules 09/12. No other reproducible arithmetic defect was found in the original retained population.

## Remaining requirements

The [module 12 handoff](12-integration-and-submission.md) records module 09/10/11 browser, production, export and comparison evidence, plus historical isolated clean-checkout checks. Final current-worktree QA and the active longer-deadline diagnostic require their own recorded outcomes. The completed later-study audits below retain separate populations and exposure histories. External provider gates require authorized live evidence; deployment and submission remain excluded.

## Terminal replication and prefix addendum

The [terminal replication review](../research/openai-replication-review-v2.md) binds the interrupted ledger at 2026-11-08 07:59:46.559 UTC: **171 completed publications, 35 failed, one interrupted, 26 capability-unverified and five unstarted cells**. There are records for 46 requested IDs and complete cells for 43; this does not establish successful testing of all 47 candidates. All **207 retained reports** pass independent arithmetic. Actual frontend projections pass for all 171 complete public views, **525 depth slices and 1,575 filtered exports**.

Completed publications contain **5,751 model outcomes: 5,066 correct labels, 493 wrong valid labels, 69 invalid replies and 123 truncations**. The separate [prefix addendum](../research/openai-partial-prefix-review-v1.md) closes inspection of the 60 wrong labels and 13 truncations retained in incomplete runs. Together the two reviews inspect **all 758 retained wrong/invalid/truncated outcomes**, without pooling incompatible populations or changing a grade. Wrong-label/correct-conclusion contradictions remain distinct from substantiated mathematical-reasoning errors. All incomplete prefixes remain provisional/unavailable and unranked.

The [anonymous public archive](../../apps/api/data/experiments/openai-progress-v2-published/index.json) retains exactly 171 explicitly published RunViews and lists 67 omitted cells. Failed raw answers and private access receipts remain outside that archive. The cancelling snapshot of one interrupted run and its separate settled cancelled report are both retained; trial and send counts did not change. The operator settlement reader now waits under a bounded acceptance deadline before future final exports; 30 focused experiment tests, API lint/types/build and independent code review cover that repair.

The [replication reconciliation](../../apps/api/data/experiments/openai-reconciliation-v2.json) counts **6,678 new mathematical sends**, giving **7,090 cumulative** with the retained 412 prior allowance. The separately derived [original](../../apps/api/data/experiments/openai-send-evidence-v1.json) and [replication](../../apps/api/data/experiments/openai-send-evidence-v2.json) attempt projections independently reproduce 225/11 and 6,678/101 mathematical/unknown-remote sends respectively. Unknown sends are already included in send totals and never treated as free.

The declared-frontier baseline has **1,402 retained valid labels, all correct**, across original prefixes, full high/max confirmation and all scheduled screening settings. All 432 visible explanations in the two max confirmation runs were independently reviewed in the [full explanation audit](../research/frontier-explanation-review-v2.md), with no substantiated false mathematical claim found. Eleven earlier remote outcomes remain unknown. These are bounded observations, and G-SIGNAL remains No-go for a supported frontier failure finding. Later studies are reconciled separately below; their results do not replace these earlier populations.

## Terminal P5, remaining-model and standard-reserve audits

| Study | Audited terminal outcome | Conservative cumulative requests |
| --- | --- | ---: |
| [P5 interior](../research/interior-results-v1.md) | Two complete published/archived cells; 216 valid correct labels each, no wrong/unusable outcome. | 7,522 |
| [Fresh o3 supplement](../research/remaining-models-results-v1.md) | Eight complete published/archived screening cells; 192 correct, one wrong valid, 11 invalid and 12 truncated outcomes. All 24 wrong/unusable replies inspected. | 7,738 |
| [Standard reserve](../research/reserve-results-v1.md) | Two failed private cells; two timeouts and six cancellations, all eight sends remote-unknown, zero model outcomes and 100 unattempted trials. Both scores unavailable, not zero. | 7,746 |

The corresponding machine-readable reviews are [interior](../../apps/api/data/quality/interior-study-review-v1.json), [remaining-models](../../apps/api/data/quality/remaining-models-review-v1.json) and [standard reserve](../../apps/api/data/quality/reserve-study-review-v1.json). Each binds actual manifest/ledger, original private views, shared-scoring replay, independent arithmetic and the production frontend projections. Exact primary/send proofs retain all unique started cells and per-attempt result hashes. P5 and supplement public/private record bodies are identical, while their wrappers retain different actual publication metadata. The failed reserve's empty archive instead binds its unchanged pre-archive source snapshot; only its update time differs from final progress.

P5 checks include both private/public report pairs, two overall/two depth projections, twelve full/filtered exports and twelve token-series selections. The supplement checks include 16 private/public report replays, eight overall/24 depth projections, 96 exports and 96 usage selections. Failed-reserve checks include both report/scorer replays, actual private unavailable-score projections, 36 exports and 18 usage queries. These are real retained-data checks of production code, not browser-rendering claims. The earlier software test counts remain historical; the current QA pass is not assigned a fabricated count here.

The supplement's single wrong valid label is a substantiated polynomial-derivative error in **o3/low screening**, not a declared-frontier/highest-effort confirmation finding. Its other failures comprise nine format-only replies, two unresolved mixed format/mathematical-argument replies and twelve output-budget truncations. The two mixed causes retain No-go outcome-inspection blockers despite having been read in full; six other scoped reporting gates are Go. All eight cells remain unranked with unavailable intervals and No-go G-SIGNAL. No grade was repaired. Together with the replication audits, **782 retained wrong/invalid/truncated model replies** have been reviewed in their separate populations. P5's 432 and the supplement's 192 correct-label explanations were not qualitatively certified by those study audits.

The preserved-study union contains **47 requested IDs with execution records, 45 with at least one complete published cell**. `gpt-5-pro` and `gpt-5-pro-2025-10-06` have no complete published cell. Alias/snapshot counts do not establish independent architectures, and failed metadata/infrastructure records do not prove a returned mathematical answer. The original/interrupted matrices retain all failed and unstarted work.

Unknown sends remain included once: **11 original + 101 replication + eight standard-reserve = 120**. Cumulative 7,746 also includes the 183 retained controls and four-request calibration allowance once; these are conservative request counters, not bills. No timeout/cancellation supplies a mathematical transcript, inference-permission proof or provider-outage diagnosis. No supported declared-frontier mathematical-failure finding or universal absence-of-error claim follows.

The separately frozen [600-second SDK diagnostic](../../apps/api/data/experiments/long-reserve-matrix-v1.json) is **active, not terminal**, with at most 108 fresh requests and a maximum cumulative ceiling of **7,854 / 8,192**. It neither resumes the 100 unattempted standard trials nor changes the platform/profile's 180-second policy. Its outcomes, bookkeeping and final review remain separate pending evidence.
