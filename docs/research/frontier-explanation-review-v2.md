# Full visible frontier explanation review, version 2

## Scope fixed before the extension

This adaptive offline diagnostic extends [version 1](frontier-explanation-review-v1.md) to every retained response in two already completed, published original-challenge max-effort runs: `gpt-6-astra`, run `2211c494-40a8-4964-9e26-4b1587ee9ce3`, and `gpt-6.1-sol`, run `2923df82-0d17-47d9-9941-569a9f9f1932`. The scope is **432 visible explanations: 72 cases × three trials × two models**. The earlier 48 reviews may be reused only after exact source, reference and transcript hash matching. Every remaining explanation will be read in full, without selecting cases by apparent interest or replacing brief responses.

The review checks explicit substantive derivative, equality, inequality, domain and sign claims against the exact supplied functions and intervals. Brief sound sufficient arguments are permitted by the contract; incomplete or ambiguous reasoning is not automatically a definite error. Correct classification labels remain correct, and explanation findings cannot satisfy the unchanged G-SIGNAL criteria or reveal hidden reasoning.

## Result and complete accounting

**No substantiated false explicit mathematical claim was found in the 432 explanations.** All 384 explanations outside the earlier sample were read in full. Exactly 48 earlier reviews were reused only after their public source, reference, case, inference-result, raw transcript and explanation hashes matched. All 432 classification labels were already correct; no grade, official score or signal-gate decision changed.

| Requested model / profile | Responses reviewed | Newly read | Hash-bound version-1 reviews | False explicit claims found | Unresolved claims |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-6-astra` / `one-shot-json-v2-max` | 216 | 192 | 24 | 0 | 0 |
| `gpt-6.1-sol` / `one-shot-json-v2-max` | 216 | 192 | 24 | 0 | 0 |
| Total | 432 | 384 | 48 | 0 | 0 |

This is complete coverage of these two retained runs, with zero unreviewed responses. It covers **72 distinct function/domain tasks, eight families, three parameter groups per family, all three labels and all three trials**. The tasks belong to **24 related parameter clusters**. Repetition across models and trials does not create 432 independent mathematical tasks. There are 425 distinct exact explanation strings; all response instances remain in the accounting.

Every family cohort contains 54 responses: six matched version-1 reviews and 48 newly read explanations. No cohort was narrowed after its content was inspected.

| Family | Total reviewed | Newly read | Reused | Substantiated defects / unresolved |
| --- | ---: | ---: | ---: | --- |
| Local logarithm | 54 | 48 | 6 | 0 / 0 |
| Reciprocal exponential | 54 | 48 | 6 | 0 / 0 |
| Exponential/quadratic | 54 | 48 | 6 | 0 / 0 |
| Rational bend | 54 | 48 | 6 | 0 / 0 |
| Softplus/quadratic | 54 | 48 | 6 | 0 / 0 |
| Exponential bowl | 54 | 48 | 6 | 0 / 0 |
| Mixed branches | 54 | 48 | 6 | 0 / 0 |
| Integrated curvature | 54 | 48 | 6 | 0 / 0 |

## Sources, retention and review roles

The source RunViews were retrieved anonymously for version 1 and reused here only after matching their complete byte hashes. No provider key, private access code, database write, new evaluation inference or server restart was involved.

| Source run | Public response SHA-256 |
| --- | --- |
| `2211c494-40a8-4964-9e26-4b1587ee9ce3` | `19ee113cc02f723e5354d643c0998ff5ae9a4927fd5e4570e62ec35eff7c4d1a` |
| `2923df82-0d17-47d9-9941-569a9f9f1932` | `3887e7999fbaac2abcf69e1e94c5342a63432026596015d2d41a6bca9917173a` |

Both use the profile-bound suite `suite-challenge-v1-ad8d54145c9cce0b20a25ce00b10ed6c9ec5cf32b54f868b967ca8ebe595b1bf`. The unchanged version-1 aggregate is SHA-256 `7b1a19e602e557dd95571ce724e17330626d81b9368e9d592d1118f74e4f3c55`.

The complete new evidence is `apps/api/data/quality/frontier-explanations-v2.json`, **1,287,181 bytes**, SHA-256 `c35253a61f0dc9850ed2123f773d8fb439ec318cfeb5cbbd07c23c769c1e4b74`. It retains all 432 exact visible explanations and raw model replies; run/suite/case/cluster/trial/attempt identities; reference, case, inference-result, raw-transcript and explanation hashes; 72 exact input references with independently derived mathematics; all cohort counts; every displayed approximation check; and the secondary review's evidence. The 48 reused rows identify that provenance explicitly.

String hashes use exact UTF-8 bytes. Structured-record hashes use recursively key-sorted compact JSON with Unicode preserved. These are content bindings, not cryptographically signed provider receipts. All selected mathematical inputs and texts remain in the durable artifact rather than depending on temporary paths for their contents.

The primary AI assistant read all 384 new explanations, compared their substantive statements with independently derived mathematics, and reran exact local checks for all 72 references. A separate AI assistant independently read and cross-checked **all 108 softplus/quadratic and integrated-curvature explanations**, including every group, label, trial and model. Its complete evidence is embedded; its source artifact SHA-256 is `089d2b1565ef2bc705cb6f850d204316f7185e82d79e2716d8346790633ab7ea`. This does not claim separate-assistant review of the other 324 responses. Earlier reviewer roles for the reused sample remain in version 1.

No human expert or proof-assistant approval occurred. The language-to-mathematics comparison is AI-assisted review, not a formal automated semantic verifier.

## Independent derivative and domain checks

The local scripts used the Python standard-library `Fraction` type and separately written polynomial traversal/differentiation, without importing the application's automatic-differentiation or polynomial helpers. For every nonpolynomial reference, a directly constructed expected formula was matched to the exact AST and supplied domain; the parameter index alone was never accepted as proof of the function. Polynomial ASTs were independently expanded and differentiated twice.

The [challenge design](challenge-design-v1.md) and [earlier independent reference review](independent-challenge-review-v1.md) supplied context. The following identities were derived directly and checked across all supported parameter choices:

| Function family | Independently derived second derivative | Claims checked in the explanations |
| --- | --- | --- |
| `log(c+x²)` | `2(c-x²)/(c+x²)²` | Positive arguments/denominators, interval signs, equivalent numerator forms and exact square-root transition locations. |
| `1/(c+exp(x))` | `exp(x)(exp(x)-c)/(c+exp(x))³` | Direct quotient differentiation; positivity; strict exponential comparisons; logarithmic thresholds inside the stated interval. |
| `exp(x)-a x²` | `exp(x)-2a` | Quadratic constants, endpoint inequalities and interior sign changes at the displayed logarithmic thresholds. |
| `x²/(c+x²)` | `2c(c-3x²)/(c+x²)³` | Rational rescalings, positive denominators, exact numerator bounds and transition locations. |
| `log(1+exp(kx))-a x²` | `k² exp(kx)/(1+exp(kx))²-2a` | Hyperbolic equivalents, monotonicity, global bounds, all witness constants and displayed approximations. |
| `exp(bx²)-a x²` | `2b exp(bx²)(1+2bx²)-2a` | Expanded coefficient forms, exponential upper bounds, rational and algebraic interior witnesses, and exact sign arithmetic. |
| Mixed logarithm/square root/quadratic | `k² exp(kx)/(1+exp(kx))²+(1+x²)^(-3/2)-2a` | Both derivative branches, positive-domain smoothness, square-root/logistic bounds, endpoint estimates and continuity arguments. |
| Integrated polynomial | Exact second derivative of the supplied coefficient vector | Square identities, expanded coefficients, global upper bounds and rational interior witness values. |

All domain/smoothness assertions are valid for these particular inputs: logarithm/square-root arguments and denominators are strictly positive on neighborhoods of the supplied intervals. A displayed strict second-derivative sign therefore gives the stated sufficient curvature conclusion without requiring a longer proof than the brief justification contract permits.

## Delicate identities, numerical bounds and witnesses

For `h(z)=exp(z)/(1+exp(z))²`, direct algebra gives

```text
h(z) = 1/(2+2cosh(z)) = 1/(4cosh²(z/2)).
```

Its derivative has the sign of `1-exp(z)`, so it is even and decreases for positive arguments. These identities verify the alternative hyperbolic expressions, including the `9x/8`, `5x/4` and `17x/8` parameter regimes. The bound `h(z)<=1/4` follows from `(1+t)²-4t=(t-1)²>=0` for `t=exp(z)>0`.

All **17 displayed decimal approximations** in the 432 explanations were checked against independent rational enclosures and ordinary nearest-rounding half-unit intervals. The primary checks used the exact exponential series through degree 40 plus its positive geometric remainder bound; negative arguments used reciprocal enclosures. A separately implemented degree-60 series independently corroborated all 16 softplus approximations. An exact rational enclosure of `sqrt(2)`, checked by squaring positive rational endpoints, supported the remaining mixed-branch approximation.

Examples include `cosh(9/8)≈1.7024`, `cosh²(9/16)≈1.351`, `cosh²(5/8)≈1.4442`, `cosh(5/4)≈1.8884`, and the displayed negative curvatures `-0.03459` and `-0.7265`. All were consistent with their stated precision. Approximation notation was not treated as exact equality, and the underlying strict signs were checked independently of rounding.

Less standard exact witness statements also check. For example, the softplus case at `x=log(5/2)` gives

```text
exp(x)/(1+exp(x))² - 7/32 = 10/49 - 7/32 = -23/1568.
```

Here `0<log(5/2)<1`, established by an independent bound `exp(1)>5/2`. The softplus witnesses `8/9` and `4/5` use valid inequalities `cosh²(1/2)>5/4>8/7`. The exponential-bowl witnesses at `1/sqrt(2)` give exactly `2b(1+b)(exp(b/2)-1)>0`; the separate rational witnesses and the lower bound `81/4096` were also checked exactly.

For the integrated family, the independent AST expansion verifies all nine unique second-derivative identities. The strict neither witness values and concave upper bounds are:

| Parameter group | Positive curvature at `0` | Negative curvature witness | Concave global upper bound |
| --- | --- | --- | --- |
| 0 | `65/65536` | `f''(1/4)=-1/4096` | `-1389/1024` |
| 1 | `58975/26873856` | `f''(1/3)=-1/4096` | `-14329/11664` |
| 2 | `657951/1600000000` | `f''(1/5)=-1/4096` | `-364329/250000` |

The convex identities are the displayed quartic squares plus `1/64`, strictly positive even on the real line. All polynomial expansion, witness and upper-bound arithmetic matches the actual inputs.

Some mixed/softplus explanations first show a strict negative second derivative at endpoint `1` and invoke continuity. Because these functions are smooth beyond the interval, this correctly supplies nearby **strict interior** negative points. These valid arguments were not rejected for omitting an explicit rational coordinate.

Twelve responses use imprecise “negative-power” or “positive-power” wording for the displayed signed-coefficient polynomial terms. The actual terms, inequalities and arithmetic are clear and correct. The terminology does not substantiate a mathematical contradiction and was retained as a wording note, without changing the mathematical verdict.

## Verification and interpretation

The retention check independently reconciled each response with its original source record, including all 432 case/trial coordinates, attempt identities and content hashes. It checked 72 distinct reference bindings, 24 cluster identities, complete three-trial coverage, the 48 exact version-1 matches, all 17 approximation checks and all 108 secondary-review pins. JSON validity and whitespace/diff checks passed. Version-1 files and runtime code were not edited. No source-code build/lint run was needed for this documentation/data-only task.

This is a complete review of a **fixed finite set of visible justifications**, not a random sample of mathematics or a measurement of hidden reasoning. Reused templates, repeated trials, correlated parameter groups and two requested model identities limit generalization. No confidence interval, model ranking, causal explanation or claim of zero error on other runs follows.

The result supplies no explanation-defect counterexample in these runs. Correct classification labels remain correct regardless of explanation length, and even a future explanation-only defect would not satisfy the unchanged wrong-valid-label requirements of G-SIGNAL. This review does not inspect, activate or establish an outcome for P5 or the conditional reserve.
