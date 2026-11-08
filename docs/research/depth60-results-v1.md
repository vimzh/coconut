# Depth-60 exploratory results

The separate nine-task pilot completed on 2026-11-08. Both requested models returned all 27 planned outcomes. The population contains three convex, three concave and three neither tasks, each tested with three fresh requests. It is a fixed exploratory population, not a ranked confirmation benchmark.

| Requested model | Reported snapshot | Correct / planned | Wrong valid labels | Invalid replies | Macro-F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | `gpt-4.1-mini-2025-04-14` | 11 / 27 | 16 | 0 | 0.2900641025641026 |
| `gpt-4o-mini` | `gpt-4o-mini-2024-07-18` | 11 / 27 | 15 | 1 | 0.3151779230210603 |

Both accuracies are 40.7407%. There were no provider failures, refusals, truncations or unattempted trials. The malformed reply retains its invalid grade even though it contains a visible correct concave label; no answer was repaired after inspection. A wrong returned label can also contradict an otherwise correct explanation. Label errors and mathematical reasoning diagnoses are therefore separate.

## Design and reference evidence

The [pre-run plan](../plans/depth60-pilot-v1.md), [frozen request](../../apps/api/data/experiments/depth60-request-v1.json), [suite](../../apps/api/data/suites/depth60-v1.json) and [matrix](../../apps/api/data/experiments/depth60-matrix-v1.json) preserve the exact seed, tasks, prompt/profile identity, model choices and budget before model answers were inspected. All nine references replayed through the existing exact generator/verifier.

A separately written Python standard-library rational checker independently measured depth 60, checked active envelope pieces and global piecewise slope monotonicity for the convex/concave cases, and found exact Jensen violations of both properties for each neither case. The [retained checker](depth60-reference-review-v1.py) and [nine-case evidence](../../apps/api/data/quality/depth60-reference-review-v1.json) are AI-assisted independent reference evidence, not human expert or proof-assistant approval.

Every convex/concave task has 57 active affine pieces and 349 AST nodes; every neither task has 56 active envelope pieces and 345 nodes. The nesting is substantive, but expression length and piece count grow with it. Global closure properties offer shortcuts for the one-sided envelope cases. No shallow matched control, causal depth effect, universal failure threshold, contemporary frontier limitation, or equivalence to the prior research population follows. The selected low-cost legacy models are marked deprecated in their official documentation.

The [AI-assisted independent transcript review](../../apps/api/data/quality/depth60-transcript-review-v1.json) inspected all **32 wrong or unusable replies**. Its primary visible-text diagnoses are 19 written mathematical errors, eight expression misreadings, four label/explanation inconsistencies and one formatting failure. Every row binds the exact model/case/trial, official outcome and raw-text hash. These diagnoses describe submitted text; they do not establish hidden reasoning or model intent. The correct responses were not qualitatively reviewed. No official grade changed.

## Runtime, limits and accounting

The first request for each model reported limits of 30,000 requests and 150,000,000 tokens, with remaining headroom above the frozen thresholds. The runner therefore increased from two concurrent initial calls to at most 12. The span from first trial start to last trial finish was **16.858 seconds**, including per-operation metadata lookup. No serial baseline was run, so this is not a measured speedup factor.

Exactly **54 dispatch authorizations and 54 completed inference results** were retained. No SDK or application retries occurred. Requests used the official patched SDK, explicit configured development credentials, fixed destinations, 4,096 output-token caps and standard 180-second inference deadlines. The key was not retained or printed. The frozen 15-minute overall limit was not approached.

Prior cumulative accounting remains 7,854. This study adds 54, for **7,908 / 8,192 conservative cumulative inference requests**; the earlier 120 unknown remote outcomes remain counted once. The untouched earlier studies retain their original totals and gates. This pilot does not inherit confirmation eligibility or satisfy the declared-frontier signal gate.

| Requested model | Reported input tokens | Reported output tokens | Estimated USD, ignoring cache discounts |
| --- | ---: | ---: | ---: |
| `gpt-4.1-mini` | 28,839 | 3,984 | $0.01791000 |
| `gpt-4o-mini` | 28,839 | 2,348 | $0.00573465 |

The combined **$0.02364465 estimate is not a provider bill**. It applies standard input/output rates checked on the [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) and [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini) pages, without a cached-input discount. API rate limits were observed in response headers, not inferred from a ChatGPT subscription; [official rate-limit guidance](https://developers.openai.com/api/docs/guides/rate-limits) documents those headers.

## Reproduction, retention and verification

The [aggregate progress artifact](../../apps/api/data/experiments/depth60-progress-v1.json) retains official reports, response rate-limit evidence and hashes of all individual results. Raw replies and dispatch evidence remain in ignored `apps/api/data/private/depth60-v1`; they were not published through the application. The runner refuses to overwrite an existing pilot directory. No run was added to the product leaderboard or the landing score snapshot.

The [independent arithmetic audit](../../apps/api/data/quality/depth60-results-audit-v1.json) recomputes confusion counts, accuracy and exact rational macro-F1 values directly from retained outcomes. The [audit script](depth60-results-audit-v1.py) imports no application scorer. Exact macro-F1 is `181/624` and `434/1377`, respectively. Replaying its arithmetic needs the retained local private result file; aggregate hashes do not replace raw evidence.

```sh
bun run suite:verify --input apps/api/data/suites/depth60-v1.json
python3 docs/research/depth60-reference-review-v1.py apps/api/data/suites/depth60-v1.json
python3 docs/research/depth60-results-audit-v1.py
```

The scheduler/input regressions and connected inference, SDK credential-isolation, provider transport and scoring checks passed: **101 tests / 680 assertions across five files**. API lint, type checking and build passed. Reference and score arithmetic replays passed. The independent code review identified a worker-error stop condition; it was fixed and covered before live calls began. No existing application source, registered suite, historical experiment, score, or provider key was changed by this study. Concurrent provider-interface work is outside this checkpoint.
