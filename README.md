<p align="center">
  <img src="apps/web/public/coconut.svg" width="104" alt="Coconut mascot: a smiling coconut with a straw">
</p>

<h1 align="center">Coconut</h1>

<p align="center">A convexity evaluation workbench for people comparing language models, with certified mathematical tasks and inspectable answers behind every score.</p>

<p align="center"><a href="docs/research/deep-study-results-v2.md">Reasoning study</a> · <a href="docs/research/cheap-depth-expand-v1.md">Fast-model results</a> · <a href="#run-locally">Run locally</a></p>

<!-- README-HACK:NEEDS-OWNER key="demo-video" instruction="Add the final public demo video link beside the results link above." -->
<!-- README-HACK:NEEDS-OWNER key="live-demo" instruction="Add a verified public deployment URL beside the results link above; the repository currently documents local operation only." -->

## The idea

`x³` is convex on `[0, 1]` and neither convex nor concave on `[-1, 1]`. The expression is identical; the interval changes the answer. Nested functions add more signs, domains, and dependencies to track.

A useful model comparison needs a trustworthy reference answer and enough evidence to explain a failure. Coconut gives evaluators a controlled task: classify a scalar function as **convex, concave, or neither on exactly the supplied interval**, then inspect the response against its certified reference. Affine and constant functions are excluded because they satisfy both curvature definitions.

## Why it matters

A model can return the right label with a flawed explanation, or fail because its output was truncated rather than because it reached a wrong mathematical conclusion. Coconut keeps these outcomes separate. Certified references, explicit domains, retained answers and visible denominators let evaluators investigate what a score actually measures.

## What Coconut does

The home page shows six models, ordered together by overall macro-F1, with each row identifying its study and question count: **620 tasks per model** for the Astra, GPT-5.4 Mini and GPT-6 Luna reasoning study, and **800 tasks per model** for the GPT-4.1 Mini, GPT-4o Mini and GPT-5.6 Luna fast screen. Each uses one response per task. Their populations and settings differ, so this ordering is descriptive rather than a controlled model ranking. Choose **View results** to inspect scores or **Open 27-task workbench** to run the separate visitor workload with your own key.

In the browser workbench:

1. **Choose the experiment.** The current 27-task suite is selected by default; six other suites sit under **Advanced workloads**. Connect with your own provider key, select an exact model, answer format, and supported reasoning settings. Review the request count and explicitly approve provider charges.
2. **Follow the run.** Each task gets three fresh requests. Watch progress, cancel further work, and retain the outcomes already recorded.
3. **Inspect the evidence.** Explore macro-F1, accuracy, correct/total counts, completion, expression-tree depth breakdowns, returned explanations, reference evidence, and execution diagnostics.
4. **Decide what to share.** Export private results or explicitly publish a completed run. The public comparison API groups comparable settings and ranks only eligible evidence.

Web runs are private by default, expire after seven days, and use a separate access code. Save that code to return after a refresh. Provider keys stay out of saved runs. Keep the page open during execution; interrupted work cannot resume, and dispatched requests can still incur charges.

The **terminal workflow** lets you choose generator depths, questions per depth and a seed, then verify and evaluate that exact saved task file. Select the OpenAI model, trial count, answer/reasoning profile and concurrency. Private manifests, per-attempt evidence and JSON reports retain incomplete work; these local files require manual cleanup and are not automatically published.

<!-- README-HACK:GRAPH
type: product-flow
brief: Show a browser evaluator selecting their provider/model and suite, reviewing the planned requests and approving charges, following three fresh trials per task, and inspecting private scores/answers/reference evidence. Branch from the private report to export or explicit publication and an eligibility-checked leaderboard. Mark the visitor-owned key and seven-day private-result boundary; keep service internals out of this diagram.
placement: after "What Coconut does"
-->

## Certify the task before grading the model

The visitor workbench's recommended **nested composition exploration** has **27 certified tasks in nine related groups**, with **2, 4 and 6 successive nonlinear stages** (expression-tree depths 7, 13 and 19). Every sequence/stage contains all three labels with the same outer expression form. Three fresh trials mean **81 requests per model**. Exact rational references and an independent Python implementation supplement whole-domain native certificates. This two-atom exploration remains unranked; [design and limits](docs/research/composition-design-v1.md) distinguish genuine composition from the preserved associative structural-depth pilots.

The preserved **curvature challenge** contains **72 tasks across eight families and 24 related parameter groups**. Every family includes all three labels. Three trials per task produce **216 planned inference requests**.

Independent analytic calculations and native interval arithmetic agree on the admitted labels. Global derivative bounds establish convex or concave behavior across the interval; verified opposite second-derivative signs at interior points establish neither. Unresolved candidates stay unverified. The model receives the expression, exact interval, and instructions; reference labels and certificates stay outside its prompt.

The [challenge design](docs/research/challenge-design-v1.md) records formulas, coverage, and reproducible artifacts. Its [independent reference review](docs/research/independent-challenge-review-v1.md) is explicitly AI-assisted. Expression depth also varies with family and size, so depth charts describe these tasks without isolating a causal effect of nesting.

## A score you can investigate

The primary score is **macro-F1 on a 0–100 scale**: calculate F1 separately for convex, concave and neither, then average the three equally. Accuracy is correct labels divided by retained model outcomes. The grader scores the returned label and retains the explanation for inspection. Malformed responses, refusals, and truncations count as unsuccessful model outcomes. Provider failures and unattempted work remain separate, leaving incomplete scores provisional or unavailable. An access probe produces no evaluation score.

The completed [fast-model screen](docs/research/cheap-depth-expand-v1.md) evaluates the same **800 certified functions per model**, with **100 at each requested depth 5, 10, 20, 40, 80, 160, 320 and 512** and one response per task:

| Requested model | Correct / outcomes | Accuracy | Macro-F1 / 100 | Wrong valid labels | Unusable replies |
| --- | ---: | ---: | ---: | ---: | ---: |
| `gpt-4.1-mini` | 320 / 800 | 40.00% | 39.59 | 464 | 16 |
| `gpt-4o-mini` | 282 / 800 | 35.25% | 30.27 | 468 | 50 |
| `gpt-5.6-luna` | 296 / 800 | 37.00% | 30.11 | 504 | 0 |

All **2,400 outcomes** were retained: 898 correct labels, 1,436 wrong valid labels and 66 invalid replies, with no infrastructure failures, unknown outcomes or retries. The continuation reused the original 240 answers and added 2,160 requests in **64.940 seconds**, reaching **120 concurrent calls**. It used an 8,192-output-token cap and 180-second deadline; GPT-5.6 Luna requested reasoning `none`, while the legacy models omitted that parameter. This research concurrency does not change the visitor CLI's 1–12 limit.

All outcomes mechanically replayed against the retained evidence. AI-assisted inspection covered 312 visible replies, including 119 correct-label explanations with 32 separate explanation findings. The other 2,088 explanations were not manually checked. Only final labels determine the reported scores.

The separate [reasoning study](docs/research/deep-study-results-v2.md) retained all **1,860 attempts** across **620 planned tasks per model**: Astra **611/613** correct model outcomes, GPT-5.4 Mini **214/616**, GPT-6 Luna **255/615**. Their macro-F1 scores are **99.76, 50.27 and 56.09 on a 0–100 scale**. Sixteen unknown infrastructure outcomes are excluded from these denominators and remain visible in coverage. Astra made one independently checked mathematical classification error at requested generator depth 40; its depth-512 loss was a token truncation. This study has 100 tasks per depth through 160, then ten each at 320 and 512, with different reasoning/output/deadline settings from the fast screen.

Both studies draw from the same certified 800-task source pool; the fast screen is not a fresh independent holdout. These exploratory results do not establish repeat consistency, a universal failure depth or a causal effect of depth. Their overall scores are not directly comparable across groups.

### What “depth 512” means

The eight research settings are **requested generator depths**, not guaranteed counts of meaningful reasoning steps. Realized source depth can be the requested value or one greater. Expression-tree depth and nonlinear-path length are measured separately; algebraic simplification can remove substantial structure.

For the original ten depth-512 questions in the reasoning study, the medians were **14,172 expression characters**, **503.5 raw nonlinear-path steps** and **337.5 after simplification**. These are subset statistics, not a description of every question in the full 100-case bucket. Long expressions alone do not establish mathematical difficulty, and scores need not decline monotonically with requested depth.

### Evaluation settings

| Setting | Reasoning study | Fast-model screen |
| --- | --- | --- |
| Models | Astra, GPT-5.4 Mini, GPT-6 Luna | GPT-4.1 Mini, GPT-4o Mini, GPT-5.6 Luna |
| Reasoning | Astra max; Mini xhigh; Luna max | GPT-5.6 Luna none; legacy models omit the parameter |
| Output-token ceiling | 32,768 per request | 8,192 per request |
| Request deadline | 600 seconds | 180 seconds |
| Questions per model | 620: 100/depth through 160, then 10 at 320 and 512 | 800: 100 at every depth |
| Responses per question | 1 | 1 |

These are the settings of the retained research runs. The ordinary browser workbench and configurable CLI have their own profiles and limits; the command below does not reproduce these research profiles.

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

The configurable CLI runs without either server. It imports candidates from a pinned external generator and independently verifies the exact displayed functions on [−1, 1]. Models receive the function, domain and instructions; reference labels and proofs are excluded. Its scorer uses the selected trial count and reports overall and requested-depth outcomes. Source depth, expression-tree depth and nonlinear-path length remain separate measurements.

<!-- README-HACK:GRAPH
type: architecture
brief: Show the Next.js browser workbench sending foreground requests to the Bun/Hono API; API model discovery/provider adapters call OpenAI, OpenRouter, or Hugging Face with explicit visitor credentials and stream progress back. Show offline TypeScript suite generation/reference checks communicating with the Python python-flint/Arb worker and writing frozen certified suites. Feed those suites to run execution, then the shared scorer and SQLite run/publication store, which serve private reports and eligible public comparisons. Add the separate configurable CLI path from private task JSON/reference replay to the same inference adapter and classifier, with selected trial counts and private manifest/attempt/report files instead of the web SQLite/publication store. Mark reference certificates as excluded from provider prompts and provider keys as excluded from stored records. Label non-OpenAI live inference unverified; do not repeat the user journey.
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

The [testing guide](docs/testing.md) maps the remaining checks to supported features. Obsolete landing-table and completed structural-pilot tests have been removed; current mathematical, scoring, credential, execution and CLI coverage remains.

### Generate, verify and evaluate from the terminal

After configuring the pinned generator checkout and its isolated interpreter as described in that guide, request **800 tasks** and evaluate each once:

```sh
mkdir -p apps/api/data/private
bun run tasks:generate \
  --depths 5,10,20,40,80,160,320,512 \
  --cases-per-depth 100 --seed 42 \
  --output apps/api/data/private/tasks.json
bun run tasks:verify --input apps/api/data/private/tasks.json

bun --env-file=apps/api/.env run eval:run \
  --input apps/api/data/private/tasks.json \
  --model gpt-6-luna --trials 1 \
  --profile one-shot-json-v1 --concurrency 4 \
  --credential-env OPENAI_API_KEY \
  --output apps/api/data/private/luna-generated-run \
  --accept-charges
```

Set your key in the ignored `apps/api/.env` file; evaluation incurs provider charges. Generation supports requested depths 1–1000 and at most 1000 tasks, with near-balanced class quotas and a finite proposal budget. Uncertified or underfilled populations fail visibly. Keep the generated JSON and its sibling `.evidence` directory together. Exact-file evaluations support 1–10 trials and at most 10,000 inference requests: 800 tasks × three trials would plan 2,400 calls. This example creates a new population, not a replay of the published research cohorts.

Inspect the resulting `apps/api/data/private/luna-generated-run/report.json` for overall and per-depth scores. Keep `run.json`, the attempt evidence and generated references private. Neither generation nor verification requires an API key; only the evaluation step sends charged model requests. No web or API server is required for these terminal commands.

The CLI checkpoint passed **32 tests / 1,142 assertions**, lint and type checking, plus real nine-task generation/replay at requested depths 5, 40 and 512. An 800-task fixture verifies configurable counts; a full new external 800-task generation was not run for that checkpoint. Its [handoff](docs/handoffs/configurable-terminal-workflow.md) records the independent review, web verification and limits.

A separate private deep-import workflow integrates a pinned external generator with exact-display reference checks. The [14b handoff](docs/handoffs/14b-randomized-certified-evaluation.md) records its inconclusive two-send Astra pilot. The [Module 15 handoff](docs/handoffs/15-deep-composition-stress-evaluation.md) records the independently reviewed 800-case source pool, the user-amended 620-task/model evaluation, immutable attempt ledgers, all-result audits and safe aggregate export. Raw-source/output redistribution clearance remains unresolved, so expressions and provider transcripts stay private.

## What's next

- Verify OpenRouter and Hugging Face inference with authorized service access.
- Validate hosted operation, including TLS and proxy logging, before offering a public deployment.
- Investigate broader task populations and repeated-error evidence. The observed single-response counterexample does not meet the stronger repeated-error criterion.
