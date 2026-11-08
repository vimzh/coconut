# Depth-60 exploratory pilot

The user requested two fast, inexpensive OpenAI models at depth 60, using bounded parallel calls. This is a separate exploratory population; the existing confirmation, interior and reserve studies remain unchanged.

## Frozen design

- Nine exact-arithmetic tasks: three convex, three concave and three neither, all at measured operation depth 60 on `[-1,1]`.
- Existing seeded generator, seed `coconut-depth60-pilot-v1`, three fresh trials per task, `one-shot-json-v1`, provider-default sampling, 4,096 output tokens, no tools and no retries.
- Requested models: `gpt-4.1-mini` and `gpt-4o-mini`, selected for nonreasoning latency and low token prices. Official model pages mark both legacy models deprecated; metadata and actual inference permission are checked separately. This is not a contemporary frontier comparison.
- 54 maximum inference sends. Prior retained accounting is 7,854; this pilot reserves at most 7,908 cumulative sends within the unchanged 8,192 ceiling. Metadata requests do not count as inference. Existing unknown remote outcomes remain counted.
- Start with two inference requests in parallel, one per model. Raise concurrency to 12 only if both first response headers show at least 54 remaining requests and 100,000 remaining tokens; otherwise retain concurrency two. Stop new work on provider failure, rate limiting, cancellation, or evidence-persistence failure. Do not retry or replace failures.
- Standard 180-second inference and 20-second metadata deadlines; 15-minute overall deadline. Use the existing official SDK integration, fixed endpoints, explicit development credential, safe response bounds and header isolation.

## Verification and retention

1. Generate and replay the exact suite; independently check structural depth and mathematical labels with rational arithmetic before inference.
2. Freeze the suite/review/prior-ledger hashes, model matrix and budget before inspecting model answers.
3. Persist each dispatch authorization before its wire call and every result under ignored private storage. Preserve missing/unknown outcomes. Public local progress contains aggregate reports and hashes, without raw private answers or credentials.
4. Replay the shared scorer; independently recompute confusion counts and macro-F1 from retained outcomes. Review wrong/unusable responses with their exact references before making mathematical-error claims.
5. Run focused scheduler/input checks, API lint, type checking and build. Commit a cohesive checkpoint with results and limitations.

## Interpretation

The exact suite uses 56–57 active envelope pieces per task. It has substantive structural depth but grows length and piece count together. Convex/concave cases are piecewise affine and may be classified using a global closure shortcut. These tasks differ from the smooth challenge and the prior research construction; neither scores nor depth definitions are directly interchangeable. Three repeated calls are not independent mathematical tasks. Nine tasks and two model IDs establish no general failure threshold, model ranking, confidence interval or causal depth effect.

Official sources checked: [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini), [rate limits](https://developers.openai.com/api/docs/guides/rate-limits). Listed standard token prices per million: mini $0.40 input/$1.60 output; 4o-mini $0.15 input/$0.60 output. Any calculated cost is an estimate, not a provider bill.
