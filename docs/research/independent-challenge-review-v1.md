# Independent challenge review, version 1

This records an **AI-assisted independent mathematical review** performed on 2026-11-08 by a separate Codex subagent. No human expert approval occurred. The reviewer read the local instructions, the complete [quality criteria](quality-criteria-v1.md), the [module 14 plan](../plans/14-benchmark-quality-and-pitfall-remediation.md), and all challenge sources before deriving the checks below. This is reference evidence, not a model evaluation or a promise that any model will fail.

The reviewed object is the exact expression on its exact supplied closed interval, with exclusive convex/concave labels and two strict interior second-derivative signs for neither. All domains are nondegenerate. The reviewer made no inference calls, accessed no development credential, and did not edit application sources during the independent mathematical review. The later offline-audit implementation is separate work by the same reviewer.

## Population and source binding

The reviewer checked **96 supported coordinates**: eight families × three labels × parameter indices 0, 1, 2, 3. Of these, 72 are the confirmation population, nine are screening, and 15 are additional boundary coordinates. Confirmation has 24 three-label parameter clusters; screening has three. Screening reserves index 3 in reciprocal-exponential, softplus-quadratic, and integrated-curvature. There are no exact expression/domain duplicates within or across the final populations; comparison ignores claimed labels. Cluster identities are disjoint between populations.

Confirmation raw depth counts are 3:36, 4:9, 5:9, 6:9, 14:9. Each family has three cases per label, with all three labels retained together in each cluster. Depth is associated with family, so these counts do not support a causal depth/difficulty claim.

Reviewed SHA-256 file identities:

| Source | SHA-256 |
| --- | --- |
| `apps/api/src/challenge/algebra.ts` | `8c05cf01bea2b86477410f5c3f31efbb0061dc16258445b7b5145741d523af07` |
| `apps/api/src/challenge/candidates.ts` | `d0b050075df4ace9036e1ea7fb64f5d0525d8142c5606af50d58253cd46cd3a6` |
| `apps/api/src/challenge/suite.ts` | `93dad900878222b787fae90e10ebe329a9a3d4ae499a15200c46cc6164ee47d5` |
| `apps/api/src/challenge/types.ts` | `d0416071475704158af9294e043ad92c45a518557ed770cccb713f8e64b8c284` |
| `docs/research/quality-criteria-v1.md` | `956573cb02d264d770219061ff805aa03f942a823138a87fa0266e5bf91d0f95` |

The offline audit additionally binds review applicability to SHA-256 of the ordered array `{family, reference, analyticCertificate}`. Objects use recursively sorted keys and ordinary JSON serialization; arrays retain order. The corresponding identities are:

- Confirmation: `9dc60691331d85c892666edc957a5325820d8cb8e7b8519f85f9772e7cc9eb8e`.
- Screening: `0fbb8432f942d9678233726f74e6deb3d003cd96e7d90eb98f76051a6d91033b`.

The types file was re-read after its family list was frozen with `Object.freeze`; that edit did not change membership or mathematics. This membership binding excludes profile settings, which do not change the mathematical problem. Changed expressions, domains, labels, family assignments, or analytic certificates invalidate the match. File hashes record what was read; the membership match does not claim that later source revisions received independent review.

## Independent derivatives, domains, and parameter boundaries

Write `g(z)=exp(z)/(1+exp(z))²`. It is even, has maximum `1/4` at zero, and decreases strictly for positive `z`. For `t=exp(z)`, this follows from the derivative of `t/(1+t)²`, namely `(1-t)/(1+t)³`.

| Family | Second derivative and independently checked argument |
| --- | --- |
| Local logarithm, `log(c+x²)` | `2(c-x²)/(c+x²)²`, with `1<=c<=7/4`. On `[-1/2,1/2]` its numerator is strictly positive; on `[2,3]` strictly negative. On `[0,3]`, the witnesses `1/4` and `5/2` have opposite strict signs. The denominator and logarithm argument are positive. The reported global enclosures use separate numerator/denominator endpoints with the correct negative-division directions. |
| Reciprocal exponential, `1/(c+exp(x))` | `exp(x)(exp(x)-c)/(c+exp(x))³`, with the same c range. The denominator is positive. On `[1,2]`, `exp(x)>c`; on `[-2,-1]`, `exp(x)<c`. The witnesses `-3/4,3/4` on `[-1,1]` remain strictly on opposite sides even at `c=7/4`. |
| Exponential quadratic, `exp(x)-a x²` | `exp(x)-2a`, with `1/2<=a<=11/16`. The intervals `[1,2]` and `[-2,-1]` have strictly positive and negative curvature respectively. The witnesses `-3/4,3/4` on `[-1,1]` bracket the threshold for every supported parameter. |
| Rational bend, `x²/(c+x²)` | `2c(c-3x²)/(c+x²)³`. On `[-1/4,1/4]`, `c-3x²>=1-3/16>0`; on `[1,2]`, `c-3x²<=7/4-3<0`. On `[0,1]`, witnesses `1/8,7/8` give respectively `c-3/64>0` and `c-147/64<0`. The denominator is positive. |
| Softplus quadratic, `log(1+exp(kx))-a x²` | `k²g(kx)-2a`, with `1<=k<=11/8`, on `[-1,1]`. The three coefficients are `a/k²=1/16,5/32,7/64`. The convex regime uses the strictly positive lower bound on `g(k)-1/8` established below. The concave regime has upper bound `k²(1/4-5/16)=-k²/16`. For neither, zero has curvature `k²/32>0`; `3/4` has strictly negative curvature by the exact inequality below. The logarithm argument exceeds one. |
| Exponential bowl, `exp(bx²)-a x²` | `2b exp(bx²)(1+2bx²)-2a`, with `1/4<=b<=11/32`, on `[-1,1]`. The positive term increases with `x²`, between `2b` and `2b(1+2b)/(1-b)`. Convex uses `a=b/2`, giving lower bound b. Concave uses `a=2b(1+2b)` and is strict because `b<1/2`. Neither uses `a=b(1+b)`; zero has curvature `-2b²`, while at `3/4`, writing `z=9b/16`, `exp(z)>=1+z` gives the strictly positive lower bound `2b(3z+2z²-b)`. |
| Mixed branches, `log(1+exp(kx))+sqrt(1+x²)-a x²` | `k²g(kx)+(1+x²)^(-3/2)-2a`, with `2<=k<=19/8`, on `[-1,1]`. Convex uses `a=1/8` and `(1+x²)^(-3/2)>=1/(2sqrt(2))>1/3`, giving lower bound `1/12`. Concave uses `a=k²/8+5/8`, giving upper bound `-1/4`. Neither uses `a=k²/8+1/4`, giving `f''(0)=1/2`. At `3/4`, `exp(3k/4)>4`, so `g(3k/4)<4/25` and the square-root term is exactly `64/125`. Hence `f''(3/4)<=-87/250`. Square-root arguments are at least one; logarithm arguments exceed one. |

The last family is polynomial and is checked separately below. These arguments establish the supported discrete choices; the uniform inequalities also cover the displayed scalar parameter intervals. They do not extend the polynomial family to arbitrary root sets.

### Exact exponential inequalities

The review separately implemented rational exponential enclosures in Python's standard-library `Fraction`, using a sum through degree 40 and bounding the remaining positive tail by its first omitted term divided by `1-x/42`. For negative arguments it inverted the positive enclosure. This is independently written arithmetic, with the elementary series argument checked explicitly. It is not another call to native automatic differentiation.

The application's degree-24 enclosure is also valid: after the degree-25 term, every successive ratio is at most `x/26`; all positive arguments used are at most four. Inverting the enclosure for negative arguments reverses endpoints correctly.

Useful exact uniform bounds checked independently are:

- Summing through degree four at `x=11/8` and bounding the tail geometrically gives `exp(11/8)<=71938411/18186240<4`. Therefore `g(k)>4/25>1/8` in the convex softplus regime.
- `exp(3/4)>269/128`, from its first four terms. Monotonicity gives `7/32-g(3k/4)>=(7/32)-(269/128)/(1+269/128)²=1439/5043488>0` for `k>=1`. This is a conservative uniform normalized margin for every softplus neither witness.
- `exp(3/2)>67/16>4`, also from its first four terms. This establishes the mixed-family witness bound without floating-point comparison.
- For `0<b<1`, the termwise comparison of exponential and geometric series gives `exp(b)<1/(1-b)`, as used for the exponential bowl.

## Expanded polynomial identity and witnesses

For each supported index, independently expand `p(x)=product(x-r)` using exact fractions. Form `q(x)=p(x)²-epsilon`, and independently parse the emitted Horner AST into polynomial coefficients. Differentiating those coefficients twice gives exactly q. All roots evaluate to zero exactly. The review checked all 12 label/index polynomial identities, without using the application's polynomial helpers.

| Index | Four roots | Exact positive neither margin at zero |
| --- | --- | --- |
| 0 | `-3/4,-1/4,1/4,3/4` | `65/65536` |
| 1 | `-2/3,-1/3,1/3,2/3` | `58975/26873856` |
| 2 | `-4/5,-1/5,1/5,4/5` | `657951/1600000000` |
| 3 | `-3/5,-2/5,2/5,3/5` | `4917791/1600000000` |

All use the domain `[-1,1]`. Convex chooses `epsilon=-1/64`, so `F''>=1/64`. Concave chooses `epsilon=S²+1/16`, where `S=sum(abs(p_j))`; since `|p(x)|<=S` on the interval, `F''<=-1/16`. Neither chooses `epsilon=1/4096`; the first root is a strict interior negative witness, with value `-1/4096`, and zero gives the positive margins above. The polynomial is defined on all real inputs.

Across all 96 coordinates, all **64** stated witness enclosures were independently checked, including strict interior membership. For global convex/concave regimes, the signs above are strict everywhere on a nondegenerate interval, which also excludes the opposite label. For neither, continuity and the two strict interior signs exclude both global properties. A failed sufficient rule was never used to infer neither.

## Separation and limits

Parameter variation changes curvature thresholds or polynomial coefficients, rather than adding arbitrary affine offsets. The three labels for a parameter index are explicitly grouped. Where several labels reuse one exact formula on different domains, these remain related tasks within the same cluster. Exact identity checks alone do not prove all possible semantic non-equivalence.

Screening and confirmation share three templates, but reserve different parameter groups and exact function/domain identities. Public templates and historical family overlap prevent a contamination-free claim. These populations do not establish broad-family generalization or independent random sampling. A conditional bootstrap over 24 clusters needs the declared exchangeability assumption and cannot turn three repeated requests into three mathematical tasks.

The independent review found no concrete reference-label defect in the stated population. It did not verify actual outgoing provider wire bodies, public/browser assets, the experiment's exposure history, the model inventory/frontier matrix, or any failure transcript. Native full replay is required separately and remains reproducibility evidence. The offline quality tests later replay the admitted challenge population and exercise review applicability, whole-cluster uncertainty, leakage sentinels, changed budgets, missing trials, incorrect retained reports, and malformed/truncated outcomes; those fixtures are not live service evidence.

The optional signal-review API accepts internal coordinator-supplied **retained manifest and capability objects**, together with pinned trial reviews. It verifies their content hashes, policy identity, dated catalog and explicit frontier selection, exact suite/prompt/settings/concurrency/profile cell, and freeze/permission timestamps relative to the audited run. Every planned effort for the selected model needs a retained capability attempt. Successful completed inference results, with extractor replay and matching reported effort/output limits, determine the highest verified effort; catalog membership is insufficient. At least one successful inference permission must predate the freeze, and the highest effort cannot be low, default, or medium. Reported model/serving identities must agree between the highest-effort probes and model outcomes. Each qualifying case needs at least two reviewed wrong valid labels among three completed, nontruncated trials. A reviewed completed format failure in the third trial remains a format failure and contributes no wrong valid label. The coordinator remains responsible for truthful source provenance and the global chronology before screening; a bounded per-run audit cannot prove the absence of undisclosed prior work.

An independent time-bounded code review found that an earlier draft accepted opaque manifest/capability hashes and an effort assertion. That path was removed before handoff. Opaque hashes, tampered contents, late freezing, wrong suite/prompt/settings identities, missing effort attempts, and changed serving identities now fail regression fixtures. No public route accepts arbitrary review assertions. The default signal verdict remains No-go. A Go is restricted to the validated experiment cell after mathematical, completion, effort, clustering, and pinned transcript-review conditions pass. These retained objects are not cryptographically signed provider receipts; the audit does not manufacture authenticity for fabricated source evidence.

Different diagnostic signatures alone cannot admit two independent failure cores. The signal gate additionally checks the nine replayed certificate probes, which occur at identical normalized interval coordinates. If two functions were related by nonzero output scaling, affine output addition, and affine normalization of their full intervals, their second-derivative vectors would be proportional, either in forward or reflected order. For each orientation, a strict interval sign for `A_i B_j-A_j B_i` disproves proportionality. The gate requires such an exclusion for both orientations on a qualifying pair from different declared clusters and families. This is a bounded sufficient separation proof using replayed native enclosures, separate from the independent derivative review. An inconclusive determinant leaves separation unknown and cannot produce Go. It does not address arbitrary nonlinear transformations.

## Offline implementation verification

The independent mathematical checks above used ephemeral Python standard-library exact arithmetic, separate from the application's derivative and polynomial helpers. Their recorded populations are 96 coordinate checks, 64 strict interior witness-enclosure checks, and 12 polynomial AST/coefficient/second-derivative identities. No live model outcome was part of those checks.

After implementing the offline audit, `bun test apps/api/src/quality` passed **21 tests / 80 assertions**. The earlier quality/scoring/runs regression group passed 110 tests / 734 assertions before the manifest-content hardening; its scorer and run sources were unchanged by the audit owner. API lint, type checking, and build passed. The coordinator's final integration verification and any subsequent changes remain separately recorded evidence. Whole-cluster bootstrap tests reproduce the exact conditional endpoints `[7/8,1]` of a hand-derived binomial fixture and reject trial inflation, sparse families, and missing outcomes. These are deterministic fixtures, not measurements of any deployed model.
