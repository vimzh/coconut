// Exact task identity and retained significant cores protect future candidates from development reuse.
import { expect, test } from "bun:test";
import { checkImportExposure, scalarDisplay } from "./admission";
import { pilotHash } from "./pilot";
import { randomizedCli } from "./cli";

test("strips only the outer scalar display assignment without changing rounded task meaning", () => {
  expect(scalarDisplay("$f(x) = 0.123*x^2$")).toBe("0.123*x^2");
  expect(scalarDisplay("x^2")).toBe("x^2");
  expect(scalarDisplay("$f(y) = x^2$")).toBe("$f(y) = x^2$");
});

test("flags exact repeats and shared cores across development/final candidates separately", () => {
  const domain = { min: "-1", max: "1" }, core = "a".repeat(64);
  const exposure = [{ exactHashes: [pilotHash({ expression: "x^2", domain })], coreHashes: [core] }];
  const result = checkImportExposure([
    { id: "same", expression: "x^2", domain, coreHashes: [] },
    { id: "scaled-core", expression: "2*x^2", domain, coreHashes: [core] },
    { id: "fresh", expression: "exp(x)", domain, coreHashes: ["b".repeat(64)] },
  ], exposure);
  expect(result.exactMatches).toEqual(["same"]);
  expect(result.relatedCores).toEqual(["scaled-core"]);
  expect(result.limitation).toContain("do not prove");
});

test("CLI rejects unknown commands and malformed flags before accessing any paid path", async () => {
  for (const args of [[], ["dispatch"], ["prepare"], ["prepare", "--depth", "216", "--depth", "512"], ["run", "--accept-charges"]])
    await expect(randomizedCli(args)).rejects.toThrow();
});
