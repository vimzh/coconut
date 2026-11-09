# Cheap-model depth screening: 100 questions per depth

Completed **2,400 retained evaluations**: the same 800 certified functions on each of three additional models, one answer per question. Each requested depth 5/10/20/40/80/160/320/512 has **100 questions per model**. The expansion preserves all 240 answers from the [initial screen](cheap-depth-screen-v1.md) and adds **2,160 new calls**, with no resends or replacements. The new batch took **64.940 seconds**, reaching the authorized maximum of **120 concurrent calls**.

| Model | Correct / 800 | Accuracy | Macro-F1 / 100 | Wrong valid | Unusable |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | 320/800 | 40.00% | 39.59 | 464 | 16 |
| `gpt-4o-mini` | 282/800 | 35.25% | 30.27 | 468 | 50 |
| `gpt-5.6-luna` | 296/800 | 37.00% | 30.11 | 504 | 0 |

All 2,400 attempts returned model outcomes: **898 correct labels, 1,436 wrong valid labels and 66 invalid completed replies**. There were no provider failures, identity failures, unknown remote outcomes, refusals, truncations, retries, active calls or unattempted cells. Invalid replies remain scoring failures. Accuracy uses all 800 model outcomes; macro-F1 averages the three reference classes, counting invalid replies as missed classifications. Explanation findings do not alter the official label grades.

## Requested-depth results

Each cell gives **macro-F1 / accuracy**, both on a 0–100 scale. Every cell has 100 model outcomes. Requested source depth is distinct from realized source depth D/D+1, raw AST depth and nonlinear-path length.

| Requested depth | GPT-4.1 Mini | GPT-4o Mini | GPT-5.6 Luna |
| --- | ---: | ---: | ---: |
| 5 | 40.32 / 45.00 | 34.09 / 34.00 | 54.95 / 54.00 |
| 10 | 35.71 / 35.00 | 33.36 / 40.00 | 35.06 / 37.00 |
| 20 | 36.24 / 37.00 | 22.67 / 27.00 | 29.65 / 36.00 |
| 40 | 36.67 / 37.00 | 20.61 / 32.00 | 26.42 / 35.00 |
| 80 | 41.46 / 40.00 | 18.56 / 31.00 | 18.57 / 34.00 |
| 160 | 36.05 / 39.00 | 30.02 / 39.00 | 16.16 / 32.00 |
| 320 | 36.83 / 44.00 | 33.34 / 41.00 | 18.57 / 34.00 |
| 512 | 34.11 / 43.00 | 29.74 / 38.00 | 18.63 / 34.00 |

The curves are nonmonotonic, and all three models already make substantial errors at the lowest selected depth. More questions improve coverage but do not guarantee steadily falling scores. This single-trial study does not measure repeat consistency, establish a universal failure depth or isolate a causal effect of depth.

## Population and execution

The [frozen expansion plan](../plans/cheap-depth-expand-v1.md) reuses the original independently certified 800-case source pool: 267 convex, 267 concave and 266 neither. The initial 80-case subset remains included unchanged. The additional 90 cases at every depth include 30 per class; no case was chosen using model answers. Each model receives identical functions, exact coefficients and the interval `[-1,1]`. References come from independent certification of the displayed mathematics, not trusted source labels. Construction and provenance remain in the [Module 15 handoff](../handoffs/15-deep-composition-stress-evaluation.md) and [generator research record](randomized-evaluation-design-v1.md).

These are reused source-pool tasks, not a fresh independent holdout. Certification filtering, related mathematical structures, input length and simplification confound interpretation beyond this population. Training nonexposure and full semantic inequivalence remain unknown. The earlier [620-task study](deep-study-results-v2.md) used a subset of this source pool and different reasoning/output/runtime settings; its overall scores are not directly comparable with this screen.

The private profile permits **8,192 output tokens and 180 seconds per call**, with neutral exact-expression/domain messages, strict JSON extraction, no tools and no automatic or explicit retries. GPT-5.6 Luna explicitly requests `reasoning.effort: none`; the legacy models omit the reasoning parameter. Reported reasoning usage is zero for all 2,400 outcomes. Reported identities remain pinned to `gpt-4.1-mini-2025-04-14`, `gpt-4o-mini-2024-07-18` and `gpt-5.6-luna`. The original screen's three scored identity checks remain part of its retained answers; no additional inference probes were needed.

The 2,160-call continuation ran from `2026-11-09T01:15:09.841Z` to `2026-11-09T01:16:14.781Z`. Its measured peak was 120 authorized active calls. No 429 or rate-limit fallback occurred. The configured fallback to 96 then 72 concurrency was unused. This was 120 simultaneous requests, not a promise to start 120 new requests every second. The initial 240-call screen's separate 41.885-second execution is excluded from the continuation duration.

## Usage and listed-price estimate

The table covers all 800 answers per model, including the initial screen. Reasoning tokens are already included in output; their reported subset is zero throughout.

| Model | Input tokens | Output tokens | Uncached list-price estimate |
| --- | ---: | ---: | ---: |
| `gpt-4.1-mini` | 1,971,472 | 182,475 | $1.080549 |
| `gpt-4o-mini` | 1,971,472 | 100,333 | $0.355921 |
| `gpt-5.6-luna` | 1,970,672 | 101,557 | $0.516003 |

Total reported usage is **5,913,616 input tokens and 384,365 output tokens**. The approximate **$1.95** total uses uncached listed text-token rates from the official [GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-4o Mini](https://developers.openai.com/api/docs/models/gpt-4o-mini) and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) pages. This is a calculation, not a returned bill; cache discounts and actual billing may differ. Both legacy models successfully executed despite their listed deprecation status.

## Independent review and verification

All **2,400** raw outcomes mechanically replay against exact request/reference/receipt/result bindings, pinned identities, settings and strict extraction. Independent arithmetic matches all **27** overall/per-depth slices, including every confusion count, accuracy and fixed-three-class macro-F1. The 240 inherited cells also match their original immutable journals. All unusable replies have retained deterministic protocol diagnoses. No outcome was replaced after review.

Visible-response inspection follows the pre-dispatch plan: all 240 original replies plus the first previously unattempted source-order case of each reference class at every depth, identical across models. That adds 24 replies per model, for **104 per model / 312 total**. Reviewers inspected **119 correct-label explanations** and retained **32 explanation findings**:

| Model | Raw outcomes replayed | Visible replies inspected | Correct-label explanations inspected | Findings on correctly labeled replies |
| --- | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | 800 | 104 | 40 | 6 |
| `gpt-4o-mini` | 800 | 104 | 37 | 14 |
| `gpt-5.6-luna` | 800 | 104 | 42 | 12 |

The 32 findings include the original 27 and five additional findings; they remain separate from label scores. This inspection was AI-assisted and covers visible explanations, not hidden reasoning or formal explanation certification. The remaining **2,088 responses were not manually inspected for explanatory correctness**. The exhaustive mechanical audit establishes scoring consistency within the certified population, not the correctness of every model argument.

Combined operator coverage passes **26 tests / 3,309 assertions**. Strict TypeScript, ESLint and Bun bundle build pass; independent code review found no blocker before dispatch. The 34,062,919-byte frozen manifest stays below the unchanged 64MiB cap. A post-terminal seal verifies the three model audits, all 800 digest bindings per model, the predeclared review population, independent metrics and the measured concurrency bound.

## Evidence identities and delivery

All SHA-256 artifact identities below use the existing canonical JSON hashing convention; the operator identity hashes source bytes.

- Study: `cheap-depth-expand-v1-ec3c585b521a4e1dbd9b552de33521c160c37c501b644a168751e8d1ff0c4b40`.
- Freeze: `2026-11-09T01:14:31.130Z`; final audit seal: `2026-11-09T01:22:46.297Z`.
- Manifest: `e0bc4bb0db07e31752e3d590ff2a3b1ac0b3348e575aa0ea65a83a589feaa895`.
- Retained report: `4236053a3e8a950707d0727f647150d86d0879ed800151c0a7468ba0395605e5`.
- Combined rows: `801e31458997371e1872ca63cf503e69a8336b9a0931a0e92891fdf8ee049b10`.
- Terminal: `f8482ce130d174f182f2c5688e2142a592628ec48d5bdea0afaede081eba37a4`.
- Pre-dispatch review plan: `478f99ed07e8902d32d084090204f7250a0df50604052c4bbe608134811da07f`.
- Operator bytes: `42ba0a06609d265810557057b04313fa200204215cdd70acdefe0dfdc86e4474`.
- API implementation at freeze/execution: `6d9d07b5f4147ffe321875da19e36bfb2c8491ca361eec0c914db6e2d3179fb2`.

Private evidence remains in ignored `apps/api/data/private/cheap-depth-expand-v1/`, with adjacent per-model audits, independent metrics, review plan and final audit seal. Raw expressions, transcripts and credentials are not published. The original 80-case record remains separate and reproducible from its own evidence. This expansion makes no main application/API-source changes and does not replace the landing page's 620-task comparison or the visitor workbench. No deployment or external submission was performed.
