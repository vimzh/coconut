# Depth-100 exploratory results

The separate depth-100 pilot completed on 2026-11-08. GPT-4.1 mini and GPT-4o mini each returned all 27 planned responses: nine tasks, three fresh trials each. All 54 replies were valid and complete. There were no invalid replies, refusals, truncations, provider errors or unattempted trials.

| Requested model | Reported snapshot | Correct / planned | Wrong valid labels | Accuracy | Macro-F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | `gpt-4.1-mini-2025-04-14` | 24 / 27 | 3 | 88.8889% | 0.8857142857142857 |
| `gpt-4o-mini` | `gpt-4o-mini-2024-07-18` | 19 / 27 | 8 | 70.3704% | 0.7068840579710145 |

Exact independent macro-F1 values are `31/35` and `1951/2760`. GPT-4.1 mini classified every convex and concave task correctly, with three neither-to-convex errors. GPT-4o mini returned six correct convex labels, five correct concave labels and eight correct neither labels, out of nine outcomes per class. These finite counts describe this population and execution; they do not establish a model ordering or general mathematical ability.

## What depth 100 means here

The [pre-run plan](../plans/depth100-pilot-v1.md), [population](../../apps/api/data/research/depth100-population-v1.json) and [frozen matrix](../../apps/api/data/experiments/depth100-matrix-v1.json) retain the exact construction, reference evidence, model settings and budget. The existing standard generator accepts depths only through 80; its 100-level envelopes would exceed the exact verifier's 512-node bound. Neither that generator nor the 128-depth/512-node verifier limits were changed.

Instead, this research-only population uses left-associated sums C_n(x)=sum|x-c_i|, on [-1,1]. Centers are ±j/d, j=1..49, d in {64,68,72}; C_99 additionally includes zero. The nine tasks are C_99, -C_98 and x*C_98 for each denominator. Their measured operation depths are all 100, with 494, 490 and 491 nodes respectively. Every summand adds an interior kink. Convexity follows from sums of absolute-affine terms; negation reverses curvature; exact Jensen violations establish neither for the product cases.

The [independent reference checker](depth100-reference-review-v1.py) parsed the actual ASTs with Python standard-library rational arithmetic. Its [evidence](../../apps/api/data/quality/depth100-reference-review-v1.json) confirms domains, centers, depth/node counts, distinct function signatures, and strict witnesses for all nine tasks. This is AI-assisted independent verification, not human expert or proof-assistant approval. Existing `verifyReference` and `buildPrompt` separately certified the same inputs; labels and certificates stayed outside model prompts.

The population is highly templated. Associative sums can be flattened, depth co-varies with kink count and length, and class-specific outer forms permit shortcuts. There is no matched shallower control. **Higher scores than the depth-60 envelope pilot do not imply that increasing depth improves performance:** these are different function populations. Neither a causal depth effect, universal failure threshold, broad benchmark comparison nor contemporary frontier-model limitation follows. The two requested models are legacy small models.

The [AI-assisted independent transcript review](../../apps/api/data/quality/depth100-transcript-review-v1.json) inspected all **11 wrong replies**. Its visible-text diagnoses identify seven closure/negation errors and four unsupported product-with-x curvature arguments. Each review binds model, case, trial, official label and raw-text hash. These diagnoses concern submitted text, not hidden reasoning or model intent. The correct-label responses were not qualitatively reviewed, and no grade changed.

## Execution and accounting

All 54 inference sends used the same `one-shot-json-v1` instructions/profile as the depth-60 pilot, provider-default settings, a 4,096-output-token ceiling, no tools and no retries. Official SDK credential isolation, fixed destinations, bounded response reads and standard 20-second metadata/180-second inference deadlines were reused. A 15-minute total deadline bounded the study. A separate code review confirmed the dispatch budget, evidence binding and stop conditions before live calls.

Two initial calls established sufficient observed rate-limit headroom; the runner then used at most 12 concurrent requests. The span from first trial start to last trial completion was **16.054 seconds**, including metadata resolution. There was no serial timing baseline, so no speedup factor is claimed.

Through this pilot, conservative cumulative inference accounting is **7,962 / 8,192**: prior 7,908 plus 54 new sends. All earlier unknown sends remain counted once. A separately coordinated 108-call batch was held until this pilot ended; its later outcomes and budget accounting belong to that other study. No concurrent model calls from this pilot remained when it was released to start.

| Model | Reported input tokens | Reported output tokens | Estimated USD before cache discounts |
| --- | ---: | ---: | ---: |
| `gpt-4.1-mini` | 31,707 | 3,832 | $0.01881400 |
| `gpt-4o-mini` | 31,707 | 2,362 | $0.00617325 |

Combined estimated token cost is **$0.02498725**, not a provider bill. Rates are the same standard per-million prices checked for the [depth-60 study](depth60-results-v1.md): mini $0.40 input/$1.60 output, 4o-mini $0.15 input/$0.60 output. Cache discounts are not applied to this estimate.

## Retention and verification

The [terminal aggregate artifact](../../apps/api/data/experiments/depth100-progress-v1.json) retains classification reports, selected rate-limit headers and individual result hashes. Dispatch evidence and raw replies remain under ignored `apps/api/data/private/depth100-v1`; no provider key was retained or printed. The runner refuses to overwrite that directory. This is a classification-only research result, not a standard suite, platform RunView, full scorer report or leaderboard entry. Earlier suites and results remain unchanged.

The [independent arithmetic audit](../../apps/api/data/quality/depth100-results-audit-v1.json) recomputes all confusion counts, accuracy, macro-F1, usage totals, timing and request counts from the retained private outcomes, without importing the application classifier. Its [script](depth100-results-audit-v1.py) is adapted from the depth-60 arithmetic checker. Replaying it requires the private source file; hashes alone do not reproduce raw evidence.

```sh
python3 docs/research/depth100-reference-review-v1.py apps/api/data/research/depth100-population-v1.json
python3 docs/research/depth100-results-audit-v1.py
```

Generation, prompt privacy, wrong-reference rejection, bounded scheduling, provider transport, SDK credential isolation, inference and classification checks passed: **71 tests / 767 assertions across six files**. API lint, type checking and build passed. Independent reference and arithmetic checks passed. Concurrent evaluator-interface changes were not included in this verification. No additional model calls or retries are pending for this pilot.
