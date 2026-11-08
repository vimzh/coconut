# Clean local product QA — archived `e7ff1ef`

## Scope and environment

Verified an isolated `git archive` snapshot of `e7ff1efbe71112c4fdab788525f431b7efbc6ce4` at `/tmp/coconut-clean-product-qa.r1GN37`. The archive intentionally excludes all current root-worktree edits, untracked experiment progress, local `AGENTS.md`, `.env` files, and private API data. It is not a verification of the current root `HEAD` or concurrent pitch/experiment work.

Runtime: macOS arm64; Bun 1.4.4 (`38afee6c8`), Node 24.22.1, uv 0.13.1, and fresh native CPython 3.13.16 environment. Commands had no provider credentials, and no external inference or paid request was made.

The fresh archive began without `node_modules` or `services/numerics/.venv`. A first bundled setup command outlived tool output collection and is not evidence. Its archive-local dependency directory remained; the captured frozen install then completed with 473 installs across 576 packages and no changes. Native setup created the new `.venv`, downloaded CPython 3.13.16, and installed pinned `python-flint` 0.9.0 and `ruff` 0.15.6. Bun-cache reuse is not asserted.

## Behavior coverage map

| Behavior | Evidence | Status / gap |
| --- | --- | --- |
| Frozen dependency and native numerical reproduction | Captured frozen Bun install; fresh uv sync | Verified automatically |
| Native numerical checks | `numerics:test`: 29 tests; `numerics:lint`: Ruff clean | Verified automatically |
| Product test coverage | Captured `bun run test`: API 669 tests / 29,090 assertions / 62 files and web 58 tests / 5 files; exit 0 | Verified automatically |
| Lint and types | Root lint; API typecheck; web Next type generation plus TypeScript | Verified automatically |
| Sequential production builds | API build then web build, with API destination set before web build | Verified automatically |
| Built API startup / health | Isolated wrapper imported built config and bound 3215; `GET /health` returned 200 `{"status":"ok"}` | Verified manually by HTTP |
| Fixed five-suite registry | `GET /runs/suites` returned reference 75, smooth 27, challenge 72, screening 9, interior 72 | Verified manually by HTTP |
| Native worker available to built API | Passed built-API runtime-path test loaded suite artifacts and native worker; native suite executed under clean environment | Verified automatically |
| Empty public data / anonymous absence | Web `/api/leaderboard` returned `{"version":"1","runs":[]}`; API unknown public run returned 404 `not-found` | Verified manually by HTTP |
| Visitor journey pages at production | `/`, `/evaluate`, `/methodology`, `/leaderboard` each returned 200 HTML | Partially verified: HTTP only; no browser rendering/interactions |

## Executed checks

| Command | Outcome | Timing |
| --- | --- | --- |
| `bun install --frozen-lockfile` | passed; 473 installs, no changes | 2026-11-08T07:11:42Z; tool-reported 12ms |
| `bun run numerics:setup` | passed; pinned Python/native packages installed | 25 s |
| `bun run numerics:test` | passed; 29 tests | 15 wall s |
| `bun run numerics:lint` | passed | <1 s |
| `bun run test` | passed; API 669/29,090; web 58; zero failures | 59.61 s |
| `bun run lint` | passed | 2 s |
| `bun run --filter @coconut/api typecheck` | passed | 2 s |
| `bun run --filter @coconut/web typecheck` | passed; route types generated | 3 s |
| `bun run --filter @coconut/api build` | passed; 325 modules | <1 s |
| `NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:3215 bun run --filter @coconut/web build` | passed; seven static pages | 5 s |

The complete retained test output is `/tmp/coconut-clean-root-test.log`; its durable exit/timing record is `/tmp/coconut-clean-root-test.result`.

## Runtime evidence

The built API default configuration was imported into `/tmp/coconut-clean-product-qa.r1GN37/qa-api-wrapper.ts` and served only through an isolated `Bun.serve` wrapper at `127.0.0.1:3215`. The normal API entrypoint and port 3201 were not started. `COCONUT_RUN_DB` pointed only to `/tmp/coconut-clean-private-db.qpzMac/runs.sqlite` (created restrictive `0700` directory and `0600` file). Health returned 200. The suite registry returned all five expected keys/counts, including `interior-v1:72`.

The Next production server used the previously built public API origin and bound only `127.0.0.1:3216`. HTTP observations: `/`, `/evaluate`, `/methodology`, `/leaderboard` each returned 200 HTML. `/api/leaderboard` returned 200 JSON with an empty run list. `/results/nonexistent` returned a 200 client application shell, so it is not evidence of rendered absence; the actual anonymous API check `GET /runs/nonexistent/public` returned 404 with `not-found`.

## Failures, gaps, and residual risk

No executed check failed. Next warned about absent build caching and standard anonymous telemetry; build succeeded. The following remain unverified by this bounded QA run: browser rendering and interaction; visitor credential lifecycle; remote provider inference/billing/cancellation; OpenRouter/Hugging Face live behavior; hosted TLS/proxy behavior; and every source change after archived `e7ff1ef`.

## Workspace effects

No root source, configuration, documentation, or commit was edited. The root worktree changed concurrently during verification and was intentionally excluded from the archive; those changes are not attributable to this QA run and were not checked. Retained QA-only artifacts are the archive, archive-local dependency/native/build outputs and two wrapper scripts, complete test log/result, HTTP response bodies under `/tmp/coconut-clean-*`, and temporary private DB listed in the JSON companion. Isolated API and Next processes are stopped after evidence capture; the artifacts remain available for inspection.

Verdict: VERIFIED WITH GAPS
