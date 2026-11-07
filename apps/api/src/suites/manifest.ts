// Replays the declared generator and compares all retained data before trusting a suite.
import { generateSuite, SuiteInputError } from "./generator";
import type { FrozenSuite } from "./types";

// Walk the bounded expected shape, never arbitrary uploaded descendants or getters.
function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (Array.isArray(actual) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    if (!descriptor || !("value" in descriptor) || !sameData(descriptor.value, Reflect.get(expected, key))) return false;
  }
  return true;
}

export async function validateFrozenSuite(input: unknown): Promise<FrozenSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SuiteInputError("Frozen suite must be a plain data object.");
  }
  const request = Object.getOwnPropertyDescriptor(input, "request");
  if (!request || !("value" in request)) throw new SuiteInputError("Frozen suite must retain its request as data.");
  const regenerated = await generateSuite(request.value);
  if (regenerated.status !== "complete") throw new SuiteInputError("Declared coverage could not be reproduced.");
  if (!sameData(input, regenerated.suite)) {
    throw new SuiteInputError("Frozen suite differs from its versioned reproduction; reject altered membership, evidence, or identity.");
  }
  return regenerated.suite;
}
