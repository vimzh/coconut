# Module 02: Evaluation Protocol and Answers

## Status

Dependent

## Type

Foundation

## Purpose

Make each model face a defined mathematical task and make its returned answer interpretable under a common, inspectable comparison policy.

## Finished Outcome

A versioned protocol defines model-visible instructions, permitted reasoning methods, trial budgets, answer categories, and deterministic extraction. Downstream owners can distinguish a wrong classification from an unusable answer without inventing policies.

## Why It Comes Here

Mathematical boundaries must be proven first. Suite generation, scoring, discovery compatibility, and inference then need this shared contract. This module follows 01; 03 and 04 can proceed together afterward.

## Prerequisites

Module 01 handoff, G-MATH Go, and resolved D-01, including accepted domains, curvature labels, affine/constant handling, and uncertainty boundaries.

## Build Readiness Gate

Read the source documents and 01 handoff. Confirm the proposed task can be expressed without exposing reference labels or validation evidence. Resolve D-02 and D-03 before dependent owners implement their contracts. Create the technical plan before coding.

## Scope

### Included

Prompt rules, answer interpretation, reasoning-method selection, trial and generation budgets, comparison profiles, and protocol examples and fixtures.

### Not Included

Mathematical proof ownership (01), suite composition (03), metrics (04), provider capability evidence (06), individual requests (07), or run orchestration (08).

## Detailed Work

### Define the model-visible task

Specify how expressions, variables, and domains are presented unambiguously. Explain the three labels consistently with D-01, including its treatment of overlapping curvature. Decide whether explanation is permitted or required and where the final classification belongs. Keep reference labels, certificates, grading information, and identifying answer hints outside model input. Illustrative examples must be distinguishable from evaluated instances.

Compare provider-enforced strict answer structure with instructions asking for JSON. Resolve whether either or both are permitted and whether they form separate comparison profiles. Do not silently substitute a weaker format for a model that cannot satisfy its selected profile. Compatibility failures must remain visible to 06 and 07.

### Fix reasoning and budget profiles

Investigate a direct-answer baseline as the minimum reference. Evaluate which additional reasoning methods from the research inputs, if any, belong in the initial release; do not assume all four methods are promised. Record each included method's instructions, permitted information, and stopping conditions. If a selected method requires several steps, define the expected behavior here and hand orchestration to 08.

Resolve repeated-trial counts, allowed generation settings, output limits, and total request budgets. State what makes two runs comparable and which differences require separate profiles. Account for the full call budget of any multi-step method. An unavailable setting or capability is an incompatibility, not permission for an undocumented substitution.

### Make extraction reproducible

Define accepted labels, spelling and formatting allowances, and rules for extra text, multiple answers, conflicting fields, refusal, truncation, empty content, and malformed output. Separate extracted classification from answer-quality status. The same visible reply and protocol version must produce the same interpretation. Preserve the original reply for inspection without allowing explanations or grader expectations to repair it silently.

Distinguish a model returning an unusable reply from infrastructure failing to return one. Define the outcome vocabulary consumed by 04 and 07; scoring and retry policies remain theirs. Version any change that could alter prompts, accepted answers, method behavior, or comparison identity.

## User Experience

A visitor can understand the task and selected method, the expected answer format, the number of paid calls permitted, and why a returned answer was accepted or unusable. Protocol differences remain visible when interpreting comparisons.

## Decisions to Resolve

- **D-02, owner 02:** prompt, answer format, explanation, and invalid/refusal/truncation contract. Blocks 03, 04, 06, and 07.
- **D-03, owner 02:** initial methods, trials, settings, budgets, and comparison profiles. Blocks 03, 04, 06, 07, and 08.

Update both registry entries with rationale and evidence before downstream use.

## Technical Plan Required Before Coding

Inspect the current repository and write `docs/plans/02-evaluation-protocol-and-answers.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. This module chooses no technical implementation.

## Deliverables

Versioned protocol, resolved decisions, method/profile definitions, model-visible examples, extraction fixtures with expected outcomes, and the implementation handoff.

## Completion Criteria

All selected profiles are fully specified. Model inputs contain no reference evidence. Fixtures produce deterministic outcomes, unsupported profiles fail visibly, and downstream owners can consume the contract without deciding policy themselves.

## Validation

Check ordinary valid answers and every accepted format. Exercise conflicting classifications, misleading explanation, quoted labels, duplicate answers, unexpected fields, refusal, empty output, and partial or truncated content. Verify that interruption before a complete reply cannot become a valid classification. Confirm label/certificate leakage is absent and method budgets include every required step. Run fixture checks without live credentials; any later provider validation needs an authorized budget.

## Implementation Handoff

Write `docs/handoffs/02-evaluation-protocol-and-answers.md` with plan and implemented artifact paths, resolved decisions, exact commands and results, tested supported environments, and limitations. Include exact protocol/profile identities, prompt examples, accepted output fixtures, outcome definitions, budgets, and version-change rules. Do not claim provider support from protocol fixtures alone.

## Dependencies and Handoff

03 receives task constraints; 04 receives outcomes and trial profiles; 06 and 07 receive compatibility requirements; 08 receives method and budget contracts; 11 receives the public explanation. Preserve versions, hidden reference evidence, and visible incompatibility.

## Risks and Open Questions

Answer restrictions can change measured performance. Additional methods may exceed feasible budgets or provider capabilities. Resolve those tradeoffs in D-02 and D-03 rather than weakening profiles during execution.
