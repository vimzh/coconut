# Convexity Evaluation Platform Roadmap

## Source of Truth

[idea.md](idea.md) defines the product. These modules make that scope executable; they do not authorize additional product features. The user delegated the approximate phase count, so this plan uses **12 modules** to isolate the delicate work without creating filler phases. Modules 01 through 03 are complete within their documented mathematical, protocol, and frozen-suite boundaries; modules 04 through 12 remain unimplemented.

The existing [repository README](../README.md) describes the application scaffold and verification commands. Preserve that baseline unless a module's technical plan documents a necessary change. Existing scaffolding is not evidence that a feature or feasibility gate passes.

## How the Team Uses This Roadmap

Before planning, read `docs/idea.md`, this roadmap, the assigned module, and its prerequisite handoffs. Write a repository-specific technical plan under `docs/plans/` before coding. Inspect the current code rather than assuming the scaffold remains unchanged.

The Status column describes dependency independence, not implementation progress; current progress is recorded below. Finish a module only when its completion criteria and verification pass and its handoff records the evidence. Resolve assigned decisions in the registry before dependent work uses them. A failed gate blocks the work listed in its Blocks column; preserve its evidence and record the next required decision.

## Module Map

| Module | Status | Type | Depends On | Finished Outcome |
| --- | --- | --- | --- | --- |
| [01 Mathematical verifier](modules/01-independent-mathematical-verifier.md) | Independent | Feasibility | None | Validated reference-label checker, explicit mathematical boundaries, and G-MATH verdict. |
| [02 Evaluation protocol and answers](modules/02-evaluation-protocol-and-answers.md) | Dependent | Foundation | 01 | Versioned comparison protocol, prompt behavior, and deterministic answer extraction. |
| [03 Instance generator and suites](modules/03-instance-generator-and-suites.md) | Dependent | Foundation | 01, 02 | Reproducible, versioned suites whose instances carry verified labels. |
| [04 Scoring and depth analysis](modules/04-scoring-and-depth-analysis.md) | Dependent | Foundation | 02 | Independently checked metrics and breakdowns under a published scoring policy. |
| [05 Provider access and credentials](modules/05-independent-provider-access-and-credentials.md) | Independent | Feasibility | None | Proven visitor-owned access and credential lifecycle, with a G-PROVIDERS verdict per service. |
| [06 Model discovery and compatibility](modules/06-model-discovery-and-compatibility.md) | Dependent | Foundation | 02, 05 | Hugging Face model search and supported model selection across the promised services, with truthful compatibility information. |
| [07 Model inference](modules/07-model-inference.md) | Dependent | Foundation | 02, 05, 06 | Consistent individual model requests and complete provider-response evidence. |
| [08 Run execution and results](modules/08-run-execution-and-results.md) | Dependent | Integration | 03, 04, 07 | Complete repeated-trial execution, inspectable saved results, and G-SIGNAL verdict. |
| [09 Evaluation interface](modules/09-evaluation-interface.md) | Dependent | Product Experience | 06, 08 | Usable connection-to-results journey with progress, interruption, and error states. |
| [10 Leaderboard](modules/10-leaderboard.md) | Dependent | Product Experience | 03, 04, 08 | Evidence-backed public comparisons under explicit eligibility and publication rules. |
| [11 Landing and methodology](modules/11-landing-and-methodology.md) | Dependent | Product Experience | 02, 03, 04, 09, 10 | Accurate public explanation and navigation for the completed experience, without mentioning the paper. |
| [12 Integration and submission](modules/12-integration-and-submission.md) | Dependent | Readiness | 09, 10, 11 | Reproducible end-to-end artifact, readiness evidence, and prepared hackathon materials. |

## Parallel Work

- Modules **01 and 05** may start together. They have no unfinished module prerequisites.
- After 01, module 02 fixes the evaluation contracts. After 02, modules 03 and 04 may proceed together. Module 06 can also proceed once 05 passes for the required services.
- Module 07 follows discovery and compatibility; module 08 joins the mathematical, scoring, and inference paths.
- Modules 09 and 10 may proceed together after 08. Module 11 follows their completed handoffs as well as 02, 03, and 04, so its operational explanation and navigation match the actual interface and publication rules. Claims about observed performance require actual results from 08.
- Module 12 closes the integrated journey. Numbering is a navigation and dependency order, not a requirement to finish every earlier-numbered module before starting an independent branch.
- Separate module ownership isolates difficult reasoning even where prerequisite outputs are required. Agree file ownership in the technical plans before agents implement overlapping application areas.

## Implementation Progress

- **01: Complete.** D-01 is resolved in the [technical plan](plans/01-mathematical-verifier.md); G-MATH is Go for the bounded exact-arithmetic subset. See the [handoff and verification evidence](handoffs/01-mathematical-verifier.md).
- **02: Complete.** D-02 and D-03 are resolved in the [technical plan](plans/02-evaluation-protocol-and-answers.md); prompts, profiles, budgets, extraction, and offline integration pass verification and review. See the [handoff](handoffs/02-evaluation-protocol-and-answers.md).
- **03: Complete.** D-04 is resolved in the [technical plan](plans/03-instance-generator-and-suites.md); seeded generation, exact duplicate detection, measured coverage, immutable suites, replay, and the 75-case reference artifact pass verification and review. See the [handoff](handoffs/03-instance-generator-and-suites.md).
- **04 through 12: Not started.** Their prerequisites and open decisions remain in force.

## Critical Feasibility Gates

| Gate | Owner | Reference Target | Evidence Required | Blocks |
| --- | --- | --- | --- | --- |
| G-MATH | 01 | The first benchmark's stated function families and convex input domains, with increasing composition depth and mutually interpretable class labels. | **Go for the bounded exact-arithmetic subset.** Correct/incorrect references, domain validity, overlap, resource uncertainty, certificate replay, and a depth-100 structural case pass checks and review. See [evidence and limitations](handoffs/01-mathematical-verifier.md). | 02, 03 and all downstream benchmark work must preserve the accepted boundary. |
| G-PROVIDERS | 05 | Visitor-owned access to OpenAI, OpenRouter, and Hugging Face Inference Providers. | Per-service authentication and permitted inference evidence under an explicitly authorized test budget; credential redaction and lifecycle checks; record Go or No-go for each service. | 06, 07 and downstream provider-backed work for an unproven service. Product completion requires all promised services. |
| G-SIGNAL | 08 | The frozen suite and protocol, tested on an available frontier model with the agreed repeated-trial budget. | Reproducible results, checked reference labels, inspected failure transcripts, and an explanation of a meaningful limitation. If evidence does not support that claim, record No-go and revise through a new documented suite/protocol version. | Failure claims on public pages and final hackathon readiness; never fabricate or selectively discard results. |

A no-go does not authorize quietly removing a promised provider, relabeling an uncertain expression, weakening the grader, or changing published benchmark inputs. Record the blocker and the explicit product decision required to change scope.

## Cross-Cutting Guardrails

- Keep reference labels, certificates, and scoring data out of model-visible inputs. Public illustrative examples must be distinguished from evaluated inputs.
- Treat unknown mathematical validity, failed validation, numerical uncertainty, and provider errors as visible states. A failed DCP check alone is not proof of nonconvexity.
- Protect visitor credentials through input, execution, errors, logs, records, and public views. No shared owner key may silently fund visitor runs.
- Keep paid-call counts and limits explicit before execution. Testing with live credentials requires an authorized budget; a documentation task authorizes no paid calls.
- Preserve actual instances, run settings, versions, outcomes, and comparison identity. Do not present different suites, methods, or budgets as equivalent.
- Rank only results supported by the decided eligibility policy and platform execution evidence. Empty, failed, incomplete, or unverified data must never become invented scores.
- Keep the public interface minimal and functional. The landing page must not mention or link the paper. Internal provenance and submission materials must accurately credit adapted prior work and identify the original contribution.
- Reuse the current project conventions. Do not select new architecture or dependencies in these product modules; make those choices in repository-specific technical plans.
- Retain applicable [hackathon requirements](../hackathon.md), including the documented need to check authenticated challenge instructions before final packaging. Research is evidence, not a license to copy source code.

## Decision Registry

All entries begin Open. The owner updates Status and Resolution with the chosen policy and evidence; downstream owners must not silently choose a conflicting policy.

| ID | Decision | Owner Module | Needed Before | Status | Resolution |
| --- | --- | --- | --- | --- | --- |
| D-01 | Supported mathematical families/domains, label overlap, validity evidence, and numerical-certification boundary. | 01 | G-MATH; 02, 03 | Resolved | Exact rational scalar expressions over finite rational intervals; bounded supported operations; overlap excluded; sufficient proofs and strict exact midpoint witnesses. Unsupported or inconclusive cases are explicit. See the [technical plan](plans/01-mathematical-verifier.md). |
| D-02 | Model-visible prompt, answer format, permitted explanation, and invalid/refusal/truncation outcome contract. | 02 | 03, 04, 06, 07 | Resolved | Exact expression/domain prompts; single JSON object with label and brief explanation; deterministic extraction; completion failures remain distinct. See the [technical plan](plans/02-evaluation-protocol-and-answers.md). |
| D-03 | Initial reasoning methods, repeated-trial counts, allowed generation settings, request budgets, and comparison profiles. | 02 | 03, 04, 06, 07, 08 | Resolved | One-shot only; separate prompted-JSON and strict-schema profiles; three fresh trials, 4,096 output tokens per attempt, endpoint defaults, at most two transport attempts per trial and 1,000 instances per profile. See the [technical plan](plans/02-evaluation-protocol-and-answers.md). |
| D-04 | Reference suite composition, actual depth measure/levels, class coverage, versions, and frozen-instance identity. | 03 | 08, 10, 11 | Resolved | Version-1 exact suites on [-1,1], depths 5–80; default 75 cases balanced across classes and depths 5/10/20/40/80. Measured operation depth, exact generated-family duplicate signatures, retained certificates, ordered content identities, bounded per-case attempts, and explicit incomplete coverage. Depth also changes length and active pieces. See the [technical plan](plans/03-instance-generator-and-suites.md) and [handoff](handoffs/03-instance-generator-and-suites.md). |
| D-05 | Primary score, aggregation across trials/depths, missing-answer/error policy, spread, and supporting metrics. | 04 | 08, 10, 11 | Open | Pending |
| D-06 | Credential lifetime, validation, retention/redaction boundary, and interruption/re-entry behavior. | 05 | G-PROVIDERS; 06, 07, 08, 09 | Open | Pending |
| D-07 | Discovery/compatibility evidence, provider/model identity, routing policy, and presentation of unavailable metadata. | 06 | 07, 08, 09, 10 | Open | Pending |
| D-08 | Individual-call timeouts, cancellation semantics, bounded retry policy, and provider-response normalization. | 07 | 08 | Open | Pending |
| D-09 | Saved-run access, visibility, retention, explicit publication behavior, and interrupted-run record policy. | 08 | 09, 10, 12 | Open | Pending |
| D-10 | Leaderboard eligibility, comparable groups, repeated submissions, tie/uncertainty treatment, and disclosure. | 10 | Ranked publication; 12 | Open | Pending |
| D-11 | User-facing terminology, supported browser/viewport reference, and connection-to-results interaction details. | 09 | Integrated interface validation; 12 | Open | Pending |

## Project Completion

Completion requires a runnable website and backend flow in the documented supported environment, with all module handoffs and gates resolved. A visitor can connect each promised service using their own credentials, select an executable model, run the agreed evaluation, inspect the underlying answers and correct scores, and publish or withhold results according to D-09. The leaderboard honors D-10, and the landing page explains the implemented protocol without referencing the paper.

Validation must cover a clean local setup, mathematical/scoring fixtures, real provider integration evidence under authorized budgets, normal and interrupted runs, credential safety, leaderboard eligibility, and browser-level completion of the journey. Record exact commands and outcomes for build, lint, type checking, tests, and launch. Do not mark a check passed when credentials, infrastructure, or an open decision prevented it.

Module 12 prepares the code archive, explanatory README, results/transcripts, short description, and video materials required by the event. Verify original-work disclosure and permitted reuse. Preparing materials does not authorize accepting agreements, publishing credentials, or submitting the entry on the user's behalf.

## Reference Evidence

These are research inputs for technical planning, not claims that this project has reproduced their results. Recheck versioned documentation when implementing.

- [ConvexBench paper](https://arxiv.org/html/2602.01075v2) and [authors' public implementation](https://github.com/yepengliu/ConvexBench): benchmark and comparison-method background; check reuse rights before copying any code.
- [CVXPY DCP rules](https://www.cvxpy.org/tutorial/dcp/index.html) and [atomic functions](https://www.cvxpy.org/tutorial/functions/index.html): sufficient curvature rules, domains, and affine overlap.
- [Inspect error handling](https://inspect.aisi.org.uk/handling-errors.html) and [metrics](https://inspect.aisi.org.uk/metrics.html): trial, retry, missing-sample, and aggregation considerations.
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), and [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/index): provider-specific capability and execution evidence.

## Assignment Prompt

> Read `docs/idea.md`, `docs/ROADMAP.md`, your assigned module, and all prerequisite handoffs. Confirm the module's Build Readiness Gate. Resolve its assigned decisions and record any no-go honestly. Inspect the repository, then write `docs/plans/NN-<module-name>.md` covering architecture, files, interfaces, dependencies, error handling, and exact verification commands. Implement only the assigned scope. Coordinate file ownership with other agents. Run the relevant checks and record actual results, limitations, and exact downstream inputs in `docs/handoffs/NN-<module-name>.md`. Update the decision registry and completion evidence without changing the product scope.
