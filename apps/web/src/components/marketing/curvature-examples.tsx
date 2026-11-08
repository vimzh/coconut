// These public teaching examples are separate from the retained evaluation populations.
import { FunctionGraph } from "@/components/marketing/function-graph";

const examples = [
  {
    kind: "convex", expression: "x²", label: "Convex",
    definition: "A convex function is a real-valued function whose graph curves upward like a cup (∪).",
    condition: "f(z) ≤ t f(x) + (1 − t)f(y)",
    reason: "For x², f″(x) = 2 > 0 throughout D, so it is convex.",
  },
  {
    kind: "concave", expression: "−x²", label: "Concave",
    definition: "A concave function is a real-valued function whose graph curves downward like an upside-down cup (∩).",
    condition: "f(z) ≥ t f(x) + (1 − t)f(y)",
    reason: "For −x², f″(x) = −2 < 0 throughout D, so it is concave.",
  },
  {
    kind: "neither", expression: "x³", label: "Neither",
    definition: "Both definitions fail on D: the graph is above its left chord and below its right chord.",
    condition: null,
    reason: "For x³, f″(x) = 6x is negative on (−1, 0) and positive on (0, 1), so it is neither on D.",
  },
] as const;

export function CurvatureExamples() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <p className="text-sm font-medium">Illustrative examples</p>
        <p className="font-mono text-sm text-muted-foreground">D = [−1, 1]</p>
      </div>
      <p className="border-b border-border px-5 py-4 text-sm leading-6 text-muted-foreground sm:px-6">
        For every x, y ∈ D and t ∈ [0, 1], set z = tx + (1 − t)y. The chord height at z is t f(x) + (1 − t)f(y).
      </p>
      <div className="divide-y divide-border">
        {examples.map(({ kind, expression, label, definition, condition, reason }) => (
          <div key={label} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)] sm:items-center sm:gap-6 sm:px-6">
            <div>
              <h3 className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-medium">
                <span>{label}</span><span className="font-mono text-xl">f(x) = {expression}</span>
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{definition}</p>
              {condition && <p className="mt-2 font-mono text-sm leading-6">{condition}</p>}
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{reason}</p>
            </div>
            <FunctionGraph kind={kind} className="mx-auto max-w-[320px]" />
          </div>
        ))}
      </div>
      <p className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
        Cup shapes describe the bend. A convex function can keep increasing or decreasing throughout the interval; it does not need a turning point. Solid lines show functions; dashed lines show selected chords. The derivative checks establish the labels on the whole interval. These examples are separate from the tasks used to score models.
      </p>
    </div>
  );
}
