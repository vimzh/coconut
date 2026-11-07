import { Hono } from "hono";
import { createProviderRoutes } from "./providers/routes";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/providers", createProviderRoutes({ webOrigin: process.env.COCONUT_WEB_ORIGIN ?? "http://localhost:3200" }));

export default app;
