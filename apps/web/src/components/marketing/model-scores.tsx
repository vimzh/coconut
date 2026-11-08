"use client";

// Compare archived depth slices within one exact evaluation setting at a time.
import Image from "next/image";
import { useState } from "react";

import { directoryModels, modelCompanies } from "@/lib/model-directory-data";
import { getLandingScores, getLandingDepthScores, landingScoreColumns } from "@/lib/landing-scores";
import styles from "./model-scores.module.css";

export function ModelScores() {
  const [columnIndex, setColumnIndex] = useState(0);
  const column = landingScoreColumns[columnIndex];
  const rows = directoryModels
    .filter((model) => model.status !== "deprecated")
    .map((model) => ({ model, score: getLandingScores(model.id)[columnIndex], depths: getLandingDepthScores(model.id, columnIndex) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.model.name.localeCompare(b.model.name));
  return (
    <section aria-labelledby="model-scores-title" className={styles.section}>
      <div className={styles.heading}>
        <h2 id="model-scores-title">Model scores</h2>
        <label className={styles.setting}>
          Evaluation setting
          <select value={columnIndex} onChange={(event) => setColumnIndex(Number(event.target.value))}>
            {landingScoreColumns.map((setting, index) => <option key={setting.key} value={index}>{setting.group} · {setting.label}</option>)}
          </select>
        </label>
      </div>
      <p className={styles.metric}>Macro-F1 · 0–100 · Sorted by overall score for this setting</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Model scores by depth; scroll horizontally for all depths">
        <table className={styles.table} aria-describedby="model-depth-note">
          <caption className="sr-only">Per-depth scores from completed archived evaluations for {column.group} {column.label}. Missing results remain unscored.</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.model}>Model</th>
              {column.depths.map((depth) => <th key={depth} scope="col">Depth {depth}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ model, depths }) => (
              <tr key={model.id}>
                <th scope="row" className={styles.model}>
                  <span className={styles.identity}>
                    <span className={styles.logo} title={modelCompanies[model.company].name}>
                      <Image src={modelCompanies[model.company].logo} alt="" width={14} height={14} unoptimized />
                    </span>
                    <span>{model.name}</span>
                  </span>
                </th>
                {column.depths.map((depth) => {
                  const slice = depths.find((entry) => entry.depth === depth);
                  const score = slice?.macroF1;
                  return <td key={depth} title={slice ? `${slice.includedTrials}/${slice.plannedTrials} included trials at depth ${depth}` : "No completed result for this setting"}>
                    {score === null || score === undefined ? <span aria-label="No completed score at this depth">—</span> : (score * 100).toFixed(1)}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id="model-depth-note" className={styles.notes}>
        {column.group} · {column.label} · {column.requests} requests per complete evaluation. Depth slices contain different tasks; score differences do not isolate a depth effect. Screening is exploratory and unranked.
      </p>
    </section>
  );
}
