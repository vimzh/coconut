// Present current audited populations and the configurable workflow without pooling different study settings.
import Link from "next/link";
import { cheapDepthSummary } from "@/lib/cheap-depth-summary";
import { deepStudySummary, deepStudyTaskTotal, type DeepStudySummary } from "@/lib/deep-study-summary";
import deck from "./pitch.module.css";
import styles from "./current-evaluation-slides.module.css";

function StudyTable({ study, title, description }: { study: DeepStudySummary; title: string; description: string }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <h3>{title} · {deepStudyTaskTotal(study)} tasks/model</h3>
      <p>{description}</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label={`${title} overall results`}>
        <table className={styles.table}>
          <caption className="sr-only">Macro-F1 on a 0–100 scale, accuracy and correct model outcomes</caption>
          <thead><tr><th scope="col">Model</th><th scope="col">F1 / 100</th><th scope="col">Accuracy</th><th scope="col">Correct / outcomes</th></tr></thead>
          <tbody>{study.models.map(model => <tr key={model.modelId}>
            <th scope="row">{model.modelId}</th>
            <td>{model.overall.macroF1 === null ? "—" : (model.overall.macroF1 * 100).toFixed(2)}</td>
            <td>{model.overall.accuracy === null ? "—" : `${(model.overall.accuracy * 100).toFixed(2)}%`}</td>
            <td>{model.overall.correct}/{model.overall.modelOutcomes}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function CurrentResultsSlide() {
  const wrong = cheapDepthSummary.models.reduce((sum, model) => sum + model.overall.wrongValid, 0);
  const unusable = cheapDepthSummary.models.reduce((sum, model) => sum + model.overall.unusable, 0);
  const unknown = deepStudySummary.models.reduce((sum, model) => sum + model.overall.unknownRemote, 0);
  return (
    <div className={styles.current}>
      <div className={deck.heading}><h2>What the measured results show.</h2></div>
      <p className={styles.lead}>One response per task at requested generator depths 5, 10, 20, 40, 80, 160, 320 and 512.</p>
      <div className={styles.groups}>
        <StudyTable study={deepStudySummary} title="Reasoning study" description="100 tasks per depth through 160; ten each at 320 and 512. 32,768 output tokens, 600-second deadline. Astra/Luna max reasoning; Mini xhigh." />
        <StudyTable study={cheapDepthSummary} title="Fast screen" description="100 tasks at every depth. 8,192 output tokens, 180-second deadline. GPT-5.6 Luna reasoning none; legacy models omit the parameter." />
      </div>
      <div className={styles.findings}>
        <p><strong>A completed mathematical error.</strong> Astra misclassified one strictly convex function at requested depth 40. Its depth-512 truncation is a separate outcome.</p>
        <p><strong>Retain the denominator.</strong> Reasoning scores are provisional: {unknown} unknown infrastructure outcomes are excluded. The complete fast screen retains {wrong.toLocaleString("en-US")} wrong valid labels and {unusable} unusable replies.</p>
      </div>
      <p className={styles.note}>Both groups reuse one certified source pool with different selected populations/settings. Compare within each group. These exploratory results do not prove a causal depth effect, a universal failure threshold or repeat consistency. Only final labels are scored; explanations are not certified.</p>
      <Link href="/#model-scores-title" className={styles.link}>Inspect depth scores, settings and outcome counts ↗</Link>
    </div>
  );
}

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
