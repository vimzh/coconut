# Module 14 technical plan: benchmark quality and pitfall remediation

## Scope, readiness, and decision

Read the product idea, roadmap, full module 14 requirements, mathematical/protocol/generator/scoring/provider handoffs, numerical extension, prompt adaptation, current candidate factories, suite replay, prompt construction, and native certification rules before this plan. Modules 07/08 are parallel prerequisites; their unfinished inference/run evidence is not assumed complete.

**D-12 is resolved by [quality-criteria-v1](../research/quality-criteria-v1.md)**, frozen on 2026-11-07 at 19:52 UTC before the author saw model-evaluation results. Record its final file hash in each confirmation manifest. G-QUALITY remains unresolved until the implemented checks and actual run evidence are reviewed. This documentation task makes no inference calls and does not claim module completion.

Two implementation choices were considered. Auditing the existing 27 smooth cases is the smallest regression/baseline path, but it cannot remove their family/label confound or create broader independent coverage. A separate, family-balanced challenge suite can address those limitations while retaining historical versions; it needs new generator/suite identity and parameter/reference review. Use the existing suite for descriptive and integration evidence, and the separately frozen challenge for any richer capability claim. No construction is promised to defeat a model.

## Ownership and interfaces

Current bounded ownership is this plan and the new criteria document only. No application code, existing module document, shared scorer, historical artifact, inference adapter, or commit is changed by the documentation author. The main coordinator assigns later source ownership; active agents must preserve one another's edits.

Proposed implementation boundaries:

| Workstream | Owner boundary | Reused contract / expected result |
| --- | --- | --- |
| Offline audit/report | New `apps/api/src/quality/` and focused tests; coordinator assigns author | Read strict validated suite/report/evidence snapshots. Emit bounded findings and coverage/cluster/structural summaries. No provider client or key access. |
| New challenge candidates | Numerical generator owner; separate generator version and new immutable artifact | Existing supported AST/native certificate contract; exact independent family references; retained attempts, failures, identities and transformation groups. Preserve old replay byte-for-byte. |
| Inference/settings | Module 07 owner | Explicit settings/profile identities for reasoning-effort cells, faithful request/response evidence, cancellation and limits. No changes to historical default-profile behavior. |
| Scheduling/experiments | Module 08 owner | Freeze suite/matrix/settings/budget before confirmation. Preserve all case × trial × attempt outcomes and exposure history. |
| Metric repair | Module 04 owner only if a demonstrated defect exists | Shared counts/denominators; quality code consumes these rather than introducing a competing score policy. |
| UI/leaderboard/methodology | Modules 09–11 | Consume finding/gate status, coverage, uncertainty, completeness, and comparison restrictions. |

An offline report should contain exactly: report/policy identity; hashes of input suite/evidence/report and criteria; reviewed population; requested/achieved coverage; class/family/depth counts; task/cluster/equivalence support; structural diagnostics; candidate acceptance/rejection/uncertainty counts; comparison settings/completeness; uncertainty method/result or an unavailable reason; finding ledger; reviewed claims; review records; and G-QUALITY verdict with blockers. No credential, raw provider diagnostics, or hidden reference information belongs in public exports.

Each finding needs a stable identifier, category, severity (`critical`, `warning`, `missing-evidence`), status (`passed`, `repaired`, `accepted-scoped-limitation`, `unresolved`), exact instance/run/attempt identifiers, evidence, responsible module, repair/version record, verification result, and any claim restriction. A hash alone does not establish the contents were validated. Reviewed mathematical references record reviewer role, exact examples/identities, argument and limits; model-assisted review is labeled.

## Sequenced implementation and checks

1. **Bind trusted inputs.** Reuse complete suite validation/certificate replay and scorer evidence validation. Reject wrong identities, malformed input, invalid references, injected getters/extra fields, and oversized work before report creation. Check: historical exact and both smooth artifacts replay; corrupt/tampered fixtures fail; no keys are read.
2. **Audit current coverage and transformations.** Count family/label/depth support, raw/simplified structure, repeated subtrees, exact supported function signatures, pairwise separation, affine/scalar/reflection controls, and unknown equivalences. Use justified finite rewrite rules only; never mutate the evaluated expression. Check: duplicate and affine-offset fixtures are detected; a distinct independently checked function is accepted; unsupported equivalence remains unknown. Publish the existing seven-tag family/label confound as a warning.
3. **Create independently reviewed richer candidates.** Implement a separate generator identity only after agreed ownership. Prefer family-balanced threshold/competition and expanded-curvature polynomial families documented in the criteria. No target depth padding. Freeze parameter boxes and seeds before model outcomes; keep every rejection. Check: three label regimes per family, independent derivative/coefficient identities, domain boundaries, strict witnesses, narrow reversals, and resource exhaustion. Preserve old artifacts and report achieved coverage.
4. **Inspect actual request privacy and comparison settings.** Module 07/08 fixtures capture outgoing bodies and ensure only expression/domain instructions and allowed settings appear. Add metadata sentinels for labels/certificates/order/family/signatures, and compare requested versus returned identities/settings. Check: injected reference metadata is detected; enum label text is accepted; unsupported effort/schema/budget cells fail explicitly without substitution.
5. **Run controlled outcome/confound fixtures.** Reconcile correct/wrong labels, malformed/empty/conflicting JSON, refusals, truncation, interruptions, provider errors, missing trials, retries, changed routing and unmatched ceilings. Check: every category enters the declared denominator; complete model errors never gain a retry; format-only outcomes cannot create a mathematical-failure claim. Independently reproduce majority-only, imbalanced and zero-support metrics through the shared scorer.
6. **Freeze and execute the actual experiment.** Before the first confirmation request save suite/hash, criteria/hash, dated model inventory, supported effort matrix, primary contrast if any, seeds, settings, attempt/token/concurrency/deadline limits, and exploration exposure. Current OpenAI-only development authorization persists; compatibility probes are separate from evaluation. Check: one fresh request per task/trial, bounded observable retries, complete planned records, cancellation evidence, and no development credential in visitor paths or artifacts.
7. **Analyze retained evidence and review failures.** Use cluster-preserving, family-stratified paired resampling under D-12 only when the declared support/completeness thresholds pass. Review every wrong/unusable outcome relevant to claims and independently check every claimed failure reference. Check: repeated trials and affine variants cannot inflate effective support; sparse/incomplete populations yield unavailable intervals; paired comparisons cannot silently drop failed work.
8. **Repair and finalize gates.** Route concrete defects to the existing owning module, add focused regressions, version changed artifacts/contracts, invalidate affected eligibility, then regenerate reports from retained safe inputs. Check: every pitfall has an outcome and supported claim wording; critical defects block Go; model success alone does not fail G-QUALITY. Record G-SIGNAL independently under its frozen mathematical-failure criterion.

## Bounds and performance

Use existing certification limits unchanged. Audit at most 256 cases and 32,640 pairs; report unknown unsupported equivalence instead of adding an unbounded symbolic engine. Cap report output at 16 MiB. Resampling uses 10,000 seeded replicates over already validated scalar outcomes, with no native subprocess or inference inside the loop. Time cold certification, batched certification, full replay and audit/resampling separately, retaining environment, all timings, coverage and rejected cases. Candidate certification speed does not imply model difficulty or hosted throughput.

The new confirmation target is 72 held-out cases; the predeclared 36-case floor in D-12 applies only to a visibly narrower challenge claim. Final membership is frozen independently of model outcomes. Screen every actual text-LLM ID and documented supported reasoning effort on a separate nine-case balanced suite with three trials; select the confirmation frontier subset from dated metadata/documentation and inference permission before screening scores are inspected. Aliases/snapshots remain distinct requested IDs and are not independent model architectures.

The shared initial ceiling is 8,192 charged inference attempts, conservatively counting every send if billing is unknown, with concurrency at most twelve, 180 seconds per inference attempt and 20 seconds per metadata operation. No SDK automatic retry. New reasoning profiles use 16,384 output tokens at every effort, binding format, effort and ceiling separately. One 72-case three-trial confirmation cell needs 216 calls and has a 3,538,944-token requested output ceiling before explicit retries; one nine-case screen cell needs 27 calls. Preserve historical 4,096 profiles. Larger caps require new profile identities and separate analyses. Incomplete matrix cells retain their planned denominator and reason; budget exhaustion is not mathematical failure.

## Verification commands and records

For this documentation checkpoint, verify links, mathematical identities against the formulas, artifact-derived counts, preserved ownership, and `git diff --check`. The local feasibility checks already classified 27 table examples and tested the expanded-polynomial margin boundary using the existing Python worker; they did not change source, persist a provider credential, or call a model. Their one-shot timings are observations only.

For subsequent implementation, run the existing commands from the repository root:

```sh
bun test apps/api/src/quality
bun test apps/api/src/numerics apps/api/src/protocol apps/api/src/scoring
bun run numerics:test
bun run numerics:lint
bun run suite:verify --input apps/api/data/suites/reference-v1.json
bun run numerics:verify --input apps/api/data/suites/smooth-v1.json
bun run numerics:verify --input apps/api/data/suites/smooth-v2.json
bun run test
bun run lint
bun run typecheck
bun run build
git diff --check
```

The first command applies once the proposed quality module exists. New challenge generation/replay and quality-report CLI commands must be added by their implementation owners and recorded exactly in the handoff; they do not exist at this planning checkpoint. Keep type generation/build sequential. Request independent mathematical and behavioral review after concrete code and artifacts exist, and distinguish fixture, live-provider, mathematical and expert-review evidence.

## Handoff and current blockers

The final `docs/handoffs/14-benchmark-quality-and-pitfall-remediation.md` must identify reviewed artifact/run versions, frozen experiment and criteria hashes, report/finding paths, independent-review roles and limits, repairs and invalidated versions, exact command outcomes, exposure history, uncertainty populations, claim restrictions and G-QUALITY verdict. Existing documentation is not a fabricated gate pass.

At this planning checkpoint, source implementation, an independently reviewed family-balanced challenge artifact, the frozen live matrix/budget, complete module 08 evidence and final review are outstanding. OpenRouter/Hugging Face inference remains outside authorized development testing; anonymous catalogs and fixtures do not resolve those provider gates. Product implementation can proceed independently, while failure claims and final readiness remain subject to the recorded evidence.
