# Terminal commands

Use Coconut from a local checkout to reproduce certified suites, verify their references, evaluate an OpenAI model and inspect a private report. Run every command below from the repository root. Commands that run models require your own credential and explicit charge consent.

The terminal evaluation command currently runs **composition-v1: 27 distinct tasks, three fresh responses per task, up to 81 inference requests per model**. It uses the workbench's existing execution engine and scorer. This is separate from the larger imported research population shown on the landing page. Reproducing a fixed suite does not generate fresh random questions or independent task groups.

## Setup

Install Bun **1.4.4**, Node.js **24 LTS** and [uv](https://docs.astral.sh/uv/getting-started/installation/). Numerical setup installs pinned Python 3.13 and the native reference-checking dependencies.

```sh
bun install --frozen-lockfile
bun run numerics:setup
```

Offline generation and verification need no provider key. To run a model, set `OPENAI_API_KEY` in your ignored `apps/api/.env` file, or supply that variable through your shell environment. Never put the credential itself in a command argument or tracked artifact. The examples explicitly load the ignored file with `bun --env-file=apps/api/.env`; omit that option when the variable is already in the environment.

No web or API server needs to be running for these CLI commands. Do not share an evaluation output database with a running API process.

## Generate and verify the current visitor suite

```sh
bun run composition:generate --output /tmp/coconut-composition.json
bun run composition:verify --input /tmp/coconut-composition.json
```

Generation reproduces the registered suite and verifies it before writing. Verification replays the artifact's admission checks. The suite contains all three labels at 2, 4 and 6 nonlinear stages, corresponding to expression-tree depths 7, 13 and 19. The 27 tasks form nine related groups; they are not 27 independent draws from arbitrary functions.

Use a new output filename: generation refuses to overwrite an existing artifact. `composition:generate` also accepts `--profile <profile-id>` to select an existing prompt profile. The default is `one-shot-json-v1`; the evaluation profile must match the intended suite wording/settings. These artifacts contain reference labels and certificates; the prompt builder excludes them from model-visible content.

```sh
bun scripts/composition-suite.ts --help
```

## Run an evaluation

The following command makes paid OpenAI requests. Replace the example model with an exact identifier available to your account. An advertised model or successful authentication does not establish inference permission.

```sh
mkdir -p apps/api/data/private
bun --env-file=apps/api/.env run eval:run \
  --suite composition-v1 \
  --model gpt-6-luna \
  --credential-env OPENAI_API_KEY \
  --output apps/api/data/private/luna-run \
  --accept-charges
```

The output directory must not exist, and its parent must already exist. No directory is reused and no artifact is overwritten. Argument, credential, workload and output checks happen before provider work. The CLI supports OpenAI only; the broader provider interfaces retain their separate verification limits.

| Argument | Behavior |
| --- | --- |
| `--suite composition-v1` | Run the registered 27-task suite. Arbitrary generated JSON is not accepted as evaluation input. |
| `--model <id>` | Use this exact requested OpenAI model; no substitution. |
| `--credential-env <name>` | Read this explicitly named environment variable. There is no implicit environment credential or inline-key argument. |
| `--output <new-directory>` | Reserve a new private directory with an existing writable parent. |
| `--accept-charges` | Required consent for inference charges, including dispatched work whose remote outcome becomes unknown. |
| `--profile <id>` | Optional existing profile; default `one-shot-json-v1`. |
| `--concurrency <1..12>` | Optional simultaneous inference limit; default 4. |

The existing engine makes three fresh requests per task, with one attempt per trial and no automatic retries. Default JSON and schema profiles cap output at 4,096 tokens per request; explicit reasoning profiles use 16,384 and require model setting support. The ordinary 180-second inference deadline, 20-second metadata deadline and 60-minute run deadline remain unchanged. Output caps and request counts are not a dollar budget.

```sh
bun run eval:run --help
```

The CLI prints progress counts and artifact locations, not model replies, credentials or the access code. It uses the official OpenAI SDK through the existing adapter. The selected credential is passed explicitly, is not saved in artifacts, and is not replaced by a server development key.

### Private artifacts and interrupted runs

| Artifact in the output directory | Contents |
| --- | --- |
| `receipt.json` | Run identity, request/settings, suite identity, call/output-token bounds and private access code. Written and flushed before inference dispatch. Keep it private. |
| `runs.sqlite` | The ordinary run store, including settled attempt evidence. Retained throughout execution. |
| `run.json` | Final private `RunView`: request, suite, prompts, raw outcomes, evidence and report. |
| `report.json` | The canonical scoring report; JSON `null` if no report could be finalized. |

The CLI creates its directory with mode `0700` and JSON files with mode `0600`; the existing store controls database permissions. Keep the whole directory private. Reports omit provider keys, but run artifacts contain questions and returned explanations. Nothing is automatically published or added to the landing page.

Press **Ctrl+C** to stop further trials and abort active calls. Normal SIGINT/SIGTERM handling waits for the engine to retain the resulting evidence and then exports it. Dispatched calls may still incur charges. Incomplete execution exits nonzero; failed, timed-out, cancelled, invalid and unattempted outcomes do not become completed correct answers. A forced process termination may leave only the start receipt and SQLite evidence. Preserve those files rather than rerun paid work to recover an export.

The underlying store applies seven-day expiry when accessed and lazily purges expired rows during store operations. This standalone CLI has no later background cleanup: **the SQLite database and JSON exports remain on disk until manually removed**. Delete the whole output directory when no longer needed. There is no CLI resume, retry, publication or public-server lookup for this separate database.

Inspect the report locally:

```sh
cat apps/api/data/private/luna-run/report.json
```

Malformed answers, refusals and token truncations count as unsuccessful model outcomes. Infrastructure errors and unattempted work remain separate and make scores provisional or unavailable. A truncated response is not by itself evidence of a mathematical error. The reference labels certify the task; a correct returned label does not certify the model's explanation.

## Other offline generation and verification commands

These commands do not make model requests. Each generator writes a new file and each verifier replays the corresponding artifact. Different populations have different identities and score denominators; do not pool them or treat their depths as one common measure.

| Command family | Default population |
| --- | --- |
| `suite:*` | 75-case algebraic reference suite. |
| `numerics:*` | 27-case smooth suite using rigorous native interval checks. |
| `challenge:*` | 72-case challenge, or a separate nine-case screening suite. |
| `interior:*` | 72-case interior-curvature exploration. |
| `reserve:*` | 18-case fine-scale curvature exploration. |
| `composition:*` | Recommended 27-case nested composition exploration. |

```sh
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
bun run reserve:verify --input /tmp/coconut-reserve.json
```

`suite:generate` and `numerics:generate` accept `--request <json-path>` for a request supported by their own versioned format. See the [instance generator plan](plans/03-instance-generator-and-suites.md) and [numerical engine plan](plans/numerical-certification-and-generation.md). This does not enable arbitrary operations, unlimited depths or automatic admission. Incomplete/unresolved generation fails rather than inventing a reference label.

Challenge, interior, reserve and composition generation accept `--profile <profile-id>` for an existing protocol profile. Use the matching verifier for each artifact family. The other registered suites remain available through **Advanced workloads** in the web workbench; `eval:run` currently accepts only `composition-v1`.

## Score retained evidence offline

```sh
bun run score:report \
  --input apps/api/data/scoring/mixed-v1.input.json \
  --output /tmp/coconut-scoring-report.json
```

This controlled fixture contains **synthetic** answers, token usage and costs; its report is not measured model performance. The scorer expects an envelope containing `{ suite, evidence }`. A raw `run.json` is a different format; `eval:run` already exports its canonical report, so no scoring conversion is necessary. The output path must be new.

## Model search, access checks and charged probes

Search reads the anonymous Hugging Face catalog without a credential or inference call:

```sh
bun run model:search --query gpt-oss --limit 5
```

Catalog-only results may lack supported inference hosting. Search is not a promise of model access.

The following credentialed operations read metadata and make **no inference request**:

```sh
bun --env-file=apps/api/.env run provider:check \
  --provider openai --credential-env OPENAI_API_KEY

bun --env-file=apps/api/.env run model:select \
  --provider openai --model gpt-6-luna \
  --profile one-shot-json-v1 --credential-env OPENAI_API_KEY
```

These optional checks **do make paid inference requests** and require explicit consent:

```sh
bun --env-file=apps/api/.env run provider:check \
  --provider openai --credential-env OPENAI_API_KEY \
  --model gpt-6-luna --accept-charges

bun --env-file=apps/api/.env run model:select \
  --provider openai --model gpt-6-luna \
  --profile one-shot-schema-v1 --credential-env OPENAI_API_KEY \
  --verify --accept-charges
```

The provider probe makes one request with a 128-output-token ceiling. The compatibility probe makes one request using the selected profile's ceiling. Neither retries or produces an evaluation score. Probe acceptance verifies a specific request/format, not future correctness. Optional `--output <new-path>` retains safe operation evidence. See the [provider handoff](handoffs/05-provider-access-and-credentials.md) and [model compatibility handoff](handoffs/06-model-discovery-and-compatibility.md) for exact contracts and unresolved non-OpenAI live-inference gates.

## Development and verification

```sh
bun run dev

bun run test
bun run lint
bun run typecheck
bun run test:cli
bun run lint:cli
bun run typecheck:cli
bun run numerics:test
bun run numerics:lint
bun run numerics:benchmark --output /tmp/coconut-numerical-timing.json

bun run build
bun run start
```

`dev` starts web/API on loopback ports 3200/3201. `start` requires a successful production build. Root tests, lint and type checks include the new terminal wrappers; the separate `*:cli` commands target them directly. The numerical benchmark is offline timing evidence, not a model evaluation or inference-speed measurement. See [development and operations](development.md) for origin configuration and deployment limits.

## Private research operators

The adaptive import pilot, deep study and cheap-model expansions have separate frozen populations, source/environment hashes, exposure checks, reviewed references and finite paid-call budgets. Their prepare/replay/freeze/run/report/export commands require the exact study inputs. They are not interchangeable with `composition:generate` or the visitor evaluation command, and replaying an old run command can create new charges.

Use the [import pilot handoff](handoffs/14b-randomized-certified-evaluation.md) and [deep-study handoff](handoffs/15-deep-composition-stress-evaluation.md) for those operator procedures and restrictions. Upstream implementation and private generated questions are not bundled into this quickstart; public redistribution rights remain unresolved. The public landing page retains only reviewed safe aggregates. The ordinary terminal workflow does not change that boundary.
