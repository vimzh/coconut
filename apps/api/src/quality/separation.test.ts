import { expect, it } from "bun:test";
import { Arithmetic, format } from "../math/rational";
import type { ChallengeSuite } from "../challenge";
import { provedDifferentCurvatureCore } from "./separation";

it("proves nonproportional curvature, while leaving scaling and reflection controls related", async () => {
  const suite = await Bun.file(new URL("../../data/suites/challenge-v1.json", import.meta.url)).json() as ChallengeSuite;
  const logarithm = suite.cases[0].certificate, reciprocal = suite.cases[9].certificate;
  expect(provedDifferentCurvatureCore(logarithm, reciprocal)).toBe(true);
  expect(provedDifferentCurvatureCore(logarithm, logarithm)).toBe(false);
  const arithmetic = new Arithmetic();
  const scale = (value: string) => { const [n, d = "1"] = value.split("/"); return format(arithmetic.fraction(3n * BigInt(n), BigInt(d))); };
  const reflected = { ...reciprocal, probes: reciprocal.probes.map((point, i) => ({ ...point,
    second: { min: scale(reciprocal.probes[8 - i].second.min), max: scale(reciprocal.probes[8 - i].second.max) } })) };
  expect(provedDifferentCurvatureCore(reciprocal, reflected)).toBe(false);
});
