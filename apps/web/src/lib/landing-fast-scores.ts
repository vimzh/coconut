// Audited follow-up cells fill missing default-profile results without replacing earlier completed work.
import snapshot from "../../public/fast-model-scores.json";

if (snapshot.version !== "1" || snapshot.methodId !== "fast-table-fill-v1" || snapshot.auditVerdict !== "pass" ||
  snapshot.profileId !== "one-shot-json-v1" || snapshot.maxOutputTokens !== 4096 ||
  new Set(snapshot.cells.map(cell => `${cell.key}:${cell.modelId}`)).size !== snapshot.cells.length)
  throw new Error("Regenerate fast-model scores from matching audited follow-up evidence.");

export function getFastScreeningCell(modelId: string, columnIndex: number) {
  if (columnIndex !== 0) return null;
  return snapshot.cells.find(cell => cell.key === "screening-standard" && cell.modelId === modelId && cell.complete) ?? null;
}

export function getFastPilotScore(modelId: string, depth: number): number | null {
  return snapshot.cells.find(cell => cell.key === `depth${depth}` && cell.modelId === modelId && cell.complete)?.macroF1 ?? null;
}
