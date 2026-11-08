# Module 15 implementation plan

Status: implementation and offline feasibility investigation. No final model requests have been dispatched.

The user froze Astra (`gpt-6-astra`), Mini (`gpt-5.4-mini`) and Luna (`gpt-6-luna`): the same 800 fresh questions once per model, 2,400 final sends. This plan implements [Module 15](../modules/15-deep-composition-stress-evaluation.md); it does not amend the population downward or require declining scores.

## Frozen construction policy

- Requested depths: 5, 10, 20, 40, 80, 160, 320, 512. Each stratum needs 100 admitted distinct displayed-function/domain pairs on `[-1,1]`. Rotate the extra label convex/concave/neither; aggregate supports are 267/267/266.
- Reuse the exact source revision and isolated environment from 14b, dimension 1, maximum children 2, attempts per instance 20. Each batch requests four proposals per class (12 rows). Candidate order follows source rows; admit the first independently certified, unexposed, nonduplicate candidates until each quota fills.
- Initial feasibility bound: 64 batches per stratum, 768 proposals (256 per class). **Amendment A-15-01 below increases the final construction cap to 128 batches, 1,536 proposals (512 per class), before final construction or model dispatch.** Seed = `1500000 + 10000 * depthOrdinal + batchOrdinal`, with ordinals starting at zero. Retain every source CSV, generation receipt, reference result and rejection reason. No model answer enters selection.
- First run bounded feasibility batches at depths 512, 320 and 5. The implementation feasibility timebox began approximately 2026-11-08 16:56 UTC and ends at 18:56 UTC. Failed references cannot be relabeled from the source generator. If the target is infeasible, retain the incomplete construction and require a named pre-run design amendment before a smaller study.
- Preserve frozen 14b admission/checker files. Any new proof policy needs its own implementation, tests, review and identity. Exact displayed decimals and all original child domains remain authoritative.
- Check prior exposure against the 24 retained 14b proposals and 12 reconstructed earlier source smokes, including significant-core and whole-shape signatures. Check cross-depth exact and bounded-simplified duplicates. Record related cores/clusters and unknown semantic equivalence; do not claim complete equivalence decision or independent sampling.
- Retain requested/realized depth, raw AST depth, nonlinear path, node counts, lengths, bounded simplification and mechanism diagnostics. Eight immutable 100-case stratum manifests keep each artifact within the existing 64 MiB bound; an aggregate binds all strata and diagnostics.

## Research execution policy

The new `deep-single-response-v1` method is separate from ordinary three-trial runs and 14b's 180-second pilot. Proposed research profiles reserve 32,768 output tokens and 600,000 ms per inference, with zero retries: Astra `max`, Mini `xhigh`, Luna `max`. Ordinary profiles, SDK version/header isolation and platform deadlines remain unchanged. These settings require one simple, original control per model before final freeze; the three controls consume the existing three-probe allowance and are retained regardless of outcome. Model/parameter acceptance and reported identity, rather than control correctness, determine compatibility.

The development allowance is shared with 14b: two prior sends (one unknown remote outcome) are already consumed. Three new probes would bring it to five of 30, leaving 25, and the roster-wide numeric ceiling remains **2,430 sends**, including the earlier two. Final dispatch is blocked until the full 800-case population and independent reference review, compatibility records, source/implementation hashes and roster/settings are frozen. No silent alias substitution or retry after a timeout.

Use the explicit development credential only in the private operator CLI. Fixed OpenAI Responses destination; official pinned SDK; no ambient credentials/routing/headers; manual redirects; bounded strict-UTF-8 body reads; cancellation and deadlines. Persist an immutable model/case/trial receipt before wire dispatch, then persist its original outcome. An exclusive study lock, unique identities and reconciliation prevent duplicate sends. Maximum aggregate concurrency is 12, with a deterministic round-robin queue across models and cases. The overall deadline is 12 hours. Persistence failures stop dispatch; systemic authentication/quota/rate-limit/provider failures stop fresh dispatch, with already authorized outcomes retained. There are no automatic retries or replacement questions.

## Reporting and verification

Reconstruct overall and per-depth accuracy, fixed-three-class macro-F1, supports/recalls and confusion matrices from retained evidence. Distinguish correct, wrong valid, unusable, provider failures, terminal unknown remote outcomes, active and unattempted. Accuracy includes unusable model outcomes but excludes infrastructure; incomplete cells remain provisional/unavailable. No trial spread or repeat agreement is available. Inspect every wrong/unusable transcript and bind its diagnosis to the reference and request hashes.

The landing page consumes only a safe aggregate export after independent audit. Its requested-depth columns must disclose D/D+1 realized depth, completion and settings. Raw external source/output and private transcripts remain private while redistribution clearance is unresolved. Until an audited new report exists, retain the currently supported composition results and mark the new study as pending; never fabricate new scores.

1. Population implementation and offline proof feasibility: test deterministic quotas, boundaries, duplicate/exposure rejection and full replay; independently inspect the deep reference route.
2. Research transport: test exact outgoing body, isolation, 32k usage normalization, 600-second cancellation, dispatch persistence, byte bounds and zero retries; then retain three compatibility controls if the population gate can pass.
3. Freeze/runner/scorer/export: verify all 800 identities, 2,400 unique cells, shared 2,430 ceiling, corruption/restart rejection, bounded scheduling and independently recomputed public arithmetic.
4. Execute once after the gates; audit original outcomes, publish only the supported aggregate, run API/web tests, types, lint, builds and desktop/mobile browser checks.
5. Record an honest module handoff and roadmap status, with limitations and actual send accounting; commit verified cohesive checkpoints.

Ownership: population/diagnostics worker owns new population files; inference worker owns new research transport and the narrow response-parser type context; frontend worker owns the landing summary reader/component; root owns integration, execution, audit/export and documentation. No worker modifies the frozen 14b source/admission/checker policy.

## Operator commands

Use Bun 1.4.4. Run the private CLI from `apps/api`; this loads the configured development credential for `controls` and `run` without printing it. Source/reference operations pass only the existing isolated Python environment. All source data and provider evidence stay under ignored `apps/api/data/private/`.

```sh
bun src/deep-study/cli.ts prepare --source /Users/vanshgaur/projects/convexbench-reference --python /tmp/coconut-14b-generator-env/bin/python --output data/private/final-population-v1 --deadline 2026-11-08T18:56:00.000Z
bun src/deep-study/cli.ts replay --population data/private/final-population-v1/population.json
bun src/deep-study/cli.ts controls --accept-charges
bun src/deep-study/cli.ts freeze --population data/private/final-population-v1/population.json --review data/private/final-population-reference-review-v1.json
bun src/deep-study/cli.ts run --accept-charges
bun src/deep-study/cli.ts report
bun src/deep-study/cli.ts export --audit data/private/final-outcome-audit-v1.json --output data/private/final-landing-summary-v1.json
```

Do not run the paid commands until the population/review gate passes. Control and run starts are exclusive and non-resumable: existing immutable start/receipt artifacts reject repetition. The exporter writes a new artifact; root reviews it against reconstructed outcomes before replacing the landing JSON. A dead local lock can be removed with `unlock`; it does not resume paid work or clear receipts.

The deepest feasibility sweep retains all 64 batches, not selected successes. Final construction may use `preparePopulation({..., retainedBatchRoots: {512: <retained feasibility directory>}})` to copy byte-identical source receipts/batches/CSVs after validating the exact seed/configuration/environment. References and diagnostics are recomputed; no cached label is trusted. Its preliminary orchestrator hashes predate later admission/replay hardening, while the generator, Python environment and frozen mathematical checker remain unchanged. The final population binds the final implementation.

## A-15-01: offline construction bound, 2026-11-08 17:46 UTC

The complete original depth-512 sweep retained 768 proposals and independently verified 48 convex, 33 concave and 77 neither references. Its required quota is 33/34/33, so the original proposal bound is insufficient before duplicate/exposure checks. This is a reference-feasibility result, not a model-performance result.

Before any final population or new model send, increase the **final** per-depth proposal cap to 128 batches and version the final admission policy as `final-population-admission-v2`. Keep the seed formula, per-batch allocation, source configuration, exact displayed-function semantics, proof policy, deterministic first-admitted ordering, class quotas, eight requested depths, 800 cases and model budgets unchanged. Stop generation as soon as each quota is full. The absolute feasibility deadline remains 18:56 UTC; this amendment adds neither paid calls nor time beyond that bound.

The historical `deepest-source-feasibility-v1` remains a complete 64-batch/768-row measurement with immutable artifacts. Reuse its source batches only after byte/configuration/provenance checks and recompute all final proofs and diagnostics. Extending the offline proposal prefix addresses rejection rates without inspecting model answers, reducing a quota, weakening a certificate or claiming an observed failure. Any further construction change requires another named pre-freeze record.

### A-15-01/R1: retained-prefix correction

Before final freeze or any model send, the first v2 construction attempt was stopped after detecting that cache reuse assumed all 128 scheduled batches existed in the historical 64-batch cache. Retain that partial attempt. The corrected builder reads the cache's declared completed-prefix length, verifies and copies every batch inside that prefix, and generates the original scheduled seeds beyond it. A missing/corrupt batch inside the declared prefix still fails; it is never silently regenerated. Restart construction in a new private directory with the same absolute 18:56 UTC deadline and unchanged A-15-01 mathematics, ordering, population and send budgets.

Official compatibility references checked 2026-11-08: [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). The pinned SDK and existing isolated transport were inspected before selecting the separate research profile.
