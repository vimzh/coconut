// Foreground NDJSON execution and capability-protected records share the API security boundary.
import { Hono, type Context } from "hono";
import { bearerCredential, guardedPost, installApiBoundary, RequestError } from "../http/boundary";
import { readDataRecord, requireFields } from "../protocol/validation";
import { AccessInputError, safeAccessInputError } from "../providers/policy";
import { createRunService } from "./engine";
import { RUN_POLICY, RunInputError, parseRunRequest } from "./policy";
import { listRunSuites } from "./registry";
import { createRunStore, RunStoreError } from "./store";
import { summarizePublishedRun } from "./public";
import type { RunEvent, RunRequest, RunStore } from "./types";

function accessCode(c: Context): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(c.req.header("Authorization") ?? "");
  if (!match) throw new RequestError("private-access-required", "Supply the private access code for this run.", 401);
  return match[1];
}

function runId(c: Context): string {
  const id = c.req.param("id");
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) throw new RequestError("not-found", "Run not found or access not permitted.", 404);
  return id;
}

function fields(body: unknown, expected: readonly string[]): Record<string, unknown> {
  try { const data = readDataRecord(body, "Run operation"); requireFields(data, expected); return data; }
  catch { throw new RunInputError(); }
}

function streamRun(c: Context, request: RunRequest, credential: string, service: ReturnType<typeof createRunService>): Response {
  const cancellation = new AbortController();
  const signal = AbortSignal.any([c.req.raw.signal, cancellation.signal]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: RunEvent) => {
        if (!open) throw new Error("Progress recipient disconnected.");
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const heartbeat = setInterval(() => {
        if (!open) return;
        try { controller.enqueue(encoder.encode('{"type":"heartbeat"}\n')); }
        catch { open = false; cancellation.abort(); }
      }, 15000);
      try { await service.execute(request, credential, signal, send); }
      catch {
        if (open) {
          try { send({ type: "error", runId: null, code: "run-failed", message: "The evaluation could not finish. Inspect any retained private record before starting another paid run." }); }
          catch { cancellation.abort(); }
        }
      } finally {
        clearInterval(heartbeat);
        if (open) { open = false; try { controller.close(); } catch { cancellation.abort(); } }
      }
    },
    cancel() { cancellation.abort(); },
  });
  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(stream);
}

export function createRunRoutes(options: {
  store?: RunStore;
  service?: ReturnType<typeof createRunService>;
  webOrigin?: string;
  suites?: typeof listRunSuites;
} = {}): Hono {
  if (options.service && !options.store) throw new Error("An injected run service requires its matching store.");
  let resources: { store: RunStore; service: ReturnType<typeof createRunService> } | undefined;
  const getResources = () => {
    if (!resources) {
      const store = options.store ?? createRunStore({ path: process.env.COCONUT_RUN_DB });
      if (!options.service) store.recoverInterrupted();
      resources = { store, service: options.service ?? createRunService({ store }) };
    }
    return resources;
  };
  const routes = new Hono();
  routes.onError((error, c) => {
    if (error instanceof RequestError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof AccessInputError) {
      const safe = safeAccessInputError(error);
      return c.json({ error: { code: safe.code, message: safe.message } }, safe.code === "missing-credential" || safe.code === "invalid-credential" ? 401 : 400);
    }
    if (error instanceof RunInputError) return c.json({ error: { code: "invalid-run", message: "Check the suite, model, route, profile, concurrency and provider-charge acknowledgement." } }, 400);
    if (error instanceof RunStoreError && error.code === "ineligible") return c.json({ error: { code: "not-eligible", message: "Only a completed run with a complete model population can be published." } }, 409);
    return c.json({ error: { code: "run-unavailable", message: "The requested evaluation evidence is unavailable. No provider retry was made." } }, 500);
  });
  installApiBoundary(routes, { webOrigin: options.webOrigin, methods: ["GET", "POST", "DELETE"], label: "Run" });
  const missing = (c: Context) => c.json({ error: { code: "not-found", message: "Run not found or access not permitted." } }, 404);

  routes.get("/policy", c => c.json(RUN_POLICY));
  routes.get("/suites", async c => c.json({ version: "1", suites: await (options.suites ?? listRunSuites)() }));
  routes.get("/published", c => c.json({ version: "1", runs: getResources().store.listPublic().map(summarizePublishedRun) }));
  routes.post("/", c => guardedPost(c, "Evaluation launch", () => {
    const credential = bearerCredential(c);
    // The ingress guard ends when the stream is created; the stream keeps the raw caller signal.
    return async body => streamRun(c, parseRunRequest(body), credential, getResources().service);
  }));

  routes.get("/:id/public", c => {
    const view = getResources().store.readPublic(runId(c));
    return view ? c.json(view) : missing(c);
  });
  routes.get("/:id/export", c => {
    const code = accessCode(c), id = runId(c), view = getResources().store.read(id, code);
    if (!view) return missing(c);
    c.header("Content-Disposition", `attachment; filename="coconut-run-${id}.json"`);
    return c.json(view);
  });
  routes.get("/:id", c => {
    const code = accessCode(c), view = getResources().store.read(runId(c), code);
    return view ? c.json(view) : missing(c);
  });
  routes.delete("/:id", c => {
    const code = accessCode(c), id = runId(c), { store, service } = getResources();
    if (!store.read(id, code)) return missing(c);
    if (service.activeRuns && service.cancel(id, code)) throw new RequestError("run-active", "Cancellation was requested. Wait for it to settle before deleting the run.", 409);
    return store.remove(id, code) ? c.json({ deleted: true }) : missing(c);
  });
  routes.post("/:id/cancel", c => guardedPost(c, "Evaluation cancellation", () => {
    const code = accessCode(c), id = runId(c);
    return async body => {
      fields(body, []);
      const { store, service } = getResources();
      if (!store.read(id, code)) return missing(c);
      return service.cancel(id, code) ? c.json({ cancellationRequested: true }) : c.json({ cancellationRequested: false });
    };
  }));
  routes.post("/:id/publication", c => guardedPost(c, "Publication change", () => {
    const code = accessCode(c), id = runId(c);
    return async body => {
      const data = fields(body, ["published"]);
      if (typeof data.published !== "boolean") throw new RunInputError();
      const view = getResources().store.publish(id, code, data.published);
      return view ? c.json(view) : missing(c);
    };
  }));
  return routes;
}
