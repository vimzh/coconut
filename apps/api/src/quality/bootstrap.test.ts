import { describe, expect, it } from "bun:test";
import type { Label } from "../math";
import { extractAnswer } from "../protocol";
import type { Observation } from "../scoring/types";
import { clusterBootstrapInterval } from "./bootstrap";
import type { QualityCluster } from "./types";

function population() {
  const clusters: QualityCluster[] = [], observations: Observation[] = [];
  const labels: Label[] = ["convex", "concave", "neither"];
  for (let family = 0; family < 8; family++) for (let group = 0; group < 3; group++) {
    const id = `cluster-${family}-${group}`, caseIds = labels.map((label) => `${id}-${label}`);
    clusters.push({ id, family: `family-${family}`, caseIds, basis: "declared-parameter-group" });
    labels.forEach((label, i) => [0, 1, 2].forEach((trialIndex) => observations.push({
      caseId: caseIds[i], trialIndex, depth: 3, referenceLabel: label,
      outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: family === 0 && group === 0 ? labels[(i + 1) % 3] : label, explanation: "Fixture." }) }, "one-shot-json-v1"),
    })));
  }
  return { clusters, observations };
}

describe("family-stratified whole-cluster bootstrap", () => {
  it("uses 24 clusters, keeps all labels/trials together and reproduces independently expected quantiles", () => {
    const { clusters, observations } = population();
    const result = clusterBootstrapInterval(clusters, observations);
    // Only one of three clusters in one stratum is wrong. Its resampled multiplicity is Binomial(3,1/3).
    // Both metrics equal 1-K/24, so the nearest-rank 2.5%/97.5% endpoints are 7/8 and 1.
    expect(result.status).toBe("available");
    expect(result.clusters).toBe(24);
    expect(result.replicates).toBe(10000);
    expect(result.intervals).toEqual({ macroF1: [7 / 8, 1], accuracy: [7 / 8, 1] });
    expect(clusterBootstrapInterval([...clusters].reverse(), [...observations].reverse())).toEqual(result);
  }, 30000);

  it("does not turn repeated trials, sparse strata or missing outcomes into support", () => {
    const { clusters, observations } = population();
    expect(clusterBootstrapInterval(clusters.slice(0, 3), observations.slice(0, 27)).status).toBe("unavailable");
    const keep = clusters.slice(1), ids = new Set(keep.flatMap((cluster) => cluster.caseIds));
    expect(clusterBootstrapInterval(keep, observations.filter((row) => ids.has(row.caseId))).reasons.join(" ")).toContain("three effective clusters");
    observations[0] = { ...observations[0], outcome: null };
    expect(clusterBootstrapInterval(clusters, observations).status).toBe("unavailable");
  });

  it("rejects duplicate trials and overlapping clusters instead of silently dropping them", () => {
    const { clusters, observations } = population();
    expect(() => clusterBootstrapInterval(clusters, [...observations, observations[0]])).toThrow("distinct");
    expect(() => clusterBootstrapInterval([...clusters, clusters[0]], observations)).toThrow("partition");
  });
});
