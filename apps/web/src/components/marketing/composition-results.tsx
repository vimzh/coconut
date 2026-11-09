// Publish the latest audited study while retaining the earlier result artifact separately.
import results from "../../../public/composition-scores.json";
import audit from "../../../../api/data/quality/composition-results-audit-v1.json";
import { deepStudySummary, deepStudyTaskCounts, deepStudyTaskTotal, hasPublishedDeepStudy, type DeepStudyScore } from "@/lib/deep-study-summary";
import { directoryModels } from "@/lib/model-directory-data";
import styles from "./model-scores.module.css";

if (audit.verdict !== "pass" || results.auditVerdict !== "pass" || results.suiteId !== audit.suiteId ||
    JSON.stringify(results.models) !== JSON.stringify(audit.models) || results.tasks !== 27 || results.clusters !== 9)
  throw new Error("Composition results require matching complete audited evidence.");

export function CompositionResults() {
  return hasPublishedDeepStudy ? <DeepStudyResults /> : <CompositionStudyResults />;
}

function ScoreCell({ score }: { score: DeepStudyScore }) {
  const settled = score.modelOutcomes + score.providerFailures;
  const state = score.status === "complete" ? "Complete" : score.status === "provisional" ? "Provisional" : score.status === "planned" ? "Pending" : "Score unavailable";
  return (
    <td>
      <details className={styles.cellDetails}>
        <summary>
          <span className={styles.scoreValue}><span className="sr-only">Macro-F1: </span>{score.macroF1 === null ? "Unavailable" : (score.macroF1 * 100).toFixed(1)}</span>
          <span className={styles.scoreLine}>Accuracy {score.accuracy === null ? "unavailable" : `${(score.accuracy * 100).toFixed(1)}%`}</span>
          <span className={styles.scoreLine}>{score.modelOutcomes === 0 ? "No model outcomes" : `${score.correct}/${score.modelOutcomes} correct`}</span>
          <span className={styles.scoreLine}>{settled}/{score.planned} settled</span>
          <span className={styles.scoreLine}>{state}</span>
        </summary>
        <dl className={styles.outcomes}>
          <div><dt>Model outcomes</dt><dd>{score.modelOutcomes}/{score.planned}</dd></div>
          <div><dt>Correct labels</dt><dd>{score.correct}</dd></div>
          <div><dt>Wrong valid labels</dt><dd>{score.wrongValid}</dd></div>
          <div><dt>Unusable replies</dt><dd>{score.unusable}</dd></div>
          <div><dt>Provider failures</dt><dd>{score.providerFailures}</dd></div>
          <div><dt>Unknown remote outcomes</dt><dd>{score.unknownRemote}</dd></div>
          <div><dt>In flight</dt><dd>{score.inFlight}</dd></div>
          <div><dt>Unattempted</dt><dd>{score.unattempted}</dd></div>
          <div><dt>Dispatched</dt><dd>{score.dispatched}/{score.planned}</dd></div>
        </dl>
      </details>
    </td>
  );
}

function DeepStudyResults() {
  const study = deepStudySummary;
  const taskCounts = deepStudyTaskCounts(study), total = deepStudyTaskTotal(study);
  const state = study.state === "complete" ? "Audited study" : study.state === "running" ? "Audited partial snapshot" : study.state === "unavailable" ? "Scores unavailable" : "Audited incomplete study";
  return (
    <section id="model-scores-title" aria-labelledby="deep-study-title" className={`${styles.section} ${styles.deepStudy}`}>
      <div className={styles.heading}>
        <h2 id="deep-study-title">Deep function results</h2>
        <label className={styles.detailsToggle}>
          <input type="checkbox" className={styles.hideDetails} />
          Hide details
        </label>
      </div>
      <p className={styles.metric}>{state} · {total} planned tasks per model · One response per task · Exploratory, unranked</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Deep study scores by requested generator depth">
        <table className={styles.table} aria-describedby="deep-study-note">
          <caption className="sr-only">Macro-F1 on a 0–100 scale, accuracy, correct model outcomes and settled coverage. Depth columns use requested generator settings.</caption>
          <thead><tr>
            <th scope="col" className={styles.model}>Model</th>
            {taskCounts.map(({ requestedDepth, tasks }) => <th scope="col" key={requestedDepth}>Requested depth {requestedDepth}<span className={styles.pilotLabel}>{tasks} tasks</span></th>)}
          </tr></thead>
          <tbody>{study.models.map(model => <tr key={model.modelId}>
            <th scope="row" className={styles.model}>{directoryModels.find(row => row.id === model.modelId)?.name ?? model.modelId}</th>
            {model.byDepth.map(slice => <ScoreCell key={slice.requestedDepth} score={slice.score} />)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.sources}>
        <h3 className="mt-5 font-medium">How the score is computed</h3>
        <p>Each depth column reports macro-F1: compute F1 separately for convex, concave and neither, then give all three classes equal weight.</p>
        <p className="mt-2 font-mono">F1(class) = 2 × TP / (2 × TP + FP + FN)</p>
        <p className="mt-2 font-mono">Score = 100 × (F1(convex) + F1(concave) + F1(neither)) / 3</p>
        <p className="mt-2">TP counts correct predictions of a class; FP counts predictions of that class when the reference is different; FN counts reference cases of that class without a correct prediction. A zero denominator gives F1 = 0. Unusable replies count as FN for their reference class.</p>
        <p className="mt-2">Accuracy = 100 × correct labels / retained model outcomes. Provider failures and missing replies are excluded from this denominator and keep scores provisional or unavailable.</p>
      </div>
      <p id="deep-study-note" className={styles.notes}>
        Macro-F1 is the primary score, on a 0–100 scale over three fixed classes. Accuracy and correct counts use retained model outcomes, including unusable replies as failures. Settled coverage includes provider failures; expand a cell for model-outcome coverage and all outcome counts. Missing replies and provider failures make scores provisional or unavailable.
      </p>
      <details className={`${styles.sources} ${styles.details}`}>
        <summary>Study identity, depth definitions and model settings</summary>
        <p>Study: <code>{study.studyId}</code>. Frozen cohort: <code>{study.cohortId}</code>. Source: <code>{study.cohortSourceId}</code>. Each model receives the same admitted tasks, with one attempt per task. Tasks by requested depth: {taskCounts.map(row => `${row.requestedDepth}: ${row.tasks}`).join("; ")}. Remaining semantic equivalence is unknown after exact and bounded simplification checks. Individual answers and reference evidence remain in authorized research reports.</p>
        <p>Depth is the requested generator setting. Realized source depth may be that setting or its successor; neither measure is expression-tree depth or a count of nonlinear composition stages. One response per question does not measure repeat consistency. Input size and mathematical structure can change with depth, so these scores do not isolate a causal depth effect or establish a failure threshold.</p>
        {study.models.map(model => <div key={model.modelId}>
          <p>{directoryModels.find(row => row.id === model.modelId)?.name ?? model.modelId}: profile {model.settings.profileId}; reasoning {model.settings.reasoning ?? "unspecified"}; {model.settings.maxOutputTokens.toLocaleString("en-US")} maximum output tokens; {model.settings.inferenceTimeoutMs / 1000}-second deadline. Reported identities: {model.reportedModelIds.length ? model.reportedModelIds.join(", ") : "none retained"}.</p>
          <p>Realized source depth by requested setting: {model.byDepth.map(slice => `${slice.requestedDepth}: ${slice.realizedDepths.map(item => `${item.count} at ${item.depth}`).join(", ")}`).join("; ")}.</p>
        </div>)}
        <p>Audited report SHA-256: <code>{study.reportSha256}</code>. Cohort SHA-256: <code>{study.cohortSha256}</code>. Independent reference review SHA-256: <code>{study.audit.referenceReviewSha256}</code>.</p>
      </details>
    </section>
  );
}

function CompositionStudyResults() {
  return (
    <section id="model-scores-title" aria-labelledby="composition-results-title" className={styles.section}>
      <div className={styles.heading}><h2 id="composition-results-title">Nested composition results</h2></div>
      <p className={styles.metric}>Audited score summary · Same 27 tasks per model · Exploratory, unranked</p>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label="Matched nonlinear composition results">
        <table className={styles.table} aria-describedby="composition-results-note">
          <caption className="sr-only">Macro-F1 on a 0–100 scale, accuracy and response counts on successive nonlinear compositions, with three responses per task</caption>
          <thead><tr><th scope="col" className={styles.model}>Model</th><th scope="col">Macro-F1</th><th scope="col">Accuracy</th>{[2, 4, 6].map(stages => <th scope="col" key={stages}>{stages} nonlinear stages</th>)}<th scope="col">Correct / responses</th><th scope="col">Wrong labels</th><th scope="col">Unusable</th></tr></thead>
          <tbody>{results.models.map(model => <tr key={model.modelId}>
            <th scope="row" className={styles.model}>{directoryModels.find(row => row.id === model.modelId)?.name ?? model.modelId}</th>
            <td>{(model.macroF1 * 100).toFixed(1)}</td>
            <td>{(model.correct / model.planned * 100).toFixed(1)}%</td>
            {model.byStage.map(slice => <td key={slice.stages} title={`Macro-F1; ${slice.correct}/${slice.planned} correct responses; 9 tasks × 3 responses; expression-tree depth ${slice.astDepth}`}>{(slice.macroF1 * 100).toFixed(1)}</td>)}
            <td>{model.correct} / {model.planned}</td>
            <td>{model.outcomes.answer - model.correct}</td><td title="Includes output-limit truncation; counted as unsuccessful replies">{model.planned - model.outcomes.answer}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p id="composition-results-note" className={styles.notes}>
        Macro-F1, including the stage columns, uses a 0–100 scale. All 81 model outcomes were recorded per model; there were no service failures. Unusable responses count as unsuccessful outcomes. Individual answers and reference evidence are available in authorized run reports; this summary has no public transcripts.
      </p>
      <details className={`${styles.sources} ${styles.details}`}>
        <summary>Study settings and limits</summary>
        <p>Each stage applies a nonlinear function to the previous result. Two, four and six stages have expression-tree depths 7, 13 and 19. The 27 certified tasks form nine related groups using two shared atoms and three sequence patterns. Every pattern and stage count includes all three labels with the same outer expression form. Repeated responses are not independent functions.</p>
        <p>Default reasoning, 4,096 output tokens and three fresh responses per task. Luna returned five wrong labels and 11 output-limit truncations; Mini returned 51 wrong labels and no unusable responses. Only final labels are scored; explanations are not certified. Truncation does not establish a mathematical error.</p>
        <p>Nesting changes function shape, range and length. These results do not isolate a causal depth effect or establish general mathematical reliability.</p>
      </details>
    </section>
  );
}
