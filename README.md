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
