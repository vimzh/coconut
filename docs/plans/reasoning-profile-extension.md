# Explicit reasoning profile extension

## Contract

Preserve both version-1 profiles, their 4,096-output-token cap, provider-default reasoning, three trials, two-attempt ceiling, 1,000-instance ceiling, prompts, answer contract, and frozen artifacts. Add 14 explicit profiles: `one-shot-json-v2-{effort}` and `one-shot-schema-v2-{effort}` for exactly `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`. Every version-2 profile requests 16,384 output tokens; the protocol and answer schema remain version 1. Profile identity keeps these populations separate from historical runs.

The profile registry is immutable and enumerated through `listProfiles()`. Strict lookup rejects missing effort, unknown effort, case variants, coercible inputs, and prototype keys. Workload totals use the chosen profile's output cap.

## Evidence and compatibility

The official [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) and [Responses TypeScript reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), checked 8 November 2026, document `reasoning.effort` and the seven model-dependent effort values. The installed pinned OpenAI SDK 7.53.0 declares that exact union in `resources/shared.d.ts`. This establishes parameter vocabulary, not that every model/account supports every effort.

Only direct OpenAI selection supports explicit reasoning in this increment. OpenRouter and Hugging Face metadata may be inspected, but version-2 selections are blocked before any paid probe; the low-level probe builder also rejects routed explicit-effort requests. No fallback to provider defaults or another effort is permitted.

OpenAI version-2 probes send `reasoning: { effort }` plus the profile's 16,384-token limit. A completed, valid answer must additionally echo the exact requested effort in `response.reasoning.effort`; a missing, invalid, or different value yields `invalid-provider-response` with probe outcome `reasoning-effort-unverified`. A conforming JSON answer does not prove effort acceptance. Existing text, completion, output-cap, schema, identity, usage, cancellation, credential isolation, and safe-error checks remain enforced.

Historical version-1 selection results keep `model-selection-v1`, their original budget, and their original probe shape. Version-2 results use `model-selection-v2` and may add explicit effort evidence. The public discovery policy moves to version 2, enumerates profile-specific limits, discloses the larger maximum cap, and explains the OpenAI-only boundary. Catalog output capacity and context checks use the selected profile rather than a fixed 4,096.

## Ownership and sequence

1. Update only protocol types/profile registry/exports and add focused profile tests. Verify all 16 profiles, legacy object equality, immutable trees, strict rejection, and calculated workloads.
2. Update discovery policy/types/catalog/client/probe and focused tests. Verify all effort request/echo pairs, missing/mismatch rejection, cap boundaries, unchanged version-1 shape, and no charged router request.
3. Run protocol/discovery/provider regressions, API lint/typecheck/build, and frozen-artifact checks. Report unrelated concurrent failures to the main workstream rather than editing inference, run, package, or frontend files.
4. Record exact verification and remaining live-service limitations in `docs/handoffs/reasoning-profile-extension.md`.

No dependency, SDK upgrade, environment read, model call, deployment, or commit is authorized in this workstream. Root and adapter owners handle inference propagation separately.

## Verification commands

```sh
bun test apps/api/src/protocol apps/api/src/discovery apps/api/src/providers
bun run --filter @coconut/api lint
bun run --filter @coconut/api typecheck
bun run --filter @coconut/api build
git diff --check
```

Use the existing frozen-suite/report replay tests and compare tracked data files with their pre-edit bytes. The fixtures establish software behavior only; they are not live reasoning-effort verification or model-quality measurements.
