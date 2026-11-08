"use client";

// Browse retained tests by model outcome without folding service failures into model errors.
import { useId, useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { ReportCase, ReportRun, ReportTrial } from "@/lib/report-types";
import { exact } from "./report-format";
import styles from "./results-workspace.module.css";

function caseOutcomes(task: ReportCase, trials: readonly ReportTrial[]) {
  return {
    correct: trials.filter((trial) => trial.outcome === "answer" && trial.label === task.label).length,
    wrong: trials.filter((trial) => trial.outcome === "answer" && trial.label !== task.label).length,
    unusable: trials.filter((trial) => ["invalid", "refused", "truncated"].includes(trial.outcome)).length,
    incomplete: trials.filter((trial) => ["provider-error", "interrupted", "cancelled", "unattempted"].includes(trial.outcome)).length,
  };
}

export function EvidenceInspector({
  run,
  depth,
}: {
  run: ReportRun;
  depth: number | null;
}) {
  const id = useId(),
    [chosenCase, setCase] = useState(""),
    [query, setQuery] = useState(""),
    [outcome, setOutcome] = useState("all");
  const cases = run.cases.filter((entry) => depth === null || entry.depth === depth);
  const rows = cases.map((task) => {
    const trials = run.trials.filter((trial) => trial.caseId === task.id);
    return { task, trials, counts: caseOutcomes(task, trials) };
  });
  const search = query.trim().toLowerCase();
  const visible = rows.filter(({ task, trials, counts }) =>
    (!search || `${task.id} ${task.family} ${task.family.replaceAll("-", " ")} ${task.expression} ${task.label}`.toLowerCase().includes(search)) &&
    (outcome === "all" ||
      (outcome === "wrong" && counts.wrong > 0) ||
      (outcome === "unusable" && counts.unusable > 0) ||
      (outcome === "incomplete" && counts.incomplete > 0) ||
      (outcome === "correct" && trials.length > 0 && counts.correct === trials.length)),
  );
  const selected = visible.find(({ task }) => task.id === chosenCase) ?? visible[0];
  return (
    <section className={styles.caseBrowser} aria-labelledby={`${id}-title`}>
      <div className={styles.caseBrowserHeading}>
        <div>
          <h2 id={`${id}-title`}>Test cases & answers</h2>
          <p>Find a failure, inspect the expression, and read each model answer.</p>
        </div>
        <span className={styles.caseCount} aria-live="polite">{visible.length} / {cases.length} tests</span>
      </div>
      <div className={styles.caseFilters}>
        <div className="space-y-2">
          <Label htmlFor={`${id}-search`}>Search tests</Label>
          <div className={styles.searchField}>
            <Search size={16} aria-hidden="true" />
            <Input id={`${id}-search`} type="search" placeholder="Expression, family, or reference label" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-outcome`}>Trial outcome</Label>
          <NativeSelect id={`${id}-outcome`} value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            <NativeSelectOption value="all">All outcomes</NativeSelectOption>
            <NativeSelectOption value="wrong">Has incorrect answers</NativeSelectOption>
            <NativeSelectOption value="unusable">Has unusable replies</NativeSelectOption>
            <NativeSelectOption value="incomplete">Has service failures or unfinished work</NativeSelectOption>
            <NativeSelectOption value="correct">All trials correct</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <p className={styles.caseNote}>Correct counts use all planned trials for each test. Unusable model replies count as failures; service failures and unfinished work remain separate.</p>
      {selected ? (
        <div className={styles.caseColumns}>
          <div className={styles.caseList} role="group" aria-label="Matching test cases">
            <div className={styles.caseListHeading}><span>Test / reference</span><span>Correct / planned</span></div>
            <div className={styles.caseListScroll}>
              {visible.map(({ task, trials, counts }) => (
                <button key={task.id} type="button" className={styles.caseRow} aria-pressed={selected.task.id === task.id} aria-controls={`${id}-detail`} onClick={() => setCase(task.id)}>
                  <span className={styles.caseRowMain}>
                    <span className={styles.caseRowTitle}>{task.family.replaceAll("-", " ")}</span>
                    <span className={styles.caseRowMeta}>#{cases.indexOf(task) + 1} · depth {task.depth} · {task.label}</span>
                    {(counts.wrong > 0 || counts.unusable > 0 || counts.incomplete > 0) && <span className={styles.caseRowFailures}>
                      {[counts.wrong > 0 && `${counts.wrong} incorrect`, counts.unusable > 0 && `${counts.unusable} unusable`, counts.incomplete > 0 && `${counts.incomplete} service / unfinished`].filter(Boolean).join(" · ")}
                    </span>}
                  </span>
                  <span className={styles.caseRowScore}>{counts.correct} / {trials.length}<ArrowUpRight size={14} aria-hidden="true" /></span>
                </button>
              ))}
            </div>
          </div>
          <div id={`${id}-detail`} className={styles.caseDetail}>
            <div className={styles.caseDetailHeading}>
              <h3>Test {cases.indexOf(selected.task) + 1}</h3>
              <span>{selected.task.family.replaceAll("-", " ")}</span>
            </div>
            <SelectedCaseEvidence key={selected.task.id} selected={selected.task} trials={[...selected.trials].sort((a, b) => a.trialIndex - b.trialIndex)} />
          </div>
        </div>
      ) : (
        <div className={styles.noCases}>
          <h3>No tests match these filters</h3>
          <p>Try another expression or choose a different outcome or measured depth.</p>
          {(query !== "" || outcome !== "all") && <Button type="button" variant="outline" onClick={() => { setQuery(""); setOutcome("all"); }}>Clear test filters</Button>}
        </div>
      )}
    </section>
  );
}

function SelectedCaseEvidence({ selected, trials }: { selected: ReportCase; trials: readonly ReportTrial[] }) {
  return (
    <div className="min-w-0 space-y-5">
      <div className={styles.caseReference}>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="font-mono">depth = {selected.depth}</span>
          <span>
            Reference: <strong className="font-medium">{selected.label}</strong>
          </span>
          <span>
            Domain:{" "}
            <span className="font-mono">
              [{selected.domain.min}, {selected.domain.max}]
            </span>
          </span>
        </div>
        <pre
          tabIndex={0}
          className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-4 text-sm leading-6"
        >
          f(x) = {selected.expression}
        </pre>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {selected.id}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer rounded-md py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">
            Reference validation evidence
          </summary>
          <div className="space-y-3 pt-3">
            <p>
              {selected.proof.kind === "interval"
                ? `${selected.proof.steps} derivative-cover intervals at ${selected.proof.precision} bits`
                : `${selected.proof.steps} structural verification steps`}{" "}
              · {selected.proof.nodeCount} expression nodes · certificate{" "}
              {selected.proof.version}
            </p>
            {selected.proof.witnesses.map((witness) => (
              <div key={witness.kind}>
                <p className="font-medium">{witness.kind}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pt-2 text-xs">
                  {Object.entries(witness.values).map(([name, value]) => (
                    <div key={name} className="contents">
                      <dt>{name}</dt>
                      <dd className="break-all font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      </div>
      {selected.proof.independent && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer rounded-md py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">
            Independent analytic reference
          </summary>
          <div className="space-y-3 pt-3">
            <p>
              Policy:{" "}
              <span className="font-mono">
                {selected.proof.independent.policy}
              </span>
            </p>
            <p>
              Global second-derivative enclosure:{" "}
              {selected.proof.independent.globalSecond ? (
                <span className="break-all font-mono">
                  [{selected.proof.independent.globalSecond.min},{" "}
                  {selected.proof.independent.globalSecond.max}]
                </span>
              ) : (
                "Not supplied; inspect retained sign witnesses"
              )}
            </p>
            {selected.proof.independent.witnesses.map((witness, index) => (
              <p key={index} className="break-all font-mono text-xs">
                x = {witness.x}; second derivative in [{witness.min},{" "}
                {witness.max}]
              </p>
            ))}
          </div>
        </details>
      )}
      <div className="space-y-3">
        <h3 className="text-base font-medium">Model answers</h3>
        <p className="text-xs leading-5 text-muted-foreground">Each trial is a fresh request for the same test. Expand an answer to inspect its returned text and execution evidence.</p>
        {trials.map((trial) => (
          <details
            key={trial.trialIndex}
            className="rounded-lg border bg-card p-4"
          >
            <summary className="cursor-pointer rounded-md text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <span className={trial.outcome === "answer" && trial.label === selected.label ? styles.correctTrial : trial.outcome === "answer" ? styles.wrongTrial : undefined}>
                Trial {trial.trialIndex + 1} · {trial.outcome === "answer" ? trial.label === selected.label ? "Correct" : "Incorrect" : trial.outcome}
              </span>
              {trial.label && ` → ${trial.label}`} · {trial.attempts}{" "}
              {trial.attempts === 1 ? "attempt" : "attempts"}
            </summary>
            <div className="space-y-4 pt-4">
              <dl className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
                <dt>Execution outcome</dt>
                <dd>
                  {trial.outcome}
                  {trial.failureCode && ` · ${trial.failureCode}`}
                  {trial.errorKind && ` · ${trial.errorKind}`}
                </dd>
                <dt>Interpreted label</dt>
                <dd>{trial.label ?? "No valid label"}</dd>
                <dt>Invalid-answer reason</dt>
                <dd>{trial.invalidReason ?? "Not applicable"}</dd>
                <dt>Logical trial duration</dt>
                <dd>
                  {exact(trial.elapsedMs)}
                  {trial.elapsedMs !== null && " ms"}
                </dd>
                <dt>Reported model / provider</dt>
                <dd className="break-all">
                  {trial.reportedModelId ?? "Not reported"} /{" "}
                  {trial.reportedServingProvider ?? "Not reported"}
                </dd>
                <dt>Reported reasoning effort</dt>
                <dd>{trial.reasoningEffort ?? "Not reported"}</dd>
              </dl>
              <div>
                <p className="mb-2 text-sm font-medium">Raw returned text</p>
                {trial.rawText === null ? (
                  <p className="text-sm text-muted-foreground">
                    This trial was not attempted.
                  </p>
                ) : trial.rawText === "" ? (
                  <p className="text-sm text-muted-foreground">
                    No text was returned.
                  </p>
                ) : (
                  <pre
                    tabIndex={0}
                    className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 text-xs leading-5"
                  >
                    {trial.rawText}
                  </pre>
                )}
              </div>
              {trial.explanation && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Extracted explanation
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {trial.explanation}
                  </p>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
