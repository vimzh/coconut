# Module 14 handoff: offline challenge and quality criteria

## Status and delivered boundary

**Offline criteria, challenge generation, quality automation and independent reporting checks are implemented. G-QUALITY is No-go for the incomplete original experiment; suite-only offline quality is Go within its declared scope.** D-12 and the family-balanced confirmation population remain frozen. No completed model-failure experiment, human expert approval or final readiness is claimed. Later replications require separate retained evidence.

The [technical plan](../plans/14-benchmark-quality-and-pitfall-remediation.md) and frozen [quality criteria](../research/quality-criteria-v1.md) define the checks and claim restrictions. [Challenge design](../research/challenge-design-v1.md) records the exact formulas, parameters, domains, independent derivative inequalities, polynomial identities and remaining limits. The criteria were frozen before this author inspected any model-evaluation result.

## Implemented artifacts

- `apps/api/src/challenge/types.ts`: separate format-2 challenge contracts, parameter clusters, analytic certificates and family coverage.
- `algebra.ts` / `candidates.ts`: exact independent references, fixed eight-family populations, rational exponential-series bounds, expanded curvature-polynomial construction and measured structure.
- `suite.ts` / `index.ts`: generation, strict requests, all-attempt retention, incomplete outcomes, native admission, domain-aware distinctness, immutable artifacts and full regeneration.
- `cli.ts`: bounded UTF-8 JSON input, generation/replay and exclusive output creation.
- `challenge.test.ts` / `cli.test.ts`: analytic identities, label/family coverage, native certification, held-out groups, profile-bound identities, prompt privacy, replay/tamper/getter checks, unresolved/cancelled work and CLI boundaries.
- `apps/api/data/suites/challenge-v1.json`: retained 72-case confirmation suite.

No existing numerical AST, verifier, smooth generator or historical artifact was changed by this workstream. Shared suite dispatch and execution/report integration belong to the main coordinator. The existing scorer's profile binding must remain intact: regenerate a separately identified artifact for each selected profile rather than relabeling an existing artifact.

## Population and identity

Confirmation contains **72 tasks / 24 parameter clusters / eight broad families**, with three tasks per family/label. All 72 candidates passed independent analytic sign/identity checks and the existing Arb certifier; no candidate was replaced and no rejection was discarded. The separate nine-case screening population uses three held-out parameter clusters and is reproducible through the same API/CLI. Screening is exploratory and is not a substitute for all 72 confirmation tasks.

Retained suite ID: `suite-challenge-v1-6a1bf3255f8104661db7ce0ae4f3be4182e8ac3b8b9240774aacfc339e433dd9`.

File SHA-256: `4e728837536ea9ca8500f3f612c642c937c7424411097190de9e7f392b7991e6`; **733,277 bytes** including final newline. Mathematical/native/prompt and independent-policy identities are listed in the design record. Default artifact profile is historical `one-shot-json-v1`; changing profile changes suite identity but leaves mathematical cases/clusters unchanged.

Actual depths are **3/4/5/6/14**, with per-label counts **12/3/3/3/3**. Expression depth follows the existing leaf-zero convention. Candidate trees contain no arbitrary affine-output wrapper or zero-addition padding. The integrated-polynomial family uses real degree-ten algebraic structure, not a target-depth loop. Native limits remain unchanged.

Distinctness policy is `domain-or-disjoint-value-enclosures-v1`: differing intervals define distinct tasks; same-domain pairs require certified disjoint value enclosures at a retained common point. Domain variants of a function share a cluster. This does not claim arbitrary symbolic inequivalence or independent family generalization.

## Quality findings and claim restrictions

| Finding | Evidence / outcome | Restriction or repair |
| --- | --- | --- |
| Existing smooth family/label confound | Seven legacy tags split neither from the other classes; counts retained in D-12. Verified diagnostic warning. | Historical artifacts remain descriptive baselines. New challenge represents all three labels in all eight families. |
| Function inequality insufficient for task diversity | Existing distinctness can be satisfied by affine output changes. Verified policy limitation. | New challenge has no such presentation wrappers; retain domain/parameter cluster identities and report effective support. |
| Structural depth confounded | New family choice, size, coefficient structure and domain vary with depth. Accepted scoped limitation. | Descriptive depth plots only; no causal depth or guaranteed hardness claim. |
| Correlated mathematical checker risk | Independent AI-assisted review rederived all eight families, checked 96 coordinates, 64 witness enclosures and 12 polynomial identities; native full replay remains separate. | Review is AI-assisted, not human expert approval; applicability is bound to exact reviewed mathematics. |
| Reference metadata leakage | All 81 generated confirmation/screening tasks pass model-prompt privacy tests. Offline check passed. | Actual outgoing provider bodies and browser/public exports still need integrated inspection. |
| Selection and incomplete certification | Fixed candidates, exact attempts/references, no replacement, unverified/cancelled fixtures retain incomplete status without approved identity. Offline check passed. | No post-result edits to confirmation membership; new designs need new versions. |
| Statistical/comparison/format evidence | D-12 fixes clustered support, uncertainty and mathematical-error criteria. Original live evidence is incomplete; quality reports preserve unavailable intervals and separate infrastructure. | No ordering or model-failure finding; run-level G-QUALITY and G-SIGNAL remain No-go for the original experiment. |
| Practical relevance and provider coverage | Bounded synthetic scalar population; no domain expert or non-OpenAI live inference supplied here. Missing evidence. | No production-usefulness or cross-provider availability claim. |

## Verification

The final focused challenge run passed **15 tests / 5,084 assertions**. The completed root verification run passed **570 tests / 23,804 assertions across 39 files**, including the new frozen-artifact and explicit-effort profile checks. Root lint, type checking and API/web production builds passed; type generation/build ran sequentially. Confirmation CLI generation/full replay, documentation link checks and `git diff --check` passed. Explicit historical exact, smooth-v1 and smooth-v2 replay commands passed with their original identities. One unused test import found by the initial lint run was removed; subsequent API and root lint runs passed.

These results are a checkpoint of a shared working tree while other modules are implemented, not a claim that later concurrent changes have been verified. The new challenge work did not edit historical artifacts, the native service or existing generator/verifier source.

The native feasibility checks certified all 72 confirmation cases and all nine screening cases. Single generation observations were approximately 418 ms and 107 ms including native startup; these do not establish deployment throughput or model difficulty. Analytic checks also cover the unused fourth parameter group in every family as boundary assurance; it does not enter confirmation.

Reproduce from the repository root:

```sh
bun test apps/api/src/challenge
bun apps/api/src/challenge/cli.ts verify --input apps/api/data/suites/challenge-v1.json
bun apps/api/src/challenge/cli.ts generate --population screening --output /tmp/coconut-screening-new.json
bun run test
bun run lint
bun run typecheck
bun run build
git diff --check
```

New output paths are required. New reasoning profiles are implemented by their separate owner; profile integration does not change historical default identities. No provider inference, secret reads, or commits were performed in this workstream.

## Remaining gates and owner handoff

The subsequent offline-audit implementation now supplies `apps/api/src/quality/`: structural/equivalence diagnostics, coverage/clusters, canonical prompt and report replay, explicit outcome accounting, whole-cluster conditional uncertainty, pinned experiment/capability/transcript checks and machine-readable findings. A separate AI-assisted review rederived all eight families and checked 96 supported coordinates; see [independent challenge review](../research/independent-challenge-review-v1.md). This addresses the earlier pending independent mathematical-review work within its stated scope and does not claim human approval.

The [independent reporting audit](../research/reporting-audit-v1.md) checked all 212 original retained reports. Their 7,236 planned trials contain 214 correct included answers and 7,022 provider errors; three reports are provisional and 209 unavailable. All 212 quality reports give No-go with `complete-trials` and `outcome-inspection` blockers. No wrong valid label was observed, so G-SIGNAL is No-go for a mathematical-failure finding. The [suite quality report](../../apps/api/data/quality/challenge-v1.quality.json) passes the offline admitted-reference/coverage checks; it cannot stand in for a completed experiment.

The new offline CLI supports `suite|run --input <file> --output <new-file>` with 128 MiB pre-read/streamed input bounds, strict UTF-8 and exclusive private output. Existing reports and source runs are never overwritten. Current focused quality verification passes 29 tests / 139 assertions; API lint, type checking and bundle passed. The original retained evidence, arithmetic aggregate and relevant Go/No-go reports are linked in the audit record. A browser projection retention mismatch found during reporting review was returned to the integration owner and repaired; final browser evidence remains part of integration.

These results update the earlier checkpoint below: artifact dispatch, run integration, frozen manifests, offline quality reports and independent review now exist. The remaining work is complete actual execution, applicable failure/outcome review, final integrated privacy/comparison/browser checks, any external provider verification, and reassessment against the frozen criteria. Missing execution evidence cannot be accepted as a scope limitation for a complete benchmark finding.

The coordinator must preserve the implemented dispatch, scorer/profile bindings and original frozen manifest, then complete and retain any separately recorded experiment, inspect every outcome relevant to its claims, verify outgoing/public boundaries and reassess G-QUALITY. This handoff does not certify current inference permission or supported effort metadata. No later run may silently replace the original failed cell or inherit its audit verdict.

Any analytic/native discrepancy, leak, invalid reference or unfair comparison is a blocker. Strong model performance is compatible with a useful correctly implemented evaluation, while a failure claim still requires D-12 evidence. Missing provider/expert/live evidence cannot be replaced by these offline checks. Modules 09–11 may consume the verified population and claim restrictions now; final readiness remains conditional on the complete gate evidence.
