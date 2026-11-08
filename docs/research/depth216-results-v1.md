# Depth-216 research results

The separately verified depth-216 pilot completed on 2026-11-08. The same two requested models each returned all 27 planned answers: nine tasks, three fresh trials each. All 54 replies were valid and complete, with no refusals, truncations, provider failures or unattempted trials.

| Requested model | Reported snapshot | Correct / planned | Wrong valid labels | Accuracy | Macro-F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | `gpt-4.1-mini-2025-04-14` | 23 / 27 | 4 | 85.1852% | 0.8441558441558441 |
| `gpt-4o-mini` | `gpt-4o-mini-2024-07-18` | 17 / 27 | 10 | 62.9630% | 0.6151792524790236 |

Exact independent macro-F1 values are `65/77` and `1613/2622`. GPT-4.1 mini classified all nine convex and nine concave outcomes correctly, with four neither-to-convex errors. GPT-4o mini returned three correct convex, seven correct concave and seven correct neither labels out of nine outcomes per class. No label or grade was repaired after inspection.

## A separate verification boundary

The application verifier still has its original maximum depth 128 and node count 512. Every depth-216 reference retains the explicit standard outcome **unverified / resource-limit**. That outcome does not establish a mathematical label or model failure, and no ordinary suite or platform run was admitted through it.

This study instead uses the separately versioned, fixed-family research policy `absolute-sum-exact-216-v1`. The [pre-run plan](../plans/depth216-pilot-v1.md), [population](../../apps/api/data/research/depth216-population-v1.json) and [frozen matrix](../../apps/api/data/experiments/depth216-matrix-v1.json) record the exact construction, proof, prompt identity, independent review and source bindings. Existing application guards and numerical-worker limits were not changed.

Let C_n(x)=sum|x-c_i|, left-associated on [-1,1]. Centers are ±j/d for j=1..107, with d in {128,136,144}; C_215 additionally includes zero. The nine cases are C_215, -C_214 and x*C_214, one per denominator. Their operation depths are all 216, with 1074/1070/1071 nodes respectively, under the separate research bound of depth 216 and 1200 nodes. Every summand adds an active interior kink; the nesting contains no inert identity wrapper.

The proof admits only these deterministic canonical trees. Convexity follows from the finite sum of absolute-affine terms; negation reverses it. Strict exact midpoint witnesses exclude affine overlap and establish both violations for neither. The unchanged rational library retains its 96-character literal, 4096-bit rational and 200,000-operation limits. Recorded checks used 2908 operations per convex case, 2898 per concave case and 5153 per neither case.

A [separate Python Fraction implementation](depth216-reference-review-v1.py) independently parsed all nine actual ASTs and verified domains, centers, unique function signatures, IDs, exact witness coordinates/values/gaps, depth/node counts, and retained standard resource-limit outcomes. Its [reference evidence](../../apps/api/data/quality/depth216-reference-review-v1.json) is AI-assisted independent mathematical checking, not human expert or proof-assistant approval. It does not turn the research method into a general deep-expression verifier.

The separate research prompt version `absolute-sum-216-prompt-v1` has literal neutral system-text, answer-schema and setting equivalence tests against the original one-shot profile. The application prompt builder remains unchanged and cannot admit these references. The separate research builder admits only the fixed case IDs established by the new proof. Only the expression and exact domain enter the model's user message. Source and prompt hashes were frozen before model replies were inspected.

## Execution, review and accounting

The same legacy small models, fresh-trial protocol, provider-default sampling/reasoning and 4096-output-token cap were retained. Official SDK credential isolation, fixed destinations, bounded response reads and standard 20-second metadata/180-second inference deadlines were reused, with no retry. The overall study deadline was 15 minutes. Actual dispatch receipts bind each model/case/trial to the exact outgoing request-body hash before transmission.

Initial calls showed sufficient rate-limit headroom, so execution used at most 12 concurrent calls. First trial start to last trial finish spanned **17.619 seconds**, including metadata resolution. A separately coordinated 108-call batch had already settled before this pilot began; the two batches did not overlap. This study added **54 conservative sends**, taking cumulative accounting from **8,070 to 8,124 / 8,192**. All earlier unknown sends remain counted once; this study added none.

| Model | Reported input tokens | Reported output tokens | Estimated USD before cache discounts |
| --- | ---: | ---: | ---: |
| `gpt-4.1-mini` | 62,244 | 3,708 | $0.03083040 |
| `gpt-4o-mini` | 62,244 | 2,425 | $0.01079160 |

Combined estimated token cost is **$0.04162200**, not a provider bill. It uses the same standard per-million rates checked for the [depth-60 study](depth60-results-v1.md), without cached-input discounts.

The [AI-assisted independent transcript review](../../apps/api/data/quality/depth216-transcript-review-v1.json) inspected all **14 wrong replies** against the separate research proof: 11 false mathematical claims and three expression/domain misreadings. Notes describe submitted text rather than hidden reasoning or intent. Every review binds the exact model/case/trial and raw-text hash. Correct-label explanations were not qualitatively reviewed.

## Reproduction and limits

The [terminal aggregate record](../../apps/api/data/experiments/depth216-progress-v1.json) retains classification-only research reports, selected rate-limit headers and individual result hashes. Raw text and dispatch receipts remain under ignored `apps/api/data/private/depth216-v1`; no key was retained or printed. The [independent arithmetic audit](../../apps/api/data/quality/depth216-results-audit-v1.json) rechecks all confusion counts, exact rational macro-F1, accuracy, usage, timing and dispatch counts without importing the application classifier. Its [script](depth216-results-audit-v1.py) is adapted from the earlier pilot audit and requires the retained private source file.

```sh
python3 docs/research/depth216-reference-review-v1.py apps/api/data/research/depth216-population-v1.json
python3 docs/research/depth216-results-audit-v1.py
```

Tests for fixed-family proof replay, tampering, standard resource-limit preservation, prompt privacy/equivalence, SDK isolation, inference, bounded transport and classification passed: **70 tests / 808 assertions across five files**. API lint, types and build passed. Independent reference, arithmetic and transcript-membership checks passed. No further calls or retries are pending for this study.

These are extremely repetitive single-family tasks. Associative sums can be flattened; depth, input length and kink count change together; outer forms provide class cues. Three parameter choices and repeated requests do not supply independent families. These exploratory results cannot establish a universal failure depth, causal depth effect, contemporary frontier limitation, general verifier capability or directly comparable leaderboard score. Existing standard suites, prior scores and gates remain unchanged.
