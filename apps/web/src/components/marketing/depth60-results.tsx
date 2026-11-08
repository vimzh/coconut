// Display audited depth-60 studies while keeping repeated tasks and incomplete results explicit.
import results from "../../../../api/data/quality/depth60-landing-v1.json";

const models = results.models;

export function Depth60Results() {
  return (
    <section aria-labelledby="depth60-title" className="border-t border-border py-12 sm:py-16">
      <h2 id="depth60-title" className="text-2xl leading-tight sm:text-3xl">At depth 60</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
        {models.length} models tested on the same {results.caseCount} verified tasks. Each expression has {results.depth} nested operation levels.
      </p>
      <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card" role="region" tabIndex={0} aria-label="Depth-60 exploratory scores; scroll horizontally for all columns">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Unranked depth-60 exploratory results. Macro-F1 is shown on a 0–100 scale only for complete populations.</caption>
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-4 text-left font-normal">Model</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Correct / planned</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Wrong valid labels</th>
              <th scope="col" className="px-5 py-4 text-right font-normal" title="Invalid, refused or truncated replies">Unusable replies</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Macro-F1 / 100</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.modelId} className="border-b border-border last:border-0">
                <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-normal">
                  {model.modelId}
                  {model.populationStatus !== "complete" && (
                    <span className="mt-1 block whitespace-normal text-xs text-muted-foreground">
                      Incomplete · {model.included} / {model.planned} included · {model.infrastructure} provider/infrastructure failures · {model.unattempted} unattempted
                    </span>
                  )}
                </th>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.correct} / {model.planned}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.wrongValid}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.invalid + model.truncated + model.refused}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">
                  {model.populationStatus === "complete" && model.macroF1 !== null
                    ? (model.macroF1 * 100).toFixed(1)
                    : <span aria-label="No complete macro-F1 score">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {results.inferenceRequests} requests across {results.studies.length} {results.studies.length === 1 ? "batch" : "batches"} · Up to {results.maxConcurrency} in parallel · {results.trialsPerCase} fresh trials per task · {results.maxOutputTokens.toLocaleString("en-US")} output tokens maximum per request
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Exploratory, unranked results on the same nine functions; separate batches do not add independent tasks. Provider-default reasoning may differ by model. No matched shallower control was run, so these scores do not establish a depth threshold.
      </p>
    </section>
  );
}
