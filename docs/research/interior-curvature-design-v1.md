# Interior curvature exploration, version 1

## Status and exposure

This is a **separate exploratory population**, designed on 2026-11-08 after the coordinator reported ceiling performance in the first completed high-effort cells of the existing fixed challenge experiment. Earlier challenge membership, runs, prompt contracts, quality criteria and artifacts remain unchanged. No provider call or credential access occurred in this generator's implementation or mathematical admission checks. Its model difficulty remains unmeasured at this checkpoint.

The population contains **72 fixed tasks: three families × eight source-polynomial groups × three labels**. Each polynomial group supplies nine related tasks across all three families and domains. The shared cluster identity therefore gives **eight clusters**, not 24 or 72 independent mathematical draws. The parameters are fixed design points rather than random samples.

This population does not meet the six-family minimum of [quality-criteria-v1](quality-criteria-v1.md), and eight clusters do not meet its 20-cluster uncertainty condition. It supports descriptive, explicitly exploratory characterization. It does not inherit richer-coverage, confidence-interval, broad-ranking or general mathematical-failure claims. The existing policy is not weakened.

## Fixed formulas and domains

For `j=0,...,7`, put `t=j/64` and define

```text
p_j(x) = 4x^5 + ((j+1)/64)x^4 - (5+t)x^3
         + (1/8+t/2)x^2 + (1+t/4)x + 1/4.
```

All coefficients are modest exact rationals. The function is rendered as a dense quintic Horner expression. No scalar or affine output wrapper manufactures diversity or operation depth.

| Family | Function | Convex domain | Concave domain | Neither domain |
| --- | --- | --- | --- | --- |
| Quintic logarithm | `L(x)=log(1+p_j(x)^2)` | `[1/2,5/8]` | `[1/5,2/5]` | `[-3/5,3/5]` |
| Quintic reciprocal | `R(x)=1/(1+p_j(x)^2)` | `[1/5,2/5]` | `[17/32,5/8]` | `[-3/5,3/5]` |
| Quintic softplus | `S(x)=log(1+exp(p_j(x)))` | `[3/5,3/4]` | `[1/5,1/2]` | `[-3/5,3/5]` |

These are domain-specific classification tasks: one family/group reuses the same function on three intervals. All functions are smooth on the real line. The first two denominator/logarithm arguments are at least one; the softplus logarithm argument exceeds one.

The mechanism is nonlinear curvature competition rather than depth alone. On **every neither case**, second derivatives at both interval endpoints and the midpoint have the same strict sign; the interior point `1/3` has the opposite sign. Thus an endpoint-and-midpoint sign check returns a misleading picture on this fixed population. This proved property is not evidence that a model uses such a check, and it does not prove that any model will fail.

## Independent derivatives and exact sign checks

Write `p=p_j`, `u=p'` and `v=p''`. Direct differentiation gives

```text
L'' = 2[(1-p^2)u^2 + p(1+p^2)v] / (1+p^2)^2,
R'' = 2[(3p^2-1)u^2 - p(1+p^2)v] / (1+p^2)^3,
S'' = exp(p)/(1+exp(p)) [v + u^2/(1+exp(p))].
```

The logarithm and reciprocal numerators are degree-18 rational polynomials. Their global signs are checked by polynomial coefficient arithmetic, separately from the native interval automatic-differentiation implementation. The emitted quintic AST is also converted back to coefficients and checked against the independently retained source coefficients.

For a polynomial `A(x)=sum a_k x^k` of degree `n`, substitute `x=a+(b-a)z` and compute its power coefficients

```text
c_j = sum(k=j..n) a_k binom(k,j) a^(k-j) (b-a)^j.
```

Its degree-`n` Bernstein coefficients on `[a,b]` are

```text
B_i = sum(j=0..i) c_j binom(i,j)/binom(n,j).
```

The Bernstein basis functions are nonnegative and sum to one on `0<=z<=1`, so `min B_i <= A(x) <= max B_i`. The implementation uses exact rational arithmetic and exact integer binomial coefficients, at degree at most 18. Sixteen fixed equal cells bound the sign polynomials and quintic ranges. These are finite global enclosures, not point samples or another call to native automatic differentiation.

For the softplus bracket, 32 fixed equal cells separately bound `p`, `u` and `v` with Bernstein coefficients. Square bounds include zero when the derivative interval straddles zero. The directly derived formula then gives lower and upper bracket bounds with the correct denominator directions.

An independent exponential enclosure sums the exact series through degree 40 for `0<=z<=4`. The first omitted term is `z^41/41!`; the entire remaining tail is at most that term divided by `1-z/42`, since all later term ratios are at most `z/42`. Negative arguments use reciprocal positive enclosures with reversed endpoints. This is independent of Arb's transcendental evaluation and distinct from the earlier challenge's degree-24 series implementation. Argument bounds fail explicitly outside the fixed supported range.

On the retained global domains for `L` and `R`, exact bounds give `0<p<1/2`; hence `1<=1+p^2<=5/4`. Softplus global domains give `-1/2<p<1/2`, so its sigmoid factor exceeds `1/3`; on its concave domain `p>0`, so the factor exceeds `1/2`. The latter follows from `exp(1/2)<2`, itself a termwise comparison with the geometric series. Applying these bounds gives the following independently replayed coarse enclosures for **every supported j**:

| Family | Convex global second derivative | Concave global second derivative |
| --- | --- | --- |
| Quintic logarithm | `[1/25,6]` | `[-8,-2]` |
| Quintic reciprocal | `[2,8]` | `[-6,-1/2]` |
| Quintic softplus | `[1/6,13]` | `[-7,-3/2]` |

Both bounds are strict in sign, excluding affine overlap and the opposite label. These checks establish the eight discrete parameter choices, without asserting an unchecked continuous parameter box.

Neither references retain two strict interior witnesses. Their rational or rational-series enclosures are independently checked before retaining these compact bounds:

| Family | Second derivative at `0` | Second derivative at `1/3` |
| --- | --- | --- |
| Quintic logarithm | `[7/4,2]` | `[-5,-4]` |
| Quintic reciprocal | `[-2,-1]` | `[4,5]` |
| Quintic softplus | `[1/4,1/2]` | `[-5,-4]` |

Only neither cases retain these witnesses. Convex and concave analytic certificates have global bounds and an empty witness list. The proof policy is `interior-bernstein-taylor-v1`; formulas, compact source coefficients and coarse bounds are retained. Exact Bernstein/series computations construct the fixed canonical proof population once per process, and later validation reuses those private, deeply frozen objects. No caller input expands this cache.

## Retained rejected design attempts

Before any model call on this population, the reciprocal concave domain was initially `[1/2,5/8]`. It failed for **all eight parameter groups**: independent numerator bounds crossed zero and native classification returned `rejected:label-mismatch`. The actual class there is neither. The fixed final concave domain is `[17/32,5/8]`.

All eight original references and rejection outcomes remain in the artifact's `designRevisions` array and are natively replayed. Independent strict interior witnesses at `2049/4096` and `9/16` give curvature enclosures `[1/1024,1/2]` and `[-4,-2]`, respectively. A regression also certifies the original interval with its actual neither label. The rejected historical references are nonmembers: they do not enter the 72 current admission attempts or current coverage denominators. Full generation performs 80 native checks, including this retained history.

This is an offline reference-driven design revision, not selection based on evaluation-model outcomes. The wrong original labels are recorded as rejected and are never admitted as uncertain or correct cases.

## Artifact and reproduction

The separate checked-in artifact is `apps/api/data/suites/interior-v1.json`:

- Suite ID: `suite-interior-v1-99c5b377b79244e5c5e7e267548964a14fb1ae64eb92998d44166024dcf5d10c`.
- File SHA-256: `f49f03f130bd4b54351e4e7ab9a4674e5208565686d18519f4a729aef4e07da8`.
- 728,408 bytes, including its final newline; 72 current attempted/accepted cases, zero current rejections, eight separate rejected historical references.
- Format `2`, generator `interior-v1`, depth policy `measured-operation-v1`, verifier `arb-jet-v1`, protocol `1`, prompt `smooth-v2`, population `exploratory`.
- Raw operation depth is 13 for every task. Node occurrences are 25 for logarithm/softplus and 26 for reciprocal; native covers have at most ten leaves.
- The checked-in profile is `one-shot-json-v1`. An explicit max-effort profile changes suite identity while preserving the mathematical cases, clusters, references and certificates.

```sh
bun apps/api/src/interior/cli.ts verify --input apps/api/data/suites/interior-v1.json
bun apps/api/src/interior/cli.ts generate --output /tmp/coconut-interior-new.json
bun apps/api/src/interior/cli.ts generate --profile one-shot-json-v2-max --output /tmp/coconut-interior-max-new.json
```

Output paths must be new. CLI input is limited to 32 MiB and strict UTF-8. Replay validates the exact fixed request and compares every retained field with its canonical reproduction, including independent proofs, native certificates, same-domain separation checks, coverage entries, current attempts and historical rejections. Only fixed mathematical proof construction is cached; all 72 current native admissions and eight historical native rejections run on every generation/validation. Changed evidence, membership, ordering, fields and accessors are rejected without evaluating getters. Returned data are deeply frozen. Cancellation and unverified admissions never receive a successful suite identity.

Single-process feasibility timings before the cache were 3,953 and 4,038 ms for two successive generations. With the bounded immutable cache, cold generation took 4,458 ms and the next generation took 312 ms. These single samples include native process work and are not a repeated performance study or frontend endpoint measurement.

## Scope limits

The three outer functions share the same eight source polynomials; the nine related tasks stay together in each cluster. Fixed templates, narrow parameter perturbations, domain-to-label cues and family correlation remain visible limitations. Same-domain unequal values prove different functions, not freedom from every possible mathematical equivalence. Nonlinear outer transformations are not arbitrary output scaling, but shared inner structure still limits independence.

All tasks have equal raw depth, and the native verifier readily certifies them. Neither fact establishes model difficulty. A later live characterization must freeze its exact artifact/profile/model settings before inspecting outcomes, retain all attempts and unusable responses, and remain separate from the existing fixed experiment. Human expert approval and public mathematical-failure claims require their own evidence; this implementation supplies neither by assertion.
