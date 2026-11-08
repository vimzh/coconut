# Results of the remaining model screening supplement

The separately frozen eight-cell supplement completed on **2026-11-08 at 09:41:12.655 UTC**, with every cell explicitly published and archived. Its **216 included model outcomes contain 192 correct labels, one wrong valid label, eleven invalid replies and twelve truncated replies**. There are no refusals, provider errors, cancellations or unattempted trials. A completed run therefore does not mean that all its answers were valid or correct.

This records execution after the historical prelaunch checkpoint in the [draft execution plan](remaining-models-experiment-v1.md). Actual terminal files, not that checkpoint's future-tense status, support the results below.

| Requested model ID | Requested profile | Correct | Wrong valid | Invalid | Truncated | Accuracy, all 27 trials | Macro-F1 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `o3` | Provider default, 4,096-token ceiling | 21 | 0 | 0 | 6 | 77.78% | 0.866667 |
| `o3` | Low, 16,384-token ceiling | 22 | 1 | 4 | 0 | 81.48% | 0.879902 |
| `o3` | Medium, 16,384-token ceiling | 26 | 0 | 1 | 0 | 96.30% | 0.980392 |
| `o3` | High, 16,384-token ceiling | 26 | 0 | 1 | 0 | 96.30% | 0.980392 |
| `o3-2025-04-16` | Provider default, 4,096-token ceiling | 21 | 0 | 0 | 6 | 77.78% | 0.872059 |
| `o3-2025-04-16` | Low, 16,384-token ceiling | 24 | 0 | 3 | 0 | 88.89% | 0.938725 |
| `o3-2025-04-16` | Medium, 16,384-token ceiling | 26 | 0 | 1 | 0 | 96.30% | 0.980392 |
| `o3-2025-04-16` | High, 16,384-token ceiling | 26 | 0 | 1 | 0 | 96.30% | 0.980392 |

Every row has nine fixed mathematical tasks, three fresh trials per task and 27/27 included outcomes. The exact profiles are `one-shot-json-v1` and `one-shot-json-v2-low/medium/high`. Provider-default requests remain provider-default in the retained generation settings; the provider reported effective effort **medium** for those default runs. That reported value does not retroactively change the requested profile or its smaller output ceiling. The artifact retains requested and reported model/settings identities separately.

These are **screening/descriptive cells**, with three families and three task clusters at depths 3, 5 and 14. Every row shares the same nine exact expression/domain tasks. Repeated trials, settings and requested aliases do not create additional independent tasks or architectures. Depth and family are confounded. No pooled cross-model score, model ranking, eligible confidence interval or G-SIGNAL follows.

## Immutable membership and source binding

Selection used unfinished scheduling in the pinned parent ledger. The two requested names, `o3` and `o3-2025-04-16`, each received all four original screening profiles. All eight original cell objects, including suite/prompt/settings identity and budgets, are unchanged. Each new run ID is distinct from all earlier run IDs.

Earlier failed prefixes remain separate. In particular, the inspected parent `o3` default seven-answer prefix was disclosed before this supplement. It was not resumed, pooled into the new score, replaced, erased or selected by grade. The supplement does not turn the interrupted parent matrix into a successfully completed matrix.

The [machine-readable review](../../apps/api/data/quality/remaining-models-review-v1.json) is **912,287 bytes**, file SHA-256 `4934773e062b6c49a9f15ec47e6ea748cb66ab9ea4f720b6ce8e56f397b5187b`, canonical SHA-256 `9b86e2404b617c070430c8229423cea69e6136b89e72cf7bf1fdb4bd6475f0ea`. It retains complete source bindings, official metrics, pinned diagnosis notes, actual frontend checks, quality reports and the requested-ID union. It contains no raw model transcript, credential or run-access code. **Diagnosis notes paraphrase the visible evidence.**

Unless called a file hash, these identities use `qualityDataHash`: recursively key-sorted JSON with array order preserved.

| Source | Canonical SHA-256 |
| --- | --- |
| `remaining-models-matrix-v1.json` | `583601ed027c0227ca0063734ca65f92bd590cc048688b46e984d530f7b900c5` |
| Terminal `remaining-models-progress-v1.json` | `46d28bd521978c77b559001e6482e02d8565af200ad0d903e9d628984c79c710` |
| [Primary reconciliation](../../apps/api/data/experiments/remaining-models-reconciliation-v1.json) | `62fd2e46804b369a5c9b9ee0f649abbd06624e97688cac35330d91f0202b01b5` |
| [Per-attempt send evidence](../../apps/api/data/experiments/remaining-models-send-evidence-v1.json) | `cb0ea0e1ee096dddbb6f3c50a0507195b011500e46ce7061643a621caae25362` |

The primary/send proofs were checked at **09:52:16.965 UTC**, after terminal settlement. They cover all and only the eight unique started run/cell pairs, zero active trials and all 216 unique attempts. Every result hash and its actual inference/HTTP counters match the retained source. The actual exported send validator accepts the proofs.

The complete private/public **RunRecord bodies are exactly equal** in every cell. The wrappers differ only in `publishedAt`: the private exports retain their actual pre-publication null values and the public archives retain their actual subsequent timestamps. Primary `recordSha256` and send `viewSha256` bind the **whole original private RunView**. Public archive hashes bind the separate public wrappers. The artifact records both; no publication timestamp was synthesized to force whole-view equality.

## Full inspection of wrong and unusable replies

All **24** wrong or unusable responses were read in full against the exact expression/domain and reference. All case/trial/attempt identities and composite transcript/reference hashes match the retained source. No exact prior transcript-and-reference pair matched, so all 24 transcript reviews are new. The nine suite references exactly match the existing [independent challenge review](independent-challenge-review-v1.md) and prior independent rational replay; seven of those reference identities occur among the inspected failures. The separate `Fraction` derivative/exponential checks were replayed, and a second AI-assisted reader independently confirmed all 24 diagnoses.

| Primary diagnosis | Responses |
| --- | ---: |
| Written mathematical error | 1 |
| Formatting-only failure | 9 |
| Unresolved mixed formatting/mathematical-argument failure | 2 |
| Budget exhaustion | 12 |
| Total inspected | 24 |

The wrong valid answer is **`o3` / low** on the convex integrated-curvature polynomial. It gives a degree-six second derivative with a negative constant for a degree-ten input, then uses that incorrect value at zero to conclude neither. Exact differentiation instead gives

```text
F''(x) = [(x^2-9/25)(x^2-4/25)]^2 + 1/64 > 0,
F''(0) = 473569/25000000 > 0.
```

The written derivative and negative witness are false. This is an observed, independently checked point error in a low-effort screening cell. It does not identify whether internal parsing or differentiation caused the error, and it does not establish a declared-frontier/highest-effort confirmation finding.

Nine invalid replies have correct visible curvature conclusions and substantively consistent arguments, but invalid JSON escaping prevents a valid protocol answer. All eleven official invalid bodies independently fail JSON parsing. None was repaired or re-extracted after review.

Two invalid replies also contain mathematical argument defects and remain **unresolved mixed failures**. One uses leading second-derivative coefficient `100/90` instead of `1` and an incorrect arithmetic sum. The other correctly expands the convex polynomial but asserts a unique quartic minimum; exact factorization gives stationary points `4/25,13/50,9/25`, with two minima at `4/25` and `9/25`, both equal to `1/64`. Their final written classes match the references, but the erroneous arguments prevent a formatting-only diagnosis. Their official invalid grades remain unchanged.

All twelve truncations occur under the historical 4,096-token default profile. Eleven have empty visible text; one contains an unfinished JSON prefix beginning a convex label. Its partial label was not salvaged. Truncation is budget exhaustion, not a wrong mathematical answer or proof of a hidden reasoning mechanism.

The 192 correct-label explanations were not qualitatively certified by this review. The reviewers were **AI-assisted**, with no human approval. Observed labels, visible argument defects and unresolved causes remain separate.

## Requested-ID coverage across the preserved studies

The union was recomputed from the actual original, replication, interior and remaining-model manifests/terminal ledgers, joining each retained run to its immutable cell and requested model name.

| Study | Requested IDs with execution records | IDs with a completed/published cell |
| --- | ---: | ---: |
| Original attempt | 47 | 0 |
| Parent replication | 46 | 43 |
| Interior exploration | 2 | 2 |
| This supplement | 2 | 2 |
| Unique union | **47** | **45** |

These counts must not be added across rows. The union contains **429 distinct run IDs**. The two requested IDs with execution records but no complete published cell are **`gpt-5-pro` and `gpt-5-pro-2025-10-06`**. Failed/metadata-only records are still execution evidence; they do not imply a valid mathematical answer or a successful complete benchmark. Aliases and dated snapshots remain distinct requested identities rather than a hidden count of independent architectures. The evidence does **not** establish 47 successfully completed model benchmarks.

## Arithmetic, frontend and accounting checks

Independent arithmetic replay passed for all eight private and eight public records, covering class metrics, fixed-three macro-F1, accuracy, all outcome denominators, confusion and directional errors, trial spread/agreement, every depth, token semantics and coverage, latency/cost coverage and lengths. Full quality replay additionally validated native certificates, canonical prompts and complete shared-scorer equality, with pinned applicable response reviews. The immutable source-parent configuration/control objects validate the unchanged original settings cells; the supplement's own manifest and ledger independently bind the fresh executions.

The actual frontend adapter passed **eight overall and 24 depth projections**, **24 full and 72 depth-filtered exports**, and **96 token-series selections** on the actual archived data. Exact case/trial membership, metrics and selected usage semantics match the retained reports. This is offline production-code execution, not a browser-rendering or accessibility claim.

Six scoped reporting quality gates are Go and two remain No-go because the two mixed failures retain unresolved outcome-inspection blockers. All 24 responses have been inspected; unresolved does not mean that they were omitted. These scoped gates do not promote any cell to confirmation. **All eight confidence intervals remain unavailable and all eight G-SIGNAL verdicts are No-go.**

The study records **216 inference sends, zero recorded unknown remote outcomes and 432 HTTP attempts**. HTTP attempts include metadata operations; they are not 432 model inferences. No new capability or calibration requests were made. Conservative cumulative accounting through this study is **7,738**: the prior 7,522 plus 216, within the unchanged 8,192 ceiling. The original eleven and replication 101 unknown remote outcomes remain included in prior sends and are never treated as unused budget or counted twice. These are request counters with the retained calibration allowance, not provider bills. Reported provider costs are unavailable; reasoning tokens are a subset of output tokens and must not be added again.

No declared-frontier requested ID occurs in this supplement. The original eleven unknown frontier remote outcomes remain unknown, so no universal absence-of-error claim follows. Later experiments require separate prospective gates, execution records and accounting.

Verification passed: exact source/private/public bindings, all 216 per-attempt send hashes, actual send-schema validation, 16 independent arithmetic audits, eight full quality/native/shared-scorer replays, all 24 complete transcript reviews and second-reader checks, actual frontend/export checks, requested-ID union reconciliation, privacy scans and `git diff --check`. No provider/API calls, credential reads, publication mutations, database writes, source-code changes or commits occurred during this review. Build and lint were not rerun for these documentation/data-only additions.
