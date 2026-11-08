"use client";

// The visitor journey keeps foreground execution, private access, and measured results distinct.
import { ProviderSetup } from "./provider-setup";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { useEvaluationWorkspace } from "./workspace-controller";
import { WorkspaceConfiguration } from "./workspace-configuration";
import {
  WorkspacePrivateAccess,
  WorkspaceSavedRun,
} from "./workspace-private-access";
import { WorkspaceProgress } from "./workspace-progress";

export function EvaluationWorkspace() {
  const w = useEvaluationWorkspace();
  const retainedCurrent = w.currentRun !== null && !w.streaming;
  return (
    <div className="min-w-0 space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl leading-tight font-medium sm:text-4xl">
          Evaluation workbench
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Connect a provider, approve a bounded task population, then inspect
          every answer and score. Your evaluations remain private until you
          publish them.
        </p>
      </div>
      <WorkspaceProgress workspace={w} />
      {w.handle && (
        <p className="text-sm leading-6 text-muted-foreground">
          Save this run’s private access code before leaving this page.{" "}
          <a
            href="#run-access"
            className="rounded-md text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Private access, exports, and publication
          </a>
        </p>
      )}
      {w.notice && (
        <p
          role="status"
          className="rounded-lg border bg-card p-4 text-sm leading-6"
        >
          {w.notice}
        </p>
      )}
      {w.recordError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-card p-4 text-sm leading-6 text-destructive"
        >
          {w.recordError}
        </p>
      )}
      {retainedCurrent && (
        <ResultsDashboard key={w.currentRun!.id} runs={w.views} />
      )}
      {!w.handle && <WorkspaceSavedRun workspace={w} />}
      {w.handle && !retainedCurrent && (
        <div
          id="run-access"
          className="grid min-w-0 scroll-mt-6 gap-6 xl:grid-cols-2"
        >
          <WorkspacePrivateAccess key={w.handle.id} workspace={w} />
          <WorkspaceSavedRun workspace={w} />
        </div>
      )}
      <details
        open={w.showSetup}
        onToggle={(event) => w.setShowSetup(event.currentTarget.open)}
        className="space-y-5"
      >
        <summary className="cursor-pointer rounded-lg py-2 text-lg font-medium focus-visible:outline-2 focus-visible:outline-ring">
          {retainedCurrent
            ? "Configure another evaluation"
            : "Configure evaluation"}
        </summary>
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(304px,0.8fr)_minmax(0,1.2fr)]">
          <ProviderSetup
            state={w.provider}
            onChange={w.changeProvider}
            disabled={w.busy}
            onSelection={w.setSelection}
            onDisconnect={w.disconnect}
          />
          <WorkspaceConfiguration workspace={w} />
        </div>
      </details>
      {w.handle && retainedCurrent && (
        <div
          id="run-access"
          className="grid min-w-0 scroll-mt-6 gap-6 xl:grid-cols-2"
        >
          <WorkspacePrivateAccess key={w.handle.id} workspace={w} />
          <WorkspaceSavedRun workspace={w} />
        </div>
      )}
      {!w.currentRun && !w.streaming && w.views.length > 0 && (
        <details className="space-y-5 rounded-xl border bg-card p-5">
          <summary className="cursor-pointer rounded-md py-1 text-lg font-medium focus-visible:outline-2 focus-visible:outline-ring">
            Previously inspected results
          </summary>
          <ResultsDashboard runs={w.views} />
        </details>
      )}
      {!w.handle && !w.streaming && w.views.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-sm leading-6 text-muted-foreground">
          No evaluation has been launched from this page. Enter your provider
          settings or open a saved run to inspect retained evidence.
        </div>
      )}
    </div>
  );
}
