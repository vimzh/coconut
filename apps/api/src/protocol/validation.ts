// Rejects malformed internal protocol envelopes without attributing them to a model.
export type ProtocolErrorCode =
  | "invalid-input"
  | "unknown-profile"
  | "unverified-reference"
  | "workload-limit";

export class ProtocolInputError extends Error {
  constructor(public readonly code: ProtocolErrorCode, message: string) {
    super(message);
    this.name = "ProtocolInputError";
  }
}

export function readDataRecord(input: unknown, name: string): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    throw new ProtocolInputError("invalid-input", `${name} must be a plain data object.`);
  }
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !descriptor || !("value" in descriptor)) {
      throw new ProtocolInputError("invalid-input", `${name} must contain only string-keyed data fields.`);
    }
  }
  return input as Record<string, unknown>;
}

export function requireFields(input: Record<string, unknown>, expected: readonly string[]): void {
  const keys = Object.getOwnPropertyNames(input);
  if (keys.length !== expected.length || expected.some((key) => !Object.hasOwn(input, key))) {
    throw new ProtocolInputError("invalid-input", `Expected exactly these fields: ${expected.join(", ")}.`);
  }
}
