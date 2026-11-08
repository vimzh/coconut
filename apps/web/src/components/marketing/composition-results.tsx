// The matched composition study stays separate from historical structural-depth pilots.
import results from "../../../public/composition-scores.json";
import audit from "../../../../api/data/quality/composition-results-audit-v1.json";
import { directoryModels } from "@/lib/model-directory-data";
import styles from "./model-scores.module.css";

if (audit.verdict !== "pass" || results.auditVerdict !== "pass" || results.suiteId !== audit.suiteId ||
    JSON.stringify(results.models) !== JSON.stringify(audit.models) || results.tasks !== 27 || results.clusters !== 9)
  throw new Error("Composition results require matching complete audited evidence.");

export function CompositionResults() {
  return (
    <section aria-labelledby="composition-results-title" className={styles.section}>
      <div className={styles.heading}><h2 id="composition-results-title">Nested composition</h2></div>
      <p className={styles.metric}>Macro-F1 · 0–100 · Same 27 tasks per model · Exploratory, unranked</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Matched nonlinear composition results">
        <table className={styles.table} aria-describedby="composition-results-note">
          <caption className="sr-only">Scores on successive nonlinear compositions, with three trials per task</caption>
          <thead><tr><th scope="col" className={styles.model}>Model</th><th scope="col">Overall</th>{[2, 4, 6].map(stages => <th scope="col" key={stages}>{stages} nonlinear stages</th>)}<th scope="col">Correct / replies</th><th scope="col">Wrong labels</th><th scope="col">Unusable</th></tr></thead>
          <tbody>{results.models.map(model => <tr key={model.modelId}>
            <th scope="row" className={styles.model}>{directoryModels.find(row => row.id === model.modelId)?.name ?? model.modelId}</th>
            <td>{(model.macroF1 * 100).toFixed(1)}</td>
            {model.byStage.map(slice => <td key={slice.stages} title={`${slice.correct}/${slice.planned} correct replies; 9 tasks × 3 trials; AST depth ${slice.astDepth}`}>{(slice.macroF1 * 100).toFixed(1)}</td>)}
            <td>{model.correct} / {model.planned}</td>
            <td>{model.outcomes.answer - model.correct}</td><td title="Includes output-limit truncation; counted as unsuccessful replies">{model.planned - model.outcomes.answer}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p id="composition-results-note" className={styles.notes}>
        Each stage applies a nonlinear function to the previous result. Two, four and six stages have AST depths 7, 13 and 19.
        The 27 certified tasks form nine related groups using two shared atoms and three sequence patterns; repeated replies are not independent functions.
        Every pattern and stage count includes all three labels with the same outer expression form. Final labels are scored; explanations are not certified.
        Luna returned five wrong labels and 11 output-limit truncations; Mini returned 51 wrong labels and no unusable replies. Truncation does not establish a mathematical error. Default reasoning, 4,096 output tokens and three fresh trials per task. Nesting changes function shape, range and length; these results do not isolate a causal depth effect or establish general mathematical reliability.
      </p>
    </section>
  );
}
