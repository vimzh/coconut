# Module 02 Handoff: Evaluation Protocol and Answers

## Status

**Complete.** Offline implementation, public-entry integration, project checks, independent code review, and behavioral verification pass. Modules 03/04 may now consume these contracts; provider-backed work still requires its own access and capability gates.

This module supplies the complete offline contract from a verified reference through prompts, declared workload, and answer extraction. It performs no provider calls, retries, scoring, suite generation, persistence, or browser interactions.

## Decisions and Artifacts

- D-02 and D-03 are resolved in the [technical plan](../plans/02-evaluation-protocol-and-answers.md).
- G-MATH remains Go within [module 01's boundary](01-mathematical-verifier.md).
- [Public entry point](../../apps/api/src/protocol/index.ts) exports the protocol functions, constants, errors, and types.
- [Profiles](../../apps/api/src/protocol/profiles.ts) own immutable schema/profiles, compatibility checks, and workload calculations.
- [Prompt builder](../../apps/api/src/protocol/prompt.ts) owns model-visible instructions and exact task rendering.
- [Extractor](../../apps/api/src/protocol/extractor.ts) owns deterministic answer interpretation and completion-state outcomes.
- [Types](../../apps/api/src/protocol/types.ts) and [validation](../../apps/api/src/protocol/validation.ts) define the shared internal contracts.
- Tests cover [profiles](../../apps/api/src/protocol/profiles.test.ts), [prompts](../../apps/api/src/protocol/prompt.test.ts), [extraction](../../apps/api/src/protocol/extractor.test.ts), and [public-entry integration](../../apps/api/src/protocol/integration.test.ts).

No dependencies or mathematical-verifier behavior changed. No credentials or paid model calls were used.

## Version and Profiles

Protocol version: **`1`**. Versioning covers instructions, output schema/semantics, extraction, methods, and budgets. A semantic change needs a new protocol/profile identity rather than an unnoticed change to an existing comparison.

| Profile | Response enforcement | Required capabilities |
| --- | --- | --- |
| `one-shot-json-v1` | Instructions request JSON; ordinary text output. | Text input, text output, exact output-limit enforcement. |
| `one-shot-schema-v1` | Same instructions plus strict JSON Schema. | All above plus enforcement of the exact declared schema. |

The first version includes one-shot classification only. Each trial has one expression in a fresh conversation and no tools. Additional reasoning methods, majority votes, answer repair, and extra calls to interpret an answer are not part of these profiles.

Both profiles use three trials per instance, a 4,096-token output ceiling per attempt, and the endpoint's sampling/reasoning defaults. Later adapters omit temperature/reasoning overrides and record actual reported values or unknown. These profiles do not claim identical numeric sampling or reasoning settings across models or endpoints.

`checkCompatibility(profileId, evidence)` requires exactly `textInput`, `textOutput`, `outputTokenLimit`, and `jsonSchema`, each supported, unsupported, or unknown. It reports required unsupported capabilities separately from required unverified ones. A profile is compatible only when all its requirements are supported. Schema evidence is not required by the ordinary-text profile, though its state must still be present.

The evidence must address the exact selected profile: output-limit support means the endpoint can enforce its 4,096-token setting with known semantics, and schema support means the exact common schema is supported. These functions validate evidence shape and policy; they do not establish live provider access, current availability, or prompt-specific context capacity. Modules 06/07 must prove and enforce those conditions before execution. Never silently switch profiles or drop a required setting.

## Workload Contract

`calculateWorkload(profileId, instanceCount)` accepts an integer from 1 through 1,000. Counts cannot be coerced from strings or overflow into large calculations. Invalid input and excessive workload have separate error codes.

For **100 instances in one profile**:

- 3 trials per instance produce **300 logical calls**.
- At most 2 transport attempts per trial permit **600 total attempts**, including the original calls.
- The requested output-token ceiling is **2,457,600** across all permitted attempts.

At 1,000 instances, those ceilings are 3,000 logical calls, 6,000 attempts, and 24,576,000 output tokens. Selecting both profiles doubles the work; calculating one profile never launches or budgets the other implicitly.

Module 07's D-08 decides which transient infrastructure failures, if any, allow another attempt within this ceiling. Retry authorization never comes from a wrong label, malformed reply, refusal, or truncation. Preserve the original trial identity and identical prompt/settings on any retry. These are ceilings, not automatic retry behavior, predicted usage, or currency spending limits.

## Prompt Contract and Privacy

`buildPrompt(referenceInput, profileId)` accepts module 01's raw reference input and independently re-verifies it. It rejects excluded, unverified, invalid, incorrectly labeled, or fabricated verified objects. The caller cannot supply a trusted rendering or proof flag.

The returned immutable blueprint contains protocol/profile identity, exactly a system and user message, a response-format descriptor, and generation policy. Only the canonical expression and domain enter task-specific model text. It contains no reference label, witness, certificate, fingerprint, depth/node counts, or task identifiers. Private witness choices leave the entire prompt unchanged.

Example task message:

```text
f(x) = (x^2)
Domain: x in [-1, 1].
```

Shared instructions define convex-but-not-concave, concave-but-not-convex, and neither; exclude affine/constant tasks; explain exact fractions and operators; and state the complete answer format and size rules. This is a blueprint, not proof of endpoint compatibility or a live inference result. Actual fresh provider state and context limits remain execution responsibilities.

## Answer and Completion Contract

The required response is one JSON object containing each of these string fields exactly once:

```json
{"label":"convex","explanation":"A brief justification for this classification."}
```

`label` is exactly lowercase convex, concave, or neither. `explanation` is nonblank, well-formed Unicode with at most 4,096 Unicode code points. The whole completed reply is at most 65,536 UTF-16 code units, including escapes and whitespace. That ceiling accommodates a maximum-length explanation even when every character uses surrogate escapes.

JSON whitespace and either property order are allowed. Markdown fences, surrounding prose, repeated objects, duplicate decoded keys, missing/extra fields, invalid labels, and unusable explanations are invalid. Escaped duplicate keys cannot overwrite an earlier value. A contradictory explanation never overrides the explicit label; explanations are ungraded inspection evidence.

The shared schema enforces object shape, string types, required fields, label enum, and no additional properties. Explanation semantics and size limits are checked locally for both profiles. A schema-constrained reply still needs extraction and completion checks.

`extractAnswer(reply, profileId)` requires a strict normalized envelope with `status` and string `text`. A provider-error envelope also requires a nonblank sanitized `message`. Provider adapters own normalization/redaction and must supply one explicit state; missing status or contradictory extra flags are contract errors, not mathematical model failures.

| Envelope / extraction | Outcome | Extracted label |
| --- | --- | --- |
| Completed valid object | `answer` | Present |
| Completed unusable text | `invalid` with a reason | Absent |
| Refused, truncated, interrupted, cancelled | Corresponding distinct kind | Absent, even for complete-looking JSON |
| Provider error | `provider-error` with message | Absent |
| Malformed internal envelope | Throws `ProtocolInputError` | No model outcome fabricated |

Every returned outcome preserves protocol/profile identity and the exact raw text. Numeric correctness and denominator policy remain module 04's work. Truncation or formatting failures alone do not establish a mathematical reasoning limitation.

## Verification and Review

- `bun test apps/api/src/protocol`: **78 pass, 0 fail, 789 assertions** across four files.
- Focused tests cover all labels, both profiles, metadata priority, malformed/duplicate/escaped JSON, misleading explanations, Unicode limits, raw retention, private-data exclusion, exact rendering, resource budgets, immutability, and capability uncertainty.
- Offline integration links all public entry points for convex, concave, and neither references, three fresh blueprints per case, fixture answers, wrong answers retained without grading, and incomplete/provider-error outcomes.
- `bun run test`: **128 pass, 0 fail, 1,534 assertions** across eight files, including mathematical and protocol checks.
- `bun run lint`, `bun run typecheck`, and `bun run build`: **Pass** for the existing API/web projects. Type generation and production build ran sequentially.
- An independent behavioral check exercised the public entry point from verified reference through both profiles, compatibility, a 100-instance workload, completed replies, and every noncompleted/provider-error outcome. Unknown schema support remained incompatible and truncation yielded no label.
- An independent read-only code review inspected all protocol source/tests and their mathematical dependencies. It found no actionable defects in the reviewed scope.

Checks ran on macOS with Bun 1.4.4 and Node.js 24.22.1. No browser, HTTP, or live-provider behavior is claimed by these offline checks.

## Downstream Handoff

- **03:** Use the verified mathematical boundary and protocol identities when constructing/fixing suites. Suite composition and reference-instance identity remain your decisions.
- **04:** Consume `AnswerOutcome`, raw evidence, declared trials, and distinct incomplete/provider-error states. Resolve scoring/aggregation without changing extraction or silently omitting work.
- **06:** Establish per-endpoint capability evidence for each profile, including exact schema and output-limit semantics. Unknown required capabilities remain blocked.
- **07:** Translate blueprints into provider requests, preserve defaults and response identity, enforce compatibility/context/output limits, normalize completion states, and choose permitted transient retries under D-08.
- **08:** Use fresh conversations, keep trial/attempt identities distinct, enforce workload ceilings, and preserve actual settings and all outcomes. No multi-step method is included in version 1.
- **11:** Explain the actual task, answer rules, separate profiles, trial budgets, and interpretation limits without presenting offline fixtures as measured model performance.

No live provider, browser, numerical score, generated-suite quality, or frontier-model limitation has been verified by this module.
