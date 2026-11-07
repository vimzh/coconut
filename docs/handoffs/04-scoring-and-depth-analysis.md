# Module 04 Handoff: Scoring and Depth Analysis

## Status and artifacts

**Complete.** Implementation, offline behavioral verification, fixture reproduction, repository checks, and independent code review pass. D-05 is resolved for dependent execution and reporting work.

D-05 is defined in the [technical plan](../plans/04-scoring-and-depth-analysis.md). Report/scorer version: **`1`**. Policy identity: **`pooled-macro-f1-v1`**. No mathematical, extraction, profile, or suite semantics changed, and no dependencies were added.

- [Public API](../../apps/api/src/scoring/index.ts): `scoreEvaluation`, version/policy constants, input/report types, and `ScoringInputError`.
- [Evidence types](../../apps/api/src/scoring/types.ts), [strict readers/outcome replay](../../apps/api/src/scoring/validation.ts), and [execution snapshot/binding](../../apps/api/src/scoring/evidence.ts).
- [Classification](../../apps/api/src/scoring/classification.ts): fixed-label pooled metrics, completion, matrix, directional errors, trial spread, and agreement.
- [Usage](../../apps/api/src/scoring/usage.ts), [exact cost](../../apps/api/src/scoring/cost.ts), and [diagnostics](../../apps/api/src/scoring/diagnostics.ts): attempt/logical usage, timing, cost, lengths, and tokenizer coverage.
- [Report integration](../../apps/api/src/scoring/scorer.ts) and [local CLI](../../apps/api/src/scoring/cli.ts).
- [Controlled input](../../apps/api/data/scoring/mixed-v1.input.json) and [expected report](../../apps/api/data/scoring/mixed-v1.report.json). These contain synthetic answers, usage, costs, and tokenizer measurements under an explicit fixture model/provider/run identity. They are verification data, not measured model performance.

## Public input and identity

```ts
const report = await scoreEvaluation({ suite: frozenSuite, evidence: runEvidence });
```

The scorer snapshots strict data before asynchronous suite replay, calls module 03's full `validateFrozenSuite`, and accepts only purpose `evaluation`. Labels/depths/expressions/node counts come from that suite. The evidence must match its suite ID, protocol version, and profile ID. The report retains scorer/policy identity, run/model/provider/endpoint/settings identity, suite/mathematical versions, declared workload, supplied run duration/concurrency, and a canonical evidence hash.

`RunEvidence` requires exactly runId, suiteId, protocolVersion, profileId, model, run, trials, and expressionTokens. Model identity requires provider, modelId, endpointId, and settingsId. Missing identity is an input error; the scorer never invents it.

Each case has exactly three records, keyed by caseId and trialIndex 0–2. A missing record is an error; explicit unattempted work has attempts `[]`, finalAttempt `null`, and elapsedMs `null`. Attempted work uses contiguous attempt sequences starting at **1**, at most two per trial, and explicitly sets finalAttempt to the last sequence. Earlier attempts must be provider-error/interrupted outcomes; valid/invalid/refused/truncated replies and cancellation cannot be turned into retries. Module 07's D-08 must additionally decide and enforce which transient failures actually permit retries.

Each attempt retains outcome, errorKind, elapsedMs, usage, and cost. Provider-error outcomes require an authentication/unavailable/transport/timeout/other category; other outcomes require null errorKind. Persisted outcomes are re-extracted from their explicit completion state/raw text and compared exactly. Forged labels, explanations, invalid reasons, versions, extra reference fields, duplicate/unknown/missing records, incompatible identities, malformed arrays, and getters fail visibly.

The scorer canonicalizes record/token order and constructs immutable detached reports. Report identity hashes the complete versioned summary, including a hash of canonical execution evidence. Reordering properties/records preserves identity; changing evidence or policy changes it. Raw responses and private verifier certificates remain in the retained source input, not the summarized report.

Retained raw replies are limited to **131,072 UTF-16 code units each**, provider-error messages to **4,096**, and combined raw reply/error text to **16,777,216** across all attempts. Oversize evidence fails before report hashing; it is never silently truncated or omitted. The per-reply limit exceeds extraction's 65,536-unit limit so `response-too-large` outcomes can still be scored. Large legitimate runs must satisfy both call and retention budgets. The CLI separately enforces a **128-MiB file limit** before and during reading, and rejects invalid UTF-8 instead of repairing identity strings. Future HTTP consumers must similarly bound transport bytes before parsing. Larger/streaming retention needs its own versioned contract.

## Outcome populations and denominators

| Final logical outcome | Mathematical treatment | Completion/rate treatment |
| --- | --- | --- |
| Valid answer | Predicted label; correct or incorrect | Returned model population |
| Invalid, including empty and duplicate fields | Reference support and FN; no FP; unusable matrix column | Returned model population |
| Refused or truncated | Same unusable treatment, even when text looks like valid JSON | Returned model population |
| Provider error | Excluded from mathematical counts | Separate category / planned trials |
| Interrupted or cancelled | Excluded from mathematical counts | Separate category / planned trials |
| Explicit unattempted | Excluded from mathematical counts | Separate category / planned trials |

The mutually exclusive outcome-rate categories are answer, invalid, empty, conflicting, refused, truncated, provider-error, interrupted, cancelled, and unattempted. `empty` means invalid reason empty; `conflicting` means duplicate-field; the category `invalid` means **other invalid** reasons. UI consumers must not display it as a total containing the other two. All returned categories use included model outcomes as denominator; execution categories use planned trials. Each rate retains numerator, denominator, and value (null at denominator zero).

Population status is **complete** when every planned trial returned an included outcome, **provisional** when some work is excluded but a scoring population exists, and **unavailable** when no model outcome is included. Complete does not imply correct or usable answers. Malformed/entirely empty envelopes throw; a valid all-unattempted plan returns unavailable metrics without fabricating a score. These statuses are not leaderboard-eligibility decisions.

## Metrics and interpretation

The headline pools included case × trial observations. Per-class TP/FP/FN/support derive from those same counts. Precision is TP/(TP+FP), recall TP/(TP+FN), and F1 2TP/(2TP+FP+FN). Precision/recall with zero denominators are null. In a nonempty population, zero F1 denominators contribute zero to the unweighted mean over **all three fixed labels**. In an empty population, every class F1 and macro-F1 are null. Missing reference classes remain flagged. Accuracy is correct/included; no weighted or micro average substitutes for macro-F1.

Confusion rows are reference labels and columns are convex/concave/neither/unusable, with raw counts and row rates. Empty rows are null, and infrastructure is outside the matrix. Directional errors are separate convex→neither and concave→neither counts divided by included support for their source class; absent support yields null.

Trial-index metrics are retained separately from pooled metrics. Spread admits a replicate only if every planned instance in the slice returned a model outcome; eligible replicates therefore use the same membership. Mean/min/max/count and sample SD are reported for macro-F1 and each available class recall. SD uses n−1 and is null for fewer than two eligible replicates. This is descriptive variation over three trials, not a confidence interval.

Agreement admits only instances with all three trials returning valid labels. It averages agreeing unordered pair fractions: unanimous=1, two matching=1/3, three distinct=0. Eligible/total instances and pairs are retained. Unusable or missing replies cannot produce perfect agreement, and agreement never chooses a majority answer.

Every suite depth remains in the report, including unavailable slices. Depth difference is that slice's macro-F1 minus the **shallowest planned depth's** macro-F1. Values use the 0–1 scale; multiply by 100 to display percentage points. A missing baseline yields null differences. Overall results pool observations rather than averaging depth scores, including when execution coverage differs. The existing depth/length/active-piece confound remains; no causal depth claim is justified.

## Usage, cost, timing, and expression lengths

Input/output/reasoning fields are provider-reported token counts plus semantic identifiers, or null. Attempt summaries include every retry and report total/reporting/missing coverage and per-semantics totals/means. Reasoning is never inferred from output or explanation length, and is never added to output totals. Logical-trial usage sums attempts only when all attempts report that field under matching semantics; otherwise that field is missing/incompatible for the trial. Unattempted work supplies no observed zeros. Aggregates outside safe integer range fail rather than round silently.

Logical latency uses trial elapsedMs for final returned model outcomes, including unusable replies. Known durations produce nearest-rank p50/p95 (`ceil(p*n)−1`); eligible/reporting/missing counts and infrastructure/timeout counts are separate. Retry time is part of the supplied logical duration; attempt durations never substitute for it. Run wall time and concurrency remain supplied values, separately labelled; they are not inferred from latency sums.

Actual bills are exact decimal amount/currency evidence. Estimates require observed input/output counts, matching pricing semantics, valid date/source, and input/output per-million rates. Integer decimal arithmetic retains up to 18 fractional digits of cost and 12 of rates. Different kind/currency/pricing groups remain separate. A full total exists only when one compatible group covers every recorded attempt; otherwise total is null and known subtotals/coverage remain visible. Per-group missingAttempts counts attempts outside that group, including other reported groups; top-level missing counts genuinely unreported cost attempts. No live prices or exchange rates are assumed.

Raw expression Unicode code-point counts and verifier node counts are measured once per case. Model-visible system/user content characters are measured separately via `buildPrompt`; they exclude serialization/roles/tool schemas and are not a full provider request-token budget. Local expression-token evidence requires exact expression SHA-256 and tokenizer ID/version/model ID. A model-ID mismatch makes counts unavailable with incompatible coverage; absent evidence remains missing. Different tokenizer identities are grouped separately. Each group's perCase list is sparse and contains only supplied measurements; the global length perCase list retains every case. This keeps report size linear in cases plus measurements. The scorer checks metadata/hash binding; later modules must supply genuine tokenizer measurements and endpoint compatibility evidence. No tokenizer or hidden model reasoning is fabricated.

Intermediate-step/first-error/recursive-step diagnostics are explicitly not applicable to the current one-shot profiles. No decomposition metric is emitted because neither profile defines a decomposed representation. A future method needs a separately approved profile, rubric, local references, and first/last-error/error-free/uncheckable fixtures before those metrics can become applicable.

## Independent fixtures and reproduction

The retained mixed fixture uses three references C/A/N with trial predictions `(C,A,N)`, `(C,C,C)`, and `(empty,A,N)`. Its matrix rows are C `[2,0,0,1]`, A `[1,2,0,0]`, N `[1,0,2,0]`. Independently calculated results:

- Class F1: **4/7, 4/5, 4/5**; pooled macro-F1 **76/105 ≈ 0.7238095**; accuracy **6/9 = 2/3**.
- Trial F1s **1, 1/6, 2/3**; trial mean **11/18**, sample SD **√57/18**. Their mean is not the headline F1.
- Agreement **1/3**, with 2/3 eligible instances. All 9 returned outcomes are included; status complete.
- One infrastructure retry gives **10 attempts / 9 logical trials**; reasoning reports 3 attempts and is missing for 7. Latency p50=50ms/p95=90ms.
- Known billed subtotal **0.0003 USD**, estimated subtotal **0.000044 USD** at the explicitly synthetic rates; 7 attempts lack cost evidence, so total is null. Tokenizer coverage is 1 compatible / 1 incompatible / 1 missing.

Report identity: `report-v1-ea4995968ffe665adffe3ff72973f3de18140176b6e3b49af21cef01076e84dc`.

Expected compact report is **22,945 bytes** including newline; SHA-256 `19c4ce577685d3eea01deb09170b0119fc60ea024f1093e9ef0df1c0a7d4dde0`. A separate CLI process reproduced it byte for byte:

```sh
bun run score:report --input apps/api/data/scoring/mixed-v1.input.json --output /tmp/coconut-scoring-report.json
cmp apps/api/data/scoring/mixed-v1.report.json /tmp/coconut-scoring-report.json
```

Use a new output path. The CLI creates files exclusively and refuses overwrites. It exits nonzero on malformed/contradictory evidence or I/O failure and prints a concise identity/status/macro-F1 summary on success.

Other independent fixtures cover all-correct/all-wrong, imbalance (four C/one A/one N predicted C yields F1=4/15 versus accuracy=2/3), absent/unpredicted classes, empty populations, every outcome, sparse spread, and unequal depth coverage. Nine perfect shallow outcomes plus one deep C→N outcome yield pooled macro-F1 **19/21**, while depth F1s are 1 and 0; the overall scorer must not report their average 1/2.

Formula references: scikit-learn **1.9.1**, [F1](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.f1_score.html), [precision/recall/support](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.precision_recall_fscore_support.html), [confusion matrix](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.confusion_matrix.html). These support the formulas/orientation; failure populations, unavailable conventions, and diagnostics are project policy.

## Verification and review

- `bun test apps/api/src/scoring`: **75 pass, 0 fail, 401 assertions** across four files.
- `bun run test`: **287 pass, 0 fail, 11,478 assertions** across 16 files, including all scoring and prior mathematical/protocol/suite tests.
- `bun run lint`, `bun run typecheck`, and `bun run build`: **Pass** for API/web. Type generation and build ran sequentially. No remaining check errors or warnings were reported.
- Default reference-suite integration scores all **225 logical trials**, preserves all five depths, and checks 75 expression/node/prompt-length observations without paid calls. Test predictions are synthetic, not observed model answers.
- Strict-boundary checks cover forged labels/reasons, versions/profile/suite binding, missing/duplicate/unknown trials, attempt ceilings/order/final selection, invalid retries, incomplete/empty inputs, durations/counts/costs/tokenizers, getter rejection without invocation, and caller mutation during asynchronous validation.
- Independent behavioral verification reproduced exact fixture report bytes and rechecked hand-calculated metrics, retry separation, usage/tokenizer coverage, unavailable/provisional populations, ordering, duplicate/missing rejection, all depth slices and unavailable baselines. **Verified**.
- Independent code review found unbounded retained strings and quadratic tokenizer-group allocation. Fixed per-field/aggregate retention limits, sparse supplied measurements, and pre/during-read CLI byte bounds; boundary tests preserve oversized-answer failure scoring and reject oversized evidence/files. A 1,000-tokenizer-group regression stores exactly 1,000 supplied entries. Re-review found **no remaining actionable findings**.
- Independent bounded re-verification reproduced the final 22,945-byte report/hash, confirmed sparse coverage, accepted exact reply/error retention boundaries, and rejected excess/aggregate text before hashing. **Verified**. Invalid UTF-8 and exclusive-file checks also pass in the final CLI tests.

Tested on macOS, Bun **1.4.4**, Node.js **24.22.1**. No credential, live inference, browser, HTTP, ranking, or production evidence-capture behavior was tested or claimed by this module.

## Downstream requirements and limits

- **07/08:** Supply every planned logical record, exact attempt outcomes/raw text, actual provider/model/settings identity, usage field semantics, nullable evidence, cost provenance, and separate logical/run timing. Enforce D-08 retry authorization and preserve the captured evidence. Do not use a scoring status as proof of provider authenticity or execution eligibility.
- **08:** Call the shared scorer and retain its version, exact source evidence, suite identity, and exported report. Do not silently omit failed/unattempted work or fabricate usage/prices/tokenizers. Recompute older evidence only when it satisfies the same contract and mark the scorer version.
- **09/10:** Render report values/counts/nulls directly; preserve every depth, provisional/unavailable states, spread eligibility, fixed class set, outcome denominators, tokenizer/usage/cost coverage, and 0–1 versus percentage-point units. D-10 still owns ranking eligibility and submission aggregation.
- **11:** Explain pooled macro-F1 alongside accuracy, class detail, unusable outcomes, and completion. Descriptive three-trial spread is not certainty, agreement is not correctness, and token counts do not establish a reasoning failure mode.

Live provider evidence, meaningful model difficulty (G-SIGNAL), reporting UI/charts, storage/credential lifecycle, and leaderboard publication remain later modules. Conditional step/decomposition metrics remain unavailable until their required method contracts exist.
