# Remaining model screening supplement: draft execution plan

This document describes an implemented operator workflow. **No supplement manifest has been frozen and no supplement model request has been made.** Freezing must wait until the two-cell interior exploration, and any activated conditional reserve, have terminal reconciled evidence. The existing experiments and their unsuccessful prefixes remain separate and unchanged.

## Population and selection

The parent replication manifest has canonical SHA-256 `62ae737f9ab8afad8edee917541d40fa46f16fdcce9216ea23189b375bb5029e`. Its interrupted terminal scheduling ledger, updated at 2026-11-08 07:59:46.559 UTC, has canonical SHA-256 `965ec97993701ad8712df8155e09b6f992a0e7a531e82848f0d42e08dd9c9787`. These are canonical JSON hashes, not raw file-byte hashes.

Selection uses unfinished scheduling only: find the model IDs whose original screening cells have `pending` or `interrupted` status in that pinned ledger. Those IDs are exactly **`o3` and `o3-2025-04-16`**. For each ID, the supplement requests **all four original screening profiles afresh**: provider default, low, medium, and high. It retains the exact eight original cell objects, including provider, serving route, suite, prompts, effort, output cap, concurrency and settings identity. A membership change or regenerated prompt/settings mismatch refuses admission.

Each cell has nine original screening cases, with three fresh requests per case and one attempt per trial: **27 planned trials per cell, 216 maximum new inference requests**. Failed prefixes are not resumed. In particular, the parent `o3` default run returned a seven-answer prefix before failing; that inspected exposure remains disclosed. Grades, prefix correctness and final scores do not select supplement membership. The alias and dated snapshot remain distinct identities, without assuming they are independent model families.

## Terminal accounting required before freeze

The supplement uses the shared ceiling of **8,192** inference requests. Admission requires a separately retained coordinator accounting artifact with kind `reconciled-inference-accounting`, canonical hashes, and these fields:

- The 183 retained capability inference requests, counted once. `controls.path` names `capabilities-v1.json`; `controls.sha256` is the canonical hash of that artifact's `probes` array, matching the parent's retained-controls binding.
- The earlier calibration allowance of four requests, counted once.
- Exactly one entry each for the original attempt, parent replication and interior exploration, with manifest, terminal ledger, primary reconciliation and per-attempt send-evidence paths/hashes. Each entry requires `sendEvidencePath` and `sendEvidenceSha256`.
- One conditional-reserve entry if and only if `apps/api/data/experiments/conditional-reserve-progress-v1.json` exists. An activated reserve must also be terminal and reconciled. Absence of this file makes no claim that a future reserve cannot activate.
- Each study's actual mathematical inference sends and unknown remote sends. Unknown remote sends are included within actual sends; they are never added twice or treated as unused budget.
- `totalPriorInferenceRequests = 183 + 4 + sum(study.inferenceRequests)` and `totalPriorInferenceRequests + 216 <= 8192`.

The loader reads only named experiment JSON artifacts. It verifies canonical source hashes, terminal scheduling with no active cells, and primary reconciliation version, kind, chronology, full records and source bindings. Aggregate-only objects are insufficient. Supported primary kinds are `offline-experiment-reconciliation` and `offline-study-reconciliation`. The existing original reconciliation remains unchanged and bound by its known full canonical hash.

`controls.sha256` hashes the named calibration artifact's retained `probes` array, matching the parent manifest's control binding. Each study manifest, ledger, primary reconciliation and send-evidence hash covers its whole source object. The control wrapper is not represented as a whole-file hash by that field.

Each separate `study-send-reconciliation` artifact contains only hashed private-view/result identities and a strict attempt projection. Its records must cover all and only the unique started ledger run/cell pairs, match the primary reconciliation's whole-view hashes, declare terminal states and zero active trials, and retain the original planned denominators. Each `(caseId, trialIndex)` is unique, with trial indices 0–2, zero or one inference send, an observed HTTP-attempt count, and a nullable failure code/remote-outcome projection. Finished counts must equal attempt-array lengths, primary retained counts and terminal-ledger finished counts. The loader derives actual sends from the attempt arrays and derives unknown remote sends only from sent inference attempts whose failure says `unknown`; these independently derived totals must agree with the per-run counts, ledger, primary reconciliation, send-evidence totals and accounting entries. Changed aggregate fields cannot substitute for this derivation. The send projection contains no transcript, credential or private access-code fields, and unexpected fields are rejected.

Primary reconciliation chronology must follow terminal ledger chronology; send evidence must follow the primary reconciliation; accounting must follow send evidence. The original attempt and replication must match their immutable lineage; the interior manifest must match its previously frozen hash. The full accounting artifact and its hash are embedded in the new manifest. Every input is checked again before launch, including whether a reserve became active since freeze. Unused reservations are not silently converted to free requests, and missing accounting or send evidence refuses freeze. The coordinator creates send evidence from actual retained private views; offline fixtures do not supply live provenance.

The accounting artifact must be produced after actual interior/reserve settlement; the earlier interior reservation of 8,080 is not substituted for actual lineage accounting. The supplement creates no new controls or calibration requests.

## Commands and execution boundary

After the coordinator has retained the final accounting artifact, the intended commands are:

```sh
bun apps/api/src/experiments/remaining-models.ts freeze --prior-accounting apps/api/data/experiments/remaining-models-prior-accounting-v1.json --output apps/api/data/experiments/remaining-models-matrix-v1.json
bun --env-file=apps/api/.env apps/api/src/experiments/remaining-models.ts run --manifest apps/api/data/experiments/remaining-models-matrix-v1.json --output apps/api/data/experiments/remaining-models-progress-v1.json --accept-charges --publish
```

These are future operator actions. The accounting filename is the intended new artifact name, not a claim that it already exists. Freeze and run refuse existing output identities. Charge consent and publication are explicit, separate flags. The runner never restarts an API, interrupts an earlier process, or launches a replacement for a failed operation.

At most three foreground runs execute simultaneously, each with four active trials: **12 maximum concurrent inference operations**. There are no SDK retries, scheduler retries or replacement trials. Before launch the API must advertise the exact original nine-case screening suite and the existing three-trial, one-attempt, zero-retry execution policy, with 20-second metadata and 180-second inference deadlines.

## Retention and publication

Each start receipt is atomically and synchronously retained with mode 0600 before another stream event is consumed. A duplicate cell receipt or reused run identity is rejected. Private access codes stay under ignored `apps/api/data/private/<new-ledger-name>/access.json`; they never enter the progress ledger or public archive. Provider credentials are checked against retained JSON and never printed. The new ledger name owns exclusive private, record, capability-binding and publication paths.

After every attempted foreground operation with a retained receipt, the runner uses a separate bounded read-only settlement deadline. It exports the final private view, including failed, cancelled, timed-out and interrupted outcomes. Reading a failed record never sends replacement inference. If settlement cannot be established, the original receipt remains for inspection and execution exits unsuccessfully. Stream, checkpoint, identity or shared connection failures stop further scheduling. All pending work and each original 27-trial denominator remain visible in the ledger.

Only completed runs may receive explicit publication requests. The runner retrieves the resulting view anonymously from the fixed public API endpoint, verifies the exact original cell and post-freeze chronology, checks unique case/trial attempts and independently reconciles report arithmetic. Only then may the public view enter the separate published archive. The archive index lists omitted cells. Failed publication or archive retention, any incomplete cell, or unresolved scheduling produces an unsuccessful process exit. Earlier experiment files remain untouched.

## Interpretation and offline verification

The supplement remains **unranked screening/descriptive evidence**, with **no eligible confidence interval and no stronger signal claim**. A fresh complete result does not repair or erase its earlier failed population. Repeated prefixes and new outcomes must not be pooled into a stronger score or selected by best result. Report outcomes with explicit populations and denominators, while retaining inspected exposure and infrastructure failures.

The focused offline fixtures currently pass nine tests with 76 assertions. They cover unchanged eight-cell membership, source immutability, terminal parent/interior refusal, activated-reserve admission, full reconciliation and per-attempt count binding, one-time unknown/control/calibration accounting, overflow refusal, changed prompts/settings/API policy, intentional charge consent, incomplete/publication/archive failure status, exclusive manifests, atomic private receipts, secret reflection rejection, and complete-publication arithmetic checks. They reject aggregate-only or unsupported primary reconciliations, missing/duplicate records, stale chronology, altered attempt counts, forged unknown-outcome projections and private extra fields even after changed artifact hashes are rebound. Their controlled 27-response SDK fixture and synthetic historical attempt projections are not live inference evidence. API lint, type checking and build must also pass before coordinator handoff; final integrated results belong in that handoff.

The concrete frozen hash, final actual-send total, execution outcomes and archive do not exist at this checkpoint. No numerical result for the future supplement is asserted here.
