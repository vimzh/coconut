# Module 04 Technical Plan: Scoring and Depth Analysis

## Scope and readiness

Modules 02 and 03 provide the fixed three-trial one-shot profiles, strict answer extraction, and replay-validated suites. Implement an offline shared scorer, inspectable reports, independent fixtures, and a local report CLI. No execution, provider calls, pricing lookup, UI, ranking, new mathematical rules, or new method profiles belong here. Preserve existing verifier, protocol, and suite semantics; add no dependencies.

## D-05: version 1 policy

Report/scorer version `1`, policy ID `pooled-macro-f1-v1`. A report binds the exact frozen suite, protocol/profile, model/provider/endpoint/settings identity, run ID, planned trials/attempt budget, scorer policy, and supplied execution evidence. Canonical record ordering makes reports reproducible independent of input array order.

### Population and completeness

- One logical observation per case and trial index (0–2). Require every planned record, including explicit unattempted records. Reject missing/duplicate/unknown case records, conflicting references, wrong identities/versions, malformed data, and excess attempts. Reference labels, depth, rendered expression, and node count come only from the replay-validated suite. Only purpose `evaluation` is scoring input; illustrative suites cannot become measured evaluation records.
- Attempt records retain sequence, protocol `AnswerOutcome`, usage, elapsed time, optional provider-error category, and cost evidence. Re-extract outcomes from raw text and their explicit completion state and require exact equality. Attempts use contiguous sequences starting at 1; `finalAttempt` explicitly identifies the last sequence, or is null with an empty attempts array for unattempted work. Earlier attempts can only be provider-error/interrupted outcomes; this rejects retries of mathematical/format failures without deciding D-08's narrower transient-error authorization.
- Retention bounds are 131,072 UTF-16 code units per raw reply, 4,096 per provider-error message, and 16,777,216 raw-reply/error code units across all attempts. Reject excess before report hashing; never truncate, omit, or substitute evidence. The reply bound exceeds the extractor's 65,536-unit threshold so oversized-answer failures remain representable. Large runs must satisfy this explicit retained-evidence budget as well as their call budget; a future streaming retention contract requires a versioned change. Transport/file readers remain responsible for bounding bytes before parsing an input object.
- Valid answers and unusable returned outcomes (`invalid`, `refused`, `truncated`) enter the scoring population. Each unusable outcome contributes support and one reference-class FN, no FP, one accuracy-denominator observation, and the unusable matrix column. Invalid reason `empty` is the empty category; `duplicate-field` is the conflicting-field category; other invalid reasons remain invalid. An explanation contradicting an explicit valid label is not a separate failure, per module 02.
- Provider errors, interrupted/cancelled work, and explicit unattempted work are excluded from mathematical denominators and counted separately against planned trials. Any exclusion makes an available score provisional. Zero included observations gives unavailable scores, including when the input is a valid all-unattempted plan. Malformed/entirely empty envelopes fail; they cannot fabricate a score.

### Metrics and spread

For each fixed label: `P=TP/(TP+FP)`, `R=TP/(TP+FN)`, `F1=2TP/(2TP+FP+FN)`. P/R are null when their denominator is zero. For a nonempty population, a zero F1 denominator contributes 0 to the fixed-three mean; all F1s are null for an empty population. Flag absent reference classes. Macro-F1 always averages exactly the same three labels, never only present classes. Accuracy is correct/included.

The headline pools all included instance-trial observations, not depth averages or trial averages. Confusion rows are references; columns are convex/concave/neither/unusable. Report raw counts and row rates, with absent rows null. Directional rates are convex→neither/included convex support and concave→neither/included concave support, with explicit numerators/denominators and null absent-source rates.

Report each trial index's pooled metrics and population. Repeated-trial spread admits only replicate indices with a returned model outcome for every planned instance in the slice, ensuring matched membership. Report eligible/planned replicates, mean/min/max, and sample SD using divisor `n−1`; SD is null for fewer than two eligible replicates. These three repetitions do not establish confidence intervals.

Agreement admits only instances whose three planned trials all yield valid labels. For each, count agreeing unordered pairs divided by three; average equally over eligible instances. Report eligible/total instance counts. Unanimous, two-matching, and three-distinct labels yield 1, 1/3, and 0. This is not majority-vote scoring.

Retain every planned depth, including empty scoring slices. Depth degradation is `depthMacroF1−shallowestPlannedDepthMacroF1`, on the 0–1 scale; displays can multiply by 100 for percentage points. A missing baseline yields null differences rather than shifting the baseline. Preserve class/depth coverage and the known depth/length/piece-count confound.

### Usage, lengths, timing, and cost

- Usage is provider-reported per-attempt input/output/reasoning token counts, each either null or `{count, semantics}`. Counts are nonnegative safe integers; semantic identifiers are retained. Group incompatible semantic identifiers rather than silently combining them. Report total/reporting/missing attempts, known totals and means for each field; reasoning is never inferred or added to output totals.
- Logical-trial usage sums all attempts only when every attempt reports that field under the same semantics. Otherwise it is unavailable for that trial/field. Report complete and missing logical-trial counts separately; unattempted work never supplies zero usage. Retry usage/cost remains in attempt totals even when the final logical answer succeeds.
- Compute raw rendered-expression Unicode code-point length and certificate node count once per suite case. Compute model-visible message-content character length separately through `buildPrompt`; this is not a provider token count or full serialized request size. Optional local expression-token measurements bind case ID and expression SHA-256, tokenizer ID/version/model ID. Wrong expression hashes fail; missing or model-incompatible tokenizers produce unavailable counts with explicit coverage. Group differing tokenizer identities, retaining only supplied measurements per group so report size is linear in cases plus measurements. Do not invent a tokenizer or counts. Decomposed inputs and intermediate-step diagnostics are explicitly not applicable to both current profiles. No hidden reasoning, rubric, or trace checker is fabricated; future methods require their own versioned contract and fixtures.
- Logical-trial latency uses only final returned model outcomes with known elapsed time, including unusable replies. Report p50/p95 via nearest rank `ceil(p*n)−1`, reporting/missing/eligible counts, and infrastructure/timeout counts separately. Preserve supplied run wall time/concurrency without deriving either from trial durations.
- Actual billed cost uses nonnegative exact decimal amount plus currency. Estimates require dated/source-identified input/output per-million rates, matching usage semantics, and observed input/output usage. Calculate estimates exactly with integer decimal arithmetic (rate precision ≤12 fractional digits; cost precision ≤18). Reject estimates lacking required usage or compatible semantics. Report each pricing/currency/kind group and missing-attempt coverage; a complete total is available only when one compatible group covers every attempt. Mixed/partial known subtotals never masquerade as a complete bill. No live price assumptions or currency conversion.

### Independent numerical examples

For references C/A/N, trial predictions `(C,A,N)`, `(C,C,C)`, `(unusable,A,N)` produce pooled confusion rows `C:[2,0,0,1]`, `A:[1,2,0,0]`, `N:[1,0,2,0]`. F1s are 4/7, 4/5, 4/5; headline macro-F1=76/105, accuracy=2/3. Trial F1s are 1, 1/6, 2/3; their mean=11/18 and sample SD=√57/18. Agreement=1/3 over 2/3 eligible instances. This distinguishes pooled and trial-averaged F1.

For four C/one A/one N always predicted C: class F1=(4/5,0,0), macro-F1=4/15 while accuracy=2/3 and agreement=1. A nonempty perfect C/A-only scoring slice has F1=(1,1,0), macro-F1=2/3, accuracy=1, missing N coverage and unavailable N recall. These are controlled fixtures, not model results.

Formula references checked 7 November 2026: scikit-learn **1.9.1** [F1](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.f1_score.html), [precision/recall/support](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.precision_recall_fscore_support.html), and [confusion matrix](https://scikit-learn.org/1.9/modules/generated/sklearn.metrics.confusion_matrix.html). They are independent definition references, not runtime dependencies. Missing-data populations, unusable column, and null conventions are project policy, not claims of identical library defaults.

## Architecture and ownership

Create `apps/api/src/scoring/`:

- `types.ts`: input evidence and normalized observation/length contracts; main agent owns.
- `classification.ts` and tests: pooled counts, classes, matrix, reliability, agreement, replicate scores/spread. Independent worker owns.
- `usage.ts`, `cost.ts`, `diagnostics.ts` and tests: attempt/logical usage, exact costs, latency, length/tokenizer diagnostics. Independent worker owns.
- `validation.ts`: strict bounded evidence parsing, outcome replay, record completeness, identity/sequence/semantic validation; main owns.
- `scorer.ts`, `index.ts`: public async `scoreEvaluation({suite,evidence})`, complete frozen report, per-depth integration, deterministic identity; main owns. Suite validation remains module 03's function.
- `cli.ts`: `--input <json-path> --output <new-json-path>`, exclusive file creation, actionable errors, 128-MiB input-file limit checked before and during streaming ingestion. Main owns.
- Controlled input and expected report artifacts under `apps/api/data/scoring/`, with fixture model/run identity and no claimed live results. Integration tests exercise public APIs, artifact reproduction, all-unattempted evidence, malformed records, and default-suite counts.

No existing production caller uses a scorer. Modules 07/08 must supply this evidence contract and preserve extraction/attempt identities. Future UI/leaderboard consumes the shared report, not a second metric implementation. Keep raw provider responses and private reference evidence out of report messages sent to models; reports contain summaries and retained identity, not credentials.

## Verification checkpoints and handoff

1. Hand-calculated fixtures for perfect/all-wrong/imbalanced/unpredicted/absent/empty populations and unequal depth/repeated trials; reconcile all confusion/support/completion totals.
2. Failure and trust-boundary tests cover every protocol outcome, forged labels/reasons, conflicting/missing/duplicate records, incompatible versions, getters/arrays, retry limits and final selection, incomplete runs, sparse spread, and unavailable baseline.
3. Diagnostic fixtures cover reporting/missing reasoning tokens, semantics grouping, retries, tokenizer mismatches/hash binding, raw vs prompt lengths, nearest-rank quantiles, cost precision and partial coverage, and explicit not-applicable trace diagnostics.
4. Public scorer/CLI reproduces the controlled expected report; default suite integration has 225 planned logical trials and preserves all five depths. No paid calls.
5. Run `bun test apps/api/src/scoring`, `bun run test`, `bun run lint`, then sequentially `bun run typecheck` and `bun run build`. Independently review code and behavioral outputs; resolve findings before completion.

Write `docs/handoffs/04-scoring-and-depth-analysis.md` with exact versions, input/output artifacts, commands/results, outcome/denominator mapping, worked fixtures, supported environment and limits. Resolve D-05/progress in the roadmap and update product state. Preserve concurrent later-module documentation edits while committing owned work checkpoints and pushing the existing private repository.
