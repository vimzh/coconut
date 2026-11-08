import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvaluationWorkspaceController } from "./workspace-controller";

const stateNames = {
  running: "Running",
  cancelling: "Cancellation settling",
  completed: "Run completed",
  cancelled: "Cancellation settled",
  "timed-out": "Run deadline reached",
  failed: "Run failed",
  interrupted: "Run interrupted",
} as const;

export function WorkspaceProgress({
  workspace: w,
}: {
  workspace: EvaluationWorkspaceController;
}) {
  if (w.phase === "idle" && !w.handle && !w.streamError) return null;
  const title =
    w.phase === "starting" && w.streaming
      ? "Preparing verified tasks"
      : w.phase === "disconnected"
        ? "Connection interrupted"
        : w.cancellation === "requested" || w.cancellation === "requesting"
          ? "Cancellation requested"
          : w.runState
            ? stateNames[w.runState]
            : "Run status";
  const canCancel =
    Boolean(w.handle) &&
    (w.runState === "running" || w.runState === "cancelling") &&
    w.phase !== "starting";
  return (
    <Card aria-label="Run progress">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle role="heading" aria-level={2}>
            {title}
          </CardTitle>
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={
                w.privateAction !== null ||
                w.cancellation === "requested" ||
                w.cancellation === "requesting"
              }
              onClick={() => void w.requestCancellation()}
            >
              {w.cancellation === "requesting"
                ? "Requesting cancellation…"
                : "Request cancellation"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {w.progress ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm">Finished trials</p>
              <p className="font-mono text-xl">
                {w.progress.finishedTrials} / {w.progress.plannedTrials}
              </p>
            </div>
            <progress
              className="h-2 w-full accent-accent"
              value={w.progress.finishedTrials}
              max={w.progress.plannedTrials}
              aria-label="Finished trials out of planned trials"
            />
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                ["Active", w.progress.activeTrials],
                [
                  "Inactive remaining",
                  w.progress.remainingTrials - w.progress.activeTrials,
                ],
                ["Remaining", w.progress.remainingTrials],
                ["Not started", w.progress.plannedTrials - w.progress.startedTrials],
                ["Returned model outcomes", w.progress.modelOutcomes],
                ["Infrastructure failures", w.progress.infrastructureFailures],
                ["Inference requests", w.progress.inferenceRequests],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-lg">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">
              Remaining includes active trials. Inactive remaining may include interrupted work without a retained outcome. Finished counts include model
              outcomes and infrastructure failures.{" "}
              {w.streaming
                ? "Counts come from the open run stream."
                : "Counts are the last retained snapshot; refresh the record to check settlement."}
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            The service is verifying the selected tasks and preparing the
            planned population. No progress count has been received yet.
          </p>
        )}
        {w.preparedSuiteId && (
          <p className="break-all text-xs text-muted-foreground">
            Prepared suite:{" "}
            <span className="font-mono">{w.preparedSuiteId}</span>
          </p>
        )}
        {w.cancellation === "not-active" && (
          <p role="status" className="text-sm">
            No active run was available to cancel. Refresh the retained record
            to inspect its outcome.
          </p>
        )}
        {w.cancellation === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            Cancellation could not be confirmed. Keep the access code and
            inspect the retained record before starting another paid run.
          </p>
        )}
        {(w.cancellation === "requested" ||
          w.phase === "disconnected" ||
          w.runState === "cancelled" ||
          w.runState === "interrupted") && (
          <p className="text-sm leading-6 text-muted-foreground">
            Cancellation stops new local work and requests termination of active
            calls. Remote computation or provider charges already started may
            remain uncertain. Completed evidence is retained.
          </p>
        )}
        {w.streamError && (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {w.streamError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
