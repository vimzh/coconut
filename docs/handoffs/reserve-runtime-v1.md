# Reserve runtime handoff

## Delivered

Implemented only `apps/api/src/reserve/`, `apps/api/data/suites/reserve-v1.json`, [the runtime documentation](../research/reserve-runtime-v1.md) and this handoff. Shared integration is owned separately. The implementation follows the [coordinator's decision](../research/conditional-reserve-decision-v1.md), without freezing or running an evaluation.

The deterministic constructor derives the exact degree-nine/ten source coefficients, fixed outer functions and all quadratic parameters. It does not load research JSON. Exact Bernstein covers, global bounds, strict interior witnesses and coarse-grid identities are recomputed independently of native automatic differentiation. Cached objects are limited to the fixed deeply frozen candidate/reference population; every replay makes a fresh native batch of 18.

All 18 exact references and complete native certificates match the unchanged research proposal, SHA-256 `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85`. Historical rejections remain research-only and do not enter the current 18/18 admission denominator.

Exports are `DEFAULT_RESERVE_REQUEST`, `getReserveRequest`, `parseReserveRequest`, `generateReserveSuite`, `validateReserveSuite`, `RESERVE_FAMILIES` and the reserve types. Fixed request: seed `coconut-reserve-exploratory-v1`, population `exploratory`, depths `[17,23]`, six cases per class and purpose `evaluation`.

## Identities and measured evidence

- Base suite: `suite-reserve-v1-54c719576846a0437a431372204593bd8ea47f4af99def6a654db4a93502e7c7`.
- Base file: 349,464 bytes; SHA-256 `2abd3bc34737a3bfed4e6ba28a67cb28dd42c26e8f92b96a8688cad399cd5d49`.
- Max-profile suite: `suite-reserve-v1-c4efdfed64c8ff0696db7c6f2bb2a85b8bf563bf253d84cd0547e62c7803b224`.
- Max-profile canonical SHA-256: `b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811`.
- Ordered reference/analytic membership fingerprint: `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`.
- 18 attempts, 18 accepted, zero current rejections; three families, six tasks per label, two related source clusters.
- Source-group depths 17/23; nodes 36–37/48–49; maximum 132 native cover leaves / 263 processed cells, unchanged 192-bit precision and limits.
- Single-process cold/warm generation samples: 1,048/759 ms. These are feasibility samples, not a repeated endpoint benchmark.

Nine same-family/same-label source pairs have identical native probe values. The new `native-probes-or-exact-source-value-v1` policy proves their function inequality exactly at `-15/16`, using `p1²=(289/256)p0²>p0²`, strict outer monotonicity and identical quadratic coefficients. Other pairs separate by native probes. This proves different functions and does not assert a general affine curvature-core separation result.

## Verification

- `bun test apps/api/src/reserve`: **12 passed, zero failed, 1,015 assertions**, 20.75 seconds.
- API lint, type checking and build: passed.
- CLI generated and fully replayed the retained artifact; tests reproduce its exact bytes and compare both profiles' identical cases/certificates.
- Tests cover exact source/numerator identities, global bounds, witness/domain membership, all nine coarse curvature probes, 16 grid-closed Jensen pairs per neither task, resource counts, immutable caching, fresh native replays, exact-anchor evidence/tampering, request/proof/accounting/order/getter rejection, incomplete/cancelled work, prompt privacy and CLI overwrite/UTF-8/32-MiB boundaries.
- Research proposal hash remains unchanged. No edits occurred in the old challenge/interior sources or historical suite artifacts. Diff checks passed, and new source/artifact scans found no prohibited provenance or credential references.

An initial test-spy recursion was corrected by retaining the original backend function before installing the spy; the complete focused group then passed. No production mathematics or artifact membership changed during that repair.

## Remaining coordinator work

Independent runtime review must separately inspect the constructor, exact-reference implementation and exact-anchor separation; the membership fingerprint alone does not claim that review occurred. Shared registry/types/API/quality/frontend integration belongs to its assigned owner. Any later experiment needs its own versioned profile-bound freeze, review and reconciled budget after the pending supplement settles.

This population remains adaptive, exploratory, unranked and ineligible for a confidence interval or inherited confirmation claim. No provider call, key/access-code read, database mutation, service restart, execution freeze, publication or commit occurred in this implementation.
