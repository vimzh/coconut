# OpenAI replication review, terminal interrupted attempt

**The parent attempt ended interrupted, not successfully complete.** This review binds the terminal ledger updated **2026-11-08 07:59:46.559 UTC**. It covers every completed/published cell and the arithmetic/accounting of every available failed/interrupted record. Five cells never started. Neither the attempt nor this review establishes successful evaluation of all 47 inventoried text-model IDs.

The reviewer and the two bounded transcript-review workers were **AI-assisted**. No human approval, provider inference, credential read, private-access-code use, publication mutation, run replacement or grade repair occurred in this review. The earlier [partial review](openai-replication-review-v1.md) and its artifact remain unchanged. Subsequent experiments are separate populations and are outside this review.

## Frozen sources

| Source | Binding |
| --- | --- |
| `openai-matrix-v2.json` | Canonical SHA-256 `62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e` |
| `openai-progress-v2-capabilities.json` | Canonical SHA-256 `e1f680a94f881df6667ce6ca8e7ce268475ba424462a6bfa5850813a41e01000` |
| Terminal `openai-progress-v2.json` bytes | File SHA-256 `a129015124f36932a5a9891703624bac24cc75d302cc2664363a36805cd84d84` |
| Prior partial review | File SHA-256 `a52fa3a8c5bdf272849b02e89c4b76e5fc67bc6f7b1a546d0f4d7136f622e7e6` |
| [Terminal machine-readable review](../../apps/api/data/quality/replication-review-v2.json) | **1,271,914 bytes**, file SHA-256 `b01b36babc3f5bafc652353dfa84817ff8e4b522fefe44bf5f4442c6458fd20c` |

Actual manifest and bound capability objects, not opaque hash assertions, were supplied to the quality audit. Quality implementation hashes are included in the artifact and invalidate incremental quality caches when those source files change. Each source RunRecord/report, affected reference and reviewed transcript is hash-bound. The artifact contains aggregate evidence and diagnosis notes; it contains no raw private failed answers, provider credential or run-access code.

## Coverage and explicit incompleteness

| Terminal cell state | Count |
| --- | ---: |
| Completed and explicitly published | 171 |
| Failed | 35 |
| Interrupted | 1 |
| Capability unverified; no mathematical run | 26 |
| Pending; never started | 5 |
| Frozen mathematical cells | 238 |

The retained setting controls established eligibility for 212 planned mathematical cells; 207 started and five did not. **46 requested model IDs have execution records; 43 have at least one completed/published cell.** A recorded request or POST is not proof that a model returned a mathematical answer. Aliases and dated snapshots remain separately requested identities, not counts of independent architectures.

The five unstarted screening configurations are `o3` high and `o3-2025-04-16` default/low/medium/high. The latter requested ID has no mathematical execution record in this parent attempt. `o3` medium is the interrupted cell. These omissions are retained in the terminal snapshot and cannot become invented zero scores or successful coverage.

Six completed cells use the full 72-task confirmation suite; 165 completed cells use the separate nine-task exploratory screen. Their **5,751 included outcomes** contain:

- **5,066 correct labels** and **493 wrong valid labels**.
- **69 invalid replies**: 68 other invalid replies and one conflicting duplicate-field reply; there are no empty-reply invalid outcomes in these completed cells.
- **123 truncated replies**, with no mathematical label recovered from truncation.
- No refusals or infrastructure outcomes in the complete populations.

These combined execution counts are not a pooled cross-model score. Every cell retains its actual profile, output ceiling, suite/prompt/settings identity and official scorer report. Different settings are not presented as equal compute.

## Inspection of all completed-publication failures

Every **685** wrong or unusable outcome in the 171 completed/published cells was inspected. The earlier 230 reviews were reused only after exact reference and transcript hash matching; **455 additional outcomes** were read in full and reviewed. Every review retains case/trial/attempt IDs, official outcome/label, reference label, requested model/profile, reviewer role, hashes, diagnosis and a visible-evidence explanation. No official grade changed.

| Primary diagnosis | Outcomes |
| --- | ---: |
| Written mathematical error | 263 |
| Expression/domain misreading | 81 |
| Unresolved label/conclusion inconsistency, mixed failure or insufficient written evidence | 192 |
| Formatting-only failure | 26 |
| Budget exhaustion | 123 |
| Total inspected | 685 |

Wrong labels paired with an explanation concluding the correct class remain wrong under the protocol, but are not automatically called mathematical-reasoning failures. Some also contain intermediate algebra errors, which the notes preserve. A correct inconclusive bound without a written conclusion is likewise insufficient to diagnose a mechanism. Invalid replies with additional mathematical/object errors remain unresolved mixed failures; they are not repaired into scored labels.

Observed mathematical issues include invalid reciprocal composition rules, reversed derivative signs, incorrect rational arithmetic, treating sparse positive samples as a global curvature proof, and inferring neither merely from opposing convex/concave components. Expression-misreading diagnoses identify visible incorrect degrees, powers or coefficients in the supplied degree-ten Horner polynomial. These describe written output; they do not establish hidden internal processing or intent.

Most formatting failures are JSON escaping or markdown fences. The conflicting-field outcome supplies two different labels; neither is selected after review. Provider `max_output_tokens` outcomes remain budget exhaustion even when some visible text is present. The full confirmation Luna/high error is formatting-only and its original invalid grade remains unchanged.

## Mathematical references and arithmetic verification

The affected mathematical references match the exact identities reviewed in [independent challenge review](independent-challenge-review-v1.md). New transcript cohorts introduced no changed reference hash. The reviewers rechecked the reciprocal derivative and interval signs, logistic-curvature bounds for the softplus families, and exact polynomial identities and witnesses. Independently written standard-library `Fraction` parsers expanded the actual Horner ASTs and differentiated them; no reference-label defect was found.

For the integrated family, `F''=p(x)^2-epsilon` with `p(x)=(x^2-9/25)(x^2-4/25)`. Positive and negative parameter regimes give global strict bounds; the neither regime has strict opposite interior signs. In particular, `F''(-3/5)=-1/4096` and `F''(0)=4917791/1600000000>0`. Additional exact checks of witnesses used in replies, including `F''(1/sqrt(10))=-1249/1600000000`, confirm that a few positive samples do not establish global convexity. A rounded decimal endpoint is not silently promoted into an exact lower bound; such numerical-rigor ambiguity remains visible.

`auditRetainedMetrics` independently recalculated the report arithmetic for **all 207 started records**, including the 36 failed/interrupted records. Checks cover report/evidence identities, class metrics and fixed-three-label macro-F1, accuracy, confusion/directional counts, all outcome denominators, trial spread/agreement, each depth, reported token semantics/coverage, latency quantiles, observed cost coverage and expression/prompt/tokenizer measurements. The existing strict parser supplies canonical input validation; the audit does not call the production classification or diagnostics calculations to obtain its expected arithmetic.

The actual frontend adapter and filtered-export functions also passed verification on **all 171 public completed views, 525 depth slices and 1,575 depth/usage-filtered exports**. Displayed values and filtered task/trial membership match retained reports. This is offline execution of the production projection code, not a browser-rendering or accessibility claim; those integration checks have separate ownership.

The scoped quality audit gives 140 complete-cell Go results and 31 No-go results with unresolved inspection evidence. All 171 complete cells remain **No-go for G-SIGNAL**. Cell-level Go does not mean complete matrix coverage, a global ordering, or a frontier failure finding. Sparse nine-task screening remains exploratory and unranked, with uncertainty unavailable. Confirmation intervals are conditional on the declared fixed-family cluster assumptions; a perfect finite-suite interval does not establish zero future error.

## Requested frontier accounting across every tested profile

The predeclared frontier IDs are `gpt-6-astra` and `gpt-6.1-sol`. Previous Sol and efficient Luna are comparators. For **each** declared-frontier ID, the replication completed:

- High and max confirmation: **216 valid correct labels each**.
- Default, low, medium, high, xhigh and max screening: **27 valid correct labels each**.

Across the original failed prefixes and this replication, the retained benchmark records therefore contain **1,402 valid frontier answers, all correct**: 214 original-prefix answers, 864 replication confirmation answers and 324 replication screening answers. Their ten retained quadratic setting controls also returned the correct convex label; those controls are not benchmark scores or additional mathematical tasks. No valid wrong frontier label was observed at any tested profile, including low/default screening. The latter would have counted as an observed classification error even if its explanation concluded correctly, while remaining insufficient for the stronger confirmation signal gate.

This is a statement about **returned, retained observations**. The original outage had 225 dispatched frontier mathematical requests but only 214 returned answers, leaving **11 remote outcomes unknown**. The evidence cannot prove that no unseen actual error occurred. It also supplies no conclusion about distinct later experiments, future responses or general mathematical ability. An activation condition using an absolute phrase such as “no actual frontier classification error has occurred” must not silently replace this qualified observed-data statement.

## Failed and interrupted evidence

All 36 failed/interrupted records are arithmetically accounted for and remain outside completed-cell claims. Their **1,350 planned trials** contain 813 included outcomes: **800 valid labels** (740 correct, 60 wrong) and **13 truncated replies**. The remaining outcomes are **35 provider errors, 94 cancellations and 408 unattempted trials**. The 60 wrong labels and 13 truncations in these incomplete prefixes were counted and mathematically scored, but were **not qualitatively transcript-diagnosed in this completed-publication review**. They are not used to claim a completed cell or a mathematical-failure mechanism.

The terminal failure-code distribution is four `incomplete-evidence`, thirteen `invalid-provider-response`, eighteen `timeout` and one cancellation. Per-record/per-attempt codes, HTTP status when available, planned/completed counts and source hashes remain in the artifact. An HTTP 400 or a timeout does not by itself establish a mathematical error, a precise outage cause or zero provider charges. No failed raw answer text is exported into this public review.

The interrupted `o3` medium record has two preserved provenances:

- Original export `private/openai-progress-v2/records/225f9c14-bb92-46eb-a07a-7c01ad303825.json`: a pre-final `cancelling` checkpoint with no report, record SHA-256 `a30c471ed2de7465549a5fdc28956cb439e7df2be96ab44a5a19d99953391092`.
- Supplemental settled read `private/openai-progress-v2/final-records/225f9c14-bb92-46eb-a07a-7c01ad303825.json`: `cancelled`, four finished infrastructure outcomes, 23 unattempted trials and zero **recorded** inference sends. Canonical whole-view SHA-256 `939693b2afa8f8924196817621f1e42786aebac5d26f1581bb5c7ab1cfabd40f`; report `report-v1-5abd0da20466228defdd10bac95ae7d6f1ae90dc24f6c574ded1779195366b3a`.

The trial/result/request evidence is unchanged between those exports. Arithmetic is checked against the actual settled report, without overwriting the original checkpoint or rewriting the ledger's interrupted classification. Reported zero sends is a retained counter, not a blanket guarantee about unobserved remote work.

The parent attempt records **6,678 mathematical inference sends**: 5,751 for completed cells and 927 in failed/interrupted cells. With the retained prior-call allowance of 412, conservative cumulative accounting is **7,090**, within the frozen 8,192 ceiling. These are request counters, not bills; cost totals remain unavailable where the provider did not supply cost evidence. The five unstarted cells correspond to another 135 planned trials that have no fabricated RunRecords or outcomes.

## Reproduction and verdict

The artifact retains the complete terminal ledger snapshot, all 171 public-cell identities/reviews and aggregate evidence for all 36 failed/interrupted records. Full local exports remain private and are needed for transcript replay; aggregate hashes do not replace them. Replaying the started-record arithmetic requires no provider key:

```sh
bun - <<'TS'
import { readFile } from 'node:fs/promises';
import { auditRetainedMetrics } from './apps/api/src/quality/reporting-audit';
const audit = JSON.parse(await readFile('apps/api/data/quality/replication-review-v2.json', 'utf8'));
for (const cell of audit.cells) {
  const view = JSON.parse(await readFile(`apps/api/data/private/openai-progress-v2/records/${cell.runId}.json`, 'utf8'));
  auditRetainedMetrics(view.record);
}
for (const cell of audit.failedCells) {
  const path = cell.sourceProvenance.supplement?.path ?? cell.sourceProvenance.originalPath;
  const view = JSON.parse(await readFile(path, 'utf8'));
  auditRetainedMetrics(view.record);
}
console.log(`${audit.cells.length + audit.failedCells.length} retained reports passed arithmetic replay.`);
TS
```

Actual verification: 207 retained reports pass independent arithmetic; 171 real public projections and their 525/1,575 depth/export checks pass; all 685 completed-publication wrong/unusable reviews have matching hashes and unique trial identities; the supplemental interrupted record matches its pinned view hash and settled report. The original partial review and parent evidence were preserved. No source-code changes, new provider calls, paid retries or publication changes were made by this review.

The verdict is **verified arithmetic and truthful bounded completed-cell reporting, with incomplete parent coverage and no supported declared-frontier failure finding**. The attempt must remain terminal-interrupted. Future work must be separately frozen and reviewed, and cannot silently replace the original or this replication's failed/unstarted cells.
