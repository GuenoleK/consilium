import { serve } from "@hono/node-server";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Hono } from "hono";

const username = process.env.CONSILIUM_REMOTE_USER || "consilium";
const defaultPasswordFile = "C:\\tmp\\consilium-remote\\password.txt";
const passwordFile = process.env.CONSILIUM_REMOTE_PASSWORD_FILE || defaultPasswordFile;
const password = process.env.CONSILIUM_REMOTE_PASSWORD
  || (existsSync(passwordFile) ? readFileSync(passwordFile, "utf8").trim() : undefined);
const port = Number(process.env.CONSILIUM_REMOTE_PORT || 8484);

if (!password || password.length < 16) {
  throw new Error("CONSILIUM_REMOTE_PASSWORD doit contenir au moins 16 caractères.");
}

const app = new Hono();
app.use("*", async (context, next) => {
  const authorization = context.req.header("authorization");
  const encodedCredentials = authorization?.startsWith("Basic ") ? authorization.slice(6) : "";
  let suppliedUsername = "";
  let suppliedPassword = "";

  try {
    [suppliedUsername, suppliedPassword] = Buffer.from(encodedCredentials, "base64").toString("utf8").split(":", 2);
  } catch {
    // Invalid credentials are handled like missing credentials.
  }

  const expected = Buffer.from(`${username}:${password}`);
  const supplied = Buffer.from(`${suppliedUsername}:${suppliedPassword}`);
  const authenticated = expected.length === supplied.length && timingSafeEqual(expected, supplied);

  if (!authenticated) {
    return context.text("Authentification Consilium requise.", 401, {
      "WWW-Authenticate": 'Basic realm="Consilium"',
    });
  }

  await next();
});

app.all("*", async (context) => {
  const sourceUrl = new URL(context.req.url);
  const targetPort = sourceUrl.pathname.startsWith("/api/") ? 4337 : 5173;
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, `http://127.0.0.1:${targetPort}`);
  const headers = new Headers(context.req.raw.headers);
  headers.delete("authorization");
  headers.delete("host");
  headers.set("x-forwarded-host", sourceUrl.host);
  headers.set("x-forwarded-proto", "https");
  const method = context.req.method;
  const response = await fetch(targetUrl, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await context.req.arrayBuffer(),
    redirect: "manual",
  });
  return new Response(response.body, { status: response.status, headers: response.headers });
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`Consilium remote gateway listening on http://127.0.0.1:${port}`);
