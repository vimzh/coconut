// Dispatches artifact versions without changing the retained exact-engine replay path.
import { validateNumericalSuite } from "../numerics/manifest";
import { SuiteInputError } from "./generator";
import { validateFrozenSuite } from "./manifest";

export async function validateSuiteArtifact(input: unknown) {
  const version = input !== null && typeof input === "object" ? Object.getOwnPropertyDescriptor(input, "formatVersion") : undefined;
  if (!version || !("value" in version)) throw new SuiteInputError("Suite requires a format version as data.");
  if (version.value === "1") return validateFrozenSuite(input);
  if (version.value === "2") return validateNumericalSuite(input);
  throw new SuiteInputError("Unsupported suite format version.");
}
