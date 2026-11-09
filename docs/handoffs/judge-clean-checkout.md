# Judge clean-checkout verification

Date: 9 November 2026. The bundled evaluation is runnable from a fresh checkout with no developer credentials, private task files or external generator. This is a software/reproduction check, not a new model experiment or an assertion that every submission checklist item is complete.

## Isolated source and environment

Verification used a fresh `git clone --no-hardlinks` of source revision `336e0821b88064162c6e7b515625b47886a6caff` into `/tmp/coconut-judge-check-LSDS/repo`, with a separate empty HOME and sanitized environment. Dependencies and the native Python environment were installed there; none were linked from the development checkout. The local root `AGENTS.md`, `.env` credentials and `apps/api/data/private` were absent. Generator-location environment variables were not required.

The toolchain was Bun **1.4.4**, Node.js **24.22.1** and uv **0.13.1**. Fresh numerical setup selected CPython **3.13.16**, python-flint **0.9.0** and Ruff **0.15.6** under the committed native lock. This is separate from the optional external generator's exact Python 3.13.17 requirement. The only later source overlay was the test deadline repair described below. README/terminal-guide changes do not change runtime code, dependencies, mathematical policies, prompts, scores or certificates.

## Completed checks

| Command or check | Observed result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed in the fresh clone, retaining the SDK patch and lock. |
| `bun run numerics:setup` | Passed with a fresh native environment. |
| Final literal `bun run test` wrapper | **919 passed, 0 failed**, about 134 seconds, in the original parallel-workspace execution context. |
| API tests in that final wrapper | **807 passed, 0 failed**, 34,266 assertions, 125.34 seconds. |
| Web library tests in that final wrapper | **80 passed, 0 failed**. |
| CLI tests in that final wrapper | **32 passed, 0 failed**, 1,157 assertions, 7.93 seconds. |
| Root lint and type checking | Passed, including the CLI. |
| Native tests and Ruff | **40 native tests passed**; Ruff passed. These ran before the test-only deadline overlay, with identical numerical source/dependencies. |
| Root production build | API and Next.js builds passed. |
| Bundled composition generation and verification | Reproduced and replayed the 27-task suite without a key or external checkout. |
| Frozen challenge verification | Replayed the bundled 72-task challenge. |
| Offline scoring example | Produced a report from the tracked synthetic-reply fixture; not model-performance evidence. |
| Built API from outside the checkout's working directory | Loaded the native worker and all seven actual suite assets: 27/75/27/72/9/72/18 tasks, **300 total**. |
| Isolated production HTTP checks | API health and suite catalog returned 200 on port 3216; the built homepage returned 200 on port 3215. Both isolated ports were subsequently confirmed closed. Development ports 3200/3201 and the developer database were not used. |

Separate API and CLI checks used `bun run --filter @coconut/api test` and `bun run test:cli`; the final literal `bun run test` then verified all three suites together. Its receipt is `final-root-test-wrapper.log`. Logs are retained locally under `/tmp/coconut-judge-check-LSDS/`; they are not model transcripts or private research data and are not required for normal operation.

## Observed timeout and bounded repair

The initial full cold run returned 806 API passes and one timeout in `runtime-paths.test.ts`, at 30,005.02 ms, while other CPU-heavy verification was active. Its first-failure log is preserved as `test.log`. The same actual bundled-API/native test passed alone in 5.73 seconds. A full API rerun with the other workers stopped passed all 807 tests in 125.69 seconds, with that smoke test taking 5.646 seconds.

The integration test checks correct asset resolution, not a startup-latency service level. Its outer deadline is now **120 seconds** to allow cold certification under load. All assertions, actual suite/reference work and production/native/provider deadlines are unchanged. The patched test was then overlaid into the isolated clone and the **entire API suite** passed again, followed by CLI tests, lint/types/build and HTTP checks. Finally, the exact root test wrapper passed, with this smoke test taking 5.576 seconds under parallel-workspace load. An isolated retry was not used as a substitute for a full passing run. No fallback or skipped assertion was introduced.

## Cleanup and judge instructions

The earlier [cleanup checkpoint](pre-submission-cleanup.md) removed 19 obsolete files and 22 retired test cases. The current bounded entrypoint review found no additional dead root CLI aliases to delete. Historical, hash-bound research operators and current mathematical/credential/scoring coverage remain intact.

The README now starts with explicit checkout/install instructions and a linked [no-key judge smoke test](../../README.md#judge-smoke-test-no-api-key-or-external-generator). It uses a fresh temporary output directory, bundled reference tasks and a clearly identified synthetic scoring fixture. A separate optional command explains the paid 27-task evaluation and its 81-request maximum. The [terminal guide](../terminal.md) now supplies acquisition and exact revision checks for the separately obtained external generator.

## Limits

The repository is private: judges need authorized read access to clone it, or can extract the source ZIP and use the same root commands. A separate noninteractive HTTPS remote-clone probe timed out after 60 seconds; anonymous remote cloning is not claimed. The successful isolated local clone, matching committed source, establishes checkout independence rather than public repository accessibility.

No live model requests were made. A judge's provider key/model permissions still determine whether a paid evaluation can run. Exact reproduction of the 620/800 imported research populations remains subject to the excluded private data and unresolved redistribution boundary; bundled 27/72-task verification does not reproduce those headline experiments. The [submission checklist](../submission/readiness.md) preserves these and the remaining video, transcript and personal-review requirements.
