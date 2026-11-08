"use client";
// Coordinates cancellable setup operations while the parent page owns the credential.
import { useEffect, useRef, useState } from "react";
import {
  authenticateProvider,
  inspectProviderModel,
  loadProviderModelPolicy,
  loadProviderPolicy,
  probeProviderModel,
  ProviderApiError,
  searchProviderModels,
} from "./provider-api";
import type {
  ProviderAccessResult,
  ProviderId,
  ProviderModelPolicy,
  ProviderPolicy,
  ProviderSearchResult,
  ProviderSelectionResult,
  ProviderSetupProps,
  ProviderSetupState,
} from "./provider-types";
type Operation = "access" | "search" | "metadata" | "probe";
function errorMessage(error: unknown): string {
  return error instanceof ProviderApiError
    ? error.message
    : "The operation could not be completed. No access or compatibility claim was accepted.";
}

export function useProviderSetup({
  state,
  onChange,
  disabled = false,
  onSelection,
  onDisconnect,
}: ProviderSetupProps) {
  const [policies, setPolicies] = useState<{
    access: ProviderPolicy;
    models: ProviderModelPolicy;
  } | null>(null);
  const [policyAttempt, setPolicyAttempt] = useState(0);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [access, setAccess] = useState<ProviderAccessResult | null>(null);
  const [selection, setSelection] = useState<ProviderSelectionResult | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<ProviderSearchResult | null>(null);
  const [acceptCharges, setAcceptCharges] = useState(false);
  const [active, setActive] = useState<Operation | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const operationController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      loadProviderPolicy(controller.signal),
      loadProviderModelPolicy(controller.signal),
    ])
      .then(([access, models]) => {
        if (!controller.signal.aborted) {
          setPolicies({ access, models });
          setPolicyError(null);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPolicyError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPolicyLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [policyAttempt]);

  useEffect(
    () => () => {
      operationController.current?.abort();
      operationController.current = null;
      setActive(null);
      setAccess(null);
      setSelection(null);
      setAcceptCharges(false);
    },
    [
      state.provider,
      state.credential,
      state.modelId,
      state.servingProvider,
      state.profileId,
    ],
  );

  const selectedProfile = policies?.models.profiles.find(
    (profile) => profile.id === state.profileId,
  );
  const unsupportedEffort =
    selectedProfile !== undefined &&
    selectedProfile.reasoning !== "provider-default" &&
    state.provider !== "openai";
  const busy = active !== null;
  const controlsDisabled = disabled || busy || policies === null;
  const hasModel =
    state.modelId.trim() !== "" &&
    (state.provider === "openai" || Boolean(state.servingProvider?.trim()));
  const canSelect =
    !controlsDisabled &&
    state.credential !== "" &&
    hasModel &&
    selectedProfile !== undefined &&
    !unsupportedEffort;
  const selectedSearchModel =
    search?.status === "complete"
      ? search.models.find((model) => model.modelId === state.modelId)
      : undefined;
  const billing = policies?.access.providers.find(
    ({ id }) => id === state.provider,
  )?.billing;

  function update(next: ProviderSetupState) {
    operationController.current?.abort();
    operationController.current = null;
    setActive(null);
    setAccess(null);
    setSelection(null);
    setOperationError(null);
    setAcceptCharges(false);
    onSelection?.(null);
    onChange(next);
  }

  function disconnect() {
    update({ ...state, credential: "" });
    onDisconnect?.();
  }

  async function perform<T>(
    operation: Operation,
    run: (signal: AbortSignal) => Promise<T>,
    accept: (result: T) => void,
  ) {
    if (operationController.current !== null || disabled) return;
    const controller = new AbortController();
    operationController.current = controller;
    setActive(operation);
    setOperationError(null);
    if (operation !== "search") {
      setSelection(null);
      onSelection?.(null);
    }
    try {
      const result = await run(controller.signal);
      if (operationController.current === controller) accept(result);
    } catch (error) {
      if (operationController.current === controller)
        setOperationError(errorMessage(error));
    } finally {
      if (operationController.current === controller) {
        operationController.current = null;
        setActive(null);
      }
    }
  }

  function searchModels() {
    if (
      controlsDisabled ||
      [...query.trim()].length < 1 ||
      [...query.trim()].length > 80 ||
      !policies
    )
      return;
    setSearch(null);
    void perform(
      "search",
      (signal) =>
        searchProviderModels(
          query.trim(),
          Math.min(8, policies.models.maxSearchResults),
          signal,
        ),
      setSearch,
    );
  }

  function select(verification: "metadata" | "probe") {
    if (!canSelect || (verification === "probe" && !acceptCharges)) return;
    if (verification === "probe") setAcceptCharges(false);
    const input = {
      provider: state.provider,
      modelId: state.modelId,
      servingProvider:
        state.provider === "openai" ? null : state.servingProvider,
      profileId: state.profileId,
    };
    void perform(
      verification,
      (signal) =>
        verification === "probe"
          ? probeProviderModel(input, state.credential, true, signal)
          : inspectProviderModel(input, state.credential, signal),
      (result) => {
        setSelection(result);
        onSelection?.(result);
      },
    );
  }

  function checkAccess() {
    setAccess(null);
    void perform(
      "access",
      (signal) =>
        authenticateProvider(state.provider, state.credential, signal),
      setAccess,
    );
  }
  function changeProvider(provider: ProviderId) {
    setSearch(null);
    setQuery("");
    update({ ...state, provider, credential: "", servingProvider: null });
  }
  function retryPolicies() {
    setPolicyLoading(true);
    setPolicyError(null);
    setPolicyAttempt((attempt) => attempt + 1);
  }
  return {
    policies,
    policyLoading,
    policyError,
    access,
    selection,
    query,
    search,
    acceptCharges,
    active,
    operationError,
    selectedProfile,
    unsupportedEffort,
    busy,
    controlsDisabled,
    canSelect,
    selectedSearchModel,
    billing,
    update,
    disconnect,
    searchModels,
    select,
    checkAccess,
    changeProvider,
    retryPolicies,
    setQuery,
    setAcceptCharges,
  };
}
