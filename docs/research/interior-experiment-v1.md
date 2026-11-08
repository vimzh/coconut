# Interior exploration: two-cell execution plan

This is a separately frozen, adaptive exploratory follow-up to the earlier challenge experiment. The earlier frontier high/max results had been inspected before the new nonlinear families were constructed. Neither the original challenge membership nor its confirmation criteria changed. Difficulty remains empirical; a new function family does not guarantee a model error.

## Frozen population and identities

The population is the independently checked [interior curvature suite](interior-curvature-design-v1.md): 72 tasks, three nonlinear quintic families, eight shared source-polynomial groups and three labels. Nine related tasks belong to each source group. All tasks have raw operation depth 13. The separately documented eight rejected historical domains remain nonmembers.

`apps/api/data/experiments/interior-matrix-v1.json` was frozen at **2026-11-08 05:35:02.264 UTC**, before any model received this population. Its canonical SHA-256 is `a4f109d0ddd550442d10978bfd1854c07ba04bb4f6268dc7cdaead701106d536`.

| Binding | Identity |
| --- | --- |
| Suite key / population | `interior-v1` / `exploratory` |
| Seed | `coconut-interior-exploratory-v1` |
| Profile | `one-shot-json-v2-max` |
| Profile-bound suite | `suite-interior-v1-dace26d02ce0adf3589fae15f48582655761a55ac62920e44a0bfbde8c10ff72` |
| Suite canonical SHA-256 | `97e93566704ca279682115e004b31654bfa5a5f6d86ccf715e867510f193d3cb` |
| Canonical prompt-array SHA-256 | `ff9efe4158b56b9546ef03eb392ad997871321d63adcfb78d57e7809f85e086d` |
| Settings identity | `settings-v1-6785e4f1a5b910b91e34560f8d59b874fb696ea3f5657797cfd6db6a1304749f` |
| Criteria SHA-256 | `956573cb02d264d770219061ff805aa03f942a823138a87fa0266e5bf91d0f95` |

There are exactly two cells: **`gpt-6-astra` / max** and **`gpt-6.1-sol` / max**, both through direct OpenAI, plain JSON, 16,384 output tokens and four concurrent trials per run. These are the previously declared frontier identities at their highest accepted retained effort; no candidate model outcomes on the new population selected them. Each cell has 216 planned trials: three fresh requests for every one of the 72 tasks, with one attempt and no automatic retry. Two concurrent runs give at most eight active inference operations.

The manifest pins parent replication SHA-256 `62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e`, the original manifest/ledger/reconciliation lineage, and all 183 retained capability observations by hash. Those controls are reused without another provider request. A new binding timestamp records attachment of old observations; it does not claim that controls were rerun.

The embedded parent ledger exposure snapshot was updated at 05:34:55.598 UTC while that matrix was running. Its canonical hash is `fd8458d6f62414cb945cf895924aa4e1c9c4dc0c567a5247b44673da080c1603`. The source ledger is not overwritten. Its changing later state is checked again before launch; the frozen snapshot preserves exactly which prior scheduling evidence was available at freeze time.

## Budget and admission before launch

The parent replication reserves at most 7,648 cumulative requests, including the first attempt, unknown remote sends, old controls and earlier calibration allowance. This exploration adds at most 432 requests, giving **8,080 cumulative**, within the unchanged **8,192** ceiling. Unused parent budget is not converted into unrecorded extra cells or retries.

The runner refuses execution while the parent ledger is running or contains active cells. It also requires the live API to advertise the fifth suite with its exact base identity and 72 cases, together with the existing three-trial, one-attempt, no-retry and deadline policy. The coordinator must wait for the parent to settle and restart the updated API before launching; the runner does not restart or interrupt either process. Before any keyed launch, it reproduces the full suite/prompt/settings bindings, parent hash, retained controls and fixed budget.

```sh
bun apps/api/src/experiments/interior-experiment.ts freeze --output apps/api/data/experiments/interior-matrix-v1.json
bun --env-file=apps/api/.env apps/api/src/experiments/interior-experiment.ts run --manifest apps/api/data/experiments/interior-matrix-v1.json --output apps/api/data/experiments/interior-progress-v1.json --accept-charges --publish
```

The manifest already exists; freezing rejects overwriting it. The run command requires a new ledger name and explicit charge consent. Publication is separately requested with `--publish`. No paid request was made during this implementation, fixture verification or manifest freeze.

## Retention, failure and publication

Execution uses the same foreground HTTP stream and private access boundary as visitor runs. Each once-only private receipt is synchronously and atomically saved with mode 0600 as soon as its start event is consumed. Private access codes live only under ignored `apps/api/data/private/interior-progress-v1/access.json`; full private records are retained in the sibling `records/` directory. The public progress ledger contains run IDs and measured counts, never access codes or provider credentials. New run names use exclusive private directories and output files.

Connection failures stop the shared exploration using the existing matrix policy. Each run remains a one-attempt foreground operation, and incomplete/uncertain work retains its original planned denominator. A failed stream may be inspected through its original private receipt; it never triggers replacement inference. An incomplete cell, checkpoint failure, or requested publication/archive failure produces an unsuccessful process exit.

Only a completed run with an explicitly established public publication is archived. The runner retrieves that evidence anonymously from its fixed public API destination, verifies the exact run/model/suite/prompts/settings and freeze chronology, and independently reconciles report arithmetic before writing it. Completed public views and their manifest-bound index appear under `apps/api/data/experiments/interior-progress-v1-published/`. Private, interrupted, unpublished or identity-mismatched evidence cannot enter that archive. Archive records contain neither provider credentials nor private access codes.

## Allowed interpretation and verification

This population remains **exploratory and unranked**, with **no eligible confidence interval**. Three families do not meet the unchanged six-family confirmation condition; eight shared source clusters do not meet the unchanged 20-cluster interval condition. Descriptive counts, individual transcript review and independently checked observed point failures are permitted. This experiment cannot produce the stronger G-SIGNAL claim by relabeling itself as confirmation, pooling repeated tasks as independent, or weakening the existing thresholds.

The focused fixtures pass **six tests with 50 assertions**. They verify exact frontier membership, task/prompt/control/source hashes, source immutability, cumulative budget, running-parent and stale-API refusal, altered or incomplete policy rejection, explicit consent, unsuccessful incomplete scheduling, and publication/archive rejection for changed identities, private extra fields, missing publication, failed execution or forged report arithmetic. The archive fixture uses 216 fully controlled SDK responses, not live model observations. API lint, type checking and build are also run before handoff; final integrated outcomes belong in the coordinator's product verification record.

Actual model outcomes and the final archive do not exist at this implementation checkpoint. Any later result must retain the adaptive exposure history and these scope limits.
