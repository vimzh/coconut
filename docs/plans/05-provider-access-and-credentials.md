# Module 05 Technical Plan: Provider Access and Credentials

## Scope and evidence boundary

Implement visitor-owned authentication checks and explicit, single-request feasibility probes for OpenAI, OpenRouter, and Hugging Face Inference Providers. This is not model discovery, full inference, evaluation execution, ranking, or UI work. Reuse Bun/Hono and native fetch; add no dependencies. Apply the mathematical-research perspective: authentication evidence, model-specific inference evidence, fixture behavior, and benchmark results are distinct objects and cannot substitute for one another.

The development key is configured in ignored `apps/api/.env`. The user's persistent authorization permits OpenAI-only live development testing and substantial bounded parallel calls. This module needs at most **four authentication checks and four paid inference probes**, each one attempt and at most **128 output tokens**. No automatic retry or model substitution. OpenRouter/Hugging Face are implemented and tested with fixtures but remain **unresolved for G-PROVIDERS** without permitted live evidence. Never mark a service Go from documentation, a catalog, or another service's success.

## D-06: credential lifecycle

- Each operation requires an explicit visitor credential separately from its data. HTTP uses only `Authorization: Bearer …`; reject credentials in query/body fields and missing/malformed headers before any upstream call. No environment-key fallback, cookies, vault, connection token, account system, cross-request credential cache, or application persistence.
- The credential exists only in the operation's private execution context until completion/cancellation/deadline settlement. Later UI holds it only in current-page memory. Disconnect clears that state and aborts active operations; refresh/restart/interruption require re-entry. Never promise secure erasure of JavaScript strings.
- One future expressly approved bounded run may be a foreground operation/stream. Module 08 must not detach a task that retains credentials after returning. Background/resumable credential retention requires a new explicit lifecycle decision.
- Caller cancellation and an independent **20-second** deadline stop local waiting and request upstream cancellation. Already-sent upstream computation/billing can remain unknown. Verify actual Bun disconnect propagation; do not infer it merely from accepting an AbortSignal.
- Safe records contain only version/provider/operation/local request ID/time, requested and safely parsed reported model/route, categorical result, safe HTTP status, bounded numeric usage, and fixed billing/budget/lifecycle notices. Never retain headers, credentials/fragments/fingerprints, arbitrary upstream messages/bodies, request objects, raw transport errors/causes/stacks, or secret-bearing contexts. Operations use fixed HTTPS endpoints and reject redirects; caller-specified URLs/headers are forbidden.

## Provider contract

`AccessRequest` is exactly `{provider, operation:"authenticate"}` or `{provider, operation:"probe", modelId, servingProvider, acceptCharges:true}`. OpenAI servingProvider is null. OpenRouter and Hugging Face require an explicit provider slug; Hugging Face model ID excludes routing suffixes because the adapter adds the chosen provider. Requests are strict data, not arbitrary proxies. Probe bodies use one fixed short prompt, no tools/streaming/background state, **128 output tokens**, and exactly one HTTP attempt. Authentication never performs inference. Probe consent acknowledges charges to the credential's associated service/account; Hugging Face can use a configured upstream billing integration, so do not promise HF always bills directly.

`createProviderAccessClient(fetcher?)` exposes `(request, credential, signal?) => Promise<AccessResult>`. Credentials are never part of request/result types. Invalid local input throws an application-owned `AccessInputError` with constant messages. Provider/transport failures return safe categorical evidence. Result statuses distinguish authenticated, inference-verified, and not-verified; authentication success leaves inference unverified. An inference success proves only the requested model/route/operation/date, not either evaluation profile or permanent availability.

| Service | Authentication-only operation | Explicit inference probe |
| --- | --- | --- |
| OpenAI | GET `https://api.openai.com/v1/models`; verify expected list shape, discard catalog. | POST `https://api.openai.com/v1/responses`; model, fixed input, max_output_tokens=128, store=false. Require completed response and nonblank assistant output_text. |
| OpenRouter | GET `https://openrouter.ai/api/v1/key`; discard labels/account/limits/usage values. Ordinary keys, not management endpoints. | POST `https://openrouter.ai/api/v1/chat/completions`; max_completion_tokens=128, explicit provider.only, allow_fallbacks=false, require_parameters=true. Require complete nonempty assistant output with no body/choice error. |
| Hugging Face | GET `https://huggingface.co/api/whoami-v2`; discard identity/account data. | POST `https://router.huggingface.co/v1/chat/completions`; model `<hub-id>:<provider>`, max_tokens=128. Require complete nonempty assistant output. Token must permit Make calls to Inference Providers and the requested hosted model. |

The router rejects 2xx error-only bodies, missing/empty output, malformed responses, and incomplete generation as unverified. Do not silently retry a cap-limited probe. Error categories distinguish authentication rejection, permission, exposed credit/quota exhaustion, model unavailability, rate limits, service failure, cancellation/deadline, network failure, malformed/oversize response, and reflection of known credentials. HTTP/error-code mapping preserves ambiguity where providers do not expose a precise cause. Messages are local constants; no free-form upstream error is returned. Response reading is capped at **1 MiB**, across declared length and actual streamed bytes, under the same deadline. Only a narrow allowlist of known error codes influences classification. Reported model/provider strings must satisfy strict length/syntax checks and reject known credential reflection; response text never leaves the private parser.

## HTTP and runtime boundary

- `POST /providers/access` accepts a ≤4-KiB JSON body, explicit bearer header, strict operation fields, caller abort, no-store responses, and only permitted content type. Every success/failure carries safe data; unexpected exceptions are converted to fixed errors without logging their cause.
- `GET /providers/policy` supplies nonsecret lifecycle, charge, and budget disclosures before a probe. No provider calls.
- Exact-origin CORS permits the configured frontend origin (`COCONUT_WEB_ORIGIN`, default `http://localhost:3200`) and actual same-origin requests. Reject a present unapproved or null Origin before reading credentials/forwarding. Missing Origin supports explicit-key CLI clients. No credentialed cookies or wildcard origin. Preflight accepts only GET/POST and Authorization/Content-Type.
- Require HTTPS except loopback development URLs. Bind the local API to `127.0.0.1` rather than all interfaces. Hosted TLS/proxy/header-log configuration remains deployment verification, not a source-test claim; do not trust arbitrary forwarded-proto headers.
- No shared owner key is used by the application. A separate local CLI reads an explicitly selected environment variable, prints/writes only safe operation evidence, and requires `--accept-charges` and a model for probes. Its output never contains the key; no secrets in CLI arguments or fixtures. This CLI is not imported by the running API.

## Architecture and ownership

Create `apps/api/src/providers/`:

- `types.ts`, `policy.ts`: strict provider/operation/credential inputs, immutable policy, fixed plans/endpoints/budgets. Main owns.
- `responses.ts`: safe expected-body validation, reflection rejection, status/code mapping, numeric usage and result metadata. Main owns.
- `client.ts` and focused tests: one-attempt transport, deadline/caller abort settlement, streamed body bounds, private credentials, safe result construction. Independent worker owns.
- `routes.ts` and focused tests: Hono HTTP boundary, origin/CORS/body/auth checks, no-store/error handling. Independent worker owns; main wires `app.ts`/`index.ts` without disturbing health.
- `cli.ts` and tests: explicit development credential environment selection, authentication/probe commands, safe JSON evidence output and charge acknowledgement. Independent worker owns.
- Public `index.ts`, integrated safety tests, live evidence JSON, README, D-06 registry and handoff. Main owns.

No scoring/protocol/suite data or interfaces change. Later modules consume the stateless credential-use and safe evidence contracts, not a stored connection capability. Provider-managed payload retention remains separate from Coconut's application credential-retention policy.

## Verification checkpoints

1. Check fixed endpoint/body semantics against official sources; verify strict malformed/extra fields, missing credentials, explicit consent and route requirements, no owner-key fallback, and zero upstream calls on local errors.
2. Use safe fixtures for auth/permission/credit/model/rate/service errors, 2xx errors, wrong/empty/truncated success, reflected secret markers, malicious transport messages, redirects, oversize bodies and reading failures. Assert only safe fields/messages survive and no logs contain markers.
3. Concurrent visitors use isolated keys; check failure/abort/disconnect/next request cannot reuse another key. Test pre-abort, in-flight abort and deadline, bounded attempts, response reader cancellation, exact-origin CORS, HTTPS/loopback, 4-KiB body cap and no-store across outcomes.
4. Exercise the actual Bun server with a disconnected HTTP client before claiming request-close cancellation. Independent review checks credential dataflow and all externally observable behavior.
5. Run authorized OpenAI live checks only, through the implemented path and isolated environment key; capture exact model/date/operation/call ceiling/safe outcome/usage and inspect outputs for the real key without printing it. Authentication/model-list success is not inference success. A failed probe cannot be silently relabeled Go.
6. Run `bun test apps/api/src/providers`, `bun run test`, `bun run lint`, then `bun run typecheck` followed by `bun run build`. CLI examples: `bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY`; add `--model <explicit-model-id> --accept-charges` for a paid probe. Output is a nonsecret JSON evidence result.

## Official documentation checked

Checked 7 November 2026. Direct HTTP v1 interfaces have no new SDK dependency; Hugging Face whoami behavior was also checked against official hub implementation v2.4.0.

- OpenAI [authentication](https://developers.openai.com/api/reference/overview), [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create), [error codes](https://developers.openai.com/api/docs/guides/error-codes), [model catalog](https://developers.openai.com/api/docs/models/all).
- OpenRouter [current-key endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [chat completion](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [errors](https://openrouter.ai/docs/api_reference/errors-and-debugging), [privacy](https://openrouter.ai/docs/guides/privacy/data-collection).
- Hugging Face [Inference Providers](https://huggingface.co/docs/inference-providers/index), [chat schema](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [whoami](https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api#huggingface_hub.HfApi.whoami), [billing](https://huggingface.co/docs/inference-providers/pricing), [security](https://huggingface.co/docs/inference-providers/security).

The advertised HF documentation connector was unavailable, so research used official public pages. Current HF free accounts have no included inference credits; never advertise a free probe. Routing/privacy conditions can change and must not become permanent claims.

## Completion and handoff

Write `docs/handoffs/05-provider-access-and-credentials.md` with exact interfaces, lifecycle, commands/results, live vs fixture evidence and per-service gate status. Resolve D-06; mark only proven service gates Go. If live permission/credentials are absent, implementation may be complete while overall G-PROVIDERS and affected downstream service work remain unresolved. Preserve concurrent roadmap/later-module edits while committing owned work and pushing the private repository. Keep local AGENTS.md ignored; record the user's research perspective there only.
