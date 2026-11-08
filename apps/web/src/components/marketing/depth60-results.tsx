// Display the separately audited pilot without mixing its population into the main comparisons.
import results from "../../../../api/data/quality/depth60-results-audit-v1.json";

const models = [...results.models].sort((a, b) => b.macroF1 - a.macroF1);
const estimatedCost = models.reduce((total, model) => total + model.estimatedUsdIgnoringCacheDiscounts, 0);

export function Depth60Results() {
  return (
    <section aria-labelledby="depth60-title" className="border-t border-border py-12 sm:py-16">
      <h2 id="depth60-title" className="text-2xl leading-tight sm:text-3xl">At depth 60</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
        Two small models tested on nine verified tasks, with three fresh trials per task. Each expression has 60 nested operation levels.
      </p>
      <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card" role="region" tabIndex={0} aria-label="Depth-60 pilot scores; scroll horizontally for all columns">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Depth-60 exploratory results, sorted by macro-F1 from highest to lowest. Macro-F1 is shown on a 0–100 scale.</caption>
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-4 text-left font-normal">Model</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Correct / planned</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Wrong labels</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Invalid replies</th>
              <th scope="col" className="px-5 py-4 text-right font-normal">Macro-F1 / 100</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.modelId} className="border-b border-border last:border-0">
                <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-normal">{model.modelId}</th>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.correct} / {model.planned}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.wrongValid}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{model.invalid}</td>
                <td className="px-5 py-4 text-right font-mono tabular-nums">{(model.macroF1 * 100).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {results.inferenceRequests} requests · Up to {results.concurrency} in parallel · {results.trialSpanSeconds.toFixed(1)} seconds · ${estimatedCost.toFixed(3)} estimated token cost before cache discounts
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        Exploratory results from two older small models. No matched shallower control was run, so these scores do not establish a failure threshold.
      </p>
    </section>
  );
}
