# Coconut

Bun monorepo with a Next.js frontend and Hono backend. Requires Bun 1.4.4 and Node.js 24 LTS for Next.js and ESLint.

```sh
bun install
bun run dev
```

- `apps/web`: Next.js App Router with TypeScript, at http://localhost:3200.
- `apps/api`: Hono on Bun, at http://localhost:3201. `GET /health` returns `{"status":"ok"}`.

Run all commands from the repository root:

```sh
bun run lint
bun run typecheck
bun run test
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

Generate a scoring report from the controlled offline fixture:

```sh
bun run score:report --input apps/api/data/scoring/mixed-v1.input.json --output /tmp/coconut-scoring-report.json
```

Use a new output path. This fixture contains synthetic answers, usage, and costs for verification; it is not measured model performance. The shared scorer reports pooled macro-F1, class/depth detail, trial spread and agreement, completion, and evidence-backed usage/timing/cost diagnostics. The [module 04 plan](docs/plans/04-scoring-and-depth-analysis.md) defines the evidence contract and unavailable/provisional values.
