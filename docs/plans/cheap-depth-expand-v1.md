# Expand cheap-model screening to 100 questions per depth

The user explicitly expands the completed ten-question-per-depth screen to **100 questions at each of eight depths for each of three models**, and clarifies **120 concurrent calls**, not 120 new calls per second. This amendment supersedes the cheap screen’s 240-call target with 2,400 total attempts. Preserve its 240 completed attempts exactly; authorize at most **2,160 additional calls**. Completed Module 15’s separate 1,865/1,890 accounting remains unchanged.

## Population and settings

- Reuse the original independently reviewed 800-case source pool, 100 per requested depth 5/10/20/40/80/160/320/512. Supports 267 convex / 267 concave / 266 neither. No additional question generation, model-guided selection or reference-policy change.
- The existing 80-case screen is a subset of these 800. Every old model/case/answer/receipt remains included, including wrong and malformed answers. Each model needs 720 unattempted questions; the remaining 90 at every depth comprise 30 cases per class.
- Models and actual accepted identity pins remain `gpt-4.1-mini` → `gpt-4.1-mini-2025-04-14`, `gpt-4o-mini` → `gpt-4o-mini-2024-07-18`, `gpt-5.6-luna` → `gpt-5.6-luna`.
- Keep the same private 8,192-output-token / 180-second profile, neutral exact-expression/domain messages and strict JSON extraction. Legacy reasoning parameter omitted; 5.6 Luna explicitly none. No tools, repeated trials, hidden model substitutions, automatic retries or resending old cells.
- Use at most 120 concurrent new calls. Observe real rate-limit headers on scored calls, without extra probes. On 429, retain that failed cell, drain the generation, respect a bounded cooldown, then reduce future concurrency to 96 and 72. Never resend a rate-limited case. A further 429 at 72 or another infrastructure/persistence failure stops fresh work and drains active requests. A hard 30-minute phase deadline may cancel remaining transports.
- More questions reduce sampling variability but cannot guarantee monotonically falling scores, independence, repeat consistency or a causal depth effect.

## Minimal implementation and verification

Production owns only `scripts/cheap-depth-expand.ts`; test owner only its `.test.ts`. Root owns this amendment, freeze/run, audits and final research report. Do not alter the frozen cheap-screen operator, previous journals, API source, reference checker or main landing table.

Reuse the tested cheap-screen transport, exact body builder and raw replay. Freeze an independently bound full 800-case population, inherited 240-cell baseline and identity pins, old/new implementation hashes, fixed budgets and request/reference bindings in a new ignored `apps/api/data/private/cheap-depth-expand-v1/` root. Old receipts retain their original study/ordinals; new ordinals 241–2,400 are unique. Exclusive immutable start/lock/dispatch/result/terminal records reject restarts, duplicate sends and changed evidence.

Offline checks cover selection/accounting, inherited rows, exact 120 concurrency, rate-generation drain/cooldown/no-retry behavior, partial/unknown outcomes, identity drift, persistence stops and 100-per-depth arithmetic. Run strict TypeScript, ESLint and a bundle build; inspect the paid-execution path before launch. Replay all results after terminal and independently compare every confusion count, score and real denominator. Preserve all failures and incomplete work rather than replacing questions.

The existing 80-case private audits remain reusable. Review additional wrong/unusable replies and correct-label explanations under explicit evidence scope; explanation findings do not change official label grades. Report source-depth and budget confounds. Keep the new screen separate from the earlier maximum-effort 620-task study and from the visitor 27-task/three-trial workbench.

## Predeclared post-run review scope

Mechanically replay and independently score **all 2,400** retained cells: exact body/reference/receipt/result binding, actual model identity/settings, raw normalization, strict answer extraction, outcome categories and every overall/per-depth confusion matrix. Ground truth is the already independently certified full source pool. This exhaustive check establishes the label scores without using an LLM to judge free-form explanations.

Retain the completed manual inspection of all 240 original replies. For new visible-explanation review, preselect the **first previously unattempted source-order case of each reference class at every depth**, before dispatch: 24 additional cases/model, identical across models. Review whatever outcome is returned without replacement. Preserve unsupported explanation claims separately from official grades. All additional unusable outcomes receive deterministic protocol/status diagnoses; wrong-label grades follow certified references and raw extraction, without claiming that every new explanatory argument was manually checked. Report exact inspected populations and never call the remaining explanations verified.

## Verified implementation and execution checkpoint

The frozen operator is `scripts/cheap-depth-expand.ts`, byte SHA `42ba0a06609d265810557057b04313fa200204215cdd70acdefe0dfdc86e4474`. Combined expansion and v1 regression coverage: 26 tests/3,309 assertions pass; strict TypeScript (including DOM.Iterable for response headers), ESLint and Bun bundle build pass. Bounded independent code review found no launch blocker. A real-data dry construction verified 800 cases, 240 inherited attempts, 2,160 pending cells and a 34,062,919-byte manifest below the unchanged 64MiB artifact cap. The original API fingerprint remains `6d9d07b5f4147ffe321875da19e36bfb2c8491ca361eec0c914db6e2d3179fb2`.

Expanded study `cheap-depth-expand-v1-ec3c585b521a4e1dbd9b552de33521c160c37c501b644a168751e8d1ff0c4b40` ran from `2026-11-09T01:15:09.841Z` to `2026-11-09T01:16:14.781Z`: 64.940 seconds. All 2,160 new calls settled with no rate fallback, provider/identity failures, unknown outcomes or retries. Combined 2,400-cell replay reports complete, 800 model outcomes/model and 100/depth, no active/unattempted work. Transcript samples and independent arithmetic are being finalized.

The commands already used from `apps/api` are:

```sh
/Users/vanshgaur/.bun/bin/bun ../../scripts/cheap-depth-expand.ts freeze
/Users/vanshgaur/.bun/bin/bun --env-file=.env ../../scripts/cheap-depth-expand.ts run --credential-env OPENAI_API_KEY --accept-charges
/Users/vanshgaur/.bun/bin/bun ../../scripts/cheap-depth-expand.ts report
```

Do not repeat freeze/run. Root evidence is ignored `apps/api/data/private/cheap-depth-expand-v1/`; report/replay is read-only and makes no model calls. The pre-dispatch explanation-review plan is in adjacent `cheap-depth-expand-review-plan-v1.json` (SHA `478f99ed07e8902d32d084090204f7250a0df50604052c4bbe608134811da07f`). The rate policy follows current official [rate-limit](https://developers.openai.com/api/docs/guides/rate-limits) and [error-code](https://developers.openai.com/api/docs/guides/error-codes) guidance: honor Retry-After minima, distinguish quota from transient rate limits, and retain explicit attempt budgets. No actual retry was authorized here.
