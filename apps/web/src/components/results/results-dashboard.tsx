"use client";

// All reporting panels and the export share one comparison population and depth filter.
import { useId, useState } from "react";
import { ArrowDownToLine, ChartNoAxesCombined, ListFilter, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { getNonlinearStages, getStageLevels } from "@/lib/benchmark-depth";
import { ClassDetail } from "./class-detail";
import { DepthChart } from "./depth-chart";
import { DiagnosticCharts } from "./diagnostic-charts";
import { EvidenceInspector } from "./evidence-inspector";
import { OutcomeSummary } from "./outcome-summary";
import { exact, shortScore } from "./report-format";
import styles from "./results-workspace.module.css";

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
  const stageLevels = getStageLevels(run.suiteId);
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
    <div className={styles.workbench}>
      <div className={styles.toolbar}>
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
            <Label htmlFor={`${id}-depth`}>Expression-tree depth</Label>
            <NativeSelect
              id={`${id}-depth`}
              value={depthValue}
              onChange={(e) => setDepth(e.target.value)}
            >
              <NativeSelectOption value="all">
                All expression-tree depths
              </NativeSelectOption>
              {run.depths.map((entry) => (
                <NativeSelectOption key={entry.depth} value={entry.depth}>
                  {getNonlinearStages(run.suiteId, entry.depth) !== null
                    ? `${getNonlinearStages(run.suiteId, entry.depth)} nonlinear stages · tree depth ${entry.depth}`
                    : `Expression-tree depth ${entry.depth}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={download}>
          <ArrowDownToLine aria-hidden="true" /> Export evidence
        </Button>
      </div>
      {stageLevels && <p className={styles.depthNote}>
        This benchmark has {stageLevels.map((level) => level.stages).join(" / ")} nonlinear composition stages,
        at expression-tree depths {stageLevels.map((level) => level.astDepth).join(" / ")}. Charts use expression-tree depth.
      </p>}
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}
      {runs.length > 1 && <details className={styles.comparisons}>
        <summary>Compare runs at the same settings</summary>
      <fieldset className="space-y-3 pt-4">
        <legend className="mb-3 text-sm font-medium">Expression-tree depth curves</legend>
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
      </details>}
      {partialView && (
        <p className={styles.partialNotice}>
          This run has incomplete or unavailable scores and is shown on its own.
          Select a run with complete observations to compare model curves.
        </p>
      )}
      <div className={styles.metrics}>
          <div className={styles.metric}>
            <p>Pooled macro-F1</p>
            <strong className={styles.primaryScore} data-unavailable={slice?.macroF1 == null}>
              {shortScore(slice?.macroF1)}
            </strong>
            <span>Primary score · 0–1 · three classes</span>
          </div>
          <div className={styles.metric}>
            <p>Accuracy</p>
            <strong data-unavailable={slice?.accuracy.value == null}>
              {slice?.accuracy.value == null ? "Unavailable" : `${(100 * slice.accuracy.value).toFixed(1)}%`}
            </strong>
            <span>
              {slice
                ? `${slice.accuracy.numerator} correct / ${slice.accuracy.denominator} included responses`
                : "No retained population"}
            </span>
          </div>
          <div className={styles.metric}>
            <p>
              Included / planned responses
            </p>
            <strong>
              {slice
                ? `${slice.population.includedTrials} / ${slice.population.plannedTrials}`
                : "No retained report"}
            </strong>
            <span>Model outcomes in the score</span>
          </div>
          <div className={styles.metric}>
            <p>Evidence state</p>
            <strong className={styles.evidenceState}>
              {slice?.population.status === "provisional"
                ? "Partial results"
                : slice?.population.status === "complete"
                  ? "Complete"
                  : "Score unavailable"}{" "}
            </strong>
            <span>Run {run.state}</span>
          </div>
      </div>
      {slice && <dl className={styles.outcomeCounts} aria-label="Response outcomes">
        <div><dt>Wrong valid labels</dt><dd>{slice.outcomes.answer.numerator - slice.population.correctTrials}</dd></div>
        <div><dt>Unusable responses</dt><dd>{["invalid", "empty", "conflicting", "refused", "truncated"].reduce((sum, outcome) => sum + slice.outcomes[outcome as keyof typeof slice.outcomes].numerator, 0)}</dd></div>
        <div><dt>Service failures</dt><dd>{slice.outcomes["provider-error"].numerator}</dd></div>
        <div><dt>Unfinished work</dt><dd>{slice.outcomes.interrupted.numerator + slice.outcomes.cancelled.numerator + slice.outcomes.unattempted.numerator}</dd></div>
      </dl>}
        <p className={styles.scoreNote}>
          {slice?.population.status === "provisional"
            ? "Infrastructure failures or missing work are excluded from this provisional score. Partial results are not complete comparisons."
            : slice?.population.status === "unavailable" || !slice
              ? "No eligible returned model outcomes are available for this population. Unattempted work and infrastructure failures remain visible below."
              : "All planned trials returned model outcomes, including unusable replies. Leaderboard eligibility is checked separately."}{" "}
          Headline figures are rounded; tables and tooltips retain exact values.
        </p>
      <Tabs defaultValue="overview" className={styles.tabs}>
        <TabsList variant="line" className={styles.tabList} aria-label="Result views">
          <TabsTrigger value="overview"><ChartNoAxesCombined aria-hidden="true" /> Overview</TabsTrigger>
          <TabsTrigger value="cases"><ListFilter aria-hidden="true" /> Tasks & answers <span className={styles.tabCount}>{run.cases.filter((entry) => depth === null || entry.depth === depth).length}</span></TabsTrigger>
          <TabsTrigger value="diagnostics"><Activity aria-hidden="true" /> Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className={styles.tabContent}>
          <div className={styles.panel}>
            <DepthChart runs={curveRuns} depth={depth} />
          </div>
          <div className={styles.panel}>
        <ClassDetail run={run} slice={slice} depth={depth} />
          </div>
        </TabsContent>
        <TabsContent value="cases" className={styles.tabContent}>
          <EvidenceInspector key={run.id} run={run} depth={depth} />
        </TabsContent>
        <TabsContent value="diagnostics" className={styles.tabContent}>
          <div className={styles.panel}>
          <DiagnosticCharts
            run={run}
            depth={depth}
            field={usageField}
            chosenSemantics={usageSemantics}
            setField={setUsageField}
            setSemantics={setUsageSemantics}
          />
        </div>
        <div className={styles.panel}>
          <OutcomeSummary slice={slice} />
        </div>
        <div className={styles.settings}>
          <h2>Run settings</h2>
          <p>{run.provider} / <span className="font-mono">{run.modelId}</span> / {run.servingProvider ?? "direct"}</p>
          <p>{run.settings.maxOutputTokens.toLocaleString()} output tokens per attempt · {run.settings.reasoning} reasoning · {run.settings.sampling} sampling · concurrency {run.settings.concurrency} · tools {run.settings.tools}</p>
          <p className="font-mono">{run.profileId}</p>
        </div>
      <details className={styles.identity}>
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
        </TabsContent>
      </Tabs>
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
