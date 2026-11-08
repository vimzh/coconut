// Sample the introductory functions and draw chords between actual graph points.
import { cn } from "@/lib/utils";
import { AnimatedGraph } from "./animated-graph";

const graphs = {
  convex: {
    evaluate: (x: number) => x * x,
    label: "Graph of x squared on [−1, 1]. The curve lies below the dashed chord joining (−1, 1) and (1, 1).",
  },
  concave: {
    evaluate: (x: number) => -x * x,
    label: "Graph of minus x squared on [−1, 1]. The curve lies above the dashed chord joining (−1, −1) and (1, −1).",
  },
  neither: {
    evaluate: (x: number) => x * x * x,
    label: "Graph of x cubed on [−1, 1]. The curve lies above the chord from (−1, −1) to (0, 0), violating convexity, and below the chord from (0, 0) to (1, 1), violating concavity.",
  },
  "shifted-convex": {
    evaluate: (x: number) => (x - 1) * (x - 1),
    label: "Graph of (x minus 1) squared on [−1, 1]. The curve lies below the dashed chord joining (−1, 4) and (1, 0).",
  },
  "shifted-concave": {
    evaluate: (x: number) => -(x - 1) * (x - 1),
    label: "Graph of minus (x minus 1) squared on [−1, 1]. The curve lies above the dashed chord joining (−1, −4) and (1, 0).",
  },
} as const;

export function FunctionGraph({ kind, className }: { kind: keyof typeof graphs; className?: string }) {
  const { evaluate, label } = graphs[kind];
  const values = [-1, 0, 1].map(evaluate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.15;
  const plotX = (x: number) => 160 + 126 * x;
  const plotY = (y: number) => 150 - (y - min + padding) / (max - min + 2 * padding) * 130;
  const point = (x: number) => `${plotX(x).toFixed(2)} ${plotY(evaluate(x)).toFixed(2)}`;
  const curve = Array.from({ length: 81 }, (_, index) => `${index === 0 ? "M" : "L"}${point(-1 + index / 40)}`).join(" ");
  const chords = kind === "neither" ? [[-1, 0], [0, 1]] : [[-1, 1]];
  const endpoints = kind === "neither" ? [-1, 0, 1] : [-1, 1];
  const axisY = plotY(0);

  return (
    <AnimatedGraph curve={curve} viewBox="0 0 320 180" role="img" aria-label={label} className={cn("block h-auto w-full text-foreground", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25">
        <path d={`M24 ${axisY}H298M160 12V158`} />
        {[-1, 1].map((x) => <path key={x} d={`M${plotX(x)} ${axisY - 3}v6`} />)}
        {[min, max].filter((y) => y !== 0).map((y) => <path key={y} d={`M157 ${plotY(y)}h6`} />)}
      </g>
      <g data-graph="chord" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.5">
        {chords.map(([left, right]) => <path key={left} d={`M${point(left)}L${point(right)}`} />)}
      </g>
      <path data-graph="curve" pathLength="1" d={curve} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {endpoints.map((x) => <circle data-graph="point" key={x} cx={plotX(x)} cy={plotY(evaluate(x))} r="3" fill="currentColor" />)}
      <g fill="currentColor" className="font-mono text-[18px]" opacity="0.65">
        <text x="34" y={axisY + 24} textAnchor="middle">−1</text>
        <text x="170" y={axisY + 24}>0</text>
        <text x="286" y={axisY + 24} textAnchor="middle">1</text>
        {[min, max].filter((y) => y !== 0).map((y) => <text key={y} x="148" y={plotY(y) + 6} textAnchor="end">{y}</text>)}
        <text x="304" y={axisY + 6}>x</text>
        <text x="170" y="18">f(x)</text>
      </g>
    </AnimatedGraph>
  );
}
