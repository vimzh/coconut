# Module 03: Instance Generator and Suites

## Status

Dependent

## Type

Foundation

## Purpose

Produce reproducible mathematical instances whose difficulty and reference labels support meaningful model comparisons.

## Finished Outcome

Versioned, frozen suites contain actual expressions, explicit domains, measured depths, verified labels, and validation evidence. Suite requests outside proven mathematical or coverage boundaries fail visibly.

## Why It Comes Here

Generation needs the mathematical boundaries from 01 and task protocol from 02. It can proceed alongside scoring in 04 after those prerequisites pass. Execution and leaderboard comparisons require the resulting frozen instances.

## Prerequisites

Module 01 handoff with G-MATH Go and resolved D-01; module 02 handoff with resolved D-02 and D-03. Obtain supported families/domains, label policy, prompt constraints, selected profiles, and trial budgets.

## Build Readiness Gate

Confirm prerequisite evidence covers every proposed family, domain, and class. Read the handoffs and identify any requested coverage outside their accepted boundaries. Resolve D-04 and document how actual depth will be measured before dependent execution. Write the technical plan before coding.

## Scope

### Included

Instance generation, suite composition, depth measurement, class coverage, frozen-instance identity, reproducibility evidence, and suite validation summaries.

### Not Included

New mathematical certification rules (01), prompt/extraction policy (02), metrics (04), model requests (07), run management (08), or a user-facing arbitrary-expression editor.

## Detailed Work

### Define depth and coverage

Resolve how composition depth is counted for the accepted expression families, including the treatment of leaves, repeated terms, and operations that do not increase nesting. Give worked examples so reported depth reflects the actual expression. Do not equate a generation setting with measured depth without checking its result.

Select initial depth levels, suite size, and class distribution. Show coverage of convex, concave, and neither within D-01's accepted boundaries. Apply its affine/constant policy consistently rather than counting overlap as two independent classes. Explain exclusions and any class/depth combinations that cannot be supported. Increasing depth must retain valid domains and defensible labels; it must not merely make notation longer.

### Generate only defensible instances

Every accepted instance must have an explicit mathematical expression, variable/domain statement, measured depth, reference label, and the verifier's accepted evidence. Use 01's checker and boundaries; this module must not create a second label authority. Failed checks, uncertain curvature, invalid domains, and unsupported expressions stay excluded with visible reasons. A failed sufficient-curvature check alone never establishes the label neither.

Detect duplicates or equivalent repeated material under the chosen suite policy. Decide what repetition is acceptable and disclose it in coverage evidence. Prevent hidden answer hints in the presentation. Keep reference evidence separate from model-visible task content according to 02.

### Freeze and reproduce comparable suites

Define suite identity and version rules, retaining the exact accepted instances. Record the inputs and any randomness needed to regenerate them, then verify reproduction rather than relying only on a seed. Changes to expressions, domains, labels, depth rules, or membership require a new identity; do not silently repair an already compared suite.

Check requested coverage before declaring a suite complete. If generation cannot meet the declared size or class/depth requirements, return an explicit incomplete result with achieved coverage and rejection reasons. Do not silently shrink the suite, relax validation, or replace difficult cases with easier instances. Distinguish public illustrative examples from evaluated instances so later pages cannot accidentally describe examples as measured evidence.

## User Experience

A visitor can see which suite and depth levels a run uses and understand what increasing depth means. Results remain tied to the same actual tasks across eligible comparisons. Unavailable coverage is stated before execution.

## Decisions to Resolve

- **D-04, owner 03:** reference suite composition, actual depth measure/levels, class coverage, versions, and frozen-instance identity. Blocks 08, 10, and 11.

Record the chosen policy and evidence in the roadmap registry. Requests requiring new mathematical support return to 01 instead of being decided here.

## Technical Plan Required Before Coding

Inspect the current repository and write `docs/plans/03-instance-generator-and-suites.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. Choose implementation details there, preserving prerequisite contracts.

## Deliverables

Validated generator behavior, frozen reference suites, coverage and rejection summaries, reproduction instructions, resolved D-04, and implementation handoff evidence.

## Completion Criteria

Every frozen instance satisfies 01 and 02. Reported depths match documented examples and actual instances. Declared coverage is met, identities preserve exact membership, and independent regeneration or comparison confirms reproducibility. Incomplete generation cannot be mistaken for an approved suite.

## Validation

Check ordinary suites at every chosen depth, all supported classes, and boundary-domain examples. Exercise unsupported families, invalid domains, uncertain references, duplicates, impossible coverage requests, and empty suites. Interrupt generation and confirm partial material is not marked frozen or complete. Reproduce a frozen suite from documented inputs and detect a changed expression, domain, label, or membership. Confirm model-visible representations exclude validation evidence. These checks require no paid model calls.

## Implementation Handoff

Write `docs/handoffs/03-instance-generator-and-suites.md` with plan and implemented artifact paths, D-04 resolution, exact commands/results, supported environments tested, and limitations. Supply exact suite versions, frozen instances, identity rules, regeneration inputs, depth examples, coverage counts, verifier evidence references, and rejection summaries. Record any unsupported coverage explicitly.

## Dependencies and Handoff

08 receives frozen execution inputs and reference evidence; 10 receives suite identities and coverage for comparison groups; 11 receives accurate generation/depth explanations and clearly identified examples. All consumers must preserve instance identity and keep reference evidence out of model requests.

## Risks and Open Questions

Deep valid instances may become repetitive or class-imbalanced. Reproducibility alone does not prove useful difficulty. Report these limits honestly and require a new documented suite version for later revisions.
