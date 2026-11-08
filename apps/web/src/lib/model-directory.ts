// Filter the landing catalog without changing source order or usage ranks.
import { modelCompanies, type DirectoryModel } from "./model-directory-data";

export type DirectorySource = "all" | "openrouter" | "openai";

export function filterDirectoryModels(
  models: readonly DirectoryModel[],
  source: DirectorySource,
  query: string,
): readonly DirectoryModel[] {
  const search = query.trim().normalize("NFKC").toLowerCase();
  return models.filter((model) => {
    if (source === "openrouter" && model.openrouter === null) return false;
    if (source === "openai" && !model.openai) return false;
    const text = [model.name, model.id, modelCompanies[model.company].name, model.openrouter?.modelId ?? ""];
    return text.join(" ").normalize("NFKC").toLowerCase().includes(search);
  });
}
