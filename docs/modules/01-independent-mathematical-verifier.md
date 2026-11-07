# Module 01: Mathematical Verifier

## Status

Independent

## Type

Feasibility

## Purpose

Establish whether the benchmark can assign defensible reference labels before generated instances, model answers, or scores depend on them. This module owns mathematical validity and the G-MATH gate.

## Finished Outcome

A working reference-label verifier with tested mathematical boundaries and inspectable evidence for accepted instances. G-MATH has an explicit Go or No-go verdict. A Go covers only the supported families and domains actually verified, not arbitrary mathematical expressions.

## Why It Comes Here

An incorrect reference makes every later score misleading. This work can proceed alongside module 05 because mathematical verification needs no visitor credentials or provider integration.

## Prerequisites

None beyond [idea.md](../idea.md), [ROADMAP.md](../ROADMAP.md), and the current repository context.

## Build Readiness Gate

Read the mathematical research references in the roadmap and inspect existing project conventions. Record the initial reference target for D-01: a bounded set of function families, explicit convex input domains, and proposed acceptance evidence for the three labels. Write the module's technical plan before implementation. The plan must make unsupported and uncertain cases observable.

Live model responses are not evidence of a correct mathematical label. No external service access is required for this module's checks.

## Scope

### Included

- Domain validity, curvature justification, composition conditions, and reference-label verification.
- The treatment of affine, constant, invalid, unknown, and numerically uncertain expressions.
- Evidence that allows another person to check why an instance was accepted.
- Positive, negative, boundary, and deliberately corrupted reference fixtures.

### Not Included

- Random instance production and reference-suite publication, owned by module 03.
- Model prompts and extracted-answer semantics, owned by module 02.
- Scoring model responses, provider integration, and public pages.

## Detailed Work

### Define the mathematical target

Resolve D-01 with explicit supported inputs and output meanings. State the input domain for every accepted task and require all intermediate expressions to be defined throughout that domain. A logarithm receiving nonpositive values or a square root receiving negative values must not become an ordinary labeled instance.

Account for shape, sign, range, and monotonicity where the chosen composition rule depends on them. Define composition depth sufficiently to let module 03 measure actual nesting rather than a generator's loop count; module 03 owns final suite levels and coverage.

### Distinguish proof, counterexample, and uncertainty

Certified composition rules can establish convexity or concavity. Failure of those rules alone leaves curvature unverified; it does not establish the "neither" class. An inconclusive check must remain inconclusive.

For a neither instance, require evidence that defeats both convexity and concavity on the stated domain. Affine and constant functions can satisfy both properties. Resolve whether the three-label benchmark excludes these cases or defines another explicit interpretation; do not arbitrarily choose whichever class the verifier encounters first.

Numerical counterexample evidence must establish its claimed inequality despite numerical error. Unsuccessful searches, overflow, invalid evaluations, and gaps too close to zero must not be accepted as proof. Document which evidence is mathematically certified and which is only a diagnostic sanity check.

### Verify independently of claimed labels

The verifier must assess the actual expression and domain without trusting a supplied target label. Keep the displayed expression and its reference evidence mathematically equivalent, including coefficients and rounding. Changing the expression or domain must invalidate mismatched evidence.

Use hand-checkable references before testing generated cases. Candidate fixtures include a quadratic, its negative, and a cubic over an interval crossing zero; an affine function and a constant exercise overlap. Include a mathematically convex expression whose form is inconclusive under the chosen rules, so failure to certify cannot silently become neither.

### Produce the feasibility verdict

Record the accepted boundaries, rejected examples, independent checks, and residual uncertainties. G-MATH is Go only when all supported label outcomes have defensible evidence and the verifier rejects incorrect claims. A No-go identifies the unsupported promise and the decision needed to revise it. Later modules must not bypass this verdict.

## User Experience

Users can rely on the reference answer being tied to a stated domain and checkable evidence. Unverifiable candidates never appear as confidently labeled evaluation tasks.

## Decisions to Resolve

- **D-01**, owner 01: supported families and domains, overlap policy, composition evidence, and numerical-certification boundary. Resolve before G-MATH and modules 02 and 03.

## Technical Plan Required Before Coding

Write `docs/plans/01-mathematical-verifier.md` after inspecting the repository. Identify architecture, affected files, interfaces, dependencies, failure handling, and fixtures. Include the exact build, lint, type-check, test, and run commands. Justify any additional mathematical dependency against the current project and its permitted reuse. This module does not preselect an implementation.

## Deliverables

- Implemented verifier and a documented accepted-input and evidence contract.
- Checked fixtures covering all labels, overlap, invalid domains, and uncertainty.
- D-01 resolution and G-MATH verdict with evidence.
- `docs/handoffs/01-mathematical-verifier.md`.

## Completion Criteria

- Supported correct references pass; deliberately incorrect claims fail.
- Neither acceptance requires evidence against both properties.
- Overlap and uncertain cases follow D-01 without arbitrary classification.
- Evidence matches the exact accepted expression and domain.
- A reviewer can reproduce the checks without model access.
- The gate verdict is recorded honestly; a No-go blocks dependent implementation rather than being treated as completion of the product promise.

## Validation

Check ordinary compositions, sign reversals, domain boundaries, deep nesting, nearly flat expressions, and invalid intermediate values. Corrupt labels, expressions, coefficients, and evidence independently. Verify that incomplete evidence and exhausted verification limits remain rejected or unverified. Re-run accepted fixtures and confirm stable outcomes under the stated environment and precision assumptions.

## Implementation Handoff

Record the technical plan, implementation and fixture paths, D-01 resolution, gate evidence, exact commands and results, tested environments, known limits, and accepted/rejected example inputs. Provide the precise verifier inputs, outcomes, and evidence later modules must preserve.

## Dependencies and Handoff

Modules 02 and 03 receive the mathematical boundaries and accepted-instance contract. Module 03 must submit every candidate to the verifier. All later consumers must preserve domains, coefficient meaning, overlap policy, and uncertainty states.

## Risks and Open Questions

Sound evidence may constrain supported families or maximum useful depth. Numerical instability and concealed affine cancellations can create misleading labels. A narrower accepted target requires an explicit recorded boundary, not an unsupported claim of general convexity recognition.
