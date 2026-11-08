"use client";

// Coordinates the foreground connection separately from private retained-run access.
import { useEffect, useRef, useState } from "react";
import { loadProviderModelPolicy, ProviderApiError } from "@/lib/provider-api";
import type {
  ProviderModelPolicy,
  ProviderSelectionResult,
  ProviderSetupState,
} from "@/lib/provider-types";
import { adaptRunView, ReportInputError } from "@/lib/report-adapter";
import type { ReportRun } from "@/lib/report-types";
import {
  cancelRun,
  deleteRun,
  exportRun,
  loadPrivateRun,
  loadRunPolicy,
  loadRunSuites,
  parseRunViewMeta,
  RunApiError,
  setRunPublication,
  startRun,
} from "@/lib/run-api";
import type {
  RunEvent,
  RunPolicy,
  RunProgress,
  RunState,
  RunSuiteDescription,
  RunSuiteKey,
} from "@/lib/run-api";

export interface PrivateRunHandle {
  id: string;
  accessCode: string;
  expiresAt: string;
}
export type WorkspacePhase =
  "idle" | "starting" | "streaming" | "settled" | "disconnected";
type PrivateAction =
  "open" | "refresh" | "export" | "publish" | "revoke" | "delete" | "cancel";
export type CancellationState =
  "idle" | "requesting" | "requested" | "not-active" | "failed";

function message(error: unknown, action?: PrivateAction): string {
  if (error instanceof RunApiError) {
    if (error.status === 401 || error.status === 404)
      return "The run is unavailable, expired, or the private access code is incorrect. Check the saved run ID and code.";
    if (error.status === 409 && action === "publish")
      return "This run is not eligible for publication. It must finish with a complete observed population.";
    if (error.status === 409 && action === "delete")
      return "The run is still active and cancellation was requested. Wait for settlement, refresh the record, then delete it.";
    return error.message;
  }
  if (error instanceof ProviderApiError || error instanceof ReportInputError)
    return error.message;
  return "The operation could not be completed. Inspect the retained record before starting another paid run.";
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useEvaluationWorkspace() {
  const [provider, setProvider] = useState<ProviderSetupState>({
    provider: "openai",
    credential: "",
    modelId: "",
    servingProvider: null,
    profileId: "one-shot-json-v1",
  });
  const [selection, setSelection] = useState<ProviderSelectionResult | null>(
    null,
  );
  const [configuration, setConfiguration] = useState<{
    policy: RunPolicy;
    suites: readonly RunSuiteDescription[];
    models: ProviderModelPolicy;
  } | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(
      null,
    ),
    [configurationLoading, setConfigurationLoading] = useState(true),
    [configurationAttempt, setConfigurationAttempt] = useState(0);
  const [suiteKey, setSuiteKey] = useState<RunSuiteKey | "">(""),
    [concurrency, setConcurrency] = useState(4),
    [acceptCharges, setAcceptCharges] = useState(false);
  const [phase, setPhase] = useState<WorkspacePhase>("idle"),
    [streaming, setStreaming] = useState(false),
    [runState, setRunState] = useState<RunState | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null),
    [handle, setHandle] = useState<PrivateRunHandle | null>(null),
    [preparedSuiteId, setPreparedSuiteId] = useState<string | null>(null);
  const [views, setViews] = useState<readonly ReportRun[]>([]),
    [privateAction, setPrivateAction] = useState<PrivateAction | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null),
    [recordError, setRecordError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [cancellation, setCancellation] = useState<CancellationState>("idle"),
    [showSetup, setShowSetup] = useState(true);
  const mounted = useRef(true),
    streamController = useRef<AbortController | null>(null),
    controllers = useRef(new Set<AbortController>());
  const handleRef = useRef<PrivateRunHandle | null>(null),
    activeHandle = useRef<PrivateRunHandle | null>(null),
    actionLock = useRef(false),
    terminalSeen = useRef(false),
    launchSequence = useRef(0),
    viewGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    const pending = controllers.current;
    return () => {
      mounted.current = false;
      streamController.current?.abort();
      for (const controller of pending) controller.abort();
      pending.clear();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      loadRunPolicy(controller.signal),
      loadRunSuites(controller.signal),
      loadProviderModelPolicy(controller.signal),
    ])
      .then(([policy, suites, models]) => {
        if (controller.signal.aborted) return;
        setConfiguration({ policy, suites, models });
        setConfigurationError(null);
        setSuiteKey(
          (current) =>
            current ||
            suites.find((suite) => suite.recommended)?.key ||
            suites[0]?.key ||
            "",
        );
        setConcurrency(policy.defaultConcurrency);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setConfigurationError(message(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setConfigurationLoading(false);
      });
    return () => controller.abort();
  }, [configurationAttempt]);

  const suite = configuration?.suites.find((entry) => entry.key === suiteKey),
    profile = configuration?.models.profiles.find(
      (entry) => entry.id === provider.profileId,
    );
  const currentRun = views.find((entry) => entry.id === handle?.id) ?? null;
  const knownActive =
    !streaming &&
    (runState === "running" || runState === "cancelling") &&
    handle !== null;
  const busy = streaming || knownActive;
  const runnable =
    configuration !== null &&
    !configurationLoading &&
    suite !== undefined &&
    suite.caseCount <= configuration.policy.maxCases &&
    concurrency >= 1 &&
    concurrency <= configuration.policy.maxConcurrency &&
    profile !== undefined &&
    provider.credential !== "" &&
    provider.modelId.trim() !== "" &&
    (provider.provider === "openai" ||
      Boolean(provider.servingProvider?.trim())) &&
    (provider.provider === "openai" ||
      profile.reasoning === "provider-default") &&
    selection?.status !== "blocked";
  const canLaunch =
    runnable && !busy && privateAction === null && acceptCharges;
  const publishable =
    currentRun?.state === "completed" &&
    currentRun.overall?.population.status === "complete" &&
    progress?.activeTrials === 0 &&
    progress.finishedTrials === progress.plannedTrials;

  function rememberHandle(next: PrivateRunHandle) {
    handleRef.current = next;
    setHandle(next);
  }
  function changeProvider(next: ProviderSetupState) {
    setProvider(next);
    setSelection(null);
    setAcceptCharges(false);
  }
  function changeSuite(next: RunSuiteKey) {
    setSuiteKey(next);
    setAcceptCharges(false);
  }
  function changeConcurrency(next: number) {
    setConcurrency(next);
    setAcceptCharges(false);
  }
  function retryConfiguration() {
    setConfiguration(null);
    setAcceptCharges(false);
    setConfigurationLoading(true);
    setConfigurationError(null);
    setConfigurationAttempt((attempt) => attempt + 1);
  }

  async function readView(target: PrivateRunHandle, signal?: AbortSignal) {
    const raw = await loadPrivateRun(target.id, target.accessCode, signal),
      meta = parseRunViewMeta(raw),
      run = adaptRunView(raw);
    if (meta.id !== target.id || run.id !== target.id)
      throw new RunApiError("unexpected-response");
    return { run, meta };
  }
  function acceptView(
    target: PrivateRunHandle,
    value: Awaited<ReturnType<typeof readView>>,
  ) {
    rememberHandle({ ...target, expiresAt: value.meta.expiresAt });
    setViews((current) => [
      value.run,
      ...current.filter((entry) => entry.id !== value.run.id),
    ]);
    setProgress(value.meta.progress);
    setRunState(value.meta.state);
    setPreparedSuiteId(value.run.suiteId);
    setRecordError(null);
    if (value.meta.state !== "running" && value.meta.state !== "cancelling") {
      setCancellation("idle");
      setPhase("settled");
    }
    if (value.run.reportId !== null) setShowSetup(false);
  }
  async function privateOperation(
    action: PrivateAction,
    work: (signal: AbortSignal) => Promise<void>,
  ) {
    if (
      actionLock.current ||
      (streamController.current !== null && action !== "cancel")
    )
      return false;
    if (action !== "export" && action !== "cancel") viewGeneration.current++;
    actionLock.current = true;
    setPrivateAction(action);
    setRecordError(null);
    setNotice(null);
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      await work(controller.signal);
      return true;
    } catch (error) {
      if (mounted.current) setRecordError(message(error, action));
      return false;
    } finally {
      controllers.current.delete(controller);
      if (mounted.current) setPrivateAction(null);
      actionLock.current = false;
    }
  }
  async function refresh() {
    const target = handleRef.current;
    if (!target) return;
    await privateOperation("refresh", async (signal) => {
      const value = await readView(target, signal);
      if (mounted.current) {
        acceptView(target, value);
        setNotice("Retained record refreshed");
      }
    });
  }
  async function openSaved(id: string, accessCode: string) {
    if (streamController.current) return false;
    const target = { id: id.trim(), accessCode, expiresAt: "" };
    return privateOperation("open", async (signal) => {
      const value = await readView(target, signal);
      if (!mounted.current) return;
      acceptView(target, value);
      setPhase("settled");
      setStreamError(null);
      setCancellation("idle");
      setNotice("Saved run opened. No provider credential was used.");
    });
  }
  async function requestCancellation() {
    if (actionLock.current) return;
    const target = streamController.current
      ? activeHandle.current
      : handleRef.current;
    if (!target) return;
    setCancellation("requesting");
    const success = await privateOperation("cancel", async (signal) => {
      const result = await cancelRun(target.id, target.accessCode, signal);
      if (!mounted.current) return;
      setCancellation(
        terminalSeen.current
          ? "idle"
          : result.cancellationRequested
            ? "requested"
            : "not-active",
      );
      if (!streamController.current)
        acceptView(target, await readView(target, signal));
    });
    if (!success && mounted.current) setCancellation("failed");
  }
  function disconnect() {
    setProvider((current) => ({ ...current, credential: "" }));
    setSelection(null);
    setAcceptCharges(false);
    if (streamController.current && !terminalSeen.current) {
      if (activeHandle.current) void requestCancellation();
      setPhase("disconnected");
      setNotice(
        "Disconnected. Cancellation was requested where a run ID was available; dispatched work and provider charges may remain uncertain. Refresh the private record to inspect settlement.",
      );
    } else if (knownActive) void requestCancellation();
    streamController.current?.abort();
  }

  async function launch() {
    if (
      streamController.current ||
      actionLock.current ||
      !canLaunch ||
      !suite ||
      !profile ||
      !configuration
    )
      return;
    const controller = new AbortController(),
      sequence = ++launchSequence.current;
    const generation = ++viewGeneration.current;
    streamController.current = controller;
    activeHandle.current = null;
    terminalSeen.current = false;
    setStreaming(true);
    setPhase("starting");
    setRunState(null);
    setProgress(null);
    setPreparedSuiteId(null);
    setStreamError(null);
    setRecordError(null);
    setNotice(null);
    setCancellation("idle");
    setAcceptCharges(false);
    const request = {
      suiteKey: suite.key,
      provider: provider.provider,
      modelId: provider.modelId,
      servingProvider:
        provider.provider === "openai" ? null : provider.servingProvider,
      profileId: profile.id,
      concurrency,
      acceptCharges: true as const,
    };
    const onEvent = (event: RunEvent) => {
      if (
        !mounted.current ||
        sequence !== launchSequence.current ||
        controller.signal.aborted
      )
        return;
      if (event.type === "heartbeat") return;
      if (event.type === "started") {
        const target = {
          id: event.runId,
          accessCode: event.accessCode,
          expiresAt: event.expiresAt,
        };
        activeHandle.current = target;
        rememberHandle(target);
        setProgress(event.progress);
        setRunState("running");
        setPhase("streaming");
        const identityController = new AbortController();
        controllers.current.add(identityController);
        void readView(target, identityController.signal)
          .then((value) => {
            if (
              mounted.current &&
              sequence === launchSequence.current &&
              generation === viewGeneration.current &&
              handleRef.current?.id === target.id
            )
              setPreparedSuiteId(value.run.suiteId);
          })
          .catch((error: unknown) => {
            if (
              mounted.current &&
              sequence === launchSequence.current &&
              generation === viewGeneration.current &&
              handleRef.current?.id === target.id &&
              !identityController.signal.aborted
            )
              setRecordError(
                `The prepared suite identity could not be read. ${message(error)}`,
              );
          })
          .finally(() => controllers.current.delete(identityController));
      } else if (event.type === "progress") {
        setProgress(event.progress);
        setRunState(event.state);
      } else if (event.type === "finished") {
        terminalSeen.current = true;
        setProgress(event.progress);
        setRunState(event.state);
        setCancellation("idle");
        setPhase("settled");
      } else {
        terminalSeen.current = true;
        setStreamError(event.message);
        setPhase("settled");
      }
    };
    try {
      await startRun(request, provider.credential, onEvent, controller.signal);
    } catch (error) {
      if (mounted.current && sequence === launchSequence.current) {
        setStreamError(message(error));
        if (!terminalSeen.current) setPhase("disconnected");
      }
    } finally {
      if (streamController.current === controller)
        streamController.current = null;
      if (mounted.current && sequence === launchSequence.current) {
        setStreaming(false);
        // Stream callbacks update this ref during the awaited connection.
        const target = activeHandle.current as PrivateRunHandle | null;
        if (target) {
          const recordController = new AbortController();
          controllers.current.add(recordController);
          try {
            const value = await readView(target, recordController.signal);
            if (
              mounted.current &&
              sequence === launchSequence.current &&
              generation === viewGeneration.current &&
              handleRef.current?.id === target.id
            )
              acceptView(target, value);
          } catch (error) {
            if (
              mounted.current &&
              sequence === launchSequence.current &&
              generation === viewGeneration.current &&
              handleRef.current?.id === target.id &&
              !recordController.signal.aborted
            )
              setRecordError(message(error));
          } finally {
            controllers.current.delete(recordController);
          }
        }
      }
    }
  }

  async function downloadExport() {
    const target = handleRef.current;
    if (!target) return;
    await privateOperation("export", async (signal) => {
      const blob = await exportRun(target.id, target.accessCode, signal);
      if (mounted.current) {
        download(blob, `coconut-run-${target.id}.json`);
        setNotice(
          "Retained evidence export downloaded. It contains no provider key or private access code.",
        );
      }
    });
  }
  async function publication(published: boolean) {
    const target = handleRef.current;
    if (!target || (published && !publishable)) return false;
    return privateOperation(
      published ? "publish" : "revoke",
      async (signal) => {
        const raw = await setRunPublication(
            target.id,
            target.accessCode,
            published,
            signal,
          ),
          meta = parseRunViewMeta(raw),
          run = adaptRunView(raw);
        if (meta.id !== target.id || run.id !== target.id)
          throw new RunApiError("unexpected-response");
        if (mounted.current) {
          acceptView(target, { run, meta });
          setNotice(
            published
              ? "Run published. Its tasks, answers, settings, and scores are now public."
              : "Run made private. Public access has been revoked.",
          );
        }
      },
    );
  }
  async function remove() {
    const target = handleRef.current;
    if (!target || busy) return false;
    return privateOperation("delete", async (signal) => {
      await deleteRun(target.id, target.accessCode, signal);
      if (!mounted.current) return;
      handleRef.current = null;
      activeHandle.current = null;
      setHandle(null);
      setViews((current) => current.filter((entry) => entry.id !== target.id));
      setProgress(null);
      setRunState(null);
      setPhase("idle");
      setStreamError(null);
      setCancellation("idle");
      setPreparedSuiteId(null);
      setShowSetup(true);
      setNotice("Retained run deleted. Provider charges are unchanged.");
    });
  }
  function saveAccess() {
    const target = handleRef.current;
    if (!target) return;
    try {
      download(
        new Blob(
          [
            JSON.stringify(
              {
                format: "coconut-private-access-v1",
                runId: target.id,
                accessCode: target.accessCode,
                expiresAt: target.expiresAt,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        `coconut-private-access-${target.id}.json`,
      );
      setNotice(
        "Private access file downloaded. Keep it separate from public evidence exports.",
      );
    } catch {
      setRecordError(
        "The private access file could not be saved. Reveal the code and copy it manually.",
      );
    }
  }
  async function copyAccess() {
    const target = handleRef.current;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.accessCode);
      setNotice("Private access code copied");
    } catch {
      setRecordError(
        "The clipboard is unavailable. Reveal the private access code and copy it manually.",
      );
    }
  }

  return {
    provider,
    changeProvider,
    selection,
    setSelection,
    configuration,
    configurationError,
    configurationLoading,
    retryConfiguration,
    suiteKey,
    changeSuite,
    suite,
    profile,
    concurrency,
    changeConcurrency,
    acceptCharges,
    setAcceptCharges,
    phase,
    streaming,
    busy,
    runState,
    progress,
    handle,
    preparedSuiteId,
    views,
    currentRun,
    privateAction,
    streamError,
    recordError,
    notice,
    cancellation,
    showSetup,
    setShowSetup,
    runnable,
    canLaunch,
    publishable,
    launch,
    requestCancellation,
    disconnect,
    refresh,
    openSaved,
    downloadExport,
    publication,
    remove,
    saveAccess,
    copyAccess,
  };
}
export type EvaluationWorkspaceController = ReturnType<
  typeof useEvaluationWorkspace
>;
