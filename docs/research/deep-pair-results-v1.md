# Depth-256 and depth-512 pilot results

Completed 2026-11-08: 36 OpenAI inference requests, no retries, no infrastructure failures or unresolved remote requests. Observed rate-limit headroom supported bounded concurrency 12. The first-to-last trial span was 15.803 seconds. This pilot advanced conservative request accounting from 8124 to 8160, within its existing 8192 ceiling; separately authorized later studies have separate accounting.

| Depth | Model | Correct / planned | Macro-F1 | Invalid |
| --- | --- | --- | --- | --- |
| 256 | GPT-4.1 mini | 6/9 | 0.555556 | 0 |
| 256 | GPT-4o mini | 3/9 | 0.300000 | 1 |
| 512 | GPT-4.1 mini | 3/9 | 0.166667 | 0 |
| 512 | GPT-4o mini | 5/9 | 0.555556 | 0 |

Each depth has exactly three distinct deterministic tasks, one per class, and three fresh trials per task/model. Invalid output stays in the denominator. There were 35 valid answers, 18 wrong valid answers, and one malformed JSON response. No answer was repaired or replaced. GPT-4.1 mini labeled every depth-512 task convex; all its concave and neither trials there were wrong. The small population and GPT-4o mini's nonmonotonic results do not establish a failure threshold or causal effect of depth.

The retained objects are left-associated absolute-value sums on [-1,1], their negatives, and their products with x. The dedicated fixed-family research proof admits only six predeclared cases, with exact AST depths 256/512 and independently checked exact Jensen witnesses. Its research limit is depth 512 and 2600 nodes. The application's ordinary verifier remains limited to depth 128 and 512 nodes; all six ordinary outcomes remain unverified/resource-limit. These classification-only research scores do not enter the ordinary suite or leaderboard.

Associative sums can be flattened, outer forms reveal structural cues, and increasing depth also changes expression length and kink count. Repeated trials are not independent mathematical tasks. These observations support no general mathematical-ability, frontier-model, cross-suite ranking or uncertainty-interval claim.

The manifest freezes source, reference population, independent review, prompts and prior terminal evidence before dispatch. Private raw replies remain excluded from Git; normalized progress preserves row identities, outcomes and hashes. The independent Python arithmetic audit recomputes confusion matrices, exact rational macro-F1, usage and request accounting without importing the application scorer. Private exports are required to replay that audit.

Evidence: [plan](../plans/deep-pair-pilot-v1.md), [frozen matrix](../../apps/api/data/experiments/deep-pair-matrix-v1.json), [terminal progress](../../apps/api/data/experiments/deep-pair-progress-v1.json), [reference audit](../../apps/api/data/quality/deep-pair-reference-review-v1.json), [arithmetic audit](../../apps/api/data/quality/deep-pair-results-audit-v1.json), [transcript review](../../apps/api/data/quality/deep-pair-transcript-review-v1.json).

Verification: 71 focused tests / 786 assertions passed; API typecheck, lint and build passed. Independent Fraction-based checking verified all six actual ASTs, witnesses, identities and prompt renderings with default Python JSON recursion settings. All wrong and unusable outputs were reviewed against the fixed references.
