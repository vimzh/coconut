# Module 10 plan: public comparisons

## Scope and sequence

1. Project the API's retained public summaries into explicit comparison groups and eligibility decisions. Verify with fixtures for matching/mismatched identities, missing evidence, incomplete work, screening, repeats, ties and expiry.
2. Add a read-only Next route that fetches only the fixed configured API `/runs/published` endpoint with no credential forwarding, no cache, bounded response size and a deadline. Verify failure, malformed and oversized responses separately from a valid empty list.
3. Build the public leaderboard and anonymous result page using the existing shell, tokens and `ResultsDashboard`. Fetch at most four selected comparable public records for detailed curves; honor revoked publication through fresh fetches. Verify lint, TypeScript, SSR and browser flows in final integration.

## D-10

Ranking requires an unexpired published completed run, a complete three-trial-per-instance scorer population, all planned work accounted for, zero infrastructure failures, a stable reported model identity, verified output cap and provider-enforced context handling. A requested native schema must have been accepted. Serving providers may remain unknown only for direct OpenAI; routed providers require one stable reported serving identity. Invalid answers, refusals and truncation remain in the scorer denominator and do not independently disqualify a complete run.

Comparison keys bind suite ID (including actual instance population), suite versions, prompt, protocol, profile, settings ID, method, workload, certification backend, depth coverage and concurrency. Models/services/routes identify entries within a group, not a shared execution identity. Screening populations are always exploratory and unranked.

Repeated executions of an identical requested and reported model/route in a comparison group select the earliest created eligible currently published run. All current publications remain inspectable and repeat links/counts are shown; private, expired and withdrawn runs are unknown, so this policy cannot prevent publication selection bias. Exact unrounded macro-F1 ties use competition ranks (1, 1, 3); ID ordering only stabilizes display. Trial min/max is descriptive spread, not a confidence interval or evidence of superiority.

## Interface and design

The existing laboratory workbench direction continues: cool neutral surfaces, restrained teal, IBM Plex Sans with mono identities and tabular figures. The characteristic content is the ranking table followed by the shared depth plot, with full identity details readable on demand. Empty results and unavailable service are separate states. No invented results or external submissions populate the page.

Files are confined to `src/lib/leaderboard*`, leaderboard components, `/leaderboard`, `/results/[id]`, and `/api/leaderboard`, plus this plan and the handoff. No provider operation, publication authority, scorer, suite or access policy changes.

## Verification commands

- `bun test apps/web/src/lib/leaderboard*.test.ts`
- `bun run --cwd apps/web lint`
- `bunx tsc --noEmit --incremental false -p apps/web/tsconfig.json`
- Root coordinates `bun run build` and browser verification after integration; no concurrent Next generation/build.

Frontend design follows the existing module 09 decisions. Unslop guidance attribution: Damir Sokolovsky, [@heydamir](https://x.com/heydamir), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
