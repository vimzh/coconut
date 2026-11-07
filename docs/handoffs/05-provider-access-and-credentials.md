# Module 05 Handoff: Provider Access and Credentials

## Status

**Implementation and local verification complete; G-PROVIDERS is partially resolved.** OpenAI has live authentication/inference evidence and credential-safety verification: **Go** for the tested operation. OpenRouter and Hugging Face are implemented and fixture-tested, with live gates **unresolved** under the user's OpenAI-only development instruction. This is not full three-service feasibility or final product completion. Do not mark untested services Go or assume one service satisfies another's gate.

D-06 is resolved in the [technical plan](../plans/05-provider-access-and-credentials.md). Access evidence/policy version: **`1`**. At the original module checkpoint, no dependencies, mathematical rules, scoring definitions, or evaluation profiles changed. Research rigor is recorded in local ignored `AGENTS.md`: proved facts, empirical observations, and unresolved hypotheses remain distinct; an access probe is not a mathematical evaluation result.

**SDK follow-up:** OpenAI requests now use the pinned official TypeScript SDK under the same access/credential contract. The [SDK integration handoff](openai-sdk.md) records the implementation, safeguards, and separate live evidence. The original module evidence and request counts below remain historical records.

## Artifacts and public interfaces

- [Public provider interface](../../apps/api/src/providers/index.ts): `checkProviderAccess`, `createProviderAccessClient`, policy/budget constants, `AccessInputError`, and safe operation/evidence types.
- [Policy](../../apps/api/src/providers/policy.ts): immutable disclosures, explicit consent, strict credentials/operations, fixed provider request plans.
- [Response parser](../../apps/api/src/providers/responses.ts): private provider-body inspection, safe error categories, completion evidence, reflection rejection, nullable usage.
- [Transport](../../apps/api/src/providers/client.ts): one request, bounded body, independent deadline/caller abort, safe evidence, no environment fallback.
- [HTTP boundary](../../apps/api/src/providers/routes.ts), mounted in [app](../../apps/api/src/app.ts); [server](../../apps/api/src/index.ts) binds to `127.0.0.1` for development.
- [Local CLI](../../apps/api/src/providers/cli.ts): explicit environment selection and safe exclusive evidence output.
- [Live OpenAI evidence](../../apps/api/data/providers/openai-access-v1.json), distinct from synthetic test fixtures. No raw model output, headers, account/catalog information, or credential is retained.

```ts
const result = await checkProviderAccess(
  { provider: "openai", operation: "authenticate" },
  visitorCredential,
  abortSignal,
);
```

Probe input is exactly provider, operation `probe`, modelId, servingProvider (null for OpenAI; an explicit router slug otherwise), and acceptCharges `true`. Credentials are separate arguments, never fields on operation/evidence objects. Authentication input has only provider and operation. Unknown fields/URLs/forwarded headers, missing/invalid credentials, implicit routes, or missing charge acknowledgement fail before upstream calls.

## D-06 lifecycle and downstream obligations

Every operation requires its own explicit visitor credential. HTTP accepts only `Authorization: Bearer …`; there is no cookie, session/vault, reusable connection token, credential cache, persistence, or application-owned key substitution. The separate development CLI alone reads an explicitly selected credential variable. Running the API with a configured environment key does not authorize it to use that key for a visitor.

Credentials remain in the current operation's private execution context until completion/cancellation/deadline settlement. The application stores none for reuse. JavaScript memory is not claimed securely zeroized. Future UI must hold keys only in current-page memory; disconnect clears that state and aborts active operations. Refresh, process restart, or interrupted execution requires re-entry. Disconnect does not revoke the key at its provider, reverse billing, or prove already-started remote computation stopped.

A future expressly approved bounded run may remain one foreground operation/stream. Module 08 must not return a job ID while silently retaining a key in a detached task. Background/resumable credential retention needs an explicit D-06 revision. D-09 may retain completed nonsecret evidence, not authorization material.

Each HTTP POST has one **20-second** deadline spanning ingress/body parsing and provider execution. The transport also enforces its own 20-second maximum for direct library/CLI calls. Pre-abort sends nothing. After dispatch, cancellation/deadline is recorded with remote outcome unknown; reader cleanup never extends the deadline. A native Bun loopback test verified actual client disconnect propagation to the upstream abort signal. Browser navigation/refresh behavior remains later UI verification, and remote billing cancellation is not claimed.

Persist only allowlisted safe results: provider/operation/local request ID/date, requested and safely parsed reported model/route, result category, safe HTTP status, nullable numeric usage, and explicit budgets. Request IDs are non-authorizing evidence identifiers. Never save authorization headers, keys/fragments/fingerprints, complete request objects, raw provider bodies/errors/causes/stacks, or secret-bearing operation contexts.

## HTTP behavior and limits

- `GET /providers/policy`: nonsecret lifecycle/charge/budget disclosures, zero provider calls.
- `POST /providers/access`: strict JSON, explicit bearer credential, body at most **4,096 bytes**, and exact documented operation fields. No query parameters.
- Boundary errors use fixed safe messages and 400/401/403/408/413/415 statuses. Valid operation evidence uses HTTP 200 with explicit status **authenticated**, **inference-verified**, or **not-verified**; HTTP 200 alone is not proof of inference. Unexpected errors become fixed 500 responses without logging their contents.
- Exact-origin CORS accepts the configured frontend origin (`COCONUT_WEB_ORIGIN`, default `http://localhost:3200`) and actual same origin. Missing Origin supports explicit-key CLI clients. Present null/foreign/lookalike origins fail. Preflight allows only GET/POST with Authorization/Content-Type, no wildcard origin or credential cookies.
- Require HTTPS except loopback development. Arbitrary forwarded-proto claims cannot bypass the guard. All provider-route responses, including errors, disable caching.
- Fixed HTTPS provider destinations; no caller URLs, redirects, automatic retry, or model substitution. Provider responses are capped at **1 MiB** before/while streamed reading. Invalid UTF-8, malformed bodies, missing/incomplete output, and reflected known credential forms are discarded.

Hosted TLS, trusted proxy routing, and infrastructure logging/redaction are **not** verified by these source/local tests. Deployment must preserve this boundary and keep Authorization out of proxy/telemetry records; a local Go is not deployed-system assurance.

## Provider-specific operation and billing evidence

| Service | Authentication check | Inference probe | Gate |
| --- | --- | --- | --- |
| OpenAI | GET `/v1/models`; discard catalog | Responses API; explicit model, fixed short input, max_output_tokens=128, store=false; completed assistant output required | **Go** for recorded model/operation/date |
| OpenRouter | GET `/api/v1/key`; discard labels/account fields | Chat completions; max_completion_tokens=128; explicit provider.only; fallback disabled; parameters required; web plugin disabled | **Unresolved**, no permitted live test |
| Hugging Face | GET `/api/whoami-v2`; discard identity/account data | Inference Providers router chat endpoint; explicit `model:provider`; max_tokens=128 | **Unresolved**, no permitted live test |

Each probe is **one HTTP attempt / one requested inference operation**, with one fixed `Reply with OK.` prompt, no automatic retry, and a requested 128-output-token ceiling. It does not establish either 4,096-token evaluation profile, schema support, sufficient context, mathematical quality, or availability for another credential/model/date.

OpenRouter virtual/multi-model selectors and colon variants are rejected, while explicit single models such as `openrouter/owl-alpha` remain allowed. The fixed selector list is documented in the plan and must track current provider evidence; module 06 owns broader model discovery/compatibility. Web-search request defaults are explicitly disabled. Account-enforced plugin settings can override per-request preferences and add charges, so the public disclosure does not promise a tool-free account or monetary ceiling. Token caps are not currency limits. OpenRouter reported routing identity may be absent and remains null; requested route is not substituted as reported evidence.

Hugging Face tokens must permit Make calls to Inference Providers and the specific hosted model. Discovery or whoami success alone does not prove that. Normal completion can use `stop` or `eos_token`; length/tool-call/unknown endings remain unverified. Standard routing follows HF billing configuration, which may include a configured upstream billing integration. No free quota or universally HF-funded account is promised. Provider payload retention remains subject to provider/account policies, separately from Coconut's non-retention of credentials.

## Live OpenAI verification

On **7 November 2026**, with both operation checkedAt timestamps **17:56:54 UTC**, through the actual native Bun loopback HTTP API:

1. Authentication returned HTTP 200 / status authenticated.
2. An explicitly charge-approved **`gpt-6-luna`** Responses probe returned HTTP 200 / status inference-verified; reported model **`gpt-6-luna`**, **10 input tokens / 5 output tokens**, against the requested **128** output-token ceiling.

The policy endpoint was read before the probe. Credential absence in serialized safe evidence was checked using the real key in memory, without printing it. Recorded operation IDs are `fd85708d-5f79-4e71-80c7-3f1be1daace2` (authentication) and `026c8aa4-52cf-4271-bd49-b5ca9e7c6e21` (probe). These are local IDs, not upstream response IDs or reusable capabilities.

Total development provider requests: **three authentication/model-access GETs** (including CLI and bounded public-candidate inspection) and **one paid inference POST**, no retries. The public candidate inspection discarded all other catalog fields. This stayed below the plan's four authentication/four probe ceilings. Actual currency cost was not reported and is not inferred from token counts. No OpenRouter/Hugging Face call or credential was used. Authentication and a nonempty bounded generation establish access feasibility, not benchmark performance.

Reproduction requires the developer's configured key or a visitor's own permitted credential:

```sh
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY --model gpt-6-luna --accept-charges
```

The second command incurs usage. Optional `--output <new-path>` saves only safe evidence and refuses overwrites. CLI uses provider-matched variables only: OPENAI_API_KEY / OPENROUTER_API_KEY / HF_TOKEN. It accepts no raw key argument, never echoes invalid arguments/paths/upstream diagnostics, and exits nonzero for unverified outcomes or input/I/O errors.

## Verification and review

- `bun test apps/api/src/providers`: independent final behavioral verification reports **77 pass, 0 fail, 1,169 assertions** across six files.
- `bun run test`: **364 pass, 0 fail, 12,647 assertions** across 22 files, including all prior mathematical/protocol/suite/scoring tests.
- `bun run lint`, `bun run typecheck`, and `bun run build`: **Pass** for API and web. Type generation and production build ran sequentially. API build now includes the provider routes. No remaining check errors or warnings were reported.
- Live CLI authentication passed; actual HTTP authentication and explicit `gpt-6-luna` inference probe passed as recorded above. Total three authentication/model-access GETs and one inference POST, no retries or other-provider calls.
- Independent code review found provider-specific completion handling and OpenRouter automatic-selector/plugin risks. Fixed HF `eos_token` acceptance, explicit virtual-selector/variant rejection with zero upstream calls, default web-plugin disablement, and accurate account-policy charge disclosures. Positive coverage preserves fixed models in the same namespace. Re-review found **no remaining actionable findings**.
- Independent behavioral verification passed stateless isolation, body/deadline/caller cancellation, native Bun disconnect propagation, origin/TLS/caching boundaries, malformed/reflected input, CLI safe evidence, and the recorded OpenAI artifact. Bounded recheck passed all 77 provider tests and confirmed the remaining non-OpenAI/deployment gaps are stated explicitly. No independent additional paid call was made.

Tested on macOS with Bun **1.4.4** and Node.js **24.22.1**. The initial root-directory probe correctly found no inherited key; explicitly loading the configured API environment enabled live verification. Early in-progress TypeScript errors in concurrent tests were corrected before the final checks. No credential value was printed or written to source/evidence, and both `AGENTS.md` and `apps/api/.env` remain ignored.

Fixtures cover each service's successful auth/probe shapes, authentication/permission/credit/model/rate/service rejection, 2xx error bodies, incomplete/empty/malformed responses, token usage uncertainty, native redirect rejection, exact/oversize streamed bodies, raw/encoded/base64/escaped secret reflection, malicious error messages/causes, concurrent visitor isolation, absence of owner-key fallback, explicit consent, routing restrictions, and CLI safe exclusive output.

HTTP tests cover exact origins and preflight, TLS/loopback, bounded body/UTF-8, pre-abort, stalled ingress/cancel hooks, a client ignoring abort, timer/listener cleanup, caching headers, and safe unexpected errors. Native Bun integration proves actual socket-disconnect propagation with a synthetic upstream and no provider call. Local-only cancellation evidence is not extrapolated into remote billing certainty.

## Remaining gates and handoff

- **06/07:** OpenAI access path may proceed within this recorded scope. OpenRouter/Hugging Face live execution remains blocked until controlled credentials and permitted inference evidence exist; do not use the development OpenAI key for those services. Check current model/profile/account compatibility independently before evaluation.
- **08:** Pass credentials separately from records, keep any approved run foreground/bounded, propagate cancellation, preserve uncertainty after interruption, and require re-entry rather than silently resuming with a saved key.
- **09:** Implement current-page key state, disclosure before a charge-approved probe/run, disconnect/refresh handling, and exact error/evidence states. This module builds the backend boundary, not the browser connection UI.
- **12:** Verify hosted HTTPS, trusted proxy behavior, and real infrastructure logs before public deployment. Full product completion still requires all promised service gates.

The [plan's official references](../plans/05-provider-access-and-credentials.md#official-documentation-checked) document provider conditions checked on this date. Service behavior can change; a prior check does not guarantee future permission, credit, model availability, or unchanged retention policy.
