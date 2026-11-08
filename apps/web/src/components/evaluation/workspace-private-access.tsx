"use client";

// Private capability controls never share their code with result views or public links.
import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EvaluationWorkspaceController } from "./workspace-controller";

export function WorkspacePrivateAccess({
  workspace: w,
}: {
  workspace: EvaluationWorkspaceController;
}) {
  const id = useId(),
    [reveal, setReveal] = useState(false),
    [confirmation, setConfirmation] = useState<"publish" | "delete" | null>(
      null,
    );
  if (!w.handle) return null;
  const pending = w.privateAction !== null,
    published = Boolean(w.currentRun?.publishedAt);
  return (
    <Card aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle id={`${id}-title`} role="heading" aria-level={2}>
          Private run access
        </CardTitle>
        <p className="break-all font-mono text-xs text-muted-foreground">
          Run {w.handle.id}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Save this run ID and access code before refreshing, opening another
          run, or starting another evaluation. The provider key cannot reopen a
          private result.
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${id}-code`}>Private access code</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-code`}
              type={reveal ? "text" : "password"}
              value={w.handle.accessCode}
              readOnly
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setReveal((value) => !value)}
              aria-controls={`${id}-code`}
              aria-pressed={reveal}
            >
              {reveal ? "Hide" : "Reveal"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void w.copyAccess()}
          >
            Copy access code
          </Button>
          <Button type="button" variant="outline" onClick={w.saveAccess}>
            Save private access file
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Anyone with this code can access, export, publish, or delete the run.
          It stays in this page’s memory unless you explicitly copy or save it.
          The access file contains the code; evidence exports do not.
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Expires {new Date(w.handle.expiresAt).toLocaleString()}. Retention is
          seven days; deletion or expiry removes the private record and public
          visibility.
        </p>
        <div className="flex flex-wrap gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending || w.streaming}
            onClick={() => void w.refresh()}
          >
            {w.privateAction === "refresh"
              ? "Refreshing…"
              : "Refresh retained record"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || w.streaming}
            onClick={() => void w.downloadExport()}
          >
            {w.privateAction === "export"
              ? "Preparing export…"
              : "Download retained evidence"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Downloads contain the actual retained record, including partial work.
          Provider keys and private access codes are excluded. Large records may
          be downloadable even when they exceed the browser’s reporting limit.
        </p>
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm">
            Visibility:{" "}
            <span className="font-medium">
              {published ? "Public" : "Private"}
            </span>
          </p>
          {published && (
            <Link
              href={`/results/${w.handle.id}`}
              className="inline-flex rounded-md text-sm text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Open public result
            </Link>
          )}
          {confirmation ? (
            <div
              role="group"
              aria-labelledby={`${id}-confirmation`}
              className="space-y-4 rounded-lg border p-4"
            >
              <p id={`${id}-confirmation`} className="text-sm leading-6">
                {confirmation === "publish"
                  ? "Publish this complete run? Its tasks, reference labels, model answers, provider and model identity, settings, and scores will be publicly readable. Publication can be revoked; leaderboard qualification is assessed separately."
                  : "Delete this retained run? This removes its private and public evidence permanently. Provider charges are unchanged."}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {w.handle.id}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  autoFocus
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmation(null)}
                >
                  Keep current state
                </Button>
                <Button
                  type="button"
                  variant={
                    confirmation === "delete" ? "destructive" : "default"
                  }
                  disabled={pending}
                  onClick={async () => {
                    const success =
                      confirmation === "publish"
                        ? await w.publication(true)
                        : await w.remove();
                    if (success) setConfirmation(null);
                  }}
                >
                  {pending
                    ? "Applying change…"
                    : confirmation === "publish"
                      ? "Confirm publication"
                      : "Confirm deletion"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {published ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || w.busy}
                  onClick={() => void w.publication(false)}
                >
                  {w.privateAction === "revoke"
                    ? "Revoking publication…"
                    : "Make private"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !w.publishable || w.busy}
                  onClick={() => setConfirmation("publish")}
                >
                  Publish complete run
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={pending || w.busy}
                onClick={() => setConfirmation("delete")}
              >
                Delete retained run
              </Button>
            </div>
          )}
          {!published && !w.publishable && (
            <p className="text-xs leading-5 text-muted-foreground">
              Publication is available only after the run completes with a
              complete observed model population.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceSavedRun({
  workspace: w,
}: {
  workspace: EvaluationWorkspaceController;
}) {
  const id = useId(),
    [runId, setRunId] = useState(""),
    [accessCode, setAccessCode] = useState("");
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer rounded-md py-1 text-base font-medium focus-visible:outline-2 focus-visible:outline-ring">
        Open a saved private run
      </summary>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const success = await w.openSaved(runId, accessCode);
          if (success) setAccessCode("");
        }}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Enter the run ID and its private access code. No provider credential
          is required. Saved work can be inspected but cannot be resumed.
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${id}-run`}>Run ID</Label>
          <Input
            id={`${id}-run`}
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={w.streaming || w.privateAction !== null}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-access`}>Private access code</Label>
          <Input
            id={`${id}-access`}
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={w.streaming || w.privateAction !== null}
            className="font-mono"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={
            w.streaming ||
            w.privateAction !== null ||
            runId.trim() === "" ||
            accessCode === ""
          }
        >
          {w.privateAction === "open" ? "Opening saved run…" : "Open saved run"}
        </Button>
      </form>
    </details>
  );
}
