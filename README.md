# Coconut

Bun monorepo with a Next.js frontend and Hono backend. Requires Bun 1.4.4 and Node.js 24 LTS for Next.js and ESLint. The numerical engine also requires [uv](https://docs.astral.sh/uv/getting-started/installation/); setup installs its pinned Python 3.13 environment and native arithmetic dependency.

```sh
bun install
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

The apps run independently. Browser requests across the two origins require explicit CORS configuration or a frontend proxy when adding API integration.

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

Use a new output path. This fixture contains synthetic answers, usage, and costs for verification; it is not measured model performance. The shared scorer reports pooled macro-F1, class/depth detail, trial spread and agreement, completion, and evidence-backed usage/timing/cost diagnostics. The [module 04 plan](docs/plans/04-scoring-and-depth-analysis.md) defines the evidence contract and unavailable/provisional values.

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
