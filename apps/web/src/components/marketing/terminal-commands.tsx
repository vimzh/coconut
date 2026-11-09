// Keep the checkout workflow visible beside results without expanding the evaluation form.
const setupCommands = `bun install --frozen-lockfile
bun run numerics:setup

mkdir -p apps/api/data/private
bun run tasks:generate \\
  --depths 5,10,20,40,80,160,320,512 \\
  --cases-per-depth 100 --seed 42 \\
  --output apps/api/data/private/tasks.json
bun run tasks:verify --input apps/api/data/private/tasks.json`;

const evaluationCommands = `mkdir -p apps/api/data/private
bun --env-file=apps/api/.env run eval:run \\
  --input apps/api/data/private/tasks.json \\
  --model gpt-6-luna \\
  --trials 1 --profile one-shot-json-v1 \\
  --concurrency 4 \\
  --credential-env OPENAI_API_KEY \\
  --output apps/api/data/private/luna-run \\
  --accept-charges`;

const commandGroups = [
  {
    title: "Other offline suites",
    description: "Reproduce a supported population into a new file, then replay its reference checks. These commands make no model requests.",
    commands: `bun run composition:generate --output /tmp/coconut-composition.json
bun run composition:verify --input /tmp/coconut-composition.json
bun run suite:generate --output /tmp/coconut-reference.json
bun run suite:verify --input /tmp/coconut-reference.json
bun run numerics:generate --output /tmp/coconut-smooth.json
bun run numerics:verify --input /tmp/coconut-smooth.json
bun run challenge:generate --output /tmp/coconut-challenge.json
bun run challenge:verify --input /tmp/coconut-challenge.json
bun run challenge:generate --population screening --output /tmp/coconut-screening.json
bun run challenge:verify --input /tmp/coconut-screening.json
bun run interior:generate --output /tmp/coconut-interior.json
bun run interior:verify --input /tmp/coconut-interior.json
bun run reserve:generate --output /tmp/coconut-reserve.json
bun run reserve:verify --input /tmp/coconut-reserve.json`,
  },
  {
    title: "Inspect reports and check model access",
    description: "The first command opens your local report. Search reads the anonymous model catalog; access and selection commands below check metadata without inference. Catalog presence does not establish inference access.",
    commands: `cat apps/api/data/private/luna-run/report.json
bun run model:search --query gpt-oss --limit 5
bun --env-file=apps/api/.env run provider:check --provider openai --credential-env OPENAI_API_KEY
bun --env-file=apps/api/.env run model:select --provider openai --model gpt-6-luna --profile one-shot-json-v1 --credential-env OPENAI_API_KEY`,
  },
  {
    title: "Offline scoring example",
    description: "This controlled fixture uses synthetic answers. It demonstrates scoring without generating measured model performance; eval:run already creates its own report.",
    commands: "bun run score:report --input apps/api/data/scoring/mixed-v1.input.json --output /tmp/coconut-scoring-report.json",
  },
  {
    title: "Development checks",
    description: "Run the local interface, inspect CLI help, or verify the checkout. Production start requires a successful build.",
    commands: `bun scripts/tasks.ts --help
bun run eval:run --help
bun scripts/composition-suite.ts --help
bun run dev

bun run test
bun run lint
bun run typecheck
bun run numerics:test
bun run numerics:lint
bun run numerics:benchmark --output /tmp/coconut-numerical-timing.json
bun run build
bun run start`,
  },
] as const;

export function TerminalCommands() {
  return (
    <section aria-labelledby="terminal-commands-title" className="min-w-0 border-t border-border py-12 sm:py-16">
      <div className="max-w-3xl">
        <h2 id="terminal-commands-title" className="text-2xl font-medium sm:text-3xl">Run it from your terminal</h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Generate tasks, verify their references and evaluate an OpenAI model from your local checkout. The terminal uses the same run engine and scorer as the workbench.</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Requires repository access, Bun 1.4.4, Node.js 24 LTS and uv. Run from the repository root. Configure COCONUT_GENERATOR_SOURCE and COCONUT_GENERATOR_PYTHON for the pinned external generator checkout and its isolated interpreter; docs/terminal.md lists setup. Generated questions remain private.</p>
      </div>
      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-base font-medium">1. Generate and verify</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose requested generator depths, questions per depth and a reproducible seed. This example requests 800 certified tasks, with near-balanced classes at each depth. Reference checks make no model calls. Incomplete certification fails visibly.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-6 sm:text-sm" tabIndex={0} aria-label="Setup and offline generation commands"><code>{setupCommands}</code></pre>
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-medium">2. Evaluate with your own key</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Set OPENAI_API_KEY in your ignored apps/api/.env file. Choose a model your account can use, a profile and the number of trials. This example evaluates the exact saved 800 tasks once each: up to 800 charged inference requests. Three trials would mean 2,400.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-6 sm:text-sm" tabIndex={0} aria-label="Paid model evaluation command"><code>{evaluationCommands}</code></pre>
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">Use a fresh output file and run directory. The exact-file workflow saves a private manifest, per-attempt evidence, run.json and report.json. Ctrl+C stops further work and preserves partial evidence; dispatched requests can still incur charges. Local artifacts need manual deletion. The research results above use separate frozen populations; nothing is published automatically.</p>
      <details className="mt-8 border-y border-border py-5">
        <summary className="cursor-pointer rounded-sm text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">More terminal commands</summary>
        <div className="mt-6 space-y-8">
          {commandGroups.map(({ title, description, commands }) => (
            <div key={title} className="min-w-0">
              <h3 className="text-base font-medium">{title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-6 sm:text-sm" tabIndex={0} aria-label={`${title} commands`}><code>{commands}</code></pre>
            </div>
          ))}
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">The full guide in docs/terminal.md covers options and charged compatibility probes. Private research operators require their frozen study inputs and review; they are separate from this quickstart.</p>
        </div>
      </details>
    </section>
  );
}
