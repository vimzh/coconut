# Results of the long-deadline reserve diagnostic

**The separately versioned 600-second diagnostic completed all 108 fresh planned trials.** Final progress settled on **2026-11-08T11:47:33.603Z**. It retained **69 correct valid labels, 0 incorrect valid labels and 39 budget-truncated model outcomes**, with 0 invalid-format replies, 0 refusals and 0 infrastructure outcomes. Every model outcome remains in its 54-trial denominator.

| Requested model | Planned | Correct valid | Wrong valid | Invalid | Truncated | Refused | Model outcomes | Correct / all planned | Accuracy among valid answers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-6-astra` | 54 | 36 | 0 | 0 | 18 | 0 | 54 | 66.67% | 36/36 (100.00%) |
| `gpt-6.1-sol` | 54 | 33 | 0 | 0 | 21 | 0 | 54 | 61.11% | 33/33 (100.00%) |

The last column is conditional on receiving a valid answer. It excludes unusable replies and must be read alongside correct/all-planned coverage. The diagnostic creates descriptive counts only: official platform accuracy, macro-F1, scoring-report identities, leaderboard ranks and confidence intervals are unavailable for this distinct research method. No valid wrong label was observed in these retained responses; truncated outputs supply no valid protocol answer or inferred hidden mathematical error.

## Method, population and chronology

The [frozen method](long-reserve-v1.md) was admitted after the [unchanged standard reserve](reserve-results-v1.md) produced zero model outcomes under its 180-second deadline. The standard study's eight unknown sends and 100 unattempted trials remain preserved. The new diagnostic requested all **18 fixed cases × three trials × two models** afresh, using one attempt per identity and zero retries. No prefix was resumed, response replaced, task selected by its correctness, or earlier failed attempt pooled into these descriptive counts.

The exact prior max-profile suite and prompt bindings remain unchanged: suite SHA-256 `b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811`, prompt-array SHA-256 `e50da50ec96c12639e71e1adf40d4725a1c3b593e47c300dc4dc0307016cd0c6`, and mathematical membership fingerprint `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`. The actual frozen manifest time is **2026-11-08T11:02:39.684Z**, and the ledger started at **2026-11-08T11:03:04.323Z**. Exact reference/proof bindings are retained in the [independent reserve reference review](independent-reserve-review-v1.md).

Both requested model identifiers are retained verbatim; every reported response model matches its requested identifier. Requests used the official pinned/patched SDK, Responses endpoint, max requested reasoning, a 16,384-token output cap, disabled truncation, `store:false`, a 600,000 ms inference deadline and a 90-minute study deadline. The concurrency ceiling was four per model and eight overall. Reconstructing the actual durable authorization-to-finish intervals gives maximum overlap **8**. Standard platform transport/profile semantics retain their **180-second** deadline.

This is adaptive exploration over **three families, two related source groups and depths 17/23**. Related tasks and repeated trials do not supply 108 independent mathematical sources. These results support no eligible confidence interval, leaderboard comparison or G-SIGNAL; the stronger-signal verdict remains **No-go**. The original population limits and historical unknown remote outcomes also preclude a universal absence-of-frontier-error claim.

## Full unusable-outcome review and label coverage

All **39** wrong/unusable retained outcomes were reviewed against their full visible text and exact certified reference binding. **38 replies are empty**, with raw status `incomplete`, stop reason `max_output_tokens` and reported output = reasoning = 16,384. The remaining **one Astra reply contains a 382-code-unit partial JSON/explanation**: output 16,384, reasoning 16,208, and the same budget stop. Its visible prefix starts with the certified-correct concave label, an exact source factorization, a valid smoothness assertion and the first eleven coefficients of a Chebyshev polynomial certificate. Independent rational polynomial reconstruction verifies every visible coefficient; a separate mathematical reviewer agrees. The coefficient list, explanation and JSON terminate before completion, so the result remains **truncated and unusable**, with no label promotion. All 39 diagnoses are **budget exhaustion**. No visible mathematical error, format violation or refusal is inferred from these truncations. The pure extractor preserves truncation precedence and does not repair an incomplete response into an answer.

| Requested model | Certified label | Planned | Correct valid | Wrong valid | Truncated |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-6-astra` | concave | 18 | 11 | 0 | 7 |
| `gpt-6-astra` | convex | 18 | 7 | 0 | 11 |
| `gpt-6-astra` | neither | 18 | 18 | 0 | 0 |
| `gpt-6.1-sol` | concave | 18 | 8 | 0 | 10 |
| `gpt-6.1-sol` | convex | 18 | 7 | 0 | 11 |
| `gpt-6.1-sol` | neither | 18 | 18 | 0 | 0 |

The machine-readable review includes every case/trial identity, declared/certified label, reference/result/transcript hashes, family/depth/source/trial breakdowns and explicit coverage denominators. Classification is based on the extracted label. Independent review of **all valid visible explanations** is a separate workstream documented in `long-reserve-explanation-review-v1`; this outcome/accounting audit does not certify every correct-label explanation. A flawed explanation accompanying a correct label would require a separate finding while preserving the retained extracted classification.

## Exact terminal evidence and independent verification

The [independent outcome review](../../apps/api/data/quality/long-reserve-study-review-v1.json) is **367,828 bytes**, file SHA-256 `b31fac30d4399dfe4ace4c8fb66961b5c1c8658b836474a680a6c67ab5436f9b`. Unless explicitly described as a file hash, the following hashes use `qualityDataHash`: recursively key-sorted JSON with array order retained.

| Evidence | Canonical SHA-256 |
| --- | --- |
| Frozen manifest | `ba30c68369f40a118c96bca133c6ec1d4ab6445b15d37840edec0b6c6e6d2c63` |
| Terminal progress ledger | `039ab71a303ae17e7dede4e9f7771b4b3a3b9971831261fc7635450e52a0492d` |
| Prior five-study accounting | `2cd94f1be8f076b781648db58daccfd3eda201bfdba7fdc7c1bb7a9c9b7e490c` |
| Primary research reconciliation | `8e3e9b9d4c969699bffaf5b57b2c317421d6b20fcb59529201403a76ff53d2b9` |
| Per-attempt research send proof | `166c9a2478082e554054a4a6b09db4e7426199d6d632a941bf37b1f0c81ca4b2` |
| Independent outcome review | `706d3f5a336b0950b2e941aff967c2299a2f49eaffb85ab4ad6477076bff57c0` |
| Research publication index | `2f0019629cbce6663cd901a9e541e7be7758445a98d9d5e940211e3501f56538` |

The [primary reconciliation](../../apps/api/data/experiments/long-reserve-reconciliation-v1.json) and [per-attempt send proof](../../apps/api/data/experiments/long-reserve-send-evidence-v1.json) use explicit research schemas, `offline-research-study-reconciliation` and `research-study-send-reconciliation`. They bind all 108 unique planned identities, durable authorizations and actual private result wrappers to the final manifest, ledger and prior accounting. Whole-wrapper hashes, inner `LongAttempt` hashes, raw-response/normalization/outcome hashes and file hashes are distinguished. No RunView, run ID, standard `viewSha256`, metadata HTTP count or normal `StudySendEvidence` object is synthesized.

For every retained response the audit replayed the production pure normalizer and strict answer extractor, independently reconstructed per-model counts, checked declared/certified labels, exact requested/reported settings, usage, unique response/attempt identities, one-send retention and zero retries. A separate Python checker independently reconstructed the raw Responses message/status mapping, visible text, duplicate-safe strict JSON classification, normalized objects, usage and composite result hashes for **all 108 results**, with **zero discrepancies**. Its nine parser boundary checks passed. All prior hash-bound results remained unchanged when later cohorts were added. The artifact retains the audited source-file hashes and exact independent check counts.

Original wire bytes were not retained, so duplicate keys in a provider's outer JSON envelope cannot be retrospectively inspected. The raw-response hash covers the retained parsed provider object. Provider-reported model identity/settings/usage and local wall-clock intervals remain evidence with those meanings; they do not reveal hidden reasoning or prove physical model execution details. Review is AI-assisted, with no human mathematical approval supplied.

## Separate research publication

Both complete model populations qualified for the separate research archive. Qualification requires **54 retained model outcomes**, including unusable replies, rather than 54 valid answers. Every published inner result is exactly equal to the corresponding actual private inner result; canonical population hashes and the index's selected populations were independently checked. The research index binds the manifest and population hashes; these independent proofs supply the final ledger binding. No infrastructure raw text is exported, and there are no omitted populations in this terminal archive.

| Requested model | Published model outcomes | Valid answers | Unusable replies | Population canonical SHA-256 |
| --- | ---: | ---: | ---: | --- |
| `gpt-6-astra` | 54 | 36 | 18 | `923710a96278206315ee1ab16104ae0a7e4d98eb50cccf0955bccfd1961d3de0` |
| `gpt-6.1-sol` | 54 | 33 | 21 | `591fb24b1f2d7dbd82f872ce3b4fb65ed637d2b49f1d5dc6c0fcdbc60691eb5f` |

The archive is a `-research-published` directory. It creates no normal application RunView, scoring report, publication endpoint response or leaderboard entry. Production frontend adapters and filtered report exports are therefore inapplicable to these research objects; the audit verifies their actual research publication representation directly. No platform object was fabricated to obtain a score or apparent frontend check.

## Usage, deadline observations and conservative accounting

| Requested model | Reported input tokens | Reported output tokens | Reasoning subset | Usage coverage | Local elapsed seconds | Responses after 180 seconds |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| `gpt-6-astra` | 21,573 | 612,278 | 603,962 | 54/54 | 49.476–332.265 | 33/54 |
| `gpt-6.1-sol` | 21,573 | 630,274 | 623,005 | 54/54 | 39.167–258.414 | 29/54 |

Reasoning tokens are a subset of reported output tokens and are **not added a second time**. Usage coverage includes valid and truncated model outcomes. The intervals include local request/transport/body handling; they are not isolated model-compute latency. Responses retained after 180 seconds make deadline censoring relevant to interpretation, while the earlier standard study's eight unknown remote outcomes remain unresolved. No claim is made about their unobserved labels, completed execution, provider outage cause or charges. Token counts and reserved sends are not a provider billing statement; no monetary cost is inferred.

Conservative cumulative accounting is **7,854 = 7,746 prior + 108 new authorizations**, within the unchanged **8,192** ceiling. The remaining numerical margin is 338; it is an accounting fact, not a new experiment authorization. The 183 capability sends and four-request calibration allowance are counted once. The prior original eleven, replication 101 and standard-reserve eight unknown remote outcomes total **120**, already included in the prior 7,746. This completed diagnostic contributes **zero new unknown remote outcomes**. Unknown sends are neither added twice nor reclaimed as unused capacity.

Verification passed for terminal 108-identity/source accounting, all private dispatch/result hashes, all raw/normalized/extracted outcome checks, exact per-model arithmetic, all unusable full texts, five-study prior proof revalidation, reported usage, zero-retry and concurrency evidence, and all 108 actual private-to-research-publication inner-result comparisons. The final source has zero active or unattempted trials. No provider/API call, credential read, database write, publication mutation, product-source change or commit occurred during this review. Build and lint were not rerun for these four documentation/data-only additions; the temporary audit writer received a Bun syntax build check.
