# Module 02 Technical Plan: Evaluation Protocol and Answers

## Scope and Readiness

G-MATH is Go for the exact scalar subset in the [module 01 handoff](../handoffs/01-mathematical-verifier.md). Implement the offline protocol from verified reference input through model-visible prompt, declared work budget, and extracted model outcome. No provider calls, scoring, random suites, run persistence, HTTP endpoints, or frontend belong to this module.

Keep the existing Bun/TypeScript backend and dependencies. There are no current protocol callers. Public consumers will use `apps/api/src/protocol/index.ts`; later modules own generation, scoring, compatibility evidence collection, and execution.

## Decisions D-02 and D-03

### D-02: Prompt and Answer Contract

Every task states the exact scalar expression and closed rational domain, explains the mutually exclusive labels, and asks for a single JSON object with exactly `label` and `explanation`. Labels are exactly lowercase `convex`, `concave`, or `neither`. Explanations are required, nonblank, well-formed Unicode strings of at most 4,096 Unicode code points. Explanations are retained for inspection and never used to override the label or determine correctness.

Allow JSON whitespace and either field order. Reject markdown fences, surrounding prose, duplicate decoded keys, extra/missing fields, non-string values, invalid labels, oversized responses, and unusable explanations. Completed text parsing is capped at 65,536 UTF-16 code units, enough for the maximum explanation even when Unicode characters are JSON-escaped. State that cap in the instructions. Schema constraints enforce the common structural subset; semantic explanation checks still run locally for both profiles.

Completion state is required. Provider error, refusal, truncation, interruption, and cancellation remain distinct outcomes even when partial text happens to contain valid JSON. Empty/malformed completed responses are invalid model replies. Malformed internal response envelopes throw a contract error instead of being counted as model failures. Preserve the raw returned text without repairing or asking another model to reinterpret it.

### D-03: Methods and Comparison Profiles

The initial release includes one-shot classification only. One request sees one expression in a fresh conversation; no tools, demonstrations containing answers, decomposition scaffold, majority voting, or multi-step method is included in version 1. Additional methods require separately versioned profiles and their own execution work in module 08.

Two immutable profiles share the same instructions and extractor:

- `one-shot-json-v1`: ordinary text generation with instructions requesting JSON. No provider JSON-mode constraint is assumed.
- `one-shot-schema-v1`: additionally requires strict JSON Schema enforcement of the response structure and label enum. Capability uncertainty blocks execution; no fallback to the other profile is permitted.

Both profiles use three independent trials per instance, a maximum of 4,096 output tokens per attempt, and each endpoint's native sampling/reasoning defaults. Omit temperature and reasoning overrides; later execution records must preserve actual reported values or mark them unknown. This compares endpoint-default behavior, not equal numeric sampling/reasoning settings.

Each profile permits at most 1,000 instances and two transport attempts per trial: 3,000 logical calls and at most 6,000 attempts at the maximum suite size. Module 07's D-08 owns which transient provider errors, if any, warrant the extra attempt. Invalid, refused, truncated, or mathematically wrong model answers never authorize retries. Additional attempts preserve the original trial identity and prompt. Budget all attempts, not only successful answers.

Budgets are per selected profile. Running both profiles doubles the work; selecting one never implicitly runs the other. Requested token ceilings are not predictions of usage or currency charges. Endpoint limits must account for the provider's output/reasoning-token semantics; unavailable or incompatible enforcement is visible.

Protocol version `1` covers prompt wording, accepted answers, schema, profiles, budgets, and extraction rules. A semantic change requires a new version/profile identity. Equal profiles alone do not establish complete experiment comparability: suite identity, model/endpoint identity, settings, and actual completion evidence remain necessary downstream.

## Files and Interfaces

Create `apps/api/src/protocol/`:

- `types.ts`: readonly profile, prompt, capability, reply-envelope, and answer-outcome contracts.
- `validation.ts`: strict plain-data-object checks and actionable `ProtocolInputError` for internal trust boundaries.
- `profiles.ts`: immutable profiles/schema, explicit unknown-profile rejection, capability checks, and bounded workload calculation.
- `prompt.ts`: reverify raw reference input with module 01, derive only canonical expression/domain into messages, and return a provider-neutral request blueprint.
- `extractor.ts`: completion-aware deterministic parsing, duplicate-key detection, shape/label/explanation validation, and raw-text retention.
- `index.ts`: narrow public exports.
- Focused tests plus a public-entry integration test linking reference validation, both prompts/profiles, representative model outcomes, and repeatability.

`buildPrompt(referenceInput, profileId)` recomputes module 01 verification from raw input. It never accepts a caller's claimed verified status or rendering. Only the canonical expression and domain reach the model; claimed labels, witnesses, certificates, fingerprints, node/depth data, and task identifiers remain private. Its blueprint is not a claim of provider availability.

`getProfile(profileId)`, `checkCompatibility(profileId, evidence)`, and `calculateWorkload(profileId, instanceCount)` expose explicit contracts for later consumers. Capability states are supported, unsupported, or unknown for text input, text output, output-token-limit enforcement, and JSON Schema. Required unknown capability blocks compatibility and is distinguished from confirmed unsupported.

`extractAnswer(reply, profileId)` requires a normalized status and raw text. A provider-error envelope also requires a nonblank sanitized message. The provider adapter owns normalization/redaction; the extractor owns accepted answer semantics. Returned outcomes carry protocol/profile identity and raw text but no correctness judgment.

## Validation and Failure Handling

Test every accepted label, field order, Unicode/code-point boundary, whitespace, escaped strings, quoted label text, duplicate/escaped duplicate keys, extra fields, missing labels, malformed/truncated JSON, fences, repeated objects, refusal, cancellation, interruption, provider errors, and empty output. Do not silently select a label from an explanation or partial reply.

Test immutable profiles/schema, explicit unknown-profile errors, supported/unsupported/unknown capabilities, and ordinary/boundary/invalid workload counts. Verify logical requests and permitted attempt/token ceilings separately.

Prompt tests must show identical messages when private witness data changes, exact coefficient rendering, rejection of unverified/overlap/wrong references, and no reference metadata in messages. Link the public entry points in a deterministic offline integration test. These fixtures establish the protocol, not live provider support or model performance.

Commands from the repository root:

```sh
bun test apps/api/src/protocol
bun run test
bun run lint
bun run typecheck
bun run build
```

Keep type generation and production build sequential. Review correctness and propagation into the decision registry and handoff. Inspect staged source/commit wording, credentials, generated artifacts, and local-only instruction exclusion before committing.

## Completion and Handoff

Resolve D-02 and D-03 in the roadmap before dependent work uses them. Record module 02 progress and the current product state accurately. Write `docs/handoffs/02-evaluation-protocol-and-answers.md` with exact profiles/schema, prompt examples, outcomes, budgets, fixtures, commands/results, supported environment, and limitations. A live endpoint cannot be marked compatible from these offline fixtures. Modules 03/04 may use the contracts after module completion; provider-backed work still requires its own gates.
