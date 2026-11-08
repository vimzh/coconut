"use client";

// All reporting panels and the export share one comparison population and depth filter.
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  buildReportExport,
  groupReportRuns,
  reportSlice,
} from "@/lib/report-adapter";
import type { ReportRun, UsageField } from "@/lib/report-types";
import { ClassDetail } from "./class-detail";
import { DepthChart } from "./depth-chart";
import { DiagnosticCharts } from "./diagnostic-charts";
import { EvidenceInspector } from "./evidence-inspector";
import { OutcomeSummary } from "./outcome-summary";
import { exact, shortScore } from "./report-format";

export interface ResultsDashboardProps {
  runs: readonly ReportRun[];
}
export type { ReportRun } from "@/lib/report-types";

function ResultsWorkbench({ runs }: ResultsDashboardProps) {
  const id = useId(),
    [runId, setRun] = useState(runs[0]?.id ?? ""),
    [depthValue, setDepth] = useState("all"),
    [selectedIds, setSelected] = useState<readonly string[] | null>(null),
    [exportError, setExportError] = useState<string | null>(null);
  const [usageField, setUsageField] = useState<UsageField>("output"),
    [usageSemantics, setUsageSemantics] = useState("");
  const run = runs.find((entry) => entry.id === runId) ?? runs[0];
  if (!run) return null;
  const depth = depthValue === "all" ? null : Number(depthValue),
    slice = reportSlice(run, depth);
  const selectedRuns = runs.filter(
    (entry) =>
      entry.overall?.population.status === "complete" &&
      (selectedIds === null || selectedIds.includes(entry.id)),
  );
  const partialView = run.overall?.population.status !== "complete";
  const curveRuns = partialView ? [run] : selectedRuns;
  const semantics = [
    ...new Set(
      run.depths
        .filter((entry) => depth === null || entry.depth === depth)
        .flatMap(
          (entry) =>
            entry.slice?.usage.fields[usageField].groups.map(
              (g) => g.semantics,
            ) ?? [],
        ),
    ),
  ];
  const visibleSemantics = semantics.includes(usageSemantics)
    ? usageSemantics
    : (semantics[0] ?? null);
  function download() {
    try {
      const filtered = buildReportExport({
        detailRun: run,
        curveRuns,
        depth,
        usageField,
        usageSemantics: visibleSemantics,
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(filtered, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "coconut-filtered-results.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportError(null);
    } catch {
      setExportError(
        "The filtered report export could not be created. Try again in this browser.",
      );
    }
  }
  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-run`}>Inspect run</Label>
            <NativeSelect
              id={`${id}-run`}
              value={run.id}
              onChange={(e) => setRun(e.target.value)}
            >
              {runs.map((entry) => (
                <NativeSelectOption key={entry.id} value={entry.id}>
                  {entry.modelId} · {entry.provider} · {entry.id.slice(0, 8)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-depth`}>Measured depth</Label>
            <NativeSelect
              id={`${id}-depth`}
              value={depthValue}
              onChange={(e) => setDepth(e.target.value)}
            >
              <NativeSelectOption value="all">
                All planned depths
              </NativeSelectOption>
              {run.depths.map((entry) => (
                <NativeSelectOption key={entry.depth} value={entry.depth}>
                  depth = {entry.depth}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={download}>
          Export filtered evidence
        </Button>
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Depth curves</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {runs.map((entry) => (
            <label
              key={entry.id}
              className="flex max-w-full min-w-0 items-start gap-2 break-all text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-accent"
                checked={
                  partialView
                    ? entry.id === run.id
                    : entry.overall?.population.status === "complete" &&
                      (selectedIds === null || selectedIds.includes(entry.id))
                }
                disabled={
                  partialView || entry.overall?.population.status !== "complete"
                }
                onChange={(e) => {
                  const current = selectedIds ?? runs.map((item) => item.id);
                  setSelected(
                    e.target.checked
                      ? [...current, entry.id]
                      : current.filter((value) => value !== entry.id),
                  );
                }}
              />
              {entry.modelId} · {entry.provider} ·{" "}
              <span className="font-mono text-xs">{entry.id.slice(0, 8)}</span>
              {entry.overall?.population.status !== "complete" && (
                <span className="text-xs text-muted-foreground">
                  Inspect individually
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      {partialView && (
        <p className="text-sm leading-6 text-muted-foreground">
          This run has incomplete or unavailable scores and is shown on its own.
          Select a run with complete observations to compare model curves.
        </p>
      )}
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Pooled macro-F1</p>
            <p className="mt-1 font-mono text-3xl">
              {shortScore(slice?.macroF1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Accuracy</p>
            <p className="mt-1 font-mono text-xl">
              {shortScore(slice?.accuracy.value)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {slice
                ? `${slice.accuracy.numerator} / ${slice.accuracy.denominator} included trials`
                : "No retained population"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Included / planned trials
            </p>
            <p className="mt-1 font-mono text-xl">
              {slice
                ? `${slice.population.includedTrials} / ${slice.population.plannedTrials}`
                : "No retained report"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Evidence state</p>
            <p className="mt-1 text-sm">
              {slice?.population.status === "provisional"
                ? "Partial results"
                : slice?.population.status === "complete"
                  ? "Complete observations"
                  : "Score unavailable"}{" "}
              · {run.state}
            </p>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {slice?.population.status === "provisional"
            ? "Infrastructure failures or missing work are excluded from this provisional score. Partial results are not complete comparisons."
            : slice?.population.status === "unavailable" || !slice
              ? "No eligible returned model outcomes are available for this population. Unattempted work and infrastructure failures remain visible below."
              : "All planned trials returned model outcomes, including unusable replies. Completion alone does not establish leaderboard eligibility."}{" "}
          Headline figures are rounded; tables and tooltips retain exact values.
        </p>
      </div>
      <DepthChart runs={curveRuns} depth={depth} />
      <div className="space-y-8 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Selected run detail</h2>
          <p className="font-mono text-sm">
            {depth === null ? "All planned depths" : `depth = ${depth}`}
          </p>
        </div>
        <p className="break-all text-sm text-muted-foreground">
          {run.provider} / {run.modelId} / {run.servingProvider ?? "direct"} ·{" "}
          {run.profileId}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Requested settings: {run.settings.maxOutputTokens.toLocaleString()}{" "}
          output tokens per attempt · {run.settings.reasoning} reasoning ·{" "}
          {run.settings.sampling} sampling · concurrency{" "}
          {run.settings.concurrency} · tools {run.settings.tools}
        </p>
        <ClassDetail run={run} slice={slice} depth={depth} />
        <div className="border-t pt-8">
          <DiagnosticCharts
            run={run}
            depth={depth}
            field={usageField}
            chosenSemantics={usageSemantics}
            setField={setUsageField}
            setSemantics={setUsageSemantics}
          />
        </div>
        <div className="border-t pt-8">
          <OutcomeSummary slice={slice} />
        </div>
      </div>
      <EvidenceInspector key={run.id} run={run} depth={depth} />
      <details className="rounded-lg border p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2 font-medium text-foreground">
          Comparison identity and exact overview
        </summary>
        <dl className="grid gap-x-4 gap-y-2 pt-3 sm:grid-cols-[auto_1fr]">
          {Object.entries({
            run: run.id,
            suite: run.suiteId,
            profile: run.profileId,
            endpoint: run.endpointId,
            settings: run.settingsId,
            protocol: run.protocolVersion,
            generator: run.generatorVersion,
            verifier: run.verifierVersion,
            depthPolicy: run.depthPolicyVersion,
            prompt: run.promptVersion ?? `protocol ${run.protocolVersion}`,
            report: run.reportId ?? "Unavailable",
            evidenceHash: run.evidenceSha256 ?? "Unavailable",
            macroF1: exact(slice?.macroF1),
            accuracy: exact(slice?.accuracy.value),
          }).map(([key, value]) => (
            <div key={key} className="contents">
              <dt>{key}</dt>
              <dd className="break-all font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

export function ResultsDashboard({ runs }: ResultsDashboardProps) {
  const id = useId(),
    groups = groupReportRuns(runs),
    [groupKey, setGroup] = useState("");
  const group = groups.find((entry) => entry.key === groupKey) ?? groups[0];
  if (!group)
    return (
      <div className="rounded-xl border bg-card p-8">
        <h2 className="text-xl font-medium">No retained results yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start an evaluation or open a saved run to inspect measured scores and
          task evidence.
        </p>
      </div>
    );
  return (
    <section className="min-w-0 space-y-6" aria-label="Evaluation results">
      {groups.length > 1 && (
        <div className="max-w-3xl space-y-2">
          <Label htmlFor={`${id}-group`}>Comparison population</Label>
          <NativeSelect
            id={`${id}-group`}
            value={group.key}
            onChange={(e) => setGroup(e.target.value)}
          >
            {groups.map((entry, index) => (
              <NativeSelectOption key={entry.key} value={entry.key}>
                {index + 1} · {entry.runs[0].suiteKey} ·{" "}
                {entry.runs[0].profileId} · settings{" "}
                {entry.runs[0].settingsId.slice(-8)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Suite, protocol, profile, certification, and settings identities
            stay separate. Runs are never pooled across comparison populations.
          </p>
        </div>
      )}
      <ResultsWorkbench key={group.key} runs={group.runs} />
    </section>
  );
}
