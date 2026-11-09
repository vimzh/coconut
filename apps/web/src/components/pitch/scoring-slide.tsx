// Explains the implemented scorer with a clearly synthetic, independently checked example.
import deck from "./pitch.module.css";
import styles from "./scoring-slide.module.css";

const exampleClasses = [
  { label: "Convex", tp: 2, fp: 2, fn: 1, f1: "4/7" },
  { label: "Concave", tp: 2, fp: 0, fn: 1, f1: "4/5" },
  { label: "Neither", tp: 2, fp: 0, fn: 1, f1: "4/5" },
] as const;

export function ScoringSlide() {
  return (
    <div className={styles.scoring}>
      <div className={`${deck.heading} ${styles.heading}`}><h2>How we evaluate and score.</h2></div>
      <p className={styles.workload}>Reasoning study: <strong>620 planned tasks per model.</strong> Fast screen: <strong>800 tasks per model.</strong> Both use one response per task. Visitor workbench: 27 × 3 = 81 requests. Exact-file CLI: tasks × 1–10 selected trials.</p>
      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Evaluation procedure">
          <h3>1. Evaluate every answer</h3>
          <ol className={styles.procedure}>
            <li><strong>Fix the comparison.</strong> Use the same suite, prompt, answer format, reasoning effort, and output ceiling. Keep reference answers out of prompts.</li>
            <li><strong>Start each trial fresh.</strong> One inference attempt per trial, no automatic retry, and no majority vote across repeated answers.</li>
            <li><strong>Grade the final label.</strong> Check the declared JSON and compare its label with the certified reference. Retain the explanation for inspection; it is ungraded.</li>
          </ol>
        </section>
        <section className={`${styles.panel} ${styles.formulas}`} aria-label="Scoring formulas">
          <h3>2. Calculate pooled macro-F1</h3>
          <p>Pool all included task × trial outcomes. Calculate F1 separately for each of the three classes:</p>
          <p className={styles.formula}>F1 = 2TP / (2TP + FP + FN)</p>
          <dl className={styles.definitions}>
            <div><dt>TP</dt><dd>Correct predictions of this class.</dd></div>
            <div><dt>FP</dt><dd>Other classes wrongly assigned this label.</dd></div>
            <div><dt>FN</dt><dd>This class missed, including unusable replies.</dd></div>
          </dl>
          <p className={styles.formula}>(F1<sub>convex</sub> + F1<sub>concave</sub> + F1<sub>neither</sub>) / 3</p>
          <p>Each class has equal weight. The headline is calculated from pooled counts and displayed on a 0–100 scale.</p>
        </section>
        <section className={styles.panel} aria-label="Synthetic scoring example">
          <h3>3. Follow a worked example</h3>
          <p className={styles.exampleNote}>Synthetic scoring example: 9 returned outcomes, including 1 unusable reply.</p>
          <table className={styles.example}>
            <caption className="sr-only">Per-class counts from the synthetic scoring fixture</caption>
            <thead><tr><th scope="col">Class</th><th scope="col">TP</th><th scope="col">FP</th><th scope="col">FN</th><th scope="col">F1</th></tr></thead>
            <tbody>{exampleClasses.map(({ label, tp, fp, fn, f1 }) => <tr key={label}><th scope="row">{label}</th><td>{tp}</td><td>{fp}</td><td>{fn}</td><td>{f1}</td></tr>)}</tbody>
          </table>
          <p className={styles.calculation}>(4/7 + 4/5 + 4/5) / 3<br /><strong>Macro-F1 = 76/105 ≈ 0.724</strong><br />Displayed score ≈ 72.4 / 100</p>
          <p className={styles.accuracy}>Accuracy = 6 correct / 9 included ≈ 66.7%</p>
        </section>
      </div>
      <div className={styles.outcomes}>
        <section><h3>Invalid JSON, refusal, or truncation</h3><p>Included as a false negative for the reference class, with no predicted class. These replies stay in the accuracy denominator.</p></section>
        <section><h3>Provider failure, cancellation, or unattempted work</h3><p>Excluded from mathematical counts and reported separately. Incomplete runs are provisional, or unavailable if no model outcomes exist; they are unranked.</p></section>
      </div>
      <p className={styles.note}>Also report per-class recall and requested-depth slices. Repeated trials add descriptive score spread and answer agreement. Single-trial studies report the observed task outcomes.</p>
    </div>
  );
}
