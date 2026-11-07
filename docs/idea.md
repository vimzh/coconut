# Convexity Evaluation Platform

## In One Sentence

A web platform where people use their own model-provider credentials to test how reliably language models identify the convexity of nested mathematical expressions, inspect the results, and compare performance on a leaderboard.

## The Idea

The project combines a mathematical evaluation engine, a model discovery and inference layer, and a user interface. The evaluation asks whether a function is convex, concave, or neither over a stated domain. Its difficulty changes with the depth of composition, meaning how many levels of functions are nested inside one another.

This is the product source of truth for the project currently named Coconut in the repository. The descriptive title above is a working title, not a finalized public brand. Detailed measurement, privacy, and publication choices remain open below.

## The Problem

A model can recognize familiar mathematical operations yet make mistakes when many operations depend on one another. A useful evaluation needs trustworthy reference answers, consistent instructions, and scores that show where performance changes with difficulty. Comparing models also requires knowing which model and serving provider actually produced each answer.

## Who It Is For

People who want to evaluate and compare language models on this convexity task. Visitors can explore the benchmark and leaderboard; people running evaluations supply their own provider credentials and cover the associated provider charges.

## Core Experience

A visitor reads how the evaluation works, connects a supported provider with their own credentials, searches for an available model, selects an evaluation configuration, and launches a run. The interface lets them follow execution and inspect model answers and scores. The leaderboard lets visitors compare eligible results under a defined comparison protocol.

The exact rules for publishing a visitor's run, accessing saved results, and retaining those records must be decided before those experiences are implemented.

## Features

### Evaluation engine

- Generate expressions at controlled composition depths with explicit input domains and verified reference labels.
- Turn expressions into clear model prompts while keeping reference labels and validation evidence out of the model input.
- Extract a model answer into convex, concave, or neither under a defined answer policy.
- Compare answers with the reference labels using pooled macro-F1, accuracy, and class detail overall and by depth. The first protocol uses three fresh trials; unusable replies count as failures, infrastructure/missing work stays separate, and incomplete scores remain provisional or unavailable. Report trial spread and agreement with their eligible populations.
- Preserve the evidence needed to inspect the mathematical task, the model's returned answer, and the reported score.

### Model discovery and inference

- Let visitors supply their own credentials instead of spending a shared project key.
- Support OpenAI, OpenRouter, and Hugging Face Inference Providers.
- Let users search Hugging Face models and run supported ones through Inference Providers.
- Distinguish catalog discovery from execution availability and check compatibility with the chosen evaluation configuration.
- Record the model and provider used, generation settings, returned usage information, timing, and execution failures.

### Evaluation interface

- Provide a user-facing flow for connection, model selection, evaluation setup, execution progress, and result inspection.
- Explain missing credentials, unsupported models, incomplete runs, and provider errors clearly.
- Keep visitor credentials out of public views, saved transcripts, and logs. D-06 uses explicit credentials per foreground operation, no server persistence or owner-key fallback, and future current-page-only UI state with re-entry after refresh/restart.

### Leaderboard

- Provide a public page for comparing eligible model results.
- Make the benchmark version, evaluation configuration, and completeness of the underlying evidence understandable.
- Set publication, eligibility, and repeated-run aggregation rules before accepting ranked entries.

### Landing page

- Explain the full evaluation in original, accessible language, including the task, difficulty, validation, scoring, and how to interpret results.
- Do not mention the paper on this page, as requested.
- Keep claims consistent with the actual implemented protocol and measured results.

## Required Environment and Compatibility

The initial product is a website. Model execution uses the supported hosted services listed above; Hugging Face execution uses its Inference Providers service. A model being searchable does not by itself establish that the visitor can run it. Access depends on the selected service, credentials, model availability, permissions, and evaluation requirements.

## Success

The complete journey works: a visitor can understand the benchmark, use their own supported credentials, select a runnable model, execute an evaluation, and inspect correctly calculated results. Visitors can compare eligible results on the leaderboard and understand which comparisons are meaningful.

The benchmark's labels and scoring can be independently checked, and the submission's main results can be reproduced from documented inputs and settings. A successful run is not a promise that a particular model will fail.

## Principles

- Mathematical correctness and honest reporting take priority over impressive scores.
- Provider failures, unsupported capabilities, and incomplete evidence must remain visible.
- Credentials must not leak through the product or its records.
- Keep the public interface restrained, functional, and clear.
- Develop the project through bounded modules, isolating work that needs substantial reasoning.

## Constraints and Assumptions

The project is intended for the micro1 Eval Hackathon. [hackathon.md](../hackathon.md) records the researched requirements and their verification limits. Submission materials must disclose adapted prior work and distinguish the project's contribution. The landing-page content restriction does not remove that submission requirement.

The existing application scaffolding is the starting point. The mathematical verifier, offline evaluation protocol, reproducible suite generator, and shared scorer are implemented within the boundaries recorded in the [module 01 handoff](handoffs/01-mathematical-verifier.md), [module 02 handoff](handoffs/02-evaluation-protocol-and-answers.md), [module 03 handoff](handoffs/03-instance-generator-and-suites.md), and [module 04 handoff](handoffs/04-scoring-and-depth-analysis.md). The frozen reference suite contains 75 certified cases across three classes and depths 5, 10, 20, 40, and 80 on `[-1,1]`. These depths also increase length and active pieces, so they do not isolate nesting alone. The scorer verifies retained evidence and reports metrics plus usage/timing/cost coverage; current scoring fixtures are synthetic. The [module 05 provider-access layer](handoffs/05-provider-access-and-credentials.md) implements stateless credentials, authentication checks, and bounded explicit probes for all three services. OpenAI has live access evidence; OpenRouter and Hugging Face gates remain unresolved under OpenAI-only development testing. Model discovery, complete inference/run execution, user flow, and measured leaderboard are not implemented yet.

## Critical Assumptions to Prove

- We can generate a useful range of increasingly deep expressions whose domains and three-way reference labels are defensible, including cases that are not convex or concave.
- Visitors can execute the evaluation through each promised hosted service without exposing credentials or misrepresenting provider capability.
- The resulting benchmark can expose a meaningful limitation in available frontier models, rather than only ambiguous tasks, parsing artifacts introduced by our own system, or errors in our grader. This requires new evidence; the paper's results do not establish our results.

## Open Questions

- How are saved runs accessed, retained, and published? Is leaderboard publication automatic or an explicit visitor action?
- Which complete runs are eligible for ranking, and how are repeat runs of the same model and configuration represented?
- What model/provider information can each service actually supply, and how will unavailable identity, pricing, usage, or compatibility information be presented?
