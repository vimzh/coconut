# 14a Product Flow Cleanup Handoff

Implementation and verification on 2026-11-08 follow the [plan](../plans/14a-product-flow-cleanup.md) and [module](../modules/14a-product-flow-cleanup.md). This checkpoint changes presentation and navigation, with no inference calls or benchmark recomputation.

## Delivered flow

- Home presents the current 27-task benchmark, **View results** followed by **Run this benchmark**, one audited summary table and one short domain example. Repeated policy/workflow explanations were removed. Historical tables remain absent; tracked historical JSON is unchanged.
- Setup shows the recommended suite first. Six other suites use **Advanced workloads**; a selected alternative stays named when the disclosure closes. Existing selection handlers, consent resets, private access and foreground execution are preserved.
- Review shows provider/model, actual tasks × responses, maximum requests, requested reasoning, token limits, privacy and explicit charge approval. Concurrency and version/profile details remain available under an execution disclosure with their original values.
- Results preserve primary pooled macro-F1 and its exact exports. Accuracy now reads as a percentage with correct/included counts; included/planned responses and completion remain visible. Wrong valid labels, unusable replies, provider errors and unfinished work have separate counts. Task/answer/reference inspection and detailed diagnostics retain their existing tabs/disclosures.
- Current verified nonlinear stage metadata is bound to the exact frozen suite identity. Charts and ordinary numeric depth filters use **expression-tree depth**. The helper refuses unknown identities/depths rather than guessing stages. Methodology and README match this navigation.

The existing default is still **27 tasks × 3 fresh responses = 81 requests per model**, with nonlinear stages **2/4/6** and expression-tree depths **7/13/19**. The future 800-task single-response study remains documentation only. No task/prompt/profile, score, execution policy, credential handling, storage, export schema, publication rule or ranking policy changed.

## Verification

| Check | Result |
| --- | --- |
| `bun test src/lib` in `apps/web` | 77 tests passed, including existing score/projection/export tests and the new stage-identity regression. |
| `bun run --filter @coconut/web lint` | Passed. |
| `bun run --filter @coconut/web typecheck` | Passed, including Next route generation. |
| `bun run --filter @coconut/web build` | Passed; optimized Next 16.4.5 production build. |
| Independent code review | No actionable findings; count formulas, score identity, stage metadata and consent-reset paths checked against scorer/controller/artifacts. |
| Historical evidence | Five historical landing/audit JSON files compared byte-for-byte with starting revision `7039222`; unchanged. Current score and suite JSON also unchanged. |
| Repository hygiene | `git diff --check` passed; root `AGENTS.md` remains excluded through `.git/info/exclude`. |

Local production web runs at `http://localhost:3200`, with read-only catalog configuration from port 3201. Browser checks use isolated headless Chrome 156.0.8078.80 on macOS, at desktop 1440×900 and mobile 390×844. Browser fixtures are explicitly synthetic and intercept run responses. Every non-GET browser request was intercepted: synthetic model-selection metadata was fulfilled locally, and real writes were blocked. This verifies presentation behavior, not paid inference or availability of a real public transcript.

The initial browser pass verified one current home table, primary/secondary actions, default/advanced workload selection and collapsed selected-name persistence, 72 × 3 = 216 alternative requests, keyboard focus, no horizontal page overflow, separated result outcomes and reference/raw-answer disclosures. A complete synthetic retained report displayed 6 correct / 9 included, 66.7% accuracy, macro-F1 0.724, two wrong labels, one unusable reply and no service failures. An interrupted report without a retained score remained visibly unavailable on mobile. No console errors were observed.

The extended pass checked all seven catalog workloads and their exact task-count × 3 request totals. Keyboard Enter toggled Advanced workloads. The current composition preview filtered to nine tasks at tree depth 7 and returned to 27 when cleared. Synthetic metadata enabled the ordinary review journey: 27/3/81, requested reasoning and default concurrency 4 were preserved; approval enabled Start, while changing concurrency or selecting the 216-request challenge reset approval. Start was never clicked.

A temporary 75-task retained fixture was generated offline from the existing frozen reference suite and scorer, with one final provider error. Its overall score stayed provisional. Filtering to tree depth 5 showed one service failure; tree depth 10 showed zero and 45/45 correct responses. The depth-5 export contained only depth-5 tasks and the selected depth. This checks filtered completion separately from the incomplete whole run. The unavailable-score fixture remained distinct from both.

An additional mobile pass activated the home result anchor and setup action, reached the keyboard-focusable horizontal table region, and opened the methodology's advanced disclosure with Enter. Methodology retained one main landmark and no horizontal page overflow. Reduced-motion screenshots were also inspected; this is a browser emulation check, not an operating-system accessibility certification.

## Screenshot evidence

- [Home and current audited summary](../evidence/14a/home-desktop.png).
- [Mobile setup with advanced workloads](../evidence/14a/setup-mobile.png).
- [Review after switching to the 216-request workload](../evidence/14a/review-consent-synthetic.png): synthetic model metadata; approval remains unchecked and launch disabled.
- [Complete report and answer/reference inspection](../evidence/14a/results-complete-synthetic.png): synthetic fixture, not a measured model result.
- [Filtered slice of an incomplete run](../evidence/14a/results-partial-filter-synthetic.png): synthetic fixture; the selected depth is complete while the whole-run warning remains visible.

Additional local captures and the temporary acceptance harness are at `/tmp/coconut-14a-browser/` and `/tmp/coconut-14a-browser-qa.py`. Screenshots were inspected before retention and contain no real provider credential or private run access code.

## Boundaries and next insertion point

No new live-provider verification was performed. Existing OpenRouter/Hugging Face, browser-engine, deployment and scientific-evidence limitations remain. The static current score summary intentionally has no public transcript destination; answer inspection requires an authorized retained run.

Module 14b is next: integrate the pinned generator and independent admission checks, then perform its separately bounded development pilot. Phase 15 should insert its implemented, frozen suite through the existing run catalog and `scripts/export-suite-previews.ts`; this cleanup does not expose a future runnable workload or authorize final-study dispatch.

Frontend Design and Unslop informed this restrained presentation pass. Unslop guidance credit: Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0. The existing typography, palette, mathematical illustrations and component interfaces were preserved.
