# Conditional reserve: operational amendment

Recorded at **2026-11-08T08:55:34.754Z**, while both P5 cells were still running. This is an explicit amendment after partial exposure, not a claim that the strongest literal reading of the original condition was fulfilled.

The [original condition](conditional-reserve-v1.md) remains unchanged:

> BOTH P5 exploration cells finish 216/216 valid correct labels, with no infrastructure failures or unusable outcomes, AND no actual frontier classification error has occurred. Only then may the root coordinator consider this fixed 18 tasks × 3 trials × 2 models = 108-call follow-up; it is never an automatic launch authorization. If P5 is incomplete or has errors, this branch remains dormant research and is not automatically authorized.

The 11 unavailable original frontier outcomes cannot establish absolute absence of actual errors. The operational condition for future consideration is:

> Only after BOTH frozen P5 cells complete all 216 planned trials as valid, correct answers, with no infrastructure or unusable outcomes, may the coordinator consider the unchanged fixed 18-task follow-up, provided no valid wrong label has been observed in the defined retained frontier population through the assessment cutoff. The 11 baseline requests with unavailable outcomes remain unknown and included in conservative request accounting. This condition never authorizes an automatic launch.

The checked population is all returned retained benchmark outcomes for the two declared frontier IDs in original v1, replication v2 and both P5 cells through the eventual terminal assessment cutoff. The baseline contains 1,402 valid correct returned labels and zero observed wrong labels; its 11 unknown remote outcomes remain unknown. Controls are separate and do not become evaluation scores.

## Exposure at adoption

| Requested model | Returned trials | Correct labels | Wrong labels | State |
| --- | ---: | ---: | ---: | --- |
| gpt-6-astra | 140/216 | 140 | 0 | running |
| gpt-6.1-sol | 148/216 | 148 | 0 | running |

These are partial observations, not complete scores. Exact active-record hashes, progress and outcome-kind counts are retained in [the amendment record](../../apps/api/data/research/conditional-reserve-amendment-v1.json), canonical SHA-256 `5ab07c79467049062a5c01a538a9d88cb5c33e0bf041cdb462b6c6249b2d9e5a`. The snapshot used only the two authorized read-only SQLite payloads, with no credential/access-code read, inference request, publication change or process mutation.

The fixed 18-task proposal remains byte-identical at SHA-256 `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85`; it predates all P5 inference. No runtime suite, reserve manifest or reserve call is created by this amendment. Both P5 cells must still finish all 216 trials with valid correct labels and no unusable/infrastructure outcomes before the coordinator may consider a separately reviewed, versioned and frozen reserve experiment.

This remains adaptive exploration after observed ceiling performance. It changes no label, score, membership, historical outcome, D-12 threshold, 8,192-send ceiling, ranking policy or uncertainty requirement. The reserve remains unranked, has no eligible confidence interval and cannot inherit confirmation status. Unknown outcomes are not inferred correct and are not treated as free requests.
