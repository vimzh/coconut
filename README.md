<p align="center">
  <img src="apps/web/public/coconut.svg" width="104" alt="Coconut mascot: a smiling coconut with a straw">
</p>

<h1 align="center">Coconut</h1>

<p align="center">A convexity evaluation workbench for people comparing language models, with certified mathematical tasks and inspectable answers behind every score.</p>

<p align="center"><a href="docs/research/deep-study-results-v2.md">Explore the current results</a> · <a href="#run-locally">Run locally</a></p>

<!-- README-HACK:NEEDS-OWNER key="demo-video" instruction="Add the final public demo video link beside the results link above." -->
<!-- README-HACK:NEEDS-OWNER key="live-demo" instruction="Add a verified public deployment URL beside the results link above; the repository currently documents local operation only." -->

## The idea

`x³` is convex on `[0, 1]` and neither convex nor concave on `[-1, 1]`. The expression is identical; the interval changes the answer. Nested functions add more signs, domains, and dependencies to track.

A useful model comparison needs a trustworthy reference answer and enough evidence to explain a failure. Coconut gives evaluators a controlled task: classify a scalar function as **convex, concave, or neither on exactly the supplied interval**, then inspect the response against its certified reference. Affine and constant functions are excluded because they satisfy both curvature definitions.

## What Coconut does

The home page shows the latest audited research study: the same 620 functions attempted once on Astra, Mini and Luna. Choose **View results** to inspect scores or **Open 27-task workbench** to run the separate visitor workload with your own key. The private research study and visitor workload have different tasks and trial counts. Answer inspection is available in authorized run reports.

1. **Choose the experiment.** The current 27-task suite is selected by default; six other suites sit under **Advanced workloads**. Connect with your own provider key, select an exact model, answer format, and supported reasoning settings. Review the request count and explicitly approve provider charges.
2. **Follow the run.** Each task gets three fresh requests. Watch progress, cancel further work, and retain the outcomes already recorded.
3. **Inspect the evidence.** Explore macro-F1, accuracy, correct/total counts, completion, expression-tree depth breakdowns, returned explanations, reference evidence, and execution diagnostics.
4. **Decide what to share.** Export private results or explicitly publish a completed run. The leaderboard groups comparable settings and ranks only eligible evidence.

Runs are private by default, expire after seven days, and use a separate access code. Save that code to return after a refresh. Provider keys stay out of saved runs. Keep the page open during execution; interrupted work cannot resume, and dispatched requests can still incur charges.

<!-- README-HACK:GRAPH
type: product-flow
brief: Show an evaluator selecting their provider/model and suite, reviewing the planned requests and approving charges, following three fresh trials per task, and inspecting private scores/answers/reference evidence. Branch from the private report to export or explicit publication and an eligibility-checked leaderboard. Mark the visitor-owned key and seven-day private-result boundary; keep service internals out of this diagram.
placement: after "What Coconut does"
-->

## Certify the task before grading the model

The visitor workbench's recommended **nested composition exploration** has **27 certified tasks in nine related groups**, with **2, 4 and 6 successive nonlinear stages** (expression-tree depths 7, 13 and 19). Every sequence/stage contains all three labels with the same outer expression form. Three fresh trials mean **81 requests per model**. Exact rational references and an independent Python implementation supplement whole-domain native certificates. This two-atom exploration remains unranked; [design and limits](docs/research/composition-design-v1.md) distinguish genuine composition from the preserved associative structural-depth pilots.

The preserved **curvature challenge** contains **72 tasks across eight families and 24 related parameter groups**. Every family includes all three labels. Three trials per task produce **216 planned inference requests**.

Independent analytic calculations and native interval arithmetic agree on the admitted labels. Global derivative bounds establish convex or concave behavior across the interval; verified opposite second-derivative signs at interior points establish neither. Unresolved candidates stay unverified. The model receives the expression, exact interval, and instructions; reference labels and certificates stay outside its prompt.

The [challenge design](docs/research/challenge-design-v1.md) records formulas, coverage, and reproducible artifacts. Its [independent reference review](docs/research/independent-challenge-review-v1.md) is explicitly AI-assisted. Expression depth also varies with family and size, so depth charts describe these tasks without isolating a causal effect of nesting.

## A score you can investigate

The grader scores the returned label and retains the explanation for inspection. Malformed responses, refusals, and truncations count as unsuccessful model outcomes. Provider failures and unattempted work remain separate, leaving incomplete scores provisional or unavailable. An access probe produces no evaluation score.

The latest [single-response deep study](docs/research/deep-study-results-v2.md) retained all **1,860 attempts**: Astra **611/613** correct model outcomes, Mini **214/616**, Luna **255/615**. Their macro-F1 scores are **99.76, 50.27 and 56.09 on a 0–100 scale**. Sixteen unknown infrastructure outcomes are excluded from these denominators and remain visible in coverage. Astra made one independently checked mathematical classification error at requested generator depth 40; its depth-512 loss was a token truncation. These exploratory results are unranked and do not establish repeat consistency or a universal failure depth.

The retained OpenAI replication includes these four completed confirmation runs:

| Requested model | Reasoning effort | Correct / planned responses | Macro-F1 |
| --- | --- | ---: | ---: |
| `gpt-6-astra` | high | 216 / 216 | 1.00 |
| `gpt-6-astra` | max | 216 / 216 | 1.00 |
| `gpt-6.1-sol` | high | 216 / 216 | 1.00 |
| `gpt-6.1-sol` | max | 216 / 216 | 1.00 |

These runs establish perfect observed classification on this fixed challenge. They do not establish general mathematical ability or a frontier-model limitation. The wider replication ended interrupted; its failed and unstarted cells remain in the [terminal audit](docs/research/openai-replication-review-v2.md). Exploratory screening contains reviewed wrong labels and formatting failures, with their diagnoses kept distinct. Repeated trials do not create additional independent mathematical tasks.

Separate interior and fine-scale explorations are already implemented. Their [research records](docs/ROADMAP.md#implementation-progress) preserve different populations and budgets; they remain unranked and are not pooled into the confirmation results above.

## How it works

The **Next.js workbench** sends foreground operations to a **Hono API running on Bun**. The API resolves the selected model, loads a verified suite, and dispatches bounded requests through provider adapters. The shared scorer turns retained outcomes into reports; **SQLite** stores private run evidence and explicit publication state.

The mathematical path combines exact rational checks in TypeScript with a **Python worker using python-flint/Arb interval arithmetic**. Frozen suites retain expressions and certificates for offline replay. Reference evidence is separated from model-visible prompts.

OpenAI requests use the official SDK with explicit visitor credentials and automatic retries disabled. OpenAI has live execution evidence. OpenRouter and Hugging Face Inference Providers are implemented and fixture-tested; their live inference remains unverified.

<!-- README-HACK:GRAPH
type: architecture
brief: Show the Next.js browser workbench sending foreground requests to the Bun/Hono API; API model discovery/provider adapters call OpenAI, OpenRouter, or Hugging Face with explicit visitor credentials and stream progress back. Show offline TypeScript suite generation/reference checks communicating with the Python python-flint/Arb worker and writing frozen certified suites. Feed those suites to run execution, then the shared scorer and SQLite run/publication store, which serve private reports and eligible public comparisons. Mark reference certificates as excluded from provider prompts and provider keys as excluded from stored records. Label non-OpenAI live inference unverified; do not repeat the user journey.
placement: after "How it works"
-->

**Built with:** TypeScript, Bun, Hono, Next.js, React, Tailwind CSS, Radix UI, Recharts, SQLite, the official OpenAI SDK, Python, and python-flint/Arb.

## Run locally

Install **Bun 1.4.4**, **Node.js 24 LTS**, and **uv**. From the repository root:

```sh
bun install --frozen-lockfile
bun run numerics:setup
bun run dev
```

Open [localhost:3200](http://localhost:3200); the API runs on loopback port 3201. Numerical setup installs pinned Python 3.13 and its dependencies. Use one API process for the local run store. Live evaluations require your own provider key and incur provider charges.

Verify the frozen challenge without making model calls:

```sh
bun run challenge:verify --input apps/api/data/suites/challenge-v1.json
```

The [terminal guide](docs/terminal.md) covers configurable generation by depth, case count and seed, verification, and OpenAI evaluation of the exact saved tasks with selected trial/profile settings. It also retains the bundled composition commands. The landing page includes a terminal quickstart. See the [development guide](docs/development.md) for production operation and origin configuration.

A separate private deep-import workflow integrates a pinned external generator with exact-display reference checks. The [14b handoff](docs/handoffs/14b-randomized-certified-evaluation.md) records its inconclusive two-send Astra pilot. The [Module 15 handoff](docs/handoffs/15-deep-composition-stress-evaluation.md) records the independently reviewed 800-case source pool, the user-amended 620-task/model evaluation, immutable attempt ledgers, all-result audits and safe aggregate export. Raw-source/output redistribution clearance remains unresolved, so expressions and provider transcripts stay private.

## What's next

- Verify OpenRouter and Hugging Face inference with authorized service access.
- Validate hosted operation, including TLS and proxy logging, before offering a public deployment.
- Investigate broader task populations and repeated-error evidence. The observed single-response counterexample does not meet the stronger repeated-error criterion.
