// Run one explicit local provider access check without retaining its credential.
import { writeFile } from "node:fs/promises";
import { checkProviderAccess } from "./index";
import { AccessInputError, parseAccessRequest, parseCredential, safeAccessInputError } from "./policy";
import { reflectsCredential } from "./responses";
import type { AccessRequest, ProviderAccessClient, ProviderId } from "./types";

const usage = "Usage: --provider <openai|openrouter|hugging-face> --credential-env <OPENAI_API_KEY|OPENROUTER_API_KEY|HF_TOKEN> [--model <model-id> --serving-provider <slug> --accept-charges] [--output <new-path>]";
const credentialVariables: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", "hugging-face": "HF_TOKEN",
};

function invalidArguments(): never {
  throw new AccessInputError("invalid-input", "Invalid provider access CLI arguments.");
}

function parseArguments(args: readonly string[]): { request: AccessRequest; credentialVariable: string; output?: string } {
  const options = new Map<string, string | true>();
  const valueFlags = ["--provider", "--credential-env", "--model", "--serving-provider", "--output"];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (options.has(flag)) invalidArguments();
    if (flag === "--accept-charges") {
      options.set(flag, true);
      continue;
    }
    if (!valueFlags.includes(flag)) invalidArguments();
    const value = args[++index];
    if (!value || value.startsWith("--")) invalidArguments();
    options.set(flag, value);
  }
  const provider = options.get("--provider");
  if (provider !== "openai" && provider !== "openrouter" && provider !== "hugging-face") invalidArguments();
  const credentialVariable = options.get("--credential-env");
  if (credentialVariable !== credentialVariables[provider]) invalidArguments();
  const modelId = options.get("--model");
  const servingProvider = options.get("--serving-provider");
  if (modelId === undefined && (servingProvider !== undefined || options.has("--accept-charges"))) invalidArguments();
  const request = parseAccessRequest(modelId === undefined
    ? { provider, operation: "authenticate" }
    : { provider, operation: "probe", modelId, servingProvider: servingProvider ?? null, acceptCharges: options.has("--accept-charges") });
  return { request, credentialVariable, output: options.get("--output") as string | undefined };
}

export async function runCli(args: readonly string[], client: ProviderAccessClient = checkProviderAccess): Promise<number> {
  try {
    const options = parseArguments(args);
    const credential = parseCredential(process.env[options.credentialVariable]);
    if (reflectsCredential(JSON.stringify(options.request), credential)) invalidArguments();
    const result = await client(options.request, credential);
    const json = JSON.stringify(result);
    if (reflectsCredential(json, credential)) throw new Error("Unsafe provider evidence.");
    if (options.output) {
      try {
        await writeFile(options.output, `${json}\n`, { flag: "wx" });
      } catch {
        console.error("Provider access CLI could not create its output file. Choose a writable new path; existing files cannot be overwritten.");
        return 1;
      }
    }
    console.log(json);
    return result.status === "authenticated" || result.status === "inference-verified" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof AccessInputError
      ? `Provider access CLI failed: ${safeAccessInputError(error).message} ${usage}`
      : "Provider access CLI failed. No credential or provider diagnostic details were retained.");
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runCli(Bun.argv.slice(2));
