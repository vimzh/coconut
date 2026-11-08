// A worked hypothetical policy shows how each nested exception changes Alex's laptop eligibility.
import styles from "./nested-policy-example.module.css";

const rules = [
  { condition: "All employees get a standard laptop.", result: "Standard", restricted: false },
  { condition: "Unless they are a contractor.", result: "Restricted", restricted: true },
  { condition: "Unless Security approved their special project.", result: "Standard", restricted: false },
  { condition: "Unless that project involves customer data.", result: "Restricted + monitoring", restricted: true },
  { condition: "Unless they completed advanced data-handling training in the last 6 months.", result: "Standard", restricted: false },
] as const;

export function NestedPolicyExample() {
  return (
    <article className={styles.example} aria-label="Hypothetical employee laptop access policy">
      <header className={styles.header}>
        <p>Illustrative policy · You are an HR agent</p>
        <h3>Employee laptop access</h3>
      </header>
      <ol className={styles.rules}>
        {rules.map(({ condition, result, restricted }) => (
          <li key={condition}>
            <span>{condition}</span>
            <strong data-restricted={restricted}>{result}</strong>
          </li>
        ))}
      </ol>
      <p className={styles.scope}>Each “unless” is an exception inside the branch above it.</p>
      <div className={styles.case}>
        <h4>Can Alex get a standard laptop?</h4>
        <p>Alex is a contractor on a Security-approved special project involving customer data. Alex completed the advanced training <strong>3 months ago.</strong></p>
      </div>
      <p className={styles.answer}><strong>Yes. Standard laptop.</strong> The recent-training exception overrides the customer-data restriction.</p>
      <p className={styles.boundary}>If the training were 7 months ago: restricted laptop with extra monitoring.</p>
    </article>
  );
}
