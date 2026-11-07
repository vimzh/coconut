# Module 06 handoff: model discovery and compatibility

## Status and boundaries

Implementation is complete under **D-07 / `model-selection-v1`**. OpenAI model retrieval and both version-1 profiles have live compatibility evidence on `gpt-6-luna`. Hugging Face search and both router catalogs have anonymous live metadata evidence. OpenRouter and Hugging Face selection/inference paths have fixture verification; their visitor-permission and live-inference gates remain **unresolved** under the OpenAI-only development instruction. Public metadata does not resolve G-PROVIDERS.

The [technical plan](../plans/06-model-discovery-and-compatibility.md) defines the scope. This module provides API and CLI operations; module 09 owns the browser interface. It does not execute mathematical evaluations, compute scores, establish model quality, resolve G-SIGNAL/G-QUALITY, or implement module 07's inference engine. No mathematical artifact, answer schema, evaluation profile, or scoring definition changed.

## Implemented interfaces

- [Discovery exports](../../apps/api/src/discovery/index.ts) expose `searchHuggingFaceModels`, `selectModel`, injectable client factories, immutable policy, strict parsers, freshness checking, and evidence types.
- [Catalog parsers](../../apps/api/src/discovery/catalog.ts) normalize the services' distinct wire formats without inferring missing capabilities or prices.
- [Client](../../apps/api/src/discovery/client.ts) resolves metadata and optionally makes one consented profile check. [Probe construction/parsing](../../apps/api/src/discovery/probe.ts) preserves completion, identity, usage, and request-acceptance evidence without retaining answer text.
- [Shared transport](../../apps/api/src/providers/transport.ts) extracts the existing access boundary. The public module 05 access contract remains unchanged. The [OpenAI wrapper](../../apps/api/src/providers/openai.ts) uses the pinned, patched official SDK for access, model retrieval, and profile checks with explicit credentials, fixed destinations, no automatic retries, and no logging.
- [HTTP routes](../../apps/api/src/providers/routes.ts) reuse the existing TLS/origin/body/deadline boundary. [CLI](../../apps/api/src/discovery/cli.ts) requires explicit provider-matched environment selection and exclusive output files.
- [Retained live evidence](../../apps/api/data/discovery/model-selection-v1.json) contains historical safe results, public metadata, request counts, and unresolved gates. Fixture evidence remains in focused catalog/client/probe/HTTP/CLI tests.

```ts
await searchHuggingFaceModels({ query: "gpt-oss", limit: 5 }, signal);
await selectModel({
  provider: "openai", modelId: "gpt-6-luna", servingProvider: null,
  profileId: "one-shot-schema-v1", verification: "probe", acceptCharges: true,
}, visitorCredential, signal);
```

`POST /providers/models/search` accepts exactly `query` and `limit` and rejects any Authorization header. Queries contain 1–80 Unicode code points, no controls or malformed Unicode; limits are 1–20. It sends one anonymous GET to the fixed Hugging Face catalog, including advertised mappings. Catalog-only matches remain visible. Successful empty results are `complete` with `models: []`; failed lookups are `failed` with a categorical failure.

`POST /providers/models/select` requires a fresh bearer credential and exactly provider, modelId, servingProvider, profileId, and verification. Metadata mode accepts no charge field and performs no inference. Probe mode additionally requires `acceptCharges: true`. `GET /providers/models/policy` discloses these limits. Requests accept no capability overrides, arbitrary destinations, headers, model substitution, or implicit route selection.

## D-07 resolution

### Evidence and compatibility

The shared protocol checker evaluates the selected profile's requirements as supported, unsupported, or unknown. Catalog claims and actual inference evidence stay separate. Metadata-only selection always remains `needs-verification` unless an explicit incompatibility blocks it, even when all catalog requirements are advertised. A successful HTTP response, authenticated key, model listing, or valid JSON reply alone is insufficient to claim executable native-schema compatibility.

Selection states:

| State | Meaning |
| --- | --- |
| `ready` | One completed profile probe returned a valid answer, and every required capability is established for that observed request. |
| `needs-verification` | Metadata is usable but required execution evidence is absent; missing hosting/parameters prevent an ungrounded charged probe. |
| `blocked` | An explicit conflict exists: absent/ambiguous route, known hosting rejection, unsupported required capability, or insufficient advertised output/context capacity. |
| `failed` | Metadata/probe transport or output failed. Preserve the categorical failure and any previously obtained metadata; no retry occurs. |

The probe has its own status and two independent booleans: `outputLimitRequestAccepted` and `nativeSchemaRequestAccepted`. A completed conforming answer can have probe status `verified` while a missing parameter acknowledgement leaves the overall selection `needs-verification`. These booleans describe observed request acceptance, not universal enforcement or future conformance. Reported output usage exceeding the requested ceiling contradicts that evidence and fails verification. Actual evaluation replies must still pass the shared extractor.

For OpenAI, model retrieval supplies identity but no capability, context, price, or output-capacity claims. A valid completed Responses reply establishes text input/output; the returned `max_output_tokens` must equal 4,096 to establish the requested cap. Strict-schema acceptance also requires the echoed schema name, strict flag, and complete schema to match the selected profile. Reasoning bookkeeping is allowed under provider-default reasoning; tool calls, refusals, incomplete/non-text output, and multiple assistant answers do not verify the profile.

For OpenRouter, use the exact endpoint's advertised parameter spelling: `max_tokens` or `max_completion_tokens`. The numeric `max_completion_tokens` capacity field does not establish a request-parameter alias. Known capacities below 4,096 block the profile. Native schema requires both `response_format` and `structured_outputs` advertised plus acceptance of the actual schema request and a valid reply. A missing parameter list stays unknown. Negative endpoint statuses retain their numeric value without assigning undocumented meanings.

For Hugging Face, combine the exact Hub mapping and router model entry. Both must advertise the selected provider as live and conversational before inference. Hub search mappings are arrays; Hub detail mappings are keyed objects. Missing mappings differ from explicit absence. The router documents `max_tokens` but supplies no per-provider maximum output capacity; successful request acceptance does not populate that absent capacity. Native schema additionally requires `supports_structured_output: true`; false blocks the strict profile, and missing remains unknown. Hosted execution is limited to these advertised Inference Providers routes.

### Identity, routing, and unknown metadata

Keep the connection service, requested model/route, catalog/canonical ID, provider-native ID, and independently reported model/serving-provider fields separate. Missing reported identity remains null; display names never select routes. For direct OpenAI requests, the connection service is known from `request.provider`, but that does not fill a missing reported serving-provider field.

OpenRouter uses `provider.only: [exactLeafTag]`, fallback disabled, parameters required, and web search disabled. A base tag with advertised descendants is rejected because it can route to multiple endpoints. Account-enforced plugins can still override preferences and incur charges, as disclosed by module 05. Hugging Face requests use `<hub-model-id>:<explicit-provider>`. Automatic selectors, model variants, traversal/empty path segments, redirects, and arbitrary URLs are rejected. Metadata can change between lookup and execution; the actual reported identity must remain visible.

Unknown context, output capacity, pricing, usage, and supported parameters remain null or unknown. Prices preserve currency and units: OR decimal USD/token strings versus HF numeric USD/million-token values normalized to strings. Each price has its exact `source` URL and `retrievedAt` lookup-start timestamp; pure offline catalog parsing leaves the timestamp null until associated with a real lookup. These are descriptive prices, not spend guarantees. Reserving 4,096 output tokens cannot fit an advertised context of 4,096 or less. Every real prompt still requires a context-fit check: all selection results explicitly retain `contextFit: "not-checked"`.

### Freshness, credentials, budgets, and failures

Evidence expires exactly five minutes after checkedAt. `selectionIsFresh` checks timestamps without invoking getters, but freshness does not authenticate a caller-supplied record. Module 07 must re-resolve the strict selection with the current visitor credential before execution and preserve explicit model/profile/route choices. A changed or revoked permission is a new failure; prior readiness cannot silently authorize another model or key.

Selection is one foreground operation with a 20-second whole-operation deadline, at most three HTTP sends, a 1 MiB response cap per response, no redirects/cookies, and no automatic retry. Metadata uses one GET for OpenAI/OR or two for HF. Optional probing adds exactly one inference request with a requested 4,096-output-token ceiling. The ceiling is not a currency budget. HTTP ingress is separately bounded to 4 KiB within its existing whole-request deadline. Cancellation settles even for a broken transport ignoring abort; already-initiated remote work/charges can remain unknown.

Credentials are separate arguments, never fields in selection evidence or reusable server state. Anonymous search reads no provider key. Public router metadata receives no Authorization header; only the selected service's inference endpoint receives the operation's key. OpenAI SDK calls retain explicit credentials and the existing environment-header isolation patch. Reflected raw/encoded/base64/JSON-escaped credentials, arbitrary error diagnostics, response bodies, and headers are discarded. No environment key funds visitor operations.

## Live verification

Recorded on **7 November 2026 UTC / 8 November IST**, using Bun 1.4.4 and the configured OpenAI development credential:

| Recorded operation | Result | Requests / reported usage |
| --- | --- | --- |
| OpenAI SDK metadata, `gpt-6-luna`, 19:33:44 UTC | `needs-verification`; capability/context/price unknown | 1 GET; no inference |
| Prompted JSON profile, checkedAt 19:33:56 UTC | `ready`; completed valid reply, cap acknowledged | 1 GET + 1 POST; 44 input / 28 output tokens |
| Strict-schema profile, checkedAt 19:33:56 UTC | `ready`; completed valid reply, cap and full schema acknowledged | 1 GET + 1 POST; 87 input / 37 output tokens |
| Anonymous HF search `gpt-oss`, limit 3 | Three matches, including a catalog-only model | 1 GET; no inference |
| Anonymous HF search `coconut-no-match-9f45c3f1`, limit 3 | `complete`, empty results | 1 GET; no inference |
| Anonymous HF Hub/router metadata, `openai/gpt-oss-120b`, `groq` | Exact live conversational route; native ID retained; missing output capacity unknown | 2 GETs; no credential or inference |
| Anonymous OR endpoint metadata, `openai/gpt-4o-mini`, `openai` | Exact route and `max_tokens` spelling normalized | 1 GET; no credential or inference |

The retained verification batch contains **3 OpenAI metadata requests, 2 OpenAI inference requests, and 5 anonymous catalog requests**, with zero retries. Documentation/research reads are separate from this recorded verification batch. No OpenRouter/HF credential or inference call was used. Currency cost was not supplied and is not inferred. The initial parser filled OpenAI reported serving-provider from the direct service; retained evidence explicitly documents its correction to null. This reporting correction required no additional paid request.

Both OpenAI profiles used their actual 4,096-token request setting, but the short fixed compatibility input does not establish mathematical correctness, long-prompt context fit, difficult-output completion, or availability for another credential/date. The two probe records are independent checks, not repeated evaluation trials. Historical `ready` records expire and are not current authorization.

## Verification and independent review

- `bun run test`: **494 pass, 0 fail, 17,544 assertions**, across 34 files.
- `bun test apps/api/src/discovery apps/api/src/providers`: **180 pass, 0 fail, 2,449 assertions**, across 13 files, including the unchanged access regressions.
- `bun run lint`, `bun run typecheck`, `bun run build`: **Pass** for API/web. Type generation and production builds ran sequentially.
- `bun run numerics:test`: **29 pass**; `bun run numerics:lint`: **Pass**. No mathematical source changed.
- Independent code review found output-cap contradictions, missing explicit price provenance, and CLI evidence loss on output-file failure. All three were corrected and covered by regressions; re-review reported **no blocking findings**.
- Independent behavioral verification passed a selected **154 tests / 2,096 assertions**, plus a native Bun HTTP fixture journey covering mounted policy/search/metadata/probe consent and real disconnect cancellation. Documentation gaps found during QA were filled. An expanded final independent replay hit the review service's usage limit; the complete root replay above passed afterward. Reviewers made no additional paid calls or secret reads.

Verification used macOS, Bun **1.4.4**, and Node.js **24.22.1**. The retained artifact distinguishes Bun's Node compatibility version from the actual Node verification tool. `git diff --check`, source-wording checks, and configured-key scans passed; local `AGENTS.md` and API environment files remain excluded.

The fixture suite covers strict descriptors/Unicode/consent, anonymous search and empty/failure distinction, exact identities, actual catalog shapes, missing metadata, parameter aliases, context/output conflicts, schema acceptance versus JSON conformance, unavailable/ambiguous routes, output/refusal/tool handling, credential reflection, concurrent visitor isolation, deadlines/cancellation, CLI failure exits/exclusive files, and the original access regressions. Native HTTP coverage also preserves socket-disconnect propagation.

## Downstream handoff and remaining gates

- **07:** Use the official SDK for OpenAI, re-resolve untrusted selection requests with current credentials, check real prompt context fit, preserve actual identity/usage/completion, and validate every answer. Do not treat a catalog or compatibility probe as an evaluation result. D-08 remains open; selection's no-retry probe does not decide evaluation retry behavior.
- **08/10:** Persist safe versioned evidence and explicit comparison identities, never keys. Metadata prices and compatibility checks do not establish measured cost or a score. Preserve failures, freshness, and route uncertainty.
- **09:** Implement the browser journey separately. Display discoverable versus hosted versus permission-verified states, charge consent, unknown metadata, and expired selections. Metadata lookup must remain visibly separate from a charge-approved probe/run.
- **Provider feasibility:** OR/HF live execution and visitor permission remain unresolved. Fixtures and anonymous catalogs do not satisfy their service gates. Keep the promised support in scope until permitted live verification or an explicit product-scope decision.
- **12:** Hosted TLS, proxy routing/log redaction, public deployment, and clean-environment provider integration remain unverified here. No new dependency was added; the SDK remains pinned to 7.53.0 with its existing patch.

Official provider sources and the unavailable HF documentation-plugin fallback are recorded in the [plan](../plans/06-model-discovery-and-compatibility.md#primary-sources-checked). Their details were checked against actual public wire responses and the local pinned SDK; future availability and parameter contracts still require renewal.
