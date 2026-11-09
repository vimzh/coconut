# Additional cheap-model depth screening

Completed **240 fresh API calls**: the same ten certified questions at each requested depth 5/10/20/40/80/160/320/512 on three additional models, one answer per question. Each model has 80 retained model outcomes, with no provider failures, unknown outcomes, retries or unattempted cells. The API batch took **41.885 seconds**.

| Model | Correct / 80 | Accuracy | Macro-F1 / 100 | Wrong valid | Unusable |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | 32/80 | 40.00% | 38.94 | 46 | 2 |
| `gpt-4o-mini` | 31/80 | 38.75% | 34.44 | 45 | 4 |
| `gpt-5.6-luna` | 33/80 | 41.25% | 35.04 | 47 | 0 |

There are **138 wrong valid labels and six malformed completed replies**. No response was truncated or refused. Invalid formatting remains a scoring failure; it is separate from mathematical misclassification. Official grades were not repaired after inspecting explanations.

## Depth results

Each model cell gives **macro-F1 / accuracy**, both on a 0–100 scale. Every depth has ten model outcomes per model. Requested source depth is not exact AST depth or an independently established reasoning-depth measure.

| Requested depth | GPT-4.1 Mini | GPT-4o Mini | GPT-5.6 Luna |
| --- | ---: | ---: | ---: |
| 5 | 31.75 / 40.00 | 52.22 / 50.00 | 46.67 / 50.00 |
| 10 | 24.07 / 20.00 | 31.11 / 40.00 | 52.59 / 50.00 |
| 20 | 39.68 / 40.00 | 25.45 / 30.00 | 58.89 / 60.00 |
| 40 | 41.90 / 40.00 | 31.11 / 40.00 | 30.00 / 40.00 |
| 80 | 52.22 / 50.00 | 11.11 / 20.00 | 15.38 / 30.00 |
| 160 | 45.24 / 50.00 | 33.33 / 40.00 | 19.05 / 40.00 |
| 320 | 34.85 / 40.00 | 46.67 / 50.00 | 15.38 / 30.00 |
| 512 | 31.48 / 40.00 | 29.29 / 40.00 | 15.38 / 30.00 |

These small-sample scores are noisy and do not decline monotonically. The models already perform weakly at the lowest selected setting. This screen does not identify a universal failure depth, measure repeat consistency or establish a general model ranking.

## Cohort and execution settings

The [frozen screening plan](../plans/cheap-depth-screen-v1.md) selects 80 cases from the reviewed 620-task parent: the first source-order cases within each class, three per class plus a rotating extra at each depth. Overall supports are 27 convex / 27 concave / 26 neither. Both highest buckets reuse all ten parent cases. Selection never follows the earlier models’ wrong answers; the same fixed cases go to all three new models. These are reused parent tasks, not a fresh independent holdout.

Each call uses the same neutral exact-expression/interval messages, a private **8,192-output-token / 180-second profile**, no tools and no retry. GPT-5.6 Luna explicitly requests `reasoning.effort: none`; the two legacy non-reasoning models omit that parameter. Reported reasoning usage was zero throughout. The first scored question for each model verifies settings and pins its reported identity without extra paid probes. Subsequent calls use at most 24 aggregate concurrency.

Reported identities: `gpt-4.1-mini-2025-04-14`, `gpt-4o-mini-2024-07-18`, `gpt-5.6-luna`. All three metadata GETs and first scored inference/settings checks passed. Metadata access alone was not treated as inference permission.

This fast profile and 80-case cohort differ from the earlier [620-task maximum-effort study](deep-study-results-v2.md). Their overall scores must not be mixed into one comparable leaderboard. The main landing table and prior study artifacts remain unchanged. The new 240-call authorization is separate from completed Module 15’s 1,865/1,890 accounting.

## Usage and listed-price estimate

| Model | Input tokens | Output tokens | Reasoning subset | Uncached list-price estimate |
| --- | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | 199,576 | 17,821 | 0 | $0.108344 |
| `gpt-4o-mini` | 199,576 | 10,254 | 0 | $0.036089 |
| `gpt-5.6-luna` | 199,496 | 10,306 | 0 | $0.052266 |

Approximate total at uncached listed text-token rates: **$0.1967**. This is a calculation from reported usage, not a returned bill; cache discounts and actual billing may differ. Listed rates were checked against the official [GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-4o Mini](https://developers.openai.com/api/docs/models/gpt-4o-mini) and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) pages. Both legacy models are deprecated but successfully executed all 80 requested calls in this account.

## Evidence and verification

- Study: `cheap-depth-screen-v1-83f98a8e95ba29389eb8bdd7306c00aa796dff0261fc7abc0a95e322aa6f75fc`.
- Freeze: `2026-11-09T00:55:31.341Z`; execution: `2026-11-09T00:55:56.994Z` through `2026-11-09T00:56:38.879Z`.
- Selected-case artifact SHA-256: `93b3519053ee37bf5bb0fd31f554abaf853ad0ec0a6bda40e211fc66bb2b0fa8`.
- Report SHA-256: `e148d3cbf9b520dfb20df2790c69e08600c793dc6477dd707f31ce29085263ab`.
- Rows SHA-256: `53e3637006bdc94fb48d2d2b655e089b473d5f0e30c49fdc81aa58ee48404c9c`.
- Operator byte SHA-256: `561af2cba34bdbdd167eb4c9ab3c39f35a0f5204615ccc44979ca85a82a801f5`.
- Sixteen offline tests/238 assertions, strict TypeScript, ESLint and Bun bundle build pass. Independent code review passed after the persistence-stop path was corrected and covered by a gated peer-drain regression before any paid call.
- All 240 raw results, exact request/reference/receipt bindings and extracted outcomes replay. Independent arithmetic matches overall and all eight depth metrics. All 240 visible responses were inspected, including 96 correct-label explanations. Reviewers retained 27 supported correct-label explanation findings: GPT-4.1 Mini 5, GPT-4o Mini 12, GPT-5.6 Luna 10. These findings remain separate from official label scores; visible-explanation inspection is AI-assisted, not formal proof certification.

Private immutable evidence is retained in `apps/api/data/private/cheap-depth-screen-v1/`, with model audits beside that root. No credential is retained, and no raw expressions/transcripts are published. No main application or frozen API-source changes, deployment or external submission were made.

## User-directed expansion

After this completed screen, the user requested 100 questions per depth and clarified 120 concurrent requests. The [expansion plan](../plans/cheap-depth-expand-v1.md) carries all 240 original results forward into an 800-question/model study and authorizes only the 2,160 remaining cells. This record remains the immutable 80-case measurement and is not relabeled as the expanded study.
