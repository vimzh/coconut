// Provider bodies remain private; only categorical failures and narrow evidence survive.
import type { AccessFailureCode, AccessRequest, ParsedAccessResponse } from "./types";

export const FAILURE_MESSAGES: Readonly<Record<AccessFailureCode, string>> = Object.freeze({
  "authentication-rejected": "The provider rejected authentication. Check the credential and its endpoint permissions.",
  "permission-denied": "The request is not permitted. Check model, account, regional, and credential restrictions.",
  "credit-or-quota-exhausted": "The provider reported a credit, spend, or usage limit. Check billing and quota before another operation.",
  "model-unavailable": "The requested model or serving route is unavailable or inaccessible to this credential.",
  "rate-limited": "The provider rate-limited this operation. No automatic retry was made.",
  "service-unavailable": "The provider could not complete this operation. Availability remains unverified.",
  cancelled: "The operation was cancelled. Already-initiated upstream work or charges can remain unknown.",
  timeout: "The operation reached its deadline. Upstream work or charges can remain unknown.",
  "network-error": "The provider connection failed. No automatic retry was made; any initiated remote work can remain unknown.",
  "redirect-blocked": "The provider attempted a redirect. Credentials were not forwarded to a new destination.",
  "invalid-provider-response": "The provider response did not establish the requested access. Check the selected model and service configuration.",
  "response-too-large": "The provider response exceeded the access-check size limit and was discarded.",
  "output-incomplete": "The bounded probe did not finish normally. Inference access remains unverified; no retry or substitution was made.",
  "no-output": "The probe returned no usable assistant text. Inference access remains unverified.",
  "credential-reflection": "The provider response reflected authorization material and was discarded.",
});

function object(input: unknown): Record<string, unknown> | undefined {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : undefined;
}

export function reflectsCredential(value: string, credential: string): boolean {
  return [credential, encodeURIComponent(credential), Buffer.from(credential).toString("base64")].some((form) => value.includes(form));
}

function failure(code: AccessFailureCode): ParsedAccessResponse {
  return { status: "not-verified", reportedModelId: null, reportedServingProvider: null, usage: { inputTokens: null, outputTokens: null }, failure: code };
}

function httpFailure(request: AccessRequest, status: number, body: Record<string, unknown> | undefined): AccessFailureCode {
  const error = object(body?.error);
  const metadata = object(error?.metadata);
  const codes = [error?.code, error?.type, metadata?.error_type, metadata?.type];
  const includes = (...known: string[]) => codes.some((code) => typeof code === "string" && known.includes(code));
  if (status === 402 || includes("insufficient_quota", "billing_not_active", "credit_balance_too_low", "organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded", "payment_required", "openrouter_key_limit", "openrouter_workspace_budget", "openrouter_guardrail_budget")) return "credit-or-quota-exhausted";
  if (status === 401 || includes("invalid_api_key", "authentication")) return "authentication-rejected";
  if (status === 403 || includes("permission_denied")) return "permission-denied";
  if ((status === 404 && request.operation === "probe") || includes("model_not_found", "model_not_available")) return "model-unavailable";
  if (status === 429 || includes("rate_limit_exceeded")) return "rate-limited";
  if (status >= 500 || status === 404 || includes("provider_overloaded", "provider_unavailable", "timeout", "server")) return "service-unavailable";
  return "invalid-provider-response";
}

function safeIdentifier(input: unknown): string | null {
  return typeof input === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,255}$/.test(input) ? input : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseAccessResponse(request: AccessRequest, status: number, input: unknown, credential: string): ParsedAccessResponse {
  // Never forward free-form bodies, even on 2xx, including reflected secrets in metadata.
  if (reflectsCredential(JSON.stringify(input) ?? "", credential)) return failure("credential-reflection");
  const body = object(input);
  if (status < 200 || status >= 300 || (body?.error !== undefined && body.error !== null)) return failure(httpFailure(request, status, body));
  if (!body) return failure("invalid-provider-response");
  if (request.operation === "authenticate") {
    const valid = request.provider === "openai" ? body.object === "list" && Array.isArray(body.data)
      : request.provider === "openrouter" ? object(body.data) !== undefined
      : (body.type === "user" || body.type === "org") && typeof body.name === "string" && body.name.trim() !== "";
    return valid ? { status: "authenticated", reportedModelId: null, reportedServingProvider: null, usage: { inputTokens: null, outputTokens: null }, failure: null } : failure("invalid-provider-response");
  }
  const model = safeIdentifier(body.model);
  if (model === null) return failure("invalid-provider-response");
  const usage = object(body.usage);
  if (request.provider === "openai") {
    if (body.status !== "completed") return failure("output-incomplete");
    if (!Array.isArray(body.output)) return failure("invalid-provider-response");
    const visible = body.output.some((item) => {
      const message = object(item);
      return message?.type === "message" && message.role === "assistant" && message.status === "completed" && Array.isArray(message.content) && message.content.some((part) => {
        const content = object(part);
        return content?.type === "output_text" && typeof content.text === "string" && content.text.trim() !== "";
      });
    });
    if (!visible) return failure("no-output");
    return { status: "inference-verified", reportedModelId: model, reportedServingProvider: "openai", usage: { inputTokens: count(usage?.input_tokens), outputTokens: count(usage?.output_tokens) }, failure: null };
  }
  if (!Array.isArray(body.choices) || body.choices.length !== 1) return failure("invalid-provider-response");
  const choice = object(body.choices[0]);
  if (choice?.error !== undefined && choice.error !== null) return failure("invalid-provider-response");
  const terminalReasons = request.provider === "hugging-face" ? ["stop", "eos_token"] : ["stop"];
  if (typeof choice?.finish_reason !== "string" || !terminalReasons.includes(choice.finish_reason)) return failure("output-incomplete");
  const message = object(choice.message);
  if (message?.role !== "assistant" || typeof message.content !== "string" || message.content.trim() === "") return failure("no-output");
  return { status: "inference-verified", reportedModelId: model, reportedServingProvider: safeIdentifier(body.provider), usage: { inputTokens: count(usage?.prompt_tokens), outputTokens: count(usage?.completion_tokens) }, failure: null };
}
