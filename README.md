# Coconut

Coconut evaluates whether language models can classify scalar functions as convex, concave or neither on an exact closed interval. It generates certified tasks, makes three fresh model requests per task, retains every planned outcome and reports macro-F1, accuracy, class/depth detail and execution evidence. Visitors supply their own provider keys.

The local product includes an evaluation workbench, inspectable private results, explicit publication, a leaderboard with separate comparison groups, and methodology pages. This repository requires Bun 1.4.4, Node.js 24 LTS and [uv](https://docs.astral.sh/uv/getting-started/installation/). Numerical setup installs pinned Python 3.13 and native interval arithmetic.

```sh
bun install --frozen-lockfile
bun run numerics:setup
bun run dev
```

- `apps/web`: Next.js App Router with TypeScript, at http://localhost:3200.
- `apps/api`: Hono on Bun, bound to loopback at http://localhost:3201. `GET /health` returns `{"status":"ok"}`.

Run all commands from the repository root:

```sh
bun run lint
bun run typecheck
bun run test
bun run numerics:test
bun run numerics:lint
bun run build
bun run start
```

`start` runs both production servers after `build`. To run one app, use `bun run --filter @coconut/web dev` or `bun run --filter @coconut/api dev`.

The documented development and production commands run from this checkout. The API binds to loopback and permits the exact frontend origin. `COCONUT_WEB_ORIGIN` configures that API origin allowance; `NEXT_PUBLIC_API_ORIGIN` configures the frontend's fixed API destination and must be set before a web build. HTTP destinations are limited to loopback development; other origins require HTTPS. The native worker and suite files remain alongside the checkout when using the built API.

Open `/evaluate`, choose a provider and exact model identifier, inspect settings, select a suite/profile and explicitly approve charges. Anonymous Hugging Face search also exposes catalog-only models; an advertised host or successful authentication does not establish inference permission. Compatibility probes are optional, charged separately and do not produce evaluation scores. No development environment key funds visitor traffic.

Each launch is foreground work: keep the page open. Cancellation stops new trials and aborts active calls; dispatched work can still incur charges. Runs are private for seven days and require a separate access code returned once. Save it explicitly to return after refresh. Private exports omit provider keys and access codes. Publication is intentional and reversible; interrupted runs cannot resume automatically. The API stores records in ignored `apps/api/data/private/runs.sqlite` with restrictive local permissions. Run one API process for this local product.

The leaderboard reads actual publications and retains partial/unsupported evidence as exclusions. Ranking requires a complete comparable population, stable reported identity and verified execution settings. Screening is exploratory and unranked. Repeats use the earliest-created eligible currently published execution rather than the highest score; private, withdrawn and expired history remains unknown. Exact score ties share a rank, and small differences do not prove model superiority.

The recommended **curvature challenge** contains 72 tasks across eight families and 24 parameter clusters, with all three labels represented in every family. It plans 216 inference requests. Independent analytic references and native interval certificates are retained. Its measured depths are 3, 4, 5, 6 and 14; family, expression size and depth are confounded, so depth curves are descriptive. A disjoint nine-task screening population is available separately.

```sh
bun run challenge:verify --input apps/api/data/suites/challenge-v1.json
bun run challenge:generate --population screening --output /tmp/coconut-screening-new.json
```

The original prompted-JSON and strict-schema profiles request at most 4,096 output tokens. Separate explicit reasoning profiles request 16,384 tokens and require OpenAI setting support; unsupported settings fail visibly. Three fresh trials, one attempt per trial, no SDK retries, 20-second metadata checks and 180-second inference deadlines apply. Concurrency is explicit and bounded by 12; token caps do not impose a currency budget.

The separate **interior exploration** adds 72 depth-13 tasks using nonlinear functions of dense quintics. Exact Bernstein bounds, bounded exponential series and native certificates agree on all labels. Its neither cases have interior sign changes that endpoints and midpoint alone miss. Three families share eight source-polynomial groups; the track remains descriptive and unranked with no confidence interval or inherited confirmation claim. Its [design and limitations](docs/research/interior-curvature-design-v1.md) and [AI-assisted independent review](docs/research/independent-interior-review-v1.md) are retained separately from the original challenge.

```sh
bun run interior:verify --input apps/api/data/suites/interior-v1.json
bun run interior:generate --output /tmp/coconut-interior-new.json
```

The separate **fine-scale curvature exploration** contains 18 tasks at depths 17 and 23, using logarithm, reciprocal and square-root compositions of two related source polynomials. All three labels appear twice per family. Exact Bernstein bounds, rational witnesses and native certificates verify the labels; an exact off-grid source-value comparison separates pairs that the nine coarse probes cannot distinguish. Its two related source groups remain exploratory and unranked, with no eligible confidence interval or inherited confirmation status. The [implementation decision](docs/research/conditional-reserve-decision-v1.md) retains its adaptive scope and authorization boundary.

```sh
bun run reserve:verify --input apps/api/data/suites/reserve-v1.json
bun run reserve:generate --output /tmp/coconut-reserve-new.json
```

The offline suite generator retains exact expressions and verifier certificates. Verify the frozen 75-case reference suite, or reproduce it into a new file:

```sh
bun run suite:verify --input apps/api/data/suites/reference-v1.json
bun run suite:generate --output /tmp/coconut-reference-v1.json
```

Generation refuses to overwrite an existing file. Supply `--request <json-path>` for a supported custom request. The [module 03 plan](docs/plans/03-instance-generator-and-suites.md) defines request fields, supported depths, identity, and coverage. Suite artifacts contain private reference evidence and are server-side data; only the protocol prompt builder supplies model-visible content.

The separate smooth engine adds exponential, logarithmic, square-root, rational, and polynomial functions. Native Arb arithmetic encloses derivatives with rigorous error bounds; adaptive interval covers establish global curvature and domain validity. Unresolved cases remain unverified. Its retained 27-case suite covers three labels at measured depths 7, 9, and 11:

```sh
bun run numerics:verify --input apps/api/data/suites/smooth-v2.json
bun run numerics:generate --output /tmp/coconut-smooth-v2.json
bun run numerics:benchmark --output /tmp/coconut-numerical-timing.json
```

Numerical artifacts use a separate format, generator, verifier, and task wording identity; the shared scorer accepts either artifact version. The legacy suite remains reproducible. Native batches accept up to 64 references with a 60-second deadline; provider keys are excluded from the worker environment. These commands currently run from the repository checkout; deployment must package the Python environment and worker alongside it. See the [numerical engine plan](docs/plans/numerical-certification-and-generation.md) and [handoff](docs/handoffs/numerical-certification-and-generation.md) for guarantees, actual timing, and limits. Richer function coverage does not establish model difficulty or comparable scores across suites.

New numerical requests explicitly select `promptVersion: "smooth-v2"`. This default uses domain-aware instructions, permits any valid mathematical method, and asks for a brief JSON justification. Historical five-field requests and `smooth-v1.json` retain their original wording and identities. The [prompt adaptation record](docs/research/prompt-adaptation.md) contains the exact current instructions, source provenance, and comparison limits.

Generate a scoring report from the controlled offline fixture:

```sh
bun run score:report --input apps/api/data/scoring/mixed-v1.input.json --output /tmp/coconut-scoring-report.json
```

Use a new output path. This fixture contains synthetic answers, usage, and costs for verification; it is not measured model performance. The shared scorer reports pooled macro-F1, class/depth detail, trial spread and agreement, completion, and evidence-backed usage/timing/cost diagnostics. Invalid formatting, refusals and truncated model replies stay in the model denominator; infrastructure or absent work keeps the score provisional/unavailable. Costs and token counts remain unknown when the provider supplies no evidence. The [module 04 plan](docs/plans/04-scoring-and-depth-analysis.md) defines the evidence contract.

Provider access uses a separate visitor credential on every operation.

OpenAI authentication and inference probes use the official `openai` TypeScript SDK, pinned to `7.53.0` with a tracked patch disabling inherited environment headers. SDK automatic retries and logging are disabled; the application retains its explicit visitor credentials, fixed endpoints, 20-second deadline, and bounded response handling. Future OpenAI inference work should use the SDK under the same credential rules. See the [SDK integration handoff](docs/handoffs/openai-sdk.md).

- `GET /providers/policy` explains the credential lifetime, charges, and probe limits.
- `POST /providers/access` takes `Authorization: Bearer <visitor credential>` and JSON `{"provider":"openai","operation":"authenticate"}`. This operation performs no inference.
- A probe additionally requires `operation:"probe"`, an explicit `modelId`, `servingProvider` (null for OpenAI; an explicit slug for routers), and `acceptCharges:true`. It makes one inference request with a 128-output-token ceiling and no retry.

The application stores no reusable credentials and never substitutes an environment key. Disconnect means clearing page-held credentials and aborting work; refresh/restart requires re-entry. The HTTP boundary permits HTTPS or loopback development and exact-origin CORS; set `COCONUT_WEB_ORIGIN` to the frontend origin when it differs from `http://localhost:3200`. Hosted TLS and proxy-log configuration still need deployment verification.

For an explicitly authorized local development check, the separate CLI reads a selected environment variable:

```sh
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY --model gpt-6-luna --accept-charges
```

The second command incurs provider usage. Optional `--output <new-path>` retains only safe evidence and refuses overwrites. OpenRouter uses `OPENROUTER_API_KEY`; Hugging Face uses `HF_TOKEN`, and router probes also require `--serving-provider <slug>`. OpenAI has live authentication/inference evidence; the other two services currently have fixture verification only. See the [module 05 handoff](docs/handoffs/05-provider-access-and-credentials.md) for lifecycle, evidence, and unresolved service gates.

Model discovery and profile compatibility use a separate flow:

```sh
bun run model:search --query gpt-oss --limit 5
bun --env-file=apps/api/.env run model:select --provider openai --model gpt-6-luna --profile one-shot-json-v1 --credential-env OPENAI_API_KEY
bun --env-file=apps/api/.env run model:select --provider openai --model gpt-6-luna --profile one-shot-schema-v1 --credential-env OPENAI_API_KEY --verify --accept-charges
```

Search reads the anonymous Hugging Face catalog, including models without advertised hosting. Selection defaults to metadata lookup and requires a fresh visitor credential; it makes no inference request. Both probe flags authorize one profile-specific compatibility check with the selected profile's output ceiling and no retry (4,096 for the two version-1 examples above). A successful check measures request acceptance and answer formatting, and produces no evaluation score. Missing capabilities, context limits, and prices remain unknown. Native schema request acceptance does not guarantee every future response conforms.

`GET /providers/models/policy` documents the limits. `POST /providers/models/search` accepts `{"query":"gpt-oss","limit":5}` and rejects Authorization headers. `POST /providers/models/select` requires a bearer credential and `provider`, `modelId`, `servingProvider`, `profileId`, and `verification` (`metadata` or `probe`). Probe mode also requires `acceptCharges:true`. OpenRouter and Hugging Face require an explicit advertised serving-provider slug; automatic routing and model substitution are rejected. Failed lookups differ from successful empty searches.

Selection records preserve requested, catalog, native, and reported identities separately. Evidence expires after five minutes and must be re-resolved with the current credential before evaluation; it is not an authorization token. The actual evaluation prompt still needs a context-fit check. See the [module 06 handoff](docs/handoffs/06-model-discovery-and-compatibility.md) for contracts and service verification limits.

Offline quality checks and retained experiments are documented in [the frozen criteria](docs/research/quality-criteria-v1.md), [independent reference review](docs/research/independent-challenge-review-v1.md), [original reconciliation](docs/research/experiment-reconciliation-v1.md), and [terminal replication audit](docs/research/openai-replication-review-v2.md). The original matrix produced no complete evaluation population; the replication preserved 171 completed publications alongside its failed, interrupted and unstarted work. Correct prefixes do not become complete perfect scores. The replication reached 7,090 conservative cumulative requests; subsequent studies remain separate:

| Study | Retained terminal outcome | Cumulative accounted requests |
| --- | --- | ---: |
| [P5 interior exploration](docs/research/interior-results-v1.md) | Two complete cells, 432 valid correct labels. | 7,522 |
| [Fresh o3 screening supplement](docs/research/remaining-models-results-v1.md) | Eight complete cells: 192 correct, one wrong valid, 11 invalid and 12 truncated replies. All 24 failures reviewed. | 7,738 |
| [Standard fine-scale reserve](docs/research/reserve-results-v1.md) | Two failed cells, eight unknown remote sends, no model answers and 100 unattempted trials. Scores unavailable, not zero. | 7,746 |

Across the preserved studies, **47 requested model IDs have execution records and 45 have a completed published cell**. Aliases/snapshots are separate requested names, not counts of independent architectures or 47 successful complete benchmarks. Exploratory studies remain unranked with no eligible confidence interval. No supported declared-frontier mathematical-failure finding is established; G-SIGNAL remains No-go. The o3/low point error, format failures, truncations and unknown remote outcomes retain their distinct meanings.

The cumulative figures include unknown sends and the retained controls/calibration allowance once; they are request accounting, not provider bills. A separately frozen **600-second operator-only SDK diagnostic is active**, with no terminal review yet and at most 108 fresh requests, for a conservative ceiling of **7,854 / 8,192**. It preserves the ordinary platform/profile's 180-second deadline and every failed standard-attempt record. Partial replies, including truncated outputs, are not complete scores or mathematical-failure evidence. Current-worktree QA also remains separately recorded work; earlier verification checkpoints do not certify concurrent edits.

OpenAI has live execution evidence. OpenRouter and Hugging Face integration are implemented and fixture-tested; live inference remains unverified under the OpenAI-only development restriction. Synthetic scalar classification establishes no general mathematical or production capability. Prior-work and adapted-prompt provenance remain in the linked research documentation. Hosted deployment and hackathon submission are outside the current work scope.
