// Public listings keep scores and comparison evidence compact; full transcripts require an explicit run link.
import type { RunView } from "./types";

export function summarizePublishedRun(view: RunView) {
  const { record } = view;
  const returned = record.results.filter(entry => ["answer", "invalid", "refused", "truncated"].includes(entry.result.evidence.outcome.kind));
  return {
    version: "1", id: record.id, state: record.state, createdAt: record.createdAt, expiresAt: record.expiresAt, publishedAt: view.publishedAt,
    request: record.request, progress: record.progress,
    suite: { id: record.suite.id, generatorVersion: record.suite.generatorVersion, depthPolicyVersion: record.suite.depthPolicyVersion,
      verifierVersion: record.suite.verifierVersion, protocolVersion: record.suite.protocolVersion,
      promptVersion: record.suite.formatVersion === "2" ? record.suite.promptVersion : "exact-v1",
      caseCount: record.suite.cases.length, depths: record.suite.request.depths,
      population: record.request.suiteKey === "challenge-v1" ? "confirmation" : record.request.suiteKey === "screening-v1" ? "screening" : "reference" },
    observation: {
      reportedModelIds: [...new Set(returned.flatMap(entry => entry.result.reportedModelId === null ? [] : [entry.result.reportedModelId]))].sort(),
      reportedServingProviders: [...new Set(returned.flatMap(entry => entry.result.reportedServingProvider === null ? [] : [entry.result.reportedServingProvider]))].sort(),
      modelIdentityMissing: returned.filter(entry => entry.result.reportedModelId === null).length,
      contextFitUnverified: returned.filter(entry => entry.result.contextFit !== "provider-enforced").length,
      outputLimitUnverified: returned.filter(entry => entry.result.effective.maxOutputTokens !== record.workload.maxOutputTokens).length,
      schemaUnverified: record.request.profileId.includes("schema") ? returned.filter(entry => entry.result.effective.nativeSchemaAccepted !== true).length : 0,
    },
    report: record.report,
  };
}
