// Resample complete related-task clusters within family, scoring retained outcomes with the shared policy.
import { createHash } from "node:crypto";
import { scoreClassifications } from "../scoring/classification";
import type { Observation } from "../scoring/types";
import { MAX_QUALITY_CASES } from "./data";
import type { BootstrapInterval, QualityCluster } from "./types";

const seed = "coconut-quality-bootstrap-v1" as const;
const replicates = 10000 as const;

export function clusterBootstrapInterval(clusters: readonly QualityCluster[], observations: readonly Observation[]): BootstrapInterval {
  if (clusters.length > MAX_QUALITY_CASES || observations.length > MAX_QUALITY_CASES * 3) throw new Error("Bootstrap population exceeds 256 cases and their three trials.");
  const seen = new Set<string>(), cases = new Map<string, Observation[]>();
  for (const row of observations) {
    const key = `${row.caseId}:${row.trialIndex}`;
    if (seen.has(key) || ![0, 1, 2].includes(row.trialIndex)) throw new Error("Bootstrap requires distinct case/trial identities from the fixed-three policy.");
    seen.add(key); cases.set(row.caseId, [...(cases.get(row.caseId) ?? []), row]);
  }
  const memberships = clusters.flatMap((cluster) => cluster.caseIds);
  if (new Set(memberships).size !== memberships.length || memberships.length > MAX_QUALITY_CASES) throw new Error("Bootstrap clusters must partition at most 256 cases.");
  if ([...cases.keys()].some((id) => !memberships.includes(id))) throw new Error("Bootstrap observation has no declared support cluster.");
  const families = [...new Set(clusters.map((cluster) => cluster.family))].sort();
  const groups = families.map((family) => clusters.filter((cluster) => cluster.family === family).sort((a, b) => a.id.localeCompare(b.id)));
  const strata = families.map((family, i) => ({ family, clusters: groups[i].length }));
  const reasons: string[] = [];
  if (memberships.some((id) => cases.get(id)?.length !== 3) || observations.some((row) => !row.outcome || !["answer", "invalid", "refused", "truncated"].includes(row.outcome.kind))) {
    reasons.push("Every planned trial must be an included model outcome; missing, unattempted, and infrastructure outcomes make uncertainty unavailable.");
  }
  if (clusters.length < 20) reasons.push("At least 20 effective task clusters are required; trials do not add clusters.");
  if (strata.some((row) => row.clusters < 3)) reasons.push("Every broad-family stratum requires at least three effective clusters.");
  if (families.some((family) => family.includes(" + "))) reasons.push("A support cluster spans multiple family tags; a defensible single-family stratification is unavailable.");
  const base = {
    seed, replicates, quantileRule: "nearest-rank percentile 2.5%,97.5%" as const,
    randomGenerator: "mulberry32-sha256-seed-v1" as const, strata, clusters: clusters.length,
    interpretation: "Conditional on these fixed families and exchangeable parameter clusters; not between-family generalization, equal compute, or proof of zero future error at a collapsed interval.",
  };
  if (reasons.length) return { ...base, status: "unavailable", reasons, intervals: null };
  let state = createHash("sha256").update(seed).digest().readUInt32BE(0);
  function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  const populations = groups.map((group) => group.map((cluster) => cluster.caseIds.flatMap((id) => cases.get(id)!)));
  const f1: number[] = [], accuracy: number[] = [];
  for (let replicate = 0; replicate < replicates; replicate++) {
    const sampled: Observation[] = [];
    for (const group of populations) for (let draw = 0; draw < group.length; draw++) sampled.push(...group[Math.floor(random() * group.length)]);
    const score = scoreClassifications(sampled);
    f1.push(score.macroF1!); accuracy.push(score.accuracy.value!);
  }
  const interval = (values: number[]): readonly [number, number] => {
    values.sort((a, b) => a - b);
    return [values[Math.ceil(replicates * 0.025) - 1], values[Math.ceil(replicates * 0.975) - 1]];
  };
  return { ...base, status: "available", reasons: [], intervals: { macroF1: interval(f1), accuracy: interval(accuracy) } };
}
