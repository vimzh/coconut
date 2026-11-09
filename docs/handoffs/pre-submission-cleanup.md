# Pre-submission cleanup handoff

The user requested removal of confusing obsolete tests and unused implementation before submission. Cleanup removes presentation and completed-pilot coverage with no current consumer. Current application behavior, comparison scores, mathematical policies and raw evidence are unchanged.

## Removed implementation

- Old landing tables: `model-scores.tsx` and `depth60-results.tsx`.
- Their exclusive projection helpers: `landing-scores.ts`, `landing-fast-scores.ts`, `landing-pilots.ts`.
- Their retired exporters: `scripts/export-landing-scores.ts`, `scripts/export-fast-model-scores.ts`.
- Orphaned leaderboard UI: `leaderboard-workspace.tsx` and `leaderboard-table.tsx`. The public comparison API, current public result rendering and their tests remain.
- Unreferenced `Noise.tsx`, its exclusively attached license, and `ui/badge.tsx`.
- Unused legacy classes in the shared score-table CSS. Current table styles remain.

Repository-wide reference searches confirmed the removed chains have no active route, supported CLI, dynamic loader or remaining source consumer. The current page still uses `CompositionResults`, validated deep/fast/composition aggregates and the existing workbench.

## Removed obsolete tests

- `apps/web/src/lib/landing-scores.test.ts`, `landing-fast-scores.test.ts`, `landing-pilots.test.ts`: eight retired presentation cases.
- `apps/api/src/experiments/depth60.test.ts`, `depth100.test.ts`, `depth216.test.ts`, `deep-pair.test.ts`: 14 completed structural-pilot-only cases.

Total: seven test files / 22 obsolete cases. The four pilot test paths are not pinned in retained source/audit manifests. Non-test historical operators/reference implementations remain byte-identical. `long-reserve.test.ts` remains because its exact test path/hash is part of a retained verification record.

The [testing guide](../testing.md) now maps remaining checks to supported features. All seven visitor workloads, current reference verification/scoring, provider and official-SDK credential isolation, execution, imported-task admission, current research audits and configurable CLI coverage remain. Test age alone was not a deletion criterion.

## Evidence and documentation

All existing `apps/api/data` and `apps/web/public` files remain byte-identical, including old score JSON expressly retained by the user. No private experiment directory, source population, model reply or audit was deleted. Historical handoffs retain their original checkpoint results; retired exporter commands are identified as historical instead of presented as current entry points. README/development wording now describes the public comparison API rather than the absent old leaderboard screen.

## Verification

- `bun run test`: 919 passed (807 API, 80 web, 32 CLI), zero failures. The 22-case decrease matches exactly the seven deliberately retired test files.
- Root lint and type checking passed, including CLI checks. Root production build passed for the API bundle and Next.js application.
- All 316 tracked files in `apps/api/data` and `apps/web/public` were compared with the pre-cleanup commit and remain byte-for-byte identical. Non-test API source, numerical implementation, dependency manifests and locks have no changes.
- An alias-aware TypeScript import graph found all 66 remaining non-test web source modules reachable from the seven Next entry points. Repository-wide direct/dynamic reference checks and an independent consistency audit found no missed consumer of deleted code.
- New documentation links and diff checks passed. Historical exporter invocations are labeled as retired; their original implementation remains accessible in Git history.

- Production browser at widths 1440 and 390: the current single table retains six globally ordered models, and all 48 displayed macro-F1 cells match the retained aggregates. Hide-details, sticky model labels, horizontal scrolling and terminal navigation remain functional; document width stays within the viewport. No runtime errors were observed. Existing nonblocking Next.js CSS-preload timing warnings remain outside this cleanup.

19 obsolete files were deleted, including seven test files. No live model calls or dependency changes are part of this cleanup. The regenerated source ZIP is checked after the verified commit; private evidence, local credentials and build/dependency output remain excluded.
