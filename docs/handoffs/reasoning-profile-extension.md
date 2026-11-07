# Explicit reasoning profile extension handoff

## Status

Implemented and locally verified. The additive profile/discovery extension is ready for the inference and run workstreams. No live model call was made, so this checkpoint establishes software behavior rather than model/account support for any specific effort.

The [technical plan](../plans/reasoning-profile-extension.md) records the contract, sources, ownership, and verification sequence. The original two version-1 profiles, frozen suites, retained discovery/access evidence, and scoring fixtures are unchanged.

## Public interfaces and behavior

- `protocol/types.ts` exports `ReasoningEffort` as exactly `none | minimal | low | medium | high | xhigh | max`. `ProfileId` additionally accepts `one-shot-json-v2-${effort}` and `one-shot-schema-v2-${effort}`.
- `listProfiles()` returns a frozen array containing the two original profiles followed by both formats for each explicit effort. Returned profiles, requirements, formats, and the shared answer schema are immutable. `getProfile()` accepts only these exact identities, without coercion/defaulting.
- Version-1 profiles retain 4,096 output tokens and provider-default reasoning. Version-2 profiles request 16,384 output tokens and their exact effort. Both retain protocol version 1, the same answer contract, three trials, two maximum attempts per trial, and at most 1,000 instances. At the 1,000-instance ceiling, version 2 budgets 3,000 logical trials, at most 6,000 attempts, and 98,304,000 requested output tokens across that maximum attempt budget. This is not a currency ceiling or an automatic retry authorization.
- Prompt construction inherits the selected cap/effort without changing the mathematical instructions or answer schema. Versioned profile IDs keep the new generation settings separate from historical comparison populations.
- Discovery's public policy is version 2 / `model-selection-v2`, lists all 16 profile-specific caps, and discloses the OpenAI-only explicit-effort boundary. Search evidence remains version 1. Selection result envelopes remain version 1; version-1 requests retain policy ID `model-selection-v1` and their original budgets/shapes, while version-2 requests use `model-selection-v2` and the selected cap.
- OpenAI compatibility probes send `reasoning: { effort }` for version 2. They require the exact response echo plus existing completed-text, valid-answer, output-cap, and native-schema checks. Missing, malformed, or mismatched effort returns failure code `invalid-provider-response` and probe outcome `reasoning-effort-unverified`. Plain valid JSON does not establish effort acceptance.
- Parsed version-2 probes optionally add allowlisted `reportedReasoningEffort` and `reasoningEffortRequestAccepted`. Unrecognized provider values are discarded as null. No new fields are added to version-1 probes, even if a provider reports an effort.
- OpenRouter/Hugging Face version-2 selections may retrieve public metadata but return blocked before a paid inference request. No credential is sent to those metadata requests. The low-level probe builder independently rejects routed explicit-effort requests. There is no effort/model/provider substitution.
- Catalog output-capacity comparisons and advertised context reservations use the selected profile's cap. Freshness, 20-second selection deadline, request ceilings, credentials, no-retry behavior, fixed destinations, and bounded/safe transport remain unchanged.

## Verification

Run on the local macOS workspace with Bun 1.4.4 on 8 November 2026:

| Check | Result |
| --- | --- |
| `bun test apps/api/src/protocol apps/api/src/discovery apps/api/src/providers` | 271 pass, 0 fail, 3,867 assertions across 18 files |
| `bun run --filter @coconut/api test` | 552 pass, 0 fail, 18,680 assertions across 37 files |
| `bun run --filter @coconut/api typecheck` | Pass |
| `bun run --filter @coconut/api lint` | Pass |
| `bun run --filter @coconut/api build` | Pass; 285 modules bundled |
| `git diff --check` | Pass |
| `git diff --exit-code HEAD -- apps/api/data` | Pass; tracked data bytes unchanged |

The complete API run includes the concurrently saved inference implementation; ownership and integration review remain with its main workstream. Tests cover all seven efforts in both answer formats, strict identifiers, immutable registry objects, unchanged legacy instructions/shapes, dynamic workloads, output usage at/above 16,384, missing/invalid/mismatched echoes, schema acceptance independently from JSON conformance, profile-specific catalog capacity/context checks, public policy limits, and router selections with no POST or credential forwarding. Existing provider credential-isolation and frozen suite/report regressions pass.

Selected unchanged artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `apps/api/data/suites/reference-v1.json` | `cda38393d5b768bc77be0031daec4568b455d3c0774d8c109daaca3e62bd1e78` |
| `apps/api/data/scoring/mixed-v1.report.json` | `19c4ce577685d3eea01deb09170b0119fc60ea024f1093e9ef0df1c0a7d4dde0` |
| `apps/api/data/discovery/model-selection-v1.json` | `99792091e5b235f2eb967ac851a97b94edcd77e68dae7ead3c4f5685f6f04e0a` |

No package, lockfile, inference source, provider transport, frontend, environment, deployment, or commit was changed by this workstream. An initial TypeScript-only test literal widening error was corrected; all final checks above pass.

## Sources and remaining limits

Checked the official [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning), [Responses TypeScript reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), and pinned SDK 7.53.0 `resources/shared.d.ts`. These agree on the parameter vocabulary and note that effort support is model-dependent. A successful echo is evidence for one observed request, not a guarantee about future responses, mathematical accuracy, or support for every effort. A larger requested token cap does not prove completion or eliminate truncation.

No live effort probe, evaluation, or credential/environment read was performed. Inference/run persistence and reporting must preserve profile identity, observed settings, incomplete work, actual attempts, and separate comparison populations. OpenRouter/Hugging Face explicit effort remains intentionally unsupported in this increment; existing version-1 service feasibility gates are not resolved by these fixtures.
