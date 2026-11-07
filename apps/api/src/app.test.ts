import { describe, expect, it } from "bun:test";
import app from "./app";

describe("API", () => {
  it("reports health", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
  });
});
