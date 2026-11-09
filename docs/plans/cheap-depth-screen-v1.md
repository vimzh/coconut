# Additional low-cost depth screening

The user requests ten questions at each of the eight existing requested depths on a few additional cheap, fast OpenAI models. This is a new authorized screening budget, separate from completed Module 15; its 1,865/1,890 accounting and all original evidence remain unchanged.

## Frozen target

- Models: `gpt-4.1-mini`, `gpt-4o-mini`, `gpt-5.6-luna`; at most **80 attempts/model, 240 total**, one response per question, no retries or replacement questions.
- Requested depths: 5, 10, 20, 40, 80, 160, 320, 512. Select ten at each from the reviewed 620-case parent cohort, with three per class plus one rotating convex/concave/neither extra by depth ordinal. Use the first admitted source-order cases within each class, then restore source order. Supports: 27 convex / 27 concave / 26 neither. The two highest buckets reuse the complete parent ten-case sets.
- Every new model receives the same frozen 80 questions and neutral exact-expression/domain instructions. Selection uses source order and labels, never prior wrong-answer identities. These reuse existing reviewed tasks; they are not a new independent holdout.
- Private fast profile: 8,192 maximum output tokens, 180-second per-call deadline, no tools, no automatic retries. Request `reasoning.effort: none` for 5.6 Luna; omit unsupported reasoning settings on the two non-reasoning legacy models. Native temperature/sampling defaults remain unchanged. Preserve actual reported identities and settings.
- This private execution profile differs from the earlier maximum-effort 32,768-token/600-second study. The shared strict JSON answer extractor is reused; an extraction profile identifier does not turn this into an ordinary registered platform run.
- Freeze before inference. The first scored question for each model verifies inference/settings and pins its accepted reported identity; it remains one of the 80, not an additional probe. Incorrect labels or unusable model replies do not stop the study. Rejected settings/access or infrastructure failures remain visible; no alternate model or retry silently replaces them.
- The hard phase deadline is 30 minutes; operator stop signals drain active work, while expiry of the hard phase deadline cancels remaining transports. After the first three scored calls, use at most 24 aggregate concurrent requests. Persistence or infrastructure failure stops fresh work and drains already active requests. Operator stop signals drain; no restart or resending attempted questions.

## Evidence and implementation

Root owns this plan, freeze/paid launch, outcome review, experiment report and final commit. The production worker owns `scripts/cheap-depth-screen.ts`; the test worker owns `scripts/cheap-depth-screen.test.ts`. No frozen API, numerical checker, previous study journal or public table is modified.

Reuse `reportAmendment()` for the reviewed parent handoff, `buildImportedPrompt()` messages, the isolated official-SDK `requestOpenAI()`, bounded `runProviderTransport()`, response normalization, strict extraction and the shared classification scorer. The new operator retains its own immutable manifest, source/API hashes, selected references/request hashes, metadata, exclusive start/lock, per-cell dispatch receipts before wire sends, raw results and terminal report under ignored private storage. Store the credential only in memory from the configured environment; never retain it in evidence.

Report replay must reject changed cases, references, bodies, identities, grades, duplicated receipts and inconsistent terminal records. Retain unknown remote outcomes after interruption, model-unavailable/permission errors, invalid/refused/truncated replies and unattempted work distinctly. Accuracy and fixed-three-class macro-F1 include unusable returned model outcomes, exclude infrastructure, and display real populations. Inspect all wrong/unusable replies and correct-label explanations before making mathematical claims. Do not repair returned grades.

Verification: offline selection/transport/accounting/replay tests, strict TypeScript, ESLint, a Bun bundle build, then live execution exactly once. Independently reconstruct every overall/per-depth count and score after terminal. Commit the verified operator and final research record. Main landing results remain the separately audited 620-task study; this request does not authorize mixing unequal populations in one table.

## Model documentation and availability

Official model pages checked for this run:

- [GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini): $0.40 input / $1.60 output per million text tokens, non-reasoning, 32,768 supported maximum output tokens.
- [GPT-4o Mini](https://developers.openai.com/api/docs/models/gpt-4o-mini): $0.15 input / $0.60 output, non-reasoning, 16,384 supported maximum output tokens.
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna): $0.20 input / $1.20 output, explicit reasoning `none` supported.

The two legacy models are deprecated, not labeled shut down in these pages. Each requested alias passed one credential-isolated metadata GET with zero inference sends; the retained status is needs-verification, not proven inference permission. The actual scored first request establishes parameter/identity compatibility. Price figures are listed token rates, not measured billed costs. No new provider other than direct OpenAI is used.

## Implementation and terminal checkpoint

The operator and16 tests/238 assertions pass under Bun1.4.4, including the pre-wire persistence guard and gated active-peer drain regression. Strict TypeScript, ESLint and Bun bundle build pass. Independent code review found and verified the repair of one persistence-stop/drain defect before any inference call. The operator byte SHA is `561af2cba34bdbdd167eb4c9ab3c39f35a0f5204615ccc44979ca85a82a801f5`; frozen API source remains unchanged.

Study `cheap-depth-screen-v1-83f98a8e95ba29389eb8bdd7306c00aa796dff0261fc7abc0a95e322aa6f75fc` froze at `2026-11-09T00:55:31.341Z`. Execution ran from `00:55:56.994Z` through `00:56:38.879Z`, taking41,885ms. All240 planned attempts completed:80/model, zero provider/identity failures, unknown outcomes, retries or unattempted cells. Scored first calls accepted the requested caps/settings and pinned the actual reported identities. Post-terminal transcript and independent metric review is in progress.

From `apps/api`, the commands already used are:

```sh
/Users/vanshgaur/.bun/bin/bun ../../scripts/cheap-depth-screen.ts freeze
/Users/vanshgaur/.bun/bin/bun --env-file=.env ../../scripts/cheap-depth-screen.ts run --credential-env OPENAI_API_KEY --accept-charges
/Users/vanshgaur/.bun/bin/bun ../../scripts/cheap-depth-screen.ts report
```

Freeze/run are immutable and must not be repeated. Evidence lives in ignored `apps/api/data/private/cheap-depth-screen-v1/`; metadata GET evidence is in the adjacent `cheap-depth-access-v1/`. Replay/report is read-only and needs no paid requests. The earlier public620-task table is unchanged.
