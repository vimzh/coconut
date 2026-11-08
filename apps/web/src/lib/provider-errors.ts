// Fixed messages prevent raw provider or network diagnostics from reaching setup views.
import type { ProviderFailureCode } from "./provider-types";
export const failureMessages: Record<ProviderFailureCode, string> = {
  "authentication-rejected":
    "The provider rejected this credential. Check the key and its permissions.",
  "permission-denied":
    "This credential cannot use the selected model or serving provider. Check access permissions.",
  "credit-or-quota-exhausted":
    "The provider reported a billing or quota limit. Review the provider account before trying again.",
  "model-unavailable":
    "This model or serving route is unavailable. Choose another explicit selection.",
  "rate-limited":
    "The provider rate limit was reached. Wait before trying again; no automatic retry was made.",
  "service-unavailable":
    "The provider is unavailable. Try again when the service is available.",
  cancelled:
    "The operation was cancelled. Work or charges already started may remain uncertain.",
  timeout:
    "The operation reached its deadline. Work or charges already started may remain uncertain.",
  "network-error": "The connection failed. No automatic retry was made.",
  "redirect-blocked":
    "A redirect was blocked. Check the provider configuration.",
  "invalid-provider-response":
    "The response did not establish the requested compatibility. Check the selected settings.",
  "response-too-large":
    "The response exceeded the permitted size and was discarded.",
  "output-incomplete":
    "The compatibility reply did not complete. Compatibility remains unverified.",
  "no-output":
    "The provider returned no usable reply. Compatibility remains unverified.",
  "credential-reflection":
    "The response contained authorization material and was discarded.",
};

export function providerFailureMessage(code: ProviderFailureCode): string {
  return failureMessages[code];
}

export class ProviderApiError extends Error {
  constructor(
    readonly code:
      | "unexpected-response"
      | "network-error"
      | "cancelled"
      | "invalid-input"
      | "configuration"
      | "http-error",
  ) {
    const messages = {
      "unexpected-response":
        "The evaluation service returned an unexpected response. No access or compatibility claim was accepted.",
      "network-error":
        "The evaluation service could not be reached. Check your connection and try again.",
      cancelled: "The operation was cancelled",
      "invalid-input":
        "Check the credential and required model settings before trying again.",
      configuration:
        "The evaluation service address is invalid. Configure a secure API origin before continuing.",
      "http-error":
        "The evaluation service rejected this operation. Check the credential, permissions, and selected settings.",
    };
    super(messages[code]);
    this.name = "ProviderApiError";
  }
}
