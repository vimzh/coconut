// A complete policy case and hypothetical agent domains illustrate nested overrides.
import { NestedPolicyExample } from "@/components/marketing/nested-policy-example";
import styles from "./agent-scenarios.module.css";

const agentDomains = [
  { title: "Insurance claims agent", detail: "Covered claim → exclusion → endorsement waives the exclusion → location exception blocks the waiver." },
  { title: "HR policy agent", detail: "Parental leave, remote work, or vesting rule → contractor restriction → full-time conversion exception." },
  { title: "Access-control agent", detail: "Allow access → block external users → approved-vendor exception → customer-data restriction → extra-training exception." },
  { title: "Compliance agent", detail: "Requirement → exemption → jurisdiction-specific exception that restores the requirement." },
  { title: "Loan underwriting agent", detail: "Income requirement → co-signer exception → special-program override → recent-bankruptcy restriction." },
] as const;

export function AgentScenarios() {
  return (
    <div className={styles.scenarios}>
      <NestedPolicyExample />
      <aside className={styles.domains}>
        <h3>The same question for an agent</h3>
        <p>Can it keep a long chain of “if,” “unless,” and overrides intact and reach the right final answer?</p>
        <ul>
          {agentDomains.map(({ title, detail }) => (
            <li key={title}><h4>{title}</h4><p>{detail}</p></li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
