"use client";
// Provider, model, and profile controls keep catalog reads separate from paid compatibility checks.
import { useId } from "react";
import { ChevronDown, KeyRound, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { providerFailureMessage } from "@/lib/provider-api";
import { useProviderSetup } from "@/lib/provider-setup-controller";
import type {
  ProviderId,
  ProviderProfile,
  ProviderSelectionResult,
  ProviderSetupProps,
} from "@/lib/provider-types";
export type {
  ProviderSetupState,
  ProviderSelectionResult,
  ProviderSetupProps,
} from "@/lib/provider-types";
const providerNames: Record<ProviderId, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "hugging-face": "Hugging Face",
};

function profileName(profile: ProviderProfile): string {
  const format = profile.id.includes("-schema-")
    ? "Strict JSON schema"
    : profile.id.includes("-json-") ? "Prompted JSON" : profile.id;
  const reasoning =
    profile.reasoning === "provider-default"
      ? "provider default"
      : profile.reasoning;
  return `${format} · ${reasoning} reasoning`;
}

function selectionDescription(result: ProviderSelectionResult): string {
  if (result.failure) {
    if (result.probe.outcome === "reasoning-effort-unverified")
      return "The provider did not confirm the exact requested reasoning effort. Choose a supported effort explicitly or check the model's permissions.";
    return providerFailureMessage(result.failure.code);
  }
  if (result.status === "ready")
    return "One observed reply met this profile's requirements. Starting an evaluation checks access and each task's context again.";
  if (result.status === "blocked") {
    if (result.metadata?.hosted === "unavailable")
      return "No available hosted route was advertised for this selection. Choose another model or explicit serving provider.";
    return "The selected route or settings conflict with this profile. Choose a permitted provider, model, serving provider, or answer format explicitly.";
  }
  if (result.metadata?.hosted === "unknown")
    return "Model metadata was retrieved, but hosting or execution support remains unknown. An access check alone does not establish compatibility.";
  return "Metadata was retrieved. Compatibility remains unverified until a separate, charge-approved probe succeeds.";
}

export function ProviderSetup({
  state,
  onChange,
  disabled = false,
  onSelection,
  onDisconnect,
}: ProviderSetupProps) {
  const id = useId();
  const {
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
  } = useProviderSetup({
    state,
    onChange,
    disabled,
    onSelection,
    onDisconnect,
  });
  return (
    <Card aria-labelledby={`${id}-title`} className="gap-6 rounded-xl border shadow-none">
      <CardHeader className="gap-2">
        <CardTitle id={`${id}-title`} role="heading" aria-level={2} className="text-xl font-medium">
          Which model are you testing?
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Connect your provider account and choose the exact model to evaluate.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {policyLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading provider settings…
          </p>
        )}
        {policyError && (
          <div role="alert" className="space-y-3 text-sm">
            <p className="text-destructive">{policyError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || policyLoading}
              onClick={retryPolicies}
            >
              Retry settings
            </Button>
          </div>
        )}

        <fieldset disabled={controlsDisabled} className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <legend className="sr-only">Connection</legend>
          <div className="space-y-2">
            <Label htmlFor={`${id}-provider`}>Provider</Label>
            <NativeSelect
              id={`${id}-provider`}
              value={state.provider}
              onChange={(event) =>
                changeProvider(event.target.value as ProviderId)
              }
            >
              {policies ? (
                policies.access.providers.map(({ id }) => (
                  <NativeSelectOption key={id} value={id}>
                    {providerNames[id]}
                  </NativeSelectOption>
                ))
              ) : (
                <NativeSelectOption value={state.provider}>
                  {providerNames[state.provider]}
                </NativeSelectOption>
              )}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-credential`}>Provider credential</Label>
            <Input
              id={`${id}-credential`}
              type="password"
              value={state.credential}
              placeholder="Paste your API key"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={`${id}-credential-help`}
              onChange={(event) =>
                update({ ...state, credential: event.target.value })
              }
            />
            <p
              id={`${id}-credential-help`}
              className="text-xs leading-5 text-muted-foreground"
            >
              Kept in this page’s memory. Refresh, disconnect, or changing provider clears it.
            </p>
          </div>
        </fieldset>
        <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <KeyRound className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Your provider bills your account for usage. You approve evaluation charges in the review step.
        </p>

        <fieldset
          disabled={controlsDisabled}
          className="grid min-w-0 gap-5 sm:grid-cols-2"
        >
          <legend className="sr-only">Model and answer format</legend>
          {state.provider === "hugging-face" && (
            <div className="space-y-3 sm:col-span-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-search`}>
                  Search Hugging Face models
                </Label>
                <Input
                  id={`${id}-search`}
                  placeholder="Search by model or organization"
                  value={query}
                  maxLength={160}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchModels();
                    }
                  }}
                  aria-describedby={`${id}-search-help`}
                />
                <p
                  id={`${id}-search-help`}
                  className="text-xs leading-5 text-muted-foreground"
                >
                  Anonymous catalog search, up to 80 characters. A listing does
                  not establish execution access.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={
                  [...query.trim()].length < 1 || [...query.trim()].length > 80
                }
                onClick={searchModels}
              >
                {active === "search" ? "Searching…" : "Search models"}
              </Button>
              {search?.status === "complete" && search.models.length === 0 && (
                <p role="status" className="text-sm text-muted-foreground">
                  No matching models. Try another model name.
                </p>
              )}
              {search?.failure && (
                <p role="alert" className="text-sm text-destructive">
                  Search failed. {providerFailureMessage(search.failure.code)}
                </p>
              )}
              {search?.status === "complete" && search.models.length > 0 && (
                <ul
                  aria-label="Model search results"
                  className="divide-y rounded-lg border"
                >
                  {search.models.map((model) => (
                    <li key={model.modelId}>
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            ...state,
                            modelId: model.modelId,
                            servingProvider: null,
                          })
                        }
                        className="w-full space-y-1 rounded-md px-3 py-3 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                      >
                        <span className="block break-all font-mono text-xs">
                          {model.modelId}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {model.routes === null
                            ? "Hosting routes unknown"
                            : model.routes.length === 0
                              ? "Catalog listing only"
                              : `${model.routes.length} advertised serving ${model.routes.length === 1 ? "route" : "routes"}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-model`}>Model identifier</Label>
            <Input
              id={`${id}-model`}
              placeholder="Exact provider model identifier"
              value={state.modelId}
              maxLength={256}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) =>
                update({ ...state, modelId: event.target.value })
              }
              aria-describedby={`${id}-model-help`}
              className="font-mono"
            />
            <p
              id={`${id}-model-help`}
              className="text-xs leading-5 text-muted-foreground"
            >
              Use the exact identifier from your provider’s model catalog.
            </p>
          </div>
          {state.provider !== "openai" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-route`}>Serving provider</Label>
              <Input
                id={`${id}-route`}
                placeholder="Advertised serving-provider slug"
                list={`${id}-routes`}
                value={state.servingProvider ?? ""}
                maxLength={128}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) =>
                  update({
                    ...state,
                    servingProvider: event.target.value || null,
                  })
                }
                aria-describedby={`${id}-route-help`}
                className="font-mono"
              />
              <datalist id={`${id}-routes`}>
                {selectedSearchModel?.routes?.map((route) => (
                  <option key={route.provider} value={route.provider}>
                    {route.status ?? "Status unknown"} ·{" "}
                    {route.task ?? "Task unknown"}
                  </option>
                ))}
              </datalist>
              <p
                id={`${id}-route-help`}
                className="text-xs leading-5 text-muted-foreground"
              >
                Choose an advertised route or enter its exact provider slug.
                Automatic routing is unavailable.
              </p>
              {selectedSearchModel?.routes === null && (
                <p className="text-xs leading-5 text-muted-foreground">
                  This catalog entry does not report hosting routes.
                  Availability remains unknown.
                </p>
              )}
              {selectedSearchModel?.routes?.length === 0 && (
                <p className="text-xs leading-5 text-muted-foreground">
                  This catalog entry advertises no serving route. A catalog
                  listing alone cannot run an evaluation.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-profile`}>Answer format and reasoning</Label>
            <NativeSelect
              id={`${id}-profile`}
              value={state.profileId}
              onChange={(event) =>
                update({ ...state, profileId: event.target.value })
              }
              aria-describedby={`${id}-profile-help`}
            >
              {!selectedProfile && (
                <NativeSelectOption value={state.profileId} disabled>
                  {state.profileId || "Choose a profile"}
                </NativeSelectOption>
              )}
              {policies?.models.profiles.map((profile) => (
                <NativeSelectOption
                  key={profile.id}
                  value={profile.id}
                  disabled={
                    state.provider !== "openai" &&
                    profile.reasoning !== "provider-default"
                  }
                >
                  {profileName(profile)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p
              id={`${id}-profile-help`}
              className="text-xs leading-5 text-muted-foreground"
            >
              {selectedProfile
                ? `${selectedProfile.maxOutputTokens.toLocaleString()} output-token cap per attempt. Explicit reasoning settings require OpenAI and model support.`
                : "Load the provider settings and choose an available profile."}
            </p>
            {unsupportedEffort && (
              <p role="alert" className="text-sm text-destructive">
                This reasoning profile requires OpenAI. Choose a version-1
                profile explicitly or change provider.
              </p>
            )}
          </div>
        </fieldset>

        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Optional connection checks
            <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.5} aria-hidden="true" />
          </summary>
          <fieldset disabled={controlsDisabled} className="space-y-5 border-t p-4">
            <p className="text-xs leading-5 text-muted-foreground">
              You can start an evaluation without these checks. Access and metadata checks make no inference request; compatibility checks incur provider usage.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Button type="button" variant="outline" disabled={state.credential === ""} onClick={checkAccess}>
                  {active === "access" ? "Checking access…" : "Check access"}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Checks authentication. Model execution permission remains unverified.
                </p>
              </div>
              <div className="space-y-2">
                <Button type="button" variant="outline" disabled={!canSelect} onClick={() => select("metadata")}>
                  {active === "metadata" ? "Inspecting model…" : "Inspect model"}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Reads model capabilities. Missing metadata stays unknown.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <input
                  id={`${id}-charges`}
                  type="checkbox"
                  checked={acceptCharges}
                  disabled={!canSelect}
                  onChange={(event) => setAcceptCharges(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-accent"
                />
                <Label
                  htmlFor={`${id}-charges`}
                  className="block text-sm leading-5 font-normal"
                >
                  I accept provider charges for one compatibility request with a{" "}
                  {selectedProfile?.maxOutputTokens.toLocaleString() ??
                    "policy-defined"}
                  -token output ceiling. This is not a currency limit.
                </Label>
              </div>
              <Button
                type="button"
                disabled={
                  !canSelect ||
                  !acceptCharges ||
                  policies?.models.maxProbeInferenceRequests !== 1
                }
                onClick={() => select("probe")}
              >
                {active === "probe"
                  ? "Checking compatibility…"
                  : "Check compatibility"}
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                A compatibility check is separate from an evaluation and does not
                measure mathematical performance. No automatic retry is made.
              </p>
            </div>
          </fieldset>
          {billing && <p className="px-4 pb-4 text-xs leading-5 text-muted-foreground">{billing}</p>}
        </details>

        {access && (
          <div role="status" className="rounded-lg border px-4 py-3 text-sm leading-5">
            {access.status === "authenticated" && <p>Access checked. Model execution permission remains unverified.</p>}
            {access.failure && <p className="text-destructive">{providerFailureMessage(access.failure.code)}</p>}
          </div>
        )}

        {selection && (
          <div
            aria-live="polite"
            className="space-y-2 rounded-lg border p-4 text-sm leading-5"
          >
            <p className="font-medium">
              {selection.status === "ready"
                ? "Compatibility checked"
                : selection.status === "blocked"
                  ? "Selection blocked"
                  : selection.status === "failed"
                    ? "Selection failed"
                    : "Compatibility unverified"}
            </p>
            <p className="text-muted-foreground">
              {selectionDescription(selection)}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
              <dt>Reported model</dt>
              <dd className="break-all font-mono">
                {selection.probe.reportedModelId ?? "Not reported"}
              </dd>
              <dt>Reported provider</dt>
              <dd>
                {selection.probe.reportedServingProvider ?? "Not reported"}
              </dd>
              {selection.metadata && (
                <>
                  <dt>Hosting</dt>
                  <dd>
                    {selection.metadata.hosted === "available"
                      ? "Advertised"
                      : selection.metadata.hosted === "unavailable"
                        ? "Unavailable"
                        : "Unknown"}
                  </dd>
                  <dt>Context capacity</dt>
                  <dd>
                    {selection.metadata.contextWindow === null
                      ? "Not reported"
                      : `${selection.metadata.contextWindow.toLocaleString()} tokens`}
                  </dd>
                  <dt>Output capacity</dt>
                  <dd>
                    {selection.metadata.maxOutputTokens === null
                      ? "Not reported"
                      : `${selection.metadata.maxOutputTokens.toLocaleString()} tokens`}
                  </dd>
                </>
              )}
            </dl>
            {selection.status === "ready" && (
              <p className="text-xs text-muted-foreground">
                Check expires at{" "}
                {new Date(selection.expiresAt).toLocaleTimeString()}.
                Availability and permissions can change.
              </p>
            )}
          </div>
        )}
        {operationError && (
          <p role="alert" className="text-sm leading-5 text-destructive">
            {operationError}
          </p>
        )}

        <div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={state.credential === "" && !busy}
            onClick={disconnect}
          >
            <Unplug className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Disconnect
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Clears your credential and requests cancellation. Already-started provider work or charges may remain uncertain.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
