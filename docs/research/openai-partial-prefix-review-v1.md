# Review of retained incomplete prefixes

This separate addendum closes the qualitative omission identified in the [terminal interrupted replication review](openai-replication-review-v2.md): **all 60 wrong valid labels and 13 truncated replies** retained in its failed/interrupted records have now been inspected. The terminal review and its frozen artifact remain unchanged. This is a review of existing evidence, not a new experiment or a completed evaluation.

All 73 responses come from **screening prefixes in 15 incomplete runs**. Their official outcomes, labels and provisional scores remain unchanged. The review does not publish the runs, make their prefixes representative samples, admit them to rankings or establish G-SIGNAL. The reviewer and independent checking agent were **AI-assisted**; no human approval occurred.

## Source binding and population

The source is the terminal ledger updated **2026-11-08 07:59:46.559 UTC**, state `interrupted`, bound by file SHA-256 `a129015124f36932a5a9891703624bac24cc75d302cc2664363a36805cd84d84`. The source [terminal audit JSON](../../apps/api/data/quality/replication-review-v2.json) remains **1,271,914 bytes**, SHA-256 `b01b36babc3f5bafc652353dfa84817ff8e4b522fefe44bf5f4442c6458fd20c`.

The new [prefix-review JSON](../../apps/api/data/quality/partial-prefix-review-v1.json) is **180,337 bytes**, SHA-256 `fddcd55a5213d5961087718a51cf403992b7256f03488d2b34f5dc42dea796ed`. It binds actual retained file/record/report identities, case/trial/attempt identities, reference/transcript hashes and per-response diagnosis notes. It contains no raw private answer text, provider key or run-access code. **Review notes paraphrase the visible evidence.** The full private exports are required to replay transcript inspection; hashes alone do not replace them.

All 36 failed/interrupted records were independently replayed again, including the settled supplemental cancelled record and its preserved original checkpoint. Their accounting is unchanged:

| Retained population | Outcomes |
| --- | ---: |
| Planned trials | 1,350 |
| Included model outcomes | 813 |
| Valid correct labels | 740 |
| Valid wrong labels | 60 |
| Truncated replies | 13 |
| Provider errors | 35 |
| Cancelled | 94 |
| Unattempted | 408 |

Their retained classification statuses are **34 provisional and two unavailable**. The 740 correct-label prefix explanations were not qualitatively reviewed by this addendum. Infrastructure, cancellation and unattempted work remain accounted separately and cannot be inferred to contain mathematical responses.

## Complete inspection of the selected responses

The reviewer read all **33,246 retained visible characters**, plus the exact expression/domain and relevant reference evidence for each selected response. Thirteen retained texts are exactly empty strings; their `max_output_tokens` finish reason and historical **4,096-token** profile ceiling were checked. No hidden continuation or mathematical label is inferred from those empty replies.

None of the 73 responses matched a prior review's **both** reference and full retained-transcript hash; all 73 reviews are new. All 73 unique run/case/trial identities, final attempts and hashes passed pinned-review validation against the actual records.

| Primary diagnosis | Responses |
| --- | ---: |
| Written mathematical error | 22 |
| Expression/domain misreading | 3 |
| Unresolved wrong-label/correct-final-conclusion inconsistency | 35 |
| Formatting-only failure | 0 |
| Budget exhaustion | 13 |
| Total inspected | 73 |

All 35 unresolved rows have a final written conclusion matching the certified class while their retained label is wrong. This does **not** assert that every intermediate explanation step is correct. The notes separately retain malformed derivative notation, corrected sign/composition errors and, in two rows, concrete incorrect intermediate derivative or threshold calculations followed by the correct final conclusion. Such a record establishes an observed classification error; it does not establish why its label disagrees with its explanation. No answer was re-extracted or grade repaired.

Concrete mathematical errors among the other rows include reversing the sign of a negative product, changing the reciprocal derivative's numerator sign, applying the logistic maximum factor twice, subtracting unequal rational numbers as zero, and asserting a negative finite-interval endpoint from the behavior of logistic tails on unbounded inputs. Polynomial replies also use incorrect derivative coefficients or reverse the supplied coefficient ordering. Claims about hidden internal reasoning are outside the evidence.

The requested identities/profile populations are preserved individually:

| Requested model ID | Profile | Wrong valid | Truncated |
| --- | --- | ---: | ---: |
| `gpt-5-2025-08-07` | `one-shot-json-v2-minimal` | 1 | 0 |
| `gpt-5-mini` | `one-shot-json-v2-minimal` | 6 | 0 |
| `gpt-5-mini-2025-08-07` | `one-shot-json-v2-minimal` | 6 | 0 |
| `gpt-5-nano-2025-08-07` | `one-shot-json-v2-low` | 2 | 0 |
| `gpt-5-pro` | `one-shot-json-v1` | 0 | 13 |
| `gpt-5.2` | `one-shot-json-v1` | 2 | 0 |
| `gpt-5.2` | `one-shot-json-v2-none` | 3 | 0 |
| `gpt-5.2-2025-12-11` | `one-shot-json-v1` | 2 | 0 |
| `gpt-5.2-2025-12-11` | `one-shot-json-v2-none` | 1 | 0 |
| `gpt-5.3-codex` | `one-shot-json-v1` | 5 | 0 |
| `gpt-5.4-2026-03-05` | `one-shot-json-v1` | 5 | 0 |
| `gpt-5.4-2026-03-05` | `one-shot-json-v2-none` | 7 | 0 |
| `gpt-5.4-mini` | `one-shot-json-v1` | 4 | 0 |
| `gpt-5.4-nano` | `one-shot-json-v1` | 8 | 0 |
| `gpt-5.5-2026-04-23` | `one-shot-json-v2-none` | 8 | 0 |

These counts identify reviewed responses, **not comparable model failure rates**. Different prefixes retain different task/trial support, settings and missing work. Aliases/snapshots remain distinct requested identities rather than independent architectures.

## Independent mathematical checks

All nine affected reference identities match those covered by the [independent challenge review](independent-challenge-review-v1.md). A separately written Python standard-library `Fraction` checker re-parsed each integrated-curvature Horner expression, expanded its coefficients and differentiated twice. It independently used exponential series through degree 40, with an explicit geometric-tail bound, for the reciprocal and softplus sign inequalities. No application differentiation or numeric-certification helper supplied these expected derivatives or signs.

For the reciprocal function, the correct derivative is `exp(x)*(exp(x)-7/4)/(7/4+exp(x))^3`. This has positive sign on `[1,2]`, negative sign on `[-2,-1]`, and opposite signs at the strict interior points `-3/4,3/4` on `[-1,1]`.

For softplus with `k=11/8`, the derivative is `k^2*exp(kx)/(1+exp(kx))^2-2a`. The convex coefficient `a=121/1024` gives exact center curvature `121/512` and strictly positive minimum endpoint curvature **greater than 0.06822**. Thus a smaller logistic value away from zero does not imply that the sign crosses within this interval. The neither coefficient `a=847/4096` gives center curvature `121/2048>0` and endpoint curvature approximately **-0.10902**, with a strict negative interior witness at `3/4`. The concave coefficient `a=605/2048` gives global upper bound `-121/1024<0`. These checks identify the false numeric signs in the reviewed replies without changing the references.

For the integrated polynomial, exact differentiation gives `F''=p^2-epsilon`, with `p=(x^2-9/25)*(x^2-4/25)`. The positive/negative regimes retain their global bounds. In the neither regime, `F''(-3/5)=-1/4096<0` and `F''(0)=4917791/1600000000>0`. The correct leading terms are `x^8-(26/25)x^6`; substituting `1/9` for the leading coefficient or `-26/35` for the next coefficient certifies a different derivative. The independent replay found no reference-label defect in the nine affected identities.

## Coverage closure and limits

Together with the unchanged terminal review's 685 completed-publication reviews, this addendum covers **758 retained wrong/invalid/truncated model responses** across all 207 started records: **553 wrong valid labels, 69 invalid replies and 136 truncations**. This is coverage accounting across two explicitly different populations, not a pooled score or a new claim that the parent matrix finished successfully.

Neither declared-frontier requested ID, `gpt-6-astra` or `gpt-6.1-sol`, appears in these 73 selected responses. The earlier result of no observed retained wrong frontier labels is unchanged. The original **11 dispatched frontier remote outcomes remain unknown**, so these files do not prove universal absence of actual or hidden errors. They also give no conclusion about separate later experiments.

Verification passed: all 36 source/report arithmetic replays, all 73 exact pinned review identities, all nine independent mathematical reference checks, aggregate reconciliation, privacy-field checks and `git diff --check`. A second AI-assisted reader independently checked all 73 full texts and the notes, re-derived all nine references, and refined the exponential enclosures using degree 60. Its full bounded check report and source hashes are embedded in the new artifact; it found no high-confidence defect. Only the two new documentation/data files were added; no source code changed, so build, lint and runtime tests were not rerun for this addendum. No provider calls, credential reads, publication changes, retries, grade changes or commits occurred.
