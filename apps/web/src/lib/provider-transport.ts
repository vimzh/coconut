// Fixed destinations and bounded cancellable reads protect visitor-owned provider operations.
import { ProviderApiError } from "./provider-errors";
type ProviderPath =
  | "/providers/policy"
  | "/providers/models/policy"
  | "/providers/access"
  | "/providers/models/search"
  | "/providers/models/select";
const MAX_RESPONSE_BYTES = 1_048_576;

function unexpected(): never {
  throw new ProviderApiError("unexpected-response");
}
function apiOrigin(): string {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3201",
    );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new ProviderApiError("configuration");
  }
}

export async function requestProvider(
  path: ProviderPath,
  method: "GET" | "POST",
  body: unknown,
  credential: string | null,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) throw new ProviderApiError("cancelled");
  if (
    credential !== null &&
    (credential.length < 16 ||
      credential.length > 4096 ||
      !/^[A-Za-z0-9._~+/-]+=*$/.test(credential))
  )
    throw new ProviderApiError("invalid-input");
  if (credential !== null && JSON.stringify(body).includes(credential))
    throw new ProviderApiError("invalid-input");
  try {
    const response = await fetch(`${apiOrigin()}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(credential === null
          ? {}
          : { Authorization: `Bearer ${credential}` }),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new ProviderApiError("http-error");
    }
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json") ||
      !response.body
    )
      unexpected();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_RESPONSE_BYTES) unexpected();
        chunks.push(next.value);
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let result: unknown;
    try {
      result = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      unexpected();
    }
    if (credential !== null) {
      const serialized = JSON.stringify(result);
      if (
        [credential, encodeURIComponent(credential), btoa(credential)].some(
          (form) => serialized.includes(form),
        )
      )
        unexpected();
    }
    return result;
  } catch (error) {
    if (signal?.aborted) throw new ProviderApiError("cancelled");
    if (error instanceof ProviderApiError) throw error;
    throw new ProviderApiError("network-error");
  }
}
