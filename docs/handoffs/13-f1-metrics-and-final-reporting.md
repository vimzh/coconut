# Module 13 handoff: retained reporting audit

## Status

**Original retained arithmetic audit passed; final integrated reporting readiness remains pending.** Module 12 and final browser/public-comparison evidence are still being completed. This is a verified checkpoint with explicit limitations, not a declaration that the module's integration prerequisites or product scientific gates have passed. Deployment and hackathon submission/material preparation are excluded by the current user scope.

The [independent audit record](../research/reporting-audit-v1.md) describes its AI-assisted reviewer role, exact population, separately written arithmetic, source hashes, commands and limits. No human review is claimed. Module 04 remains the only production scorer; this module checks its retained output without changing any grade, reference or protocol.

## Artifacts and checked contracts

- `apps/api/src/quality/reporting-audit.ts` and its tests independently assert class/F1/accuracy/confusion/outcome counts, directional error rates, three-trial spread/agreement, depth differences, semantic token groups/coverage, latency quantiles, cost coverage and expression/prompt/tokenizer measurements. Report and canonical evidence hashes are checked.
- `apps/api/src/quality/audit-cli.ts` and tests expose bounded offline suite/run audits. Regular-file and streamed byte bounds, fatal UTF-8, safe errors, mode-0600 exclusive output and no-overwrite behavior are verified. No provider client is invoked.
- `apps/api/data/quality/reporting-audit-v1.json` records all 212 original source hashes and execution-count results; its SHA-256 is `8081118a768dbf1aa1514e69f908e36c68f7f0f77f44ff79696355392bc66ba8`.
- `apps/api/data/quality/browser-projection-audit-v1.json` records actual production-adapter/export verification for all 212 originals, 652 depth slices and 1,956 depth/usage-filtered exports. Its SHA-256 is `69e8407e89b3851fa4a10dbfcafc53514700b62eab4148efb3d609c9f492c64c`. Projected class/outcome/usage/latency values and filtered memberships agree with the scorer; this is offline frontend execution, not browser rendering.
- `apps/api/data/quality/challenge-v1.quality.json` and `openai-original-astra-high.quality.json` demonstrate reproducible suite/run quality outputs. The former passes the declared offline suite scope; the latter remains No-go because execution is incomplete and review evidence is missing.

Audited identities: scorer 1 / `pooled-macro-f1-v1`, protocol 1, challenge generator `challenge-v1`, numerical verifier `arb-jet-v1`, measured-operation depth policy and `smooth-v2` instructions. Profile-bound suite, requested model/endpoint/settings, prompt and workload identities remain distinct. The original experiment fixes each exact profile in `openai-matrix-v1.json`; unchanged version-1 profiles use 4,096 output tokens and explicitly identified version-2 reasoning profiles use 16,384.

## Observed outcome and interpretation

The original experiment contains **7,236 planned trials**, **214 included correct model answers**, **7,022 provider errors**, and **225 recorded inference sends** across 212 retained runs. Three reports are provisional; 209 are unavailable; none is complete. No valid wrong label was observed. Correct included prefixes do not establish complete-suite accuracy, ranking eligibility, or absence of future errors. The retained scores remain provisional/unavailable; no infrastructure failure is scored as a mathematical error.

All 212 original report arithmetic checks passed. Reported reasoning tokens are consumed only when explicitly supplied with their semantic identifiers; hidden reasoning is never inferred. Direct OpenAI attempts provide no billed cost evidence, so observed cost totals remain null. Local expression-token counts remain unavailable where no matching tokenizer measurement exists. Intermediate-step, first-error and decomposition diagnostics remain **not applicable** to the current one-shot contract.

The 212 existing quality reports all remain No-go for the incomplete original runs. G-SIGNAL is **No-go for a mathematical-failure finding**: there is neither a point counterexample nor repeated wrong labels in the required independent clusters. G-QUALITY for the full experiment is **No-go pending complete execution and applicable outcome review**. The suite's offline Go is limited to its accepted reference/coverage population and does not override either gate.

## Verification and repair handoff

- `bun test apps/api/src/quality`: **29 passed / 139 assertions**, seven files.
- `bun test apps/api/src/quality/audit-cli.test.ts apps/api/src/quality/reporting-audit.test.ts`: **eight passed / 59 assertions**.
- API lint, type checking and production bundle: **passed**. `git diff --check`: **passed**.
- Actual suite and original-run CLI audits: **completed** with the recorded Go/No-go output. All 212 private RunView exports passed the independent arithmetic loop.
- The hand-calculated mixed fixture reproduces macro-F1 `76/105`, accuracy `2/3`, sample trial-F1 SD `sqrt(57)/18`, ten attempts/nine logical trials and missing-data coverage. Rehashed corrupt metric fixtures are rejected.

The source review found a browser adapter reply-length mismatch: 65,536 accepted in the projection versus 131,072 retained by the inference/scorer contract. The integration owner repaired the shared adapter and reported a focused regression pass. Its final integrated visual/browser verification remains with modules 09/12. No other reproducible arithmetic defect was found in the original retained population.

## Remaining requirements

Record final module 09/10/11 handoffs and module 12 browser/production evidence, including accessibility, responsive plots, export equality and comparison grouping. Audit each later replication separately; preserve the original failed evidence and disclose the repetition. Complete external provider gates only when actual authorized live evidence exists. A video/archive/submission or deployment is not performed or implied by this checkpoint.
