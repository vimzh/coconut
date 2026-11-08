// Compact archived scores keep each test setting separate and leave missing results unscored.
import Image from "next/image";

import { directoryModels, modelCompanies } from "@/lib/model-directory-data";
import { getLandingScores, getLandingRunCount, landingScoreColumns } from "@/lib/landing-scores";
import styles from "./model-scores.module.css";

const rows = directoryModels
  .filter((model) => model.status !== "deprecated")
  .map((model) => ({ model, scores: getLandingScores(model.id) }))
  .sort((a, b) => (b.scores[0] ?? -1) - (a.scores[0] ?? -1) || a.model.name.localeCompare(b.model.name));

function ScoreRow({ row }: { row: (typeof rows)[number] }) {
  const company = modelCompanies[row.model.company];
  return (
    <tr>
      <th scope="row" className={styles.model}>
        <span className={styles.identity}>
          <span className={styles.logo} title={company.name}>
            <Image src={company.logo} alt="" width={14} height={14} unoptimized />
          </span>
          <span>{row.model.name}</span>
        </span>
      </th>
      <td>{getLandingRunCount(row.model.id)}</td>
      {row.scores.map((score, index) => (
        <td key={landingScoreColumns[index].key} title={score === null ? "No completed result for this setting" : `${landingScoreColumns[index].group} ${landingScoreColumns[index].label}: ${score} macro-F1`}>
          {score === null ? <span aria-label="No completed result for this setting">—</span> : (score * 100).toFixed(1)}
        </td>
      ))}
    </tr>
  );
}

export function ModelScores() {
  return (
    <section aria-labelledby="model-scores-title" className={styles.section}>
      <h2 id="model-scores-title">Model scores</h2>
      <p className={styles.metric}>Macro-F1 · 0–100 · Sorted by Standard screening score</p>

      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Model scores; scroll horizontally for all test settings">
        <table className={styles.table}>
          <caption className="sr-only">Scores from completed archived evaluations. Each model has one row, with three screening settings and two confirmation settings.</caption>
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className={styles.model}>Model</th>
              <th rowSpan={2} scope="col">Runs</th>
              <th colSpan={3} scope="colgroup">Screening</th>
              <th colSpan={2} scope="colgroup">Confirmation</th>
            </tr>
            <tr>
              {landingScoreColumns.map((column) => <th key={column.key} scope="col" title={column.profileId}>{column.requests} requests · {column.label}</th>)}
            </tr>
          </thead>
          <tbody>{rows.map((row) => <ScoreRow key={row.model.id} row={row} />)}</tbody>
        </table>
      </div>

    </section>
  );
}
