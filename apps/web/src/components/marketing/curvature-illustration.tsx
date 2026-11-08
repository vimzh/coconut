// A native curve and chord illustrate convexity without presenting a measured model result.
import { AnimatedGraph } from "./animated-graph";

function plotPoint(x: number) {
  return { x: 280 + 224 * x, y: 324 - 180 * Math.log1p(Math.exp(x * x)) };
}

function curvePath(min: number, max: number) {
  return Array.from({ length: 81 }, (_, index) => {
    const point = plotPoint(min + (max - min) * index / 80);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

const left = plotPoint(-0.8);
const right = plotPoint(0.8);
const chord = `M${left.x} ${left.y}H${right.x}`;
const gap = `${curvePath(-0.8, 0.8)}L${left.x} ${left.y}Z`;

export function CurvatureIllustration() {
  return (
    <figure className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">Illustrative function</span>
        <span className="font-mono text-sm sm:text-base">f(x) = log(1 + exp(x²))</span>
      </div>

      <AnimatedGraph curve={curvePath(-1, 1)} viewBox="0 0 560 420" role="img" aria-labelledby="curvature-plot-title curvature-plot-description" className="mt-4 block w-full text-accent">
        <title id="curvature-plot-title">A convex curve on the closed interval from minus one to one</title>
        <desc id="curvature-plot-description">The natural logarithm of one plus the exponential of x squared sits below a dashed chord joining x equals minus 0.8 and 0.8. Its second derivative is positive throughout the interval. The drawing illustrates the chord condition; one pictured chord alone is not a global proof.</desc>
        <g fill="none" stroke="var(--border)" strokeWidth="1">
          <path d="M56 54H504M56 144H504M56 234H504" />
          <path d="M56 324H520M280 52V348" strokeWidth="1.5" />
        </g>
        <g data-graph="area"><path d={gap} fill="var(--accent)" opacity="0.07" /></g>
        <path data-graph="chord" d={chord} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="8 8" />
        <path data-graph="curve" pathLength="1" d={curvePath(-1, 1)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <g fill="var(--card)" stroke="var(--accent)" strokeWidth="2">
          <circle data-graph="point" cx={left.x} cy={left.y} r="5" />
          <circle data-graph="point" cx={right.x} cy={right.y} r="5" />
        </g>
        <g fill="var(--accent)">
          <circle data-graph="point" cx="56" cy={plotPoint(-1).y} r="4" />
          <circle data-graph="point" cx="504" cy={plotPoint(1).y} r="4" />
        </g>
        <g className="fill-muted-foreground font-mono text-xl">
          <text x="56" y="360" textAnchor="middle">−1</text>
          <text x="280" y="360" textAnchor="middle">0</text>
          <text x="504" y="360" textAnchor="middle">1</text>
          <text x="256" y="60" textAnchor="end">1.5</text>
          <text x="256" y="150" textAnchor="end">1</text>
          <text x="256" y="240" textAnchor="end">0.5</text>
          <text x="528" y="332">x</text>
        </g>
        <text data-graph="annotation" x="108" y={left.y - 18} className="fill-muted-foreground text-xl">Chord</text>
        <text data-graph="annotation" x="400" y="210" className="fill-accent text-xl">Curve</text>
      </AnimatedGraph>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="font-medium text-accent">Convex throughout the interval</span>
        <span className="font-mono text-muted-foreground">x ∈ [−1, 1]</span>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        Illustration only, separate from evaluated suites. Natural log; the second derivative is positive throughout the interval.
      </figcaption>
    </figure>
  );
}
