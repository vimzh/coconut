// Reproduction, including native evidence and rejected candidates, is the artifact authority.
import { SuiteInputError } from "../suites/generator";
import { generateNumericalSuite } from "./suite";
import type { NumericalSuite } from "./types";

function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (Array.isArray(actual) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return descriptor && "value" in descriptor && sameData(descriptor.value, Reflect.get(expected, key));
  });
}

export async function validateNumericalSuite(input: unknown): Promise<NumericalSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected a numerical suite object.");
  const request = Object.getOwnPropertyDescriptor(input, "request");
  if (!request || !("value" in request)) throw new SuiteInputError("Numerical suite must retain its request as data.");
  const regenerated = await generateNumericalSuite(request.value);
  if (regenerated.status !== "complete") throw new SuiteInputError("Numerical coverage could not be reproduced.");
  if (!sameData(input, regenerated.suite)) throw new SuiteInputError("Numerical suite differs from its versioned reproduction.");
  return regenerated.suite;
}
