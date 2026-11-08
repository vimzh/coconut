import { expect, test } from "bun:test";
import { checkDepth60Suite, runDepth60Pool } from "./depth60";
import { validateFrozenSuite } from "../suites";

test("pilot requires its exact depth and balanced label population", async () => {
  const suite = await validateFrozenSuite(await Bun.file(new URL("../../data/suites/depth60-v1.json", import.meta.url)).json());
  expect(() => checkDepth60Suite(suite)).not.toThrow();
  expect(() => checkDepth60Suite({ ...suite, cases: suite.cases.slice(1) })).toThrow();
  expect(() => checkDepth60Suite({ ...suite, cases: suite.cases.map(row => ({ ...row, depth: 59 })) })).toThrow();
});

test("pilot bounds concurrency, retains cancellation boundary, and surfaces work failures", async () => {
  const controller = new AbortController();
  let active = 0, peak = 0, completed = 0;
  await runDepth60Pool([0, 1, 2, 3, 4, 5], 2, controller.signal, async () => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    completed++; active--;
    if (completed === 2) controller.abort();
  });
  expect(peak).toBe(2);
  expect(completed).toBe(3);
  await expect(runDepth60Pool([0], 13, new AbortController().signal, async () => {})).rejects.toThrow();
  await expect(runDepth60Pool([0], 1, new AbortController().signal, async () => { throw new Error("Persistence failed"); })).rejects.toThrow();
  const started: number[] = [];
  await expect(runDepth60Pool([0, 1, 2, 3], 2, new AbortController().signal, async row => {
    started.push(row);
    if (row === 0) throw new Error("Inference failed");
    await new Promise(resolve => setTimeout(resolve, 1));
  })).rejects.toThrow();
  expect(started.every(row => row < 2)).toBe(true);
});
