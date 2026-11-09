# Submission checklist audit

Date: **9 November 2026**. Status: **not all checklist items are complete**. The participant explicitly chose to retain the one-response studies without additional trials and will add the video later. No new model calls, retries, upload, agreement acceptance or public publication were performed by this audit.

This record follows the supplied checklist and the [official participant guide](https://hrcdn.net/s3_pub/istreet-assets/R_8vs8ejamSPapSbUxmcWQ/Eval_Hackathon_Participant_Guide.pdf), PDF pages 17–22. All 22 pages were re-read; the rubric and checklist were visually inspected. The [participation agreement](https://www.micro1.ai/hackathon/agreement) was checked separately for packaging and third-party-material requirements. The authenticated portal instructions have not been verified here.

## Item-by-item status

| Item | Status | Evidence or remaining action |
| --- | --- | --- |
| Every task has a reference solution accepted by its grader | Verified for reference-label grading | On the bound 800-case pool, all 800 constructed valid reference-label replies passed extraction and scoring. The 620 cases are a subset. This is not a new proof replay or certification of model explanations. Historical independent mathematical review is linked below. |
| Deliberately wrong answers fail | Verified | Both alternative labels for each of 800 tasks failed: 1,600 wrong-answer controls. |
| All grader rules appear in the task | Repaired for future exact-file CLI runs; historical limitation remains | The old imported prompt omits the literal well-formed-Unicode requirement enforced by the extractor. New CLI requests state it explicitly. Frozen historical prompts and results remain unchanged. |
| Frontier model tested with multiple trials per task | Unmet for the headline studies; no extra trials by user choice | The 620/800 studies each use one response per task. Separate earlier 72-task Astra/Sol runs have three trials and all-correct frontier results; they cannot stand in for repeated trials on the new main population. |
| Participant read failures and can explain them | AI-assisted evidence exists; personal attestation pending | The 620 study reviewed all outcomes and explained one Astra negation/kink-sign error. The fast study inspected 312 visible replies, not all 2,400. The author must personally inspect the submitted examples. |
| README includes reproduction, versions, cost and runtime | Documented with limits | The README now records environments, profiles, commands, measured durations, reported token usage, an estimated fast-screen cost and unknown actual billing. Exact main-task reproduction from the source ZIP alone remains blocked by the excluded source data. |
| ZIP opens, under 50 MB, no videos | Verified for the named existing archive; recheck each final revision | See the archive section. A source-only package is not automatically a scientifically complete evidence package. |
| No credentials or private/confidential material in ZIP | Automated checks passed for the named archive | Configured-key and encoded-key scans plus common-pattern/path review are recorded by the packager. Raw imported data remains excluded. Personal confidentiality review by the author is still required; a pattern scan is not an absolute proof. |
| Prior work disclosed | Documented | The README identifies the external generator, authors, pinned revision and Coconut's contribution. No applicable upstream software/output redistribution license has been established. |
| Public video opens and plays with audio | Pending author | No video URL supplied. The participant will add it later. A pitch page or script is not a verified recording. |
| Description filled in | Draft prepared; portal field unverified | [Description text](description.md) is ready for author review/pasting; no form was edited. |
| Representative transcripts for every reported model | Incomplete | See the six-model inventory below. Raw imported transcripts are retained privately and have not been cleared for inclusion. |
| Participant self-scored against rubric | AI-assisted draft prepared; author adoption pending | [Provisional self-assessment](rubric-self-assessment.md): 60/100, with explicit deductions and completeness gates. |
| Participant personally reviewed every task/reference/rule | Pending author; cannot be checked by an AI agent | Mechanical proof replay, grader controls and AI-assisted inspection do not establish this personal statement. |

## Grader and prompt checks

The [scalar control record](grader-controls.json) binds the full population hash and 2,400 constructed extraction/scoring comparisons. It includes no task bodies or model replies. One known reference label and two deliberately wrong labels were checked for every admitted task using the real extractor and classifier. A generic nonblank explanation was supplied because explanatory correctness is not scored. The controls were not presented to a model and are not extra trials.

The existing [full-pool reference review](../handoffs/15-deep-composition-stress-evaluation.md#original-freeze-and-calibration) records independent replay of all 800 certificates and 656 Jensen gaps. This audit did not repeat every numerical proof or claim personal human review.

Fresh offline protocol/scorer/replay checks passed **177 tests / 1,665 assertions**. The future-CLI repair passed **32 CLI tests / 1,157 assertions**, CLI lint, strict types and a Bun bundle build. Regression checks verify the explicit Unicode instruction appears in both retained manifest requests and sent wire bodies. No live provider was contacted.

The repair changes only newly built exact-file CLI system messages. Those actual messages are included in each request SHA-256 and the durable manifest; dispatch/attempt files bind that request hash. The existing protocol/profile identifiers still describe the answer format and generation settings, not an assertion that every prompt byte is unchanged. Historical research builders, API source and operator bytes were not edited. New CLI runs must not be described as exact historical-prompt reproductions.

## Transcript inventory

| Reported model | Main population | Attempts / returned model outcomes | Private evidence | Representative transcript packaged |
| --- | ---: | ---: | --- | --- |
| GPT-6 Astra | 620 | 620 / 613 | Retained, independently audited | No; permission unresolved |
| GPT-5.4 Mini | 620 | 620 / 616 | Retained, independently audited | No; permission unresolved |
| GPT-6 Luna | 620 | 620 / 615 | Retained, independently audited | No; permission unresolved |
| GPT-4.1 Mini | 800 | 800 / 800 | Retained, mechanically replayed | No; permission unresolved |
| GPT-4o Mini | 800 | 800 / 800 | Retained, mechanically replayed | No; permission unresolved |
| GPT-5.6 Luna | 800 | 800 / 800 | Retained, mechanically replayed | No; permission unresolved |

The [620-task results](../research/deep-study-results-v2.md) and [800-task results](../research/cheap-depth-expand-v1.md) disclose their actual review scopes. Existing public transcripts from earlier own-task studies do not cover these six main-model/task/settings combinations. Do not substitute a synthetic answer or an unrelated model's transcript. Never invent a failure for a task on which all retained trials succeeded.

## Archive checks

The already-packaged source revision `40d834617b90bff49fe65f9b36d49f6bf27f5006` is `coconut-submission-40d8346.zip`, outside the repository. Packager evidence records **29,211,808 bytes**, **840 files**, CRC/path/video exclusions and a scan of all **154,790,297 uncompressed bytes** for the configured credential and encoded variants, with zero matches. Archive SHA-256: `36458fc443282bc7e14e5a255b34941734266d15efc62e3527f54998b3c41d25`.

That archive predates this readiness checkpoint. Its immutable sidecars remain separate; a later archive must be made from the completed commit, extracted/tested, checked below **50,000,000 bytes**, and rescanned. Do not overwrite or relabel the earlier ZIP as containing later changes. Exclude `.git`, `.env*`, root local `AGENTS.md`, installed dependencies, build output, private evidence, credentials and videos. New readiness documents contain safe aggregate/status metadata only.

## Cost, attribution and author actions

The README's approximate $1.95 fast-screen estimate was checked on **9 November 2026** against the official [GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-4o Mini](https://developers.openai.com/api/docs/models/gpt-4o-mini) and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) pricing pages. It uses uncached input/output rates of $0.40/$1.60, $0.15/$0.60 and $0.20/$1.20 per million tokens, respectively, and the retained usage. It is not an actual bill. Reasoning-study billed costs and usage on unknown remote work remain unknown.

The [pinned upstream README](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/README.md) credits Yepeng Liu, Yu Huang, Yu-Xiang Wang, Yingbin Liang and Yuheng Bu. The external generator predates this project. The participant's statement that Coconut is a new project does not establish permission for incorporated third-party raw material; retain the [existing exclusion boundary](../research/upstream-import-integration-v1.md#provenance-and-permission) until applicable rights are documented.

The author still needs to add and test the public video/audio link, adopt or revise the description and rubric estimate, confirm personal review/confidentiality, and resolve whether transcript/task inclusion is permitted. The single-trial choice is preserved explicitly. These unresolved items must not be ticked as complete merely because the source ZIP is valid.
