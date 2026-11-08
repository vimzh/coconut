// Mounted routes exercise access, publication and ingress policy through the real run service and memory store.
import { beforeAll, expect, it } from "bun:test";
import { Hono } from "hono";
import { createInferenceClient } from "../inference";
import { buildPrompt } from "../protocol";
import { generateSuite } from "../suites/generator";
import { createRunService } from "./engine";
import { createRunRoutes } from "./routes";
import { createRunStore, RUN_STORE_LIMITS } from "./store";
import type { RunEvent, RunRequest, RunSuite } from "./types";

const providerKey = "R".repeat(43), base = "https://api.example.test", webOrigin = "https://web.example.test";
const request: RunRequest = { suiteKey: "reference-v1", provider: "openai", modelId: "fixture-route-model", servingProvider: null, profileId: "one-shot-json-v1", concurrency: 2, acceptCharges: true };
let suite: RunSuite;
beforeAll(async () => {
  const generated = await generateSuite({ seed: "run-routes-fixture-v1", depths: [5], casesPerClass: 1, profileId: request.profileId, purpose: "evaluation" });
  if (generated.status !== "complete") throw new Error("Route fixture suite did not certify.");
  suite = generated.suite;
});

function harness() {
  let clock = Date.now(), inferenceCalls = 0;
  const store = createRunStore({ path: ":memory:", now: () => clock });
  const labels = new Map(suite.cases.map(entry => [buildPrompt(entry.reference, request.profileId).messages[1].content, entry.label]));
  const inferenceClient = createInferenceClient(async (_url, init) => {
    if (init.method === "GET") return Response.json({ id: request.modelId, object: "model" });
    inferenceCalls++;
    const body = JSON.parse(init.body as string);
    return Response.json({ model: request.modelId, status: "completed", max_output_tokens: 4096, truncation: "disabled",
      output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ label: labels.get(body.input[1].content), explanation: "Route fixture." }) }] }],
      usage: { input_tokens: 100, output_tokens: 30, output_tokens_details: { reasoning_tokens: 0 } } });
  });
  const service = createRunService({ store, inferenceClient, loadSuite: async () => suite });
  const app = new Hono();
  app.route("/runs", createRunRoutes({ store, service, webOrigin, suites: async () => [{ key: "reference-v1", name: "Fixture", description: "Verified route fixture.", suiteId: suite.id, caseCount: 3, depths: [5], generatorVersion: "1", promptVersion: "exact-v1", recommended: false }] }));
  return { store, app, service, advance(ms: number) { clock += ms; }, get inferenceCalls() { return inferenceCalls; },
    call(path: string, init?: RequestInit) { return app.request(`${base}/runs${path}`, init); } };
}

const auth = (code: string) => ({ Authorization: `Bearer ${code}` });
const json = (code = providerKey) => ({ ...auth(code), "Content-Type": "application/json" });
async function start(fixture: ReturnType<typeof harness>) {
  const response = await fixture.call("", { method: "POST", headers: json(), body: JSON.stringify(request) });
  expect(response.status).toBe(200);
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line) as RunEvent);
  const started = events.find(event => event.type === "started");
  if (!started || started.type !== "started") throw new Error("Missing route started event.");
  expect(events.filter(event => event.type === "started")).toHaveLength(1);
  expect(events.filter(event => event.type === "finished")).toHaveLength(1);
  expect(events.filter(event => event.type !== "started").some(event => JSON.stringify(event).includes(started.accessCode))).toBe(false);
  return { id: started.runId, code: started.accessCode };
}

it("keeps runs private, separates provider/private codes and exports no credentials or access code", async () => {
  const fixture = harness();
  try {
    const started = await start(fixture);
    expect(fixture.inferenceCalls).toBe(9);
    expect((await fixture.call(`/${started.id}`)).status).toBe(401);
    for (const code of [providerKey, "X".repeat(43)]) expect((await fixture.call(`/${started.id}`, { headers: auth(code) })).status).toBe(404);
    const absent = await fixture.call("/missing", { headers: auth(started.code) });
    const wrong = await fixture.call(`/${started.id}`, { headers: auth(providerKey) });
    expect(await wrong.json()).toEqual(await absent.json());
    expect((await fixture.call(`/${started.id}/public`)).status).toBe(404);
    const exported = await fixture.call(`/${started.id}/export`, { headers: auth(started.code) });
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-disposition")).toBe(`attachment; filename="coconut-run-${started.id}.json"`);
    expect(exported.headers.get("cache-control")).toContain("no-store");
    const text = await exported.text();
    expect(text).not.toContain(providerKey); expect(text).not.toContain(started.code);
    expect(JSON.parse(text).record.report.overall.classification.population.status).toBe("complete");
    expect((await fixture.call("/invalid%0Aid/export", { headers: auth(started.code) })).status).toBe(404);
  } finally { fixture.store.close(); }
});

it("publishes explicitly, revokes visibility and deletes private/public evidence without rerunning", async () => {
  const fixture = harness();
  try {
    const started = await start(fixture);
    const publish = (code: string, body: unknown) => fixture.call(`/${started.id}/publication`, { method: "POST", headers: json(code), body: JSON.stringify(body) });
    expect((await publish(providerKey, { published: true })).status).toBe(404);
    for (const body of [{}, { published: "true" }, { published: true, accessCode: started.code }]) expect((await publish(started.code, body)).status).toBe(400);
    expect((await publish(started.code, { published: true })).status).toBe(200);
    const visible = await fixture.call(`/${started.id}/public`);
    expect(visible.status).toBe(200); expect((await visible.json()).publishedAt).not.toBeNull();
    expect((await publish(started.code, { published: false })).status).toBe(200);
    expect((await fixture.call(`/${started.id}/public`)).status).toBe(404);
    await publish(started.code, { published: true });
    expect((await fixture.call(`/${started.id}`, { method: "DELETE", headers: auth(providerKey) })).status).toBe(404);
    const deleted = await fixture.call(`/${started.id}`, { method: "DELETE", headers: auth(started.code) });
    expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ deleted: true });
    expect((await fixture.call(`/${started.id}`, { headers: auth(started.code) })).status).toBe(404);
    expect((await fixture.call(`/${started.id}/public`)).status).toBe(404);
    expect(fixture.inferenceCalls).toBe(9);
  } finally { fixture.store.close(); }
});

it("returns the same private 404 for expired evidence and removes expired publication", async () => {
  const fixture = harness();
  try {
    const started = await start(fixture);
    await fixture.call(`/${started.id}/publication`, { method: "POST", headers: json(started.code), body: '{"published":true}' });
    fixture.advance(RUN_STORE_LIMITS.retentionMs);
    for (const path of [`/${started.id}`, `/${started.id}/export`]) expect((await fixture.call(path, { headers: auth(started.code) })).status).toBe(404);
    expect((await fixture.call(`/${started.id}/public`)).status).toBe(404);
    expect((await fixture.call(`/${started.id}/publication`, { method: "POST", headers: json(started.code), body: '{"published":true}' })).status).toBe(404);
    expect(fixture.inferenceCalls).toBe(9);
  } finally { fixture.store.close(); }
});

it("rejects malformed launch consent, bodies and credentials before dispatching inference", async () => {
  const fixture = harness();
  try {
    for (const body of [{ ...request, acceptCharges: false }, { ...request, concurrency: 0 }, { ...request, suiteKey: "../private" }, { ...request, key: providerKey }]) {
      const response = await fixture.call("", { method: "POST", headers: json(), body: JSON.stringify(body) });
      expect(response.status).toBe(400); expect(await response.text()).not.toContain(providerKey);
    }
    expect((await fixture.call("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) })).status).toBe(401);
    expect((await fixture.call("", { method: "POST", headers: { Authorization: "Bearer first, Bearer second", "Content-Type": "application/json" }, body: JSON.stringify(request) })).status).toBe(401);
    expect((await fixture.call("", { method: "POST", headers: { ...auth(providerKey), "Content-Type": "text/plain" }, body: JSON.stringify(request) })).status).toBe(415);
    for (const body of ["{", "", new Uint8Array([0xc3, 0x28])]) expect((await fixture.call("", { method: "POST", headers: json(), body })).status).toBe(400);
    expect((await fixture.call("", { method: "POST", headers: json(), body: " ".repeat(4097) })).status).toBe(413);
    expect((await fixture.call("", { method: "POST", headers: { ...json(), "Content-Length": "4097" }, body: "{}" })).status).toBe(413);
    expect(fixture.inferenceCalls).toBe(0);
    const body = JSON.stringify(request), accepted = await fixture.call("", { method: "POST", headers: json(), body: body + " ".repeat(4096 - Buffer.byteLength(body)) });
    expect(accepted.status).toBe(200); await accepted.text(); expect(fixture.inferenceCalls).toBe(9);
  } finally { fixture.store.close(); }
});

it("enforces exact origin, TLS, query and DELETE preflight rules on public and private paths", async () => {
  const fixture = harness();
  try {
    for (const origin of ["null", "https://evil.example", `${webOrigin}.evil.example`]) {
      const response = await fixture.call("/policy", { headers: { Origin: origin } });
      expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toContain("no-store");
    }
    for (const origin of [webOrigin, base]) {
      const response = await fixture.call("/policy", { headers: { Origin: origin } });
      expect(response.status).toBe(200); expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
    expect((await fixture.app.request("http://api.example.test/runs/policy", { headers: { "X-Forwarded-Proto": "https" } })).status).toBe(400);
    const query = await fixture.call("/policy?accessCode=private-query-fixture");
    expect(query.status).toBe(400); expect(await query.text()).not.toContain("private-query-fixture");
    const preflight = await fixture.call("/any-run", { method: "OPTIONS", headers: { Origin: webOrigin, "Access-Control-Request-Method": "DELETE", "Access-Control-Request-Headers": "Authorization, Content-Type" } });
    expect(preflight.status).toBe(204); expect(preflight.headers.get("access-control-allow-methods")).toContain("DELETE");
    const invalidPreflights: readonly Record<string, string>[] = [{ "Access-Control-Request-Method": "PATCH" }, { "Access-Control-Request-Method": "DELETE", "Access-Control-Request-Headers": "X-Override" }];
    for (const headers of invalidPreflights) {
      expect((await fixture.call("/any-run", { method: "OPTIONS", headers: { Origin: webOrigin, ...headers } })).status).toBe(400);
    }
    const suites = await fixture.call("/suites"); expect(suites.status).toBe(200);
    expect(await suites.text()).not.toContain("claimedLabel"); expect(fixture.inferenceCalls).toBe(0);
  } finally { fixture.store.close(); }
});

it("redacts unexpected route failures and keeps cache guards on unsupported methods", async () => {
  const store = createRunStore({ path: ":memory:" }), service = createRunService({ store });
  const app = new Hono();
  app.route("/runs", createRunRoutes({ store, service, webOrigin, suites: async () => { throw new Error("fixture-private-file-path-and-key"); } }));
  try {
    const failure = await app.request(`${base}/runs/suites`);
    expect(failure.status).toBe(500); expect(await failure.text()).not.toContain("fixture-private-file-path-and-key");
    const unsupported = await app.request(`${base}/runs/not-a-run`, { method: "PUT" });
    expect(unsupported.status).toBe(404); expect(unsupported.headers.get("cache-control")).toContain("no-store");
  } finally { store.close(); }
});
