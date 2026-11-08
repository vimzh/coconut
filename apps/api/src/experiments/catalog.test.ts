// The census is exhaustive for its recorded inventory and budgets candidates before observing scores.
import { expect, it } from "bun:test";
import inventory from "../../data/experiments/openai-inventory-v1.json";
import { ALL_EFFORTS, buildModelCensus } from "./catalog";

it("accounts for every inventoried ID without conflating aliases or guessing unknown effort support", () => {
  const census = buildModelCensus(inventory.result.value!);
  expect(census.included).toHaveLength(47);
  expect(census.excluded).toHaveLength(49);
  expect(new Set([...census.included, ...census.excluded].map(row => row.modelId)).size).toBe(inventory.result.value!.length);
  expect(census.included.find(row => row.modelId === "gpt-5-mini")).toMatchObject({ kind: "unverified", documentedEfforts: [], plannedEfforts: ALL_EFFORTS });
  expect(census.included.find(row => row.modelId === "gpt-4.1")?.plannedEfforts).toEqual([]);
  expect(census.excluded.find(row => row.modelId === "gpt-5-search-api")?.reason).toContain("tool-free");
  const explicit = census.included.reduce((sum, row) => sum + row.plannedEfforts.length, 0);
  const maximum = (census.included.length + explicit) * 27 + 8 * 216 + explicit;
  expect(maximum).toBe(8121);
  expect(maximum + 4).toBeLessThanOrEqual(8192);
});

it("fails on new unclassified IDs or duplicate inventory instead of silently excluding a model", () => {
  expect(() => buildModelCensus(["gpt-unreviewed-future-model"])).toThrow("unclassified");
  expect(() => buildModelCensus(["gpt-6-luna", "gpt-6-luna"])).toThrow("unique");
});
