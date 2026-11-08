# Interior curvature exploration handoff

## Delivered

Added the separate `interior-v1` generator, strict replay validator, CLI and fixed 72-task artifact under `apps/api/src/interior/` and `apps/api/data/suites/interior-v1.json`. Existing challenge/smooth generators and artifacts were not edited by this work. The [plan](../plans/interior-curvature-v1.md) and [design](../research/interior-curvature-design-v1.md) define the formulas, scope, exact independent proofs and retained rejected domains. The separate [AI-assisted independent review](../research/independent-interior-review-v1.md) records its evidence and limits; it is not human expert approval.

Exports from `apps/api/src/interior/index.ts` are `generateInteriorSuite`, `validateInteriorSuite`, `getInteriorRequest(profileId)`, `parseInteriorRequest`, `DEFAULT_INTERIOR_REQUEST`, `INTERIOR_FAMILIES` and the interior types. Requests are fixed to population `exploratory`, purpose `evaluation`, seed `coconut-interior-exploratory-v1`, depth `[13]` and 24 cases per class. Registered profiles bind artifact identity without changing mathematical cases.

The three families compose a dense quintic with logarithmic, reciprocal and softplus functions. Independently derived degree-18 numerator identities and Bernstein bounds establish the logarithm/reciprocal global signs. The softplus bracket uses separately bounded polynomial derivatives and a degree-40 exponential series with a rigorous tail. All 24 neither cases have strict interior witnesses at `0` and `1/3`; endpoints and midpoint agree in sign, so those three samples miss the opposite interior sign. Convex/concave certificates have no point witnesses and retain strict global enclosures.

There are **eight shared source-polynomial clusters**, each containing nine related tasks across all three families and labels. The three-family/eight-cluster population is exploratory and unranked, with no eligible confidence interval or broad/general failure claim. Earlier quality criteria remain unchanged.

## Artifact identity and admission

- ID: `suite-interior-v1-99c5b377b79244e5c5e7e267548964a14fb1ae64eb92998d44166024dcf5d10c`.
- SHA-256: `f49f03f130bd4b54351e4e7ab9a4674e5208565686d18519f4a729aef4e07da8`.
- 728,408 bytes including final newline; default profile `one-shot-json-v1`.
- 72 current attempts, 72 accepted, zero current rejections; eight cases per family/label.
- Operation depth 13 for every case; 25 nodes for logarithm/softplus and 26 for reciprocal; at most ten native cover leaves.
- Eight rejected historical reciprocal-concave domains `[1/2,5/8]` remain separate in `designRevisions`, each with replayed `rejected:label-mismatch`, actual label neither and independent strict interior witnesses. The final concave domain is `[17/32,5/8]`. Generation/validation performs 80 native checks including this history.

Only the fixed, deeply frozen candidate/reference population and eight historical mathematical proof objects are cached, without caller-controlled keys. Requests, all current native admissions, all historical native rejections, distinctness checks and full canonical comparison execute on every generation/validation. Single-process generation samples changed from 3,953/4,038 ms before caching to 4,458 ms cold and 312 ms warm afterward. These are feasibility samples, not an endpoint or repeated throughput benchmark.

## Verification

- `bun test apps/api/src/interior`: **11 passed, zero failed, 4,533 assertions**, 28.31 seconds after caching. Includes exact identities, independent series/zero-boundary checks, all 72 admissions, scoped witnesses, all eight wrong historical domains rechecked as neither, same-domain distinctness, immutable proof caching, native replay on every warm generation, profile separation, getter/tamper/order/history rejection, incomplete admission/cancellation, neutral prompts and CLI overwrite/UTF-8 handling.
- `bun run --cwd apps/api lint`: passed.
- `bun run --cwd apps/api typecheck`: passed.
- `bun run --cwd apps/api build`: passed.
- CLI generated the retained artifact and independently replayed it before writing. Tests reproduce its exact bytes through full validation. Its hash remains unchanged after the cache optimization.

## Remaining coordinator work and limits

The coordinator owns central artifact dispatch, suite registry, public/UI types, exploratory publication/eligibility, experiment manifests and any future provider calls. This implementation made no paid calls, read no credential and created no commit. Independent review does not establish model difficulty; later outcomes must retain the exploratory designation and all denominator/attempt evidence. No native verifier limit, operation or precision was changed.
