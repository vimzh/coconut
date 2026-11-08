// These public teaching examples are separate from the retained evaluation populations.
const examples = [
  { expression: "x²", label: "Convex", reason: "Its second derivative is 2, positive throughout the interval." },
  { expression: "−x²", label: "Concave", reason: "Its second derivative is −2, negative throughout the interval." },
  { expression: "x³", label: "Neither", reason: "Its second derivative, 6x, is negative to the left of zero and positive to the right." },
] as const;

export function CurvatureExamples() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <p className="text-sm font-medium">Illustrative examples</p>
        <p className="font-mono text-sm text-muted-foreground">x ∈ [−1, 1]</p>
      </div>
      <dl className="divide-y divide-border">
        {examples.map(({ expression, label, reason }) => (
          <div key={label} className="grid gap-3 px-5 py-5 sm:grid-cols-[96px_112px_minmax(0,1fr)] sm:items-baseline sm:px-6">
            <dt className="font-mono text-2xl">{expression}</dt>
            <dd className="font-medium">{label}</dd>
            <dd className="text-sm leading-6 text-muted-foreground">{reason}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
        These examples explain the labels. They are separate from the tasks used to score models.
      </p>
    </div>
  );
}
