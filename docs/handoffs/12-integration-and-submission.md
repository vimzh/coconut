# Module 12 handoff: local product integration

## Status and scope

Local product integration is implemented and verified at the retained checkpoints below. The original, replication, P5, remaining-model and failed standard-reserve studies have separate terminal reporting audits. Final source-bound local QA passed; the separately frozen, active longer-deadline SDK diagnostic still needs terminal reconciliation. This is not an unrestricted readiness verdict: OpenRouter/Hugging Face live inference and a supported declared-frontier mathematical-failure finding remain unproven.

The current user instruction excludes deployment and hackathon submission materials. No hosted deployment, entry upload, code ZIP, video, or event-agreement action is part of this handoff. The [technical plan](../plans/12-integration-and-submission.md) records the scoped integration work.

## Runnable product and integration repairs

The [README](../../README.md) documents frozen Bun installation, pinned native numerical setup, development launch, production build/start, and verification commands. The web application runs at `http://localhost:3200`; the API binds to loopback at port 3201. Use one API process for the local private run store.

The integrated product provides provider/model selection, explicit evaluation charge consent, foreground progress and cancellation, retained private results with separate access codes, evidence inspection and export, intentional publication/withdrawal/deletion, public comparisons, and methodology pages. Visitor operations require their own credentials; the development environment key is used only by explicitly invoked operator experiments.

Source and built API paths now resolve the package data directory and native worker consistently from the checkout. A built-API regression launches from an unrelated working directory and checks the fixed suite catalog. The API idle timeout accommodates heartbeat-driven foreground streams. Private storage stays under ignored `apps/api/data/private`, with restrictive directory/file permissions and seven-day retention.

Run finalization now preserves a terminal failure when report persistence fails, rather than leaving the record running. Shared scorer reconstruction, canonical prompt binding, requested provider/model/profile binding, and suite-key/population validation reject inconsistent retained records and publications. These repairs received bounded regression checks and independent AI-assisted code review.

The interior exploration is separately versioned. Its registry, private/public record validation, browser adapter, methodology, and leaderboard exclusions use the same explicit identity. It does not alter the historical exact, smooth, challenge, or screening memberships.

## Browser and public reporting evidence

The local reference browser was Chromium 152.0.7977.76 through Paseo 0.15.2 / Electron 44.2.0 on macOS. Production pages were checked at 1280×800, 1440×1000, 768×1024, and 390×844. Checks covered navigation, semantic landmarks, keyboard focus/skip access, tables, plots, and contained horizontal scrolling. A real narrow-screen overflow in the outcome summary was repaired and rechecked at 390 pixels.

Two actual published high-effort confirmation runs were compared against their API reports. The leaderboard showed their exact tied ranks and descriptive depth curves. Result filtering, class support, raw answers, reasoning-token coverage, and exported membership matched retained evidence. Public pages do not receive provider keys or private access codes. Missing, withdrawn, private, and expired records use the public absence boundary.

The [isolated browser run exercise](../research/browser-verification-v1.md) used the production interface with a disposable in-memory fixture API and dummy credential. Keyboard input and explicit consent launched one run, the duplicate-start control stayed disabled, and cancellation retained four cancelled and five unattempted trials with unavailable scores and disabled publication. This establishes interface state behavior, not live provider billing or remote cancellation. The fixture was stopped and its tab override cleared.

Native 200% zoom, an operating-system reduced-motion override, other browser engines, hosted TLS/proxy configuration, and non-OpenAI live inference remain unverified. No claim of those checks is made.

## Software verification checkpoints

The following are completed historical checkpoints, with their source/environment limits retained. The final source-bound QA checkpoint is recorded separately below. Commands run from the repository root:

| Check | Observed result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed without dependency changes; pinned SDK environment-header patch retained. |
| API test suite | 668 tests / 29,083 assertions across 62 files passed. |
| Frontend library tests | 58 tests across five files passed. |
| Later focused experiment checks | 21 tests / 132 assertions passed; this is a separate checkpoint, not an added full-suite count. |
| Focused run/interior/store/leaderboard/archive integration | 48 tests / 484 assertions passed. |
| `bun run numerics:test` | 29 native Python tests passed. |
| `bun run numerics:lint` | Ruff passed. |
| `bun run lint` and `bun run typecheck` | API and web checks passed. |
| Production API and Next.js builds | Passed; Next type generation and build ran sequentially. |
| Actual production HTTP/browser checks | Passed within the environments and populations described above. |
| `git diff --check` | Passed at the reviewed integration checkpoints. |

An additional [clean-checkout verification](../research/clean-product-verification-v1.md) archived commit `e7ff1efbe71112c4fdab788525f431b7efbc6ce4` without credentials, private data, dependencies, or a native environment. Frozen installation, fresh native setup, lint, types, and sequential builds passed. The captured full test run exited zero: **669 API tests / 29,090 assertions / 62 files**, plus **58 frontend tests / five files**, in 59.61 seconds. The native suite passed 29 tests. Isolated production startup on ports 3215/3216 returned the exact five-suite registry, healthy pages, an empty public leaderboard, and a 404 anonymous API response for an absent record. The two isolated servers were stopped. This HTTP check does not replace the separate browser interaction evidence. The [machine-readable record](../../apps/api/data/quality/clean-product-verification-v1.json) identifies the snapshot, environment, commands, capture limitations, and concurrent work excluded from this check.

After concurrent font/pitch changes, a separate [frontend compilation verification](../research/frontend-compilation-verification-v1.md) archived `d9fae2f99bb95d87d1efbdcc7f38353ce5fb25a4`. Frozen installation, 58 frontend tests, lint, sequential type generation/type checking, and production build passed. Exact diff inspection found no API/native source or relevant dependency changes; the only dependency removal was the unused web font package. The prior API/native results remain applicable to those unchanged paths. This incremental check establishes compilation, not rendered font, viewport, or interaction behavior; its [machine-readable evidence](../../apps/api/data/quality/frontend-compilation-verification-v1.json) preserves that limit.

The [interior handoff](interior-curvature-v1.md) separately records its 11-test / 4,533-assertion mathematical and regeneration checks. Historical suite identities remained unchanged. These are actual checkpoint results, not a claim that every future concurrent edit has been verified.

## Experiment and scientific gates

The original frozen matrix retained 7,236 planned outcomes: 214 correct included answers and 7,022 provider errors. None of its 212 mathematical runs completed. Its three correct prefixes cannot become perfect complete scores or ranked entries. The [reconciliation](../research/experiment-reconciliation-v1.md) preserves its sends, uncertain remote work, failures, and original identities.

The separately frozen OpenAI replication ended interrupted at 2026-11-08 07:59:46.559 UTC, preserving **171 completed publications, 35 failed, one interrupted, 26 capability-unverified and five unstarted cells**. The [terminal review](../research/openai-replication-review-v2.md) and [prefix addendum](../research/openai-partial-prefix-review-v1.md) independently reconcile all 207 started reports and inspect all 758 retained wrong/invalid/truncated replies. The earlier partial review is unchanged. The [public archive](../../apps/api/data/experiments/openai-progress-v2-published/index.json) contains exactly 171 explicitly published RunViews; failed raw answers and access receipts remain private. Actual replication sends are 6,678, giving 7,090 cumulative with the prior 412 allowance. Its terminal ledger and attempt-level accounting evidence are retained without replacing unsuccessful cells.

The [two-cell P5 interior study](../research/interior-results-v1.md) settled at **2026-11-08 09:10:21.584 UTC**. Both published/archived cells returned 216 valid correct labels, for **432 new sends and 7,522 conservative cumulative requests**. Independent arithmetic, full quality/native/scorer replay and real frontend/export projections passed; the 432 correct explanations were not qualitatively certified by that study audit. Three families/eight related source groups remain exploratory, unranked and ineligible for the frozen interval or stronger confirmation claim. Its original 8,080 reservation remains historical; actual accounting uses 7,522. Earlier authentication observations remain access evidence, not scores.

The [fresh remaining-model supplement](../research/remaining-models-results-v1.md) then completed all eight original o3/default/low/medium/high configurations at **09:41:12.655 UTC**. Its 216 outcomes contain **192 correct labels, one wrong valid label, 11 invalid replies and 12 truncations**. All 24 wrong/unusable replies were inspected and independently crosschecked; the lone valid error is a false polynomial derivative in o3/low screening, while two malformed replies retain unresolved mixed mathematical/format defects. Every old prefix remains separate. Actual cumulative accounting reaches **7,738**. Across the preserved studies, **47 requested IDs have execution records and 45 have a completed published cell**; these are not independent architectures or 47 successful complete benchmarks.

Following the disclosed [observational amendment](../research/conditional-reserve-operational-amendment-v1.md) and [coordinator decision](../research/conditional-reserve-decision-v1.md), the fixed 18-task reserve was independently reviewed, integrated and separately frozen. The [standard 180-second attempt](../research/reserve-results-v1.md) settled at **10:28:38.142 UTC** with both cells failed: **eight sent operations, all remote outcomes unknown, zero model answers and 100 unattempted trials**. Accuracy/macro-F1 are unavailable, not zero. No failed record was published; the empty archive binds its preserved pre-archive source, whose only difference from final progress is its update timestamp. Conservative accounting through that terminal study is **7,746**, including the original 11, replication 101 and its eight unknown outcomes once.

The separately versioned operator-only **600-second SDK diagnostic is now frozen and active**, not terminal. Its [manifest](../../apps/api/data/experiments/long-reserve-matrix-v1.json), canonical SHA-256 `ba30c68369f40a118c96bca133c6ec1d4ab6445b15d37840edec0b6c6e6d2c63`, admits at most 108 fresh requests for a conservative ceiling of **7,854 / 8,192**. It preserves all standard-attempt records and the ordinary platform/profile's 180-second deadline. Its own completion, outcomes and final review remain pending; no live partial observation is promoted to a terminal score here.

G-MATH remains Go within the bounded mathematical contracts. OpenAI has live execution evidence; G-PROVIDERS remains unresolved for the other two services under the OpenAI-only development restriction. G-SIGNAL remains No-go for a supported declared-frontier mathematical-failure finding. Original/interrupted experiment-wide G-QUALITY remains No-go; suite-only offline Go and scoped completed-run audits do not override missing execution or unresolved outcome reviews. Exploratory/screening studies remain unranked with no eligible confidence interval. The original absolute absence condition remains unproved; unknown remote outcomes are neither correct answers nor free budget.

## Final source-bound local verification

The [final QA report](../research/final-product-verification-v2.md) and [structured evidence](../../apps/api/data/quality/final-product-verification-v2.json) retain the tested `210b12a` archive plus its complete 39-file overlay manifest. Product source/config/dependency/native inputs match the tested assembly through `955efb6`; later research data and documentation were not represented as executed software.

A fresh frozen install, native environment, **719 API tests / 30,549 assertions**, **66 web tests**, **29 native tests**, Ruff, lint, type checks and sequential API/web production builds passed. An isolated built API returned all six suites, including reserve 18. A separately rebuilt local production frontend passed anonymous desktop checks for the home, evaluator, methodology and leaderboard; reserve/max showed 18 tasks, depths 17/23, three trials, 54 requests and a 16,384-token cap, with no console entries or 1280px overflow. Isolated services were stopped, and existing services/private storage were untouched.

This pass used no credentials, remote inference or publication. Production 390px resizing and screenshots could not be verified because of browser-host limitations; the coordinator's separate dev/HMR 390px observation is explicitly supplemental. Non-OpenAI live inference, hosted/TLS/proxy behavior and deployment remain unverified. These software checks neither complete the active diagnostic nor establish G-SIGNAL.

## Remaining evidence before final reconciliation

1. Preserve the source-bound final QA evidence and its explicit browser, provider and hosting gaps; later source changes require applicable verification.
2. Settle and independently audit the active 600-second SDK diagnostic as its own population, preserving all 108 planned trials and the earlier eight unknown sends. Do not resume, overwrite or pool the failed standard study.
3. Reassess applicable scientific gates from that bounded evidence without weakening D-12 or turning format, truncation, infrastructure or label/conclusion inconsistencies into a proved mathematical-reasoning failure.
4. Keep OpenRouter/Hugging Face live inference explicitly unverified until a separately authorized service check establishes it. Deployment and submission/material preparation remain excluded.

The local-only `AGENTS.md`, configured credentials, private access receipts, and private run database remain excluded from Git. Conventional commits and private repository pushes preserve reviewed implementation checkpoints; they do not publish a hosted application or submit an entry.
