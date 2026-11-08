// Public workloads are allowlisted, explicit, and bounded before a provider key is used.
import { parseSelectionRequest } from "../discovery";
import { getProfile } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { freezeData } from "../suites/generator";
import type { RunRequest } from "./types";

export const RUN_TIMEOUT_MS = 3_600_000;
export const RUN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const RUN_POLICY = freezeData({
  version: "1", policyId: "foreground-runs-v1", trialsPerInstance: 3, attemptsPerTrial: 1,
  retries: 0, maxConcurrency: 12, defaultConcurrency: 4, maxActiveRuns: 4, maxCases: 75,
  metadataTimeoutMs: 20000, inferenceTimeoutMs: 180000, runTimeoutMs: RUN_TIMEOUT_MS,
  retentionDays: 7, visibility: "private-until-explicit-publication", resumption: "unsupported",
  credentials: "Provider keys stay in the current foreground operation. Private run access uses a separate code returned once; save it explicitly to return after refresh.",
  charges: "Starting a run authorizes its three trials per instance. Every dispatched inference can incur provider charges, including interrupted work. No automatic retry or model substitution occurs.",
  cancellation: "Cancellation stops new trials and aborts active calls. Remote execution or charges may remain unknown. Completed evidence remains inspectable.",
});

export class RunInputError extends Error {
  constructor(readonly code = "invalid-input", message = "Select a known suite, explicit provider/model/route/profile, concurrency from 1 through 12, and acknowledge provider charges.") {
    super(message); this.name = "RunInputError";
  }
}

export function parseRunRequest(input: unknown): RunRequest {
  try {
    const data = readDataRecord(input, "Run request");
    requireFields(data, ["suiteKey", "provider", "modelId", "servingProvider", "profileId", "concurrency", "acceptCharges"]);
    if (data.acceptCharges !== true) throw new RunInputError("charge-authorization-required", "Starting an evaluation requires explicit acknowledgement of its provider charges.");
    if (data.suiteKey !== "reference-v1" && data.suiteKey !== "smooth-v2" && data.suiteKey !== "challenge-v1" && data.suiteKey !== "screening-v1") throw new RunInputError();
    if (!Number.isInteger(data.concurrency) || (data.concurrency as number) < 1 || (data.concurrency as number) > 12) throw new RunInputError();
    const selection = parseSelectionRequest({ provider: data.provider, modelId: data.modelId, servingProvider: data.servingProvider, profileId: data.profileId, verification: "metadata" });
    if (selection.provider !== "openai" && getProfile(selection.profileId).reasoning !== "provider-default") throw new RunInputError("unsupported-profile", "Explicit reasoning profiles currently require OpenAI. Select a permitted profile or service explicitly.");
    return freezeData({ suiteKey: data.suiteKey, provider: selection.provider, modelId: selection.modelId, servingProvider: selection.servingProvider, profileId: selection.profileId, concurrency: data.concurrency as number, acceptCharges: true });
  } catch (error) {
    if (error instanceof RunInputError && error.code === "charge-authorization-required") throw new RunInputError("charge-authorization-required", "Starting an evaluation requires explicit acknowledgement of its provider charges.");
    if (error instanceof RunInputError && error.code === "unsupported-profile") throw new RunInputError("unsupported-profile", "Explicit reasoning profiles currently require OpenAI. Select a permitted profile or service explicitly.");
    throw new RunInputError();
  }
}
