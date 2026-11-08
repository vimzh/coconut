// Hypothetical agent decisions show how a condition or exception changes the outcome.
import { Check, Code2, LockKeyhole, Plane, ReceiptText, X } from "lucide-react";
import styles from "./agent-scenarios.module.css";

function TravelScenario() {
  return (
    <article className={`${styles.card} ${styles.travel}`}>
      <h3><Plane size={18} aria-hidden="true" />Travel planner</h3>
      <p className={styles.request}>Find a cheaper flight to Delhi that arrives before 6 pm.</p>
      <div className={styles.diagram}>
        <div className={styles.firstCheck}>
          <p className={styles.measure}><span>Required connection</span><strong>90 min</strong></p>
          <div className={styles.track}><span className={styles.requiredBar} /></div>
        </div>
        <div className={styles.secondCheck}>
          <p className={styles.measure}><span>Proposed connection</span><strong>45 min</strong></p>
          <div className={styles.track}><span className={styles.shortBar} /></div>
        </div>
        <p className={`${styles.passed} ${styles.thirdCheck}`}><Check size={16} aria-hidden="true" />Arrives at 5 pm, before the deadline</p>
      </div>
      <div className={`${styles.outcome} ${styles.decision}`}>
        <X size={18} aria-hidden="true" />
        <div><h4>Reject this route</h4><p>The arrival works. The connection breaks the rule.</p></div>
      </div>
    </article>
  );
}

function SupportScenario() {
  return (
    <article className={`${styles.card} ${styles.support}`}>
      <h3><ReceiptText size={18} aria-hidden="true" />Customer support</h3>
      <p className={styles.request}>An opened item reportedly arrived damaged. The refund request comes on day 12.</p>
      <div className={styles.diagram}>
        <div className={styles.firstCheck}>
          <p className={styles.measure}><span>30-day request window</span><strong>Day 12</strong></p>
          <div className={styles.track}><span className={styles.dayBar} /></div>
        </div>
        <div className={`${styles.condition} ${styles.secondCheck}`}>
          <span className={styles.notMet}><X size={16} aria-hidden="true" />Unopened</span>
          <span className={styles.operator}>OR</span>
          <span className={styles.passed}><Check size={16} aria-hidden="true" />Arrived damaged</span>
        </div>
        <p className={`${styles.diagramNote} ${styles.thirdCheck}`}>Damage is the reported exception.</p>
      </div>
      <div className={`${styles.outcome} ${styles.decision}`}>
        <Check size={18} aria-hidden="true" />
        <div><h4>Check the damage exception</h4><p>Opening the box alone is not a reason to reject.</p></div>
      </div>
    </article>
  );
}

function CodingScenario() {
  return (
    <article className={`${styles.card} ${styles.coding}`}>
      <h3><Code2 size={18} aria-hidden="true" />Coding agent</h3>
      <p className={styles.request}>Let managers export invoices alongside admins. Both roles must belong to the invoice’s workspace.</p>
      <div className={`${styles.diagram} ${styles.permissionDiagram}`}>
        <div className={`${styles.workspace} ${styles.firstCheck}`}>
          <p><LockKeyhole size={16} aria-hidden="true" />Same workspace</p>
          <span className={styles.operator}>AND</span>
          <div className={`${styles.roles} ${styles.secondCheck}`}>
            <span>Admin</span><span className={styles.operator}>OR</span><span>Manager</span>
          </div>
        </div>
      </div>
      <div className={`${styles.outcome} ${styles.decision}`}>
        <LockKeyhole size={18} aria-hidden="true" />
        <div><h4>Keep the workspace check</h4><p>A separate “or manager” could let someone from another workspace export invoices.</p></div>
      </div>
    </article>
  );
}

export function AgentScenarios() {
  return <div className={styles.scenarios}><TravelScenario /><SupportScenario /><CodingScenario /></div>;
}
