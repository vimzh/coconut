// Freeze and replay the fixed composition population with separate exact and native references.
import { createHash } from "node:crypto";
import { certifyReferences } from "../numerics/backend";
import { provedDistinct } from "../numerics/suite";
import type { NumericalCase, NumericalSuite } from "../numerics/types";
import { getProfile, type ProfileId } from "../protocol";
import { freezeData, SuiteInputError } from "../suites/generator";
import type { Coverage } from "../suites/types";
import { createCompositionCandidates, type CompositionCandidate } from "./candidates";

export interface CompositionRequest {
  readonly seed: "coconut-composition-v1";
  readonly population: "exploratory";
  readonly depths: readonly number[];
  readonly casesPerClass: 9;
  readonly profileId: ProfileId;
  readonly purpose: "evaluation";
}
export interface CompositionCase extends NumericalCase, Omit<CompositionCandidate, "depth" | "family" | "id" | "reference"> {}
interface CompositionAttempt extends CompositionCandidate { readonly label: NumericalCase["label"]; readonly ordinal: number; readonly attempt: 0; readonly outcome: "accepted" | "rejected"; readonly reason: string | null }
export interface CompositionSuite extends Omit<NumericalSuite, "generatorVersion" | "depthPolicyVersion" | "request" | "cases" | "attempts" | "distinctness"> {
  readonly generatorVersion: "composition-v1";
  readonly depthPolicyVersion: "nonlinear-chain-and-ast-v1";
  readonly request: CompositionRequest;
  readonly cases: readonly CompositionCase[];
  readonly attempts: readonly CompositionAttempt[];
  readonly distinctness: "disjoint-value-enclosures-v1";
  readonly independentReferencePolicy: "exact-atom-chain-v1";
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function getCompositionRequest(profileId: ProfileId = "one-shot-json-v1"): CompositionRequest {
  getProfile(profileId);
  return freezeData({ seed: "coconut-composition-v1", population: "exploratory", depths: [7, 13, 19], casesPerClass: 9, profileId, purpose: "evaluation" });
}

function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (Array.isArray(actual) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(expected);
  return Reflect.ownKeys(actual).length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return descriptor && "value" in descriptor && sameData(descriptor.value, Reflect.get(expected, key));
  });
}

function parseRequest(input: unknown): CompositionRequest {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected a composition request.");
  const descriptor = Object.getOwnPropertyDescriptor(input, "profileId");
  if (!descriptor || !("value" in descriptor)) throw new SuiteInputError("Composition profile must be retained as data.");
  const expected = getCompositionRequest(getProfile(descriptor.value).id);
  if (!sameData(input, expected)) throw new SuiteInputError("Composition request differs from its fixed population.");
  return expected;
}

export async function generateCompositionSuite(input: unknown = getCompositionRequest(), signal?: AbortSignal) {
  const request = parseRequest(input), candidates = createCompositionCandidates();
  const coverage: Coverage[] = request.depths.flatMap(depth => (["convex", "concave", "neither"] as const).map(label => ({ depth, label, requested: 3, accepted: 0 })));
  const cases: CompositionCase[] = [], attempts: CompositionAttempt[] = [], rejections: Record<string, number> = {};
  const summary = () => ({ attempts: attempts.length, accepted: cases.length, rejections: { ...rejections }, coverage });
  const incomplete = (reason: "cancelled" | "candidate-rejected") => freezeData({ status: "incomplete" as const, reason, request, cases, attempts, summary: summary() });
  if (signal?.aborted) return incomplete("cancelled");
  let results;
  try { results = await certifyReferences(candidates.map(row => row.reference), signal); }
  catch (error) {
    if (signal?.aborted) return incomplete("cancelled");
    throw error;
  }
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index], result = results[index], label = candidate.reference.claimedLabel;
    let reason: string | null = result.status === "verified" ? null : `${result.status}:${result.reason}`;
    if (result.status === "verified") {
      if (result.label !== label || result.certificate.depth !== candidate.depth) reason = "reference-mismatch";
      else if (cases.some(other => !provedDistinct(other.certificate, result.certificate))) reason = "distinctness-unproved";
      if (reason === null) {
        cases.push({ ...candidate, label, ordinal: Math.floor(index / 3), attempt: 0, certificate: result.certificate });
        const cell = coverage.findIndex(row => row.depth === candidate.depth && row.label === label);
        coverage[cell] = { ...coverage[cell], accepted: coverage[cell].accepted + 1 };
      }
    }
    attempts.push({ ...candidate, label, ordinal: Math.floor(index / 3), attempt: 0, outcome: reason === null ? "accepted" : "rejected", reason });
    if (reason !== null) rejections[reason] = (rejections[reason] ?? 0) + 1;
  }
  if (signal?.aborted) return incomplete("cancelled");
  if (cases.length !== 27) return incomplete("candidate-rejected");
  const backend = cases[0].certificate.backend;
  if (cases.some(row => digest(row.certificate.backend) !== digest(backend))) throw new Error("Native backend identity changed.");
  const content: Omit<CompositionSuite, "id"> = {
    formatVersion: "2", generatorVersion: "composition-v1", depthPolicyVersion: "nonlinear-chain-and-ast-v1",
    verifierVersion: "arb-jet-v1", protocolVersion: "1", promptVersion: "smooth-v2", backend, request, cases, attempts,
    summary: summary(), distinctness: "disjoint-value-enclosures-v1", independentReferencePolicy: "exact-atom-chain-v1",
  };
  return freezeData({ status: "complete" as const, suite: { ...content, id: `suite-composition-v1-${digest(content)}` } });
}

export async function validateCompositionSuite(input: unknown): Promise<CompositionSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected a composition suite.");
  const descriptor = Object.getOwnPropertyDescriptor(input, "request");
  if (!descriptor || !("value" in descriptor)) throw new SuiteInputError("Composition request must be retained as data.");
  const result = await generateCompositionSuite(descriptor.value);
  if (result.status !== "complete" || !sameData(input, result.suite)) throw new SuiteInputError("Composition suite differs from full reproduction.");
  return result.suite;
}
