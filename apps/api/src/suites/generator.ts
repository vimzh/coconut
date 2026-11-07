// Builds bounded, reproducible suites; only the mathematical verifier admits cases.
import { createHash } from "node:crypto";
import { VERIFIER_VERSION, verifyReference, type Label } from "../math";
import { calculateWorkload, getProfile, PROTOCOL_VERSION } from "../protocol";
import { readDataRecord, requireFields } from "../protocol/validation";
import { createCandidate } from "./candidates";
import type { Coverage, FrozenSuite, GenerationResult, GenerationSummary, SuiteCase, SuiteRequest } from "./types";

export const GENERATOR_VERSION = "1";
export const MAX_CANDIDATES_PER_CASE = 12;
export const LABELS: readonly Label[] = Object.freeze(["convex", "concave", "neither"]);

export class SuiteInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuiteInputError";
  }
}

export function freezeData<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}

export const DEFAULT_SUITE_REQUEST: SuiteRequest = freezeData({
  seed: "coconut-reference-v1",
  depths: [5, 10, 20, 40, 80],
  casesPerClass: 5,
  profileId: "one-shot-json-v1",
  purpose: "evaluation",
});

export function parseSuiteRequest(input: unknown): SuiteRequest {
  try {
    const data = readDataRecord(input, "Suite request");
    requireFields(data, ["seed", "depths", "casesPerClass", "profileId", "purpose"]);
    if (typeof data.seed !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(data.seed)) {
      throw new SuiteInputError("Seed must contain 1–64 ASCII letters, digits, underscores, or hyphens.");
    }
    const depths = data.depths;
    if (!Array.isArray(depths) || Object.getPrototypeOf(depths) !== Array.prototype ||
        depths.length < 1 || depths.length > 76 ||
        Reflect.ownKeys(depths).length !== depths.length + 1) {
      throw new SuiteInputError("Depths must be a nonempty, dense array of distinct ascending integers from 5 through 80.");
    }
    const normalized: number[] = [];
    for (let index = 0; index < depths.length; index++) {
      const field = Object.getOwnPropertyDescriptor(depths, String(index));
      if (!field || !("value" in field) || !Number.isInteger(field.value) ||
          field.value < 5 || field.value > 80 || (index > 0 && field.value <= normalized[index - 1])) {
        throw new SuiteInputError("Depths must be distinct ascending integers from 5 through 80.");
      }
      normalized.push(field.value);
    }
    if (!Number.isInteger(data.casesPerClass) || (data.casesPerClass as number) < 1) {
      throw new SuiteInputError("Cases per class must be a positive integer.");
    }
    const casesPerClass = data.casesPerClass as number;
    const profile = getProfile(data.profileId);
    calculateWorkload(profile.id, normalized.length * LABELS.length * casesPerClass);
    if (data.purpose !== "evaluation" && data.purpose !== "illustration") {
      throw new SuiteInputError("Purpose must be evaluation or illustration.");
    }
    return freezeData({ seed: data.seed, depths: normalized, casesPerClass, profileId: profile.id, purpose: data.purpose });
  } catch (error) {
    if (error instanceof SuiteInputError) throw error;
    throw new SuiteInputError(error instanceof Error ? error.message : "Invalid suite request.");
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function generateSuite(input: unknown, signal?: AbortSignal): Promise<GenerationResult> {
  const request = parseSuiteRequest(input);
  const cases: SuiteCase[] = [];
  const semanticKeys = new Set<string>();
  const rejections: Record<string, number> = {};
  const coverage: Coverage[] = request.depths.flatMap((depth) => LABELS.map((label) => ({
    depth, label, requested: request.casesPerClass, accepted: 0,
  })));
  let attempts = 0;
  const summary = (): GenerationSummary => ({ attempts, accepted: cases.length, rejections: { ...rejections }, coverage });
  const incomplete = (reason: "cancelled" | "attempt-limit"): GenerationResult => freezeData({
    status: "incomplete", reason, request, cases, summary: summary(),
  });
  const reject = (reason: string) => { rejections[reason] = (rejections[reason] ?? 0) + 1; };

  for (let group = 0; group < coverage.length; group++) {
    const target = coverage[group];
    for (let ordinal = 0; ordinal < request.casesPerClass; ordinal++) {
      let accepted = false;
      for (let attempt = 0; attempt < MAX_CANDIDATES_PER_CASE; attempt++) {
        if (signal?.aborted) return incomplete("cancelled");
        // Yield between bounded candidates so external cancellation can actually run.
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (signal?.aborted) return incomplete("cancelled");
        const candidate = createCandidate(request.seed, target.label, target.depth, ordinal, attempt);
        attempts++;
        const verified = verifyReference(candidate.reference);
        if (verified.status !== "verified") {
          reject(`${verified.status}:${verified.reason}`);
          continue;
        }
        if (verified.label !== target.label) { reject("label-mismatch"); continue; }
        if (verified.certificate.depth !== target.depth) { reject("depth-mismatch"); continue; }
        if (semanticKeys.has(candidate.semanticKey)) { reject("duplicate-function"); continue; }

        const reference = verified.certificate.input;
        const id = `case-v1-${digest({
          depthPolicyVersion: "1", verifierVersion: VERIFIER_VERSION,
          expression: reference.expression, domain: reference.domain, label: verified.label,
        })}`;
        cases.push({ ...candidate, reference, id, depth: target.depth, label: target.label, ordinal, attempt, certificate: verified.certificate });
        semanticKeys.add(candidate.semanticKey);
        coverage[group] = { ...coverage[group], accepted: coverage[group].accepted + 1 };
        accepted = true;
        break;
      }
      if (!accepted) return incomplete("attempt-limit");
    }
  }
  if (signal?.aborted) return incomplete("cancelled");
  const content: Omit<FrozenSuite, "id"> = {
    formatVersion: "1" as const, generatorVersion: GENERATOR_VERSION,
    depthPolicyVersion: "1" as const, verifierVersion: VERIFIER_VERSION,
    protocolVersion: PROTOCOL_VERSION, request, cases, summary: summary(),
  };
  const suite: FrozenSuite = freezeData({ ...content, id: `suite-v1-${digest(content)}` });
  return { status: "complete", suite };
}
