// Runs the pinned native certifier with bounded data, time, and process isolation.
import { access, constants } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { freezeData } from "../suites/generator";
import type { NumericalBackend, NumericalCertificate, NumericalResult } from "./types";

export const NUMERICAL_BATCH_LIMIT = 64;
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;
const DEADLINE_MS = 60_000;
const service = new URL("../../../../services/numerics/", import.meta.url);
const interpreter = fileURLToPath(new URL(".venv/bin/python", service));
const worker = fileURLToPath(new URL("worker.py", service));

export class NumericalBackendError extends Error {
  constructor(public readonly code: "invalid-input" | "unavailable" | "cancelled" | "timeout" | "worker-error" | "resource-limit", message: string) {
    super(message);
    this.name = "NumericalBackendError";
  }
}

// Copy descriptors before yielding; JSON serialization must never execute caller code.
function snapshot(input: unknown): unknown {
  const ancestors = new Set<object>();
  let remaining = 100_000;
  let textRemaining = MAX_INPUT_BYTES;
  const copy = (value: unknown, depth: number): unknown => {
    if (--remaining < 0 || depth > 80) throw new NumericalBackendError("invalid-input", "Numerical input exceeds the data-shape budget.");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") {
      textRemaining -= value.length;
      if (textRemaining < 0) throw new NumericalBackendError("invalid-input", "Numerical input contains oversized string data.");
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object" || value === null || ancestors.has(value)) {
      throw new NumericalBackendError("invalid-input", "Numerical input must contain finite, acyclic JSON data only.");
    }
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new NumericalBackendError("invalid-input", "Numerical input must contain plain objects and arrays only.");
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > remaining || (array && (value.length > remaining || keys.length !== value.length + 1))) {
      throw new NumericalBackendError("invalid-input", "Numerical input arrays must be dense and contain no extra fields.");
    }
    const result: unknown[] | Record<string, unknown> = array ? [] : Object.create(null);
    ancestors.add(value);
    for (const key of keys) {
      if (array && key === "length") continue;
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || key === "toJSON" || !field || !("value" in field) || !field.enumerable ||
          (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
        throw new NumericalBackendError("invalid-input", "Numerical input requires string-keyed enumerable data fields without accessors.");
      }
      textRemaining -= key.length;
      if (textRemaining < 0) throw new NumericalBackendError("invalid-input", "Numerical input contains oversized field names.");
      (result as Record<string, unknown>)[key] = copy(field.value, depth + 1);
    }
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function backend(value: unknown): value is NumericalBackend {
  return object(value) && value.id === "arb-jet-v1" && value.policyVersion === "1" &&
    value.pythonFlint === "0.9.0" && value.flint === "3.6.0" && Object.keys(value).length === 4;
}

function enclosure(value: unknown): boolean {
  return object(value) && [value.min, value.max].every((bound) => typeof bound === "string" && bound.length <= 8192 && /^-?\d+(?:\/[1-9]\d*)?$/.test(bound));
}

function certificate(value: unknown, identity: NumericalBackend): value is NumericalCertificate {
  if (!object(value) || value.version !== "1" || !backend(value.backend) || JSON.stringify(value.backend) !== JSON.stringify(identity) ||
      value.precision !== 192 || !Number.isInteger(value.depth) || (value.depth as number) < 0 || (value.depth as number) > 32 ||
      !Number.isInteger(value.nodeCount) || (value.nodeCount as number) < 1 || (value.nodeCount as number) > 256 ||
      typeof value.renderedExpression !== "string" || value.renderedExpression.length > 32768 || !object(value.input) ||
      !object(value.input.domain) || !object(value.input.expression) || !object(value.witnesses) ||
      !Array.isArray(value.cover) || value.cover.length < 1 || value.cover.length > 512 ||
      !Array.isArray(value.probes) || value.probes.length !== 9) return false;
  const point = (entry: unknown) => object(entry) && typeof entry.x === "string" && enclosure(entry.second);
  return value.cover.every((entry) => object(entry) && typeof entry.min === "string" && typeof entry.max === "string" && enclosure(entry.second)) &&
    value.probes.every((entry) => point(entry) && enclosure((entry as Record<string, unknown>).value)) &&
    Object.entries(value.witnesses).every(([key, entry]) => (key === "positive" || key === "negative") && point(entry));
}

function parseResponse(text: string, count: number): readonly NumericalResult[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new NumericalBackendError("worker-error", "Native certifier returned invalid JSON."); }
  if (!object(data) || !backend(data.backend) || !Array.isArray(data.results) || data.results.length !== count || Object.keys(data).length !== 2) {
    throw new NumericalBackendError("worker-error", "Native certifier returned an incompatible batch envelope.");
  }
  const identity = data.backend;
  for (const result of data.results) {
    if (!object(result) || (result.status === "verified"
      ? !["convex", "concave", "neither"].includes(result.label as string) || !certificate(result.certificate, identity) || result.certificate.input.claimedLabel !== result.label
      : !["unverified", "rejected", "excluded"].includes(result.status as string) || typeof result.reason !== "string" || result.reason.length > 256)) {
      throw new NumericalBackendError("worker-error", "Native certifier returned an incompatible reference outcome.");
    }
  }
  return freezeData(data.results as NumericalResult[]);
}

async function boundedText(stream: ReadableStream<Uint8Array>, limit: number, stop: (error: NumericalBackendError) => void): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        const error = new NumericalBackendError("resource-limit", "Native certifier exceeded its output budget.");
        stop(error);
        throw error;
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new NumericalBackendError("worker-error", "Native certifier returned malformed UTF-8."); }
}

export async function certifyReferences(references: readonly unknown[], signal?: AbortSignal): Promise<readonly NumericalResult[]> {
  if (signal?.aborted) throw new NumericalBackendError("cancelled", "Numerical certification was cancelled.");
  if (!Array.isArray(references) || references.length < 1 || references.length > NUMERICAL_BATCH_LIMIT) {
    throw new NumericalBackendError("invalid-input", `A numerical batch requires 1 through ${NUMERICAL_BATCH_LIMIT} references.`);
  }
  const copied = snapshot(references);
  const count = (copied as unknown[]).length;
  const input = new TextEncoder().encode(JSON.stringify({ action: "certify", references: copied }));
  if (input.byteLength > MAX_INPUT_BYTES) throw new NumericalBackendError("invalid-input", "Numerical input exceeds the 2 MiB batch limit.");
  try { await access(interpreter, constants.X_OK); await access(worker, constants.R_OK); }
  catch { throw new NumericalBackendError("unavailable", "Native certifier is not installed. Run bun run numerics:setup from the repository root."); }
  if (signal?.aborted) throw new NumericalBackendError("cancelled", "Numerical certification was cancelled.");

  let child: Bun.Subprocess<Uint8Array, "pipe", "pipe">;
  try {
    child = Bun.spawn([interpreter, "-I", worker], {
      stdin: input, stdout: "pipe", stderr: "pipe", cwd: fileURLToPath(service), env: { LANG: "C.UTF-8" },
    });
  } catch { throw new NumericalBackendError("unavailable", "Cannot start native certifier. Run bun run numerics:setup and check the local Python runtime."); }
  let failure: NumericalBackendError | undefined;
  const stop = (error: NumericalBackendError) => {
    failure ??= error;
    if (child.exitCode === null) child.kill("SIGKILL");
  };
  const cancel = () => stop(new NumericalBackendError("cancelled", "Numerical certification was cancelled."));
  const timer = setTimeout(() => stop(new NumericalBackendError("timeout", "Native certification exceeded its 60 second deadline.")), DEADLINE_MS);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const stdout = boundedText(child.stdout, MAX_OUTPUT_BYTES, stop);
  const stderr = boundedText(child.stderr, MAX_STDERR_BYTES, stop);
  try {
    const [output, errors, exit] = await Promise.all([stdout, stderr, child.exited]);
    if (failure) throw failure;
    if (exit !== 0 || errors.trim() !== "") {
      throw new NumericalBackendError("worker-error", `Native certifier failed (exit ${exit}). Run bun run numerics:setup and bun run numerics:test to inspect the runtime.`);
    }
    return parseResponse(output, count);
  } catch (error) {
    if (failure) throw failure;
    if (error instanceof NumericalBackendError) throw error;
    throw new NumericalBackendError("worker-error", "Native certifier process I/O failed.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (child.exitCode === null) child.kill("SIGKILL");
    await Promise.allSettled([stdout, stderr, child.exited]);
  }
}

export async function certifyReference(input: unknown, signal?: AbortSignal): Promise<NumericalResult> {
  return (await certifyReferences([input], signal))[0];
}

function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!object(actual) || !object(expected) || Array.isArray(actual) !== Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    return actual.length === expected.length && actual.every((value, index) => sameData(value, expected[index]));
  }
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every((key) => Object.hasOwn(actual, key) && sameData(actual[key], expected[key]));
}

export async function checkNumericalCertificate(input: unknown, retained: unknown): Promise<boolean> {
  let copied: unknown;
  try { copied = snapshot(retained); } catch { return false; }
  try {
    const result = await certifyReference(input);
    return result.status === "verified" && sameData(copied, result.certificate);
  } catch (error) {
    if (error instanceof NumericalBackendError && error.code === "invalid-input") return false;
    throw error;
  }
}
