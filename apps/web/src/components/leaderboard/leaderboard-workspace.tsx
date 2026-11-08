"use client";

// Public comparison controls expose exact groups, repeated runs and fresh supporting records.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { ComparisonTable } from "./leaderboard-table";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { buildLeaderboard, type LeaderboardGroup } from "@/lib/leaderboard";
import { fetchLeaderboardSummaries } from "@/lib/leaderboard-fetch";
import { adaptRunView } from "@/lib/report-adapter";
import { loadPublicRun } from "@/lib/run-api";
import type { ReportRun } from "@/lib/report-types";

export function LeaderboardWorkspace() {
  const [groups, setGroups] = useState<readonly LeaderboardGroup[] | null>(
      null,
    ),
    [groupKey, setGroupKey] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<readonly string[]>([]),
    [reports, setReports] = useState<readonly ReportRun[]>([]),
    [comparing, setComparing] = useState(false),
    [comparisonError, setComparisonError] = useState<string | null>(null);
  const comparisonAbort = useRef<AbortController | null>(null),
    comparisonSequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeaderboardSummaries(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        const next = buildLeaderboard(value);
        setGroups(next);
        setGroupKey(next[0]?.key ?? "");
        setLoading(false);
        setError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setGroups(null);
          setError(
            "Public comparisons could not be loaded. Check the evaluation service and try again.",
          );
        }
      });
    return () => {
      controller.abort();
      comparisonAbort.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    const futureExpiry = groups
      .flatMap((group) =>
        group.entries.map((entry) => Date.parse(entry.expiresAt)),
      )
      .filter((expiry) => expiry > Date.now());
    const delay = Math.min(
      60000,
      futureExpiry.length === 0
        ? 60000
        : Math.min(...futureExpiry) - Date.now() + 1,
    );
    const timer = setTimeout(
      () => {
        comparisonSequence.current++;
        comparisonAbort.current?.abort();
        comparisonAbort.current = null;
        setSelected([]);
        setReports([]);
        setComparing(false);
        setComparisonError(null);
        setGroups(null);
        setLoading(true);
        setRefresh((value) => value + 1);
      },
      Math.max(1, delay),
    );
    return () => clearTimeout(timer);
  }, [groups]);
  const group = groups?.find((candidate) => candidate.key === groupKey),
    first = group?.entries[0];
  function resetComparison() {
    comparisonSequence.current++;
    comparisonAbort.current?.abort();
    comparisonAbort.current = null;
    setSelected([]);
    setReports([]);
    setComparing(false);
    setComparisonError(null);
  }
  function reload() {
    resetComparison();
    setLoading(true);
    setError(null);
    setGroups(null);
    setRefresh((value) => value + 1);
  }
  async function compare() {
    if (
      !group ||
      selected.length === 0 ||
      comparing ||
      comparisonAbort.current !== null
    )
      return;
    const controller = new AbortController(),
      sequence = ++comparisonSequence.current;
    comparisonAbort.current = controller;
    setComparing(true);
    setReports([]);
    setComparisonError(null);
    try {
      const views = await Promise.all(
        selected.map(async (id) => {
          const run = adaptRunView(await loadPublicRun(id, controller.signal)),
            expected = group.entries.find((entry) => entry.id === id);
          if (
            !expected ||
            run.publishedAt === null ||
            run.id !== id ||
            run.suiteId !== expected.suiteId ||
            run.profileId !== expected.profileId ||
            run.settingsId !== expected.settingsId ||
            run.overall?.macroF1 !== expected.macroF1 ||
            run.overall.population.status !== "complete"
          )
            throw new Error();
          return run;
        }),
      );
      if (!controller.signal.aborted && sequence === comparisonSequence.current)
        setReports(views);
    } catch {
      if (!controller.signal.aborted && sequence === comparisonSequence.current)
        setComparisonError(
          "The selected public evidence could not be loaded. Publication may have been withdrawn or expired. Refresh the listing before comparing again.",
        );
    } finally {
      if (
        !controller.signal.aborted &&
        sequence === comparisonSequence.current
      ) {
        setComparing(false);
        comparisonAbort.current = null;
      }
    }
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-medium sm:text-4xl">
            Public model comparisons
          </h1>
          <p className="text-muted-foreground">
            Compare published runs within the same tasks, prompt, reasoning
            profile and execution settings. Every score links to its retained
            answers and mathematical references.
          </p>
        </div>
        <Button variant="outline" onClick={reload} disabled={loading}>
          Refresh publications
        </Button>
      </div>
      <div className="max-w-4xl space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Each model is represented by its earliest eligible currently published
          run in a comparison group. Other publications remain inspectable.
          Private and withdrawn runs are unknown; publication selection bias
          remains possible. Active listings refresh at least once a minute and
          at known evidence expiry.
        </p>
        <p>
          Exact scores share ranks when tied. Small score differences and
          three-trial ranges do not establish statistical superiority. Depth is
          confounded with function family in the challenge suite.
        </p>
      </div>
      {loading && (
        <p role="status" className="rounded-xl border bg-card p-6 text-sm">
          Loading published evidence…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-card p-6"
        >
          <p>{error}</p>
          <Button className="mt-4" variant="outline" onClick={reload}>
            Try again
          </Button>
        </div>
      )}
      {!loading && !error && groups?.length === 0 && (
        <section className="rounded-xl border bg-card p-8">
          <h2 className="text-lg font-medium">No published evaluations yet</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Run an evaluation with your own provider key, inspect its evidence,
            then choose whether to publish it. A ranked entry needs a complete
            three-trial population, stable reported identity and verified
            execution limits.
          </p>
          <Link
            className="mt-5 inline-flex text-sm font-medium text-primary underline underline-offset-4"
            href="/evaluate"
          >
            Create an evaluation
          </Link>
        </section>
      )}
      {!loading && !error && group && first && (
        <>
          <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
            <div className="max-w-3xl space-y-2">
              <Label htmlFor="comparison-group">Comparison group</Label>
              <NativeSelect
                id="comparison-group"
                value={groupKey}
                onChange={(event) => {
                  resetComparison();
                  setGroupKey(event.target.value);
                }}
              >
                {groups!.map((candidate, index) => {
                  const entry = candidate.entries[0];
                  return (
                    <NativeSelectOption
                      key={candidate.key}
                      value={candidate.key}
                    >
                      {index + 1}. {entry.suiteKey} · {entry.profileId} ·
                      concurrency {entry.concurrency} ·{" "}
                      {candidate.entries.length} publications
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>{first.caseCount} functions × 3 trials</span>
              <span>Depths {first.depths.join(", ")}</span>
              <span>Output cap {first.maxOutputTokens || "unavailable"}</span>
              <span>
                {first.population === "screening"
                  ? "Exploratory screening · unranked"
                  : first.population === "exploratory"
                    ? "Exploratory population · unranked"
                  : first.population}
              </span>
            </div>
            <details className="text-xs leading-5">
              <summary className="cursor-pointer text-muted-foreground">
                Full comparison identity
              </summary>
              <dl className="mt-3 space-y-2 font-mono">
                <div>
                  <dt className="font-sans text-muted-foreground">Suite</dt>
                  <dd className="break-all">{first.suiteId}</dd>
                </div>
                <div>
                  <dt className="font-sans text-muted-foreground">Settings</dt>
                  <dd className="break-all">{first.settingsId}</dd>
                </div>
              </dl>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                {JSON.stringify(JSON.parse(group.key), null, 2)}
              </pre>
            </details>
            <ComparisonTable
              entries={group.entries}
              selected={selected}
              disabled={comparing}
              onSelect={(id, checked) => {
                setSelected((ids) =>
                  checked ? [...ids, id] : ids.filter((value) => value !== id),
                );
                setReports([]);
                setComparisonError(null);
              }}
            />
            {group.entries.every((entry) => entry.rank === null) && (
              <p className="text-sm text-muted-foreground">
                This group has no ranked entries. Inspect each run’s eligibility
                details; observed scores remain visible without assigning a
                rank.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void compare()}
                disabled={selected.length === 0 || comparing}
              >
                {comparing ? "Loading comparison…" : "Inspect selected runs"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {selected.length}/4 selected · full public records are loaded
                fresh
              </span>
            </div>
            {comparisonError && (
              <p role="alert" className="text-sm text-destructive">
                {comparisonError}
              </p>
            )}
          </section>
          {reports.length > 0 && (
            <section aria-label="Selected published run comparison">
              <ResultsDashboard runs={reports} />
            </section>
          )}
        </>
      )}
      <section className="border-t pt-6 text-sm leading-6 text-muted-foreground">
        <h2 className="font-medium text-foreground">
          What qualifies for ranking
        </h2>
        <p className="mt-2 max-w-4xl">
          Published and unexpired evidence must account for all three trials of
          every function, with a complete scorer report and no infrastructure
          failures. Invalid answers, refusals and truncated replies remain model
          outcomes in the denominator. A stable reported model, verified output
          cap, context handling and any requested native schema are required.
          Routed providers also need stable serving identity. Screening runs
          stay unranked.
        </p>
        <Link
          className="mt-3 inline-flex text-primary underline underline-offset-4"
          href="/methodology"
        >
          Read the evaluation methodology
        </Link>
      </section>
    </div>
  );
}
