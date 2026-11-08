# Results of the interior curvature exploration

Both frozen study cells completed and were explicitly published and archived. **Each requested model returned 216 valid correct labels across the same 72 mathematical tasks, with no wrong, invalid, truncated, refused or infrastructure outcomes.** The terminal ledger settled on **2026-11-08 at 09:10:21.584 UTC**. This is complete descriptive reporting for a separately frozen, adaptive exploratory population.

| Requested model | Profile | Tasks | Planned / included answers | Accuracy | Macro-F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| `gpt-6-astra` | `one-shot-json-v2-max` | 72 | 216 / 216 | 100% | 1.000 |
| `gpt-6.1-sol` | `one-shot-json-v2-max` | 72 | 216 / 216 | 100% | 1.000 |

These are two separate settings cells, not a pooled cross-model score. They share the same 72 functions/domains; 432 returned answers do not create 432 independent mathematical tasks. The three families share **eight source-polynomial clusters**, and every task has raw operation depth **13**. Each cell uses three fresh trials per task, max effort, a 16,384-token output ceiling, concurrency four and one inference attempt per trial. A common output ceiling is not a claim of equal compute.

The [execution plan](interior-experiment-v1.md) and [independent mathematical review](independent-interior-review-v1.md) retain the design, reference arguments and exposure history. Earlier parent high/max outcomes had been inspected before these families were constructed. This population is exploratory rather than held-out confirmation; its criteria were not changed after observing these results.

## Frozen source and budget proofs

The [machine-readable study review](../../apps/api/data/quality/interior-study-review-v1.json) is **327,592 bytes**, file SHA-256 `b3e38bfcef4cfb8b47aa186bd1a42d81372787ef93f857728a9b56fff94587b2`, canonical SHA-256 `9c70942c5e6821f06d874951bc044ce0ffbdd8b9ac958ab195106444f523f6ab`. It contains the actual frozen manifest, terminal ledger, publication index, independent arithmetic and production frontend checks, source hashes, full offline quality reports and explicit claim limits. It contains no model transcript, provider key or run-access code.

Unless explicitly called a file hash, the following are SHA-256 of recursively key-sorted JSON, using `qualityDataHash`; array order is preserved.

| Evidence | Canonical SHA-256 |
| --- | --- |
| `interior-matrix-v1.json` | `a4f109d0ddd550442d10978bfd1854c07ba04bb4f6268dc7cdaead701106d536` |
| Terminal `interior-progress-v1.json` | `d92527579936e750e144255d316aa332553ef09956a2171c509527d58e654f4a` |
| Published archive index | `b71e6fdcaf51fc060ba03d159b6f3e18e81d7b72e33c0d9204fc07d7d7eadffa` |
| [Primary reconciliation](../../apps/api/data/experiments/interior-reconciliation-v1.json) | `2673394dccf68d3e709cd63849c9f00c7c712d54460fdbed73641790ba75758e` |
| [Per-attempt send evidence](../../apps/api/data/experiments/interior-send-evidence-v1.json) | `942ea036f52d8812030862236a949a67af637e3839b28f937352a2298f2cae3a` |

The primary/send proofs were checked at **09:19:28.112 UTC**, after terminal settlement. They cover all and only the two unique started study cells and all 432 unique attempts. Every per-attempt projection binds the actual complete result hash, case/trial identity, inference and HTTP counters, and null failure. The exact committed send validator accepts the proofs and rejects both an extra private field and a changed whole-private-view hash.

The study records **432 inference sends and zero recorded unknown remote outcomes**. The actual HTTP-attempt total is **864**; HTTP accounting includes metadata operations and is not an additional 432 model inferences. The send projection retains the actual per-result counters without replacing them with an assumed one-HTTP-request count.

Cumulative accounting through this study is **7,522 recorded/reserved requests**: 225 original mathematical sends, 6,678 replication sends, 183 retained capability requests counted once, a four-request earlier calibration allowance, and 432 study sends. The original 11 and replication 101 unknown remote outcomes are **already included in those send totals**, not subtracted or added again. The unchanged shared ceiling is 8,192. These are conservative request counters, not provider bills or currency estimates. Later populations require their own prospective decisions and accounting.

## Private/public provenance

The complete public and private **RunRecord bodies are exactly equal**. Their whole RunViews differ only in publication metadata: the private export was retained before publication and has `publishedAt:null`; the archive contains the actual subsequent publication timestamp. The proofs deliberately bind the **whole original private RunView** and never synthesize a timestamp to force equality.

| Requested model | Whole private RunView SHA-256 | Whole public RunView SHA-256 | Actual public timestamp |
| --- | --- | --- | --- |
| `gpt-6-astra` | `82e3fef29e67abc04efaa9ec34d99370de11c24f1bafe9eb67817bc72d08764d` | `ffd297a0d90a9d876ca2abf20923032759dcbe1cddc0dfcc139454b2e9de63ae` | `2026-11-08T09:10:21.486Z` |
| `gpt-6.1-sol` | `3460530d2302fa151b093f8b702ee0aa6834b115a2d3a045aa53fb80f731db02` | `07bd4c8f37ce04ad7a7b9b3f78a2fd46197ba33462d6bf69f1cfaa4f534fa1ca` | `2026-11-08T09:06:03.706Z` |

The archive index binds the public hashes. Primary `recordSha256` and send `viewSha256` bind the private hashes. Both layers retain their own provenance; record equality does not imply whole-view equality.

## Reporting verification and interpretation

Independent arithmetic replay passed on both private and both public records. It recomputed class metrics, fixed-three macro-F1, accuracy, all outcome denominators, confusion and directional errors, every depth, trial spread/agreement, token semantics and coverage, latency quantiles, reported cost coverage, lengths and tokenizer provenance. Each reference class has support **72** per model cell and precision/recall/F1 equal to one; the confusion matrix is diagonal. All three replicate macro-F1 values are one, with sample standard deviation zero. The 72 eligible cases have 216/216 agreeing trial pairs.

Full offline quality replay separately validated native certificates and canonical prompts, reproduced the complete shared-scorer report and checked retained request/settings/budget bindings. Reference membership matches the independently reviewed mathematical fingerprint `a503a736a8f19c18598f4758993fb40c136f2e4a31b80d2c9857ba86d13919b9`. Native replay supplies reproducibility evidence; the independent mathematical review supplies the separate derivative and global-sign arguments.

A separate AI-assisted checker executed the actual frontend adapter on the real archived RunViews. All **two overall and two depth slices**, **six depth-filtered exports**, **six full exports**, and **twelve token-series selections** match the retained reports and exact case/trial membership. This is offline execution of production projection code, not browser-rendering or accessibility verification.

The failure-review queue is empty because every retained label is correct. **The 432 correct explanations were not qualitatively certified by this study review.** A correct extracted label does not establish that every intermediate calculation or written explanation is mathematically sound. No human expert approval, explanation repair or grade change is asserted.

Both full quality reports remain **No-go for confirmation coverage**, with blocker `exploratory-interior-coverage`. Confidence intervals are **unavailable**: eight shared clusters fall below the 20-cluster requirement and span multiple family tags, while three families do not meet the unchanged six-family confirmation condition. Both G-SIGNAL verdicts are **No-go**, with no wrong-label candidate cases. These results support finite-population descriptive counts; they establish neither a model ranking nor general mathematical ability, depth sensitivity, contamination freedom or zero future error.

The study exposed no returned classification error in either requested cell. The original **11 dispatched frontier remote outcomes remain unknown**, so the evidence does not establish universal absence of actual or hidden errors. Any later conditional reserve remains a separate, prospectively governed experiment; this review does not activate it or revise earlier populations.

Provider costs are unreported for all 432 attempts. Reported reasoning tokens are a subset of output-token totals and must not be added to those totals again. Different reported token use or trial latency on this narrow population does not establish a general efficiency ordering.

## Reproduction

With the repository dependencies installed, this key-free command replays report arithmetic against the published archive and exercises actual filtered exports:

```sh
bun - <<'TS'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditRetainedMetrics } from './apps/api/src/quality/reporting-audit';
import { adaptRunView, buildReportExport } from './apps/web/src/lib/report-adapter';
const root = 'apps/api/data/experiments/interior-progress-v1-published/';
const index = JSON.parse(await readFile(root + 'index.json', 'utf8'));
for (const entry of index.records) {
  const view = JSON.parse(await readFile(root + entry.file, 'utf8'));
  const arithmetic = auditRetainedMetrics(view.record);
  assert.equal(arithmetic.correct, 216);
  const projected = adaptRunView(view);
  for (const field of ['input', 'output', 'reasoning'] as const) {
    const semantics = projected.overall!.usage.fields[field].groups[0].semantics;
    for (const depth of [null, 13]) {
      const exported = buildReportExport({ detailRun: projected, curveRuns: [projected],
        depth, usageField: field, usageSemantics: semantics });
      assert.equal(exported.runs[0].trials.length, 216);
    }
  }
}
console.log('Two complete reports and twelve exports passed offline replay.');
TS
```

Actual verification also included the full source-bound frontend comparisons, all 432 attempt hashes and unique identities, exact private/public record equality, full quality/native/shared-scorer replay, exact committed send-schema checks, privacy scans and `git diff --check`. No provider/API calls, credential reads, database writes, publication mutations or commits occurred during this review. Only the four new review/reconciliation documentation and data files were authored; source code, build behavior and runtime policy were unchanged.
