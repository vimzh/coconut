// Stateless HTTP boundary for visitor-supplied provider credentials and safe access evidence.
import { Hono } from "hono";
import { bearerCredential, guardedPost, installApiBoundary, RequestError } from "../http/boundary";
import { searchHuggingFaceModels, selectModel } from "../discovery/client";
import { DISCOVERY_POLICY, DiscoveryInputError, parseSearchRequest, parseSelectionRequest } from "../discovery/policy";
import type { ModelSearchClient, ModelSelectionClient } from "../discovery/types";
import { checkProviderAccess } from "./client";
import { ACCESS_POLICY, AccessInputError, parseAccessRequest, safeAccessInputError } from "./policy";
import type { ProviderAccessClient } from "./types";
import { reflectsCredential } from "./responses";

export function createProviderRoutes(options: {
  accessClient?: ProviderAccessClient;
  searchClient?: ModelSearchClient;
  selectionClient?: ModelSelectionClient;
  webOrigin?: string;
} = {}): Hono {
  const accessClient = options.accessClient ?? checkProviderAccess;
  const searchClient = options.searchClient ?? searchHuggingFaceModels;
  const selectionClient = options.selectionClient ?? selectModel;
  const webOrigin = options.webOrigin ?? "http://localhost:3200";
  const routes = new Hono();

  routes.onError((error, c) => {
    if (error instanceof RequestError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof AccessInputError) {
      const safeError = safeAccessInputError(error);
      const status = safeError.code === "missing-credential" || safeError.code === "invalid-credential" ? 401 : 400;
      return c.json({ error: { code: safeError.code, message: safeError.message } }, status);
    }
    if (error instanceof DiscoveryInputError) {
      const safeError = new DiscoveryInputError(error.code === "charge-authorization-required" ? error.code : "invalid-input");
      return c.json({ error: { code: safeError.code, message: safeError.message } }, 400);
    }
    const message = c.req.path.endsWith("/access") ? "Provider access could not be checked." : "Model discovery could not be completed.";
    return c.json({ error: { code: "internal-error", message } }, 500);
  });

  installApiBoundary(routes, { webOrigin });

  routes.get("/policy", (c) => c.json(ACCESS_POLICY));
  routes.get("/models/policy", (c) => c.json(DISCOVERY_POLICY));

  routes.post("/access", (c) => guardedPost(c, "Provider access", () => {
    const credential = bearerCredential(c);
    return async (body, signal) => c.json(await accessClient(parseAccessRequest(body), credential, signal));
  }));

  routes.post("/models/search", (c) => guardedPost(c, "Model discovery", () => {
    if (c.req.header("Authorization") !== undefined) {
      throw new RequestError("credential-not-permitted", "Model search is anonymous. Omit the Authorization header.", 400);
    }
    return async (body, signal) => c.json(await searchClient(parseSearchRequest(body), signal));
  }));

  routes.post("/models/select", (c) => guardedPost(c, "Model discovery", () => {
    const credential = bearerCredential(c);
    return async (body, signal) => {
      const request = parseSelectionRequest(body);
      if (reflectsCredential(JSON.stringify(request), credential)) throw new DiscoveryInputError();
      const result = await selectionClient(request, credential, signal);
      if (reflectsCredential(JSON.stringify(result), credential)) throw new Error("Unsafe selection evidence.");
      return c.json(result);
    };
  }));

  return routes;
}
