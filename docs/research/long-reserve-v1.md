# Long-deadline reserve diagnostic

This is one separately versioned research method, **`long-reserve-v1`**, with a **600,000-millisecond inference deadline** and a 90-minute whole-study deadline. No diagnostic manifest was frozen and no model request was made during implementation. The method requires coordinator-supplied terminal accounting and independent code review before any intentional freeze or launch.

The standard reserve failed under the platform's unchanged 180-second deadline: **eight dispatched inference requests, eight unknown remote outcomes, zero model outcomes and 100 unattempted trials**. Two requests timed out and six peers were cancelled. A timeout is infrastructure censoring, not a wrong mathematical label. These observations motivate the new deadline; correctness selected no task, model or profile because no standard-study answer was observed. The diagnostic requests **all 108 trials afresh**, rather than resuming a prefix. All earlier records remain unchanged.

## Separate method and fixed population

Both `gpt-6-astra` and `gpt-6.1-sol` receive the unchanged fixed 18-case reserve three times: **54 fresh planned trials per model, 108 maximum new requests**, one attempt per trial and zero retries. Four operations per model give at most eight simultaneous operations. Requests retain max effort, 16,384 output tokens, the exact prior `smooth-v2` messages, Responses API, `store:false` and disabled truncation. The frozen suite, prompt array, reference fingerprint, proposal, amendment, coordinator decision and independent reference review are the same bindings described in [the standard experiment](reserve-experiment-v1.md).

The longer deadline belongs exclusively to this research operator. Normal provider transports, inference budgets, public profiles, platform RunViews, scorers, report IDs and leaderboard publication retain their existing 180-second contracts. A longer-deadline result cannot be presented as a completed standard-platform run or pooled into its score. The research output contains only normalized provider evidence, pure answer-extractor outcomes and descriptive counts with explicit denominators. It produces no official scoring report, confidence interval, ranking or stronger signal claim.

The population remains adaptive exploration: 18 fixed tasks, three families and **two related source groups**. Independent reference verification establishes labels and membership, not model difficulty. No model error is guaranteed.

## Immutable lineage and budget

The diagnostic pins these standard-study canonical JSON hashes:

| Artifact | SHA-256 |
| --- | --- |
| Standard reserve manifest | `a27c2ec00a34ac5d448c172126ece0c5a40d9407b1ed44c511f03d42abd69d41` |
| Final standard reserve ledger | `07ca4c3b50c7dc300440157d1551c0749d7b463e073cf1e07bb3aadd17daefa3` |
| Standard reserve primary reconciliation | `ee62acdec9b1ee0ec81a6a7704042f9f01b9a8629dc869c4b3ba3a9225403fed` |
| Standard reserve per-attempt send proof | `a91613e95f40f924f95a7f81d01fa7281bc4b8e83343fcce869826a693a423a2` |

The coordinator supplies `reconciled-inference-accounting` with exactly five terminal studies: `original`, `replication`, `interior`, `remaining-models` and `conditional-reserve`. Every entry retains manifest, final ledger, full primary reconciliation and per-attempt send-evidence paths and canonical hashes. Existing strict validation derives actual and unknown sends from unique attempts, reconciles whole-view hashes and terminal counts, and checks source chronology. Missing, active, aggregate-only or tampered evidence refuses freeze. Standard-study failure records remain private; only their derived counts and hashes inform this admission gate.

The 183 retained capability sends and calibration allowance four are counted once. The first four studies contribute 7,738 requests under that convention; the failed standard reserve contributes eight more, already including all eight unknown remote outcomes. Thus **prior requests are 7,746; adding at most 108 gives 7,854, within the unchanged 8,192 ceiling**. Unknown sends are never counted twice or treated as unused capacity. No new control or calibration inference is scheduled. Previously retained model-identity metadata is reused to build the exact Responses request; it is not represented as a fresh permission probe or current inference success.

## SDK transport and retention boundary

The operator uses the repository's official pinned and patched `openai` TypeScript SDK, version 7.53.0. The separate factory receives its credential explicitly, passes null for admin credential, organization, project, webhook secret and data residency, fixes `https://api.openai.com/v1`, disables logging and sets both SDK and per-request retries to zero. The custom fetch accepts only one POST to the fixed Responses endpoint and checks the SDK body against the pure prior request plan. It reconstructs only authorization and content-type headers, omits browser credentials and blocks redirects. Ambient SDK credentials, endpoints and custom headers cannot alter the wire request. SDK timeout/retry/signal behavior was checked against installed versioned source and [official SDK documentation](https://developers.openai.com/api/reference/typescript).

The entire response body, including HTTP error bodies before SDK inspection, is limited to one MiB and decoded with strict UTF-8. The pure existing normalizer limits assistant-visible text to 131,072 UTF-16 code units. Credential reflection is rejected both before and after JSON decoding; unsafe bodies are discarded and only a categorical failure remains. HTTP errors, network failures, cancellation and deadlines remain infrastructure evidence. No timeout is converted into a model answer or mathematical error.

Bun 1.4.4 also has a default five-minute socket idle timer. This operator explicitly disables that lower timer using `timeout:false`, while its independent 600-second abort signal and monotonic acceptance deadline remain enforced. This prevents the declared method from silently becoming a 300-second experiment. Bun documents the distinction between socket idleness and whole-request deadlines in its [fetch timeout reference](https://bun.com/reference/globals/BunFetchRequestInit/timeout). The normal platform transport is untouched.

Each attempt writes a private dispatch authorization and increments the conservative send counter **before the one wire POST**. The authorization records the model, case/trial identity, immutable manifest hash, timestamp and one reserved send. If persistence fails, the wire request is not started and execution stops. If cancellation or a crash occurs between durable authorization and transmission, the retained authorization remains conservatively unknown until independently reconciled; it is never silently reclaimed as free budget. Completed responses receive separate exclusive result files, retaining the bounded raw body, normalized evidence, extracted outcome and explicit 600-second method identity. No standard inference-budget object or platform run/report identity is fabricated.

Private attempt files live under ignored `apps/api/data/private/<new-progress-name>/attempts/`, inside an exclusive mode-0700 directory, with mode-0600 JSON files. Provider keys are never written or printed. The progress ledger contains aggregate descriptive counts and per-trial result hashes, with every planned/unattempted identity retained. Any infrastructure outcome stops further dispatch and aborts peers; all peers settle and retain cancellation/unknown evidence. No fallback, retry, replacement trial or automatic continuation is provided.

## Intentional commands and research publication

After independent review and the coordinator's final accounting artifact exist, the intended commands are:

```sh
bun apps/api/src/experiments/long-reserve.ts freeze --prior-accounting apps/api/data/experiments/long-reserve-prior-accounting-v1.json --output apps/api/data/experiments/long-reserve-matrix-v1.json
bun --env-file=apps/api/.env apps/api/src/experiments/long-reserve.ts run --manifest apps/api/data/experiments/long-reserve-matrix-v1.json --output apps/api/data/experiments/long-reserve-progress-v1.json --accept-charges --publish
```

These are future operator actions, not a claim that a diagnostic freeze or execution already occurred. Outputs, private directories and optional research-publication directories must be new. The explicit `--publish` flag writes a separate `-research-published/` directory only for model populations with all 54 qualified model outcomes. Answer, wrong-label and unusable-model counts retain their full denominators; accuracy among valid answers states its separate denominator. Infrastructure-censored populations are marked unavailable and omitted from publication. Raw infrastructure failures stay private; the public progress/index retains aggregate counts or hashes only. No application publication endpoint, private run link, normal RunView, official score or leaderboard entry is created. An incomplete study or failed persistence/publication exits unsuccessfully.

## Verification and remaining evidence

Focused offline fixtures currently pass **eight tests with 173 assertions**. They verify five-study lineage and unknown-send inclusion, fixed 600-second/90-minute identities, one Responses POST, exact messages/settings/store/truncation, pure prompt privacy, dispatch retention before transmission, null ambient routing/header/credential isolation in a child with synthetic environment values, zero retries, HTTP/network/timeout/cancellation categories, whole-body and visible-text bounds, plain and JSON-escaped secret rejection, stalled-read cancellation, persistence failure before transmission, 108-trial scheduling and concurrency, complete/unavailable denominators, duplicate rejection, consent and exclusive manifests. All HTTP responses are injected fixtures; no configured key is read and no live request is made.

API lint, type checking and build pass at this checkpoint. Independent code review and coordinator-integrated verification remain required before launch. Real 600-second latency behavior, provider inference permission, model outcomes and final diagnostic publication remain unobserved. The method must be assessed separately from the standard 180-second experiment even if it later completes.

## Coordinator launch checkpoint

The preceding implementation notes describe the prelaunch checkpoint. Independent read-only review subsequently traced the installed patched SDK, fixed destination/body/header policy, timeout and retry behavior, five-study proofs, scheduling, retention and publication; it reported **no actionable findings**. The reviewed source file SHA-256 is `efbfa683d6d27d2c886f9bd79d2e140c7c646c9bdae1aa0f1946622019c884b4`; the focused test file SHA-256 is `df6ac124dc6a960444de0b511029b4959ba2112df1b30c4dc31cf199b51c8101`. The coordinator separately reran all eight focused tests with 173 passing assertions.

The actual five-study accounting artifact is [long-reserve-prior-accounting-v1.json](../../apps/api/data/experiments/long-reserve-prior-accounting-v1.json), canonical SHA-256 `2cd94f1be8f076b781648db58daccfd3eda201bfdba7fdc7c1bb7a9c9b7e490c`. It records 7,746 prior sends. The new [frozen manifest](../../apps/api/data/experiments/long-reserve-matrix-v1.json), canonical SHA-256 `ba30c68369f40a118c96bca133c6ec1d4ab6445b15d37840edec0b6c6e6d2c63`, admits at most 108 fresh sends, giving a maximum of 7,854. The coordinator intentionally launched the declared command with explicit charge consent and research publication. Execution is pending at this checkpoint; a launch or dispatch count does not establish a returned answer, permission success or completed population. Terminal results require separate reconciliation and review.
