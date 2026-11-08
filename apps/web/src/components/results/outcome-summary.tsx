import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { REPORT_OUTCOMES } from "@/lib/report-types";
import type { ReportSlice } from "@/lib/report-types";
import { exact } from "./report-format";

export function OutcomeSummary({ slice }: { slice: ReportSlice | null }) {
  if (!slice)
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Outcome, latency, and cost summaries require a retained report.
      </p>
    );
  return (
    <section
      className="grid grid-cols-1 gap-8 xl:grid-cols-2"
      aria-label="Outcome and resource summaries"
    >
      <div className="min-w-0 space-y-4">
        <h3 className="text-lg font-medium">Every planned outcome</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          Bars use all {slice.population.plannedTrials} planned trials. Reported
          outcome rates retain their own displayed denominators.
        </p>
        <div className="space-y-3">
          {REPORT_OUTCOMES.map((key) => (
            <div
              key={key}
              className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs"
            >
              <span>{key}</span>
              <span className="h-2 bg-muted">
                <span
                  className="block h-full bg-chart-1"
                  style={{
                    width: `${slice.population.plannedTrials ? (100 * slice.outcomes[key].numerator) / slice.population.plannedTrials : 0}%`,
                  }}
                />
              </span>
              <span className="text-right font-mono">
                {slice.outcomes[key].numerator}
              </span>
            </div>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outcome</TableHead>
              <TableHead>Count / denominator</TableHead>
              <TableHead>Reported rate (exact)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REPORT_OUTCOMES.map((key) => (
              <TableRow key={key}>
                <TableCell>{key}</TableCell>
                <TableCell>
                  {slice.outcomes[key].numerator} /{" "}
                  {slice.outcomes[key].denominator}
                </TableCell>
                <TableCell className="font-mono">
                  {exact(slice.outcomes[key].value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Latency and cost</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt>Latency p50</dt>
            <dd className="break-all font-mono">
              {exact(slice.latency.p50Ms)}
              {slice.latency.p50Ms !== null && " ms"}
            </dd>
            <dt>Latency p95</dt>
            <dd className="break-all font-mono">
              {exact(slice.latency.p95Ms)}
              {slice.latency.p95Ms !== null && " ms"}
            </dd>
            <dt>Latency coverage</dt>
            <dd>
              {slice.latency.reporting} / {slice.latency.eligible} eligible
              trials
            </dd>
            <dt>Missing latency</dt>
            <dd>{slice.latency.missing}</dd>
            <dt>Complete cost total</dt>
            <dd className="break-all font-mono">
              {slice.cost.total
                ? `${slice.cost.total.amount} ${slice.cost.total.currency} (${slice.cost.total.kind})`
                : "Unavailable"}
            </dd>
            <dt>Cost coverage</dt>
            <dd>
              {slice.cost.reporting} / {slice.cost.attempts} attempts
            </dd>
          </dl>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Missing values remain unavailable. Billed and estimated amounts,
          currencies, and pricing populations are kept separate; known subtotals
          are not a complete bill.
        </p>
        {slice.cost.groups.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind / currency</TableHead>
                <TableHead>Known subtotal (exact)</TableHead>
                <TableHead>Reporting / attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.cost.groups.map((group, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {group.kind} · {group.currency}
                    {group.source && (
                      <span
                        className="block max-w-60 truncate text-xs text-muted-foreground"
                        title={group.source}
                      >
                        {group.source} · {group.date}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{group.amount}</TableCell>
                  <TableCell>
                    {group.reporting} / {slice.cost.attempts}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No cost evidence was reported.
          </p>
        )}
      </div>
    </section>
  );
}
