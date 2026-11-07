# Module 03 Handoff: Instance Generator and Suites

## Status

**Complete.** Generation, frozen-artifact reproduction, mathematical/protocol integration, repository checks, independent behavioral verification, and code review pass. D-04 is resolved; dependent modules can consume the frozen suite within the documented boundaries.

## Decisions and artifacts

D-04 is defined in the [technical plan](../plans/03-instance-generator-and-suites.md). The generator uses the existing mathematical verifier without changing its rules, supported operations, or overlap policy. The protocol remains unchanged.

- [Public interface](../../apps/api/src/suites/index.ts): `generateSuite`, `validateFrozenSuite`, `DEFAULT_SUITE_REQUEST`, `GENERATOR_VERSION`, `MAX_CANDIDATES_PER_CASE`, `SuiteInputError`, and suite/result types.
- [Candidates](../../apps/api/src/suites/candidates.ts): seeded families and exact family-specific function signatures.
- [Generator](../../apps/api/src/suites/generator.ts): strict requests, bounded attempts, verifier admission, measured depth, coverage, cancellation, identity, and immutable artifacts.
- [Manifest validation](../../apps/api/src/suites/manifest.ts): versioned regeneration and complete strict data comparison.
- [CLI](../../apps/api/src/suites/cli.ts): JSON generation/replay and exclusive file creation.
- [Frozen reference suite](../../apps/api/data/suites/reference-v1.json): actual private reference inputs and complete verifier certificates. This server-side data must not become a browser asset or a model request.

No dependencies, provider calls, credentials, scoring, HTTP endpoints, or frontend features were added.

## Reference suite

Format, generator, depth-policy, verifier, and protocol versions are all **`1`**.

Suite identity: `suite-v1-0149a94ef54c099effeaeca05959e310c7fddb8f56d6897e0cb37a759d055b41`.

Artifact size: **2,621,898 bytes**, including the final newline. File SHA-256: `cda38393d5b768bc77be0031daec4568b455d3c0774d8c109daaca3e62bd1e78`. The suite ID hashes the canonical manifest content; the file hash additionally binds the chosen JSON byte representation.

Exact request:

```json
{"seed":"coconut-reference-v1","depths":[5,10,20,40,80],"casesPerClass":5,"profileId":"one-shot-json-v1","purpose":"evaluation"}
```

| Actual depth | Convex | Concave | Neither | Maximum nodes |
| --- | --- | --- | --- | --- |
| 5 | 5 | 5 | 5 | 19 |
| 10 | 5 | 5 | 5 | 49 |
| 20 | 5 | 5 | 5 | 109 |
| 40 | 5 | 5 | 5 | 229 |
| 80 | 5 | 5 | 5 | 469 |

Total: **75 cases**, 25 per class, 15 per depth. Generation made **75 candidate attempts**, accepted all 75, and recorded **zero rejections**. Every case retains its actual canonical reference, measured depth, label, family, semantic signature, case identity, candidate coordinates, and exact verifier certificate.

Under the selected protocol this is **225 logical model calls**, with at most **450 transport attempts** and an aggregate requested output ceiling of **1,843,200 tokens**. These are workload ceilings; no such calls were made here. Both protocol profiles are supported as explicit request choices, and changing the selected profile changes suite identity.

## Generation and mathematical boundary

Supported requests use the fixed exact domain `[-1,1]`, every integer depth from **5 through 80**, and positive equal counts for each class/depth. Depths must be distinct and ascending. Seed syntax is 1–64 ASCII letters/digits/underscores/hyphens. Unknown fields, unsupported profiles, invalid depth/count/seed/purpose, empty coverage, and workloads beyond the profile's 1,000-instance cap fail before generation. Balanced requests therefore contain at most 999 cases. New domains or arbitrary families are not configurable in version 1.

Leaves have depth zero; each operation adds one to its greatest child depth. For convex/concave cases, affine tangent lines have depth two. A left-folded envelope of `n` lines has depth `n+1`, and the shared scalar/affine wrapper adds two. Thus two lines yield actual depth 5, and 77 lines yield depth 80. Every line is uniquely active at its distinct rational center, so increasing the line count adds actual pieces rather than inactive padding. Every accepted depth is measured again by the verifier.

Convex/concave cores use maximum tangent envelopes or minimum envelopes of negated tangents, with a scalar sign chosen for the requested class. Neither cases at depths 6–80 use `x` times an even envelope; depth 5 uses `x*abs(x+k)` with `abs(k)<1/4`. A common outer wrapper is used for all classes. Strict exact midpoint witnesses and the verifier's sufficient-curvature evidence establish labels; the candidate factory's intended label is never accepted by itself. Uncertain, excluded, rejected, or depth-mismatched candidates cannot enter a frozen suite.

## Identity, duplication, and incomplete results

Case identity hashes canonical expression/domain/label plus depth-policy and verifier versions. It excludes witness-search choices. A certificate fingerprint separately binds the complete canonical reference, including witnesses. Both remain in the artifact.

Duplicate detection uses canonical rational breakpoints and final degree-at-most-two polynomial coefficients on `[-1,1]`, merging equal adjacent pieces before hashing. This rejects equivalent generated functions even when max/min orientations or affine parameterizations differ. This equivalence policy applies to the supported generated families, not arbitrary symbolic expressions.

Suite identity binds all version fields, the complete request including purpose/profile, exact ordered cases and certificates, achieved coverage, and rejection summary. It has no timestamp. Changing expression, domain, label, order/membership, evidence, or policy cannot preserve an accepted frozen artifact. Retaining actual instances is mandatory; a seed alone is not an artifact.

Each requested case (class/depth/ordinal) allows at most 12 candidate attempts, for at most 12 times the requested instance count overall (11,988 at 999 cases). Failure counts retain verifier status/reason, depth or label mismatch, and duplicate-function rejection. Exhaustion returns `status: incomplete`, reason `attempt-limit`, actual partial cases and coverage, without a suite ID. Cancellation before or between candidates returns the same incomplete shape with reason `cancelled`. Cancellation is cooperative between bounded synchronous verifier calls. No underfilled or cancelled output is approved as frozen.

`validateFrozenSuite` regenerates the declared request and compares every retained field against trusted output, including identities, certificates, candidate coordinates, coverage, and rejected-candidate counts. It rejects extra/missing fields, altered data, malformed arrays/prototypes, and getters without reading their values. JSON property order is irrelevant. It returns fresh immutable verified data. The version-1 generation implementation must remain available while version-1 suites are supported; later algorithms require a new version rather than changing existing reproduction.

## Reproduction and integration

From the repository root:

```sh
bun run suite:verify --input apps/api/data/suites/reference-v1.json
bun run suite:generate --output /tmp/coconut-reference-v1.json
cmp apps/api/data/suites/reference-v1.json /tmp/coconut-reference-v1.json
```

Use a new output path: generation deliberately refuses to overwrite existing files. For a custom request, save the full five-field request as JSON and add `--request <json-path>`. The CLI replays validation before exclusively creating its compact JSON output. Malformed inputs or incomplete generation exit with an error and never print a successful suite identity.

An independent Bun subprocess regenerated the default artifact in a fresh temporary directory. The files were **byte identical**, including the newline, with the size and SHA-256 recorded above. Normal CLI replay also passed.

Modules 07/08 must pass only `case.reference` to `buildPrompt(reference, profileId)` and use its messages, format, and generation policy. Never serialize the `SuiteCase` or manifest into a model message. Keep labels/certificates/signatures/identifiers/coverage private. Default prompt sizes measured through the existing builder ranged from 920 to 3,534 UTF-16 code units across depths; these are character counts, not provider token counts or proof of endpoint context compatibility.

Public examples must use purpose `illustration` and be described as examples. A purpose change changes suite identity; the same seed still produces the same mathematical cases, so use a separate seed and inspect membership when disjoint illustrative material is required. An illustrative suite cannot establish measured model performance.

## Verification and review

- `bun test apps/api/src/suites`: **83 pass, 0 fail, 9,538 assertions** before the final per-case budget clarification. The later regression is included in the final full-project result below.
- `bun run test`: **212 pass, 0 fail, 11,077 assertions** across 12 files, including all **84** module 03 tests. Candidate checks independently verify 456 cases covering every depth 5–80 and all classes; the checked-in artifact's 75 certificates also pass full replay.
- `bun run lint`, `bun run typecheck`, and `bun run build`: **Pass** for API and web. Type generation and production build ran sequentially. Test-fixture type errors found during development were corrected; no remaining check errors or warnings were reported.
- `bun run suite:generate --output apps/api/data/suites/reference-v1.json`: **Pass**, creating the retained artifact with 75 accepted cases and no rejected candidates.
- `bun run suite:verify --input apps/api/data/suites/reference-v1.json`: **Pass**. Separate CLI generation into a fresh temporary directory reproduced identical bytes, suite identity, and file hash.
- CLI subprocess checks cover generation/verification, tamper rejection, exclusive no-overwrite behavior, malformed JSON, invalid arguments, missing files, and invalid request data.
- Coverage/failure checks include unsupported families/domains/profiles, invalid and empty requests, workload limits, all verifier failure categories, measured-depth/label mismatch, identical and equivalent reordered functions, attempt exhaustion, and cancellation before/during generation. Partial outputs retain actual coverage and never acquire an approved suite identity.
- Manifest checks alter expressions, domains, labels, witnesses, depths, membership/order, versions, identities, summaries, and certificates. Strict malformed/getter checks pass without invoking accessors. Prompt integration passes both profiles while excluding private reference evidence.
- Independent behavioral verification rechecked all 75 certificates, actual depths, domains, case/function uniqueness, byte reproduction, request rejection, tampering, cancellation, both-profile prompt privacy for all cases, and the 225-call/450-attempt workload. **Verified**.
- Independent code review found ambiguous plan wording for the candidate-attempt budget. The plan now explicitly states a per-case limit, the public constant is `MAX_CANDIDATES_PER_CASE`, and a 39-case regression proves support for class/depth groups larger than 12. Re-review passed 20 generator tests and frozen replay/reproduction, with **no remaining actionable findings**.

Checks ran on macOS with Bun **1.4.4** and Node.js **24.22.1**. No browser, HTTP, live-provider compatibility, model result, or score is claimed by these offline checks.

## Limits and downstream handoff

Increasing these depths also increases expression length and the number of active pieces. Associative rebalancing can reduce nesting without changing the function. The suite therefore does not isolate depth as a causal variable, and visible operators may make classification straightforward. Reproducibility and certified labels do not demonstrate useful frontier-model difficulty; G-SIGNAL remains module 08's live-evidence gate.

Only the documented scalar, exact-rational piecewise families and fixed domain are generated. No logarithmic, exponential, multivariate, user-supplied expression, provider compatibility, or measured model-performance support is claimed. Later family/policy changes require a newly identified suite and the relevant mathematical evidence.

- **04:** Consume labels and actual depths while preserving invalid/incomplete outcome distinctions from module 02.
- **08:** Execute only a validated complete frozen suite, retain its exact identity/membership, and preserve all trial/attempt outcomes. Incomplete generation is not execution input.
- **10:** Include exact suite identity and profile in comparability/eligibility decisions; do not group different memberships as equivalent.
- **11:** Explain the actual families/depth confound, use purpose-labelled examples, and make no measured failure claims until G-SIGNAL has evidence.
