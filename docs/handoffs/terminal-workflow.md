# Terminal workflow handoff

## Delivered

The user requested generation/testing terminal commands and landing-page examples. Two thin commands now complete the ordinary local workflow:

- `composition:generate` and `composition:verify` reproduce/replay the existing certified 27-task suite. Strict inputs, bounded file reads and exclusive output preserve existing artifacts.
- `eval:run` uses the existing run service, SQLite store, official SDK adapter and scorer. It supports OpenAI `composition-v1`, an explicit credential environment variable, selected model/profile, concurrency 1–12 and required charge consent. It retains three trials per task, at most 81 inference requests, no retry, no resume and no publication.
- Private output contains the start receipt/access code, SQLite evidence, final RunView and canonical scoring report. The receipt file, output directory and parent directory are synced before dispatch. Storage/receipt failures stop provider access; normal cancellation retains partial evidence and incomplete execution exits nonzero.
- The landing page links to a terminal quickstart, with an expandable ordinary command catalog. Existing results, public aggregates, historical JSON and provider filters remain unchanged. The separate imported research population is explicitly distinguished from the visitor suite.
- [The full guide](../terminal.md) documents every root package script, optional charged probes, fixed-suite reproduction, private artifacts and manual cleanup. README and development guidance link it; the stale challenge recommendation now matches the composition default.

Root test/lint/typecheck commands now include the four terminal source/test files through maintained `*:cli` checks. No dependency, lockfile, API source/package or numerical-source change was required. Concurrent cheap-depth research files were preserved.

## Verification

| Check | Actual result |
| --- | --- |
| `bun run test:cli` | 15 passed, 778 assertions. Real engine/SQLite with injected SDK transport, including all 81 planned trials with wrong/invalid replies, bounded concurrency, cancellation, infrastructure/final-persistence failure, strict consent/credentials, non-overwrite and both directory-sync failures before provider access. |
| `bun run lint:cli` | Passed. |
| `bun run typecheck:cli` | Passed. |
| `bun test apps/api/src/runs/engine.test.ts` | 11 passed, 125 assertions. |
| `bun run --filter @coconut/web test` | 86 passed. |
| `bun run --filter @coconut/web lint` | Passed. |
| `bun run --filter @coconut/web typecheck` | Passed. |
| `bun run --filter @coconut/web build` | Production build passed. |
| Actual offline composition generation and verification | Passed in a fresh temporary directory; 27 tasks and generated suite ID match the registered artifact. Frozen artifact verification also passed. |
| CLI help, offline fixture scoring, missing-credential preflight | Both help entry points and scoring command passed. Missing credential exited 1 without creating the run directory. |
| Documentation/script/link checks | Every root package alias documented; 17 local links valid; new source wording and diff checks passed. |
| Independent bounded code review | Initial directory durability and retention disclosure findings repaired; re-review found no blocking findings. |
| Production browser | Actual landing at widths 1440, 390 and 320. Terminal anchor, expandable catalog, consent/count wording, focusable scrolling code blocks and separate current result table verified. Page width stayed within viewport, including expanded catalog. Mobile screenshot inspected; browser console had no messages. |

The web server was refreshed on port 3200 from the verified production build. The API was not built or restarted during the concurrent frozen study; no API source changed. No live provider operations or paid calls were made by this task. Existing generator commands were documented from their implementations; the new primary generation/verification workflow was exercised directly. A fresh dependency install and hosted deployment were not repeated.

## Operational limits

This is a checkout workflow, not a published installable package. The evaluation CLI currently accepts only OpenAI `composition-v1`; other registered visitor suites remain available in the web workbench. Generation reproduces fixed registered tasks rather than claiming fresh random sampling or reproducing the larger imported research cohort.

The output directory must be new and its parent must exist. The receipt includes a private access code; do not share it. Raw explanations remain in private run artifacts, never terminal progress. Normal SIGINT/SIGTERM saves partial execution; forced termination can prevent final JSON export while leaving the receipt/SQLite evidence. Preserve evidence before starting any new paid run.

Seven-day expiry is enforced when the store is accessed, with lazy database purging; a finished standalone CLI has no background cleanup. Both SQLite and JSON files remain until manually deleted. Inference availability depends on the caller's account. Fixtures and metadata access are not live inference verification, and request/token ceilings do not impose a currency budget.
