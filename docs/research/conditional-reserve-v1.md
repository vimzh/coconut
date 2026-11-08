# Conditional reserve research, version 1

## Dormant status and prospective condition

This preserves a fixed **18-task research proposal**, with no runtime activation or inference result. The proposal was constructed and independently checked before this research branch inspected any P5 model outcome. Prior ceiling results on the older challenge motivated the research, so any later use is **adaptive exploration**, not confirmation. No model received these reserve tasks during design or preservation.

The complete prospective condition is:

> BOTH P5 exploration cells finish 216/216 valid correct labels, with no infrastructure failures or unusable outcomes, AND no actual frontier classification error has occurred. Only then may the root coordinator consider this fixed 18 tasks × 3 trials × 2 models = 108-call follow-up; it is never an automatic launch authorization. If P5 is incomplete or has errors, this branch remains dormant research and is not automatically authorized.

P5 means the two frozen `gpt-6-astra/max` and `gpt-6.1-sol/max` cells in `apps/api/data/experiments/interior-matrix-v1.json`, with profile `one-shot-json-v2-max` and 216 planned trials each. The manifest's canonical SHA-256 is `a4f109d0ddd550442d10978bfd1854c07ba04bb4f6268dc7cdaead701106d536`; its full execution boundaries remain in [the interior experiment plan](interior-experiment-v1.md). This note does not assert that the condition currently holds. No P5 result or progress ledger was inspected to evaluate it during preservation.

The frozen proposal retains its original, shorter `activationCondition` text byte-for-byte. The complete condition quoted above, also retained in the history ledger, governs consideration of any later execution. Neither file is an execution permission or an executable experiment manifest. Only the root coordinator may make a later decision, after checking the actual retained evidence.

The possible work ceiling is `18 × 3 × 2 = 108` new attempts. Added to the previously reserved 8,080 requests, the conservative total would be **8,188 ≤ 8,192**, leaving four requests. This arithmetic does not reallocate budget, authorize replacement calls, or justify traffic merely because capacity remains.

## Preserved artifacts and scope

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `apps/api/data/research/conditional-reserve-v1.json` | 633,276 | `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85` |
| `apps/api/data/research/conditional-reserve-rejections-v1.json` | 4,481,163 | `5595e01a6d393ef0a0f7ab13240f7530da73cdf173d7ffd326f676dc9849be4b` |

The proposal was copied from its verified temporary source using exclusive file creation, without changing one byte. It retains all 18 references, complete native certificates, exact independent numerator proofs, global bounds, rational witnesses, probe data and original source hashes. The separate ledger retains the complete 86-check grid design history and 108-check spectral history, including their actual references, outcomes, representation controls and source-file hashes. Temporary path strings in the copied proposal are historical provenance; the durable ledger embeds those histories rather than depending on the temporary files remaining available.

The selected population has **three outer-function families × two shared source-polynomial groups × three labels**. Each source group contains nine related tasks across families and labels, so there are **two related clusters**, not 18 independent mathematical draws. It is unranked, has no eligible confidence interval, and does not meet or alter the existing confirmation criteria in [quality-criteria-v1](quality-criteria-v1.md).

Both JSON files live under `data/research`, outside runtime suite loading. This work adds **no suite key, registry entry, route, runtime generator, production asset, model run or publication**. Any later production use requires its own separately versioned, profile-bound artifact, independent review and explicit experiment freeze. The earlier challenge and P5 memberships remain unchanged.

## Fixed formulas and membership

All 18 cases use the **same closed interval `[-1,1]`**. Define

```text
p0(x) = 4 product(k=0..8) (x - (-1+k/4))
      = 4x^9 - (15/2)x^7 + (273/64)x^5 - (205/256)x^3 + (9/256)x,
p1(x) = (x-1/8)p0(x).
```

The two source degrees are nine and ten. They are rendered as Horner ASTs with all zero additions omitted. These are intrinsic polynomial factors and nonlinear outer functions, without artificial scalar/affine output wrappers or manufactured operation depth. The nonzero quadratic terms change curvature and prevent the neither examples from reducing immediately to repeated equal global extrema of the outer function.

For each source `p=p0,p1`, select exactly these parameters:

| Family and function | Convex `a` | Concave `a` | Neither `a` |
| --- | ---: | ---: | ---: |
| Logarithm: `log(1+p²)+a x²` | `2` | `-8` | `1/64` |
| Reciprocal: `1/(1+p²)+a x²` | `8` | `-2` | `-1/64` |
| Square root: `sqrt(1+p²)+a x²` | `1` | `-4` | `1/64` |

Every logarithm/square-root argument and denominator is at least one. All functions are therefore smooth on a neighborhood of the closed interval, with no domain-boundary exception. A strict global second-derivative sign excludes the opposite label and affine overlap. Two strict interior signs establish neither without relying on a failed sufficient composition rule.

## Independent global proofs

Put `u=1+p²`, `v=p'` and `w=p''`. Direct differentiation gives the base curvatures before adding `2a`:

```text
Nlog = 2[(1-p²)v² + p u w],      Hlog'' = Nlog/u²,
Nrec = -2[(1-3p²)v² + p u w],    Hrec'' = Nrec/u³,
Nsqrt = v² + p u w,              Hsqrt'' = Nsqrt/u^(3/2).
```

The numerator degrees are 34 and 38. Their exact rational coefficient vectors, obtained by ordinary polynomial arithmetic, are retained. A separate exact Bernstein coefficient calculation bounds each numerator on a complete cover of six or seven rational cells. The main reviewer independently recomputed those coefficient vectors and every retained cell bound, apart from the native automatic-differentiation implementation. The covers are contiguous and complete over `[-1,1]`.

For a degree-`n` polynomial with power coefficients `c_j` after the substitution `x=l+(h-l)t`, the degree-`n` Bernstein coefficient is `B_i=sum(j=0..i)c_j binom(i,j)/binom(n,j)`. The Bernstein basis is nonnegative and sums to one on `[0,1]`; thus the minimum and maximum coefficients bound the polynomial globally on that cell. This is an analytic reference calculation, not a new native verifier or a point-sampling certificate.

Because `u>=1`, any signed numerator interval straddling zero also bounds its quotient by the positive denominators above. The independently checked base-curvature enclosures are:

| Source | Logarithm | Reciprocal | Square root |
| --- | --- | --- | --- |
| `p0` | `[-31/8,97/8]` | `[-97/8,31/8]` | `[-31/16,97/16]` |
| `p1` | `[-63/16,491/32]` | `[-491/32,63/16]` | `[-63/32,491/64]` |

Adding the fixed `2a` gives these conservative **uniform enclosures across both sources**, proving all 12 global cases:

| Family | Convex second derivative | Concave second derivative |
| --- | --- | --- |
| Logarithm | `[1/16,619/32]` | `[-319/16,-21/32]` |
| Reciprocal | `[21/32,319/16]` | `[-619/32,-1/16]` |
| Square root | `[1/32,619/64]` | `[-319/32,-21/64]` |

All signs are strict with modest rational margins. No extra precision, operation, verifier rule or relaxed resource policy was introduced.

## Neither witnesses and deliberately misleading coarse checks

All six neither cases have strict opposite curvature signs at the rational **interior** points `0` and `-15/16`:

| Family | At `0`, source `p0` | At `0`, source `p1` | At `-15/16`, both sources |
| --- | --- | --- | --- |
| Logarithm | `1105/32768 > 0` | `65617/2097152 > 0` | `< -2` |
| Reciprocal | `-1105/32768 < 0` | `-65617/2097152 < 0` | `> 2` |
| Square root | `2129/65536 > 0` | `131153/4194304 > 0` | `< -1` |

Logarithm/reciprocal witness values are exact rationals. For square root at `-15/16`, the retained exact negative numerator `N` and `u>=1` give `N/u^(3/2)+2a <= N/u²+2a`; the rational upper bound is below `-1`. This preserves the nonzero neither shift and proves the opposite signs without approximating a square root.

Let `G={-1+k/4:k=0,...,8}`, the existing nine coarse probe coordinates. Both source polynomials vanish at every point in `G`. At these points, the neither curvatures reduce exactly to

```text
logarithm:   2(p')² + 1/32 >  1/32,
reciprocal: -2(p')² - 1/32 < -1/32,
square root: (p')² + 1/32 >  1/32.
```

The roots are simple at these coordinates for both sources, so the displayed inequalities are strict. Every neither case therefore has nine coarse curvature probes with the same sign, despite its strict interior opposite-sign witness. Native admission still requires its existing complete domain cover and strict witnesses; coarse probes never constitute its global proof.

The **canonical Jensen triple `(-1,0,1)`** is misleading in the same direction. On the grid, `F(x)=C+a x²`, with `C=0` for logarithm and `C=1` for reciprocal/square root. Whenever both endpoints and their midpoint belong to `G`,

```text
F((x+y)/2) - (F(x)+F(y))/2 = -a(x-y)²/4.
```

There are exactly **16 unordered distinct endpoint pairs** with their midpoint also in `G`: `binom(5,2)+binom(4,2)`. The canonical pair `x=-1,y=1` has gap `-1/64` for logarithm/square root and `+1/64` for reciprocal. Thus these grid-closed midpoint tests see only the background quadratic's convex/concave direction and miss the failure of that global property. The ledger retains all 96 such triples across the six neither cases.

This identity **does not cover off-grid midpoints, arbitrary endpoint pairs, or every possible Jensen search**. It makes no claim that a model uses these probes or that any model will fail.

## Native feasibility and retained design history

The selected references passed **18/18** native admissions and a separate isolated worker batch of **18/18**, with matching full certificates. Independent checks recovered the source coefficients from every AST, recomputed the derivative numerator identities and global cover bounds, checked all rational witnesses and coarse probe signs, and verified current membership/hash identities.

| Source | Operation depth | Node occurrences |
| --- | ---: | ---: |
| `p0` | 17 | 36 for logarithm/square root; 37 for reciprocal |
| `p1` | 23 | 48 for logarithm/square root; 49 for reciprocal |

The largest selected native certificate has **132 cover leaves / 263 processed cells**. The unchanged limits remain operation depth 32, 256 node occurrences, 512 processed cells, 200,000 subtree evaluations and 192-bit precision. Earlier zero-addition representations were pruned and retained only as representation controls, without adding mathematical diversity.

The durable history deliberately separates these accounting populations:

| Offline check scope | Checks | Verified | Rejected label mismatch | Unverified resource limit |
| --- | ---: | ---: | ---: | ---: |
| Grid-based design revisions and representation controls | 86 | 66 | 20 | 0 |
| Expanded spectral-curvature sweep | 72 | 35 | 0 | 37 |
| Compact Chebyshev representation sweep | 36 | 20 | 0 | 16 |
| Separate final worker replay | 18 | 18 | 0 | 0 |

The grid revisions explored earlier amplitudes, larger shifts, then a declared signed ladder of `1,2,4,8,16`, followed by the nonzero neither shifts and zero-addition pruning. All **20 label-mismatch outcomes** from insufficient global shifts remain retained with their original references and actual native outcomes. Each claimed global label is also independently disproved by a strict rational interior curvature counterexample at `-15/16` or `-1023/1024`; exact values or rigorous square-root lower bounds are embedded in the ledger.

The spectral work investigated integrated squares of Chebyshev/Legendre polynomials and compact exact integrated Chebyshev representations. Its **108 checks contain 53 `unverified:resource-limit` outcomes**, all retained. The reason alone does not identify which bounded cell, subdivision-depth, evaluation or arithmetic limit was reached. Those outcomes remain unverified and are not proposed as admitted cases. The counts include repeated neither controls and alternate representations; they are checks, not 108 distinct mathematical tasks.

None of these historical rejections or resource limits belongs to the selected proposal's current **18 attempted / 18 admitted / zero rejected** coverage. Nor is any native certification outcome an LLM result or a measured model failure. These populations must not be pooled into a model score or task-diversity denominator.

## Verification, interpretation and remaining work

Preservation read and parsed the complete 633,276-byte source, required its expected SHA-256 before copying, checked all 18 reference hashes and AST/native certificate bindings, verified complete native covers and measured structure, and confirmed byte-for-byte equality after exclusive creation. The complete five grid source files and both spectral source files were re-read with their original hashes checked; the ledger preserves their actual records. All 20 rejected claims received independently recomputed rational counterexamples, and all 96 grid-closed Jensen triples were checked exactly.

This is AI-assisted mathematical and software verification, without human expert approval. No LLM call, credential/access-code read, database mutation, production change, service restart, budget reallocation or commit occurred. Build/lint/type checks were not rerun for this documentation/data-only preservation; JSON, mathematical identities, hashes, membership and evidence accounting are the relevant checks.

The roots deliberately align with the native probe grid, the two sources are related, the outer functions are close to their leading local polynomial behavior at small source values, and the shift magnitudes may provide visible mathematical cues. Higher degree and probe blindness are proved structural properties, not measured difficulty or a failure guarantee. No ranking, confidence interval, held-out confirmation status or stronger G-SIGNAL result follows. The root coordinator retains any later experiment decision under the prospective condition above; until then this remains dormant non-runtime research.
