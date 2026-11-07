# Module 07: individual inference

## Scope and D-08

Implement a provider-neutral, single-attempt inference client consumed by the foreground run executor. The caller supplies a protocol-built prompt, explicit model/route/profile selection, current visitor credential, and charge acknowledgement. No public endpoint accepts arbitrary prompts or reference labels. Module 08 loads and verifies suites and owns scheduling; module 07 preserves the supplied model-visible messages exactly.

Each logical trial makes **one inference attempt, without automatic retry**. The existing profiles permit up to two attempts but do not require retry; using one is within that ceiling and avoids silently repeating ambiguously billed work. Every actual request has a fresh local attempt ID, start/end times, safe requested/reported identity, settings, completion, usage, cost when reported, and remote-outcome uncertainty. Completed invalid, refused, truncated, cancelled, and provider-error outcomes remain distinct. Changing a model or retrying requires a new explicit operation.

Metadata is re-resolved with the current credential before each attempt; historical selection records are never authorization. Metadata lookup performs no paid compatibility probe. Unknown OpenAI capabilities may be checked by the expressly approved evaluation request itself; only its actual acknowledgement can establish observed settings. Unknown router parameters/hosting or explicit conflicts block inference. Such preflight failures are infrastructure/configuration evidence, never mathematical mistakes. Retain metadata HTTP counts separately from inference sends.

The provider operation has a **180-second inference deadline**, a **20-second metadata deadline**, fatal UTF-8, at most one inference send, 1 MiB response limit, no redirects/cookies/tools, and no SDK retries/logging. Caller cancellation propagates through both phases. A timeout or lost connection can leave remote execution/billing unknown. Extend the existing shared transport/SDK wrappers with an explicitly validated timeout option; existing access/discovery defaults and public contracts remain unchanged.

OpenAI uses the official pinned SDK Responses API, `store:false`, `truncation:"disabled"`, selected output ceiling, exact system/user input, and native schema only for its selected profile. Do not send sampling/reasoning overrides under the original default profiles. OpenRouter/HF preserve exact routes and advertised token parameter spelling from 06, schema when required, no fallback, and disabled web search. Account-enforced behavior remains outside local guarantees.

Do not invent context capacity or token counts. Reject known output/context conflicts before inference. OpenAI's explicit disabled truncation plus matching response evidence establishes service-enforced input fit for that request; absent acknowledgement remains unverified. Router prompt fit remains unverified unless supplied evidence establishes it; show this limitation and restrict later ranking rather than claim a tokenizer-independent bound. A successful short compatibility probe never proves a long evaluation prompt fits.

## Contracts and files

- `inference/types.ts`: strict request, normalized provider reply, identity/settings/context evidence, scorer-compatible attempt result, injectable client.
- `inference/policy.ts`: strict prompt/selection/consent validation and fixed operation limits. Copy only the two model-visible messages, the selected profile's exact response format/generation, and an optional recognized numerical prompt version. Reject reference/certificate extras, accessors, mismatched profiles, and credential reflection.
- `inference/adapters.ts`: fixed provider request plans and private wire-response normalization. Preserve returned text for unusable completed output and truncation/refusal where supplied; ignore reasoning bookkeeping content and do not expose hidden reasoning traces.
- `inference/client.ts`: current-key metadata refresh, one SDK/router send, bounded parsing, safe outcome/extraction, usage/timing/identity evidence. `index.ts` exports the narrow interface. Tests cover adapters, client and input boundaries.
- Existing `providers/transport.ts` and `openai.ts`: optional bounded timeout, preserving every original default and regression.

Scorer types already express input/output/reasoning counts with explicit semantics, nullable cost, elapsed time, extraction outcomes and infrastructure categories; reuse them. Unknown fields stay null. Never infer reasoning tokens from explanation length, cost from missing prices, or a serving provider from the requested route.

## Reasoning experiments and versioning

The broader user instruction authorizes explicit reasoning-effort experiments. Existing `one-shot-*-v1` profiles remain unchanged. Add separate versioned profile identities and comparison settings in a follow-up checkpoint before those experiments; requested effort, output ceiling, effective returned effort and budget must remain inspectable. Unsupported configurations remain failures/exclusions rather than silently reverting to defaults. Freeze D-12 before confirmatory mathematical runs, retain exploratory results separately, and never guarantee or select into model failure.

## Verification

1. Wire fixtures for all services: usable/invalid/refused/truncated/tool/nontext/multiple outputs, exact prompts/routes/schema/limits, absent and contradictory usage, effective settings, unknown context/cost, and safe reported IDs.
2. Boundary tests: missing key/consent, forged prompts/settings/selection, getters/extras, secret reflection, changed permission, unsupported parameters, redirects, oversized/invalid UTF-8, cancellation/timeout and ambiguous billing. Verify no automatic retry or model/profile change.
3. OpenAI-only live check on one retained verified task using each original profile; preserve complete safe attempt evidence and distinguish transport/format results from mathematical accuracy. Larger evaluations wait for the frozen quality criteria and module 08.
4. Run targeted tests, full Bun tests, lint, typecheck, and production build, with Next typecheck/build sequentially. Request independent code/behavior review. Record D-08, limits, exact counts, artifacts and unresolved service gates in `docs/handoffs/07-model-inference.md`; update only owned roadmap progress.

Official sources checked: [Responses request schema](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), [reasoning settings](https://developers.openai.com/api/docs/guides/reasoning), [input token counting/truncation semantics](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count), and module 06's current HF/OR source list. The local SDK is 7.53.0. No new backend dependency is required.
