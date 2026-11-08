# Module 08: foreground execution and retained evidence

## Delivered behavior

The [plan](../plans/08-run-execution-and-results.md) is implemented for the local single-process API. Registered exact, smooth, challenge, screening, interior and fine-scale reserve suites are verified before launch; alternative answer profiles receive separately verified suite identities. Each case has three fresh logical trials, at most one inference attempt, explicit provider/model/route/profile, concurrency 1–12, and no automatic retry. Current-key model metadata is refreshed for each trial. Network, timeout, access and configuration failures stop new work; already-dispatched work and unknown charges remain represented. The ordinary inference deadline remains 180 seconds; the later operator-only diagnostic has a separate boundary below.

NDJSON launch/progress/terminal events keep work attached to its caller. Native HTTP tests establish that the start receipt arrives before inference finishes, explicit cancellation preserves the stream until settlement, and real TCP disconnect aborts upstream work. Progress is measured from retained evidence. Remaining includes active work; the interface separately identifies inactive remaining and never-started trials.

**D-09 is resolved:** SQLite records are private by default, expire after seven days, and use a separate random access code returned once. Only its hash is stored in the database. Private read/export/cancel/delete/publication require that code; provider credentials never enter retained records. Publication is explicit and reversible. Restart marks unfinished records interrupted. There is no automatic resumption or saved provider credential. Local operator experiment receipts are separately ignored private files, not public exports.

Reports use the shared scorer, with every planned trial retained. Returned invalid/refused/truncated answers remain model outcomes; infrastructure and absent work keep the report provisional or unavailable. Stored reports are recomputed against retained evidence using the same scoring implementation. Canonical prompts and result/model identities are checked at persistence. Scoring/final-save exceptions attempt to retain a terminal failed record rather than leave inactive work marked running; storage failures are explicit.

## Source and interfaces

`apps/api/src/runs/` owns request/workload policy, registry, initialization, executor, SQLite store, HTTP routes, public summaries and focused tests. `apps/api/src/http/boundary.ts` shares the established origin/TLS/body/cache safeguards with provider routes. `apps/api/src/runtime-paths.ts` preserves package-relative data/native-worker paths in source and built execution.

- Public reads: `GET /runs/policy`, `/runs/suites`, `/runs/published`, and `/runs/:id/public` for explicitly published records.
- Foreground launch: `POST /runs` with the visitor provider bearer and explicit charge consent.
- Separate private bearer: `GET /runs/:id`, `/runs/:id/export`, `DELETE /runs/:id`, `POST /runs/:id/cancel`, and `POST /runs/:id/publication`.

The browser is the ordinary launch interface. The specialized experiment CLI under `apps/api/src/experiments/` exercises the same HTTP boundary; a second general-purpose run CLI is not required for the implemented visitor journey. No operator command silently supplies the development key to visitors.

## Verification and repairs

The initial integrated API run passed **623 tests / 24,300 assertions across 51 files**. Subsequent targeted run/scoring verification passed **107 tests / 831 assertions** after report-integrity and finalization repairs. The later run/native-prompt/built-runtime checks passed **38 tests / 476 assertions across seven files**, including canonical prompt/model binding. API lint and type checking passed. Native Python tests passed **29 tests**, and Ruff passed. Final integration checks are recorded separately in module 12 as later work lands.

The initial four-suite built-runtime regression executes a freshly bundled API from an unrelated working directory, including native certification. It caught and repaired broken `import.meta.url` paths that source-only checks had missed. An empty database created by that faulty bundle path was confirmed empty and removed; original experiment records were preserved. The test counts above are historical checkpoints. The later [source-bound final QA](../research/final-product-verification-v2.md) independently passes all six current registrations, full software/native tests, lint/types/builds and local production-browser checks within its recorded gaps.

Independent AI-assisted source review identified terminal-state and report-integrity defects; both were repaired with regressions. The follow-up canonical prompt-binding finding was also repaired with substitution tests. This is AI-assisted review, not human approval. Live evidence remains separate from controlled SDK/HTTP fixtures.

## Experiment finding and remaining boundary

The first frozen matrix retained 212 failed/incomplete mathematical runs and 26 unverified setting cells. Forensic reconciliation found 7,236 planned mathematical trials, 225 dispatched mathematical inference requests, 214 valid correct answers and 11 dispatched requests with uncertain outcomes. Most other failures occurred during metadata access. No mathematical error was observed in the 214 returned answers; this incomplete prefix cannot establish a complete perfect score or a general capability claim. Original artifacts remain unchanged.

The independently audited later studies retain separate populations and original planned denominators:

| Study | Terminal evidence | Conservative cumulative requests |
| --- | --- | ---: |
| [Parent replication](../research/openai-replication-review-v2.md) | Interrupted: 171 complete publications, 35 failed, one interrupted, 26 capability-unverified and five unstarted cells; all 207 reports reconciled. | 7,090 |
| [P5 interior exploration](../research/interior-results-v1.md) | Two complete published/archived cells, 216 valid correct labels each. | 7,522 |
| [Fresh remaining-model screening](../research/remaining-models-results-v1.md) | Eight complete published/archived cells: 192 correct, one wrong valid, 11 invalid and 12 truncated outcomes. | 7,738 |
| [Standard reserve](../research/reserve-results-v1.md) | Two failed cells: eight sent operations with unknown remote outcomes, no model answers and 100 unattempted trials; empty public archive. | 7,746 |

Strict primary and per-attempt send proofs bind whole original private RunViews and actual result hashes. The standard reserve archive index binds its preserved pre-archive source snapshot, not the later final ledger; only their update timestamps differ. Unknown remote sends remain counted: 11 original, 101 replication and eight standard-reserve operations. These are conservative request counters, not provider bills. Across the preserved studies, 47 requested IDs have execution records and 45 have a completed published cell; aliases and snapshots are not independent architecture counts.

A separately frozen operator-only 600-second SDK diagnostic is now active, with at most 108 fresh requests and a conservative ceiling of 7,854 within 8,192. It is not a resumption or replacement of the failed standard reserve, and has no terminal result/audit at this checkpoint. Its longer deadline changes neither the ordinary 180-second platform/profile nor the original frozen study.

**G-SIGNAL remains No-go for a supported declared-frontier mathematical-failure finding.** The single o3/low screening error is independently checked but does not establish that stronger finding; timeouts, malformed replies and absent answers cannot substitute. Exploratory/screening populations remain unranked with no eligible confidence interval. OpenAI live execution is established; OpenRouter/Hugging Face live inference remains unresolved under the user's OpenAI-only development restriction. Deployment, submission preparation, reverse-proxy behavior and multi-process coordination remain outside this local handoff. Module 10 owns ranking eligibility. Final local QA has its own source-bound evidence; the active diagnostic still requires separate terminal reconciliation.
