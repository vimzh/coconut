// Verify explicit discovery commands, anonymous credential isolation, and protected local evidence output.
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccessInputError } from "../providers/policy";
import type { ProviderId } from "../providers/types";
import { runCli } from "./cli";
import { DiscoveryInputError, parseSearchRequest, parseSelectionRequest } from "./policy";
import type { ModelSearchClient, ModelSelectionClient, SearchRequest, SearchResult, SelectionRequest, SelectionResult } from "./types";

const credentials = { OPENAI_API_KEY: "synthetic-openai-discovery-credential", OPENROUTER_API_KEY: "synthetic-openrouter-discovery-credential", HF_TOKEN: "synthetic-hf-discovery-credential" };
const credentialNames: Record<ProviderId, keyof typeof credentials> = { openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", "hugging-face": "HF_TOKEN" };
let environment: Record<string, string | undefined>;
let directory: string;
let stdout: string[];
let stderr: string[];
let log: ReturnType<typeof spyOn<typeof console, "log">>;
let errorLog: ReturnType<typeof spyOn<typeof console, "error">>;

function selectionArguments(provider: ProviderId = "openai"): string[] {
  return ["select", "--provider", provider, "--model", provider === "openai" ? "fixture-model" : "owner/model",
    "--profile", "one-shot-json-v1", "--credential-env", credentialNames[provider],
    ...(provider === "openai" ? [] : ["--serving-provider", "fixture-route"])];
}

function searchEvidence(request: SearchRequest, status: SearchResult["status"] = "complete"): SearchResult {
  return { version: "1", requestId: "fixture-search", checkedAt: "2026-11-08T00:00:00.000Z", request,
    source: "https://huggingface.co/api/models", status, models: [], httpAttempts: 1, httpStatus: status === "complete" ? 200 : 503,
    failure: status === "complete" ? null : { code: "service-unavailable", message: "The upstream operation failed.", remoteOutcome: "response-received" } };
}

function selectionEvidence(request: SelectionRequest, status: SelectionResult["status"] = "needs-verification"): SelectionResult {
  return {
    version: "1", policyId: "model-selection-v1", requestId: "fixture-selection", checkedAt: "2026-11-08T00:00:00.000Z", expiresAt: "2026-11-08T00:05:00.000Z",
    request, metadata: null, status, capabilities: { textInput: "unknown", textOutput: "unknown", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    compatibility: { compatible: false, unsupported: [], unverified: ["textInput", "textOutput", "outputTokenLimit"] },
    probe: { status: "not-requested", reportedModelId: null, reportedServingProvider: null, usage: { inputTokens: null, outputTokens: null },
      outputLimitRequestAccepted: false, nativeSchemaRequestAccepted: false, outcome: null }, contextFit: "not-checked", sources: [], httpAttempts: 1, httpStatus: 200,
    budget: { maxHttpAttempts: 3, maxInferenceRequests: request.verification === "probe" ? 1 : 0,
      maxOutputTokens: request.verification === "probe" ? 4096 : 0, timeoutMs: 20000 }, blockers: [], failure: null,
  };
}

function fixtureClients(status?: SelectionResult["status"]) {
  return {
    searchClient: mock<ModelSearchClient>(async (input) => searchEvidence(parseSearchRequest(input))),
    selectionClient: mock<ModelSelectionClient>(async (input, credential) => {
      const request = parseSelectionRequest(input);
      expect(credential).toBe(credentials[credentialNames[request.provider]]);
      return selectionEvidence(request, status);
    }),
  };
}

function expectNoSecrets(...extra: string[]): void {
  const text = [...stdout, ...stderr, ...extra].join("\n");
  for (const credential of Object.values(credentials)) {
    expect(text).not.toContain(credential);
    expect(text).not.toContain(Buffer.from(credential).toString("base64"));
  }
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "coconut-discovery-cli-"));
  environment = {};
  for (const [key, value] of Object.entries(credentials)) { environment[key] = process.env[key]; process.env[key] = value; }
  stdout = []; stderr = [];
  log = spyOn(console, "log").mockImplementation((value: unknown) => { stdout.push(String(value)); });
  errorLog = spyOn(console, "error").mockImplementation((value: unknown) => { stderr.push(String(value)); });
});

afterEach(async () => {
  log.mockRestore(); errorLog.mockRestore();
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(directory, { recursive: true, force: true });
});

describe("model discovery CLI", () => {
  it("searches anonymously without reading any provider credential environment variable", async () => {
    const clients = fixtureClients();
    const previous = process.env;
    const credentialReads: PropertyKey[] = [];
    process.env = new Proxy(previous, { get(target, key) {
      if (Object.hasOwn(credentials, key)) { credentialReads.push(key); throw new Error("Search must not read credentials."); }
      return Reflect.get(target, key);
    } });
    try {
      expect(await runCli(["search", "--query", " fixture "], clients)).toBe(0);
      expect(await runCli(["search", "--query", "fixture", "--limit", "3"], clients)).toBe(0);
    } finally { process.env = previous; }
    expect(credentialReads).toEqual([]);
    expect(clients.searchClient.mock.calls.map((call) => call[0])).toEqual([{ query: "fixture", limit: 20 }, { query: "fixture", limit: 3 }]);
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expect(stderr).toEqual([]);
    expectNoSecrets();
  });

  it("resolves each exact provider route in metadata mode using only the selected environment key", async () => {
    const clients = fixtureClients();
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      expect(await runCli(selectionArguments(provider), clients)).toBe(0);
      const result = JSON.parse(stdout.at(-1)!);
      expect(result.status).toBe("needs-verification");
      expect(result.request).toEqual({ provider, modelId: provider === "openai" ? "fixture-model" : "owner/model",
        servingProvider: provider === "openai" ? null : "fixture-route", profileId: "one-shot-json-v1", verification: "metadata" });
      expect(result.budget.maxInferenceRequests).toBe(0);
    }
    expect(clients.selectionClient).toHaveBeenCalledTimes(3);
    expect(clients.searchClient).not.toHaveBeenCalled();
    expect(stderr).toEqual([]);
    expectNoSecrets();
  });

  it("requires both probe flags and passes the selected profile without substitution", async () => {
    const clients = fixtureClients("ready");
    for (const flags of [["--verify"], ["--accept-charges"]]) expect(await runCli([...selectionArguments(), ...flags], clients)).toBe(1);
    const args = selectionArguments("hugging-face");
    args[args.indexOf("one-shot-json-v1")] = "one-shot-schema-v1";
    expect(await runCli([...args, "--verify", "--accept-charges"], clients)).toBe(0);
    expect(clients.selectionClient).toHaveBeenCalledTimes(1);
    expect(clients.selectionClient.mock.calls[0]?.[0]).toEqual({ provider: "hugging-face", modelId: "owner/model", servingProvider: "fixture-route",
      profileId: "one-shot-schema-v1", verification: "probe", acceptCharges: true });
    expectNoSecrets();
  });

  it("rejects unknown, duplicate, missing, cross-command, and raw-secret arguments before any client", async () => {
    const clients = fixtureClients();
    const invalid = [[], ["unknown"], ["search"], ["search", "--query"], ["search", "--query", ""],
      ["search", "--query", "fixture", "--limit", "0"], ["search", "--query", "fixture", "--limit", "21"],
      ["search", "--query", "fixture", "--limit", "1.5"], ["search", "--query", "fixture", "--limit", "1e1"],
      ["search", "--query", "fixture", "--query", "again"], ["search", "--query", "fixture", "--verify"],
      ["search", "--query", "fixture", "--credential-env", "HF_TOKEN"], ["search", "--query", "fixture", "--output"],
      [...selectionArguments(), "--provider", "openai"], [...selectionArguments(), "--verify", "--verify", "--accept-charges"],
      [...selectionArguments(), "--key", credentials.OPENAI_API_KEY], [...selectionArguments(), credentials.OPENAI_API_KEY],
      [...selectionArguments(), "--output", "a.json", "--output", "b.json"], [...selectionArguments(), "--limit", "5"]];
    for (const args of invalid) expect(await runCli(args, clients)).toBe(1);
    expect(clients.searchClient).not.toHaveBeenCalled();
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expect(stderr.every((line) => line.includes("Usage:"))).toBe(true);
    expectNoSecrets();
  });

  it("rejects mismatched environments, missing profiles, and automatic or missing routes", async () => {
    const clients = fixtureClients();
    const invalid = [
      ["select", "--provider", "openai", "--model", "fixture-model", "--credential-env", "OPENAI_API_KEY"],
      ["select", "--provider", "openai", "--model", "fixture-model", "--profile", "unknown", "--credential-env", "OPENAI_API_KEY"],
      ["select", "--provider", "openrouter", "--model", "owner/model", "--profile", "one-shot-json-v1", "--credential-env", "OPENROUTER_API_KEY"],
      [...selectionArguments(), "--serving-provider", "openai"],
    ];
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      for (const name of [...Object.keys(credentials).filter((key) => key !== credentialNames[provider]), "CUSTOM_KEY"]) {
        const args = selectionArguments(provider); args[args.indexOf(credentialNames[provider])] = name; invalid.push(args);
      }
    }
    for (const args of invalid) expect(await runCli(args, clients)).toBe(1);
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("never substitutes ambient credentials when the selected key is missing or invalid", async () => {
    const clients = fixtureClients();
    for (const value of [undefined, "", "short", "synthetic credential with spaces"]) {
      if (value === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = value;
      expect(await runCli(selectionArguments(), clients)).toBe(1);
    }
    expect(clients.selectionClient).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("writes exactly the safe JSON evidence to stdout and an exclusively created file", async () => {
    const clients = fixtureClients();
    for (const args of [["search", "--query", "fixture"], selectionArguments()]) {
      const output = join(directory, `${args[0]}.json`);
      expect(await runCli([...args, "--output", output], clients)).toBe(0);
      const contents = await readFile(output, "utf8");
      expect(contents).toBe(`${stdout.at(-1)}\n`);
      expect(contents).toBe(`${JSON.stringify(JSON.parse(contents))}\n`);
      expectNoSecrets(contents);
    }
    expect(stderr).toEqual([]);
  });

  it("preserves failure and blocked evidence with nonzero exits and no retries", async () => {
    const failedSearch = mock<ModelSearchClient>(async (input) => searchEvidence(parseSearchRequest(input), "failed"));
    expect(await runCli(["search", "--query", "fixture"], { searchClient: failedSearch })).toBe(1);
    expect(JSON.parse(stdout.at(-1)!).status).toBe("failed");
    expect(failedSearch).toHaveBeenCalledTimes(1);
    for (const status of ["blocked", "failed", "ready", "needs-verification"] as const) {
      const clients = fixtureClients(status);
      const output = join(directory, `${status}.json`);
      expect(await runCli([...selectionArguments(), "--output", output], clients)).toBe(status === "ready" || status === "needs-verification" ? 0 : 1);
      expect(JSON.parse(await readFile(output, "utf8")).status).toBe(status);
      expect(clients.selectionClient).toHaveBeenCalledTimes(1);
    }
    expect(stderr).toEqual([]);
    expectNoSecrets();
  });

  it("retains complete stdout evidence after file failures without repeating charged operations", async () => {
    const existing = join(directory, "existing.json");
    await writeFile(existing, "preserved\n");
    for (const args of [["search", "--query", "fixture"], selectionArguments(), [...selectionArguments(), "--verify", "--accept-charges"]]) {
      for (const output of [existing, join(directory, credentials.OPENAI_API_KEY, "missing.json")]) {
        const clients = fixtureClients("ready");
        const count = stdout.length;
        expect(await runCli([...args, "--output", output], clients)).toBe(1);
        expect(stdout).toHaveLength(count + 1);
        if (args[0] === "search") {
          expect(clients.searchClient).toHaveBeenCalledTimes(1);
          expect(clients.selectionClient).not.toHaveBeenCalled();
          expect(JSON.parse(stdout.at(-1)!)).toEqual(searchEvidence({ query: "fixture", limit: 20 }));
        } else {
          expect(clients.selectionClient).toHaveBeenCalledTimes(1);
          expect(clients.searchClient).not.toHaveBeenCalled();
          expect(JSON.parse(stdout.at(-1)!)).toEqual(selectionEvidence(parseSelectionRequest(clients.selectionClient.mock.calls[0]?.[0]), "ready"));
        }
        expect(stderr.at(-1)).toContain("existing files cannot be overwritten");
        expect(stderr.at(-1)).toContain("completed result is available on stdout");
        expect(stderr.at(-1)).toContain("Do not repeat the provider operation");
        expect(stderr.at(-1)).not.toContain(output);
      }
    }
    expect(await readFile(existing, "utf8")).toBe("preserved\n");
    expect(stdout).toHaveLength(6);
    expectNoSecrets();
  });

  it("sanitizes arbitrary client failures and mutated input errors without writing evidence", async () => {
    const poisoned = new DiscoveryInputError();
    Object.assign(poisoned, { code: credentials.OPENAI_API_KEY, message: credentials.HF_TOKEN });
    for (const thrown of [new Error(credentials.OPENAI_API_KEY), new AccessInputError("invalid-credential", credentials.HF_TOKEN), poisoned, credentials.OPENROUTER_API_KEY]) {
      for (const args of [["search", "--query", "fixture"], selectionArguments()]) {
        const output = join(directory, "unsafe.json");
        expect(await runCli([...args, "--output", output], { searchClient: async () => { throw thrown; }, selectionClient: async () => { throw thrown; } })).toBe(1);
      }
    }
    expect(stdout).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
    expectNoSecrets();
  });

  it("rejects reflected credentials in requests and results before retaining any record", async () => {
    const clients = fixtureClients();
    const args = selectionArguments(); args[args.indexOf("fixture-model")] = credentials.OPENAI_API_KEY;
    expect(await runCli(args, clients)).toBe(1);
    expect(clients.selectionClient).not.toHaveBeenCalled();
    for (const reflected of [credentials.OPENAI_API_KEY, Buffer.from(credentials.OPENAI_API_KEY).toString("base64")]) {
      const selectionClient: ModelSelectionClient = async (input) => ({ ...selectionEvidence(parseSelectionRequest(input)), requestId: reflected });
      expect(await runCli([...selectionArguments(), "--output", join(directory, "unsafe.json")], { selectionClient })).toBe(1);
    }
    expect(stdout).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
    expectNoSecrets();
  });
});
