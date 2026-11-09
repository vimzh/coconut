# Terminal workflow

## Scope and implementation

The user requested runnable generation and evaluation commands, with examples on the landing page. The existing package scripts already cover offline reference, smooth, challenge, interior and fine-scale suites, scoring fixtures, model discovery and provider checks. The missing pieces are an ordinary composition-suite command and a visitor-owned terminal evaluation command.

1. Add `scripts/composition-suite.ts` with strict `generate` and `verify` operations over the existing composition generator and validator. Reproduce the registered 27-task population rather than claim fresh random generation. Reject overwrites. Verify with actual offline generation/replay and invalid-input tests.
2. Add `scripts/evaluate.ts` over `createRunService`, `createRunStore` and the registered suite loader. Support `composition-v1`, an explicit OpenAI model and credential environment variable, a fresh private output directory, profile, concurrency and explicit charge consent. Preserve the existing 81-trial, no-retry engine policy, official SDK, scoring and cancellation. Verify with injected inference, complete/partial runs, secret isolation, consent and output-conflict tests; do not send live model calls for this change.
3. Register root package aliases and maintained CLI checks. Document setup, every ordinary command family, private artifacts, partial outcomes and charged probes in `docs/terminal.md`. Correct the stale recommendation in `docs/development.md` and link the guide from the README. Validate the documented offline commands and help against their actual entry points.
4. Add a restrained landing-page terminal section and anchor using existing typography and components. Show setup, composition generation/verification and a consented evaluation command. Keep current result tables, historical JSON and workload distinctions intact. Verify web lint, types, tests, production build and desktop/mobile behavior.

## Interfaces and failure handling

`composition:generate --output <new-json>` and `composition:verify --input <json>` use native verification and support an explicit existing prompt profile. Generation writes a new artifact only.

`eval:run --suite composition-v1 --model <id> --credential-env <name> --output <new-directory> --accept-charges` reads only the explicitly named credential. Optional profile and concurrency retain the engine's existing bounds. There is no inline-key argument, default environment credential, automatic retry, resume or publication. Validate all arguments and reserve output before provider work. Persist the private start receipt before inference, retain SQLite attempt evidence, and export the final run and canonical report. Return nonzero for incomplete execution. Do not expose raw replies, access codes or credentials on the terminal.

The CLI is a local checkout workflow, not a published package or a way to regenerate the separate imported research cohort. Document the 27 distinct tasks, three responses each and provider charges explicitly. Metadata checks do not establish inference access; fixture reports do not constitute measured results. Standalone exports require manual removal and are distinct from store retention.

## Ownership and concurrent work

The terminal worker owns only the two scripts and their tests. The root agent owns package aliases/check configuration, documentation and landing integration. No new dependencies are required. Another session owns the cheap-depth research expansion. Its frozen hash covers API source, API package/lock and selected numerical files: leave those unchanged and do not build or restart the API while its paid batch runs. Root scripts, root package scripts, web and these documents are outside that hash. Preserve all concurrent files and stage only this checkpoint's explicit paths.

## Verification and handoff

Run the new CLI tests, lint and TypeScript checks; run real offline composition generation and verification in a temporary directory; exercise help and pre-dispatch rejection without credentials. Run web tests, lint, types and build. Inspect the resulting landing section at desktop and mobile widths, including horizontal command scrolling and current-result preservation. Record actual outcomes and limitations in `docs/handoffs/terminal-workflow.md`; inspect staged content and secret/artifact exclusions before committing.
