# Final isolated product verification v2

## Scope and source boundary

This report verifies one immutable assembled source: tracked `210b12a7f36f5ba24c91dcfb5d766409d2778f7c` plus 39 untracked public/source/docs files captured at the start of QA. The complete path/SHA-256 manifest is embedded durably in the structured companion. Its 39-line source manifest was independently hashed as `f2044df2182d73e364508434cf3d3fa4a5d68e0225ac7ad85aeac319291327cc`.

The archive deliberately omitted local instructions, `.env` files, private API storage, dependency directories, virtual environments, and Next build output. Commands used `env -i` with only `PATH`, `TMPDIR=/tmp`, and `CI=1`; no provider credential variable was present. No remote inference, charged request, credential input, shared database access, existing server control, or source repair occurred.

After capture, the root advanced to `f6c3fb83435f81ba708505986d6069c5d44f4ed9` and acquired an additional untracked long-reserve progress artifact. A later comparison found current `apps/api/src`, `apps/web/src`, native source/config (excluding generated virtual-environment/cache files), package manifests, and `bun.lock` identical to the tested assembly. The two long-reserve files that became tracked match their overlay SHA-256 values exactly: source `efbfa683d6d27d2c886f9bd79d2e140c7c646c9bdae1aa0f1946622019c884b4`, test `df6ac124dc6a960444de0b511029b4959ba2112df1b30c4dc31cf199b51c8101`. During this update the tracked head advanced again to `955efb62cc190ce5fda11dac26209119cb2ae323`; `f6c3fb8..955efb6` has no diff in the same product/config/dependency/native scope. Therefore those inputs at both revisions are covered by the executed checks; later data and documentation contents were not executed.

## Behavior coverage

| Behavior | Execution evidence | Status |
| --- | --- | --- |
| Frozen JS dependencies | `bun install --frozen-lockfile`; 468 packages installed in fresh snapshot directory | Verified automatically |
| Fresh native environment | `bun run numerics:setup`; CPython 3.13.17, pinned python-flint and Ruff | Verified automatically |
| API and web software tests including overlay source | `bun run test`, exit 0: API 719 tests / 30,549 assertions / 69 files; web 66 tests / six files | Verified automatically |
| Native numerical behavior | 29 Python tests and Ruff clean | Verified automatically |
| Lint / types | Root lint, API typecheck, web Next type generation plus TypeScript | Verified automatically |
| Sequential production builds | API build, then web build | Verified automatically |
| Built API health and suite registry | Isolated built-config Bun.serve wrapper at 3217; HTTP health and suite registry | Verified manually by HTTP |
| Native worker from built API | Passing full-suite built runtime-path regression | Verified automatically |
| Local production web behavior | Fresh isolated production build/start with API origin fixed to the isolated API; anonymous browser reads | Verified manually, with mobile visual gap |

## Commands and outcomes

| Command | Result | Timing |
| --- | --- | --- |
| `bun install --frozen-lockfile` | pass | 18s |
| `bun run numerics:setup` | pass | <1s |
| `bun run test` | pass; API 719/30,549 and web 66 | 119.675s |
| `bun run numerics:test` | pass; 29 tests | <1s tool wall timing |
| `bun run numerics:lint` | pass | 5s |
| `bun run lint` | pass | 3s |
| `bun run --filter @coconut/api typecheck` | pass | 3s |
| `bun run --filter @coconut/web typecheck` | pass; route types generated | 5s |
| `bun run --filter @coconut/api build` | pass; 330 modules | <1s |
| `bun run --filter @coconut/web build` | pass; seven static pages | 7s |

The full test output and durable exit record remain at `/tmp/coconut-final-product-v2-test.log` and `/tmp/coconut-final-product-v2-test.result`.

## Isolated runtime evidence

The built API configuration was imported from `apps/api/dist/index.js` and served only through a temporary `Bun.serve` wrapper at `127.0.0.1:3217`. Its private store was `/tmp/coconut-final-product-v2-private/runs.sqlite`; no existing API service or database was opened. `GET /health` returned 200 with `{"status":"ok"}`. `GET /runs/suites` returned the six fixed registrations:

- reference 75; smooth 27; challenge 72; screening 9; interior 72; reserve 18.

The reserve count was checked against both the returned registry and the retained source contract: it is an 18-task exploratory/unranked population with measured depths 17 and 23. An initial QA assertion expecting 72 was wrong; it failed only after the successful response. The correction used the saved response/source contract without another API request, so this is a harness-expectation correction, not a product failure.

The isolated wrapper was stopped after the check.

## Supplemental browser observation

The coordinator separately reported an anonymous current-development-browser check (not independently executed by this QA run): six suite choices were visible, and reserve selection showed 18 tasks, depths 17/23, three trials, 54 requests, 16,384 cap at max effort, and exploratory/unranked labeling. It reported no credential, probe, launch, publication, or database write and no document overflow at 1280×800 or 390×844. This is supplemental dev/HMR observation, not production-browser evidence.

## Isolated production-browser evidence

The same immutable snapshot was rebuilt with `NEXT_PUBLIC_API_ORIGIN=http://localhost:3217`, served by Next production mode on `localhost:3218`, and paired with the built API configuration in a temporary `Bun.serve` wrapper on `127.0.0.1:3217`. The wrapper accepted only `http://localhost:3218` as web origin and used `/tmp/coconut-final-product-v2-private-browser/runs.sqlite`.

An anonymous browser read the home page, evaluator, methodology, and leaderboard. Home and evaluator exposed semantic `main`, `h1`, and skip navigation. The evaluator loaded six suite choices; browser-selecting `reserve-v1` showed 18 tasks, depths 17/23, three trials, 54 maximum requests, and exploratory/unranked labeling. Browser-selecting `one-shot-json-v2-max` then showed its 16,384-token cap. No credential was entered and no access check, compatibility probe, evaluation launch, publication, refresh, or seed action was selected. At 1280×800, document/body scroll width was 1280, Helvetica Neue and Geist Mono reported loaded, and the browser console had zero entries. Methodology had its expected heading and no rendered match for “paper” or “benchmark”; the leaderboard rendered “Public model comparisons” with “No published evaluations yet.”

The browser host acknowledged a requested 390×844 resize but subsequent DOM metrics remained 1280×800, so no mobile overflow conclusion is made. Two screenshot attempts said the tab had not painted; this report makes no screenshot-based visual claim. This is local production-mode evidence only, not hosted deployment, paid provider, or long-run evidence.

## Gaps and residual risk

The 390px viewport and screenshot visual checks were not obtained because of browser-host limitations. Remote provider authorization, inference, billing, cancellation, non-local hosting, TLS/proxy behavior, and later data/document changes remain unverified. Next emitted its ordinary missing-build-cache and anonymous telemetry notices but completed successfully.

No root product source was edited by QA. The only root files created are this report and its structured companion. Earlier QA reports remain unchanged.

Verdict: VERIFIED WITH GAPS
