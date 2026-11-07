// Search public models or resolve an explicit visitor-owned model selection without retaining credentials.
import { writeFile } from "node:fs/promises";
import { AccessInputError, parseCredential, safeAccessInputError } from "../providers/policy";
import { reflectsCredential } from "../providers/responses";
import type { ProviderId } from "../providers/types";
import { searchHuggingFaceModels, selectModel } from "./client";
import { DiscoveryInputError, parseSearchRequest, parseSelectionRequest } from "./policy";
import type { ModelSearchClient, ModelSelectionClient, SearchRequest, SelectionRequest } from "./types";

const usage = "Usage: search --query <text> [--limit <1-20>] [--output <new-path>] | select --provider <openai|openrouter|hugging-face> --model <model-id> [--serving-provider <slug>] --profile <profile-id> --credential-env <OPENAI_API_KEY|OPENROUTER_API_KEY|HF_TOKEN> [--verify --accept-charges] [--output <new-path>]";
const credentialVariables: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", "hugging-face": "HF_TOKEN",
};
type Arguments = { output?: string } & (
  | { command: "search"; request: SearchRequest }
  | { command: "select"; request: SelectionRequest; credentialVariable: string }
);

function invalidArguments(): never { throw new DiscoveryInputError(); }

function parseArguments(args: readonly string[]): Arguments {
  const command = args[0];
  if (command !== "search" && command !== "select") invalidArguments();
  const valueFlags = command === "search"
    ? ["--query", "--limit", "--output"]
    : ["--provider", "--model", "--serving-provider", "--profile", "--credential-env", "--output"];
  const options = new Map<string, string | true>();
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (options.has(flag)) invalidArguments();
    if (command === "select" && (flag === "--verify" || flag === "--accept-charges")) {
      options.set(flag, true);
      continue;
    }
    if (!valueFlags.includes(flag)) invalidArguments();
    const value = args[++index];
    if (!value || value.startsWith("--")) invalidArguments();
    options.set(flag, value);
  }
  const output = options.get("--output") as string | undefined;
  if (command === "search") {
    const limit = options.get("--limit") ?? "20";
    if (typeof limit !== "string" || !/^\d+$/.test(limit)) invalidArguments();
    return { command, output, request: parseSearchRequest({ query: options.get("--query"), limit: Number(limit) }) };
  }
  const provider = options.get("--provider");
  if (provider !== "openai" && provider !== "openrouter" && provider !== "hugging-face") invalidArguments();
  const credentialVariable = options.get("--credential-env");
  if (credentialVariable !== credentialVariables[provider]) invalidArguments();
  if (options.has("--verify") !== options.has("--accept-charges")) invalidArguments();
  const base = {
    provider, modelId: options.get("--model"), servingProvider: options.get("--serving-provider") ?? null,
    profileId: options.get("--profile"),
  };
  const request = parseSelectionRequest(options.has("--verify")
    ? { ...base, verification: "probe", acceptCharges: true }
    : { ...base, verification: "metadata" });
  return { command, output, request, credentialVariable };
}

export async function runCli(args: readonly string[], clients: {
  searchClient?: ModelSearchClient; selectionClient?: ModelSelectionClient;
} = {}): Promise<number> {
  try {
    const options = parseArguments(args);
    let json: string;
    let success: boolean;
    if (options.command === "search") {
      const result = await (clients.searchClient ?? searchHuggingFaceModels)(options.request);
      json = JSON.stringify(result);
      success = result.status === "complete";
    } else {
      const credential = parseCredential(process.env[options.credentialVariable]);
      if (reflectsCredential(JSON.stringify(options.request), credential)) invalidArguments();
      const result = await (clients.selectionClient ?? selectModel)(options.request, credential);
      json = JSON.stringify(result);
      if (reflectsCredential(json, credential)) throw new Error("Unsafe selection evidence.");
      success = result.status === "ready" || result.status === "needs-verification";
    }
    console.log(json);
    if (options.output) {
      try {
        await writeFile(options.output, `${json}\n`, { flag: "wx" });
      } catch {
        console.error("Model discovery CLI could not create its output file; existing files cannot be overwritten. The completed result is available on stdout. Do not repeat the provider operation.");
        return 1;
      }
    }
    return success ? 0 : 1;
  } catch (error) {
    if (error instanceof DiscoveryInputError) {
      const safeError = new DiscoveryInputError(error.code === "charge-authorization-required" ? error.code : "invalid-input");
      console.error(`Model discovery CLI failed: ${safeError.message} ${usage}`);
    } else if (error instanceof AccessInputError) {
      console.error(`Model discovery CLI failed: ${safeAccessInputError(error).message} ${usage}`);
    } else {
      console.error("Model discovery CLI failed. No credential or provider diagnostic details were retained.");
    }
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runCli(Bun.argv.slice(2));
