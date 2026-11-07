// Reconciles frozen references and execution evidence into one versioned report.
import { createHash } from "node:crypto";
import { buildPrompt, calculateWorkload, getProfile } from "../protocol";
import { validateSuiteArtifact } from "../suites/artifact";
import { buildNumericalPrompts } from "../numerics/prompt";
import type { NumericalBackend, NumericalPromptVersion } from "../numerics/types";
import { freezeData } from "../suites/generator";
import { scoreClassifications, type ClassificationReport } from "./classification";
import { computeDiagnostics, type DiagnosticsReport } from "./diagnostics";
import { bindEvidence, parseEvidence } from "./evidence";
import type { ExpressionLength, Observation, RunEvidence } from "./types";
import { record, ScoringInputError } from "./validation";

export const SCORER_VERSION = "1" as const;
export const SCORING_POLICY_ID = "pooled-macro-f1-v1" as const;

export interface SliceReport {
  readonly classification: ClassificationReport;
  readonly diagnostics: DiagnosticsReport;
}

export interface ScoringReport {
  readonly reportVersion: "1";
  readonly scorerVersion: "1";
  readonly policyId: typeof SCORING_POLICY_ID;
  readonly id: string;
  readonly identity: {
    readonly runId: string;
    readonly suiteId: string;
    readonly generatorVersion: string;
    readonly depthPolicyVersion: string;
    readonly verifierVersion: string;
    readonly protocolVersion: string;
    readonly profileId: RunEvidence["profileId"];
    readonly method: "one-shot";
    readonly model: RunEvidence["model"];
    readonly workload: ReturnType<typeof calculateWorkload>;
    readonly evidenceSha256: string;
    readonly certification?: { readonly backend: NumericalBackend; readonly promptVersion: NumericalPromptVersion };
  };
  readonly run: RunEvidence["run"];
  readonly overall: SliceReport;
  readonly baselineDepth: number;
  readonly byDepth: readonly (SliceReport & { readonly depth: number; readonly macroF1Difference: number | null })[];
}

const digest = (data: string) => createHash("sha256").update(data).digest("hex");

export async function scoreEvaluation(input: unknown): Promise<ScoringReport> {
  const envelope = record(input, "Scoring input", ["suite", "evidence"]);
  // Snapshot caller-owned outcomes before suite replay yields to the event loop.
  const snapshot = parseEvidence(envelope.evidence);
  const suite = await validateSuiteArtifact(envelope.suite);
  if (suite.request.purpose !== "evaluation") throw new ScoringInputError("Illustrative suites are not evaluation input.");
  const evidence = bindEvidence(snapshot, suite);
  const cases = new Map(suite.cases.map((entry) => [entry.id, entry]));
  const observations: Observation[] = evidence.trials.map((trial) => {
    const reference = cases.get(trial.caseId)!;
    return {
      caseId: trial.caseId, depth: reference.depth, referenceLabel: reference.label, trialIndex: trial.trialIndex,
      outcome: trial.finalAttempt === null ? null : trial.attempts[trial.finalAttempt - 1].outcome,
    };
  });
  const prompts = suite.formatVersion === "2"
    ? await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), evidence.profileId, suite.promptVersion)
    : suite.cases.map((entry) => buildPrompt(entry.reference, evidence.profileId));
  const lengths: ExpressionLength[] = suite.cases.map((entry, index) => {
    const prompt = prompts[index];
    return {
      caseId: entry.id, depth: entry.depth, expressionSha256: digest(entry.certificate.renderedExpression),
      expressionCharacters: [...entry.certificate.renderedExpression].length, nodeCount: entry.certificate.nodeCount,
      promptCharacters: prompt.messages.reduce((sum, message) => sum + [...message.content].length, 0),
    };
  });
  const profile = getProfile(evidence.profileId);
  const slice = (depth?: number): SliceReport => {
    const selectedLengths = lengths.filter((entry) => depth === undefined || entry.depth === depth);
    const selected = new Set(selectedLengths.map((entry) => entry.caseId));
    return {
      classification: scoreClassifications(observations.filter((entry) => selected.has(entry.caseId)), profile.trialsPerInstance),
      diagnostics: computeDiagnostics(evidence.trials.filter((entry) => selected.has(entry.caseId)), selectedLengths,
        evidence.expressionTokens.filter((entry) => selected.has(entry.caseId)), evidence.model.modelId),
    };
  };
  const overall = slice();
  const slices = suite.request.depths.map((depth) => ({ depth, ...slice(depth) }));
  const baseline = slices[0].classification.macroF1;
  const content: Omit<ScoringReport, "id"> = {
    reportVersion: "1", scorerVersion: SCORER_VERSION, policyId: SCORING_POLICY_ID,
    identity: {
      runId: evidence.runId, suiteId: suite.id, generatorVersion: suite.generatorVersion,
      depthPolicyVersion: suite.depthPolicyVersion, verifierVersion: suite.verifierVersion,
      protocolVersion: suite.protocolVersion, profileId: evidence.profileId, method: profile.method,
      model: evidence.model, workload: calculateWorkload(evidence.profileId, suite.cases.length),
      evidenceSha256: digest(JSON.stringify(evidence)),
      ...(suite.formatVersion === "2" ? { certification: { backend: suite.backend, promptVersion: suite.promptVersion } } : {}),
    },
    run: evidence.run, overall, baselineDepth: suite.request.depths[0],
    byDepth: slices.map((entry) => ({
      ...entry, macroF1Difference: baseline === null || entry.classification.macroF1 === null ? null : entry.classification.macroF1 - baseline,
    })),
  };
  return freezeData({ ...content, id: `report-v1-${digest(JSON.stringify(content))}` });
}
