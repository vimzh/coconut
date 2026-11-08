// A signal claim validates retained experiment/probe contents, rather than treating opaque hashes as evidence.
import { getProfile, type ReasoningEffort } from "../protocol";
import type { RunRecord } from "../runs/types";
import { outcome } from "../scoring/validation";
import { QUALITY_CRITERIA_SHA256, sha256 } from "./data";
import type { SignalCapabilityEvidence, SignalExperimentManifest, SignalReviewEvidence } from "./types";

const effortOrder: readonly ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const time = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ? Date.parse(value) : NaN;
const urls = (values: readonly string[]) => Array.isArray(values) && values.length > 0 && values.length <= 64 && values.every((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
});

export function validateSignalExperiment(record: RunRecord, experiment: SignalReviewEvidence["experiment"]): {
  readonly valid: boolean; readonly reason: string; readonly highestVerifiedEffort: ReasoningEffort | null;
} {
  const no = (reason: string) => ({ valid: false, reason, highestVerifiedEffort: null });
  const manifest = experiment.manifest, capabilities = experiment.capabilities;
  if (!manifest || !capabilities || !hash(experiment.manifestSha256) || !hash(experiment.capabilityEvidenceSha256) ||
    sha256(manifest) !== experiment.manifestSha256 || sha256(capabilities) !== experiment.capabilityEvidenceSha256 ||
    capabilities.manifestSha256 !== experiment.manifestSha256) return no("Retained manifest/capability objects are missing or their content hashes disagree.");
  if (!manifest.inventory || !manifest.frontier || !manifest.budget || !Array.isArray(manifest.inventory.modelIds) ||
    !Array.isArray(manifest.frontier.modelIds) || !Array.isArray(manifest.cells) || !Array.isArray(manifest.modelEfforts) || !Array.isArray(capabilities.probes)) {
    return no("Retained experiment objects lack their catalog, frontier, matrix, effort plan, budget, or capability attempts.");
  }
  const frozenAt = time(manifest.frozenAt), checkedAt = time(capabilities.checkedAt);
  if (manifest.version !== "1" || capabilities.version !== "1" || manifest.policyId !== "quality-criteria-v1" || manifest.criteriaSha256 !== QUALITY_CRITERIA_SHA256 ||
    !Number.isFinite(frozenAt) || !Number.isFinite(checkedAt) || !Number.isFinite(time(record.createdAt)) || frozenAt < Date.parse("2026-11-07T19:52:00Z") || checkedAt < frozenAt || checkedAt > time(record.createdAt) ||
    frozenAt > time(record.createdAt) || record.results.some((row) => !Number.isFinite(time(row.result.startedAt)) || frozenAt > time(row.result.startedAt))) {
    return no("The policy binding or retained freeze/permission timestamps do not precede this evaluation cell.");
  }
  if (!Number.isFinite(time(manifest.inventory.checkedAt)) || time(manifest.inventory.checkedAt) > frozenAt || !urls([manifest.inventory.source]) ||
    manifest.inventory.modelIds.length > 1000 || new Set(manifest.inventory.modelIds).size !== manifest.inventory.modelIds.length ||
    !manifest.frontier.modelIds.includes(record.request.modelId) || manifest.frontier.modelIds.some((id) => !manifest.inventory.modelIds.includes(id)) ||
    typeof manifest.frontier.basis !== "string" || !manifest.frontier.basis.trim() || !urls(manifest.frontier.sourceUrls)) return no("The frozen frontier selection lacks a dated catalog, explicit rationale, or source identities.");
  if (manifest.budget.maxChargedAttempts !== 8192 || manifest.budget.maxConcurrency !== 12 || manifest.budget.inferenceTimeoutMs !== 180000 ||
    manifest.budget.metadataTimeoutMs !== 20000 || manifest.cells.length > 1000 || manifest.modelEfforts.length > 1000 || capabilities.probes.length > 8192) {
    return no("The retained experiment exceeds or changes the predeclared work policy.");
  }
  const ids = new Set<string>();
  for (const cell of manifest.cells) {
    const profile = getProfile(cell.profileId);
    if (ids.has(cell.id) || !["screening", "confirmation", "capability-probe"].includes(cell.phase) ||
      !manifest.inventory.modelIds.includes(cell.modelId) || !hash(cell.suiteSha256) || !hash(cell.promptsSha256) ||
      cell.reasoningEffort !== profile.reasoning || cell.maxOutputTokens !== profile.maxOutputTokens ||
      !Number.isInteger(cell.concurrency) || cell.concurrency < 1 || cell.concurrency > manifest.budget.maxConcurrency) return no("A frozen matrix cell has duplicate identity or incompatible profile/settings/budget fields.");
    ids.add(cell.id);
  }
  const cells: SignalExperimentManifest["cells"] = manifest.cells.filter((cell) => cell.phase === "confirmation" && cell.provider === record.request.provider && cell.modelId === record.request.modelId &&
    cell.servingProvider === record.request.servingProvider && cell.profileId === record.request.profileId && cell.settingsId === record.evidence.model.settingsId);
  if (cells.length !== 1 || cells[0].suiteId !== record.suite.id || cells[0].suiteSha256 !== sha256(record.suite) ||
    cells[0].promptsSha256 !== sha256(record.prompts) || cells[0].concurrency !== record.request.concurrency ||
    cells[0].maxOutputTokens !== record.workload.maxOutputTokens) return no("This exact suite, canonical prompts, settings, concurrency, and ceiling are not one frozen confirmation cell.");
  const plans: SignalExperimentManifest["modelEfforts"] = manifest.modelEfforts.filter((row) => row.provider === record.request.provider && row.modelId === record.request.modelId);
  if (plans.length !== 1 || !Array.isArray(plans[0].plannedEfforts) || !Array.isArray(plans[0].documentedEfforts) || !plans[0].plannedEfforts.length || new Set(plans[0].plannedEfforts).size !== plans[0].plannedEfforts.length ||
    plans[0].plannedEfforts.some((effort) => !effortOrder.includes(effort)) || plans[0].documentedEfforts.some((effort) => !plans[0].plannedEfforts.includes(effort)) ||
    !urls(plans[0].sourceUrls)) return no("The selected model lacks one explicit frozen effort/support plan and documentation sources.");
  const probes: SignalCapabilityEvidence["probes"] = capabilities.probes.filter((probe) => probe.modelId === record.request.modelId);
  if (plans[0].plannedEfforts.some((effort) => !probes.some((probe) => probe.effort === effort))) return no("A planned effort has no retained capability attempt; unsupported or failed work cannot be silently omitted.");
  const attempts = new Set<string>(), verified: { effort: ReasoningEffort; finishedAt: number; reportedModelId: string; reportedServingProvider: string | null }[] = [];
  for (const probe of probes) {
    const result = probe.result, profile = getProfile(result.requested.profileId);
    if (attempts.has(result.attemptId) || !plans[0].plannedEfforts.includes(probe.effort) || result.requested.modelId !== probe.modelId ||
      result.requested.provider !== record.request.provider || profile.reasoning !== probe.effort || result.prompt.profileId !== profile.id ||
      result.prompt.generation.reasoning !== probe.effort || result.prompt.generation.maxOutputTokens !== profile.maxOutputTokens ||
      result.budget.maxOutputTokens !== profile.maxOutputTokens || result.budget.retries !== 0 || result.budget.maxInferenceRequests !== 1 ||
      record.prompts.some((prompt) => prompt.messages[1].content === result.prompt.messages[1].content) ||
      !Number.isFinite(time(result.startedAt)) || !Number.isFinite(time(result.finishedAt)) || time(result.finishedAt) < time(result.startedAt) || time(result.finishedAt) > checkedAt) {
      return no("A capability attempt is duplicated, stale, or does not bind the exact requested model/profile/effort.");
    }
    attempts.add(result.attemptId);
    const replayed = outcome(result.evidence.outcome, profile.id);
    if (replayed.kind === "answer" && result.failure === null && result.inferenceRequests === 1 && result.reportedModelId !== null &&
      result.effective.reasoningEffort === probe.effort && result.effective.maxOutputTokens === profile.maxOutputTokens && result.contextFit === "provider-enforced") {
      verified.push({ effort: probe.effort, finishedAt: time(result.finishedAt), reportedModelId: result.reportedModelId, reportedServingProvider: result.reportedServingProvider });
    }
  }
  if (!verified.some((probe) => probe.finishedAt <= frozenAt)) return no("No retained successful inference permission for this frontier model preceded the manifest freeze.");
  const highest = effortOrder.filter((effort) => verified.some((probe) => probe.effort === effort)).at(-1) ?? null;
  if (highest === null || effortOrder.indexOf(highest) < effortOrder.indexOf("high")) return no("Low/default/medium-effort-only evidence cannot support the stronger mathematical-failure claim.");
  if (getProfile(record.request.profileId).reasoning !== highest) return no("This cell does not use the highest verified supported effort in the retained experiment probes.");
  if (record.results.some((row) => ["answer", "invalid", "refused", "truncated"].includes(row.result.evidence.outcome.kind) && !verified.some((probe) =>
    probe.effort === highest && probe.reportedModelId === row.result.reportedModelId && probe.reportedServingProvider === row.result.reportedServingProvider))) {
    return no("Reported model/serving identities changed between the verified highest-effort permission probes and evaluation outcomes.");
  }
  return { valid: true, reason: "Exact frozen cell and retained successful permission/effort probes validated.", highestVerifiedEffort: highest };
}
