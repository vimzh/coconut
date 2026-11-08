// Protect catalog membership and search behavior without treating listings as evaluation results.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directoryModels } from "./model-directory-data";
import { filterDirectoryModels } from "./model-directory";

describe("landing model directory", () => {
  it("keeps the ten usage ranks in source order without ranking other catalog entries", () => {
    const ranked = filterDirectoryModels(directoryModels, "openrouter", "");
    assert.deepEqual(ranked.map((model) => model.openrouter?.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(new Set(directoryModels.map((model) => model.id)).size, 45);
    assert.ok(directoryModels.filter((model) => model.openrouter === null).every((model) => model.openai));
  });

  it("includes current and deprecated OpenAI catalog entries and merges the shared model", () => {
    const openai = filterDirectoryModels(directoryModels, "openai", "");
    assert.equal(openai.length, 36);
    assert.equal(openai.filter((model) => model.status === "deprecated").length, 15);
    assert.equal(openai.filter((model) => model.status === "open-weights").length, 2);
    assert.ok(!openai.some((model) => model.id === "gpt-4.1-nano"));
    assert.equal(directoryModels.filter((model) => model.id === "gpt-6-luna").length, 1);
    assert.equal(openai.find((model) => model.id === "gpt-6-luna")?.openrouter?.rank, 5);
  });

  it("searches model names, companies, and either catalog's model ID inside the selected source", () => {
    assert.deepEqual(filterDirectoryModels(directoryModels, "all", "  TENCENT ").map((model) => model.id), ["tencent/hy4", "tencent/hy4-preview"]);
    assert.deepEqual(filterDirectoryModels(directoryModels, "openai", "openai/gpt-6-luna").map((model) => model.id), ["gpt-6-luna"]);
    assert.deepEqual(filterDirectoryModels(directoryModels, "openrouter", "GPT-6 Astra"), []);
    assert.deepEqual(filterDirectoryModels(directoryModels, "all", "unknown-model-company"), []);
    assert.deepEqual(filterDirectoryModels(directoryModels, "all", "   "), directoryModels);
  });
});
