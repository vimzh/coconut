# Independent review of the exploratory interior population

**AI-assisted review; no human mathematical approval.** Performed on 2026-11-08
against the exact worktree artifacts and source hashes recorded below. This is an offline reference
review, not an inference run, model-performance result, or approval to rank the
new population.

## Reviewed inputs and scope

| Input | SHA-256 |
| --- | --- |
| `/tmp/coconut_dense_candidates_and_certificates.json` | `b2bb4ee2fbb1bbd0ac1a1ca1a1b0c470e345e41ea2eaa3ac0eef79d7d51b589c` |
| `/tmp/coconut_dense_feasibility.py` | `1454f9edf27915f384e92b14a3bd90db6f23df337bf977a16d67b87f6a2cd782` |
| `/tmp/coconut_dense_retain.py` | `38fb65d7568c61b44839b6795891381ad1c5246638395e89d45d5271f3e5dfbb` |
| `apps/api/src/interior/candidates.ts` | `b4262635396f3b53364357c8ad7358b666b83636cdf051f1e107033473b25ca4` |
| `apps/api/src/interior/reference.ts` | `336dbafb946cf985bb17991aeba8b4c394c889f5c51434c5f9e4dc4ad114c945` |
| `apps/api/src/interior/suite.ts` | `4ece1eace7c8645da11c9dcf53a01ecae68fc6bb2dfe8f377c4af9e09b1fbacc` |
| `apps/api/src/interior/types.ts` | `9e758de464c3089f32e289c411803d6600d8b62ed9fc1b3e19efcd03b8efe7ca` |
| `docs/plans/interior-curvature-v1.md` | `a3e9d2b9f4a3f1bfdbe73bda955a857b8d8e34113991bb6a322f5a7c4b7a84a7` |
| `apps/api/data/suites/interior-v1.json` | `f49f03f130bd4b54351e4e7ab9a4674e5208565686d18519f4a729aef4e07da8` |

The reviewed proposed population has 72 tasks: three nonlinear families,
eight source-quintic parameter indices, and all three labels per
family/index. Each source polynomial index is shared across its nine related
tasks, so these are eight shared clusters rather than 72 independent draws.
The population is explicitly exploratory and unranked. It has only three broad
families and therefore does not meet or alter the pre-existing six-family
minimum or richer coverage criteria.

## Independent derivation

For the source polynomial `p`, write `D = 1 + p²`. I independently derived
the following second derivatives before checking the implementation:

| Family | Second derivative sign expression |
| --- | --- |
| `log(1 + p²)` | `2 ((1 - p²)(p')² + p D p'') / D²` |
| `1 / (1 + p²)` | `2 ((3p² - 1)(p')² - p D p'') / D³` |
| `log(1 + exp(p))` | `σ(p) [p'' + (p')² / (1 + exp(p))]` |

I then used a separate, temporary Python calculation with exact rational
power-to-Bernstein conversion on 16 cells for polynomial signs and 32 cells
for the softplus bracket. Positive exponential inputs were enclosed with a
40-term Taylor sum plus a geometric tail; negative inputs were enclosed by
reciprocal bounds. This calculation did not import application source or call
the candidate generator.

Across indices 0 through 7 it obtained these conservative ranges (endpoints
rounded here only for review readability):

| Claim / domain | Independent curvature enclosure across all indices |
| --- | --- |
| logarithm convex, `[1/2, 5/8]` | `[0.059697, 5.506787]` |
| logarithm concave, `[1/5, 2/5]` | `[-7.052228, -2.943849]` |
| reciprocal convex, `[1/5, 2/5]` | `[2.437711, 7.075152]` |
| reciprocal concave, `[17/32, 5/8]` | `[-5.425782, -0.697533]` |
| softplus convex, `[3/5, 3/4]` | `[0.287741, 12.322593]` |
| softplus concave, `[1/5, 1/2]` | `[-6.744925, -1.930906]` |

These ranges lie within the intended coarse certificate intervals:
`[1/25, 6]`, `[-8, -2]`, `[2, 8]`, `[-6, -1/2]`, `[1/6, 13]`, and
`[-7, -3/2]`, respectively. The supporting polynomial-range regimes also
hold: the logarithm/reciprocal global-sign domains have `0 < p < 1/2`; the
softplus convex domains have `-1/2 < p < 1/2`; and its concave domains have
`0 < p < 1/2`.

For every parameter index, the `neither` domain `[-3/5, 3/5]` has two strict
interior witnesses. At `x = 0` and `x = 1/3`, their signs are respectively
positive/negative for logarithm and softplus, and negative/positive for the
reciprocal family. The final candidate source attaches these witnesses only to
`neither` cases. It also checks that both endpoints and the midpoint have the
opposite, misleading common sign; those samples therefore do not establish a
global curvature label.

## Native admission and replay

I independently submitted the 72 fixed references from the temporary artifact
to the existing native numerical backend in two bounded batches (64 and 8).
All 72 returned `verified` with the requested label. Separately, the final
interior CLI generated and strictly replayed a 72-case suite with 72 accepted
attempts, no rejections, depth 13, and 24 cases per label. The temporary replay
artifact hash was `b68bda57058f78a0cff73e36d588889616d40fd5ffa530b9dc7f576a03e81899`.

### Frozen artifact comparison

The final artifact is 728,408 bytes, has ID
`suite-interior-v1-99c5b377b79244e5c5e7e267548964a14fb1ae64eb92998d44166024dcf5d10c`,
and was strictly replayed through the final CLI. Its 72 case/reference/family/
cluster/depth/label/analytic-certificate records have the same sorted SHA-256
`392f6f39d9994d1c24cf924ea4c40c16974d08ccc6426b60730cba446c4e90d7`
as the previously reviewed temporary generated suite. Removing both `id` and
`designRevisions` makes the two suite documents byte-identical after sorted
JSON serialization.

The earlier temporary ID
`suite-interior-v1-103c68fb6b6b46b4adafae326d3c75205b4c278a83c97a66ac1e4a737666e2cc`
therefore differs only because it lacked the eight retained rejected-domain
revision records (their sorted SHA-256 is
`36b74ece7438bf4a8c9afb880ea028944bcacc508702e0358a6bce1f51c0beb2`).
This is metadata that preserves the eight `[1/2, 5/8]` reciprocal-concave
rejections and their `[17/32, 5/8]` replacement; it does not change reviewed
membership, labels, domains, analytic references, or native certificates.

I additionally checked the final artifact directly: all 24 `neither` records
have domain `[-3/5, 3/5]` and exactly the strict-interior witnesses `0` and
`1/3`; all 48 convex/concave records have no witnesses and a non-null global
second-derivative interval. Thus the temporary witness representation issue is
absent from the frozen record.

This is corroboration, not sole reference proof: native admission uses the
existing numerical backend, while the algebra and interval calculation above
is the independently derived check.

## Findings and limits

1. **Resolved representation issue in the temporary exploration artifact.**
   That artifact stored the `x = 0` and `x = 1/3` witnesses on convex and
   concave records too, although those coordinates are outside those records'
   domains and can have opposite signs. If consumed as a final certificate this
   would be misleading. The reviewed final candidate source limits witnesses
   to `neither` records and gives convex/concave records a global interval only.
2. **Preserved rejected boundary.** The artifact records eight rejected
   reciprocal concave candidates on `[1/2, 5/8]`; the final concave domain is
   `[17/32, 5/8]`. The rejection must remain part of the design history and
   cannot be reported as an accepted near-boundary case.
3. **Coverage limitation, not a reference error.** Shared source-polynomial
   clusters, one measured depth, and three broad outer-function families mean
   this population cannot support a broad-family coverage claim, confidence
   interval, or general ranking. Existing fixed-suite criteria remain unchanged.
4. **No human approval.** A qualified mathematical reviewer would still be
   required for any claim needing human expert endorsement.

No mathematical sign contradiction was found in the reviewed final 72-case
construction. Registry/leaderboard eligibility and any future model execution
remain outside this review.

The machine-readable quality report binds the ordered `{family, reference, analyticCertificate}` membership to canonical SHA-256 `a503a736a8f19c18598f4758993fb40c136f2e4a31b80d2c9857ba86d13919b9`. This fingerprint excludes profile settings and historical design revisions; the complete artifact hash above covers those separately. A matched mathematical-review record does not override exploratory coverage, shared-cluster or uncertainty limitations.
