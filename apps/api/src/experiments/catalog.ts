// A dated census distinguishes documented effort support from candidates requiring observation.
import type { ReasoningEffort } from "../protocol";
import { freezeData } from "../suites/generator";

export const ALL_EFFORTS: readonly ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
export interface CensusModel {
  readonly modelId: string;
  readonly kind: "non-reasoning" | "reasoning" | "unverified";
  readonly plannedEfforts: readonly ReasoningEffort[];
  readonly documentedEfforts: readonly ReasoningEffort[];
  readonly sourceUrls: readonly string[];
}
interface Group { readonly ids: readonly string[]; readonly efforts: readonly ReasoningEffort[] | null; readonly source: string }
const docs = "https://developers.openai.com/api/docs/";
const groups: readonly Group[] = [
  { ids: ["chat-latest"], efforts: null, source: "models/chat-latest" },
  { ids: ["gpt-4.1", "gpt-4.1-2025-04-14", "gpt-4.1-mini", "gpt-4.1-mini-2025-04-14"], efforts: [], source: "models/gpt-4.1" },
  { ids: ["gpt-4o", "gpt-4o-2024-08-06", "gpt-4o-2024-11-20", "gpt-4o-mini", "gpt-4o-mini-2024-07-18"], efforts: [], source: "models/gpt-4o" },
  { ids: ["gpt-5", "gpt-5-2025-08-07"], efforts: ["minimal", "low", "medium", "high"], source: "models/gpt-5" },
  { ids: ["gpt-5-mini", "gpt-5-mini-2025-08-07", "gpt-5-nano", "gpt-5-nano-2025-08-07"], efforts: null, source: "guides/reasoning" },
  { ids: ["gpt-5-pro", "gpt-5-pro-2025-10-06"], efforts: ["high"], source: "models/gpt-5-pro" },
  { ids: ["gpt-5.1", "gpt-5.1-2025-11-13"], efforts: null, source: "models/gpt-5.1" },
  { ids: ["gpt-5.2", "gpt-5.2-2025-12-11"], efforts: ["none", "low", "medium", "high", "xhigh"], source: "models/gpt-5.2" },
  { ids: ["gpt-5.2-pro", "gpt-5.2-pro-2025-12-11"], efforts: ["medium", "high", "xhigh"], source: "models/gpt-5.2-pro" },
  { ids: ["gpt-5.3-codex"], efforts: ["low", "medium", "high", "xhigh"], source: "models/gpt-5.3-codex" },
  { ids: ["gpt-5.4", "gpt-5.4-2026-03-05", "gpt-5.4-mini", "gpt-5.4-mini-2026-03-17", "gpt-5.4-nano", "gpt-5.4-nano-2026-03-17"], efforts: ["none", "low", "medium", "high", "xhigh"], source: "models/gpt-5.4" },
  { ids: ["gpt-5.4-pro", "gpt-5.4-pro-2026-03-05"], efforts: ["medium", "high", "xhigh"], source: "models/gpt-5.4-pro" },
  { ids: ["gpt-5.5", "gpt-5.5-2026-04-23"], efforts: ["none", "low", "medium", "high", "xhigh"], source: "models/gpt-5.5" },
  { ids: ["gpt-5.5-pro", "gpt-5.5-pro-2026-04-23"], efforts: ["medium", "high", "xhigh"], source: "models/gpt-5.5-pro" },
  { ids: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"], efforts: ["none", "low", "medium", "high", "xhigh", "max"], source: "guides/reasoning" },
  { ids: ["gpt-6-astra", "gpt-6.1-sol"], efforts: ["low", "medium", "high", "xhigh", "max"], source: "guides/reasoning" },
  { ids: ["gpt-6.1-terra", "gpt-6-sol", "gpt-6-luna"], efforts: ["none", "low", "medium", "high", "xhigh", "max"], source: "guides/reasoning" },
  { ids: ["o3", "o3-2025-04-16"], efforts: ["low", "medium", "high"], source: "models/o3" },
];

export function buildModelCensus(modelIds: readonly string[]) {
  if (!Array.isArray(modelIds) || modelIds.some(id => typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(id)) || new Set(modelIds).size !== modelIds.length) throw new Error("Model inventory must contain unique safe identifiers.");
  const included: CensusModel[] = [], excluded: { modelId: string; reason: string }[] = [];
  for (const modelId of modelIds) {
    const group = groups.find(row => row.ids.includes(modelId));
    if (group) {
      included.push({ modelId, kind: group.efforts === null ? "unverified" : group.efforts.length ? "reasoning" : "non-reasoning",
        plannedEfforts: group.efforts ?? ALL_EFFORTS, documentedEfforts: group.efforts ?? [], sourceUrls: [docs + group.source] });
      continue;
    }
    const reason = modelId.startsWith("gpt-5-search-api") ? "Search-only Chat Completions workflow is incompatible with the fixed tool-free Responses protocol."
      : /image/.test(modelId) ? "Image-generation model."
      : /audio|transcribe|transcription|tts|whisper|realtime|live/.test(modelId) ? "Audio, speech, transcription or realtime workflow."
      : modelId.startsWith("text-embedding-") ? "Embedding model."
      : modelId.startsWith("omni-moderation-") ? "Moderation model." : null;
    if (reason === null) throw new Error("Inventory has an unclassified model; review it before freezing experiments.");
    excluded.push({ modelId, reason });
  }
  return freezeData({ included, excluded });
}
