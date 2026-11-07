// Uses the official SDK while preserving the access transport's wire and failure bounds.
import OpenAI from "openai";
import { ACCESS_TIMEOUT_MS, buildProviderPlan, PROBE_MAX_OUTPUT_TOKENS, PROBE_PROMPT } from "./policy";
import type { AccessRequest, ProviderPlan } from "./types";

export async function requestOpenAIAccess(
  request: AccessRequest,
  credential: string,
  signal: AbortSignal,
  send: (url: string, init: RequestInit) => Promise<Response>,
  readBody: (response: Response) => Promise<string>,
): Promise<Response> {
  const plan = buildProviderPlan(request);
  return requestOpenAI(plan, credential, signal, send, readBody, (client) => request.operation === "authenticate"
    ? client.models.list({ signal }).asResponse()
    : client.responses.create({
      model: request.modelId, input: PROBE_PROMPT, max_output_tokens: PROBE_MAX_OUTPUT_TOKENS, store: false,
    }, { signal }).asResponse());
}

export async function requestOpenAI(
  plan: ProviderPlan,
  credential: string,
  signal: AbortSignal,
  send: (url: string, init: RequestInit) => Promise<Response>,
  readBody: (response: Response) => Promise<string>,
  invoke: (client: OpenAI) => Promise<Response>,
  timeoutMs: number = ACCESS_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180_000) throw new Error("OpenAI timeout must be an integer from 1 through 180000 milliseconds.");
  let rejected: Response | undefined;
  let transportError: unknown;
  // The pinned SDK patch disables ambient header reads during construction.
  const client = new OpenAI({
    apiKey: credential, adminAPIKey: null, organization: null, project: null, webhookSecret: null,
    baseURL: "https://api.openai.com/v1", dataResidency: null,
    maxRetries: 0, timeout: timeoutMs, logLevel: "off",
    fetch: async (input, init) => {
      try {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== plan.url || init?.method !== plan.method) throw new Error("Unexpected SDK access destination or method.");
        // SDK environment headers must never override a visitor's credential or add routing data.
        const headers: Record<string, string> = { Authorization: `Bearer ${credential}` };
        if (plan.method === "POST") headers["Content-Type"] = "application/json";
        const response = await send(url, { method: plan.method, headers, body: init.body, signal: init.signal ?? signal, redirect: "manual", credentials: "omit" });
        if (response.ok) return response;
        // SDK HTTP errors eagerly read the body; bound it before allowing that read.
        rejected = new Response(await readBody(response), { status: response.status, headers: response.headers });
        return rejected.clone();
      } catch (error) { transportError = error; throw error; }
    },
  });
  try {
    return await invoke(client);
  } catch (error) {
    if (transportError !== undefined) throw transportError;
    // Keep the original bounded HTTP failure for the shared categorical parser.
    if (error instanceof OpenAI.APIError && rejected && error.status === rejected.status) return rejected;
    throw error;
  }
}
