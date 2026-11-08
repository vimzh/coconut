# Frontend incremental verification v3

## Scope and source boundary

This verification covers only the concurrent landing-page replacement from the former model directory to `ModelScores`. It used tracked `28c50bcd07c9fb477b98c864cfb6188bccef28d6` plus the exact frontend WIP overlay recorded in the structured companion. The 12-entry manifest (eight path/SHA-256 entries and four deletions) hashes to `947970469b5831289d5e4c736b1946e93d17e16ba178e9164f5591d7527e2aad`.

The owner changed `model-scores.tsx` and its stylesheet once during an earlier check. That evidence was superseded. The final overlay was stable for ten seconds before capture and exactly matched the root paths after the final command set. This is evidence for those hashes, not for future WIP edits.

After the final command set, the separately observed untracked `ModelScores` source first changed to SHA-256 `ef2e41208d9a12d9b2eb9a582144968939c988f2b01015b3723299ceab17147f`; it added the “Screening is exploratory and unranked.” qualifier. It was later revised again to SHA-256 `06dd72933e7384c073b6eb24784b470eef7f30850da657fb8291f3fc4bb6a555`, whose observed note is: “Screening is exploratory and unranked. Runs counts archived published evaluations across all settings. — means no completed run for that setting.” The later clause removal was reported to follow an external semantic audit; neither qualifier edit was executed in this QA pass.

Concurrent owner work also changed `apps/web/package.json`, `bun.lock`, page source/CSS, app shell, and added a landing-background component. Those later dependency/source changes are outside the tested manifest and deliberately unverified; no attempt was made to chase a moving worktree.

At final evidence validation, tracked HEAD had advanced to `34150fb5e45f8d4491e186412914237f4dc7fcf8`. That revision is not a replacement verification target for this report.

The isolated snapshot omitted local instructions, `.env` files, private data, root dependencies, virtual environments, and root Next output. Commands used an empty environment except the explicit Bun 1.4.4 PATH, `TMPDIR=/tmp`, and `CI=1`. Dependencies were copied only from the prior fresh frozen isolated install after all package manifests and `bun.lock` matched; no install, lockfile mutation, credential, API process, provider call, or paid request occurred.

## Behavior coverage

| Behavior | Evidence | Status |
| --- | --- | --- |
| Replacement component compiles with the landing page and old directory source/tests are absent | Hash-bound overlay and production build | Verified automatically |
| Five fixed score settings over the 45-model lineup preserve exact archived selection/identity | 67 passing web tests, including four `landing-scores` evidence assertions | Verified automatically |
| Web lint, route types, TypeScript, and production routes work for the final overlay | Final Bun 1.4.4 command set | Verified automatically |
| Rendered table layout, horizontal keyboard scroll, download response, and responsive appearance | No browser/server exercise in this scope | Unverified |

## Executed checks

All final commands ran in `/tmp/coconut-frontend-v3-current.PzVjLg` with Bun 1.4.4 (38afee6c8).

| Command | Result |
| --- | --- |
| `bun run --filter @coconut/web test` | Exit 0; 67 passed, 0 failed, six files, 1.239s |
| `bun run --filter @coconut/web lint` | Exit 0 |
| `bun run --filter @coconut/web typecheck` | Exit 0; Next route type generation completed |
| `bun run --filter @coconut/web build` | Exit 0; Next 16.4.5 compiled, typechecked, and generated seven routes |

Two preliminary outcomes are not product failures and do not support the verdict: a dependency symlink that escaped its temporary snapshot produced lint exit 127 and Turbopack build exit 1; copied isolated dependencies fixed that layout. A subsequent intermediate command resolved Bun 1.4.3, so the final explicit Bun 1.4.4 run replaced it.

## Gaps and residual risk

No browser, production server, responsive visual, keyboard-scroll, or download HTTP observation was performed for the changed landing page. The two later ModelScores qualifier edits and broader dependency/source WIP were not passed through a fresh command set. API/native checks were intentionally not repeated because this was a frontend-only incremental scope; this report makes no fresh claim for them. Provider credentials, inference, billing, private data, and shared/root service behavior were not accessed.

## Workspace effects

QA did not edit product source or owner files. The only root files created are this report and its structured companion. Temporary snapshots and final command logs remain under `/tmp/coconut-frontend-v3-*` for inspection.

Verdict: VERIFIED WITH GAPS
