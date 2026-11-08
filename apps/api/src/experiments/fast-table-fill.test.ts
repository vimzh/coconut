// Exercise fixed budget identities, actual header admission and bounded worker cancellation without provider traffic.
import { expect, test } from "bun:test";
import { assertFastAccess, assertFastDispatch, fastCells, fastConcurrency, fastPool, fastRows, retainNativeScreening } from "./fast-table-fill";
import { buildPrompt } from "../protocol";

const prompt = buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex", witnessPairs: [{ x: "-1", y: "1" }] }, "one-shot-json-v1");
const tasks = Object.fromEntries(fastCells.map(cell => [cell.key, Array.from({ length: 9 }, (_, i) => ({ caseId: `${cell.key}-${i}`, depth: 3, label: "convex" as const, prompt }))]));
test("freezes exactly 351 missing-cell identities with three trials and no duplicate work", () => {
  const rows = fastRows(tasks);
  expect(rows).toHaveLength(351);
  expect(rows.filter(row => row.cell === "screening-standard")).toHaveLength(27);
  expect(rows.filter(row => row.cell === "depth60")).toHaveLength(54);
  for (const cell of ["depth100", "depth216"]) expect(rows.filter(row => row.cell === cell)).toHaveLength(135);
  expect(rows.every(row => !row.dispatched && row.result === null)).toBe(true);
  expect(fastRows(tasks)).toEqual(rows);
  expect(() => fastRows({ ...tasks, depth60: tasks.depth60.slice(1) })).toThrow("351 unique");
});
test("increases concurrency only with all five model headers and conservative observed headroom", () => {
  const ids = ["gpt-5.4-mini", "gpt-5.6-luna", "gpt-6-luna", "gpt-5.6-terra", "gpt-6.1-terra"];
  const headers = ids.map(modelId => ({ modelId, requests: 1000, tokens: 1000000 }));
  expect(fastConcurrency(headers)).toBe(24);
  expect(fastConcurrency(headers.slice(1))).toBe(5);
  expect(fastConcurrency(headers.map(row => ({ ...row, tokens: NaN })))).toBe(5);
  expect(fastConcurrency(headers.map(row => ({ ...row, requests: 350 })))).toBe(5);
  expect(fastConcurrency(headers.map(row => ({ ...row, modelId: ids[0] })))).toBe(5);
});
test("worker pool bounds active requests and stops taking queued work after cancellation", async () => {
  let active = 0, maximum = 0, calls = 0;
  const controller = new AbortController();
  await fastPool(Array.from({ length: 50 }, (_, i) => i), 24, controller.signal, async () => {
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1)); controller.abort(); active--;
  });
  expect(maximum).toBe(24); expect(calls).toBe(24); expect(active).toBe(0);
  expect(fastPool([], 25, controller.signal, async () => {})).rejects.toThrow("1–24");
  await expect(fastPool([1, 2, 3], 1, new AbortController().signal, async () => { throw new Error("persist failed"); })).rejects.toThrow("worker failed");
});

test("wire guard rejects overspending, duplicate dispatches, wrong models and changed prompts/settings", () => {
  const row = fastRows(tasks)[0];
  const body = { model: row.modelId, input: prompt.messages, max_output_tokens: 4096, store: false, truncation: "disabled" };
  expect(() => assertFastDispatch(JSON.stringify(body), row, prompt, 350, "POST")).not.toThrow();
  expect(() => assertFastDispatch(JSON.stringify(body), row, prompt, 351, "POST")).toThrow();
  expect(() => assertFastDispatch(JSON.stringify(body), { ...row, dispatched: true }, prompt, 0, "POST")).toThrow();
  for (const patch of [{ model: "other" }, { max_output_tokens: 16384 }, { input: [] }, { store: true }, { reasoning: { effort: "high" } }, { truncation: "auto" }])
    expect(() => assertFastDispatch(JSON.stringify({ ...body, ...patch }), row, prompt, 0, "POST")).toThrow();
  expect(() => assertFastDispatch(JSON.stringify(body), row, prompt, 0, "GET")).toThrow();
});

test("native scoring exceptions become explicit incomplete evidence instead of losing terminal accounting", async () => {
  let persisted = false;
  const result = await retainNativeScreening(async () => { throw new Error("proof replay failed"); }, async () => { persisted = true; });
  expect(result.nativeReportSha256).toBeNull();
  expect(result.scoringFailure).toContain("scoring or proof replay failed");
  expect(persisted).toBe(false);
});

test("accepts real metadata-only evidence without treating its unused probe object as an inference result", async () => {
  const access = await Bun.file(new URL("../../data/experiments/fast-table-fill-access-v1.json", import.meta.url)).json();
  expect(() => assertFastAccess(access)).not.toThrow();
  const changed = structuredClone(access);
  changed.results[0].budget.maxInferenceRequests = 1;
  expect(() => assertFastAccess(changed)).toThrow("metadata-only");
  changed.results[0].budget.maxInferenceRequests = 0;
  changed.results[0].probe.usage.inputTokens = 10;
  expect(() => assertFastAccess(changed)).toThrow("metadata-only");
});
