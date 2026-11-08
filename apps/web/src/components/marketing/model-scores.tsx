"use client";

// Compare archived depth slices within one exact evaluation setting at a time.
import Image from "next/image";
import { useState } from "react";

import { directoryModels, modelCompanies } from "@/lib/model-directory-data";
import { getLandingScores, getLandingDepthScores, landingScoreColumns } from "@/lib/landing-scores";
import { getFastScreeningCell } from "@/lib/landing-fast-scores";
import { archivedPilotModelIds, getLandingPilotScore, landingPilotDepths } from "@/lib/landing-pilots";
import styles from "./model-scores.module.css";

const hiddenModelIds = new Set(["gpt-5.6-cyber", "gpt-6-cyber", "gpt-oss-120b", "gpt-oss-20b", "gpt-rosalind-research"]);

export function ModelScores() {
  const [columnIndex, setColumnIndex] = useState(0);
  const column = landingScoreColumns[columnIndex];
  const rows = directoryModels
    .filter((model) => model.openai && !hiddenModelIds.has(model.id) && (model.status !== "deprecated" || archivedPilotModelIds.has(model.id)))
    .map((model) => {
      const archivedDepths = getLandingDepthScores(model.id, columnIndex);
      const followUp = getFastScreeningCell(model.id, columnIndex);
      return { model, score: getLandingScores(model.id)[columnIndex] ?? followUp?.macroF1 ?? null,
        depths: archivedDepths.length ? archivedDepths : followUp?.byDepth ?? [] };
    })
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
          <caption className="sr-only">Per-depth scores from completed archived evaluations and audited follow-up trials for {column.group} {column.label}. Missing results remain unscored.</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.model}>Model</th>
              {column.depths.map((depth) => <th key={depth} scope="col">Depth {depth}</th>)}
              {landingPilotDepths.map((depth) => <th key={depth} scope="col" className={depth === 60 ? styles.pilotBoundary : undefined}>AST depth {depth}<span className={styles.pilotLabel}>Historical structural pilot</span></th>)}
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
                {landingPilotDepths.map((depth) => {
                  const score = getLandingPilotScore(model.id, depth);
                  return <td key={depth} className={depth === 60 ? styles.pilotBoundary : undefined} title={`Historical structural-depth-${depth} pilot; repetitive absolute-value families, 9 tasks, 3 trials each; not a measure of successive nonlinear composition`}>
                    {score === null ? <span aria-label="No complete pilot score for this model">—</span> : (score * 100).toFixed(1)}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id="model-depth-note" className={styles.notes}>
        {column.group} · {column.label} · {column.requests} requests per complete evaluation. Depth slices contain different tasks; score differences do not isolate a depth effect. Screening is exploratory and unranked; Standard includes the new same-task follow-up. AST depths 60, 100 and 216 are historical nine-task structural pilots using repetitive absolute-value families. Associative sums can be flattened; these columns do not measure successive nonlinear composition. Their default-reasoning results are preserved; the setting selector applies to the other columns.
      </p>
    </section>
  );
}
