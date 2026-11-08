# Module 12 handoff: local product integration

## Status and scope

Local product integration is implemented and verified at the checkpoints below. Final experiment execution and reporting reconciliation remain in progress. This is not an unrestricted readiness verdict: OpenRouter/Hugging Face live inference and the required mathematical-failure finding remain unproven.

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

Commands run from the repository root:

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

The [two-cell interior experiment](../research/interior-experiment-v1.md) was frozen before any model saw that population. It reserves 432 additional attempts, preserving its original conservative ceiling of 8,080 within 8,192. It launched at **2026-11-08 08:20:33.323 UTC**, after the parent process exited, a read-only database check found zero active runs, and the updated API advertised all five exact suite identities. It is still running at this checkpoint. A preceding official-SDK authentication observation returned HTTP 200 with zero inference requests; actual model outcomes remain separate from that access evidence. The three families/eight related source groups remain exploratory, unranked and ineligible for the frozen confidence interval or stronger confirmation claim.

The dormant reserve has an [explicit observational amendment](../research/conditional-reserve-operational-amendment-v1.md), recorded while P5 was partial at 140/148 correct returned labels. It preserves the original wording and fixed 18-task proposal, acknowledges 11 unknown earlier remote outcomes, and does not claim the original absolute condition was proved. No reserve runtime or paid request exists at this checkpoint. The [remaining-model supplement](../research/remaining-models-experiment-v1.md) is implemented and independently reviewed but cannot be frozen until prior studies settle and strict attempt-derived accounting admits its 216-call ceiling.

G-MATH remains Go within the bounded mathematical contracts. OpenAI has live execution evidence; G-PROVIDERS remains unresolved for the other two services under the OpenAI-only development restriction. G-SIGNAL remains No-go for a supported frontier mathematical-failure finding at this checkpoint. Original-experiment G-QUALITY remains No-go; suite-only offline Go and scoped completed-run audits do not override missing execution or unresolved outcome reviews.

## Remaining evidence before final reconciliation

1. Settle and reconcile the frozen interior study, preserving every planned denominator and returned outcome.
2. Assess the explicit reserve condition and record any subsequent decision before dependent runtime work or calls.
3. Complete the separately recorded o3 supplement only after its actual-send accounting and immutable freeze pass; preserve all earlier failures.
4. Audit later public/private evidence separately and update modules 12/13/14 with terminal counts, exact reviewed populations, applicable checks and honest gate verdicts. Formatting, truncation, infrastructure and label/conclusion inconsistencies cannot substitute for a proved mathematical-reasoning failure.

The local-only `AGENTS.md`, configured credentials, private access receipts, and private run database remain excluded from Git. Conventional commits and private repository pushes preserve reviewed implementation checkpoints; they do not publish a hosted application or submit an entry.
