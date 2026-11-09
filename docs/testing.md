# Current verification commands

From the repository root, install dependencies and the native runtime, then check the supported application:

```sh
bun install --frozen-lockfile
bun run numerics:setup
bun run test
bun run lint
bun run typecheck
bun run numerics:test
bun run numerics:lint
bun run build
```

These checks use fixtures and local mathematical verification. They do not require provider credentials or make paid model calls. Live inference and research operators have separate explicit consent and frozen budgets; do not run them merely to test the checkout.

## What the remaining tests protect

| Area | Location | Why it remains |
| --- | --- | --- |
| Reference mathematics and supported generators | `apps/api/src/math`, `suites`, `numerics`, `composition`, `challenge`, `interior`, `reserve`; `services/numerics` | All seven visitor workloads remain supported. Age does not make their verifier/domain/certificate regressions obsolete. |
| Prompts, extraction and scoring | `apps/api/src/protocol`, `scoring`, `quality` | Wrong labels, invalid replies, partial evidence and denominators must stay correct. |
| Provider access and execution | `apps/api/src/providers`, `discovery`, `inference`, `runs` | Protect credentials, fixed destinations, SDK isolation, charge consent, cancellation, retention and publication. |
| Current imported-task and research foundations | `apps/api/src/randomized`, `deep-study` | Independent reference admission, exposure, immutable task identities and reviewed research execution. |
| Current web projections and clients | `apps/web/src/lib` | Preserve current study aggregates, supported suite previews, private reports and browser/server contracts. |
| Ordinary terminal workflow | `scripts/evaluate.test.ts`, `composition-suite.test.ts`, `tasks/` | Configurable counts/depths/seeds, exact saved-file evaluation, trial budgets and private outcomes. `bun run test:cli` targets these. |

Remaining experiment tests protect retained execution/audit infrastructure. Some are themselves hash-bound in historical verification records. The separate current-study operator tests under `scripts/` have their exact commands in their research plans; they are not additional live evaluations.

## Retired coverage

The pre-submission cleanup removed three old landing-table projection test files and four completed structural-pilot test files (depths 60, 100, 216 and the 256/512 pair). Their unused presentation chains were also removed. This is not a removal of current-depth or mathematical-verifier coverage.

Historical public JSON, independent audits, frozen operator/reference source and private evidence remain retained. Earlier handoffs describe the verification performed at those earlier commits; they are not current test inventories. See the [cleanup handoff](handoffs/pre-submission-cleanup.md) for the precise removed paths and final checks.
