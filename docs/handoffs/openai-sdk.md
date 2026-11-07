# OpenAI SDK integration

OpenAI authentication and access probes now use the official `openai` TypeScript SDK, pinned to `7.53.0` in the API package and Bun lockfile, with a tracked Bun patch for environment-header isolation. `models.list().asResponse()` performs authentication without automatic pagination; `responses.create(...).asResponse()` performs the explicitly approved probe. Mathematical generation and scoring remain local and require no model SDK.

The access policy, evidence version, prompt, token ceiling, and public interfaces remain unchanged. Future OpenAI inference work should use the SDK while preserving the visitor-owned credential boundary. This change does not implement module 07 or resolve its open decisions. OpenRouter and Hugging Face retain their existing HTTP adapters and unresolved live gates.

## Preserved safeguards

- One SDK instance per operation with an explicit credential, fixed OpenAI base URL, no inherited admin key, organization/project, or webhook secret, logging off, and `maxRetries: 0`. Later retries belong to explicit budgeted attempt records.
- The unmodified SDK eagerly parses `OPENAI_CUSTOM_HEADERS` in its constructor and offers no public opt-out. The tracked patch removes only that environment-header merge from its ESM, CommonJS, and TypeScript entries; explicit per-client headers remain supported. This prevents malformed ambient headers from disabling otherwise valid visitor operations. The custom fetch boundary additionally enforces the planned destination/method and rebuilds allowlisted authorization/content headers. Environment headers cannot redirect requests, substitute a key, or add account/routing information. Process environment is never changed by a request.
- The existing independent 20-second deadline, pre-cancellation, caller abort, manual redirect rejection, cookie omission, and late-response cleanup remain authoritative.
- SDK HTTP errors normally read response bodies eagerly, even with `.asResponse()`. The wrapper first applies the shared 1 MiB byte limit, strict UTF-8, credential-reflection checks, and cancellation handling. It gives the SDK a bounded copy and retains the original bounded failure for the existing categorical parser. Successful responses use the same bounded reader directly. No arbitrary SDK error body, message, stack, or cause enters public evidence.
- TypeScript's DOM library supplies the web `Response` types needed for compatibility between the SDK and Bun fetch types; the runtime remains Bun.

Implementation: `apps/api/src/providers/openai.ts`, called only from the existing provider client. The SDK is not imported by the frontend. `patches/openai@7.53.0.patch` is declared through Bun's `patchedDependencies`; frozen installs apply it. Unrelated dependency versions/platform metadata were preserved. An SDK upgrade must recheck the patch and isolation regressions; remove the patch when an upstream option provides equivalent behavior.

## Verification

Targeted provider checks cover 80 tests across six files, including actual SDK resource-method spies, exact wire bodies, no retries on HTTP/network failures, valid/malformed environment-header isolation, oversized/reflected/malformed success and error bodies, stalled error-body deadlines, concurrent visitors, and native HTTP disconnect propagation. The SDK client subset passes 31 tests / 440 assertions.

Live verification is retained separately in `apps/api/data/providers/openai-sdk-v1.json`. Through the application provider client, using the configured development key only in memory:

- Two verification phases retain the original SDK check and the final patched-SDK check, with one authentication request and one charge-approved `gpt-6-luna` Responses probe each: two authentication and two inference requests total.
- Both authentication requests returned HTTP 200 / authenticated. Both probes returned HTTP 200 / inference-verified. The original probe reported 10 input / 5 output tokens; the final patched probe reported 10 input / 17 output tokens, each against the 128-output-token ceiling. The final phase records the exact patch SHA-256.
- Zero automatic retries, model substitutions, or other-provider calls. Serialized evidence was checked for the raw, encoded, and base64 credential forms before writing; no credential or raw model output was retained.

These are access checks, not evaluation results. They establish neither schema/profile compatibility nor mathematical performance. Historical module 05 evidence remains unchanged.

Repository checks: 386 Bun tests / 16,279 assertions pass across 26 files; lint, type checking, and production build pass. A clean temporary workspace install with `bun install --frozen-lockfile` proved both ESM and CommonJS constructors honor the patch with malformed ambient headers. Independent review confirmed the constructor-isolation defect is fixed and found no remaining blocking issues. Setup uses `bun install --frozen-lockfile`; existing authorized local reproduction commands remain:

```sh
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY --model gpt-6-luna --accept-charges
```

The second command incurs provider usage. Hosted TLS/proxy logging, future inference orchestration, and live OpenRouter/Hugging Face checks remain outside this change.

Official documentation checked: [TypeScript/JavaScript SDK](https://developers.openai.com/api/reference/typescript) for resource methods, raw responses, retries, timeout, and custom fetch; [rate-limit guidance](https://developers.openai.com/api/docs/guides/rate-limits) for disabling SDK retries when application budgets own attempts. The installed `7.53.0` source independently confirmed eager HTTP-error body reads and environment-header merging.
