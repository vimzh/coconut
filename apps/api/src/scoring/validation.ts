// Strict data readers and extractor replay for retained scoring evidence.
import { extractAnswer, PROTOCOL_VERSION, type AnswerOutcome, type ProfileId } from "../protocol";
import { ProtocolInputError, readDataRecord, requireFields } from "../protocol/validation";

export const MAX_RETAINED_REPLY_CODE_UNITS = 131_072;
export const MAX_PROVIDER_ERROR_CODE_UNITS = 4_096;
export const MAX_RETAINED_TEXT_CODE_UNITS = 16_777_216;

export class ScoringInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringInputError";
  }
}

export function record(input: unknown, name: string, fields?: readonly string[]): Record<string, unknown> {
  try {
    const value = readDataRecord(input, name);
    if (fields) requireFields(value, fields);
    return value;
  } catch (error) {
    if (error instanceof ProtocolInputError) throw new ScoringInputError(`${name}: ${error.message}`);
    throw error;
  }
}

export function array(input: unknown, name: string, maximum: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
      input.length > maximum || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new ScoringInputError(`${name} must be a dense ordinary array with at most ${maximum} entries.`);
  }
  const values: unknown[] = [];
  for (let index = 0; index < input.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !("value" in descriptor)) throw new ScoringInputError(`${name} must contain only data entries.`);
    values.push(descriptor.value);
  }
  return values;
}

export function text(input: unknown, name: string, maximum = 512): string {
  if (typeof input !== "string" || input.trim() === "" || !input.isWellFormed() || input.length > maximum) {
    throw new ScoringInputError(`${name} must be a nonblank, well-formed string of at most ${maximum} code units.`);
  }
  return input;
}

export function integer(input: unknown, name: string, minimum = 0): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < minimum) {
    throw new ScoringInputError(`${name} must be a safe integer of at least ${minimum}.`);
  }
  return input;
}

export function duration(input: unknown, name: string): number | null {
  if (input === null) return null;
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) {
    throw new ScoringInputError(`${name} must be a finite nonnegative millisecond duration or null.`);
  }
  return input;
}

export function outcome(input: unknown, profileId: ProfileId): AnswerOutcome {
  const data = record(input, "Attempt outcome");
  const common = ["protocolVersion", "profileId", "rawText", "kind"];
  const kind = data.kind;
  const extra = kind === "answer" ? ["label", "explanation"] : kind === "invalid" ? ["reason"] : kind === "provider-error" ? ["message"] : [];
  record(data, "Attempt outcome", [...common, ...extra]);
  if (data.protocolVersion !== PROTOCOL_VERSION || data.profileId !== profileId || typeof data.rawText !== "string") {
    throw new ScoringInputError("Attempt outcome must retain the selected protocol/profile and raw text.");
  }
  if (data.rawText.length > MAX_RETAINED_REPLY_CODE_UNITS) {
    throw new ScoringInputError(`Retained raw reply exceeds ${MAX_RETAINED_REPLY_CODE_UNITS} UTF-16 code units; evidence cannot be scored without a new retention contract.`);
  }
  if (kind === "provider-error" && (typeof data.message !== "string" || data.message.length > MAX_PROVIDER_ERROR_CODE_UNITS)) {
    throw new ScoringInputError(`Provider error message must be a string of at most ${MAX_PROVIDER_ERROR_CODE_UNITS} UTF-16 code units.`);
  }
  if (!["answer", "invalid", "refused", "truncated", "interrupted", "cancelled", "provider-error"].includes(kind as string)) {
    throw new ScoringInputError("Attempt outcome kind is unsupported.");
  }
  const reply = kind === "provider-error"
    ? { status: kind, text: data.rawText, message: data.message }
    : { status: kind === "answer" || kind === "invalid" ? "completed" : kind, text: data.rawText };
  const replayed = extractAnswer(reply, profileId);
  if (Object.entries(replayed).some(([key, value]) => data[key] !== value)) {
    throw new ScoringInputError("Retained answer outcome differs from extractor replay; preserve the original state and raw reply.");
  }
  return replayed;
}
