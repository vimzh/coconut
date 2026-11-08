# First matrix attempt and fresh replication

The first frozen matrix settled at 2026-11-07 22:12:43 UTC with **zero complete mathematical evaluation cells**. Its 212 executed cells failed because of incomplete infrastructure evidence; 26 candidate effort cells remained capability-unverified and were not evaluated. The ledger and all original private records are preserved. A failed run is not a model reasoning failure.

## Reconciled observations

The offline reconciliation in `apps/api/data/experiments/openai-reconciliation-v1.json` binds the original manifest, ledger and each retained record by canonical SHA-256. It checks requested model/profile/route/concurrency, suite and prompt content hashes, settings identity, planned denominators, unique case/trial outcomes and independently counted sends against the retained progress counts. This checks identity and accounting; it does not replace mathematical certificate replay or transcript review.

| Population | Observed count |
| --- | ---: |
| Executed mathematical cells | 212 |
| Complete mathematical cells | 0 |
| Planned trials in executed cells | 7,236 |
| Retained attempt outcomes | 7,236 |
| Valid answers / correct labels among them | 214 / 214 |
| Provider errors | 7,022 |
| Network errors / timeouts | 5,767 / 1,255 |
| Mathematical inference requests sent | 225 |
| Sent requests with unknown remote outcome | 11 |
| Failures before an inference request was sent | 7,011 |
| Previously retained capability requests | 183 |
| Earlier calibration allowance | 4 |
| Conservative prior inference count | 412 |

The valid answers belong to three incomplete confirmation runs: `53fc4a21-c5c8-4126-af60-cd5fe8bdbcf2` (Astra, high: 72 answers), `f1d2d439-638b-481f-93d7-25b04cc07df1` (Astra, max: 48), and `93acf40f-8723-47e4-8714-2e38dbdcf26f` (Sol 6.1, high: 94). These are observed prefixes, not representative complete scores. They establish no mathematical counterexample and cannot support G-SIGNAL Go.

The final successful answer finished at 21:17:22.886 UTC. The first failed dispatched inference started at 21:17:19.175 UTC and returned a connection failure after approximately 70.6 seconds. Concurrent requests then failed at the metadata stage, initially through the 20-second deadline and later through short connection failures. Retained evidence contains no rate-limit, authentication, quota or HTTP service-error response. A shared connection failure is supported; its exact network, proxy or upstream cause is unresolved. On 2026-11-08, a fresh SDK metadata-only request returned HTTP 200 in approximately one second. That observation proves current metadata connectivity, not new inference permission or a completed evaluation.

## Execution repair

The run engine now stops dispatching after transport failures. The operator matrix stops globally on a network error or a metadata-stage timeout, including when the aggregate run error merely says `incomplete-evidence`. An inference-only timeout stops that individual run and preserves its incomplete population; it does not establish that every other model is offline. HTTP rate limiting is kept categorically distinct from a connection failure. No automatic retry was added.

Matrix exit status is unsuccessful if any eligible cell fails to complete. A settled ledger means scheduling settled, not that the evaluations succeeded. New output names receive separate capability bindings and private receipt/record/quality directories. Exclusive directory creation prevents a later run from overwriting an earlier run's access receipts.

## Explicit fresh replication

`apps/api/data/experiments/openai-matrix-v2.json` freezes a **fresh complete replication**, rather than resuming or replacing individual outcomes. It retains the original 421 cell identities and all task/prompt/settings hashes, including documentary cells for the 183 already-observed capability controls. Those controls schedule no additional calls. Every originally eligible mathematical cell is planned again; no choice depends on the observed correctness of a prefix or a prior score. Original partial answer exposure is disclosed in the manifest.

The replication allows at most 7,236 new mathematical requests. Together with 412 prior conservative sends, its cumulative ceiling is **7,648**, below the unchanged 8,192 ceiling. Both original and replication attempts remain separate evidence populations. Repeated runs must not be combined into a stronger score or selected by best result.

The replication manifest binds the original manifest, original ledger, saved reconciliation and exact retained controls by hash. A newly timestamped capability *binding* means those existing observations were attached to the new manifest at that time; it does not mean the controls were called again. The quality verifier still checks the controls' original start/finish times and permission evidence against the manifest chronology.

```sh
bun apps/api/src/experiments/reconcile.ts --output apps/api/data/experiments/openai-reconciliation-v1.json
bun apps/api/src/experiments/replicate.ts --output apps/api/data/experiments/openai-matrix-v2.json
bun --env-file=apps/api/.env apps/api/src/experiments/run.ts --manifest apps/api/data/experiments/openai-matrix-v2.json --output apps/api/data/experiments/openai-progress-v2.json --accept-charges --publish
```

The first two artifacts already exist and their commands intentionally reject overwriting them. The last command is a paid operator action and is listed for an intentional launch after source verification and API restart. It never supplies a development credential to visitor traffic. Private run access codes remain under ignored `apps/api/data/private/openai-progress-v2/`; they must not be printed or committed.

## Verification

The regression first reproduced the old policy's failure to stop a genuine SDK metadata transport failure while the aggregate record only reported incomplete evidence: two assertions failed under the previous policy. After the repair, the experiments suite passes **13 tests with 66 assertions**. Tests cover outage stopping, metadata versus inference timeout, categorical HTTP rate limiting without retries, exact offline identities/counts, duplicate/missing/tampered evidence rejection, cumulative replication budgeting, preserved cell objects, explicit consent/new paths, foreground stream order, receipt-persistence cancellation, malformed UTF-8 and credential-reflection rejection. API lint, type checking, build and `git diff --check` are required before launch; the root handoff records final integrated results.

No paid request was made during this diagnosis, repair, reconciliation or manifest creation. Actual replication outcomes, publication eligibility and G-SIGNAL remain unresolved until retained evidence exists.
