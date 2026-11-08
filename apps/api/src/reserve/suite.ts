// One bounded native batch admits the canonical reserve; strict replay compares every retained field.
import { createHash } from "node:crypto";
import { measure } from "../challenge/algebra";
import { certifyReferences } from "../numerics/backend";
import { provedDistinct } from "../numerics/suite";
import { getProfile, type ProfileId } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { freezeData, SuiteInputError } from "../suites/generator";
import type { Coverage } from "../suites/types";
import { createReserveCandidates } from "./candidates";
import { exactSourceSeparation } from "./reference";
import { RESERVE_FAMILIES, type ReserveAttempt, type ReserveCase, type ReserveFamilyCoverage, type ReserveGenerationResult, type ReserveRequest, type ReserveSuite } from "./types";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function getReserveRequest(profileId: ProfileId = "one-shot-json-v1"): ReserveRequest {
  getProfile(profileId);
  return freezeData({ seed: "coconut-reserve-exploratory-v1", population: "exploratory", depths: [17, 23], casesPerClass: 6, profileId, purpose: "evaluation" });
}

export const DEFAULT_RESERVE_REQUEST = getReserveRequest();

function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false;
  const array = Array.isArray(actual), prototype = Object.getPrototypeOf(actual);
  if (array !== Array.isArray(expected) || (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  return keys.every((key) => {
    const field = Object.getOwnPropertyDescriptor(actual, key);
    return field && "value" in field && field.enumerable === Object.getOwnPropertyDescriptor(expected, key)?.enumerable && sameData(field.value, Reflect.get(expected, key));
  });
}

export function parseReserveRequest(input: unknown): ReserveRequest {
  try {
    const data = readDataRecord(input, "Reserve request");
    requireFields(data, ["seed", "population", "depths", "casesPerClass", "profileId", "purpose"]);
    const expected = getReserveRequest(getProfile(data.profileId).id);
    if (!sameData(data, expected)) throw new SuiteInputError("Reserve request differs from its fixed exploratory population.");
    return expected;
  } catch (error) {
    if (error instanceof SuiteInputError) throw error;
    throw new SuiteInputError(error instanceof Error ? error.message : "Invalid reserve request.");
  }
}

export async function generateReserveSuite(input: unknown = DEFAULT_RESERVE_REQUEST, signal?: AbortSignal): Promise<ReserveGenerationResult> {
  const request = parseReserveRequest(input);
  const cases: ReserveCase[] = [], attempts: ReserveAttempt[] = [], rejections: Record<string, number> = {};
  const coverage: Coverage[] = [17, 23].flatMap((depth) => (["convex", "concave", "neither"] as const).map((label) => ({ depth, label, requested: 3, accepted: 0 })));
  const familyCoverage: ReserveFamilyCoverage[] = RESERVE_FAMILIES.flatMap((family) => (["convex", "concave", "neither"] as const).map((label) => ({ family, label, requested: 2, accepted: 0 })));
  const summary = () => ({ attempts: attempts.length, accepted: cases.length, rejections: { ...rejections }, coverage });
  const incomplete = (reason: "cancelled" | "candidate-rejected"): ReserveGenerationResult => freezeData({ status: "incomplete", reason, request, cases, attempts, familyCoverage, summary: summary() });
  if (signal?.aborted) return incomplete("cancelled");
  const candidates = createReserveCandidates(), separation = exactSourceSeparation();
  let results;
  try { results = await certifyReferences(candidates.map((candidate) => candidate.reference), signal); }
  catch (error) {
    if (!signal?.aborted) throw error;
    for (const candidate of candidates) attempts.push({ ...candidate, ...coordinates(candidate), outcome: "rejected", reason: "cancelled" });
    rejections.cancelled = candidates.length;
    return incomplete("cancelled");
  }
  for (const [index, candidate] of candidates.entries()) {
    const result = results[index], point = coordinates(candidate);
    let reason: string | null = result.status === "verified" ? null : `${result.status}:${result.reason}`;
    if (result.status === "verified") {
      if (result.label !== point.label || !sameData(result.certificate.input, candidate.reference)) reason = "reference-mismatch";
      else if (result.certificate.depth !== point.depth || result.certificate.nodeCount !== measure(candidate.reference.expression).nodes) reason = "structure-mismatch";
      else if (cases.some((other) => !provedDistinct(other.certificate, result.certificate) && !sameOuterDifferentSource(other, candidate))) reason = "distinctness-unproved";
      if (reason === null) {
        cases.push({ id: `case-reserve-v1-${digest({ backend: result.certificate.backend, reference: result.certificate.input })}`,
          reference: result.certificate.input, certificate: result.certificate, analyticCertificate: candidate.analyticCertificate,
          family: candidate.family, clusterId: candidate.clusterId, ...point });
        const depthIndex = coverage.findIndex((row) => row.depth === point.depth && row.label === point.label);
        coverage[depthIndex] = { ...coverage[depthIndex], accepted: coverage[depthIndex].accepted + 1 };
        const familyIndex = familyCoverage.findIndex((row) => row.family === candidate.family && row.label === point.label);
        familyCoverage[familyIndex] = { ...familyCoverage[familyIndex], accepted: familyCoverage[familyIndex].accepted + 1 };
      }
    }
    attempts.push({ ...candidate, ...point, outcome: reason === null ? "accepted" : "rejected", reason });
    if (reason !== null) rejections[reason] = (rejections[reason] ?? 0) + 1;
  }
  if (signal?.aborted) return incomplete("cancelled");
  if (cases.length !== 18) return incomplete("candidate-rejected");
  const backend = cases[0].certificate.backend;
  if (cases.some((entry) => digest(entry.certificate.backend) !== digest(backend))) throw new Error("Native backend identity changed during reserve admission.");
  const content: Omit<ReserveSuite, "id"> = {
    formatVersion: "2", generatorVersion: "reserve-v1", depthPolicyVersion: "measured-operation-v1", verifierVersion: "arb-jet-v1",
    protocolVersion: "1", promptVersion: "smooth-v2", backend, request, cases, summary: summary(),
    distinctness: "native-probes-or-exact-source-value-v1", independentReferencePolicy: "reserve-bernstein-v1",
    exactSourceSeparation: separation, familyCoverage, attempts,
  };
  return freezeData({ status: "complete", suite: { ...content, id: `suite-reserve-v1-${digest(content)}` } });
}

function coordinates(candidate: ReturnType<typeof createReserveCandidates>[number]) {
  return { depth: measure(candidate.reference.expression).depth, label: candidate.reference.claimedLabel, ordinal: candidate.clusterIndex, attempt: 0 as const };
}

function sameOuterDifferentSource(other: ReserveCase, candidate: ReturnType<typeof createReserveCandidates>[number]): boolean {
  // Canonical AST reconstruction binds these operands to the separately checked strict anchor proof.
  return other.family === candidate.family && other.label === candidate.reference.claimedLabel && other.ordinal !== candidate.clusterIndex &&
    other.analyticCertificate.parameters.quadraticCoefficient === candidate.analyticCertificate.parameters.quadraticCoefficient;
}

export async function validateReserveSuite(input: unknown): Promise<ReserveSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected a reserve suite object.");
  const field = Object.getOwnPropertyDescriptor(input, "request");
  if (!field || !("value" in field)) throw new SuiteInputError("Reserve request must be retained as data.");
  const result = await generateReserveSuite(field.value);
  if (result.status !== "complete") throw new SuiteInputError("Reserve coverage could not be reproduced.");
  if (!sameData(input, result.suite)) throw new SuiteInputError("Reserve suite differs from its complete versioned reproduction.");
  return result.suite;
}
