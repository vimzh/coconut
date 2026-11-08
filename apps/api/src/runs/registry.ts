// Fixed suite choices verify historical artifacts and preserve profile-bound scorer identities.
import { createReadStream } from "node:fs";
import { generateChallengeSuite, getChallengeRequest } from "../challenge";
import { generateInteriorSuite, getInteriorRequest } from "../interior";
import { generateNumericalSuite } from "../numerics/suite";
import { getProfile, type ProfileId } from "../protocol";
import { apiDataFile } from "../runtime-paths";
import { validateSuiteArtifact } from "../suites/artifact";
import { generateSuite, SuiteInputError } from "../suites/generator";
import { freezeData } from "../suites/generator";
import type { RunSuite, RunSuiteDescription, RunSuiteKey } from "./types";

const choices = Object.freeze({
  "reference-v1": { file: "reference-v1.json", name: "Exact reference", description: "75 certified piecewise expressions at five measured depths.", recommended: false },
  "smooth-v2": { file: "smooth-v2.json", name: "Smooth reference", description: "27 certified smooth expressions with domain-aware instructions.", recommended: false },
  "challenge-v1": { file: "challenge-v1.json", name: "Curvature challenge", description: "72 tasks across eight families, balanced by class and parameter group.", recommended: true },
  "screening-v1": { file: "challenge-v1.json", name: "Exploratory screening", description: "Nine tasks using parameter groups held out from the confirmation challenge.", recommended: false },
  "interior-v1": { file: "interior-v1.json", name: "Interior curvature exploration", description: "72 quintic-composition tasks across three families and eight shared source-polynomial groups. Exploratory and unranked.", recommended: false },
});
const cache = new Map<string, Promise<RunSuite>>();
const MAX_CACHE = 64;
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const baseIds = {
  "reference-v1": "suite-v1-0149a94ef54c099effeaeca05959e310c7fddb8f56d6897e0cb37a759d055b41",
  "smooth-v2": "suite-smooth-v1-8806b2856918ad1add284101d685e16252e8d03f6f4bf0ba8e55937e2ff1e5f4",
  "challenge-v1": "suite-challenge-v1-6a1bf3255f8104661db7ce0ae4f3be4182e8ac3b8b9240774aacfc339e433dd9",
  "screening-v1": "suite-challenge-v1-6a1bf3255f8104661db7ce0ae4f3be4182e8ac3b8b9240774aacfc339e433dd9",
  "interior-v1": "suite-interior-v1-99c5b377b79244e5c5e7e267548964a14fb1ae64eb92998d44166024dcf5d10c",
};

async function readArtifact(key: RunSuiteKey): Promise<RunSuite> {
  const chunks: Buffer[] = [];
  let size = 0;
  const path = apiDataFile(`suites/${choices[key].file}`);
  for await (const chunk of createReadStream(path)) {
    size += chunk.length;
    if (size > MAX_ARTIFACT_BYTES) throw new SuiteInputError("Run suite artifact exceeds its input budget.");
    chunks.push(chunk);
  }
  const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown;
  const suite = await validateSuiteArtifact(input);
  if (suite.id !== baseIds[key]) throw new SuiteInputError("Run suite artifact does not match its registered identity.");
  return suite;
}

async function build(key: RunSuiteKey, profileId: ProfileId): Promise<RunSuite> {
  const base = profileId === "one-shot-json-v1" ? await readArtifact(key) : await loadRunSuite(key, "one-shot-json-v1");
  if (base.cases.length < 1 || base.cases.length > 75 || base.request.purpose !== "evaluation") throw new SuiteInputError("Run suite is outside the supported case budget.");
  if (profileId === "one-shot-json-v1" && key !== "screening-v1") return base;
  const generated = key === "screening-v1" || key === "challenge-v1"
    ? await generateChallengeSuite(getChallengeRequest(key === "screening-v1" ? "screening" : "confirmation", profileId))
    : key === "interior-v1" ? await generateInteriorSuite(getInteriorRequest(profileId))
    : base.formatVersion === "1" ? await generateSuite({ ...base.request, profileId })
      : await generateNumericalSuite({ ...base.request, profileId });
  if (generated.status !== "complete") throw new SuiteInputError("Run suite coverage could not be completed.");
  const suite = await validateSuiteArtifact(generated.suite);
  if (suite.cases.length < 1 || suite.cases.length > 75 || suite.request.profileId !== profileId) throw new SuiteInputError("Run suite does not match the selected profile or case budget.");
  return suite;
}

export async function loadRunSuite(key: RunSuiteKey, profileId: ProfileId): Promise<RunSuite> {
  if (typeof key !== "string" || !Object.hasOwn(choices, key)) throw new SuiteInputError("Choose a registered run suite.");
  const profile = getProfile(profileId);
  const identity = `${key}:${profile.id}`;
  const existing = cache.get(identity);
  if (existing) { cache.delete(identity); cache.set(identity, existing); return existing; }
  const pending = build(key, profile.id).catch((error: unknown) => {
    if (cache.get(identity) === pending) cache.delete(identity);
    if (error instanceof SuiteInputError) throw error;
    throw new SuiteInputError("Run suite could not be verified. Check the installed artifacts and numerical runtime.");
  });
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(identity, pending);
  return pending;
}

export async function listRunSuites(profileId: ProfileId = "one-shot-json-v1"): Promise<readonly RunSuiteDescription[]> {
  const keys = Object.keys(choices) as RunSuiteKey[];
  const suites = await Promise.all(keys.map((key) => loadRunSuite(key, profileId)));
  return freezeData(suites.map((suite, index) => ({
    key: keys[index], name: choices[keys[index]].name, description: choices[keys[index]].description,
    suiteId: suite.id, caseCount: suite.cases.length, depths: [...suite.request.depths],
    generatorVersion: suite.generatorVersion, promptVersion: suite.formatVersion === "2" ? suite.promptVersion : "exact-v1",
    recommended: choices[keys[index]].recommended,
  })));
}
