# Additional depth-60 models: execution method

The additional study requests `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-5.6-luna` and `gpt-6-luna` on the **same nine frozen depth-60 cases** as the [original pilot](depth60-results-v1.md). Every model receives three fresh trials per case: **27 planned trials per model, 108 maximum new inference requests**. This implementation made no model request, read no configured credential and created no execution manifest.

Model selection follows the user's request for additional fast, inexpensive models after the original two-model results were inspected. No reference, label, case, prompt or existing outcome changes. This is exploratory follow-up on an already inspected population, with no independent-family, causal-depth, ranking, confidence-interval or general failure-threshold claim. Requesting the same provider-default profile does not establish equal hidden compute across models.

## Fixed requests and coordinated budget

The operator reuses the existing exact suite, reference review, `buildPrompt`, official pinned/patched SDK integration, inference normalization and scorer. Every request uses `one-shot-json-v1`, provider-default reasoning/sampling, plain JSON, 4,096 output tokens, disabled truncation, `store:false`, no tools and no retries. Standard 180-second inference, 20-second metadata and 15-minute study deadlines remain unchanged. No additional setting probe or replacement inference is scheduled.

The existing two-model pilot contributes 54 retained sends, reaching 7,908 cumulative requests. A separately authorized depth-100 session then contributes 54, reaching **7,962**. Additional-study freeze/run requires both predecessors to retain all 54 unique model/case/trial outcomes, complete 27-trial reports per original model, no infrastructure failures and matching manifest/progress/private-result hashes. The original pilot also requires its matching independent arithmetic audit. Depth-100 terminal progress and result bytes are pinned at SHA-256 `1a7fae6dde2c7f7328169e84cced636feaf6fb692664e887194e01196f72f4fd` and `a85c6fa9ef169d6525cb85d6472c6c4233a79fe5fd51c16c685021c8ed7f5876`.

The new ceiling is **7,962 + 108 = 8,070 ≤ 8,192**, leaving 122 requests. Earlier unknown remote sends remain included once. Unused budget is not automatically converted into retries or extra cases. The new manifest binds the unchanged suite/review, exact prompt array, original pilot proofs and coordinated depth-100 matrix/progress/result hashes. It must be timestamped after depth-100 completion.

Four initial requests run concurrently, one per additional model. Concurrency rises to at most 12 only when all four initial Responses replies expose at least 108 remaining requests and 100,000 remaining tokens. Otherwise concurrency remains four. These observed headers govern a bounded scheduling decision; they are not a guarantee against a later provider limit.

## Retention, failure and commands

A separate per-row inference closure binds each before-transmission dispatch receipt to its exact model, case, trial index and request-body SHA-256. The body must match that row's original prompt, requested model and settings. Exclusive private files retain dispatch authorizations and normalized results with visible `rawText`. The existing inference contract does **not** retain the full raw HTTP provider envelope, so these records support normalized-outcome/visible-text replay, not complete provider-envelope replay.

Provider failure or evidence-persistence failure stops new work and aborts peers. All planned identities remain present. Missing evidence after a retained dispatch is distinguished from a trial never dispatched, and unknown remote sends remain counted. Partial official reports preserve their original 27-trial denominators. Safe aggregate export is attempted before an incomplete study exits unsuccessfully; no retry, substitution, answer repair or replacement follows.

The original default commands and model exports remain available. The new intentional commands are:

```sh
bun apps/api/src/experiments/depth60.ts freeze-additional
bun --env-file=apps/api/.env apps/api/src/experiments/depth60.ts run-additional --accept-charges
```

New identities are `depth60-additional-v1`, `data/experiments/depth60-additional-matrix-v1.json`, `data/experiments/depth60-additional-progress-v1.json` and ignored `data/private/depth60-additional-v1/`, under `apps/api/`. Exclusive creation prevents overwriting either study. The operator does not publish through the application. Root owns any later intentional freeze/launch and independent arithmetic verification; the landing table receives only actual audited results through its separate UI owner.

## Verification and scope

Focused checks pass **seven tests with 158 assertions**. They cover hash-identical original manifest reproduction, original scheduler behavior, exact four-model/108-trial membership, 7,962/8,070 budget and chronology, prior-study admission and changed source rejection, per-row dispatch identity/prompt hashes, header-dependent concurrency, safe incomplete export, reflection and overwrite refusal. Fixtures reuse public identities/reports with explicitly synthetic minimal normalized outcomes; they contain no retained private model text.

The same focused tests pass in an isolated snapshot with private operator storage, environment files and development databases excluded, using a sanitized process environment. API lint, type checking and build are attempted before handoff; final outcomes belong in the coordinator's verification record. No live inference, credential read, API restart, database action, publication or commit occurred during implementation. Actual additional-model results and cost estimates remain separate evidence; no score or price is invented here.

Post-run maintenance added an explicit stop guard for normalized queued, in-progress, incomplete or cancelled provider states even when their `failure` field is null. Such dispatched, excluded outcomes remain conservatively unknown; known not-sent failures remain excluded without becoming unknown sends. This guard was added after the completed 108-answer batch, whose executed source SHA-256 is `afe561679a826e3e7ee3fe79e4562d01ec7f9a07c3ec652bcf770b40962722e1` at commit `a7b2143`. The completed batch had no infrastructure or unknown outcome, so this new branch was not exercised or needed there. Its frozen manifest, source identity and result artifacts remain unchanged. The expanded focused checks pass eight tests with 210 assertions; injected provider-state regressions verify the guard without new model calls.
