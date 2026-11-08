# Family-balanced challenge design, version 1

## Scope and frozen population

This design implements the family-balanced target in [quality-criteria-v1](quality-criteria-v1.md). It uses the existing scalar AST, rigorous native certifier and `smooth-v2` instructions. It adds no operation or verifier rule, changes no historical suite, and makes no claim that any model will fail.

The confirmation population has **72 tasks: eight families × three parameter groups × three labels**. Every family has exactly three convex, three concave and three neither cases. Related labels/domains within a parameter group share one cluster, giving **24 clusters**, not 216 independent mathematical tasks after three trials. Parameters are fixed design points, not a random sample of mathematical expressions. Any bootstrap interpretation requires the exchangeability assumption and fixed-family limitations stated in D-12.

The screening population has **nine tasks**, using the fourth parameter group of reciprocal exponential, softplus/quadratic competition and integrated curvature. Its three clusters and exact function/domain tasks are disjoint from confirmation. The templates are deliberately shared; this is held-out parameter coverage, not a held-out-family experiment. Screening results are exploratory. Confirmation membership must not change after model outcomes are inspected.

No arbitrary scalar/affine wrapper creates diversity. Domain changes in the threshold families are intentional tasks about interval awareness. They share their original function and cluster; they are not claimed to be different global functions. Exact profile selection changes suite identity while leaving mathematical case identities, certificates and cluster identities unchanged.

## Independent analytic references

All functions are twice continuously differentiable on neighborhoods of the stated domains. Logarithm arguments and denominators are strictly positive; square-root arguments are at least one. Polynomial functions are defined everywhere. The following derivatives are derived directly from the displayed formulas, independently of the native interval automatic-differentiation evaluator.

Write `j=0,1,2` for confirmation and `j=3` for screening. The parameter group is the cluster unit. For neither, each retained reference has two strict interior second-derivative witnesses. For convex/concave, a strictly signed global bound excludes affine overlap without relying on finite samples.

| Family | Formula / parameters | Second derivative / class regimes |
| --- | --- | --- |
| Local logarithm | `log(c+x²)`, `c=1+j/4` | `2(c-x²)/(c+x²)²`. Convex on `[-1/2,1/2]`, concave on `[2,3]`, neither on `[0,3]`. Neither witnesses `x=1/4,5/2`. |
| Reciprocal exponential | `1/(c+exp(x))`, `c=1+j/4` | `exp(x)(exp(x)-c)/(c+exp(x))³`. Convex on `[1,2]`, concave on `[-2,-1]`, neither on `[-1,1]`. Neither witnesses `x=-3/4,3/4`. |
| Exponential/quadratic competition | `exp(x)-a x²`, `a=1/2+j/16` | `exp(x)-2a`. Convex on `[1,2]`, concave on `[-2,-1]`, neither on `[-1,1]`. Neither witnesses `x=-3/4,3/4`. |
| Rational bend | `x²/(c+x²)`, `c=1+j/4` | `2c(c-3x²)/(c+x²)³`. Convex on `[-1/4,1/4]`, concave on `[1,2]`, neither on `[0,1]`. Neither witnesses `x=1/8,7/8`. |
| Softplus/quadratic competition | `log(1+exp(kx))-a x²`, `k=1+j/8` | `k² exp(kx)/(1+exp(kx))²-2a` on `[-1,1]`. Convex `a=k²/16`, concave `a=5k²/32`, neither `a=7k²/64`. Neither witnesses `x=0,3/4`. |
| Exponential bowl competition | `exp(bx²)-a x²`, `b=1/4+j/32` | `2b exp(bx²)(1+2bx²)-2a` on `[-1,1]`. Convex `a=b/2`, concave `a=2b(1+2b)`, neither `a=b(1+b)`. Neither witnesses `x=0,3/4`. |
| Mixed branches | `log(1+exp(kx))+sqrt(1+x²)-a x²`, `k=2+j/8` | `k² exp(kx)/(1+exp(kx))²+(1+x²)^(-3/2)-2a` on `[-1,1]`. Convex `a=1/8`, concave `a=k²/8+5/8`, neither `a=k²/8+1/4`. Neither witnesses `x=0,3/4`. |
| Integrated curvature | Exact rational polynomial `F` satisfying `F''=p²-epsilon` on `[-1,1]` | Convex `epsilon=-1/64`; concave `epsilon=(sum absolute coefficients(p))²+1/16`; neither `epsilon=1/4096`. Retain exact polynomial identities and rational-root witnesses. |

### Enclosures and inequalities

The analytic reference code uses bounded exact rational arithmetic. Exponential enclosures are computed independently with the first 25 terms `sum(n=0..24) x^n/n!` for `0<=x<=4`. The next term bounds the entire remaining positive tail after division by `1-x/26`, since all later term ratios are at most `x/26`. Negative arguments use reciprocal positive enclosures. These series bounds are distinct from native Arb transcendental evaluation. Tests check exact zero, a separately written rational enclosure of `exp(1)`, and reciprocal identities.

For the logarithmic, rational and reciprocal threshold families, positive denominators and interval bounds on each numerator factor give the retained rational global enclosures. Exponential/quadratic competition uses monotonic exponential endpoint bounds. Failed sufficient composition rules play no role in the labels.

For softplus competition, `h(z)=exp(z)/(1+exp(z))²` is even, is at most `1/4`, and decreases with `|z|`. Its global minimum over `[-k,k]` is enclosed at `k` using the independent series. At zero, the neither curvature is `k²/32>0`; at `3/4`, the series establishes its strict negative sign for every supported `k`.

For the exponential bowl, `1<=exp(bx²)<1/(1-b)` and `1<=1+2bx²<=1+2b` hold on `[-1,1]`, with `0<b<1/2`. The convex lower bound is `b>0`; the chosen concave coefficient gives a strictly negative global upper bound. Neither has curvature `-2b²` at zero. At `3/4`, with `u=9b/16`, the lower bound `exp(u)>=1+u` gives `2b((1+u)(1+2u)-(1+b))>0`.

For mixed branches, `1/3 < (1+x²)^(-3/2) <=1` on `[-1,1]`. The softplus curvature is between zero and `k²/4`. These inequalities give global convex lower bound `1/12` or concave upper bound `-1/4` with the selected coefficients. Neither curvature is `1/2` at zero. At `3/4`, `k>=2` and the independent series establishes `exp(3k/4)>4`, so the positive terms are bounded above by `4k²/25+64/125`; subtracting `k²/4+1/2` is strictly negative. Every witness is strictly inside its declared domain.

### Expanded polynomial curvature

The four groups use rational roots:

| Group | Roots |
| --- | --- |
| Confirmation 0 | `-3/4,-1/4,1/4,3/4` |
| Confirmation 1 | `-2/3,-1/3,1/3,2/3` |
| Confirmation 2 | `-4/5,-1/5,1/5,4/5` |
| Screening 3 | `-3/5,-2/5,2/5,3/5` |

Construct `p` as the product of its four linear factors. Square its exact coefficient vector and subtract `epsilon` from the constant coefficient. Integrate twice with zero constant and linear terms. The rendered function uses an expanded Horner tree with zero additions omitted. It has measured depth 14 and 29 node occurrences, rather than an artificial target depth.

An independent AST-to-polynomial traversal checks the rendered expression against the integrated coefficients. Exact differentiation of those coefficients must recover `p²-epsilon`, and direct polynomial evaluation must verify every declared root. The test suite additionally checks the first convex group's independently written degree-ten coefficient vector:

```text
[0, 0, 1105/131072, 0, -15/4096, 0, 59/3840, 0, -5/224, 0, 1/90]
```

The convex margin follows from `p²>=0`. On `[-1,1]`, the triangle inequality gives `|p|<=sum |p_j|`, proving the chosen concave margin. For neither, a declared interior root gives `F''=-epsilon<0`; zero gives `p(0)²-epsilon>0` for every supported group. The native evaluator separately certifies the same original expression and full domain. Neither agreement nor the exact identity is described as a proof-assistant verification or human expert approval.

## Artifact and reproduction

The retained confirmation artifact is `apps/api/data/suites/challenge-v1.json`:

- Suite ID: `suite-challenge-v1-6a1bf3255f8104661db7ce0ae4f3be4182e8ac3b8b9240774aacfc339e433dd9`.
- File SHA-256: `4e728837536ea9ca8500f3f612c642c937c7424411097190de9e7f392b7991e6`.
- 733,277 bytes including its final newline; 72 attempted/accepted cases; zero rejections.
- Format `2`, generator `challenge-v1`, depth policy `measured-operation-v1`, verifier `arb-jet-v1`, prompt `smooth-v2`, analytic policy `analytic-curvature-v1`.
- Historical default `one-shot-json-v1` profile is retained in the checked-in artifact. New explicit-effort runs generate separately identified profile-bound artifacts; case/cluster identities remain unchanged.
- Measured depths `[3,4,5,6,14]`. Per label, counts are `12,3,3,3,3` respectively. No depth causality claim follows from this mixture.

Native generation samples observed approximately 418 ms for confirmation and 107 ms for screening on the development machine. They include bridge/process startup and are single feasibility observations, not a repeated performance study. Full replay recomputes candidate formulas, analytic evidence, native certificates, pairwise same-domain separation, coverage, attempts and identity. A rejected candidate is retained with its exact reference/reason and produces incomplete coverage without a suite identity; it is never replaced after looking at a model result.

```sh
bun apps/api/src/challenge/cli.ts verify --input apps/api/data/suites/challenge-v1.json
bun apps/api/src/challenge/cli.ts generate --output /tmp/coconut-challenge-new.json
bun apps/api/src/challenge/cli.ts generate --population screening --output /tmp/coconut-screening-new.json
bun apps/api/src/challenge/cli.ts generate --profile one-shot-json-v2-high --output /tmp/coconut-challenge-high-new.json
```

Output paths must not exist. CLI inputs are limited to 32 MiB with strict UTF-8 decoding. Requests admit only their fixed versioned seed/population/depth/count/purpose and a registered profile. Getters, extra fields, altered evidence, unknown populations, changed coverage and reordered membership fail replay. Only expression/domain and neutral instructions enter `buildNumericalPrompts`; independent reference evidence, family names, cluster IDs and task ordering remain private metadata.

## Limits and remaining review

Pairwise inequality at a common point proves different functions only for pairs on the same exact domain. Different domains establish distinct interval-classification tasks, with shared clusters documenting the relationship. The implementation does not decide arbitrary symbolic equivalence or prove freedom from all template shortcuts. It addresses the earlier family-to-neither shortcut by representing every class in every family, while preserving transparent coefficient/domain cues that are part of the mathematical problem.

References have programmatic analytic checks and native certification; independent external mathematical/code review and live capability evidence remain separate requirements. Fixed templates, small parameter grids, class balancing, domain regimes and depth/size covariance limit generalization. A wrong valid label can support an inspected counterexample; only the frozen D-12 criteria can support a stronger failure claim. No model inference or credential access occurred in this implementation task.
