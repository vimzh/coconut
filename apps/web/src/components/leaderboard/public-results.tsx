"use client";

// Anonymous result access loads only an explicitly published, unexpired run.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { adaptRunView } from "@/lib/report-adapter";
import type { ReportRun } from "@/lib/report-types";
import { loadPublicRun, parseRunViewMeta, RunApiError } from "@/lib/run-api";

export function PublicResults({ id }: { id: string }) {
  const [run, setRun] = useState<ReportRun | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadPublicRun(id, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        const next = adaptRunView(value),
          expiry = Date.parse(parseRunViewMeta(value).expiresAt);
        if (next.id !== id || next.publishedAt === null || expiry <= Date.now())
          throw new Error();
        setExpiresAt(expiry);
        setRun(next);
        setLoading(false);
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setRun(null);
        setLoading(false);
        setError(
          reason instanceof RunApiError &&
            (reason.status === 404 || reason.code === "invalid-input")
            ? "This public run is unavailable. It may be private, withdrawn, expired or deleted."
            : "The public result could not be loaded. Check the evaluation service and try again.",
        );
      });
    return () => controller.abort();
  }, [id, refresh]);
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setTimeout(
      () => {
        setRun(null);
        setLoading(false);
        setError(
          "This public run is unavailable. Its supporting evidence has expired.",
        );
      },
      Math.max(1, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/leaderboard"
          className="text-sm text-primary underline underline-offset-4"
        >
          Public comparisons
        </Link>
        <h1 className="text-3xl font-medium sm:text-4xl">
          Published evaluation
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Inspect the observed score, complete trial population and mathematical
          references. Publication can be withdrawn by the run’s access-code
          holder; retained evidence expires after seven days.
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {id}
        </p>
      </div>
      {loading && (
        <p role="status" className="rounded-xl border bg-card p-6 text-sm">
          Loading public evidence…
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-xl border bg-card p-6">
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setLoading(true);
              setError(null);
              setRun(null);
              setRefresh((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {run && <ResultsDashboard runs={[run]} />}
    </div>
  );
}
