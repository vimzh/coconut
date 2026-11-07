# Module 07 handoff: individual model inference

## Status and D-08

Implemented and locally verified under **`individual-inference-v1`**. D-08 is resolved: one explicit foreground inference attempt, no automatic retry, 20-second metadata resolution followed by a 180-second inference deadline, bounded response reading, and preserved cancellation/remote-work uncertainty. The existing two-attempt profile maximum permits this stricter one-attempt policy; it does not require retries. Module 08 owns scheduling and retained runs; there is no detached background inference or direct arbitrary-prompt HTTP endpoint here.

OpenAI's two original profiles have live evidence. OpenRouter/Hugging Face have fixture evidence and remain **live-unresolved** under OpenAI-only development testing. The separate [reasoning-profile extension](reasoning-profile-extension.md) adds explicit effort identities without altering original settings; model-specific support still requires actual evidence. This is implementation completion within these stated service boundaries, not full product readiness.

## Interfaces and fidelity

The [plan](../plans/07-model-inference.md) precedes implementation. [Exports](../../apps/api/src/inference/index.ts) expose `executeInference`, injectable `createInferenceClient`, strict input parsing, policy and evidence types. [Policy](../../apps/api/src/inference/policy.ts), [adapters](../../apps/api/src/inference/adapters.ts), and [client](../../apps/api/src/inference/client.ts) keep validation, wire normalization, and execution separate.

```ts
const result = await executeInference({
  selection: {
    provider: "openai", modelId: "gpt-6-luna", servingProvider: null,
    profileId: "one-shot-json-v1", verification: "metadata",
  },
  prompt: verifiedProtocolPrompt,
  acceptCharges: true,
}, visitorCredential, signal);
```

Module 08 must build prompts from independently verified retained references. This internal boundary accepts the resulting two-message blueprint; it is not a public reference-upload or arbitrary-prompt API. It copies only documented fields, checks the exact selected profile's answer format/generation, rejects nested getters/extra fields and settings overrides, preserves message text exactly, and caps the encoded prompt messages at 256 KiB. Optional numerical wording identity is retained. Credentials remain separate arguments and cannot be reflected in inputs or returned evidence.

Each call re-resolves metadata with the current visitor credential; saved selection evidence is never authorization. Metadata performs no compatibility inference. Explicitly incompatible/unknown router hosting or required parameters block the actual send. Unknown OpenAI capabilities may be observed through the expressly charge-approved evaluation request; an HTTP/model-list success is not promoted into permission or mathematical evidence.

OpenAI requests use the pinned official SDK with the existing environment isolation patch, `store:false`, `truncation:"disabled"`, fresh exact messages, selected cap/schema/effort, no enabled tools, SDK retries disabled and logging off. Defaults remain omitted under version-1 profiles. OpenRouter/HF preserve exact route and advertised token parameter; fallback and web search preferences follow module 06. Explicit reasoning on routers remains unsupported; it cannot silently revert to defaults.

The shared provider transport and SDK wrapper now accept a validated timeout of 1–180,000 ms. Existing access/discovery calls retain their original 20,000 ms default and regression behavior. Malformed success JSON still fails. A bounded non-JSON error body preserves its HTTP authentication/rate/availability category; it never becomes success or a leaked diagnostic.

## Outcome and evidence contract

`InferenceResult` contains requested identity, independently reported identity, selected metadata, exact prompt, actual effective settings when reported, local attempt ID/start/end, request counts, budget, categorical failure, context-fit evidence, and a scorer-compatible `AttemptEvidence`.

- Completed text reaches the shared extractor unchanged. Invalid JSON, empty completed text, duplicate keys and invalid labels remain unusable **model outcomes**, separate from provider failures.
- Refusal, truncation, interruption and cancellation retain their own states and any supplied visible partial text. Valid-looking partial JSON is never promoted to a completed answer. There is no automatic retry or model/profile substitution.
- Tool/nontext output, contradictory settings/usage, malformed envelopes, and provider/transport failures remain infrastructure/protocol evidence. Missing metadata is null. Hidden reasoning content is excluded; only explicitly reported reasoning-token counts survive.
- Usage preserves provider input/output/reasoning fields and their semantics. Reasoning is a reported subset of output where documented. HF reasoning inclusion remains unspecified unless its response supplies supporting detail. Counts cannot be inferred from explanation length. Contradictory totals, reasoning above output, or output above the requested ceiling fail explicitly.
- OpenRouter's reported numeric/decimal usage cost may supply labeled billed USD evidence. Missing/invalid billing fields remain null; no price-based estimate or zero cost is fabricated. Failed/uncertain calls are not declared free.
- Returned output cap/schema values must not contradict the request. Explicit reasoning profiles require the exact reported effort; missing/different effort fails outside mathematical denominators. Missing effective settings remain visibly unknown.
- Only direct OpenAI disabled-truncation acknowledgement establishes `contextFit:"provider-enforced"` for that request. Router context fit remains `unverified`; a similarly named extra field does not establish an undocumented guarantee. Known incompatible context/output metadata blocks earlier.
- Visible raw text is retained up to 131,072 UTF-16 code units. Above the protocol's 65,536 limit the shared extractor can preserve an invalid answer; above the scorer's retention bound, content is explicitly discarded as `response-too-large` with `response-discarded-size-limit`, rather than silently truncated or counted as mathematical error. Whole responses remain bounded to 1 MiB with fatal UTF-8 and reflection checks.

Attempt elapsed time includes metadata resolution and inference work; it is not claimed to be provider compute time. Metadata HTTP sends and actual inference sends are separately counted. A preflight failure can therefore have HTTP attempts but zero inference requests. Caller cancellation after dispatch may leave remote execution or charges unknown. No provider credential is persisted, logged or used for another visitor.

## Live calibration

[Safe calibration evidence](../../apps/api/data/inference/openai-calibration-v1.json) records two independent checks on **7 November 2026, 20:03:57 UTC / 8 November IST**, using `gpt-6-luna` and the verified function `x²` on `[-1,1]`:

| Profile | Returned outcome | Reported input / output / reasoning tokens | Local elapsed time |
| --- | --- | --- | --- |
| `one-shot-json-v1` | Valid `convex` answer | 220 / 73 / 32 | 3,981.8 ms |
| `one-shot-schema-v1` | Valid `convex` answer | 263 / 82 / 29 | 3,876.6 ms |

Each used one model-metadata GET and one Responses inference POST, no retry, 4,096 requested output tokens. Both reported the requested model and disabled truncation; serving-provider identity and billed cost remain null. The native-schema request retained its actual schema acknowledgement. No OpenRouter/HF key or inference was used.

These are exploratory transport/normalization checks on one simple task, not repeated trials, a benchmark score, or model-failure evidence. Full safe visible answers and exact prompts are retained; hidden reasoning is not. The D-12 quality criteria were committed before these calibration records, and later confirmation requires its own exact frozen suite/matrix manifest.

## Verification and review

- `bun test apps/api/src/inference apps/api/src/providers`: **136 pass / 0 fail / 1,832 assertions**, across nine files.
- `bun run test`: **555 pass / 0 fail / 18,720 assertions**, across 37 files at the integration checkpoint, including the additive reasoning profiles and prior mathematical/scoring/provider regressions.
- `bun run lint`, `bun run typecheck`, `bun run build`: **Pass** for API/web. The initial anonymous PostCSS export warning was fixed; final web lint is clean. Next type generation/build ran sequentially.
- Live OpenAI calibration passed both original profiles as recorded above. Actual currency cost was not supplied.
- Independent review found effort-echo enforcement, router context overstatement and non-JSON HTTP error classification defects. All three were repaired with regressions; bounded re-review found **no remaining blockers**. The reviewer reproduced status classification using injected responses through the actual SDK wrapper, without paid calls or key reads.

Tests cover prompt fidelity, no reference metadata on the wire, strict consent/settings/getter boundaries, exact routes/schema/caps, valid and unusable output, all terminal states, hidden reasoning exclusion, usage/cost uncertainty and contradictions, raw size boundaries, changed permission, no retries, caller abort, independent deadlines, safe non-JSON HTTP failures, and unchanged access/discovery defaults. Tested on macOS, Bun 1.4.4 and Node.js 24.22.1.

## Module 08 obligations and remaining work

Build each prompt from the actual verified suite/version, preserve profile and mathematical task identity, and pass a fresh page-held visitor key. Keep runs foreground and bounded, propagate disconnect/cancellation, retain one result per planned logical trial, and call the shared scorer only with complete planned records including unattempted work. Do not merge original/default and explicit-effort profiles or treat infrastructure/format/budget failures as mathematical mistakes.

The run executor must retain actual effective-setting/context uncertainty and restrict later ranking appropriately. Saved-result access/publication remains D-09; scheduler/concurrency/progress remain module 08. Real visitor UI, persistent run behavior, frontier-model signal, OR/HF live execution, hosted deployment and submission are not completed by this inference module.
