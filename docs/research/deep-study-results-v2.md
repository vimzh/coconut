# Deep function evaluation: terminal descriptive results

The same **620 certified functions** were attempted once on Astra, Mini and Luna: 100 at requested depths 5/10/20/40/80/160 and ten at 320/512. All **1,860 final attempts** are retained. Sixteen infrastructure outcomes remain unknown, so model scores are provisional and the exported study state is incomplete. No question was retried or replaced.

| Model | Macro-F1 / 100 | Accuracy | Correct / model outcomes | Wrong valid | Unusable | Infrastructure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Astra | 99.76 | 99.67% | 611/613 | 1 | 1 | 7 |
| Mini | 50.27 | 34.74% | 214/616 | 20 | 382 | 4 |
| Luna | 56.09 | 41.46% | 255/615 | 28 | 332 | 5 |

Unusable model replies remain scoring failures. Infrastructure outcomes are excluded from model-score denominators and remain visible in coverage. There were 705 token-limit truncations and ten malformed completed replies; no refusals or identity failures. The 16 unknown outcomes comprise 12 approved transition cancellations and four later Astra timeouts.

## Requested-depth results

Each model cell below gives **macro-F1 / accuracy**, both on a 0–100 scale. Requested generator depth is separate from realized D/D+1, raw AST depth and nonlinear-path length.

| Requested depth | Tasks/model | Astra | Mini | Luna |
| --- | ---: | ---: | ---: | ---: |
| 5 | 100 | 100.00 / 100.00 | 98.41 / 97.00 | 98.46 / 97.00 |
| 10 | 100 | 100.00 / 100.00 | 68.38 / 56.25 | 94.60 / 92.63 |
| 20 | 100 | 100.00 / 100.00 | 50.36 / 38.00 | 56.53 / 44.00 |
| 40 | 100 | 99.00 / 99.00 | 14.56 / 8.00 | 9.17 / 5.00 |
| 80 | 100 | 100.00 / 100.00 | 19.22 / 12.00 | 11.85 / 8.00 |
| 160 | 100 | 100.00 / 100.00 | 5.80 / 4.00 | 14.52 / 11.00 |
| 320 | 10 | 100.00 / 100.00 | 11.11 / 10.00 | 16.67 / 10.00 |
| 512 | 10 | 95.24 / 90.00 | 0.00 / 0.00 | 11.11 / 10.00 |

Astra has three infrastructure exclusions at requested depth 10, three at 160 and one at 320; Mini has four at 10, Luna five at 10. All other strata have their full model-outcome denominators. Astra’s depth-512 result includes one truncation and nine correct responses. Counts and disclosures are available in the [public aggregate](../../apps/web/public/deep-study-scores.json).

## Verified mathematical error and explanation review

Astra’s single wrong valid label is at requested depth 40: case `final-358977cdd4e11bee28ab04f40b800a746c6e13825383d871e292df43d62f417e`. It answered neither for a strictly convex function. Its explanation missed a negation around a negative absolute-value term and consequently reversed a derivative-jump sign. Fresh proof replay reproduced the retained strict-convexity trace; a separate root sign trace corroborated the error. This is a completed mathematical misclassification, distinct from its depth-512 truncation and infrastructure timeouts.

All 1,860 result/receipt/reference/request inventories were reconciled. Reviewers diagnosed every one of the 764 wrong/unusable model outcomes and inspected all 1,080 correct-label explanations. They recorded 42 concrete explanation findings on correctly labeled replies: Astra 0, Mini 8, Luna 34. These findings leave official label grades unchanged. The review was AI-assisted, covered visible explanations and did not access hidden reasoning or formally certify model explanations.

## Population, settings and execution

The [implementation handoff](../handoffs/15-deep-composition-stress-evaluation.md) preserves construction, independent reference replay and exact reproduction commands. The pinned external source revision is `6f156c8c9b6b0b85f6a191bd4eb912e12e670082`; source provenance and prior-work attribution remain in the [generator research record](randomized-evaluation-design-v1.md). No external generator code was vendored. Exact displayed coefficients and the interval `[-1,1]` determine each reference; source labels are not trusted.

The 800-case reviewed source pool was constructed from 3,444 retained proposals without model feedback. User amendment A-15-02 reduced the two highest final buckets during execution, when all high-depth cases were unattempted. A fixed source-order label-balanced prefix selected the final 620; supports are 207 convex, 207 concave and 206 neither. Every prior authorization was kept. Every model received the same cases and neutral instructions with its frozen research profile. Certifiability filtering and related mathematical structures limit inference beyond this population.

Profiles reserve 32,768 output tokens and 600 seconds: Astra max, Mini xhigh, Luna max. Reported identities were `gpt-6-astra`, `gpt-5.4-mini-2026-03-17` and `gpt-6-luna`. Equal token ceilings do not establish equal compute. There were no SDK retries or task replacements.

The original run used 12 workers and stopped at 562 attempts under explicit user approval, retaining 12 cancellation records. The continuation used 120 concurrent requests and took 44 minutes 51 seconds; no rate-limit fallback occurred. All 1,298 remaining cells were authorized before the final timeout stop, and active calls drained. The terminal ledger has zero unattempted or active cells. Four timeouts retain unknown remote outcomes. Final plus shared-development accounting is **1,865 sends / 1,890 ceiling**, including five development sends.

| Model | Reported input tokens | Output tokens including reasoning | Reasoning subset | Usage coverage |
| --- | ---: | ---: | ---: | ---: |
| Astra | 744,220 | 5,603,451 | 5,436,853 | 613/620 |
| Mini | 759,278 | 17,148,153 | 17,112,760 | 616/620 |
| Luna | 758,975 | 14,233,716 | 14,170,927 | 615/620 |

These token sums cover final-attempt reported usage only; reasoning is already included in output. Missing usage and billing on unknown remote work remain unknown. Billed dollar costs were not returned.

## Evidence identities and limits

- Study: `deep-study-amendment-v2-2f659b4df73d9ad6786e71c1508ef4ae852f361f5385d4c5392234cf0d32ca46`.
- Selected cohort SHA-256: `445d5ab064e3b1c69a99d253f8e519dc0f6e901b5583fe05ab3dc4146cf8feb8`.
- Terminal report SHA-256: `0d2364a9562aadbd25992a314d50602143e4ab1bf3d06afd16cb6efcf614f2a1`.
- Merged rows SHA-256: `50719c47c2c3db8d1f1c1dbbc6dc8727bb27536624325d70381d24ad48ec0f07`.
- Independent Python arithmetic matches all overall/per-depth confusion counts, class metrics, accuracy and fixed-three-class macro-F1. Three post-terminal model audits bind every result and diagnosis. The public artifact contains aggregates only.

This is a single-trial, exploratory, unranked study. Scores need not decrease monotonically with requested depth. Ten cases in each highest bucket give limited coverage; related cores, input length, source distribution, simplification and output/runtime budgets confound a causal depth interpretation. Training nonexposure and full semantic inequivalence remain unknown.

The verified Astra response establishes one observed error, without establishing repeat consistency, a universal failure depth or D-12’s stronger repeated-error G-SIGNAL criterion. Historical verdicts and ordinary visitor profiles remain unchanged. The visitor workbench is still the separate 27-task, three-response workload. Raw expressions, source outputs, reference evidence and transcripts remain private while redistribution clearance is unresolved. No deployment or external submission was performed.

## Delivery verification

The actual aggregate passes all 86 web tests, lint, type checking and the production build; the continuation operator passes 15 tests/152 assertions, strict TypeScript, ESLint and bundle build. Independent production-browser QA checked all 27 score cells and all outcome disclosures against the served JSON at desktop width 1440 and mobile width 390. The page has one table, correct 100/10-task headers, keyboard/wheel access through depth 512, a visible sticky model column and no document overflow or console errors. A nonblocking CSS-preload timing warning remains; the separate workbench/provider flow was not launched by this final read-only QA. Documentation consistency and all local links passed review.
