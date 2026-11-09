# Configurable terminal workflow handoff

## Delivered scope

The user requested configurable generation rather than only reproducing the bundled 27-task suite. The new commands accept requested depths, case count per depth, seed and a finite proposal budget. `eval:run --input` evaluates the exact admitted artifact with an explicit model/profile, 1–10 trials and bounded concurrency. Historical web suites, scoring identities, research results and the previous `--suite composition-v1` command remain unchanged.

The implementation reuses pinned external generation, independent exact-display reference verification, official-SDK inference, protocol extraction and classification metrics. No upstream implementation is vendored and no dependencies/API/numerical-source files changed. The landing quickstart and [terminal guide](../terminal.md) now show the configurable workflow and its setup.

## Artifact and execution contracts

- Generation supports unique requested depths 1–1000, at most 1000 total tasks, a uint32 seed and 1–128 proposal batches per depth. Near-balanced class quotas rotate remainder allocation by depth ordinal. Source depths D/D+1, actual AST depth and nonlinear path are distinct retained fields.
- Only independently verified labels on [−1, 1] are admitted. Exact duplicates are excluded globally; rejected and surplus proposals remain in the finite admission ledger. Exhaustion fails with an incomplete artifact instead of reducing requested counts.
- New JSON artifacts have private permissions and are bounded to 256 MiB. Raw CSV/tree data remain in a private sibling `.evidence` directory with 64 MiB per-file bounds. Retain that directory alongside the task file. Reference/proof replay and receipt/batch integrity checks precede inference.
- Exact-file evaluation freezes the input/settings/prompts/request budget in a synced private manifest. Every authorization and outcome is retained separately; reports distinguish authorization from known inference sends and conservative unknowns. Trials × task count cannot exceed 10,000. No retry, resume, substitution or publication occurs.
- Profiles select existing answer formats, output limits and reasoning settings. The ordinary 180-second inference deadline and official SDK credential isolation remain unchanged. Provider failures stop fresh work and abort peers; malformed/refused/truncated model replies remain unsuccessful model outcomes. Scores use full planned populations and requested-depth slices, with realized source-depth diagnostics.
- Normal cancellation preserves settled/unknown/unattempted work. Forced termination can prevent final exports; immutable manifest and per-attempt files remain the recovery evidence. Local files require manual deletion. Exact-file runs do not become web SQLite runs or public leaderboard entries.

## Verification

Final CLI verification after the provenance repair: `bun run test:cli` passed **32 tests / 1,142 assertions**; `lint:cli`, `typecheck:cli` and diff checks passed. Tests cover seeded ordering/quotas, 800-task fixture admission, bounded underfill/duplicates, correlated seed/source/receipt tampering, relocation, real reference replay, selected task/trial/model bindings, paid-consent/credential boundaries, private durability, provider stop conditions and partial scoring. Existing bundled-suite tests also passed.

Web checks passed: 86 tests, lint, type checking and production build. Actual production browser inspection at 1440 and 390 pixels confirmed configurable examples, explicit 800-call accounting, selected saved-file input/trials, an unchanged single result table, expandable commands and no page overflow or console errors. The verified web build is serving port 3200; the API was not restarted.

The final source-bound real pinned-source smoke generated and fully replayed nine certified tasks at requested depths 5, 40 and 512, three each, seed 42, with three source batches/36 proposals: nine admitted, eight unverified and 19 surplus. Final artifact identity: `tasks-a68ab67740301bc3f71c083def0ce843025555da05a783a96e34463ea7a1050b`. It remains in a private temporary file with its evidence directory. An injected 800-task test exercises full configurable population counts without a hidden three-task panel cap. Full external 800-task generation and new live model inference were not run for this change.

Independent bounded review found that the original loader did not bind saved source/request receipts. That gap is repaired before the final checkpoint so rehashed task JSON cannot silently contradict the original saved seed/source receipts.

Re-review found no remaining actionable issue. All root command aliases are documented; 19 local documentation links and new-source wording checks passed. The actual `eval:run --input` entry point was exercised against the final real artifact with an intentionally absent credential: it failed before output creation/provider work. Credential scanning and local-only instruction exclusion are checked before the private push. A clean dependency install was not repeated because dependency and lockfile contents did not change.

## Remaining limits

Generation depends on an external clean pinned checkout and its exact isolated runtime, configured explicitly; source is not bundled. A requested population may remain underfilled or hit size/resource limits. Depth does not guarantee difficulty, exact duplicate exclusion does not establish semantic independence, and seeded generation does not prove training nonexposure. Public raw-source/output redistribution clearance remains unresolved. Keep generated questions, certificates and provider transcripts private.
