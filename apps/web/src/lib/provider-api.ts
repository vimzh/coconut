// Fixed browser API operations keep visitor credentials separate from requests and retained evidence.
import type {
  ProviderAccessResult,
  ProviderFailure,
  ProviderFailureCode,
  ProviderId,
  ProviderModelInput,
  ProviderModelPolicy,
  ProviderPolicy,
  ProviderSearchResult,
  ProviderSelectionResult,
  ReasoningEffort,
} from "./provider-types";

import { failureMessages, ProviderApiError } from "./provider-errors";
import { requestProvider } from "./provider-transport";
export { providerFailureMessage, ProviderApiError } from "./provider-errors";

type Data = Record<string, unknown>;
const efforts = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
function unexpected(): never {
  throw new ProviderApiError("unexpected-response");
}
function data(value: unknown): Data {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : unexpected();
}
function text(value: unknown, maximum = 1024): string {
  return typeof value === "string" &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    ? value
    : unexpected();
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value, 256);
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : unexpected();
}
function nullableCount(value: unknown): number | null {
  return value === null ? null : count(value);
}
function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : unexpected();
}
function choices<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : unexpected();
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : unexpected();
}
function timestamp(value: unknown): string {
  const result = text(value, 64);
  return Number.isFinite(Date.parse(result)) ? result : unexpected();
}
function provider(value: unknown): ProviderId {
  return choices(value, ["openai", "openrouter", "hugging-face"]);
}
function failure(value: unknown): ProviderFailure | null {
  if (value === null) return null;
  const record = data(value);
  return {
    code: choices(
      record.code,
      Object.keys(failureMessages) as ProviderFailureCode[],
    ),
    remoteOutcome: choices(record.remoteOutcome, [
      "not-sent",
      "unknown",
      "response-received",
    ]),
  };
}

export async function loadProviderPolicy(
  signal?: AbortSignal,
): Promise<ProviderPolicy> {
  const record = data(
    await requestProvider("/providers/policy", "GET", null, null, signal),
  );
  if (
    record.version !== "1" ||
    record.credentialLifetime !== "current-operation-only" ||
    record.persistence !== "none" ||
    record.ownerKeyFallback !== false
  )
    unexpected();
  const providers = array(record.providers).map((entry) => {
    const item = data(entry);
    return { id: provider(item.id), billing: text(item.billing) };
  });
  if (
    providers.length === 0 ||
    new Set(providers.map(({ id }) => id)).size !== providers.length
  )
    unexpected();
  return {
    credentialLifetime: "current-operation-only",
    persistence: "none",
    ownerKeyFallback: false,
    cancellation: text(record.cancellation),
    authentication: text(record.authentication),
    probe: text(record.probe),
    providers,
  };
}

export async function loadProviderModelPolicy(
  signal?: AbortSignal,
): Promise<ProviderModelPolicy> {
  const record = data(
    await requestProvider(
      "/providers/models/policy",
      "GET",
      null,
      null,
      signal,
    ),
  );
  if (record.version !== "2" || record.policyId !== "model-selection-v2")
    unexpected();
  const profiles = array(record.profiles).map((entry) => {
    const item = data(entry);
    const maxOutputTokens = count(item.maxOutputTokens);
    if (maxOutputTokens === 0) unexpected();
    return {
      id: text(item.id, 80),
      reasoning: choices(item.reasoning, ["provider-default", ...efforts]),
      maxOutputTokens,
    };
  });
  if (
    profiles.length === 0 ||
    new Set(profiles.map(({ id }) => id)).size !== profiles.length
  )
    unexpected();
  const maxSearchResults = count(record.maxSearchResults),
    freshnessMs = count(record.freshnessMs);
  if (
    maxSearchResults < 1 ||
    maxSearchResults > 20 ||
    record.maxProbeInferenceRequests !== 1 ||
    freshnessMs < 1
  )
    unexpected();
  return {
    version: "2",
    policyId: "model-selection-v2",
    profiles,
    maxSearchResults,
    maxProbeInferenceRequests: 1,
    freshnessMs,
    reasoning: text(record.reasoning),
  };
}

export async function authenticateProvider(
  selectedProvider: ProviderId,
  credential: string,
  signal?: AbortSignal,
): Promise<ProviderAccessResult> {
  const record = data(
    await requestProvider(
      "/providers/access",
      "POST",
      { provider: selectedProvider, operation: "authenticate" },
      credential,
      signal,
    ),
  );
  if (
    record.version !== "1" ||
    record.provider !== selectedProvider ||
    record.operation !== "authenticate"
  )
    unexpected();
  const result = {
    provider: selectedProvider,
    operation: "authenticate" as const,
    status: choices(record.status, ["authenticated", "not-verified"]),
    checkedAt: timestamp(record.checkedAt),
    failure: failure(record.failure),
  };
  if ((result.status === "authenticated") !== (result.failure === null))
    unexpected();
  return result;
}

export async function searchProviderModels(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ProviderSearchResult> {
  const record = data(
    await requestProvider(
      "/providers/models/search",
      "POST",
      { query, limit },
      null,
      signal,
    ),
  );
  if (record.version !== "1") unexpected();
  const models = array(record.models).map((entry) => {
    const item = data(entry);
    return {
      modelId: text(item.modelId, 256),
      displayName: text(item.displayName, 256),
      task: nullableText(item.task),
      routes:
        item.routes === null
          ? null
          : array(item.routes).map((entry) => {
              const route = data(entry);
              return {
                provider: text(route.provider, 128),
                providerModelId: nullableText(route.providerModelId),
                status: nullableText(route.status),
                task: nullableText(route.task),
              };
            }),
    };
  });
  const result = {
    status: choices(record.status, ["complete", "failed"]),
    models,
    failure: failure(record.failure),
  };
  if (
    (result.status === "complete") !== (result.failure === null) ||
    (result.status === "failed" && models.length !== 0)
  )
    unexpected();
  return result;
}

async function selectModel(
  input: ProviderModelInput,
  credential: string,
  verification: "metadata" | "probe",
  signal?: AbortSignal,
): Promise<ProviderSelectionResult> {
  const selected = {
    provider: input.provider,
    modelId: input.modelId,
    servingProvider: input.provider === "openai" ? null : input.servingProvider,
    profileId: input.profileId,
    verification,
  };
  const record = data(
    await requestProvider(
      "/providers/models/select",
      "POST",
      {
        ...selected,
        ...(verification === "probe" ? { acceptCharges: true } : {}),
      },
      credential,
      signal,
    ),
  );
  if (record.version !== "1") unexpected();
  const returned = data(record.request);
  if (Object.entries(selected).some(([key, value]) => returned[key] !== value))
    unexpected();
  const rawMetadata = record.metadata === null ? null : data(record.metadata);
  const rawProbe = data(record.probe),
    usage = data(rawProbe.usage),
    budget = data(record.budget);
  const result: ProviderSelectionResult = {
    policyId: choices(record.policyId, [
      "model-selection-v1",
      "model-selection-v2",
    ]),
    request: selected,
    status: choices(record.status, [
      "ready",
      "needs-verification",
      "blocked",
      "failed",
    ]),
    checkedAt: timestamp(record.checkedAt),
    expiresAt: timestamp(record.expiresAt),
    metadata:
      rawMetadata === null
        ? null
        : {
            modelId: text(rawMetadata.modelId, 256),
            canonicalId: nullableText(rawMetadata.canonicalId),
            providerModelId: nullableText(rawMetadata.providerModelId),
            servingProvider: nullableText(rawMetadata.servingProvider),
            hosted: choices(rawMetadata.hosted, [
              "available",
              "unavailable",
              "unknown",
            ]),
            exactRoute: boolean(rawMetadata.exactRoute),
            contextWindow: nullableCount(rawMetadata.contextWindow),
            maxOutputTokens: nullableCount(rawMetadata.maxOutputTokens),
          },
    probe: {
      status: choices(rawProbe.status, [
        "not-requested",
        "blocked",
        "verified",
        "not-verified",
      ]),
      reportedModelId: nullableText(rawProbe.reportedModelId),
      reportedServingProvider: nullableText(rawProbe.reportedServingProvider),
      usage: {
        inputTokens: nullableCount(usage.inputTokens),
        outputTokens: nullableCount(usage.outputTokens),
      },
      outputLimitRequestAccepted: boolean(rawProbe.outputLimitRequestAccepted),
      nativeSchemaRequestAccepted: boolean(
        rawProbe.nativeSchemaRequestAccepted,
      ),
      ...(rawProbe.reportedReasoningEffort === undefined
        ? {}
        : {
            reportedReasoningEffort:
              rawProbe.reportedReasoningEffort === null
                ? null
                : (choices(
                    rawProbe.reportedReasoningEffort,
                    efforts,
                  ) as ReasoningEffort),
          }),
      ...(rawProbe.reasoningEffortRequestAccepted === undefined
        ? {}
        : {
            reasoningEffortRequestAccepted: boolean(
              rawProbe.reasoningEffortRequestAccepted,
            ),
          }),
      outcome: nullableText(rawProbe.outcome),
    },
    budget: {
      maxInferenceRequests: count(budget.maxInferenceRequests),
      maxOutputTokens: count(budget.maxOutputTokens),
    },
    failure: failure(record.failure),
  };
  if ((result.status === "failed") !== (result.failure !== null)) unexpected();
  if (
    result.metadata !== null &&
    (result.metadata.modelId !== selected.modelId ||
      result.metadata.servingProvider !== selected.servingProvider)
  )
    unexpected();
  if (
    result.status === "ready" &&
    (verification !== "probe" ||
      result.probe.status !== "verified" ||
      data(record.compatibility).compatible !== true)
  )
    unexpected();
  return result;
}

export function inspectProviderModel(
  input: ProviderModelInput,
  credential: string,
  signal?: AbortSignal,
): Promise<ProviderSelectionResult> {
  return selectModel(input, credential, "metadata", signal);
}

export function probeProviderModel(
  input: ProviderModelInput,
  credential: string,
  acceptCharges: true,
  signal?: AbortSignal,
): Promise<ProviderSelectionResult> {
  if (acceptCharges !== true) throw new ProviderApiError("invalid-input");
  return selectModel(input, credential, "probe", signal);
}
