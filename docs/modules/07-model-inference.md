# Module 07: Model Inference

## Status

Dependent

## Type

Foundation

## Purpose

Execute an individual model request consistently across the promised services while preserving enough evidence to distinguish a model answer from an execution failure.

## Finished Outcome

A compatible selection can produce one recorded inference outcome through OpenAI, OpenRouter, or Hugging Face Inference Providers. Actual identity, settings, response, usage when supplied, timing, and failures remain inspectable without exposing visitor credentials.

## Why It Comes Here

The request contract comes from 02, credential boundaries from 05, and compatibility from 06. This module owns individual calls. Module 08 later coordinates instances, repeated trials, and any multi-step reasoning method.

## Prerequisites

- Completed module 02 handoff with D-02 and D-03 resolved.
- Completed module 05 handoff with D-06 and required G-PROVIDERS verdicts.
- Completed module 06 handoff with D-07 resolved.

## Build Readiness Gate

Confirm prerequisite handoffs describe tested services, permitted selections, required settings, model-visible content, budgets, and credential expiration. Resolve D-08 before module 08 uses inference behavior. Agree shared file ownership before implementation; discovery success alone does not establish executable access.

## Scope

### Included

Individual requests, faithful response evidence, provider differences, actual usage and timing, request cancellation, timeout behavior, and bounded retry rules.

### Not Included

Reference generation, answer grading, scoring, suite scheduling, repeated-trial orchestration, multi-step method coordination, saved-run policy, and user-interface implementation belong to their respective modules. No shared project key funds visitor calls.

## Detailed Work

### Faithful execution

Use the selected service, compatible model, and approved generation settings. Preserve the model-visible prompt supplied under 02 without including reference labels, certificates, or scoring evidence. Distinguish requested settings from effective values reported by the service; unsupported or unverified requirements follow D-07.

Reject incompatible parameters clearly. Never switch models, change methods, omit settings, or route through a different service implicitly to make a request succeed. If availability changes after discovery, return an actionable execution outcome for the run owner to handle.

### Response evidence and provider differences

Retain returned answer content and the information needed to apply D-02. Preserve refusal, truncation, empty content, provider rejection, unavailable output, and transport failure as distinct evidence where supported. A successful provider exchange does not establish a usable benchmark answer.

Record requested and reported identities under D-07, generation settings, elapsed time, returned usage, and relevant completion information. Unreported usage and pricing remain unknown. Avoid inventing token totals, effective settings, cost estimates, or serving identities. Separate provider failure evidence from the mathematical verdict that module 04 will later score.

### Cancellation, timeouts, and retry

Resolve D-08 using observed service behavior. Define when a request is considered started, finished, timed out, or cancellation requested. Cancellation may not prove the remote computation stopped; expose that uncertainty and any returned usage instead of declaring zero cost.

Set bounded retry rules that distinguish transient failures from invalid credentials, unsupported requests, and exhausted allowance. Preserve each attempted request and its relationship to the original call. Retry must not silently change evaluation inputs or turn extra attempts into independent benchmark trials. When a retry could incur another charge, keep the budget implication explicit under D-03.

On an ambiguous interruption, do not claim the service never executed the call. Stop according to policy and provide sufficient evidence for module 08 to record the uncertainty. Credential expiration follows D-06 and must not trigger use of another person's key.

## User Experience

The eventual interface can explain whether a request returned an answer, failed, timed out, or may still have incurred work after cancellation. Users can inspect actual reported metadata without mistaking absent values for measured zeros.

## Decisions to Resolve

- **D-08**, owned by 07: individual-call timeouts, cancellation semantics, bounded retry policy, and response normalization. Module 08 waits for the recorded resolution.

## Technical Plan Required Before Coding

Inspect the repository and create `docs/plans/07-model-inference.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Choose implementation details only in that plan.

## Deliverables

Individual inference behavior for all promised services, D-08 resolution, sanitized response/failure evidence, verification results, and `docs/handoffs/07-model-inference.md`.

## Completion Criteria

- Each promised service executes compatible visitor-funded requests.
- Settings and requested identity remain faithful or fail explicitly.
- Every attempt has a truthful outcome and inspectable nonsecret evidence.
- Cancellation, timeout, and retry behavior honor the agreed budget and credential rules.

## Validation

Check usable and unusable answers, refusals, truncation, empty content, unsupported parameters, changed availability, revoked credentials, rate limits, timeouts, cancellation races, retry exhaustion, and absent usage. Verify no credential leaks through response evidence or errors. Live calls require an authorized budget.

## Implementation Handoff

Record the plan, implemented paths, D-08, exact commands/results, tested environments, per-service evidence, limitations, and the precise call outcomes consumed by 08. Include unresolved remote-execution uncertainty and its budget implications.

## Dependencies and Handoff

Module 08 receives individual outcomes and attempt evidence. It owns scheduling, trial counts, method coordination, grading, saved results, and final run completeness.

## Risks and Open Questions

Services may report different completion and usage details. Timeout or cancellation can leave remote execution uncertain; preserve that limitation rather than promising identical provider behavior.
