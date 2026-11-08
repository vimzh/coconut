# Results of the standard reserve attempt

**Both frozen reserve cells failed without a retained model answer.** The final ledger settled on **2026-11-08 at 10:28:38.142 UTC**. The study planned 108 trials; eight dispatched inference attempts finished locally as two timeouts and six cancellations, all with **unknown remote outcomes**. The other 100 trials were never attempted. Macro-F1 and accuracy are **unavailable, not zero**.

| Requested model | Planned trials | Finished infrastructure attempts | Timeouts | Cancelled | Unattempted | Included model outcomes | Accuracy / macro-F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `gpt-6-astra` | 54 | 4 | 1 | 3 | 50 | 0 | Unavailable |
| `gpt-6.1-sol` | 54 | 4 | 1 | 3 | 50 | 0 | Unavailable |

Each request used the frozen `one-shot-json-v2-max` profile, max requested reasoning, a 16,384-token output ceiling, concurrency four, one inference attempt per trial and zero retries. The standard metadata/inference deadlines remain **20/180 seconds**. No returned response supplies an observed model identity, effective settings, model-outcome token usage, latency or monetary cost. Requested settings must not be substituted for missing provider-reported evidence.

This is an infrastructure-limited, incomplete execution of an **adaptive exploratory** population: 18 fixed mathematical tasks, three families and two related source groups at depths 17 and 23. It is unranked, has no eligible confidence interval and cannot produce G-SIGNAL. Timeouts and cancellations do not establish a mathematical classification error, refusal, reasoning-budget exhaustion, model inability or provider outage cause.

The [execution plan](reserve-experiment-v1.md), [operational amendment](conditional-reserve-operational-amendment-v1.md), [coordinator decision](conditional-reserve-decision-v1.md) and [independent reference review](independent-reserve-review-v1.md) retain the admission history. Their implementation-era statements about future execution describe earlier checkpoints; this result record binds the later actual terminal evidence. The amended observed-data condition never proved the original absolute absence-of-error condition: eleven original frontier remote outcomes were already unknown.

## Frozen evidence and send reconciliation

The [machine-readable review](../../apps/api/data/quality/reserve-study-review-v1.json) is **191,614 bytes**, file SHA-256 `7f1b266c4193f2be76695491134dc7fc0ecda0bd242b685e5b5233e8a9911c8d`, canonical SHA-256 `ea8b2179a3b256bb7a273a2081f0f27c347e52cd2b7492165bc356b8f258d3c9`. It contains source hashes, exact accounting, infrastructure inspections, full offline quality reports, production projection checks and explicit limitations. It contains no model transcript, credential or run-access code.

Unless identified as a file hash, hashes below use `qualityDataHash`: recursively key-sorted JSON, with array order preserved.

| Evidence | Canonical SHA-256 |
| --- | --- |
| Frozen `conditional-reserve-matrix-v1.json` | `a27c2ec00a34ac5d448c172126ece0c5a40d9407b1ed44c511f03d42abd69d41` |
| Final `conditional-reserve-progress-v1.json` | `07ca4c3b50c7dc300440157d1551c0749d7b463e073cf1e07bb3aadd17daefa3` |
| Retained `conditional-reserve-progress-v1-archive-source.json` | `4dd3b01ac5c70373ad2ada2221cebfc64333debe08afe05262d02d97aa21127f` |
| Empty public archive index | `e7611cb0f3dfc49e0ce7cd7aeac3e44d34e86654ce064f19244bbad4170b8e3a` |
| [Primary reconciliation](../../apps/api/data/experiments/conditional-reserve-reconciliation-v1.json) | `ee62acdec9b1ee0ec81a6a7704042f9f01b9a8629dc869c4b3ba3a9225403fed` |
| [Per-attempt send evidence](../../apps/api/data/experiments/conditional-reserve-send-evidence-v1.json) | `a91613e95f40f924f95a7f81d01fa7281bc4b8e83343fcce869826a693a423a2` |

The primary and send proofs were checked at **10:42:00.980 UTC**, after final settlement. They cover exactly the two unique started run/cell pairs, zero active trials and all eight retained attempts. Each primary `recordSha256` and send `viewSha256` hashes the **whole actual private RunView**, including its unchanged `publishedAt:null`.

| Run ID | Whole private RunView SHA-256 |
| --- | --- |
| `ae009f7f-a0d7-4250-a739-297f253aec6d` | `e98802d28d40545de9cd082e46ae8b8ace4ba247f050684b6e84deb00b487868` |
| `9bca7252-af69-44ab-b313-71dadbf5ec8b` | `10edc34a12fd3d91ed2ba0bae0a00e8102b20c707e590c6d439ff9398deb9f55` |

All eight actual result hashes, case/trial identities, counters and failure projections were replayed against those views. Every result has one recorded inference send, two HTTP attempts and `remoteOutcome:unknown`. The total is **eight inference sends and sixteen HTTP attempts**; metadata HTTP operations are not additional model inferences. The actual exported send validator accepts the exact projections and totals.

Generic profile workload upper bounds are retained separately from actual execution. They do not change the frozen 54-trial-per-model, one-attempt study plan or substitute for the observed per-attempt counters. The 100 unattempted trials remain explicit missing work.

## Empty archive and exact source provenance

The public archive contains **zero records and two omitted failed cells**. It exports neither private failed record. There is no public model result or public/private whole-record comparison to manufacture.

The archive index's `ledgerSha256` correctly binds the **persisted archive-source snapshot**, whose `updatedAt` is `2026-11-08T10:28:38.141Z`. Final progress has `updatedAt:2026-11-08T10:28:38.142Z`. Comparing every field shows that **only `updatedAt` differs**: cell/run identities, failed states, counts, publication/archive flags, errors and interpretation are equal. The snapshots intentionally have different whole-object hashes. The proofs use final progress for accounting, while the archive preserves its exact earlier source binding; neither file was overwritten.

## Unavailable reporting and scope of review

Independent arithmetic replay verifies both retained reports, including their original 54-trial denominators, zero included model outcomes, excluded infrastructure/missing work, null scores, per-class/confusion denominators, every depth, token and cost coverage and trial diagnostics. Separate actual shared-scorer replay reproduces the full reports exactly. Full quality/native replay also verifies the fixed references, canonical prompts and requested budget/settings policy.

The exact mathematical membership matches the independently reviewed fingerprint `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`. This supplies reference/runtime evidence, not a model-performance observation. No mathematical answer or explanation exists to inspect in this attempt. All eight infrastructure records were inspected and their unknown remote outcomes preserved; no hidden label, refusal or error is inferred.

A separate AI-assisted checker executed the production adapter on the **actual private unpublished RunViews**. It confirmed unavailable scores and complete outcome/status accounting, including every unattempted trial. Across full/depth and actual curve selections it verified **36 report exports** and **18 usage-series queries**; unavailable multi-run export is rejected. Its 341 assertions also cover source immutability, exact shared-scorer equality and correct archive provenance. These are offline projection checks, not browser rendering, accessibility checks or evidence that a private result became public.

Both quality gates are **No-go**, with `exploratory-reserve-coverage`, `complete-trials` and `outcome-inspection` blockers. Both confidence intervals remain unavailable and both G-SIGNAL verdicts are No-go. The infrastructure inspection does not satisfy missing mathematical trials or repair those blockers. Review is AI-assisted and supplies no human mathematical approval.

## Conservative accounting and a separate diagnostic boundary

Conservative cumulative accounting through the failed standard study is **7,746**: the prior 7,738 plus all eight dispatched inference sends, within the unchanged 8,192 ceiling. The original eleven, replication 101 and current eight unknown remote outcomes are **already included** in their respective send totals: **120 unknown outcomes in total**, not extra budget additions or unused capacity. No new capability/calibration requests were made here.

Local timeout or cancellation does not prove that upstream execution stopped, completed or incurred no charges. Provider token usage and currency charges are unavailable. The eight sends must remain counted regardless of whether any remote response can later be recovered.

Any **separately versioned, operator-only 600-second SDK diagnostic** is outside this study. If separately admitted for all 54 fresh trials per model, it adds at most 108 requests, giving a conservative maximum of **7,854** from the current 7,746. That is a prospective ceiling, not an execution result. It must retain its own manifest, outputs and review; it does not resume the 100 unattempted standard trials, replace these failed runs or change their 180-second policy. The original records, memberships, scores and missing-work counts remain preserved.

Verification passed: two full source/report arithmetic replays, exact shared-scorer equality, two full quality/native replays, all eight per-attempt hashes and unknown-send projections, actual send-schema validation, the source-bound production projection/export checks, all archive-source comparisons, privacy scans and `git diff --check`. No provider/API call, credential read, database write, publication mutation, source-code change, commit or diagnostic launch occurred during this review. Build and lint were not rerun for these four documentation/data-only additions.
