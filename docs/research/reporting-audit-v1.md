# Independent reporting audit, version 1

This is an **AI-assisted independent arithmetic audit** of the original frozen experiment, performed on 2026-11-08. It supplies no human expert approval and makes no provider calls. It does not replace the shared scorer, reinterpret answers, change references, or promote incomplete runs to completed results.

The audited object is the retained scalar-curvature classification evidence under `pooled-macro-f1-v1`, protocol 1, three fresh trials, the profile-bound challenge/screening suites, and the original `openai-matrix-v1.json` manifest. The [frozen quality criteria](quality-criteria-v1.md) and [independent mathematical review](independent-challenge-review-v1.md) remain the scientific boundaries. [Experiment reconciliation](experiment-reconciliation-v1.md) owns the transport diagnosis and any subsequent experiment amendment.

## Scope and arithmetic

`apps/api/src/quality/reporting-audit.ts` independently constructs confusion counts from each final retained outcome and the case's reference label. It then checks precision, recall, F1, fixed-three-label macro-F1, accuracy, absent-class handling, unusable predictions, directional errors, every mutually exclusive outcome denominator, trial-index eligibility/spread, pairwise agreement, and each planned depth and baseline difference.

The audit separately recomputes attempt/logical token groups from reported semantic identifiers, missing coverage, latency populations and nearest-rank quantiles, observed-cost coverage, raw expression/node/prompt lengths and tokenizer identity/coverage groups. It checks report/evidence identity hashes. The existing strict evidence parser supplies canonical serialization and validates the planned trial population; the independent arithmetic does not call the shared scoring, classification, diagnostics, usage, or cost calculation functions. Thus input-contract validation is shared, while the checked arithmetic is separately written.

Reported prices/bills are absent from every original OpenAI attempt. Their cost totals must remain null; the audit does not invent prices or equate unknown cost with zero. Exact billed/estimated decimal arithmetic retains its separate existing module 04 fixtures. Local expression-token measurements are likewise absent; raw expression/node/prompt character measurements are available, but no tokenizer count or hidden reasoning text is inferred. Intermediate-step and decomposition diagnostics are not applicable to these one-shot profiles.

The hand-calculated mixed scoring fixture supplies a nontrivial arithmetic control: F1 `76/105`, accuracy `2/3`, one empty reply, ten retained attempts for nine logical trials, and sample trial-F1 standard deviation `sqrt(57)/18`. Further regressions alter class recall, confusion, trial spread, directional counts, token coverage, latency and depth differences, then refresh the report content hash. The independent audit still rejects these altered reports. Partial and all-unattempted fixtures retain provisional and unavailable status.

## Retained experiment findings

All **212** original RunView exports passed the independent arithmetic assertions. They contain **7,236 planned trials**, **214 included model answers**, **7,022 provider errors**, and **225 recorded inference sends**. All included answers match their certified labels. No invalid, empty, conflicting, refusal, truncation, interrupted, cancelled, or unattempted final category occurs in these original records. Many provider errors occurred before inference, so attempted metadata work and paid inference sends must not be conflated.

| Original run | Planned | Included / correct | Score population |
| --- | ---: | ---: | --- |
| `53fc4a21-c5c8-4126-af60-cd5fe8bdbcf2` | 216 | 72 / 72 | Provisional |
| `93acf40f-8723-47e4-8714-2e38dbdcf26f` | 216 | 94 / 94 | Provisional |
| `f1d2d439-638b-481f-93d7-25b04cc07df1` | 216 | 48 / 48 | Provisional |
| Remaining 209 runs | 6,588 | 0 / 0 | Unavailable |

The three observed prefixes have macro-F1 1 on their included populations. These are incomplete convenience prefixes, not complete-suite scores or unbiased estimates of the missing responses. No complete score, ranking, superiority conclusion, point counterexample, or reproducible mathematical limitation follows. The safe aggregate combines **execution counts only**, not scores from incompatible settings cells.

The tracked aggregate [reporting-audit-v1.json](../../apps/api/data/quality/reporting-audit-v1.json) pins the source manifest/ledger file hashes and every audited RunRecord hash. It contains identifiers and aggregate counts, with no access codes, credentials or raw provider replies. Its size is **163,563 bytes**, SHA-256 `8081118a768dbf1aa1514e69f908e36c68f7f0f77f44ff79696355392bc66ba8`. Original full exports remain under ignored private retention; this aggregate is not a substitute for those transcripts.

The original 212 retained quality reports all give **No-go**, with `complete-trials` and `outcome-inspection` blockers. Their uncertainty intervals are unavailable because planned work is incomplete. The separately replayed [challenge suite quality report](../../apps/api/data/quality/challenge-v1.quality.json) gives **Go within its declared mathematical/coverage scope**; its report ID is `suite-quality-v1-f04419d8383c4f4f3a6706414e71b96f74ab676bd163d6dd6f6d68cbd384fa66`. Suite-level Go does not satisfy the run-level or model-failure gates.

The **actual frontend** `adaptRunView` and `buildReportExport` functions also accepted all 212 original exports. The audit checked every overall metric and **652 depth slices** against retained class/outcome/usage/latency/cost coverage, plus **1,956 filtered exports** spanning each depth and all three token fields. Filtered case/trial membership and usage-view selection remained exact; full exports matched the projected run. The [safe projection audit](../../apps/api/data/quality/browser-projection-audit-v1.json) pins source/report identities and has SHA-256 `69e8407e89b3851fa4a10dbfcafc53514700b62eab4148efb3d609c9f492c64c`. This is an offline execution of the production projection code, not a browser screenshot or claim of completed visual verification.

## Offline commands and verification

The new command reads regular UTF-8 JSON files with both pre-read and streaming limits of 128 MiB. `run` accepts a RunRecord or a RunView export; `suite` accepts a retained suite. Output is created exclusively with mode 0600. Existing files, invalid arguments, non-files, malformed UTF-8/JSON, exceeded bounds, incompatible evidence and replay failures produce explicit failure without input contents in errors. A successfully produced No-go report is a completed audit command, not a command failure.

```sh
bun apps/api/src/quality/audit-cli.ts suite --input apps/api/data/suites/challenge-v1.json --output /tmp/coconut-suite-quality-new.json
bun apps/api/src/quality/audit-cli.ts run --input apps/api/data/private/experiment-records-v1/53fc4a21-c5c8-4126-af60-cd5fe8bdbcf2.json --output /tmp/coconut-run-quality-new.json
bun test apps/api/src/quality
bun run --filter @coconut/api lint
bun run --filter @coconut/api typecheck
bun run --filter @coconut/api build
```

Reproduce the original arithmetic checks without credentials, while the original private exports are retained:

```sh
bun - <<'TS'
import { readdir, readFile } from 'node:fs/promises';
import { auditRetainedMetrics } from './apps/api/src/quality/reporting-audit';
const directory = 'apps/api/data/private/experiment-records-v1';
const names = (await readdir(directory)).filter(name => /^[A-Za-z0-9_-]+\.json$/.test(name)).sort();
for (const name of names) {
  const view = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
  auditRetainedMetrics(view.record);
}
console.log(`${names.length} retained reports passed independent arithmetic assertions.`);
TS
```

Actual checks: **29 quality tests / 139 assertions passed** across seven files; the two newly authored test files contribute eight tests / 59 assertions. API lint, type checking, production bundle and `git diff --check` passed. Both documented audit commands completed and produced the stated Go/No-go reports. No browser interaction, live service, credential read, provider request, publication, commit, deployment or submission occurred in this audit workstream.

## Defect returned to owner and remaining limits

Inspection found that the browser adapter accepted raw replies only through 65,536 UTF-16 code units, while the inference/scoring retention boundary permits 131,072 and grades oversized returned replies invalid. A legitimate retained invalid outcome could therefore prevent the entire report from rendering. This was returned to the integration owner; the adapter now uses 131,072 and its focused regression was reported passing. Final browser evidence belongs to module 12, not this offline audit.

This checkpoint does not establish final product readiness. Module 12's final browser/launch evidence, module 10's final eligible-comparison behavior, and any later replication must be audited against their own retained artifacts. OpenRouter/Hugging Face live execution remains unverified under the OpenAI-only development restriction. No expert practical-relevance review or broad mathematical-ability claim is supplied. Do not replace the original incomplete experiment with a later successful repetition or silently reuse this original-only audit for new records.
