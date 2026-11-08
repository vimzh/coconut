"use client";

// Numeric measured depths and null gaps preserve the report's observed population.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportRun } from "@/lib/report-types";
import { exact } from "./report-format";

const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const dashes = [undefined, "7 3", "2 3", "8 3 2 3", "3 2"];
function seriesStyle(id: string) {
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return {
    color: colors[hash % colors.length],
    dash: dashes[Math.floor(hash / colors.length) % dashes.length],
  };
}
type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: { details?: Record<string, string> };
};
export function ReportTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipItem[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-80 space-y-2 rounded-lg border bg-popover p-3 text-xs shadow-sm">
      <p className="font-mono">depth = {String(label)}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="space-y-1">
          <p>
            <span style={{ color: item.color }}>━ </span>
            {item.name}:{" "}
            <span className="font-mono">
              {item.value == null ? "Unavailable" : String(item.value)}
            </span>
          </p>
          {item.payload?.details?.[String(item.dataKey)] && (
            <p className="text-muted-foreground">
              {item.payload.details[String(item.dataKey)]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function DepthChart({
  runs,
  depth,
}: {
  runs: readonly ReportRun[];
  depth: number | null;
}) {
  const depths = [
    ...new Set(runs.flatMap((run) => run.depths.map((entry) => entry.depth))),
  ]
    .filter((value) => depth === null || value === depth)
    .sort((a, b) => a - b);
  const series = runs.map((run, index) => ({
    run,
    key: `run${index}`,
    label: `${run.modelId} · ${run.endpointId} · ${run.id.slice(0, 8)}`,
    ...seriesStyle(run.id),
  }));
  const rows = depths.map((depth) => {
    const row: Record<string, number | null | Record<string, string>> = {
        depth,
      },
      details: Record<string, string> = {};
    for (const { run, key } of series) {
      const slice = run.depths.find((entry) => entry.depth === depth)?.slice;
      row[key] = slice?.macroF1 ?? null;
      details[key] = slice
        ? `${slice.population.includedTrials}/${slice.population.plannedTrials} included trials · ${slice.population.status} · spread min ${exact(slice.spread.min)}, max ${exact(slice.spread.max)}, sample SD ${exact(slice.spread.sampleStandardDeviation)} over ${slice.spread.count} eligible trials`
        : "No retained score at this depth";
    }
    row.details = details;
    return row;
  });
  const config = Object.fromEntries(
    series.map(({ key, label, color }) => [key, { label, color }]),
  );
  if (!runs.length)
    return (
      <p className="rounded-lg border p-6 text-sm text-muted-foreground">
        Select a comparable run to inspect its depth curve.
      </p>
    );
  return (
    <section aria-labelledby="depth-chart-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="depth-chart-title" className="text-xl font-medium">
          Macro-F1 versus depth
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pooled three-class macro-F1, from 0 to 1. Points mark measured depths;
          missing scores remain gaps.
        </p>
      </div>
      <ChartContainer
        config={config}
        className="h-80 w-full aspect-auto sm:h-96"
        aria-label="Macro-F1 at measured composition depths"
      >
        <LineChart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, right: 20, bottom: 24, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="depth"
            domain={["dataMin", "dataMax"]}
            ticks={depths}
            allowDecimals={false}
            label={{ value: "Measured depth", position: "bottom", offset: 8 }}
          />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={44} />
          <ChartTooltip content={<ReportTooltip />} />
          {series.map(({ key, label, color, dash }) => (
            <Line
              key={key}
              dataKey={key}
              name={label}
              type="linear"
              connectNulls={false}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={dash}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {series.map(({ key, label, color, dash }) => (
          <span key={key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="w-6 border-t-2"
              style={{
                borderColor: color,
                borderTopStyle: dash ? "dashed" : "solid",
              }}
            />
            {label}
          </span>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run / model</TableHead>
            <TableHead>Depth</TableHead>
            <TableHead>Macro-F1 (exact)</TableHead>
            <TableHead>Included / planned</TableHead>
            <TableHead>Δ from shallowest planned depth</TableHead>
            <TableHead>Trial min / max / sample SD</TableHead>
            <TableHead>Eligible trials</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {series.flatMap(({ run, label }) =>
            run.depths
              .filter((entry) => depth === null || entry.depth === depth)
              .map((entry) => (
                <TableRow key={`${run.id}-${entry.depth}`}>
                  <TableCell className="max-w-64 truncate" title={label}>
                    {label}
                  </TableCell>
                  <TableCell className="font-mono">{entry.depth}</TableCell>
                  <TableCell className="font-mono">
                    {exact(entry.slice?.macroF1)}
                  </TableCell>
                  <TableCell>
                    {entry.slice
                      ? `${entry.slice.population.includedTrials} / ${entry.slice.population.plannedTrials}`
                      : "No report"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {exact(entry.macroF1Difference)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {entry.slice
                      ? `${exact(entry.slice.spread.min)} / ${exact(entry.slice.spread.max)} / ${exact(entry.slice.spread.sampleStandardDeviation)}`
                      : "Unavailable"}
                  </TableCell>
                  <TableCell>
                    {entry.slice?.spread.count ?? "Unavailable"}
                  </TableCell>
                </TableRow>
              )),
          )}
        </TableBody>
      </Table>
      <p className="text-xs leading-5 text-muted-foreground">
        Trial spread describes the eligible repeated trials; it is not a
        confidence interval. Measured depth also varies with expression
        structure and length.
      </p>
    </section>
  );
}
