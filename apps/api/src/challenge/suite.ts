// Generates and fully replays the two fixed challenge populations without replacing historical suites.
import { createHash } from "node:crypto";
import { certifyReferences } from "../numerics/backend";
import { provedDistinct } from "../numerics/suite";
import { getProfile, type ProfileId } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { freezeData, SuiteInputError } from "../suites/generator";
import type { Coverage } from "../suites/types";
import { measure } from "./algebra";
import { createChallengeCandidates } from "./candidates";
import type { ChallengeAttempt, ChallengeCase, ChallengeGenerationResult, ChallengePopulation, ChallengeRequest, ChallengeSuite, FamilyCoverage } from "./types";

const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function getChallengeRequest(population: ChallengePopulation = "confirmation", profileId: ProfileId = "one-shot-json-v1"): ChallengeRequest {
  if (population !== "confirmation" && population !== "screening") throw new SuiteInputError("Challenge population must be confirmation or screening.");
  getProfile(profileId);
  const candidates = createChallengeCandidates(population);
  return freezeData({
    seed: population === "confirmation" ? "coconut-challenge-confirmation-v1" : "coconut-challenge-screening-v1",
    population, depths: [...new Set(candidates.map((candidate) => measure(candidate.reference.expression).depth))].sort((a, b) => a - b),
    casesPerClass: population === "confirmation" ? 24 : 3, profileId, purpose: "evaluation",
  });
}

export const DEFAULT_CHALLENGE_REQUEST = getChallengeRequest();

function sameData(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false;
  const array = Array.isArray(actual);
  if (array !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  return keys.every((key) => {
    const field = Object.getOwnPropertyDescriptor(actual, key);
    return field && "value" in field && sameData(field.value, Reflect.get(expected, key));
  });
}

export function parseChallengeRequest(input: unknown): ChallengeRequest {
  try {
    const data = readDataRecord(input, "Challenge request");
    requireFields(data, ["seed", "population", "depths", "casesPerClass", "profileId", "purpose"]);
    if (data.population !== "confirmation" && data.population !== "screening") throw new SuiteInputError("Unknown challenge population.");
    const profile = getProfile(data.profileId);
    const expected = getChallengeRequest(data.population, profile.id);
    if (!sameData(data, expected)) throw new SuiteInputError("Challenge request differs from its fixed versioned population.");
    return expected;
  } catch (error) {
    if (error instanceof SuiteInputError) throw error;
    throw new SuiteInputError(error instanceof Error ? error.message : "Invalid challenge request.");
  }
}

export async function generateChallengeSuite(input: unknown = DEFAULT_CHALLENGE_REQUEST, signal?: AbortSignal): Promise<ChallengeGenerationResult> {
  const request = parseChallengeRequest(input);
  const candidates = createChallengeCandidates(request.population);
  const coverage: Coverage[] = [];
  const familyCoverage: FamilyCoverage[] = [];
  for (const candidate of candidates) {
    const depth = measure(candidate.reference.expression).depth, label = candidate.reference.claimedLabel;
    const existing = coverage.find((entry) => entry.depth === depth && entry.label === label);
    if (existing) coverage[coverage.indexOf(existing)] = { ...existing, requested: existing.requested + 1 };
    else coverage.push({ depth, label, requested: 1, accepted: 0 });
    const family = familyCoverage.find((entry) => entry.family === candidate.family && entry.label === label);
    if (family) familyCoverage[familyCoverage.indexOf(family)] = { ...family, requested: family.requested + 1 };
    else familyCoverage.push({ family: candidate.family, label, requested: 1, accepted: 0 });
  }
  coverage.sort((a, b) => a.depth - b.depth);
  const cases: ChallengeCase[] = [], attempts: ChallengeAttempt[] = [], rejections: Record<string, number> = {};
  const summary = () => ({ attempts: attempts.length, accepted: cases.length, rejections: { ...rejections }, coverage });
  const incomplete = (reason: "cancelled" | "candidate-rejected"): ChallengeGenerationResult => freezeData({
    status: "incomplete", reason, request, cases, summary: summary(), familyCoverage, attempts,
  });

  for (let start = 0; start < candidates.length; start += 64) {
    if (signal?.aborted) return incomplete("cancelled");
    const batch = candidates.slice(start, start + 64);
    let results;
    try { results = await certifyReferences(batch.map((candidate) => candidate.reference), signal); }
    catch (error) {
      if (!signal?.aborted) throw error;
      for (const candidate of batch) attempts.push({ ...candidate, ...attemptCoordinates(candidate), outcome: "rejected", reason: "cancelled" });
      rejections.cancelled = (rejections.cancelled ?? 0) + batch.length;
      return incomplete("cancelled");
    }
    for (let index = 0; index < batch.length; index++) {
      const candidate = batch[index], result = results[index], coordinates = attemptCoordinates(candidate);
      let reason: string | null = result.status === "verified" ? null : `${result.status}:${result.reason}`;
      if (result.status === "verified") {
        if (result.label !== coordinates.label) reason = "label-mismatch";
        else if (result.certificate.depth !== coordinates.depth || result.certificate.nodeCount !== measure(candidate.reference.expression).nodes) reason = "structure-mismatch";
        else if (cases.some((other) => other.reference.domain.min === result.certificate.input.domain.min &&
          other.reference.domain.max === result.certificate.input.domain.max && !provedDistinct(other.certificate, result.certificate))) reason = "distinctness-unproved";
        if (reason === null) {
          cases.push({
            id: `case-challenge-v1-${digest({ backend: result.certificate.backend, reference: result.certificate.input })}`,
            reference: result.certificate.input, family: candidate.family, clusterId: candidate.clusterId,
            depth: coordinates.depth, label: coordinates.label, ordinal: candidate.clusterIndex, attempt: 0,
            certificate: result.certificate, analyticCertificate: candidate.analyticCertificate,
          });
          const depthIndex = coverage.findIndex((entry) => entry.depth === coordinates.depth && entry.label === coordinates.label);
          coverage[depthIndex] = { ...coverage[depthIndex], accepted: coverage[depthIndex].accepted + 1 };
          const familyIndex = familyCoverage.findIndex((entry) => entry.family === candidate.family && entry.label === coordinates.label);
          familyCoverage[familyIndex] = { ...familyCoverage[familyIndex], accepted: familyCoverage[familyIndex].accepted + 1 };
        }
      }
      attempts.push({ ...candidate, ...coordinates, outcome: reason === null ? "accepted" : "rejected", reason });
      if (reason !== null) rejections[reason] = (rejections[reason] ?? 0) + 1;
    }
  }
  if (signal?.aborted) return incomplete("cancelled");
  if (cases.length !== candidates.length) return incomplete("candidate-rejected");
  const backend = cases[0].certificate.backend;
  if (cases.some((entry) => digest(entry.certificate.backend) !== digest(backend))) throw new Error("Native backend identity changed during challenge generation.");
  const content: Omit<ChallengeSuite, "id"> = {
    formatVersion: "2", generatorVersion: "challenge-v1", depthPolicyVersion: "measured-operation-v1",
    verifierVersion: "arb-jet-v1", protocolVersion: "1", promptVersion: "smooth-v2", backend, request, cases,
    summary: summary(), distinctness: "domain-or-disjoint-value-enclosures-v1", independentReferencePolicy: "analytic-curvature-v1",
    familyCoverage, attempts,
  };
  return freezeData({ status: "complete", suite: { ...content, id: `suite-challenge-v1-${digest(content)}` } });
}

function attemptCoordinates(candidate: ReturnType<typeof createChallengeCandidates>[number]) {
  return { depth: measure(candidate.reference.expression).depth, label: candidate.reference.claimedLabel, ordinal: candidate.clusterIndex, attempt: 0 as const };
}

export async function validateChallengeSuite(input: unknown): Promise<ChallengeSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected a challenge suite object.");
  const field = Object.getOwnPropertyDescriptor(input, "request");
  if (!field || !("value" in field)) throw new SuiteInputError("Challenge suite must retain its request as data.");
  const regenerated = await generateChallengeSuite(field.value);
  if (regenerated.status !== "complete") throw new SuiteInputError("Challenge coverage could not be reproduced.");
  if (!sameData(input, regenerated.suite)) throw new SuiteInputError("Challenge suite differs from its versioned reproduction.");
  return regenerated.suite;
}
