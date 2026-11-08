# Reserve runtime, version 1

## Decision, scope and ownership

This implements the coordinator's [decision at 2026-11-08T09:20:00.911Z](conditional-reserve-decision-v1.md), following the explicit [operational amendment](conditional-reserve-operational-amendment-v1.md) and both completed P5 cells. The original absolute absence condition remains unproved because eleven baseline remote outcomes remain unknown. The amendment/decision preserve that missing evidence and change no D-12 threshold.

This checkpoint adds only a deterministic reserve constructor, exact independent reference calculations, native admission/replay, CLI, tests and the separate base suite artifact. It performs no model inference, execution freeze, service restart or publication. Shared API/registry/quality/frontend integration and any later experiment belong to the coordinator and its integration owner. No paid work is authorized by a runtime artifact.

The coordinator's current sequencing decision places the separately frozen o3 supplement before any reserve execution; its actual-send accounting and conservative future ceiling govern that later decision. The older research JSON retains its historical budget/condition text unchanged and is not consulted for runtime execution permission or mathematical membership.

## Fixed population and reconstruction

The runtime population is exactly the unchanged [conditional reserve](conditional-reserve-v1.md): **18 tasks, three families, two related source groups, three labels**. All domains are `[-1,1]`. Each source group contains nine related tasks across the three families and labels, giving **two shared clusters**. This remains exploratory and unranked, with no eligible confidence interval or inherited confirmation status.

The constructor derives source coefficients using exact rational polynomial products:

```text
p0(x) = 4 product(k=0..8)(x-(-1+k/4)),
p1(x) = (x-1/8)p0(x).
```

The Horner renderer omits zero additions. For each source, the fixed functions and quadratic coefficients are:

| Family | Function | Convex `a` | Concave `a` | Neither `a` |
| --- | --- | ---: | ---: | ---: |
| `reserve-logarithm` | `log(1+p²)+a x²` | `2` | `-8` | `1/64` |
| `reserve-reciprocal` | `1/(1+p²)+a x²` | `8` | `-2` | `-1/64` |
| `reserve-square-root` | `sqrt(1+p²)+a x²` | `1` | `-4` | `1/64` |

Runtime construction imports no research JSON and cannot accept arbitrary membership or parameter changes. Tests separately compare all 18 exact references and full native certificates against the research proposal, raw SHA-256 `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85`. Its bytes remain unchanged.

The new generator is `reserve-v1`, format `2`, depth policy `measured-operation-v1`, verifier `arb-jet-v1`, protocol `1` and prompt `smooth-v2`. Its fixed request has seed `coconut-reserve-exploratory-v1`, population `exploratory`, depths `[17,23]`, six cases per class and purpose `evaluation`. A registered profile is the only request variation.

## Independent proof implementation

Write `u=1+p²`, `v=p'` and `w=p''`. The code constructs the separately derived polynomial numerators

```text
Nlog = 2[(1-p²)v²+p u w],
Nrec = -2[(1-3p²)v²+p u w],
Nsqrt = v²+p u w.
```

The corresponding base curvatures divide these by `u²`, `u³` and `u^(3/2)`; the quadratic term adds `2a`. Every argument/denominator is at least one, proving smooth-domain validity independently of interval automatic differentiation.

An exact power-to-Bernstein conversion on `[-1,1]`, followed by midpoint de Casteljau restrictions, recomputes the six degree-34/38 numerator covers. The covers are fixed six-cell or seven-cell complete partitions, matching the independently checked research construction. They do not introduce an adaptive admission search, new operation, new native rule or higher precision. An enclosure outside its required coarse bound fails explicitly.

Because each denominator is at least one, the checked signed numerator bounds also bound the base curvature. Adding `2a` gives these conservative global enclosures across both sources:

| Family | Convex second derivative | Concave second derivative |
| --- | --- | --- |
| Logarithm | `[1/16,619/32]` | `[-319/16,-21/32]` |
| Reciprocal | `[21/32,319/16]` | `[-619/32,-1/16]` |
| Square root | `[1/32,619/64]` | `[-319/32,-21/64]` |

All six neither cases independently check strict interior witnesses at `0` and `-15/16`. Logarithm/reciprocal values are exact rationals. Square-root values use `1<=sqrt(u)<=u` with the correct signed-division direction, giving rational lower and upper enclosures. Only neither analytic certificates retain point witnesses; convex/concave certificates retain strict global bounds and an empty witness array. The independent policy is `reserve-bernstein-v1`.

The constructor also checks that the two source polynomials vanish at all nine fixed coarse points and that each neither case's coarse curvatures have one common strict sign. This is a proved diagnostic property, not a global classification certificate or evidence that a model will fail. Grid-closed Jensen facts and their scope remain in the research record and focused tests.

Only the fixed, deeply frozen mathematical candidate population is cached. Request validation, all 18 native admissions, separation checks and complete artifact comparison run on every generation/replay. Successful certificates retain unchanged 192-bit precision and native bounds. Single-process feasibility samples measured 1,048 ms cold and 759 ms warm; these are not a repeated throughput or endpoint benchmark.

## Exact separation where native probes coincide

There are **nine same-family/same-label cross-source pairs** with identical values at every fixed native probe: three families × three labels. Native probe inequality cannot establish their distinctness, and the runtime does not claim otherwise.

At the fixed rational anchor `x=-15/16`, exact coefficient evaluation gives

```text
p0(x)² > 0,
p1(x)² = (289/256)p0(x)² > p0(x)².
```

For `s>=0`, `log(1+s)` and `sqrt(1+s)` are strictly increasing, while `1/(1+s)` is strictly decreasing. The compared source cases have the same family and quadratic coefficient, so these strict inequalities prove different function values at the anchor. Runtime canonical AST reconstruction and native input matching bind each compared operand to that proof. Other pairs separate by disjoint native value probes.

The suite records `distinctness: native-probes-or-exact-source-value-v1` and regenerated `exactSourceSeparation` evidence: policy `strict-monotone-outer-v1`, anchor, both exact squared values, ratio and outer monotonic directions. Changed evidence fails full replay. This is a sufficient proof of different functions, not a general decision procedure for semantic equivalence or affine curvature-core transformations.

## Artifact, profiles and replay interface

The base artifact is `apps/api/data/suites/reserve-v1.json`:

- ID: `suite-reserve-v1-54c719576846a0437a431372204593bd8ea47f4af99def6a654db4a93502e7c7`.
- Raw SHA-256: `2abd3bc34737a3bfed4e6ba28a67cb28dd42c26e8f92b96a8688cad399cd5d49`.
- 349,464 bytes including final newline; profile `one-shot-json-v1`.
- 18 current attempts, 18 admitted, zero current rejections; two cases per family/label and six per label overall.
- Source-group depths 17 and 23; nodes 36/37 and 48/49 respectively; at most 132 native cover leaves / 263 processed cells.

The max-profile reconstruction has ID `suite-reserve-v1-c4efdfed64c8ff0696db7c6f2bb2a85b8bf563bf253d84cd0547e62c7803b224` and canonical SHA-256 `b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811`. Its mathematical cases, IDs, clusters, independent references and native certificates equal the base profile's; profile-bound suite identity changes.

The canonical fingerprint of ordered `{family,reference,analyticCertificate}` records is `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`. This identifies the material to independently review. The implementation itself does not confer independent-review approval, human approval, confirmation coverage or model-performance evidence.

Exports from `apps/api/src/reserve/index.ts` are `DEFAULT_RESERVE_REQUEST`, `getReserveRequest(profileId)`, `parseReserveRequest`, `generateReserveSuite(input?,signal?)`, `validateReserveSuite`, `RESERVE_FAMILIES` and the reserve types. The request and suite shapes follow the existing interior interface; historical research revisions are deliberately absent from runtime attempts and coverage.

```sh
bun apps/api/src/reserve/cli.ts verify --input apps/api/data/suites/reserve-v1.json
bun apps/api/src/reserve/cli.ts generate --output /tmp/coconut-reserve-new.json
bun apps/api/src/reserve/cli.ts generate --profile one-shot-json-v2-max --output /tmp/coconut-reserve-max-new.json
```

The CLI requires a new output path, bounds inputs at 32 MiB and rejects malformed UTF-8. Replay reconstructs the fixed mathematics and native certificates, then compares all retained fields. Extra/missing fields, changed requests, domains, labels, proofs, accounting, exact-anchor evidence, order and accessors fail without executing getters. Cancelled or unverified work retains explicit attempts and never receives a successful suite identity. Returned objects are deeply frozen.

## Verification and limits

Focused verification covers all 18 original proposal references/certificates, six exact derivative numerator identities, all global signs and strict interior witness bounds, nine misleading coarse probes, 16 grid-closed Jensen pairs per neither task, two shared clusters, measured depth/nodes/resources, exact separation of the nine probe-collision pairs, profile identity, immutable proof caching with fresh native replay, strict tamper/getter/request checks, incomplete/cancelled outcomes, prompt privacy and CLI overwrite/decoding/size boundaries. API lint, type checking and build are also run; final check counts and any integration limitations belong in the handoff.

The historical 20 label mismatches and 53 resource-limited spectral outcomes remain in the [durable research history](conditional-reserve-v1.md), outside the 18 current admissions. No reference was replaced after model outcomes on this population; none exist at this implementation checkpoint. The three families, two related source groups, deliberate probe-grid alignment and visible quadratic coefficients limit generalization. No confidence interval, ranked comparison, inherited confirmation status, guaranteed failure or stronger G-SIGNAL verdict follows.
