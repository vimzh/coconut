// Illustrative curves explain the three labels; these are not sampled evaluation results.
import { useState } from "react";
import styles from "./evaluation-workspace.module.css";

const examples = [
  { label: "Convex", expression: "f(x) = x²", description: "The curve bends upward across the domain.", path: "M 20 20 Q 110 128 200 20" },
  { label: "Concave", expression: "f(x) = −x²", description: "The curve bends downward across the domain.", path: "M 20 128 Q 110 20 200 128" },
  { label: "Neither", expression: "f(x) = x³", description: "The curvature changes within the domain.", path: "M 20 128 C 80 20 140 128 200 20" },
];

export function CurvatureGuide() {
  const [index, setIndex] = useState(0);
  const example = examples[index];
  return (
    <div className={styles.guide}>
      <div className={styles.guideCopy}>
        <span className={styles.kicker}>The task</span>
        <h3>One function. Three possible answers.</h3>
        <p>Can your model classify curvature over the entire stated domain?</p>
        <div className={styles.curveChoices} role="group" aria-label="Explore curvature labels">
          {examples.map((entry, i) => (
            <button key={entry.label} type="button" aria-pressed={index === i} onClick={() => setIndex(i)}>{entry.label}</button>
          ))}
        </div>
      </div>
      <figure className={styles.curveFigure}>
        <svg viewBox="0 0 220 148" role="img" aria-label={`${example.expression} on [−1, 1], an illustrative ${example.label.toLowerCase()} function`}>
          {[38, 74, 110].map((y) => <path key={y} d={`M 12 ${y} H 208`} className={styles.curveGrid} />)}
          {[38, 74, 110, 146, 182].map((x) => <path key={x} d={`M ${x} 12 V 136`} className={styles.curveGrid} />)}
          <path d="M 12 74 H 208 M 110 12 V 136" className={styles.curveAxis} />
          <path d={example.path} className={styles.curveLine} />
        </svg>
        <figcaption><span>{example.expression}</span><span>Illustration · x ∈ [−1, 1]</span></figcaption>
      </figure>
      <p className="sr-only" aria-live="polite">{example.description}</p>
    </div>
  );
}
