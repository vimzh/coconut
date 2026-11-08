// Dispatches artifact versions without changing the retained exact-engine replay path.
import { validateNumericalSuite } from "../numerics/manifest";
import { validateChallengeSuite } from "../challenge";
import { validateInteriorSuite } from "../interior";
import { validateReserveSuite } from "../reserve";
import { validateCompositionSuite } from "../composition";
import { SuiteInputError } from "./generator";
import { validateFrozenSuite } from "./manifest";

export async function validateSuiteArtifact(input: unknown) {
  const version = input !== null && typeof input === "object" ? Object.getOwnPropertyDescriptor(input, "formatVersion") : undefined;
  if (!version || !("value" in version)) throw new SuiteInputError("Suite requires a format version as data.");
  if (version.value === "1") return validateFrozenSuite(input);
  if (version.value === "2") {
    const generator = Object.getOwnPropertyDescriptor(input, "generatorVersion");
    if (generator && !("value" in generator)) throw new SuiteInputError("Suite generator version must be data.");
    if (generator?.value === "interior-v1") return validateInteriorSuite(input);
    if (generator?.value === "composition-v1") return validateCompositionSuite(input);
    if (generator?.value === "reserve-v1") return validateReserveSuite(input);
    return generator?.value === "challenge-v1" ? validateChallengeSuite(input) : validateNumericalSuite(input);
  }
  throw new SuiteInputError("Unsupported suite format version.");
}
