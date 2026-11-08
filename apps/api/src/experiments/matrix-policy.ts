// Shared connection failures stop an operator matrix before unrelated cells are dispatched.
import type { InferenceResult } from "../inference";

type FailureRecord = {
  readonly failure: { readonly code: string } | null;
  readonly results: readonly { readonly result: Pick<InferenceResult, "inferenceRequests"> & { readonly failure: { readonly code: string } | null } }[];
};

export function matrixFailureRequiresStop(record: FailureRecord): boolean {
  return (record.failure !== null && ["authentication-rejected", "credit-or-quota-exhausted"].includes(record.failure.code))
    || record.results.some(({ result }) => result.failure?.code === "network-error"
      || (result.failure?.code === "timeout" && result.inferenceRequests === 0));
}
