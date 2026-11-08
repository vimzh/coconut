# Fixed reserve: two-cell operator study

The operator implements the [coordinator's recorded decision](conditional-reserve-decision-v1.md), following the [operational amendment](conditional-reserve-operational-amendment-v1.md) and the [independent runtime reference review](independent-reserve-review-v1.md). No model request was made during implementation. The subsequent frozen execution is recorded below; its original failed outcomes remain unchanged.

The original absolute absence condition remains unproved. Eleven baseline frontier requests have unknown remote outcomes; they remain unknown and counted. The amendment was adopted after disclosed partial P5 exposure. Both P5 cells subsequently completed 216 valid correct labels, without wrong, unusable or infrastructure outcomes; the exact public-view hashes and source identities are retained in the decision record. This is adaptive exploration after observed ceiling performance.

## Fixed population and gates

There are exactly two new cells: `gpt-6-astra/max` and `gpt-6.1-sol/max`, direct OpenAI, profile `one-shot-json-v2-max`, plain JSON, 16,384 output tokens and four concurrent trials per run. Each cell requests all 18 fixed reserve cases three times: **54 fresh planned trials per model, 108 maximum new inference requests**. The two runs allow at most eight simultaneous inference operations. SDK and scheduler retries remain zero, with one attempt per trial, a 20-second metadata deadline and a 180-second inference deadline.

The suite is `reserve-v1`, seed `coconut-reserve-exploratory-v1`, with `smooth-v2` prompts. It retains three families, two related source groups and six cases per label. The full domain, membership, certificates and mathematical reference methods remain in the [runtime documentation](reserve-runtime-v1.md).

| Binding | Pinned identity |
| --- | --- |
| Base suite | `suite-reserve-v1-54c719576846a0437a431372204593bd8ea47f4af99def6a654db4a93502e7c7` |
| Max suite | `suite-reserve-v1-c4efdfed64c8ff0696db7c6f2bb2a85b8bf563bf253d84cd0547e62c7803b224` |
| Max suite canonical SHA-256 | `b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811` |
| Max prompt array canonical SHA-256 | `e50da50ec96c12639e71e1adf40d4725a1c3b593e47c300dc4dc0307016cd0c6` |
| Reviewed reference fingerprint | `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615` |
| Independent review canonical SHA-256 | `2c69ff774dce5b6b90f0b1d3c709d7bd102b4e4cca1aefed2dcb6564ccd851e3` |
| Coordinator decision canonical SHA-256 | `29aea846d30bce67bc2e57fc7429824a5ea825362d5e4e9a44dd04e365158fa7` |
| Earlier amendment canonical SHA-256 | `5ab07c79467049062a5c01a538a9d88cb5c33e0bf041cdb462b6c6249b2d9e5a` |
| Original proposal raw file SHA-256 | `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85` |

Freeze checks all gates, the decision-bound completed P5 public views, the independent review's verified status and exact membership, all retained effort controls, and suite/prompt/settings identities. The review verifies references and runtime behavior; it establishes no model difficulty or performance claim. Launch reconstructs these same bindings and requires the live API to advertise six suites, including the exact 18-case reserve base identity, with the existing execution policy.

These gates apply only to this separately bounded operator study. Direct API and visitor-owned credential runs retain their ordinary suite-selection boundary; visitors do not need a private research manifest or lineage accounting artifact.

## Actual-send accounting before freeze

The coordinator supplies an immutable `reconciled-inference-accounting` artifact with exactly four studies: `original`, `replication`, `interior` and `remaining-models`. Each study includes the existing manifest, terminal ledger, primary reconciliation and per-attempt send-evidence paths and canonical hashes. The original reconciliation remains unchanged. The supplement manifest is pinned at canonical SHA-256 `583601ed027c0227ca0063734ca65f92bd590cc048688b46e984d530f7b900c5`.

The reused send validator requires all and only unique started ledger run/cell identities, terminal records with zero active trials, full-view hashes matching primary records, original planned denominators, unique case/trial attempts and valid zero-or-one send counts. Actual sends and unknown remote sends are derived from attempts and reconciled against all per-run and aggregate counts. Primary, send-evidence and accounting chronology must follow terminal ledgers. Aggregate-only attestations are rejected.

The 183 retained capability sends and calibration allowance four are counted once. `controls.sha256` identifies the canonical retained `probes` array from the existing control artifact, matching the earlier manifests. No new setting control is called. Unknown remote sends are included within actual sends and never added twice or treated as free capacity.

Admission requires actual prior sends at most **7,738**, and `actual prior + 108 <= 8,192`. The conservative resulting ceiling is **7,846**. The actual total and each source binding must be supplied by the coordinator after settlement; the operator never substitutes a reservation or guesses an incomplete count.

## Commands, retention and publication

Commands used for the recorded study were:

```sh
bun apps/api/src/experiments/reserve-experiment.ts freeze --prior-accounting apps/api/data/experiments/conditional-reserve-prior-accounting-v1.json --output apps/api/data/experiments/conditional-reserve-matrix-v1.json
bun --env-file=apps/api/.env apps/api/src/experiments/reserve-experiment.ts run --manifest apps/api/data/experiments/conditional-reserve-matrix-v1.json --output apps/api/data/experiments/conditional-reserve-progress-v1.json --accept-charges --publish
```

Those artifacts now exist; repeating the commands refuses overwrites. Any new study requires a separate recorded decision and fresh actual-send accounting. Charge consent and publication are separate explicit flags. The runner does not restart the API or replace failed operations.

Once-only private receipts are saved synchronously and atomically with mode 0600 before the next stream event. Duplicate run identities, repeated private codes and provider-credential reflection are rejected. Private receipts and full outcome views remain in ignored private paths. A separate bounded read-only settlement deadline collects failed, cancelled, timed-out and interrupted outcomes after foreground cancellation; it never starts another inference. Every retained cell keeps its original 54-trial denominator.

Only complete qualified private records may receive publication requests. The existing archive helper then retrieves evidence anonymously at the fixed public API destination, verifies exact cell identity and report arithmetic, and writes a separate public archive. The reserve wrapper also checks post-freeze chronology, exact equality with the settled private execution and absence of private-code reflection. Failed records remain private. Incomplete execution, lost receipts, storage failure, failed publication or archive failure produces an unsuccessful exit; it never silently starts paid replacement work.

Before archiving, the runner exclusively retains one detached ledger snapshot as `<progress-name>-archive-source.json` beside the progress file. The archive index's `ledgerSha256` binds that exact retained source, which is passed unchanged to the archive helper. Final progress then records archive flags and a later update time; its hash intentionally differs from the archive source. The source file remains unchanged after final progress is saved. An existing archive-source path or archive directory refuses admission, and a source-write failure prevents archiving.

## Verification and limits

The focused offline fixtures pass **eight tests with 63 assertions**. They cover exact two-cell/108-request membership, unchanged gate hashes and P5 snapshots, altered suite/prompts/profile/settings/control evidence, six-suite API admission, active-parent refusal, actual/unknown budgets, aggregate-only and altered-attempt rejection, explicit charge consent, unsuccessful incomplete/publication/archive status, exclusive manifests/records, atomic receipts, repeated private codes, reflection, storage failures and qualified public archives. A real archive fixture verifies that the index still binds the retained pre-archive source after final progress changes its archive flags, and that the source cannot be overwritten. Controlled SDK responses and synthetic supplement reconciliation projections are fixtures, not live reserve observations.

API lint, type checking, build and the full experiment tests are run before handoff; final integrated outcomes belong in the coordinator's verification record. Mathematical/runtime tests and the separate independent reference review retain their own evidence and limitations. No live reserve runner or network-provider behavior was tested during this implementation.

The population remains exploratory and unranked, with **two related groups, no eligible confidence interval and no stronger signal claim**. Earlier failed populations, inspected P5 outcomes and the new reserve remain separate. The 18 fixed tasks do not become 18 independent mathematical draws, and no model failure is guaranteed.

## Recorded 180-second execution

The manifest was frozen at **2026-11-08 10:24:24.182 UTC**, canonical SHA-256 `a27c2ec00a34ac5d448c172126ece0c5a40d9407b1ed44c511f03d42abd69d41`. Its prior accounting is canonical `ddb87a46d05cea8bbb2f1293bb1d33343d28dc0a0615be6a36fb37df18e6371e`: 7,738 actual prior requests and at most 108 new requests, within 8,192.

The attempt ended at **10:28:38.142 UTC** with both cells failed and the operator exiting unsuccessfully. Each retained four dispatched attempts: across both cells there were **two inference timeouts, six peer cancellations, eight sends with unknown remote outcomes, zero returned model outcomes and 100 unattempted trials**. These infrastructure outcomes establish no mathematical misclassification and no complete score. Both original 54-trial denominators remain intact.

The private records and final ledger are retained. No run was published; the archive has zero records and two omissions. Its index binds the separately retained pre-archive source ledger, whose counts/cells equal the final ledger while its update timestamp differs. Actual cumulative accounting is **7,746**; the eight uncertain sends remain counted. The [reconciliation](../../apps/api/data/experiments/conditional-reserve-reconciliation-v1.json) and [attempt evidence](../../apps/api/data/experiments/conditional-reserve-send-evidence-v1.json) bind those records without replacement inference. Any later longer-deadline diagnostic uses its own method identity and freeze; this platform's 180-second contract and this unsuccessful study are preserved.
