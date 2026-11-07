# Module 06: model discovery and compatibility

## Readiness and scope

Implement Hugging Face public catalog search and explicit model/serving-route selection for OpenAI, OpenRouter, and Hugging Face Inference Providers. Modules 02/05 and the SDK handoff supply the profile and credential contracts. OpenAI has live access evidence; OpenRouter/Hugging Face remain live-unresolved. Their implementation can be fixture-verified, but this module must not mark their provider feasibility gates Go from catalogs or documentation.

No evaluation inference engine, suite orchestration, saved credentials, frontend, downloads, or new model-serving backend belongs here. A separately consented, fixed compatibility probe is an access check, not a benchmark trial. It generates no score.

## D-07

- HF search is anonymous, bounded, and catalog-only. Return model IDs, task, and allowlisted advertised provider mappings; retain models with no advertised hosting. A successful empty array differs from a failed lookup. Accept no credential on this public operation.
- Selection requires an explicit visitor credential, provider, exact model ID, serving provider (null for OpenAI), profile, and verification mode. Metadata mode performs no inference. Probe mode additionally requires `acceptCharges: true` and permits one fixed profile-specific request with a 4,096-output-token ceiling and no retry.
- Query OpenAI model metadata with its official SDK. It does not supply capability/context/price fields; missing values remain unknown. Query OR endpoint metadata for the exact model and route. HF requires both Hub mapping detail and router metadata. Match canonical IDs explicitly; reject redirects, automatic selectors, arbitrary destinations, variants, and ambiguous OR route prefixes with advertised descendants.
- Advertised capabilities and an observed successful profile probe are separate evidence. The probe must complete with a valid response under the selected profile, preserve the requested output cap, and request native schema only when advertised or acknowledged by the service. A conforming JSON answer alone does not establish native schema support. Preserve unknown/unsupported capabilities; use the shared protocol compatibility checker.
- Return requested identity, catalog/canonical/provider-native identity, and independently reported inference identity separately. Never fill missing reported fields from requested values. Retain exact route parameter spelling (`max_tokens` versus `max_completion_tokens`) and advertised numeric limits rather than guessing aliases.
- Unknown prices/context remain null. Prices record currency, unit, source, and retrieval time; they are descriptive metadata, not a spend promise. Prompt-specific context fit remains unchecked until a real evaluation input exists.
- Selection evidence expires after five minutes and is not an authorization token. Downstream execution must re-resolve untrusted selection inputs with the current credential, preserve exact IDs/profile, renew changed availability, and retain actual inference outcomes. A successful preflight describes that request/date, not future permission, every possible response, or model accuracy.

## Architecture

1. Extract the existing bounded upstream transport into `providers/transport.ts`; preserve the public access API and all its error/budget/cancellation behavior. Reuse it for discovery. Generalize the private SDK request wrapper so model retrieval and profile probes use the same pinned SDK, environment isolation, and bounded HTTP-error handling.
2. Add `discovery/types.ts`, `policy.ts`, and focused catalog parsers. Preserve strict data validation and provider model/route rules. Add pure compatibility normalization separately from network orchestration.
3. Add discovery client functions for HF search and model selection. Each operation has a single 20-second deadline, at most three HTTP requests, a 1 MiB response cap per request, manual redirects, no cookies, no logs, and no automatic retries. Pass credentials separately; anonymous search never inherits one.
4. Add `/providers/models/policy`, public POST search, and credentialed POST selection using the existing origin/TLS/body-size/deadline boundary. CLI exposes the same operations with explicit provider-matched environment-key selection and exclusive evidence-file creation. Module 09 owns UI.

## Verification

- Unit/fixture coverage: real HF array-versus-object mapping shapes, empty versus failed searches, unavailable routes, duplicate display names/route IDs, optional metadata, context/output cap conflicts, both token parameter spellings, native schema unknown/unsupported states, and exact identities.
- Boundary coverage: arbitrary URLs, traversal, getters, extra fields, missing keys/consent, secret reflection in catalog/error bodies, redirects, invalid UTF-8, oversize bodies, deadline/caller cancellation, late readers, and simultaneous visitor isolation. Preserve all existing access tests.
- Integration: HTTP and CLI flows, explicit probe budget, status/usage/identity evidence, fresh versus expired selections, no model/profile substitution, no persisted keys, and no source-specific wording in application assets/commits.
- Live: OpenAI SDK metadata plus one probe for each profile on the already selected development model, preserving safe attempt/outcome evidence. Anonymous public HF search/detail can verify catalog contracts; no OpenRouter/HF inference is authorized by the OpenAI-only development preference. These service gates stay unresolved.
- Run Bun tests, lint, type checking, and production build; typecheck/build sequentially. Request independent review and behavioral verification before recording completion.

## Primary sources checked

- OpenAI [model retrieval](https://developers.openai.com/api/reference/resources/models/methods/retrieve), [TypeScript SDK](https://developers.openai.com/api/reference/typescript), and [the tested model specification](https://developers.openai.com/api/docs/models/gpt-6-luna).
- HF [Hub/router metadata](https://huggingface.co/docs/inference-providers/hub-api), [chat schema](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [structured output](https://huggingface.co/docs/inference-providers/guides/structured-output), and [routing](https://huggingface.co/docs/inference-providers/index).
- OR [endpoint schema](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model.md), [routing](https://openrouter.ai/docs/guides/routing/provider-selection), [chat parameters](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion.md), and [structured output limitations](https://openrouter.ai/docs/guides/features/structured-outputs).

The HF documentation plugin was discovered but returned an unavailable-tool error; official pages, official client source, and anonymous public metadata responses supplied the research. Record versions, exact live requests, outcomes, unknowns, and downstream obligations in `docs/handoffs/06-model-discovery-and-compatibility.md`. Resolve D-07 and update only owned roadmap progress/registry fields while preserving concurrent later-module documentation.
