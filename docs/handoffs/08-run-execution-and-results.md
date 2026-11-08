# Module 08: foreground execution and retained evidence

## Delivered behavior

The [plan](../plans/08-run-execution-and-results.md) is implemented for the local single-process API. Registered exact, smooth, challenge and exploratory screening suites are verified before launch; alternative answer profiles receive separately verified suite identities. Each case has three fresh logical trials, at most one inference attempt, explicit provider/model/route/profile, concurrency 1–12, and no automatic retry. Current-key model metadata is refreshed for each trial. Network, timeout, access and configuration failures stop new work; already-dispatched work and unknown charges remain represented.

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

The built-runtime regression executes a freshly bundled API from an unrelated working directory and verifies all four actual suite populations, including native certification. It caught and repaired broken `import.meta.url` paths that source-only checks had missed. An empty database created by that faulty bundle path was confirmed empty and removed; original experiment records were preserved.

Independent AI-assisted source review identified terminal-state and report-integrity defects; both were repaired with regressions. The follow-up canonical prompt-binding finding was also repaired with substitution tests. This is AI-assisted review, not human approval. Live evidence remains separate from controlled SDK/HTTP fixtures.

## Experiment finding and remaining boundary

The first frozen matrix retained 212 failed/incomplete mathematical runs and 26 unverified setting cells. Forensic reconciliation found 7,236 planned mathematical trials, 225 dispatched mathematical inference requests, 214 valid correct answers and 11 dispatched requests with uncertain outcomes. Most other failures occurred during metadata access. No mathematical error was observed in the 214 returned answers; this incomplete prefix cannot establish a complete perfect score or a general capability claim. Original artifacts remain unchanged. The reconciliation record and any separately frozen replication are authoritative for subsequent counts.

**G-SIGNAL: No-go on the first matrix.** Missing complete populations and observed mathematical errors cannot be replaced by fixtures, malformed answers or network failures. OpenAI live execution is established; OpenRouter/Hugging Face live inference remains unresolved under the user's OpenAI-only development restriction. Deployment, reverse-proxy behavior and multi-process coordination are outside this local integration boundary. Module 10 separately owns ranking eligibility; full product readiness remains conditional on integration and recorded evidence.
