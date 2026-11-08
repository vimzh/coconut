# Exploratory review of visible frontier explanations

## Prospective selection rule

This offline diagnostic was declared on 2026-11-08 before inspecting any explanation in its sample. It selects the two published, completed full-challenge runs requested as `gpt-6-astra` and `gpt-6.1-sol` with profile `one-shot-json-v2-max`. In each run, take the first case in canonical suite order for each of the eight families × three labels, and take logical `trialIndex=0`: **24 explanations per run, 48 total**. Retain every selected explanation; do not replace short, ambiguous or uninteresting responses.

The question is whether an explicit visible derivative, equality, inequality or domain claim is provably false for the exact supplied function and interval. A brief, incomplete or ambiguous explanation is not a mathematical error. Correct labels remain correct, and this diagnostic makes no scoring change or G-SIGNAL finding. It cannot identify hidden reasoning, establish general explanation reliability or imply human expert approval.

## Result and denominators

**No substantiated false explicit mathematical claim was found in the 48 selected explanations.** All 48 already had correct classification labels; those grades remain unchanged. No sampled explanation was replaced, and none was assigned an ambiguous/insufficient-to-verify verdict after the scoped checks. This conclusion concerns the visible statements inspected, not hidden reasoning or every possible interpretation of an abbreviated explanation.

| Requested model / max profile | Selected and reviewed | False explicit claim found | No false explicit claim found | Ambiguous / insufficient to verify |
| --- | ---: | ---: | ---: | ---: |
| `gpt-6-astra` | 24 | 0 | 24 | 0 |
| `gpt-6.1-sol` | 24 | 0 | 24 | 0 |
| Total | 48 | 0 | 48 | 0 |

The two complete runs contain 432 logical outcomes in total. This review inspected 48 explanations and left 384 uninspected. Both models were reviewed on the same **24 distinct function/domain tasks**, covering eight related parameter clusters. The canonical first case in every family/label has parameter index zero, and only logical trial zero was selected. Thus 48 reviewed explanations are neither 48 independent mathematical tasks nor a random response sample.

## Public source binding

Only anonymous reads of the published local API were used. No provider inference, key/access-code read, database mutation, production-code change, grade change or publication change occurred.

| Model | Published run ID | Public response SHA-256 |
| --- | --- | --- |
| `gpt-6-astra` | `2211c494-40a8-4964-9e26-4b1587ee9ce3` | `19ee113cc02f723e5354d643c0998ff5ae9a4927fd5e4570e62ec35eff7c4d1a` |
| `gpt-6.1-sol` | `2923df82-0d17-47d9-9941-569a9f9f1932` | `3887e7999fbaac2abcf69e1e94c5342a63432026596015d2d41a6bca9917173a` |

Both runs used profile `one-shot-json-v2-max` and profile-bound suite ID `suite-challenge-v1-ad8d54145c9cce0b20a25ce00b10ed6c9ec5cf32b54f868b967ca8ebe595b1bf`. They were completed and published before retrieval.

The safe retained aggregate is `apps/api/data/quality/frontier-explanations-v1.json`, 153,212 bytes, SHA-256 `7b1a19e602e557dd95571ce724e17330626d81b9368e9d592d1118f74e4f3c55`. It contains every selected exact explanation and raw model reply, the exact reference, review rationale, and run/suite/case/cluster/trial/attempt identities. Each row pins the raw transcript, explanation, reference, case and inference-result hashes; source response hashes bind them to the retrieved published views. String hashes use exact UTF-8 bytes. Structured-record hashes use recursively key-sorted compact JSON with Unicode preserved. These are content identities, not cryptographically signed provider receipts.

The prospective sample artifact hash is `365b054ed7c46dd4e498b83701613b1a5a21689c96d155fde48fb4f5b9bb5ab4`. The separate assistant's Sol review artifact hash is `ee957a0831bb5fcb7a386317a7bc236d0c9d1487dc5b2eae3e7e9c9bcb830f13`; the safe aggregate retains its per-case conclusions and source pins.

## Mathematical checks

This was an **AI-assisted mathematical review**, with a separate assistant checking the Sol subset. No human expert approval occurred. The reviewers used the exact displayed functions and domains, independently derived derivatives and inequalities, and the earlier [challenge design](challenge-design-v1.md) and [independent reference review](independent-challenge-review-v1.md) as context. Repeating the verifier's classification was not treated as proof of an explanation.

| Family | Reviewed explanations across both models | Explicit claims checked |
| --- | ---: | --- |
| Local logarithm | 6 | Direct quotient differentiation gives `2(1-x²)/(1+x²)²`; positive arguments/denominators and the stated intervals give the claimed signs. |
| Reciprocal exponential | 6 | Differentiating with `t=exp(x)` gives `t(t-1)/(1+t)³`; positivity and monotonicity relative to one establish the signs. |
| Exponential/quadratic | 6 | Twice differentiating gives `exp(x)-1`; the endpoint inequalities and interior sign changes follow from exponential monotonicity. |
| Rational bend | 6 | Twice differentiating gives `2(1-3x²)/(1+x²)³`; exact threshold and interval inequalities check. |
| Softplus/quadratic | 6 | The logistic curvature, its evenness/monotonicity, its `1/4` upper bound, the reciprocal-cosh identity where used, witness arithmetic and displayed decimal rounding all check. |
| Exponential bowl | 6 | Chain/product differentiation gives `(1/2+x²/4)exp(x²/4)-2a`; global bounds and exact interior witness expressions check. |
| Mixed branches | 6 | Both derivative branches, their global bounds, the square-root inequalities, strict witness constants and smooth-domain assertions check. |
| Integrated curvature | 6 | Independent exact rational AST expansion and two coefficient differentiations match the claimed square/expanded polynomial identities, rational witnesses and concave upper bound. |

For the polynomial cases, the reviewers expanded the supplied Horner AST directly using separately written standard-library rational arithmetic rather than importing the application's derivative helpers. The neither witnesses evaluate exactly to `65/65536` at zero and `-1/4096` at `1/4`. The concave bound arithmetic gives exactly

```text
1 + 59/128 - 2885/1024 = -1389/1024 < 0.
```

Independent Taylor sums with positive geometric tail bounds checked the decimal approximations involving `exp(1)`. For example, `exp(1)/(1+exp(1))²` rounds to `0.1966`, and subtracting `7/32` rounds to `-0.02214`. The Astra subset additionally used independently written rational series enclosures for the exponential-bowl inequalities.

Some neither explanations first prove negative curvature at an endpoint and then invoke continuity to obtain negative curvature at strict interior points nearby. This is valid for these functions, which are smooth on neighborhoods of their intervals; it is not an invalid use of an endpoint as an interior witness. The visible endpoint/continuity arguments therefore were not mislabeled as errors.

One Astra explanation describes its displayed negative-coefficient polynomial terms as “negative-power terms.” The terminology is imprecise, but the actual terms are nonpositive on the interval and the explicit inequality and arithmetic are correct. This wording does not substantiate a mathematical contradiction.

## Interpretation and limits

The review found no point counterexample to an explicit visible statement in this fixed sample. It therefore supplies no explanation-error finding and no additional G-SIGNAL evidence. Correct labels remain correct regardless of explanation length, and no official score or gate policy was changed.

Deterministic first-case selection favors a single parameter regime and does not cover the other parameter groups, the other two trials, other profiles, or the separate interior population. A zero observed error count in this sample cannot establish zero error elsewhere, general mathematical reliability, or a causal account of model behavior. No confidence interval or model ranking is inferred from these checks.
