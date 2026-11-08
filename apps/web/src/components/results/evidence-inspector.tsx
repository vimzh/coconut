"use client";
import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { ReportRun } from "@/lib/report-types";
import { exact } from "./report-format";

export function EvidenceInspector({
  run,
  depth,
}: {
  run: ReportRun;
  depth: number | null;
}) {
  const id = useId(),
    [chosenCase, setCase] = useState("");
  const cases = run.cases.filter(
    (entry) => depth === null || entry.depth === depth,
  );
  const selected = cases.find((entry) => entry.id === chosenCase) ?? cases[0];
  if (!selected)
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No retained tasks match this depth filter.
      </p>
    );
  const trials = run.trials
    .filter((trial) => trial.caseId === selected.id)
    .sort((a, b) => a.trialIndex - b.trialIndex);
  return (
    <section
      className="space-y-6 border-t pt-8"
      aria-labelledby={`${id}-title`}
    >
      <div>
        <h2 id={`${id}-title`} className="text-xl font-medium">
          Task and answer evidence
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect the domain, reference certificate, and every retained trial.
          Provider diagnostics are not model answers.
        </p>
      </div>
      <div className="max-w-2xl space-y-2">
        <Label htmlFor={`${id}-task`}>Task</Label>
        <NativeSelect
          id={`${id}-task`}
          value={selected.id}
          onChange={(e) => setCase(e.target.value)}
        >
          {cases.map((entry, index) => (
            <NativeSelectOption key={entry.id} value={entry.id}>
              {index + 1} · depth {entry.depth} · {entry.label} · {entry.family}{" "}
              · {entry.id.slice(-8)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-5">
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
        {trials.map((trial) => (
          <details
            key={trial.trialIndex}
            className="rounded-lg border bg-card p-4"
          >
            <summary className="cursor-pointer rounded-md text-sm focus-visible:outline-2 focus-visible:outline-ring">
              Trial {trial.trialIndex + 1} · {trial.outcome}
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
    </section>
  );
}
