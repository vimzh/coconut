// A native curve and chord illustrate convexity without presenting a measured model result.
export function CurvatureIllustration() {
  return (
    <figure className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">Illustrative function</span>
        <span className="font-mono text-lg">f(x) = x²</span>
      </div>

      <svg viewBox="0 0 560 420" role="img" aria-labelledby="curvature-plot-title curvature-plot-description" className="mt-4 block w-full">
        <title id="curvature-plot-title">A convex curve on the closed interval from minus one to one</title>
        <desc id="curvature-plot-description">The graph of x squared sits below a dashed chord joining two points on the curve. This diagram illustrates the chord condition; the second derivative, two, establishes convexity over the whole interval.</desc>
        <g fill="none" stroke="var(--border)" strokeWidth="1">
          <path d="M56 84H504M56 204H504" />
          <path d="M56 324H520M280 52V348" strokeWidth="1.5" />
        </g>
        <path d="M100.8 170.4H459.2Q280 477.6 100.8 170.4Z" fill="var(--accent)" opacity="0.07" />
        <path d="M100.8 170.4H459.2" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="8 8" />
        <path d="M56 84Q280 564 504 84" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <g fill="var(--card)" stroke="var(--accent)" strokeWidth="2">
          <circle cx="100.8" cy="170.4" r="5" />
          <circle cx="459.2" cy="170.4" r="5" />
        </g>
        <g fill="var(--accent)">
          <circle cx="56" cy="84" r="4" />
          <circle cx="504" cy="84" r="4" />
        </g>
        <g className="fill-muted-foreground font-mono text-xl">
          <text x="56" y="360" textAnchor="middle">−1</text>
          <text x="280" y="360" textAnchor="middle">0</text>
          <text x="504" y="360" textAnchor="middle">1</text>
          <text x="256" y="92" textAnchor="end">1</text>
          <text x="528" y="332">x</text>
        </g>
        <text x="108" y="148" className="fill-muted-foreground text-xl">Chord</text>
        <text x="400" y="300" className="fill-accent text-xl">Curve</text>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="font-medium text-accent">Convex throughout the interval</span>
        <span className="font-mono text-muted-foreground">x ∈ [−1, 1]</span>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        Illustration only, separate from evaluated suites. For x², every chord lies on or above the curve.
      </figcaption>
    </figure>
  );
}
