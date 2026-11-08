# Additional depth-60 model results

The separately frozen follow-up completed on **2026-11-08T12:52:26.378Z**. All **108 planned requests** returned valid answers: **75 correct labels and 33 wrong labels**, with no invalid reply, refusal, truncation, infrastructure outcome, unattempted trial or new unknown remote outcome. Each requested model received the same nine fixed functions three times, retaining its full **27-trial denominator**.

| Requested model | Reported model snapshot | Correct / planned | Wrong valid | Macro-F1 (0–1) | Independent exact macro-F1 |
| --- | --- | ---: | ---: | ---: | --- |
| `gpt-5.4-nano` | `gpt-5.4-nano-2026-03-17` | 7 / 27 | 20 | 0.21333333333333335 | `16/75` |
| `gpt-5.4-mini` | `gpt-5.4-mini-2026-03-17` | 14 / 27 | 13 | 0.5023849607182941 | `3581/7128` |
| `gpt-5.6-luna` | `gpt-5.6-luna` | 27 / 27 | 0 | 1 | `1` |
| `gpt-6-luna` | `gpt-6-luna` | 27 / 27 | 0 | 1 | `1` |

The exact independent fractions and the retained shared-scorer values agree. Accuracy is 7/27, 14/27, 27/27 and 27/27 respectively. Every model has nine included outcomes per reference class. All four predeclared model IDs remain included regardless of score; no answer was repaired or replaced, and no model or trial was selected for having a perfect result.

## Frozen scope and reference evidence

The [pre-run plan](../plans/depth60-additional-v1.md) and [matrix](../../apps/api/data/experiments/depth60-additional-matrix-v1.json) define an **adaptive exploratory follow-up**: the original two-model pilot was already inspected before these four models were selected. This is neither held-out confirmation nor a revision of the original population.

The [unchanged suite](../../apps/api/data/suites/depth60-v1.json) retains seed `coconut-depth60-pilot-v1`, suite ID `suite-v1-dce0928ad06933d700bedfff11a9b5609eb63c47da2090879904da479af29b24`, three convex/three concave/three neither functions on `[-1,1]`, and measured operation depth 60. Its [independent exact reference review](../../apps/api/data/quality/depth60-reference-review-v1.json) and [replayable Fraction checker](depth60-reference-review-v1.py) establish active envelope pieces, global slope monotonicity and strict midpoint violations of both curvature properties for the neither cases. Both transcript readers replayed these exact reference checks. The retained reference hash matches the frozen suite.

The convex/concave cases have 57 active affine pieces and 349 AST nodes; the neither cases have 56 envelope pieces and 345 nodes. Structural depth grows with expression length and piece count. Global closure shortcuts remain available. Nine shared functions and three repeated calls do not establish independent broad families, a causal depth effect, a universal failure threshold, model superiority or a general model ranking. No confidence interval or stronger frontier-failure claim is supplied.

Every request used `one-shot-json-v1`, provider-default reasoning/sampling, a 4,096-output-token ceiling, no tools, no retries, and the standard 20-second metadata/180-second inference limits. Exact messages match the original pilot. The same requested profile does **not** imply equal hidden compute across models: the retained effective reasoning field is `none` for nano/mini and `medium` for both Luna models.

## Full review of the 33 wrong labels

The [transcript review](../../apps/api/data/quality/depth60-additional-transcript-review-v1.json) binds every wrong model/case/trial, complete visible-text hash, reference hash, result hash and unchanged official outcome. Two AI-assisted readers inspected all 33 full explanations and independently checked the exact mathematical counterevidence. There is no human expert approval or inference about hidden reasoning or model intent.

| Requested model | Written mathematical error | Expression misread | Label/prose inconsistency with correct prose conclusion | Unresolved |
| --- | ---: | ---: | ---: | ---: |
| `gpt-5.4-nano` | 9 | 6 | 5 | 0 |
| `gpt-5.4-mini` | 3 | 6 | 4 | 0 |
| Total | 12 | 12 | 9 | 0 |

These are exclusive **primary** visible-text diagnoses; secondary flags may overlap. The nine primary inconsistencies retain wrong returned labels despite correct prose conclusions. One additional mini reply has a secondary label/prose inconsistency while primarily analyzing the wrong function. None of these observations changes a grade. The **75 correct-label explanations were not qualitatively certified**.

The written errors include claiming that affine addition or nested maximum structure defeats a valid convexity closure, reversing the effect of a negative output multiplier, and asserting that multiplication by a variable preserves convexity. Exact active-kink slope jumps or opposite-sign rational midpoint gaps refute the affected claims. For one mini product explanation, the claimed nonnegative envelope is actually `-25/65536` at zero; the same function has strict midpoint gaps `49131/278528` and `-49131/278528`, so neither global property holds. Expression misreads omit the multiplicative `x`, change the sign of a fixed multiplier, or analyze an invented surrogate.

The original pilot's **32** wrong/unusable transcript reviews remain a separate unchanged artifact. Their exact source and raw-text bindings were checked again. The new 33 reviews do not replace those records, pool incompatible grades or retrospectively change the original model choices.

## Independent arithmetic, execution and hash bindings

The [new arithmetic checker](depth60-additional-results-audit-v1.py) imports no application scorer. It independently parses completed visible JSON with duplicate-field, shape, label, explanation/Unicode and length checks; preserves refused/truncated/infrastructure statuses; and recomputes confusion matrices, all three class metrics, fixed-three macro-F1, accuracy numerators/denominators, outcome populations, trial spread/agreement and depth-slice consistency. It also checks semantic token coverage, latency diagnostics and unavailable billed cost. Its 11 parser/arithmetic boundary checks pass, and it was exercised on both actual original reports before the new terminal replay.

All **108 unique model/case/trial identities** match exactly one durable dispatch authorization and individual retained result. Each receipt binds its model, case/trial and exact request-body hash before transmission. Request messages, body settings, local attempt identities, per-row hashes, full aggregate reports and public progress hashes agree. All 108 individual files equal their corresponding aggregate rows. The report IDs and legacy insertion-order `JSON.stringify` hashes were replayed with a **hash-only Bun subprocess**; this supplies serialization compatibility without importing classification logic. Reference/canonical-result hashes use recursively key-sorted compact JSON. File hashes below hash the exact retained bytes; they must not be substituted for either object-hash format.

| Evidence | File SHA-256 |
| --- | --- |
| Frozen matrix | `b264ad7651cd966a44e399ec79a45ec11a9a9abf1dc6b359f62c33390885a609` |
| Terminal progress | `39dc202ff7849a9e7d220b8591c2a0eeea1ac6d83d282a4666fb212f06152fcb` |
| Private aggregate result | `c3ca744474fb2e9273d23119ad03f4909a3af4f0dda70f6377f1be6c698c2fcf` |
| Unchanged depth-60 suite | `88b20bd12bb54fbe1f33c9c36a752f9ed7e9d2663e19b29fb411ddfeb6c93707` |
| Independent arithmetic audit | `4b34858d63d68ec0df954948c9ca6937fab017ffdfd5ccbc677ab0e2d9d12d1e` |
| Independent transcript review | `09f83fca4dfc557ab7a44abe39c5ee3cd18ec8e8246ad884e2f9f1260c35abe5` |
| Derived six-model landing data | `bb2d256e9ff9b5ed52eb775b52790edf77038bee5f125a1664774cf833cdd192` |

The [machine-readable audit](../../apps/api/data/quality/depth60-additional-results-audit-v1.json) records the full identity grid, all dispatches/results, exact fractions, source lineage, check boundaries and qualitative-review hash. The complete provider Responses envelope, original HTTP bytes and raw `total_tokens` were **not retained** by this inference contract. This is an audit of retained normalized fields, visible-text extraction and scoring; it makes no raw-envelope replay claim.

Four initial requests established the frozen rate-limit headroom requirement before the worker pool increased to 12. The retained authorization intervals independently confirm maximum local overlap **12**. The new batch's first-start-to-last-finish span was **74.814 seconds**, including metadata resolution and transport handling. No serial timing baseline, isolated model-compute latency or speedup factor is claimed. Standard provider deadlines, SDK retry isolation and generator/verifier limits remain unchanged.

## Six-model landing export and separate batches

The [derived landing snapshot](../../apps/api/data/quality/depth60-landing-v1.json) now contains **all six models**. Its original two model rows and original study object are unchanged; the four new rows are appended from the verified retained reports.

| Requested model | Source study | Correct / planned | Macro-F1 (0–1) |
| --- | --- | ---: | ---: |
| `gpt-4.1-mini` | `depth60-pilot-v1` | 11 / 27 | 0.2900641025641026 |
| `gpt-4o-mini` | `depth60-pilot-v1` | 11 / 27 | 0.3151779230210603 |
| `gpt-5.4-nano` | `depth60-additional-v1` | 7 / 27 | 0.21333333333333335 |
| `gpt-5.4-mini` | `depth60-additional-v1` | 14 / 27 | 0.5023849607182941 |
| `gpt-5.6-luna` | `depth60-additional-v1` | 27 / 27 | 1 |
| `gpt-6-luna` | `depth60-additional-v1` | 27 / 27 | 1 |

The export describes **162 depth-60 inference requests across two separately executed batches**: 54 original and 108 additional. Each study retains its own audit-file hash, concurrency and observed span. There is no combined wall-time estimate, combined cost, pooled cross-model macro-F1, eligible rank or confidence interval. This exact-envelope population remains separate from numerical screening/confirmation columns and from the depth-100 population. The export contains aggregate scores only, with no raw replies, provider credential or access code. It does not publish a normal platform run or insert an entry into the product leaderboard.

## Budget lineage and retained limits

Accounting preserves the complete order: **7,854** through the longer-deadline reserve, plus the original depth-60 **54** gives **7,908**; the separately completed depth-100 **54** gives **7,962**; these additional **108** give **8,070 / 8,192**. The numerical margin is **122**. The earlier **120 unknown remote outcomes remain included once**; this study adds zero unknown outcomes. These are conservative request counters, not a provider bill or permission for further work.

The frozen additional matrix binds the actual depth-100 manifest, terminal progress and private result hashes, including terminal progress SHA-256 `1a7fae6dde2c7f7328169e84cced636feaf6fb692664e887194e01196f72f4fd`. The depth-100 scores do not enter this depth-60 export. Original depth-60, depth-100 and earlier evidence were not overwritten or resumed.

| Requested model | Reported input tokens | Reported output tokens | Reasoning subset | Reported effective reasoning |
| --- | ---: | ---: | ---: | --- |
| `gpt-5.4-nano` | 28,812 | 2,683 | 0 | none |
| `gpt-5.4-mini` | 28,812 | 2,325 | 0 | none |
| `gpt-5.6-luna` | 28,812 | 19,380 | 16,989 | medium |
| `gpt-6-luna` | 28,812 | 28,361 | 25,916 | medium |

All token fields have 27/27 coverage per model. Reasoning is included within output and is never added again. Model-specific monetary rates were not bound for this audit, so **no cost estimate or billing claim** is supplied. The old audit's model-specific price branch was not reused for these four IDs.

Reproduce locally with retained private source files:

```sh
python3 docs/research/depth60-additional-results-audit-v1.py --self-test
python3 docs/research/depth60-additional-results-audit-v1.py
```

The optional `--write` exclusively creates a new audit only after terminal evidence and all required hash-bound transcript reviews exist; an existing final audit cannot be overwritten. Reproduction requires the local private results and dispatch files. Hashes alone do not reproduce their contents.

Verification passed for reference replay, all 108 identity/dispatch/result bindings, independent parser and report arithmetic, all 33 full wrong-answer reviews with a second reader, prior-source hashes, exact original-row preservation and safe six-model derivation. No provider/API call, credential read, database write, publication mutation, product-source edit or commit occurred during this audit. Application lint/build and concurrent UI verification are owned by the coordinator; this addition uses standalone Python syntax/boundary checks and actual retained-data replay.
