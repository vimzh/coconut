# Nested-composition comparison results

The frozen exploratory comparison completed exactly 162 requests in 352.383 seconds: two requested models × 27 fixed tasks × 3 fresh trials. All 162 dispatches settled; there were zero provider/infrastructure failures, unknown remote outcomes or retries. Conservative accounting advances from 8,511 to 8,673 under the separately authorized 162-send scope; historical caps remain unchanged.

| Requested model | Macro-F1 /100 | Correct /81 | Wrong valid labels | Truncated |
| --- | ---: | ---: | ---: | ---: |
| GPT-5.4 Mini | 34.2 | 30 | 51 | 0 |
| GPT-6 Luna | 86.0 | 65 | 5 | 11 |

These are final-label grades with the original strict extraction and unusable-response policy. There were no malformed/refused responses. Luna's eleven truncated outcomes each reached 4,096 reported output tokens: eight had no visible text and three had incomplete prefixes. They count as unsuccessful returned outcomes, not mathematical mistakes. The reported macro-F1 differs from accuracy.

| Nonlinear stages (AST depth) | Mini F1 /100 | Luna F1 /100 |
| --- | ---: | ---: |
| 2 (7) | 36.7 | 96.3 |
| 4 (13) | 24.8 | 88.5 |
| 6 (19) | 40.3 | 70.3 |

Each stage slice contains nine tasks, three per class, repeated three times. Models received identical expressions, domains, prompt version and 4,096-output-token ceiling through fresh one-shot requests. Provider-default reasoning does not establish equal compute. The full 27 tasks share nine base-chain groups and two atoms; they are not 81 independent functions. Mini's nonmonotonic scores and the function/range/length changes preclude interpreting these columns as a causal depth curve.

## What changed

The [new construction](composition-design-v1.md) uses successive Q/R nonlinear atoms, not associative sums. Exact rational derivatives, global monotonic-curvature reasoning, an independently authored Python Fraction checker and the unchanged native whole-domain numerical certifier agree for all 27 references. Every sequence/stage includes all three classes with the same outer expression form. The suite is available in the normal evaluation interface as recommended `composition-v1`, exploratory/unranked.

The historical depth 60/100/216 evidence remains untouched. Landing headers and notes now explicitly call those structural-depth pilots, explain the associative shortcut, and present the new composition results in a separate table. Methodology, README and public suite previews identify the new workload. This is a repair to construction and interpretation; it is not a reproduction of a prior study, a general-purpose composition benchmark or a promise of failures on arbitrary newer models.

## Outcome review

AI-assisted submitted-text review inspected all 56 wrong valid labels and all 11 truncations, bound to original reply/case/trial hashes. Mini has 50 replies with asserted mathematical errors and one label/prose inconsistency without a confirmed asserted explanation error. Eight Mini replies have overlapping label/prose contradiction flags. Luna's five wrong valid replies contain asserted errors: two miscounted the chain, one used an incorrect endpoint denominator, one dropped a factor four during rational simplification, and one used an incorrect derivative value. Correct-label explanations were not qualitatively audited. Review was performed by the composition implementation agent, while reference validation used a separately authored implementation; no human expert or proof-assistant approval is claimed.

Safe review counts/hashes are in `apps/api/data/quality/composition-transcript-review-v1.json`; original records and detailed reviews remain ignored under `apps/api/data/private/composition-v1/`.

## Reproduction and verification

- Freeze: `apps/api/data/experiments/composition-matrix-v1.json` binds population, prompts, execution sources, SDK patch/lockfile, numerical worker and independent audit scripts before dispatch.
- Terminal evidence: `apps/api/data/experiments/composition-progress-v1.json`; includes native reports, all model run identities, counts and original record hashes.
- Independent references: `python3 docs/research/composition-reference-review-v1.py` replays 27 references and a coefficient-tamper rejection.
- Independent results: `python3 docs/research/composition-results-audit-v1.py` reconstructs confusion matrices, overall/stage F1 and all 162 dispatch receipts from private originals; pass. Perfect/majority-only/all-unusable boundary fixtures also pass.
- Safe public projection: `apps/web/public/composition-scores.json`, exactly matched to the audit by a frontend regression test.
- API: 747 tests pass; lint/typecheck/build pass. An initial runtime-catalog expectation still assumed six suites; the focused production-bundle test and full suite both pass after updating it for seven.
- Native numerical worker: 29 tests pass. Web: 76 tests, lint/typecheck/build pass. The new frontend test initially used the backend test runner import; corrected to the established Node test convention before final passing checks.
- Local production desktop 1280px/mobile 390px browser checks verify both score rows, correct stage labels, wrong/unusable counts, explicit historical headers, horizontal table scrolling and no page overflow or alert elements. API catalog returns the new suite as recommended. The saved historical records remain unchanged.

Live calls are terminal; no further calls are planned. The fixed small population, coefficient cues, shared atoms/prefixes, range contraction, default-compute differences and output-limit confounds remain material limits. Results support inspected counterexamples on these tasks, without ranking, a universal failure depth or general mathematical reliability claims.
