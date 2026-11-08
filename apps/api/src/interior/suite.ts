// Generates and strictly replays a separate exploratory population without replacing earlier suites.
import { createHash } from "node:crypto";
import { certifyReferences, NUMERICAL_BATCH_LIMIT } from "../numerics/backend";
import { provedDistinct } from "../numerics/suite";
import { getProfile, type ProfileId } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { freezeData, SuiteInputError } from "../suites/generator";
import type { Coverage } from "../suites/types";
import { cmp, measure, q } from "../challenge/algebra";
import { createInteriorCandidates } from "./candidates";
import { curvatureAt, sourcePolynomial } from "./reference";
import type { InteriorAttempt, InteriorCase, InteriorDesignRevision, InteriorGenerationResult, InteriorRequest, InteriorSuite, InteriorFamilyCoverage } from "./types";

const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
let fixedDesignRevisions: readonly InteriorDesignRevision[] | undefined;

export function getInteriorRequest(profileId: ProfileId = "one-shot-json-v1"): InteriorRequest {
  getProfile(profileId);
  return freezeData({ seed: "coconut-interior-exploratory-v1", population: "exploratory", depths: [13], casesPerClass: 24, profileId, purpose: "evaluation" });
}

export const DEFAULT_INTERIOR_REQUEST = getInteriorRequest();

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
    return field && "value" in field && field.enumerable === Object.getOwnPropertyDescriptor(expected, key)?.enumerable && sameData(field.value, Reflect.get(expected, key));
  });
}

export function parseInteriorRequest(input: unknown): InteriorRequest {
  try {
    const data = readDataRecord(input, "Interior request");
    requireFields(data, ["seed", "population", "depths", "casesPerClass", "profileId", "purpose"]);
    if (data.population !== "exploratory") throw new SuiteInputError("Interior population must be exploratory.");
    const profile = getProfile(data.profileId);
    const expected = getInteriorRequest(profile.id);
    if (!sameData(data, expected)) throw new SuiteInputError("Interior request differs from its fixed versioned population.");
    return expected;
  } catch (error) {
    if (error instanceof SuiteInputError) throw error;
    throw new SuiteInputError(error instanceof Error ? error.message : "Invalid interior request.");
  }
}

export async function generateInteriorSuite(input: unknown = DEFAULT_INTERIOR_REQUEST, signal?: AbortSignal): Promise<InteriorGenerationResult> {
  const request = parseInteriorRequest(input);
  if (signal?.aborted) return freezeData({ status: "incomplete", reason: "cancelled", request, cases: [], summary: { attempts: 0, accepted: 0, rejections: {}, coverage: [] }, familyCoverage: [], attempts: [] });
  const candidates = createInteriorCandidates();
  const coverage: Coverage[] = [];
  const familyCoverage: InteriorFamilyCoverage[] = [];
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
  const cases: InteriorCase[] = [], attempts: InteriorAttempt[] = [], rejections: Record<string, number> = {};
  const summary = () => ({ attempts: attempts.length, accepted: cases.length, rejections: { ...rejections }, coverage });
  const incomplete = (reason: "cancelled" | "candidate-rejected"): InteriorGenerationResult => freezeData({
    status: "incomplete", reason, request, cases, summary: summary(), familyCoverage, attempts,
  });

  for (let start = 0; start < candidates.length; start += NUMERICAL_BATCH_LIMIT) {
    if (signal?.aborted) return incomplete("cancelled");
    const batch = candidates.slice(start, start + NUMERICAL_BATCH_LIMIT);
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
            id: `case-interior-v1-${digest({ backend: result.certificate.backend, reference: result.certificate.input })}`,
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
  if (cases.some((entry) => digest(entry.certificate.backend) !== digest(backend))) throw new Error("Native backend identity changed during interior generation.");
  // Historical nonmembers remain separate from current membership and admission denominators.
  let designRevisions: readonly InteriorDesignRevision[];
  try { designRevisions = await replayDesignRevisions(candidates, signal); }
  catch (error) { if (signal?.aborted) return incomplete("cancelled"); throw error; }
  if (signal?.aborted) return incomplete("cancelled");
  const content: Omit<InteriorSuite, "id"> = {
    formatVersion: "2", generatorVersion: "interior-v1", depthPolicyVersion: "measured-operation-v1",
    verifierVersion: "arb-jet-v1", protocolVersion: "1", promptVersion: "smooth-v2", backend, request, cases,
    summary: summary(), distinctness: "domain-or-disjoint-value-enclosures-v1", independentReferencePolicy: "interior-bernstein-taylor-v1",
    familyCoverage, attempts, designRevisions,
  };
  return freezeData({ status: "complete", suite: { ...content, id: `suite-interior-v1-${digest(content)}` } });
}

async function replayDesignRevisions(candidates: ReturnType<typeof createInteriorCandidates>, signal?: AbortSignal): Promise<readonly InteriorDesignRevision[]> {
  const revisions = fixedDesignRevisions ??= createDesignRevisions(candidates);
  const results = await certifyReferences(revisions.map((entry) => entry.reference), signal);
  if (results.some((result) => result.status !== "rejected" || result.reason !== "label-mismatch")) throw new Error("Historical rejected domain did not replay its label mismatch.");
  return revisions;
}

function createDesignRevisions(candidates: ReturnType<typeof createInteriorCandidates>): readonly InteriorDesignRevision[] {
  const previous = candidates.filter((entry) => entry.family === "quintic-reciprocal" && entry.reference.claimedLabel === "concave");
  const references = previous.map((entry) => ({ ...entry.reference, domain: { min: "1/2", max: "5/8" } }));
  return freezeData(previous.map((entry, i) => {
    const independentWitnesses = [{ x: "2049/4096", min: "1/1024", max: "1/2" }, { x: "9/16", min: "-4", max: "-2" }];
    for (const witness of independentWitnesses) {
      const actual = curvatureAt("quintic-reciprocal", sourcePolynomial(entry.clusterIndex), q(witness.x));
      if (cmp(q(witness.min), actual.min) > 0 || cmp(actual.max, q(witness.max)) > 0) throw new Error("Historical domain counterexample did not replay.");
    }
    return { clusterIndex: entry.clusterIndex, reference: references[i], outcome: { status: "rejected", reason: "label-mismatch" }, actualLabel: "neither", independentWitnesses, replacementDomain: { min: "17/32", max: "5/8" } };
  }));
}

function attemptCoordinates(candidate: ReturnType<typeof createInteriorCandidates>[number]) {
  return { depth: measure(candidate.reference.expression).depth, label: candidate.reference.claimedLabel, ordinal: candidate.clusterIndex, attempt: 0 as const };
}

export async function validateInteriorSuite(input: unknown): Promise<InteriorSuite> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new SuiteInputError("Expected an interior suite object.");
  const field = Object.getOwnPropertyDescriptor(input, "request");
  if (!field || !("value" in field)) throw new SuiteInputError("Interior suite must retain its request as data.");
  const regenerated = await generateInteriorSuite(field.value);
  if (regenerated.status !== "complete") throw new SuiteInputError("Interior coverage could not be reproduced.");
  if (!sameData(input, regenerated.suite)) throw new SuiteInputError("Interior suite differs from its versioned reproduction.");
  return regenerated.suite;
}
