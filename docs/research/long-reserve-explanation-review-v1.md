# Long-reserve visible-explanation review

No substantiated false mathematical statement was found in the **69 valid visible explanations** from the terminal `long-reserve-v1` diagnostic. Every valid explanation was read and checked against its exact function and domain. The separately reviewed, nonempty truncated prefix also contained no detected false mathematical statement in the portion actually visible. It remains incomplete and unusable. **No label grade changed.**

This was an **AI-assisted independent mathematical review**, with no human approval. The reviewer made no inference request, accessed no credential or database, and edited no application source. Only the assistant-visible explanations and the stated mathematical claims were reviewed; hidden reasoning was not available or inferred.

The [machine-readable review](../../apps/api/data/quality/long-reserve-explanation-review-v1.json) has canonical SHA-256 `5fbf001c7254ed7567bd0b6210f01eed97c66ab603784f157a86b691c7b199ad`. It retains one record for each valid explanation, full result/transcript/raw-response/visible-text/explanation hashes, exact case and trial identities, the independent verification program, and a separate record for the excluded prefix.

## Terminal population and bindings

The review was finalized after the ledger reached `settled` at **2026-11-08T11:47:33.603Z**, following all 108 planned diagnostic trials. Earlier prefixes were reviewed incrementally in temporary notes; they were not presented as final results.

| Requested model | Valid visible explanations reviewed |
| --- | ---: |
| `gpt-6-astra` | 36 |
| `gpt-6.1-sol` | 33 |
| Total | 69 |

These explanations cover 16 distinct cases. The group-zero reciprocal concave case and group-zero square-root convex case have no valid visible explanation in this cohort. All 18 mathematical references were nevertheless independently checked. The population has three nonlinear outer families and only **two related source groups**.

The [separate raw/outcome audit](../../apps/api/data/quality/long-reserve-study-review-v1.json) owns normalization, extraction, counts and send reconciliation. It records 39 unusable truncated outcomes: 38 empty and one nonempty prefix. This mathematical review does not reinterpret them as completed answers or mathematical label errors.

| Bound artifact | Canonical SHA-256 |
| --- | --- |
| Frozen manifest | `ba30c68369f40a118c96bca133c6ec1d4ab6445b15d37840edec0b6c6e6d2c63` |
| Final ledger | `039ab71a303ae17e7dede4e9f7771b4b3a3b9971831261fc7635450e52a0492d` |
| Independent primary reconciliation | `8e3e9b9d4c969699bffaf5b57b2c317421d6b20fcb59529201403a76ff53d2b9` |
| Independent send evidence | `166c9a2478082e554054a4a6b09db4e7426199d6d632a941bf37b1f0c81ca4b2` |
| Independent raw/outcome review | `706d3f5a336b0950b2e941aff967c2299a2f49eaffb85ab4ad6477076bff57c0` |
| Prior independent reference review | `2c69ff774dce5b6b90f0b1d3c709d7bd102b4e4cca1aefed2dcb6564ccd851e3` |

The frozen max-profile suite hash is `b2fd0b0c50d35ed3309eca8f80cfaee61529caa6579e3c64b530755b5beb8811`; its reference fingerprint is `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`. Hashes of the read reserve factory, reference, contracts and replay sources are retained in `bindings.sourceFiles` and match the prior independent reference-review snapshot. Full-result hashes for the reviewed explanations were checked against both the final ledger and the separate [research publication](../../apps/api/data/experiments/long-reserve-progress-v1-research-published/index.json).

## Independent mathematics

Write

\[
p_0(x)=4x(x^2-1/16)(x^2-1/4)(x^2-9/16)(x^2-1),
\qquad p_1(x)=(x-1/8)p_0(x),\quad q=p_j^2,\quad u=1+q.
\]

Every supplied interval is `[-1,1]`, and `u>=1`. The logarithm, reciprocal and square root are therefore smooth on the full interval. The reviewer independently expanded both source polynomials and checked all 18 complete AST/domain/coefficient/label bindings.

For an added quadratic term `a x²`, the derivatives used to check the explanations are:

| Outer expression | Second derivative |
| --- | --- |
| `log(1+q)+a x²` | `q″/u − (q′)²/u² + 2a` |
| `1/(1+q)+a x²` | `−q″/u² + 2(q′)²/u³ + 2a` |
| `sqrt(1+q)+a x²` | `q″/(2sqrt(u)) − (q′)²/(4u^(3/2)) + 2a` |

An independently written Python standard-library `Fraction` implementation reconstructed all six degree-34/38 curvature numerators and the **39 exact Bernstein cells** from the reference construction. These establish the 12 strict global convex/concave references. All 12 strict interior reference witnesses for the six neither cases were independently checked. This computation did not import the application's polynomial helpers or rerun its differentiation engine to obtain the expected identities.

The review also checked the actual arguments appearing in the visible answers:

- Both exact Chebyshev expansions of `q″`, including the displayed coefficient vectors, scaling factors and bounds `99225/8192` and `8037225/524288`.
- The stated half-interval Bernstein maxima and `R/P/C` ranges, and the 128-cell and 512-cell bounds on `q′` and `q″` used for global curvature signs.
- The longer convex logarithm proof using the exact source expansion, cubic-root locations, an AM–GM bound and the strict rational inequality `(132/23)(7/8)^8<2`.
- The reciprocal proof using a local degree-ten Markov bound and nonnegative outer-region coefficients. All 19 finite inequalities for `(t^k(1−t)²)″<=2`, for the needed `k=0,...,18`, were checked by exact Bernstein covers on `[0,1]`.
- The alternative positive-polynomial identity bounding the group-zero square-root curvature.
- The exact root and chord fractions, values at `±7/8` and `9/10`, displayed finite decimal derivatives, and strict second-derivative signs. A rational square-root enclosure independently checks the rounded group-one witness `f″(-15/16)≈-1.716`.

The Jensen arguments use two opposite strict midpoint inequalities on points in the stated interval. For example, the positive square-root gap follows by squaring positive quantities: `p²>1/1024` implies `sqrt(1+p²)>1+1/4096`. A finite probe alone was never treated as a global convexity proof.

Some explanations state a certificate without printing every coefficient. Those assertions were reconstructed or independently corroborated. One explanation invokes a zero Sturm root count without displaying its sequence; strict exact Bernstein positivity of that same polynomial independently proves that it has no roots on the interval. The absent sequence is a presentation limitation, not a demonstrated false mathematical claim. This review makes no assertion about whether the model actually executed any named algorithm.

## Separate excluded-prefix review

The one nonempty truncated prefix is Astra attempt `9703d683-9bc9-44d1-b0af-98070aeaa274`, group-one square-root concave case, trial 2. Its visible text has 382 UTF-16 code units and SHA-256 `e1574ebe82e752d787044ac3e909404523bc0324a5390f844751623757aeee6a`.

The prefix correctly factors `p₁`, states smoothness, and defines `S=(p₁′)²+p₁p₁″`. Its first 11 listed Chebyshev coefficients for `2^25 S(-x)` agree exactly with the independent expansion, since `S=q″/2`. The coefficient list, explanation and JSON stop before completion. No missing continuation was supplied, no label was salvaged, and the outcome remains truncated/unusable. The raw/outcome auditor independently reached the same conclusion for this finite prefix.

## Reproduction and limits

The JSON review contains the complete standard-library verification program and its SHA-256. From the repository root, its independent calculations can be replayed without credentials, network access or native model calls:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
review = json.loads(Path("apps/api/data/quality/long-reserve-explanation-review-v1.json").read_text())
source = review["verification"]["source"]
assert hashlib.sha256(source.encode()).hexdigest() == review["verification"]["sourceSha256"]
exec(compile(source, "<independent-explanation-verification>", "exec"))
PY
```

The replay reads the retained default-profile reference artifact; its mathematical cases and certificates are identical to the frozen max-profile members. Prompt and full-result bindings are separately retained in each review record. The final review also checked all valid-result hashes against the terminal ledger and published research populations.

This is a qualified finite-population finding by an AI reviewer, not human expert approval, a formal natural-language proof verifier, or a guarantee that no possible issue was missed. Empty outputs provide no visible mathematical explanation. Opaque encrypted reasoning was neither decrypted nor used as evidence. The 600-second research diagnostic remains separate from the 180-second platform contract and supplies no ranking, confidence interval, stronger G-SIGNAL claim, or general statement about model reasoning.
