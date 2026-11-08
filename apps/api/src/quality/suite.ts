// Certificate replay, bounded structural equivalence, and coverage determine the permitted suite claims.
import type { Label } from "../math";
import type { RunSuite } from "../runs/types";
import { validateSuiteArtifact } from "../suites/artifact";
import { finding, finish, MAX_QUALITY_CASES, QUALITY_CRITERIA_SHA256, qualityGate, sha256, snapshot } from "./data";
import { analyzeExpression } from "./structure";
import type { QualityCluster, QualityFinding, SuiteQualityReport } from "./types";

const labels: readonly Label[] = ["convex", "concave", "neither"];
const counts = (): Record<Label, number> => ({ convex: 0, concave: 0, neither: 0 });
const reviewedMembers = new Set([
  "9dc60691331d85c892666edc957a5325820d8cb8e7b8519f85f9772e7cc9eb8e",
  "0fbb8432f942d9678233726f74e6deb3d003cd96e7d90eb98f76051a6d91033b",
]);
const reviewedInteriorMembers = "a503a736a8f19c18598f4758993fb40c136f2e4a31b80d2c9857ba86d13919b9";
const reserveReferenceReview: { readonly membersSha256: string; readonly reference: string; readonly status: "matched" | "missing" } = {
  membersSha256: "195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615",
  reference: "docs/research/independent-reserve-review-v1.md", status: "matched",
};

export function requireBoundedSuite(suite: RunSuite): void {
  if (!Array.isArray(suite?.cases) || suite.cases.length === 0 || suite.cases.length > MAX_QUALITY_CASES) {
    throw new Error(`Quality audits require 1–${MAX_QUALITY_CASES} cases.`);
  }
}

export async function auditSuite(input: RunSuite): Promise<SuiteQualityReport> {
  const detached = snapshot(input);
  requireBoundedSuite(detached);
  return analyzeValidatedSuite(await validateSuiteArtifact(detached));
}

export function analyzeValidatedSuite(suite: RunSuite): SuiteQualityReport {
  requireBoundedSuite(suite);
  const structures = suite.cases.map((entry) => ({
    caseId: entry.id, family: entry.family, label: entry.label,
    expressionCharacters: [...entry.certificate.renderedExpression].length,
    ...analyzeExpression(entry.reference.expression, entry.reference.domain),
  }));
  const findings: QualityFinding[] = [finding("reference-replay", "reference", "warning", "passed",
    "Every admitted expression, domain, exclusive label, and complete certificate was replayed by its versioned validator.")];
  const parents = structures.map((_, i) => i);
  function root(i: number): number { while (parents[i] !== i) i = parents[i]; return i; }
  function join(a: number, b: number): void { parents[root(b)] = root(a); }
  const declared = new Map<string, number>();
  suite.cases.forEach((entry, index) => {
    if (!("clusterId" in entry)) return;
    const earlier = declared.get(entry.clusterId);
    if (earlier === undefined) declared.set(entry.clusterId, index); else join(earlier, index);
  });
  const duplicates: { left: string; right: string }[] = [];
  const relatedPairs: { left: string; right: string; relation: string }[] = [];
  for (let i = 0; i < structures.length; i++) for (let j = i + 1; j < structures.length; j++) {
    const a = structures[i], b = structures[j];
    if (a.exactSignature === b.exactSignature) { duplicates.push({ left: a.caseId, right: b.caseId }); join(i, j); }
    else if (a.coreSignature === b.coreSignature) {
      relatedPairs.push({ left: a.caseId, right: b.caseId, relation: "bounded output scaling/affine addition and normalized input reflection" }); join(i, j);
    }
  }
  const components = new Map<number, number[]>();
  structures.forEach((_, i) => { const key = root(i); components.set(key, [...(components.get(key) ?? []), i]); });
  const clusters: QualityCluster[] = [...components.values()].map((indices) => {
    const entries = indices.map((i) => suite.cases[i]);
    const families = [...new Set(entries.map((entry) => entry.family))].sort();
    const declaredIds = entries.flatMap((entry) => "clusterId" in entry ? [entry.clusterId] : []);
    const unchangedDeclared = declaredIds.length === entries.length && new Set(declaredIds).size === 1;
    return {
      id: unchangedDeclared ? declaredIds[0] : `quality-cluster-v1-${sha256(entries.map((entry) => entry.id).sort())}`,
      family: families.join(" + "), caseIds: entries.map((entry) => entry.id),
      basis: unchangedDeclared ? "declared-parameter-group" : entries.length > 1 ? "bounded-curvature-equivalence" : "singleton",
    };
  });
  const familyNames = [...new Set(suite.cases.map((entry) => entry.family))].sort();
  const familyCoverage = familyNames.map((family) => {
    const selected = suite.cases.filter((entry) => entry.family === family), labelCounts = counts();
    selected.forEach((entry) => labelCounts[entry.label]++);
    return { family, labels: labelCounts, clusters: clusters.filter((cluster) => cluster.caseIds.some((id) => selected.some((entry) => entry.id === id))).length };
  });
  const depthCoverage = [...new Set(structures.map((entry) => entry.rawDepth))].sort((a, b) => a - b).map((depth) => {
    const labelCounts = counts(); structures.filter((entry) => entry.rawDepth === depth).forEach((entry) => labelCounts[entry.label]++);
    return { depth, labels: labelCounts };
  });
  const labelCounts = counts(); suite.cases.forEach((entry) => labelCounts[entry.label]++);
  const isChallenge = suite.generatorVersion === "challenge-v1";
  const isInterior = suite.generatorVersion === "interior-v1";
  const isReserve = suite.generatorVersion === "reserve-v1";
  const reserveMembersMatched = isReserve && reserveReferenceReview.membersSha256 === sha256(suite.cases.map(entry => ({ family: entry.family,
    reference: entry.reference, analyticCertificate: "analyticCertificate" in entry ? entry.analyticCertificate : null })));
  const reserveReviewMatched = reserveMembersMatched && reserveReferenceReview.status === "matched";
  if (isReserve) findings.push(finding("independent-reserve-review", "reference", reserveReviewMatched ? "warning" : "missing-evidence",
    reserveReviewMatched ? "passed" : "unresolved", reserveReviewMatched
      ? "Exact reference/analytic-certificate membership matches the recorded AI-assisted independent review of all 18 reserve tasks."
      : reserveMembersMatched ? `Membership matches expected fingerprint ${reserveReferenceReview.membersSha256}, but a completed independent runtime review is not recorded.`
        : `This reserve membership differs from expected fingerprint ${reserveReferenceReview.membersSha256}; its independent review cannot be applied.`, [],
    "This mathematical review is not human approval, independent task support, confirmation coverage or model-performance evidence."));
  const interiorReviewMatched = isInterior && reviewedInteriorMembers === sha256(suite.cases.map(entry => ({ family: entry.family,
    reference: entry.reference, analyticCertificate: "analyticCertificate" in entry ? entry.analyticCertificate : null })));
  if (isInterior) findings.push(finding("independent-interior-review", "reference", interiorReviewMatched ? "warning" : "missing-evidence",
    interiorReviewMatched ? "passed" : "unresolved", interiorReviewMatched
      ? "Exact reference/analytic-certificate membership matches the AI-assisted independent Bernstein/Taylor review of all 72 exploratory tasks."
      : "This exploratory membership does not match its independently reviewed references.", [],
    "This mathematical review is not human approval, independent task support, confirmation coverage or model-performance evidence."));
  if (suite.generatorVersion === "interior-v1") findings.push(finding("exploratory-interior-coverage", "coverage", "missing-evidence", "unresolved",
    "This separately designed exploratory population has three families and eight shared source-polynomial clusters; it does not meet the frozen confirmation coverage or uncertainty criteria.", [],
    "Report exact descriptive outcomes only. No confirmation Go, ranked comparison, broad model-failure claim or confidence interval is established."));
  if (isReserve) findings.push(finding("exploratory-reserve-coverage", "coverage", "missing-evidence", "unresolved",
    "This fixed exploratory population has 18 tasks in three families and two related source-polynomial clusters; it does not meet confirmation coverage or uncertainty criteria.", [],
    "Report exact descriptive outcomes only. No confirmation Go, ranked comparison, broad model-failure claim or confidence interval is established."));
  const reviewMatched = isChallenge && reviewedMembers.has(sha256(suite.cases.map((entry) => ({
    family: entry.family, reference: entry.reference, analyticCertificate: "analyticCertificate" in entry ? entry.analyticCertificate : null,
  }))));
  if (isChallenge) findings.push(finding("independent-family-review", "reference", reviewMatched ? "warning" : "missing-evidence",
    reviewMatched ? "passed" : "unresolved", reviewMatched
      ? "Exact reference/analytic-certificate membership matches the recorded AI-assisted independent review of all 96 supported coordinates."
      : "This challenge membership does not match either independently reviewed population.", [],
    "AI-assisted mathematical review is not human expert approval or model-performance evidence."));
  if (duplicates.length) findings.push(finding("duplicate-tasks", "identity", "critical", "unresolved",
    `${duplicates.length} pairs denote the same function and domain under bounded exact identities.`, [...new Set(duplicates.flatMap((pair) => [pair.left, pair.right]))]));
  else findings.push(finding("duplicate-tasks", "identity", "warning", "passed", "No exact duplicates were detected by the declared bounded identity rules."));
  if (relatedPairs.length) findings.push(finding("related-transformations", "identity", "warning", "accepted-scoped-limitation",
    `${relatedPairs.length} curvature-equivalent pairs were merged into support clusters.`, [], "Related presentations count as one uncertainty support unit."));
  const confounded = familyCoverage.filter((row) => labels.some((label) => row.labels[label] === 0));
  if (confounded.length) findings.push(finding("family-label-confound", "coverage", "warning", "accepted-scoped-limitation",
    `${confounded.length} family tags omit at least one label. Historical tags can also split one broad mathematical family.`, [],
    "Use this restricted population descriptively; it does not establish balanced broad-family capability."));
  else findings.push(finding("family-label-confound", "coverage", "warning", "passed", "Every retained family represents all three labels."));
  findings.push(finding("depth-confounds", "depth", "warning", "accepted-scoped-limitation",
    "Raw and simplified diagnostic structure are retained separately; family, expression length, and operation shape are not experimentally controlled.", [],
    "Depth summaries are descriptive. Neither depth nor certification work establishes mathematical or model difficulty."));
  findings.push(finding("bounded-equivalence", "identity", "warning", "accepted-scoped-limitation",
    "Rules cover zero/one arithmetic, certified exp/log cancellations, double negation, affine normalization, output scaling/affine addition, and input reflection. Other semantic equivalence is unknown. Active-piece counts are unavailable.", [],
    "Detected distinct signatures are not proofs of semantic independence; unknown equivalence remains unknown."));
  const requestedCases = suite.summary.coverage.reduce((sum, row) => sum + row.requested, 0);
  if (suite.cases.length !== requestedCases || suite.summary.accepted !== suite.cases.length) findings.push(finding("requested-coverage", "coverage", "critical", "unresolved", "Requested, accepted, and retained case populations disagree."));
  if (isChallenge) {
    const target = suite.request.population === "confirmation";
    const achieved = !target || (suite.cases.length === 72 && familyCoverage.length === 8 && clusters.length === 24 &&
      familyCoverage.every((row) => labels.every((label) => row.labels[label] === 3) && row.clusters === 3));
    findings.push(finding("challenge-coverage", "coverage", achieved ? "warning" : "critical", achieved ? "passed" : "unresolved",
      target ? "Confirmation target: 72 tasks, eight family tags, three cases per label/family and 24 three-label parameter clusters."
        : "Nine-case balanced screening population is exploratory and has three support clusters.", [], target ? null : "Screening cannot inherit confirmation coverage or uncertainty claims."));
  }
  findings.push(finding("selection-and-exposure", "selection", "warning", "accepted-scoped-limitation",
    "The validated artifact retains generation counts and reasons. Prior exploration/exposure and experiment freezing are not established by this suite audit.", [],
    "This is a verifier-selected synthetic population, not a prevalence sample or a contamination-free population."));
  const groups: SuiteQualityReport["candidateAccounting"]["groups"][number][] = [];
  if ("attempts" in suite) for (const attempt of suite.attempts) {
    const family = "family" in attempt ? attempt.family : null;
    const parameterGroup = "clusterIndex" in attempt ? attempt.clusterIndex : null;
    const previous = groups.find((row) => row.family === family && row.label === attempt.label && row.parameterGroup === parameterGroup);
    const next = { family, label: attempt.label, parameterGroup,
      accepted: (previous?.accepted ?? 0) + (attempt.outcome === "accepted" ? 1 : 0),
      rejected: (previous?.rejected ?? 0) + (attempt.outcome === "rejected" ? 1 : 0) };
    if (previous) groups[groups.indexOf(previous)] = next; else groups.push(next);
  }
  const content: Omit<SuiteQualityReport, "id"> = {
    version: "1", policyId: "quality-criteria-v1", criteriaSha256: QUALITY_CRITERIA_SHA256, suiteId: suite.id, suiteSha256: sha256(suite),
    population: {
      cases: suite.cases.length, families: familyNames.length, clusters: clusters.length,
      distinctExactTasks: new Set(structures.map((entry) => entry.exactSignature)).size,
      requestedCases, acceptedCandidates: suite.summary.accepted, attemptedCandidates: suite.summary.attempts,
      rejectedCandidates: Object.values(suite.summary.rejections).reduce((sum, count) => sum + count, 0),
      unverifiedCandidates: Object.entries(suite.summary.rejections).filter(([reason]) => reason.startsWith("unverified:")).reduce((sum, [, count]) => sum + count, 0),
      rejectionReasons: suite.summary.rejections, interpretation: "Finite, verifier-selected synthetic population; parameter clusters, not repeated trials, are support units.",
    },
    coverage: { labels: labelCounts, families: familyCoverage, depths: depthCoverage },
    candidateAccounting: { detailedAttemptsRetained: "attempts" in suite, groups }, clusters, structures, duplicates, relatedPairs,
    unknownEquivalencePairs: suite.cases.length * (suite.cases.length - 1) / 2 - duplicates.length - relatedPairs.length,
    reviewRecords: [
      { role: "certificate replay", reference: suite.verifierVersion, status: "matched", limitation: "Replay is reproducibility evidence, not an independent mathematical derivation." },
      ...(isChallenge ? [{ role: "AI-assisted independent mathematical review" as const,
        reference: "docs/research/independent-challenge-review-v1.md", status: reviewMatched ? "matched" as const : "missing" as const,
        limitation: "No human expert approval or model failure is asserted." }] : []),
      ...(isInterior ? [{ role: "AI-assisted independent mathematical review" as const,
        reference: "docs/research/independent-interior-review-v1.md", status: interiorReviewMatched ? "matched" as const : "missing" as const,
        limitation: "Three families and eight shared source-polynomial clusters remain exploratory; no human approval or model-failure claim." }] : []),
      ...(isReserve ? [{ role: "AI-assisted independent mathematical review" as const,
        reference: reserveReferenceReview.reference, status: reserveReviewMatched ? "matched" as const : "missing" as const,
        limitation: "Three families and two related source-polynomial clusters remain exploratory; no human approval, confirmation or model-failure claim." }] : []),
    ], findings, gate: qualityGate(findings),
  };
  return finish(content, "suite-quality-v1");
}
