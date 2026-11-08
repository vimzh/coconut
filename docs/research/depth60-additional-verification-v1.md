# Depth-60 additional-results verification v1

## Scope and environment

This is a bounded verification of the depth-60 landing-results component and its combined public data. The tested source was tracked `a7b2143ac7c045976bb36c11fc2258f54a971662` plus only two overlays:

- `apps/web/src/components/marketing/depth60-results.tsx` — `adbd6dc22c3c20bd76cf1e50d213beb57480559ffa6026b6ec5912fb2b1b7abe`
- `apps/api/data/quality/depth60-landing-v1.json` — `bb2d256e9ff9b5ed52eb775b52790edf77038bee5f125a1664774cf833cdd192`

The two-line manifest hashes to `272f64c3c0a21ddcead45ed56f335c3a9b0081152f25eb33a8925b8b0d1c99d1`. The root later advanced to `00101a99777d3b06820b1ffda364e850c9e74226`; both authorized overlay hashes still matched the tested snapshot. Other concurrent frontend work was intentionally excluded and is not covered.

A clean `/tmp` archive omitted local instructions, `.env`, private data, root dependency/build directories, and virtual environments. Bun 1.4.4 performed a fresh frozen install: 470 packages in 23.57 seconds. Commands ran with `env -i`, explicit Bun PATH, `TMPDIR=/tmp`, and `CI=1`; no credential variable, provider request, paid call, root API, shared database, or root server was used.

## Behavior coverage

| Behavior | Evidence | Status |
| --- | --- | --- |
| Six source-ordered model rows and macro-F1 values 29.0 / 31.5 / 21.3 / 50.2 / 100.0 / 100.0 | Actual isolated production browser DOM | Verified manually |
| 9 tasks, depth 60, 3 trials per task, 162 requests across 2 batches, max 12 concurrency, 4,096 token cap, exploratory/unranked language | Data contract and rendered production homepage | Verified manually |
| Frontend tests, lint, types, and production build | Clean archive command set | Verified automatically |
| Desktop/mobile page-level overflow | Browser DOM widths at 1280×800 and 390×844 | Verified manually |

## Executed checks

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | exit 0; 470 packages, 23.57s |
| `bun run --filter @coconut/web test` | exit 0; 70 pass, 0 fail, seven files, 1.327s |
| `bun run --filter @coconut/web lint` | exit 0 |
| `bun run --filter @coconut/web typecheck` | exit 0; Next route types generated |
| `bun run --filter @coconut/web build` | exit 0; production build generated six routes |

The built homepage then ran in isolated Next production mode on port 3219. Browser DOM inspection found semantic `main` and the expected h1. The depth-60 section had exactly these rows: `gpt-4.1-mini` 29.0, `gpt-4o-mini` 31.5, `gpt-5.4-nano` 21.3, `gpt-5.4-mini` 50.2, `gpt-5.6-luna` 100.0, and `gpt-6-luna` 100.0. It also displayed the required 162-request/two-batch/max-12/three-trial/4,096-cap workload text and exploratory/unranked qualification.

At 1280×800, document width was 1280. At 390×844, document and body width were 390; the score region was 356px wide with a 520px scroll width/table, confirming contained horizontal scrolling rather than page overflow. No credential input existed on the homepage and no action beyond the anonymous read occurred. The browser reported one non-fatal preloaded-CSS timing warning, not a console error.

## Gaps and workspace effects

No API/native, inference, credential, billing, database, hosted deployment, or shared-service behavior was exercised. Later concurrent frontend WIP remains unverified. Next emitted ordinary no-build-cache and anonymous telemetry notices without blocking the build.

QA made no root product edits. Only this report and its structured companion were created. The isolated port-3219 process was stopped; snapshot and command logs remain under `/tmp/coconut-depth60-v1-*`.

Verdict: VERIFIED WITH GAPS
