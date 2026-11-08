"use client";
// Resource and agreement diagnostics preserve their reported populations and missing values.
import { useId } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usageSeries } from "@/lib/report-adapter";
import type { ReportRun, UsageField } from "@/lib/report-types";
import { ReportTooltip } from "./depth-chart";
import { exact } from "./report-format";

export function DiagnosticCharts({
  run,
  depth,
  field,
  chosenSemantics,
  setField,
  setSemantics,
}: {
  run: ReportRun;
  depth: number | null;
  field: UsageField;
  chosenSemantics: string;
  setField: (value: UsageField) => void;
  setSemantics: (value: string) => void;
}) {
  const id = useId();
  const slices = run.depths.filter(
    (entry) => depth === null || entry.depth === depth,
  );
  const semantics = [
    ...new Set(
      slices.flatMap(
        (entry) =>
          entry.slice?.usage.fields[field].groups.map((g) => g.semantics) ?? [],
      ),
    ),
  ];
  const selectedSemantics = semantics.includes(chosenSemantics)
    ? chosenSemantics
    : semantics[0];
  const usage =
    selectedSemantics === undefined
      ? []
      : usageSeries(run, field, selectedSemantics, depth).map((point) => ({
          ...point,
          details: {
            value: `${point.reporting ?? "Unknown"}/${point.total ?? "unknown"} complete logical trials reporting this semantic group`,
          },
        }));
  const agreement = slices.map((entry) => ({
    depth: entry.depth,
    value: entry.slice?.agreement.value ?? null,
    details: {
      value: entry.slice
        ? `${entry.slice.agreement.eligibleInstances}/${entry.slice.agreement.totalInstances} eligible instances; ${entry.slice.agreement.agreeingPairs}/${entry.slice.agreement.totalPairs} agreeing pairs`
        : "No retained report",
    },
  }));
  return (
    <section
      className="grid gap-8 xl:grid-cols-2"
      aria-label="Usage and agreement"
    >
      <div className="min-w-0 space-y-4">
        <h3 className="text-lg font-medium">Reported token usage</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-field`}>Token field</Label>
            <NativeSelect
              id={`${id}-field`}
              value={field}
              onChange={(e) => {
                setField(e.target.value as UsageField);
                setSemantics("");
              }}
            >
              {["input", "output", "reasoning"].map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-semantics`}>Reported semantics</Label>
            <NativeSelect
              id={`${id}-semantics`}
              value={selectedSemantics ?? ""}
              disabled={!semantics.length}
              onChange={(e) => setSemantics(e.target.value)}
            >
              {semantics.length ? (
                semantics.map((value) => (
                  <NativeSelectOption key={value}>{value}</NativeSelectOption>
                ))
              ) : (
                <NativeSelectOption value="">Not reported</NativeSelectOption>
              )}
            </NativeSelect>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Mean tokens per complete logical trial, including its attempts.
          Reasoning is a reported field and is not added to output totals.
        </p>
        {!usage.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No compatible reported usage for this field and expression-tree depth filter.
          </p>
        ) : (
          <ChartContainer
            config={{
              value: { label: `${field} tokens`, color: "var(--chart-1)" },
            }}
            className="h-56 w-full aspect-auto"
          >
            <LineChart accessibilityLayer data={usage} margin={{ bottom: 16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="depth"
                domain={["dataMin", "dataMax"]}
                ticks={usage.map((p) => p.depth)}
                label={{ value: "Expression-tree depth", position: "insideBottom", offset: -4 }}
              />
              <YAxis width={56} domain={[0, "auto"]} />
              <ChartTooltip content={<ReportTooltip />} />
              <Line
                type="linear"
                dataKey="value"
                name={`${field} tokens`}
                stroke="var(--chart-1)"
                connectNulls={false}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expression-tree depth</TableHead>
              <TableHead>Mean tokens (exact)</TableHead>
              <TableHead>Reporting / planned trials</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.map((point) => (
              <TableRow key={point.depth}>
                <TableCell>{point.depth}</TableCell>
                <TableCell className="font-mono">
                  {exact(point.value)}
                </TableCell>
                <TableCell>
                  {point.reporting ?? "Unavailable"} /{" "}
                  {point.total ?? "Unavailable"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="min-w-0 space-y-4">
        <h3 className="text-lg font-medium">Trial agreement</h3>
        <p className="text-sm text-muted-foreground">
          Agreement measures consistent valid labels across trials. It does not
          establish correctness.
        </p>
        <ChartContainer
          config={{ value: { label: "Agreement", color: "var(--chart-2)" } }}
          className="h-56 w-full aspect-auto"
        >
          <LineChart accessibilityLayer data={agreement} margin={{ bottom: 16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="depth"
              domain={["dataMin", "dataMax"]}
              ticks={agreement.map((p) => p.depth)}
              label={{ value: "Expression-tree depth", position: "insideBottom", offset: -4 }}
            />
            <YAxis domain={[0, 1]} width={40} />
            <ChartTooltip content={<ReportTooltip />} />
            <Line
              type="linear"
              dataKey="value"
              name="Agreement"
              stroke="var(--chart-2)"
              strokeDasharray="6 3"
              connectNulls={false}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expression-tree depth</TableHead>
              <TableHead>Agreement (exact)</TableHead>
              <TableHead>Eligible / total instances</TableHead>
              <TableHead>Agreeing / total pairs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slices.map((entry) => (
              <TableRow key={entry.depth}>
                <TableCell>{entry.depth}</TableCell>
                <TableCell className="font-mono">
                  {exact(entry.slice?.agreement.value)}
                </TableCell>
                <TableCell>
                  {entry.slice
                    ? `${entry.slice.agreement.eligibleInstances} / ${entry.slice.agreement.totalInstances}`
                    : "Unavailable"}
                </TableCell>
                <TableCell>
                  {entry.slice
                    ? `${entry.slice.agreement.agreeingPairs} / ${entry.slice.agreement.totalPairs}`
                    : "Unavailable"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
