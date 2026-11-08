# OpenAI replication review, partial snapshot 1

**This is a partial review of an ongoing matrix, not its final result.** A separate AI-assisted reviewer inspected every completed and published cell in the ledger snapshot updated **2026-11-08 05:39:39.281 UTC**. The review finished at 05:45:32.083 UTC. No human approval, provider inference, credential read, private-access-code use, publication mutation, run replacement or grading change occurred in this workstream.

The snapshot contains **26 completed/published cells**, six failed cells, nine recorded capability-unverified cells, three active cells and 194 pending cells. The complete snapshot, including failed/pending/active/unverified members, is retained inside [replication-review-v1.json](../../apps/api/data/quality/replication-review-v1.json). Later completed cells require a separately versioned review. This snapshot includes all completed/published members available at its stated boundary; it does not select the best completed scores.

## Source and review binding

| Retained source | Binding |
| --- | --- |
| `apps/api/data/experiments/openai-matrix-v2.json` | Canonical SHA-256 `62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e` |
| `apps/api/data/experiments/openai-progress-v2-capabilities.json` | Canonical SHA-256 `e1f680a94f881df6667ce6ca8e7ce268475ba424462a6bfa5850813a41e01000` |
| Original running ledger bytes at the snapshot | File SHA-256 `a184e8f1252e338e5416af9f25a36c265bbcafc6be344f61f4bcffdd8b3b8db8` |
| This machine-readable review | 382,909 bytes; file SHA-256 `a52fa3a8c5bdf272849b02e89c4b76e5fc67bc6f7b1a546d0f4d7136f622e7e6` |

The reviewer loaded the **actual manifest and bound capability objects**, verified their canonical hashes against the ledger, and supplied those objects to the offline quality audit. Opaque hashes alone were not treated as experiment evidence. The manifest was frozen at 05:01:15.748 UTC; the retained capability binding is dated 05:04:18.402 UTC. Setting controls were reused without new calls as disclosed in the [replication amendment](experiment-reconciliation-v1.md). The earlier incomplete experiment and its exposed correct prefixes remain preserved; the repetition is not described as an unseen first experiment.

Completed RunViews were fetched anonymously from their actual `/runs/:id/public` endpoints and cross-checked against the snapshot run IDs, completed states and publication timestamps. Every reviewed wrong/unusable result retains its case ID, trial index, attempt ID, requested model/profile, official outcome/label, certified reference label, transcript hash, reference hash, AI-assisted reviewer role and diagnosis. Transcript/reference hashes use the existing `transcriptReviewHash` and `referenceReviewHash` contracts. Raw replies, credentials and access codes are absent from the tracked review artifact.

## Complete-cell observations

Six completed cells use the full 72-task confirmation suite; twenty use the separate nine-task exploratory screen. Their **1,836 completed model outcomes** comprise **1,606 correct labels**, **153 wrong valid labels**, **42 invalid replies** and **35 truncated replies**. These are execution/outcome counts across distinct settings cells, not a pooled capability score or a comparison of equal compute.

| Full confirmation cell | Correct labels / planned | Official macro-F1 | Unusable replies |
| --- | ---: | ---: | --- |
| `gpt-6-astra`, high | 216 / 216 | 1 | None |
| `gpt-6-astra`, max | 216 / 216 | 1 | None |
| `gpt-6.1-sol`, high | 216 / 216 | 1 | None |
| `gpt-6.1-sol`, max | 216 / 216 | 1 | None |
| `gpt-6-sol`, max | 216 / 216 | 1 | None |
| `gpt-6-luna`, high | 215 / 216 | 0.9976689976689976 | One invalid JSON reply |

Only Astra and 6.1 Sol are the predeclared frontier population; previous Sol and Luna are comparators. All four completed declared-frontier high/max cells are **label-perfect on the frozen confirmation suite**. This is not a claim that every explanation is sound, that the models have general mathematical competence, or that future errors are impossible. The six confirmation cells have no valid wrong label in this snapshot.

All 153 wrong valid labels occur in exploratory screening. Their per-cell counts are: `chat-latest` default/medium one each; `gpt-4.1` 19; its dated snapshot 17; `gpt-4.1-mini` 16; its dated snapshot 18; `gpt-4o` 13; its August/November snapshots nine/five; `gpt-4o-mini` and its snapshot 19 each; `gpt-5` minimal 15; and `gpt-5-mini` low one. Aliases/snapshots are separately requested identities, not independent architectures. The artifact retains every completed cell, including all perfect screening cells.

Screening contains only nine tasks in three parameter clusters and shares templates with confirmation. It remains **exploratory and unranked**. No screening score, repeated screening error or post-hoc favorable subset establishes G-SIGNAL or between-family generalization. Different output ceilings and reasoning settings remain separate: historical defaults use 4,096 output tokens, explicit effort profiles use 16,384. The default-profile truncations cannot establish a mathematical failure or an equal-budget effort benefit.

## Every wrong or unusable outcome was inspected

The reviewer read all **230** relevant visible replies in the frozen completed-cell population, including the complete explanations of valid wrong answers, raw invalid replies and all available truncated text. No explanation replaced the official extracted label, and no malformed JSON was repaired for scoring.

| Diagnosis | Outcomes | Interpretation |
| --- | ---: | --- |
| Written mathematical error | 113 | The visible derivative sign, arithmetic, composition rule, curvature definition or whole-interval conclusion contradicts an independently checked reference. These are exploratory observed errors. |
| Expression/domain misreading | 17 | The written polynomial degree, coefficients, leading sign or expansion differs from the exact supplied degree-ten Horner expression. This describes the visible object mismatch, not hidden internal processing. |
| Unresolved label/explanation inconsistency | 23 | A wrong valid JSON label accompanies an explanation concluding the independently correct class. This establishes a protocol label error but does not by itself establish a mathematical-reasoning failure. |
| Unresolved mixed format/mathematics | 38 | Invalid JSON coexists with an incorrect/unsupported derivative, expansion or interval claim. It is not represented as a pure formatting mechanism or repaired into a graded answer. |
| Formatting-only failure | 4 | The visible conclusion matches the reference, but JSON escaping or markdown fences violate the protocol. |
| Budget exhaustion | 35 | The provider reports `max_output_tokens`; visible output is empty or incomplete. No mathematical classification is inferred from it. |

The six rows sum to 230. Machine-readable diagnostics use `unresolved` for the two unresolved categories, giving 61 unresolved entries. No refusal occurred in this completed-cell snapshot.

The full-suite Luna error is a formatting-only failure: its reply visibly selects convex with a matching positive-curvature argument, but unescaped LaTeX delimiters invalidate JSON. The official invalid outcome and score remain unchanged. Most older-model invalid replies contain markdown fences; some also visibly misexpand the polynomial or assert a false curvature rule. One minimal-effort `gpt-5` invalid reply has an extra closing brace and additional mathematical/object errors. The 35 truncated replies comprise twelve `gpt-5` default, fourteen dated `gpt-5` default and nine `gpt-5-mini` default outcomes; thirty-four have no visible answer text and one ends partway through an explanation.

Several transcripts demonstrate why label errors and mathematical diagnoses must remain distinct. A `chat-latest` default reply labels the softplus neither case concave while its explanation correctly identifies opposite curvature signs and concludes neither. Some reciprocal replies similarly write a correct derivative and correct final explanation but retain an incompatible label. Such answers remain wrong under the declared protocol and are conservatively marked unresolved as a mathematical mechanism.

## Independent checks of the affected references

Ten distinct cases occur among the 230 reviewed outcomes: the nine screening tasks and one confirmation softplus task. Their reference hashes and independently checked methods are retained in the artifact. The earlier [independent challenge review](independent-challenge-review-v1.md) covers all admitted confirmation/screening coordinates; the reviewer additionally rechecked these affected formulas directly.

- **Reciprocal exponential:** for `c=7/4`, differentiating `1/(c+exp(x))` gives `exp(x)(exp(x)-c)/(c+exp(x))^3`. The denominator is positive. `exp(x)>c` on `[1,2]`, while `exp(x)<c` on `[-2,-1]`. On `[-1,1]`, the strict interior points `-3/4` and `3/4` give opposite signs. In particular, the positive exponential series gives `exp(3/4)>1+3/4+(3/4)^2/2>7/4`; the negative witness has `exp(-3/4)<1<7/4`.
- **Softplus quadratic:** the second derivative is `k^2 exp(kx)/(1+exp(kx))^2-2a`. The logistic curvature is even, maximized at zero and decreases for positive arguments. An independently written standard-library `Fraction` exponential enclosure through degree 40 proves `exp(11/8)<4`; therefore the logistic curvature throughout the stated intervals exceeds `4/25>1/8`, proving the convex coefficient regime. Its global maximum `1/4` proves the concave regime because `2a=5k^2/16`. For neither, `2a=7k^2/32`; zero gives `k^2/32>0`, while the exact lower exponential bound `exp(3/4)>269/128` proves a negative second derivative at `3/4`. The confirmation case uses `k=9/8`; screening uses `k=11/8`.
- **Integrated curvature:** an independently written standard-library `Fraction` AST parser expands the actual three screening Horner expressions and differentiates their rational coefficients twice. Each is exactly `p(x)^2-epsilon`, with `p(x)=(x^2-9/25)(x^2-4/25)`. Degree ten is confirmed. Negative epsilon `-1/64` proves strict convexity. For concavity, `epsilon=(sum |p_j|)^2+1/16=15945761/6250000` gives a strict upper bound `-1/16` on `[-1,1]`. For neither, `epsilon=1/4096` gives `F''(-3/5)=-1/4096` and `F''(0)=4917791/1600000000>0`; both witnesses are strictly interior.

The exact polynomial coefficient identities and independent exponential inequalities passed. Native full suite/certificate replay is also performed by `auditRun`; agreement with native replay is reproducibility evidence, while the separately written derivatives/inequalities/coefficient checks supply independent reference reasoning. No reference mismatch was found in this affected-case population. No human mathematical approval or practical-relevance assessment is implied.

## Arithmetic, projections and quality outputs

`auditRetainedMetrics` independently recalculated all 26 completed reports, including class/F1/accuracy counts, confusion, directional errors, outcome denominators, three-trial spread/agreement, every depth, token semantic/coverage groups, latency quantiles, observed cost coverage, expression/prompt lengths and tokenizer provenance. The actual `adaptRunView` and `buildReportExport` functions passed checks for all 26 views, **90 depth slices** and **270 filtered exports**. Projected values and filtered case/trial membership remain identical to the retained scorer output. This was offline execution of frontend projection code, not browser rendering.

`auditRun` consumed the real frozen manifest/capabilities and pinned reviews. Seventeen cells pass its scoped quality checks; nine retain No-go because some mechanisms remain unresolved. All 26 have **No-go for G-SIGNAL**. A cell-level quality Go does not remove its exploratory status, establish ordering or certify the entire still-running matrix. Conditional clustered intervals are available for the six complete confirmation populations and unavailable for the twenty sparse screening populations. Five perfect confirmation intervals collapse to `[1,1]`; this is a fixed-family conditional resampling result and cannot prove zero future error. No paired superiority comparison was predeclared or inferred.

## Infrastructure retained outside completed-cell scoring

The six failed snapshot cells remain failed and unpublished; their partial answers are not substituted into the completed-cell results:

| Cell | Retained failure | Planned / finished / still unfinished | Inference sends |
| --- | --- | ---: | ---: |
| `gpt-6-sol`, high | 215 answers; one `service-unavailable` before inference | 216 / 216 / 0 | 215 |
| `gpt-6-luna`, max | 184 answers; one inference HTTP 400 classified `invalid-provider-response`; three cancelled | 216 / 188 / 28 | 188 |
| `gpt-5`, high | Eleven answers; one inference timeout; three cancelled | 27 / 15 / 12 | 15 |
| `gpt-5-2025-08-07`, minimal | One answer; one inference HTTP 400 classified `invalid-provider-response`; three cancelled | 27 / 5 / 22 | 4 |
| `gpt-5-2025-08-07`, high | Seventeen answers; one inference timeout; three cancelled | 27 / 21 / 6 | 21 |
| `gpt-5-mini`, minimal | Eight answers; one inference HTTP 400 classified `invalid-provider-response`; three cancelled | 27 / 12 / 15 | 12 |

The metadata service failure supplies no inference HTTP status. The two inference timeouts have no returned HTTP status, and remote execution/charges may remain uncertain. HTTP 400 evidence alone does not establish its exact cause. Three sibling cancellations after each fatal stop are retained; they are not wrong mathematical labels. No failed cell was retried or published by this reviewer.

## Reproduction and next review

The retained artifact contains the immutable ledger snapshot, every completed source/report identity, all 230 pinned reviews and the six failed-cell summaries. The current live ledger will change; do not compare its later bytes with this snapshot hash and call that corruption. Use a new output filename for a later review. Original private/public exports remain subject to their documented retention and access boundaries.

An offline arithmetic replay of this exact completed set, while its retained exports are available, requires no credential:

```sh
bun - <<'TS'
import { readFile } from 'node:fs/promises';
import { auditRetainedMetrics } from './apps/api/src/quality/reporting-audit';
import { adaptRunView } from './apps/web/src/lib/report-adapter';
const review = JSON.parse(await readFile('apps/api/data/quality/replication-review-v1.json', 'utf8'));
for (const cell of review.cells) {
  const view = JSON.parse(await readFile(`apps/api/data/private/openai-progress-v2/records/${cell.arithmetic.runId}.json`, 'utf8'));
  auditRetainedMetrics(view.record);
  adaptRunView(view);
}
console.log(`${review.cells.length} retained completed cells passed replay.`);
TS
```

The final matrix review must include every later completed cell and preserve every original failed/pending/unverified member. This snapshot supports observed exploratory errors and honest complete-cell reporting. It supports **no declared-frontier mathematical-failure finding**, final all-model coverage claim, global model ordering, deployment or hackathon readiness declaration.
