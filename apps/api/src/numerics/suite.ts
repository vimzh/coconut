// Generates smooth tasks in bounded native batches, retaining all candidate outcomes.
import { createHash } from "node:crypto";
import type { Label } from "../math";
import { freezeData, LABELS, MAX_CANDIDATES_PER_CASE, parseSuiteRequest, SuiteInputError } from "../suites/generator";
import type { Coverage, GenerationSummary, SuiteRequest } from "../suites/types";
import { certifyReferences } from "./backend";
import { createSmoothCandidate } from "./candidates";
import type { CandidateAttempt, NumericalCase, NumericalCertificate, NumericalGenerationResult, NumericalSuite } from "./types";

export const SMOOTH_DEPTHS = Object.freeze([7, 9, 11]);
export const DEFAULT_NUMERICAL_REQUEST: SuiteRequest = freezeData({
  seed: "coconut-smooth-v1", depths: [...SMOOTH_DEPTHS], casesPerClass: 3,
  profileId: "one-shot-json-v1", purpose: "evaluation",
});

export function parseNumericalRequest(input: unknown): SuiteRequest {
  const request = parseSuiteRequest(input);
  if (request.depths.some((depth) => !SMOOTH_DEPTHS.includes(depth)) || request.casesPerClass > 10) {
    throw new SuiteInputError("Smooth suites require depths from [7, 9, 11] and at most 10 cases per class per depth.");
  }
  return request;
}

export const numericalDigest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function rationalLess(left: string, right: string): boolean {
  const [ln, ld = "1"] = left.split("/");
  const [rn, rd = "1"] = right.split("/");
  return BigInt(ln) * BigInt(rd) < BigInt(rn) * BigInt(ld);
}

// A single disjoint point enclosure proves two functions differ; overlap proves nothing.
export function provedDistinct(left: NumericalCertificate, right: NumericalCertificate): boolean {
  return left.probes.some((a) => right.probes.some((b) => a.x === b.x &&
    (rationalLess(a.value.max, b.value.min) || rationalLess(b.value.max, a.value.min))));
}

interface Slot { readonly depth: number; readonly label: Label; readonly ordinal: number; readonly group: number }

export async function generateNumericalSuite(input: unknown, signal?: AbortSignal): Promise<NumericalGenerationResult> {
  const request = parseNumericalRequest(input);
  const coverage: Coverage[] = request.depths.flatMap((depth) => LABELS.map((label) => ({
    depth, label, requested: request.casesPerClass, accepted: 0,
  })));
  const slots: Slot[] = coverage.flatMap((target, group) => Array.from({ length: request.casesPerClass }, (_, ordinal) => ({
    depth: target.depth, label: target.label, ordinal, group,
  })));
  const accepted = new Map<number, NumericalCase>();
  const attempts: CandidateAttempt[] = [];
  const rejections: Record<string, number> = {};
  const cases = () => [...accepted.entries()].sort(([a], [b]) => a - b).map(([, entry]) => entry);
  const summary = (): GenerationSummary => ({
    attempts: attempts.length, accepted: accepted.size, rejections: { ...rejections }, coverage: [...coverage],
  });
  const incomplete = (reason: "cancelled" | "attempt-limit"): NumericalGenerationResult => freezeData({
    status: "incomplete", reason, request, cases: cases(), summary: summary(), attempts,
  });

  for (let attempt = 0; attempt < MAX_CANDIDATES_PER_CASE && accepted.size < slots.length; attempt++) {
    const pending = slots.map((slot, index) => ({ ...slot, index })).filter((slot) => !accepted.has(slot.index));
    for (let start = 0; start < pending.length; start += 64) {
      if (signal?.aborted) return incomplete("cancelled");
      const batch = pending.slice(start, start + 64);
      const candidates = batch.map((slot) => createSmoothCandidate(request.seed, slot.label, slot.depth, slot.ordinal, attempt));
      let results;
      try {
        results = await certifyReferences(candidates.map((candidate) => candidate.reference), signal);
      } catch (error) {
        if (!signal?.aborted) throw error;
        for (const slot of batch) attempts.push({ ...slotIdentity(slot), attempt, outcome: "rejected", reason: "cancelled" });
        rejections.cancelled = (rejections.cancelled ?? 0) + batch.length;
        return incomplete("cancelled");
      }
      for (let index = 0; index < batch.length; index++) {
        const slot = batch[index];
        const result = results[index];
        let reason: string | null = result.status === "verified" ? null : `${result.status}:${result.reason}`;
        if (result.status === "verified") {
          if (result.label !== slot.label) reason = "label-mismatch";
          else if (result.certificate.depth !== slot.depth) reason = "depth-mismatch";
          else if ([...accepted.values()].some((other) => !provedDistinct(other.certificate, result.certificate))) {
            reason = "distinctness-unproved";
          }
          if (reason === null) {
            const reference = result.certificate.input;
            accepted.set(slot.index, {
              id: `case-smooth-v1-${numericalDigest({ backend: result.certificate.backend, reference })}`,
              reference, family: candidates[index].family, depth: slot.depth, label: result.label,
              ordinal: slot.ordinal, attempt, certificate: result.certificate,
            });
            coverage[slot.group] = { ...coverage[slot.group], accepted: coverage[slot.group].accepted + 1 };
          }
        }
        attempts.push({ ...slotIdentity(slot), attempt, outcome: reason === null ? "accepted" : "rejected", reason });
        if (reason !== null) rejections[reason] = (rejections[reason] ?? 0) + 1;
      }
    }
  }
  if (signal?.aborted) return incomplete("cancelled");
  if (accepted.size !== slots.length) return incomplete("attempt-limit");
  const ordered = cases();
  const backend = ordered[0].certificate.backend;
  if (ordered.some((entry) => numericalDigest(entry.certificate.backend) !== numericalDigest(backend))) {
    throw new Error("Native backend identity changed during generation.");
  }
  const content: Omit<NumericalSuite, "id"> = {
    formatVersion: "2", generatorVersion: "smooth-v1", depthPolicyVersion: "smooth-v1",
    verifierVersion: "arb-jet-v1", protocolVersion: "1", promptVersion: "smooth-v1", backend,
    request, cases: ordered, summary: summary(), distinctness: "disjoint-value-enclosures-v1", attempts,
  };
  return freezeData({ status: "complete", suite: { ...content, id: `suite-smooth-v1-${numericalDigest(content)}` } });
}

function slotIdentity(slot: Slot): Pick<CandidateAttempt, "depth" | "label" | "ordinal"> {
  return { depth: slot.depth, label: slot.label, ordinal: slot.ordinal };
}
