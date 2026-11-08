"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { RunSuiteKey } from "@/lib/run-api";
import type { EvaluationWorkspaceController } from "./workspace-controller";

export function WorkspaceConfiguration({
  workspace: w,
}: {
  workspace: EvaluationWorkspaceController;
}) {
  const id = useId(),
    policy = w.configuration?.policy;
  const trials =
    w.suite && policy ? w.suite.caseCount * policy.trialsPerInstance : null;
  const requests =
    trials !== null && policy ? trials * policy.attemptsPerTrial : null;
  const outputCeiling =
    requests !== null && w.profile
      ? requests * w.profile.maxOutputTokens
      : null;
  return (
    <Card aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle id={`${id}-title`} role="heading" aria-level={2}>
          Evaluation workload
        </CardTitle>
        <p className="text-sm leading-5 text-muted-foreground">
          Review the task population and request limits before starting.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {w.configurationLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading verified suite descriptions…
          </p>
        )}
        {w.configurationError && (
          <div role="alert" className="space-y-3 text-sm">
            <p className="text-destructive">{w.configurationError}</p>
            <Button
              type="button"
              variant="outline"
              disabled={w.configurationLoading || w.busy}
              onClick={w.retryConfiguration}
            >
              Retry workload settings
            </Button>
          </div>
        )}
        <fieldset
          disabled={w.busy || w.configuration === null}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-suite`}>Evaluation suite</Label>
            <NativeSelect
              id={`${id}-suite`}
              value={w.suiteKey}
              onChange={(e) => w.changeSuite(e.target.value as RunSuiteKey)}
            >
              {!w.suite && (
                <NativeSelectOption value="">
                  Choose a verified suite
                </NativeSelectOption>
              )}
              {w.configuration?.suites.map((suite) => (
                <NativeSelectOption key={suite.key} value={suite.key}>
                  {suite.name}
                  {suite.recommended ? " · recommended" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {w.suite && (
              <p className="text-sm leading-6 text-muted-foreground">
                {w.suite.description}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-concurrency`}>Concurrent trials</Label>
            <NativeSelect
              id={`${id}-concurrency`}
              value={w.concurrency}
              onChange={(e) => w.changeConcurrency(Number(e.target.value))}
            >
              {Array.from(
                { length: policy?.maxConcurrency ?? 0 },
                (_, index) => index + 1,
              ).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs leading-5 text-muted-foreground">
              The concurrency limit controls simultaneous trials. Provider
              limits may be lower.
            </p>
          </div>
        </fieldset>
        {w.suite && policy && (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt>Verified tasks</dt>
              <dd className="font-mono">{w.suite.caseCount}</dd>
              <dt>Measured depths</dt>
              <dd className="font-mono">{w.suite.depths.join(", ")}</dd>
              <dt>Trials per task</dt>
              <dd className="font-mono">{policy.trialsPerInstance}</dd>
              <dt>Attempts per trial</dt>
              <dd className="font-mono">{policy.attemptsPerTrial}</dd>
              <dt>Maximum inference requests</dt>
              <dd className="font-mono">{requests}</dd>
              <dt>Automatic retries</dt>
              <dd className="font-mono">{policy.retries}</dd>
              <dt>Output cap per attempt</dt>
              <dd className="font-mono">
                {w.profile
                  ? `${w.profile.maxOutputTokens.toLocaleString()} tokens`
                  : "Choose a profile"}
              </dd>
              <dt>Maximum requested output</dt>
              <dd className="font-mono">
                {outputCeiling === null
                  ? "Unavailable"
                  : `${outputCeiling.toLocaleString()} tokens`}
              </dd>
              <dt>Reasoning method</dt>
              <dd>One-shot, fresh trials</dd>
              <dt>Reasoning setting</dt>
              <dd>{w.profile?.reasoning ?? "Choose a profile"}</dd>
              <dt>Generator / instructions</dt>
              <dd className="break-all font-mono">
                {w.suite.generatorVersion} / {w.suite.promptVersion}
              </dd>
              <dt>Visibility</dt>
              <dd>Private until published</dd>
            </dl>
            <details className="rounded-lg border p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer py-1 font-medium text-foreground">
                Suite identity
              </summary>
              <p className="mt-3 break-all font-mono">{w.suite.suiteId}</p>
              <p className="mt-2 leading-5">
                This is the catalog identity for the prompted-JSON version-1
                profile. Other answer profiles receive a separately verified
                suite identity during preparation, shown with the retained run.
              </p>
            </details>
          </>
        )}
        <div className="space-y-4 border-t pt-5">
          <p className="text-sm leading-6 text-muted-foreground">
            A compatibility probe is optional. Each evaluation trial refreshes
            model metadata and permission checks. Unknown or unsupported
            settings remain visible as failures.
          </p>
          <div className="flex items-start gap-3">
            <input
              id={`${id}-charges`}
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-accent"
              checked={w.acceptCharges}
              disabled={!w.runnable || w.busy || w.privateAction !== null}
              onChange={(e) => w.setAcceptCharges(e.target.checked)}
            />
            <Label
              htmlFor={`${id}-charges`}
              className="block text-sm leading-6 font-normal"
            >
              I approve up to {requests ?? "the displayed number of"} inference
              requests using my provider credential and accept the associated
              provider charges. Token caps are not currency limits.
            </Label>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!w.canLaunch}
            onClick={() => void w.launch()}
          >
            {w.phase === "starting" && w.streaming
              ? "Preparing evaluation…"
              : w.streaming
                ? "Evaluation in progress"
                : "Start evaluation"}
          </Button>
          {!w.runnable && !w.configurationLoading && (
            <p className="text-xs leading-5 text-muted-foreground">
              Enter a provider credential, an explicit model and serving route
              where required, and a permitted answer profile. Resolve any
              blocked selection before starting.
            </p>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            Keep this page open. Navigation or refresh interrupts the foreground
            connection; completed evidence is retained, but work cannot be
            resumed. Metadata checks also make service requests. No model
            substitution or automatic retry occurs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
