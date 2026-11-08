"use client";
// Class metrics retain the report population and use expression-tree depth on every curve.
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
import { REPORT_COLUMNS, REPORT_LABELS } from "@/lib/report-types";
import type { ReportRun, ReportSlice } from "@/lib/report-types";
import { ReportTooltip } from "./depth-chart";
import { classColors, classDashes, exact } from "./report-format";

export function ClassDetail({
  run,
  slice,
  depth,
}: {
  run: ReportRun;
  slice: ReportSlice | null;
  depth: number | null;
}) {
  const points = run.depths
    .filter((entry) => depth === null || entry.depth === depth)
    .map((entry) => ({
      depth: entry.depth,
      ...Object.fromEntries(
        REPORT_LABELS.map((label) => [
          label,
          entry.slice?.classes[label].recall ?? null,
        ]),
      ),
      details: Object.fromEntries(
        REPORT_LABELS.map((label) => [
          label,
          entry.slice
            ? `${entry.slice.classes[label].support} included reference observations; trial min ${exact(entry.slice.recallSpread[label].min)}, max ${exact(entry.slice.recallSpread[label].max)}, sample SD ${exact(entry.slice.recallSpread[label].sampleStandardDeviation)} over ${entry.slice.recallSpread[label].count} eligible trials`
            : "No retained report",
        ]),
      ),
    }));
  const config = Object.fromEntries(
    REPORT_LABELS.map((label) => [label, { label, color: classColors[label] }]),
  );
  return (
    <section className="grid gap-8 xl:grid-cols-2" aria-label="Class detail">
      <div className="min-w-0 space-y-4">
        <h3 className="text-lg font-medium">Recall by class</h3>
        <ChartContainer
          config={config}
          className="h-64 w-full aspect-auto"
          aria-label="Per-class recall by expression-tree depth"
        >
          <LineChart accessibilityLayer data={points} margin={{ right: 16, bottom: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="depth"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={points.map((p) => p.depth)}
              label={{ value: "Expression-tree depth", position: "insideBottom", offset: -4 }}
            />
            <YAxis domain={[0, 1]} width={40} />
            <ChartTooltip content={<ReportTooltip />} />
            {REPORT_LABELS.map((label) => (
              <Line
                key={label}
                dataKey={label}
                name={label}
                type="linear"
                stroke={classColors[label]}
                strokeDasharray={classDashes[label]}
                connectNulls={false}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-4 text-xs">
          {REPORT_LABELS.map((label) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className="w-6 border-t-2"
                aria-hidden="true"
                style={{
                  borderColor: classColors[label],
                  borderTopStyle: classDashes[label] ? "dashed" : "solid",
                }}
              />
              {label}
            </span>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expression-tree depth</TableHead>
              {REPORT_LABELS.map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.depth}>
                <TableCell>{point.depth}</TableCell>
                {REPORT_LABELS.map((label) => (
                  <TableCell key={label} className="font-mono">
                    {exact(
                      (point as Record<string, unknown>)[label] as
                        number | null,
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="min-w-0 space-y-4">
        <h3 className="text-lg font-medium">Reference → predicted</h3>
        <p className="text-sm text-muted-foreground">
          Cell count and row rate. Rows are reference classes; columns are model
          answers. Unusable replies remain included.
        </p>
        {!slice ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            The confusion matrix is unavailable until a report is retained.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  {REPORT_COLUMNS.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {REPORT_LABELS.map((label) => (
                  <TableRow key={label}>
                    <TableHead scope="row">{label}</TableHead>
                    {REPORT_COLUMNS.map((column) => {
                      const row = slice.confusion[label],
                        rate = row.rowRates?.[column] ?? null;
                      return (
                        <TableCell
                          key={column}
                          className="text-center"
                          style={{
                            backgroundColor: `rgba(20,107,115,${rate === null ? 0 : rate * 0.2})`,
                          }}
                        >
                          <span className="block font-mono text-base">
                            {row.counts[column]}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {rate === null ? "No support" : exact(rate)}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Precision</TableHead>
                  <TableHead>Recall</TableHead>
                  <TableHead>F1</TableHead>
                  <TableHead>Support</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REPORT_LABELS.map((label) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="font-mono">
                      {exact(slice.classes[label].precision)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {exact(slice.classes[label].recall)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {exact(slice.classes[label].f1)}
                    </TableCell>
                    <TableCell>{slice.classes[label].support}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </section>
  );
}
