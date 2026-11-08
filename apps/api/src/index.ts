import app from "./app";

export default {
  hostname: "127.0.0.1",
  port: 3201,
  idleTimeout: 255,
  fetch: app.fetch,
};
