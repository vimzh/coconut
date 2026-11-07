// Verify local CLI consent, credential isolation, safe records, and failure exits.
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli";
import { AccessInputError } from "./policy";
import type { AccessRequest, AccessResult, ProviderAccessClient, ProviderId } from "./types";

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
const credentials = {
  OPENAI_API_KEY: "synthetic-openai-cli-secret-token",
  OPENROUTER_API_KEY: "synthetic-openrouter-cli-secret-token",
  HF_TOKEN: "synthetic-huggingface-cli-secret-token",
};
const credentialNames: Record<ProviderId, keyof typeof credentials> = {
  openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", "hugging-face": "HF_TOKEN",
};
let originalEnvironment: Record<string, string | undefined>;
let directory: string;
let stdout: string[];
let stderr: string[];
let logSpy: ReturnType<typeof spyOn<typeof console, "log">>;
let errorSpy: ReturnType<typeof spyOn<typeof console, "error">>;

function argumentsFor(provider: ProviderId = "openai"): string[] {
  return ["--provider", provider, "--credential-env", credentialNames[provider]];
}

function evidence(request: AccessRequest, status?: AccessResult["status"]): AccessResult {
  return {
    version: "1", requestId: "fixture-access-request", checkedAt: "2026-11-07T00:00:00.000Z",
    provider: request.provider, operation: request.operation,
    status: status ?? (request.operation === "probe" ? "inference-verified" : "authenticated"),
    requestedModelId: request.operation === "probe" ? request.modelId : null,
    reportedModelId: request.operation === "probe" ? "fixture-model" : null,
    requestedServingProvider: request.operation === "probe" ? request.servingProvider : null,
    reportedServingProvider: null, httpStatus: 200,
    usage: { inputTokens: null, outputTokens: null },
    budget: { maxHttpAttempts: 1, maxInferenceRequests: request.operation === "probe" ? 1 : 0, maxOutputTokens: request.operation === "probe" ? 128 : 0, timeoutMs: 20000 },
    failure: status === "not-verified" ? { code: "permission-denied", message: "The operation is not permitted.", remoteOutcome: "response-received" } : null,
  };
}

function fixtureClient(status?: AccessResult["status"]) {
  return mock(async (request: unknown, credential: unknown) => {
    const input = request as AccessRequest;
    expect(credential).toBe(credentials[credentialNames[input.provider]]);
    return evidence(input, status);
  });
}

function expectNoSecrets(...records: string[]): void {
  const text = [...stdout, ...stderr, ...records].join("\n");
  for (const secret of Object.values(credentials)) {
    expect(text).not.toContain(secret);
    expect(text).not.toContain(Buffer.from(secret).toString("base64"));
  }
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "coconut-provider-cli-"));
  originalEnvironment = {};
  for (const [name, value] of Object.entries(credentials)) {
    originalEnvironment[name] = process.env[name];
    process.env[name] = value;
  }
  stdout = [];
  stderr = [];
  logSpy = spyOn(console, "log").mockImplementation((value: unknown) => { stdout.push(String(value)); });
  errorSpy = spyOn(console, "error").mockImplementation((value: unknown) => { stderr.push(String(value)); });
});

afterEach(async () => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await rm(directory, { recursive: true, force: true });
});

describe("provider access CLI", () => {
  it("authenticates each explicit provider using only its selected credential", async () => {
    const client = fixtureClient();
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      expect(await runCli(argumentsFor(provider), client)).toBe(0);
      expect(JSON.parse(stdout.at(-1)!)).toEqual(evidence({ provider, operation: "authenticate" }));
      expect(client.mock.calls.at(-1)?.[0]).toEqual({ provider, operation: "authenticate" });
    }
    expect(client).toHaveBeenCalledTimes(3);
    expect(stderr).toEqual([]);
    expectNoSecrets();
  });

  it("sends only an explicit charge-approved model and serving route", async () => {
    const client = fixtureClient();
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      const servingProvider = provider === "openai" ? null : "fixture-provider";
      const args = [...argumentsFor(provider), "--model", "fixture/model", "--accept-charges"];
      if (servingProvider) args.push("--serving-provider", servingProvider);
      expect(await runCli(args, client)).toBe(0);
      expect(client.mock.calls.at(-1)?.[0]).toEqual({ provider, operation: "probe", modelId: "fixture/model", servingProvider, acceptCharges: true });
    }
    expect(client).toHaveBeenCalledTimes(3);
    expect(stderr).toEqual([]);
    expectNoSecrets();
  });

  it("rejects missing, duplicate, unknown, and secret-bearing arguments without a client call", async () => {
    const client = fixtureClient();
    const invalid = [
      [], ["--provider"], ["--provider", "openai"], ["--credential-env", "OPENAI_API_KEY"],
      ["--provider", ""], ["--provider", "unknown", "--credential-env", "OPENAI_API_KEY"],
      [...argumentsFor(), "--key", credentials.OPENAI_API_KEY],
      [...argumentsFor(), credentials.OPENAI_API_KEY],
      [...argumentsFor(), `--${credentials.OPENAI_API_KEY}`],
      [...argumentsFor(), "--provider", "openai"],
      [...argumentsFor(), "--credential-env", "OPENAI_API_KEY"],
      [...argumentsFor(), "--output"],
      [...argumentsFor(), "--output", ""],
      [...argumentsFor(), "--output", "--accept-charges"],
      [...argumentsFor(), "--output", "unused.json", "--output", "again.json"],
      [...argumentsFor(), "--model", "fixture-model", "--model", "again", "--accept-charges"],
      [...argumentsFor(), "--model", "fixture-model", "--accept-charges", "--accept-charges"],
      [...argumentsFor("openrouter"), "--model", "fixture-model", "--accept-charges", "--serving-provider", "route", "--serving-provider", "other"],
      [...argumentsFor(), "--accept-charges=true"],
    ];
    for (const args of invalid) expect(await runCli(args, client)).toBe(1);
    expect(client).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expect(stderr).toHaveLength(invalid.length);
    expect(stderr.every((line) => line.includes("Usage:"))).toBe(true);
    expect(await readdir(directory)).toEqual([]);
    expectNoSecrets();
  });

  it("rejects wrong-provider or arbitrary environment selection without reading another key", async () => {
    const client = fixtureClient();
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      for (const name of [...Object.keys(credentials).filter((name) => name !== credentialNames[provider]), "CUSTOM_KEY", credentials.OPENAI_API_KEY]) {
        expect(await runCli(["--provider", provider, "--credential-env", name], client)).toBe(1);
      }
    }
    expect(client).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("requires the selected nonempty valid credential and never substitutes another key", async () => {
    const client = fixtureClient();
    for (const value of [undefined, "", "short", "synthetic credential with spaces", "synthetic-token\nwith-control"]) {
      if (value === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = value;
      expect(await runCli(argumentsFor(), client)).toBe(1);
      if (value) expect(stderr.at(-1)).not.toContain(value);
    }
    expect(client).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("rejects missing consent, implicit routes, and contradictory authentication options", async () => {
    const client = fixtureClient();
    const invalid = [
      [...argumentsFor(), "--accept-charges"],
      [...argumentsFor(), "--serving-provider", "route"],
      [...argumentsFor(), "--model", "fixture-model"],
      [...argumentsFor(), "--model", "fixture-model", "--accept-charges", "--serving-provider", "openai"],
      [...argumentsFor("openrouter"), "--model", "fixture-model", "--accept-charges"],
      [...argumentsFor("hugging-face"), "--model", "fixture/model", "--accept-charges"],
      [...argumentsFor("openrouter"), "--model", "fixture-model", "--accept-charges", "--serving-provider", "auto"],
      [...argumentsFor("hugging-face"), "--model", "fixture/model:route", "--accept-charges", "--serving-provider", "route"],
      [...argumentsFor(), "--model", credentials.OPENAI_API_KEY, "--accept-charges"],
    ];
    for (const args of invalid) expect(await runCli(args, client)).toBe(1);
    expect(client).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("writes the same compact safe JSON to a new file and stdout", async () => {
    const output = join(directory, "access.json");
    const client = fixtureClient();
    expect(await runCli([...argumentsFor(), "--output", output], client)).toBe(0);
    const contents = await readFile(output, "utf8");
    expect(contents).toBe(`${stdout[0]}\n`);
    expect(contents).toBe(`${JSON.stringify(JSON.parse(contents))}\n`);
    expect(client).toHaveBeenCalledTimes(1);
    expect(stderr).toEqual([]);
    expectNoSecrets(contents);
  });

  it("retains safe failure evidence but returns a failing exit status without retry", async () => {
    const output = join(directory, "failed-access.json");
    const client = fixtureClient("not-verified");
    expect(await runCli([...argumentsFor(), "--output", output], client)).toBe(1);
    const contents = await readFile(output, "utf8");
    expect(JSON.parse(contents).status).toBe("not-verified");
    expect(contents).toBe(`${stdout[0]}\n`);
    expect(client).toHaveBeenCalledTimes(1);
    expect(stderr).toEqual([]);
    expectNoSecrets(contents);
  });

  it("refuses existing or unwritable output paths without exposing the path", async () => {
    const retained = "existing retained record\n";
    const existing = join(directory, "existing.json");
    await writeFile(existing, retained);
    const client = fixtureClient();
    for (const output of [existing, join(directory, credentials.OPENAI_API_KEY, "missing.json")]) {
      expect(await runCli([...argumentsFor(), "--output", output], client)).toBe(1);
      expect(stderr.at(-1)).toContain("existing files cannot be overwritten");
      expect(stderr.at(-1)).not.toContain(output);
    }
    expect(await readFile(existing, "utf8")).toBe(retained);
    expect(stdout).toEqual([]);
    expectNoSecrets();
  });

  it("sanitizes arbitrary transport and input exceptions without saving a record", async () => {
    const output = join(directory, "access.json");
    for (const thrown of [
      new Error(credentials.OPENAI_API_KEY),
      new AccessInputError("invalid-credential", credentials.OPENAI_API_KEY),
      { message: credentials.OPENAI_API_KEY }, credentials.OPENAI_API_KEY,
    ]) {
      const client: ProviderAccessClient = async () => { throw thrown; };
      expect(await runCli([...argumentsFor(), "--output", output], client)).toBe(1);
    }
    expect(stdout).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
    expectNoSecrets();
  });

  it("discards credential reflection even if an injected client returns unsafe evidence", async () => {
    const output = join(directory, "access.json");
    for (const reflected of [credentials.OPENAI_API_KEY, Buffer.from(credentials.OPENAI_API_KEY).toString("base64")]) {
      const client: ProviderAccessClient = async (request) => ({ ...evidence(request as AccessRequest), requestId: reflected });
      expect(await runCli([...argumentsFor(), "--output", output], client)).toBe(1);
    }
    expect(stdout).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
    expectNoSecrets();
  });

  it("returns process exit one for invalid arguments and missing credentials", async () => {
    for (const args of [
      [...argumentsFor(), "--key", credentials.OPENAI_API_KEY], argumentsFor(),
    ]) {
      const child = Bun.spawn([process.execPath, cliPath, ...args], {
        cwd: directory, stdout: "pipe", stderr: "pipe",
        env: { ...process.env, OPENAI_API_KEY: "", OPENROUTER_API_KEY: "", HF_TOKEN: "" },
      });
      const [exitCode, output, errors] = await Promise.all([
        child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
      ]);
      expect(exitCode).toBe(1);
      expect(output).toBe("");
      expect(errors).toContain("Provider access CLI failed:");
      expectNoSecrets(output, errors);
    }
    expect(await readdir(directory)).toEqual([]);
  });
});
