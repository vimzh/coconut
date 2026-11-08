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

The [interior handoff](interior-curvature-v1.md) separately records its 11-test / 4,533-assertion mathematical and regeneration checks. Historical suite identities remained unchanged. These are actual checkpoint results, not a claim that every future concurrent edit has been verified.

## Experiment and scientific gates

The original frozen matrix retained 7,236 planned outcomes: 214 correct included answers and 7,022 provider errors. None of its 212 mathematical runs completed. Its three correct prefixes cannot become perfect complete scores or ranked entries. The [reconciliation](../research/experiment-reconciliation-v1.md) preserves its sends, uncertain remote work, failures, and original identities.

The separately frozen OpenAI replication preserves those earlier observations and the original candidate cells. Its progress ledger remains mutable during execution and must not be committed as terminal evidence. Completed publications have independent arithmetic and frontend-projection review; [the first review](../research/openai-replication-review-v1.md) explicitly covers a partial snapshot. A later final audit must use a new artifact rather than replacing that snapshot.

The [two-cell interior experiment](../research/interior-experiment-v1.md) is frozen before any model sees that population. It reserves 432 additional attempts, bringing the conservative cumulative ceiling to 8,080 within 8,192. Launch waits for the parent matrix to settle and for the updated API to advertise the exact fifth suite. Its three families and eight related source groups remain exploratory, unranked, and ineligible for the frozen confidence interval or stronger confirmation claim.

G-MATH remains Go within the bounded mathematical contracts. OpenAI has live execution evidence; G-PROVIDERS remains unresolved for the other two services under the OpenAI-only development restriction. G-SIGNAL remains No-go for a supported frontier mathematical-failure finding at this checkpoint. Original-experiment G-QUALITY remains No-go; suite-only offline Go and scoped completed-run audits do not override missing execution or unresolved outcome reviews.

## Remaining evidence before final reconciliation

1. Settle the frozen replication and reconcile its ledger against every retained outcome without replacement inference.
2. Safely roll the API only after all active work settles, then execute the already frozen interior study.
3. Archive only explicitly published completed evidence, inspect all outcomes relevant to claims, and complete the new independent reporting audit.
4. Update this handoff and modules 13/14 with terminal counts, exact reviewed populations, and honest gate verdicts. Do not reinterpret formatting, truncation, infrastructure, or an inconsistent final label as a proved mathematical-reasoning failure.

The local-only `AGENTS.md`, configured credentials, private access receipts, and private run database remain excluded from Git. Conventional commits and private repository pushes preserve reviewed implementation checkpoints; they do not publish a hosted application or submit an entry.
