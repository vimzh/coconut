// Pure scheduler fixtures exercise all planned research identities without credentials or retained private artifacts.
import { expect, it } from "bun:test";
import { scheduleRows } from "./execution";
import type { DeepRow } from "./study";
import { DEEP_MODELS } from "./transport";

function rows(): DeepRow[] {
  return Array.from({ length: 2400 }, (_, index) => ({ modelId: DEEP_MODELS[index % 3].modelId, caseId: `synthetic-${Math.floor(index / 3)}`,
    trialIndex: 0, dispatch: null, result: null }));
}

it("executes every one of 2400 unique model/case/trial identities exactly once with at most 12 active requests", async () => {
  const population = rows(), seen = new Map<string, number>(), indices = new Set<number>();
  let active = 0, peak = 0;
  const result = await scheduleRows(population, new AbortController().signal, async (row, index) => {
    active++; peak = Math.max(peak, active);
    const identity = `${row.modelId}:${row.caseId}:${row.trialIndex}`;
    seen.set(identity, (seen.get(identity) ?? 0) + 1); indices.add(index);
    expect(population[index]).toBe(row);
    await Promise.resolve(); active--; return true;
  });
  expect(result).toEqual({ stopped: false, failures: 0 });
  expect(seen.size).toBe(2400); expect([...seen.values()].every(count => count === 1)).toBe(true); expect(indices.size).toBe(2400);
  expect(peak).toBe(12); expect(active).toBe(0);
  for (const model of DEEP_MODELS) expect([...seen.keys()].filter(identity => identity.startsWith(`${model.modelId}:`))).toHaveLength(800);
});

it("stops fresh scheduling on the first infrastructure outcome while draining all 12 already-active requests", async () => {
  const gates = Array.from({ length: 12 }, () => Promise.withResolvers<boolean>()), started = Promise.withResolvers<void>();
  const visited: number[] = [], finished: number[] = []; let settled = false;
  const pending = scheduleRows(rows(), new AbortController().signal, async (_row, index) => {
    visited.push(index); if (visited.length === 12) started.resolve();
    const usable = await gates[index].promise; finished.push(index); return usable;
  }).then(result => { settled = true; return result; });
  await started.promise; gates[0].resolve(false); await Bun.sleep(0);
  expect(visited).toEqual(Array.from({ length: 12 }, (_, index) => index)); expect(settled).toBe(false); expect(finished).toEqual([0]);
  gates.slice(1).forEach(gate => gate.resolve(true));
  expect(await pending).toEqual({ stopped: true, failures: 0 }); expect(finished).toHaveLength(12); expect(visited).toHaveLength(12);
});

it("retains a persistence exception once, stops fresh work and drains active peers without retries", async () => {
  const gates = Array.from({ length: 12 }, () => Promise.withResolvers<boolean>()), started = Promise.withResolvers<void>();
  const visited: number[] = []; let settled = false;
  const pending = scheduleRows(rows(), new AbortController().signal, async (_row, index) => {
    visited.push(index); if (visited.length === 12) started.resolve(); return gates[index].promise;
  }).then(result => { settled = true; return result; });
  await started.promise; gates[0].reject(new Error("Synthetic evidence persistence failure.")); await Bun.sleep(0);
  expect(visited).toHaveLength(12); expect(settled).toBe(false);
  gates.slice(1).forEach(gate => gate.resolve(true));
  expect(await pending).toEqual({ stopped: true, failures: 1 }); expect(new Set(visited).size).toBe(12); expect(visited).toHaveLength(12);
});

it("honors cancellation before dispatch and during a cohort without scheduling replacement requests", async () => {
  const before = new AbortController(); before.abort(); let calls = 0;
  expect(await scheduleRows(rows(), before.signal, async () => { calls++; return true; })).toEqual({ stopped: true, failures: 0 }); expect(calls).toBe(0);
  const controller = new AbortController(), gate = Promise.withResolvers<boolean>(), started = Promise.withResolvers<void>();
  const visited: number[] = [];
  const pending = scheduleRows(rows(), controller.signal, async (_row, index) => {
    visited.push(index); if (visited.length === 12) started.resolve(); return gate.promise;
  });
  await started.promise; controller.abort(); gate.resolve(true);
  expect(await pending).toEqual({ stopped: true, failures: 0 }); expect(visited).toHaveLength(12); expect(new Set(visited).size).toBe(12);
});

it("supports a bounded single worker and rejects malformed population/concurrency before any callback", async () => {
  const visited: number[] = [];
  expect(await scheduleRows(rows(), new AbortController().signal, async (_row, index) => { visited.push(index); return index < 5; }, 1)).toEqual({ stopped: true, failures: 0 });
  expect(visited).toEqual([0, 1, 2, 3, 4, 5]);
  let calls = 0;
  for (const concurrency of [0, 13, -1, 1.5, NaN]) await expect(scheduleRows(rows(), new AbortController().signal, async () => { calls++; return true; }, concurrency)).rejects.toThrow("at most12");
  await expect(scheduleRows(rows().slice(1), new AbortController().signal, async () => { calls++; return true; })).rejects.toThrow("2400");
  expect(calls).toBe(0);
});
