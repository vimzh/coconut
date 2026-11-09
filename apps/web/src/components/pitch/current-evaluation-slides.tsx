// Present runnable commands for configurable generation and exact-file evaluation.
import Link from "next/link";
import deck from "./pitch.module.css";
import styles from "./current-evaluation-slides.module.css";

const generation = `bun run tasks:generate \\
  --depths 5,10,20,40,80,160,320,512 \\
  --cases-per-depth 100 --seed 42 \\
  --output apps/api/data/private/tasks.json
bun run tasks:verify \\
  --input apps/api/data/private/tasks.json`;

const evaluation = `bun --env-file=apps/api/.env run eval:run \\
  --input apps/api/data/private/tasks.json \\
  --model gpt-6-luna --trials 1 \\
  --profile one-shot-json-v1 --concurrency 4 \\
  --credential-env OPENAI_API_KEY \\
  --output apps/api/data/private/pitch-run \\
  --accept-charges`;

export function TerminalWorkflowSlide() {
  return (
    <div className={styles.current}>
      <div className={deck.heading}><h2>Choose the tasks. Run the exact file.</h2></div>
      <p className={styles.lead}>Set depths, case counts and a seed. Select the model, trials, answer/reasoning profile and concurrency.</p>
      <div className={styles.groups}>
        <section className={styles.panel}>
          <h3>1. Generate and certify offline</h3>
          <p>Eight depths × 100 questions = 800 tasks, with near-balanced classes. Unverified or underfilled populations fail visibly.</p>
          <pre tabIndex={0} aria-label="Configurable generation and verification commands"><code>{generation}</code></pre>
        </section>
        <section className={styles.panel}>
          <h3>2. Evaluate the saved questions</h3>
          <p>800 tasks × one trial = up to 800 charged requests. Three trials would plan 2,400. No automatic retries or publication.</p>
          <pre tabIndex={0} aria-label="Exact-file OpenAI evaluation command"><code>{evaluation}</code></pre>
        </section>
      </div>
      <p className={styles.note}>From a configured checkout: install Bun/uv and run numerics:setup; set the pinned generator source/interpreter environment variables and create apps/api/data/private. Supply your own key in the ignored apps/api/.env file. Keep tasks.json with its .evidence directory. Private manifests, attempts and JSON reports retain partial work; local files need manual cleanup.</p>
      <div className={deck.closing}>
        <p>Requested depths 1–1000; up to 1000 tasks. Choose 1–10 trials and concurrency 1–12, with at most 10,000 requests. The selected profile controls output limits and reasoning effort.</p>
        <Link href="/#terminal-commands-title">Open the terminal quickstart ↗</Link>
      </div>
    </div>
  );
}
