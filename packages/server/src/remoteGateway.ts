import { serve } from "@hono/node-server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Hono } from "hono";

const username = process.env.CONSILIUM_REMOTE_USER || "consilium";
const defaultPasswordFile = "C:\\tmp\\consilium-remote\\password.txt";
const passwordFile = process.env.CONSILIUM_REMOTE_PASSWORD_FILE || defaultPasswordFile;
const password = process.env.CONSILIUM_REMOTE_PASSWORD
  || (existsSync(passwordFile) ? readFileSync(passwordFile, "utf8").trim() : undefined);
const port = Number(process.env.CONSILIUM_REMOTE_PORT || 8484);
const loginPath = "/_consilium/login";
const sessionCookieName = "consilium_remote_session";
const sessionDurationSeconds = 12 * 60 * 60;

if (!password || password.length < 16) {
  throw new Error("CONSILIUM_REMOTE_PASSWORD doit contenir au moins 16 caractères.");
}

const signSession = (expiresAt: number) => createHmac("sha256", password).update(String(expiresAt)).digest("base64url");

const secureEqual = (expected: string, supplied: string) => {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
};

const readCookie = (cookieHeader: string | undefined, name: string) => cookieHeader
  ?.split(";")
  .map((part) => part.trim().split("=", 2))
  .find(([cookieName]) => cookieName === name)?.[1];

const hasValidSession = (cookieHeader: string | undefined) => {
  const session = readCookie(cookieHeader, sessionCookieName);
  if (!session) return false;
  const [expiresAtValue, signature] = session.split(".");
  const expiresAt = Number(expiresAtValue);
  return Number.isSafeInteger(expiresAt) && expiresAt > Date.now() && Boolean(signature) && secureEqual(signSession(expiresAt), signature);
};

const safeReturnTo = (value: string | undefined) => value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);

const loginPage = (returnTo: string, invalidCredentials = false, attemptedUsername = username) => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Connexion à Consilium</title>
    <style>
      :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #2d2925; background: #f8f4ec; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top right, rgba(183,93,63,.16), transparent 36%), #f8f4ec; }
      .remote-login { width: min(100%, 420px); overflow: hidden; border: 1px solid #ded5c8; border-radius: 18px; background: #fffdf8; box-shadow: 0 28px 80px rgba(76,57,39,.2); }
      header { display: flex; gap: 13px; align-items: center; padding: 23px 24px 19px; border-bottom: 1px solid #ded5c8; background: linear-gradient(135deg, #fffdf8, #fbf2e8); }
      .mark { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 14px; background: #f7dfd2; color: #91472d; font-size: 22px; font-weight: 800; }
      header span { display: block; color: #b75d3f; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      h1 { margin: 4px 0 0; font-family: Georgia, serif; font-size: 22px; line-height: 1.15; }
      form { display: grid; gap: 17px; padding: 24px; }
      p { margin: 0; color: #6f6860; font-size: 13px; line-height: 1.55; }
      label { display: grid; gap: 7px; color: #2d2925; font-size: 12px; font-weight: 700; }
      input { width: 100%; height: 44px; padding: 0 13px; border: 1px solid #ded5c8; border-radius: 12px; outline: 0; background: #fffefa; color: inherit; font: 500 14px inherit; }
      input:focus { border-color: #c28b75; box-shadow: 0 0 0 3px rgba(183,93,63,.1); }
      button { min-height: 43px; border: 0; border-radius: 11px; background: #b75d3f; color: white; font: 700 14px inherit; cursor: pointer; box-shadow: 0 8px 18px rgba(183,93,63,.2); }
      button:hover { background: #91472d; }
      .error { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 10px; background: #fbe8e3; color: #a44738; font-size: 12px; }
      @media (max-width: 480px) { body { padding: 16px; } .remote-login { border-radius: 16px; } header, form { padding-left: 19px; padding-right: 19px; } }
    </style>
  </head>
  <body>
    <main class="remote-login" role="dialog" aria-modal="true" aria-labelledby="remote-login-title">
      <header><div class="mark" aria-hidden="true">C</div><div><span>Accès distant</span><h1 id="remote-login-title">Connexion à Consilium</h1></div></header>
      <form method="post" action="${loginPath}" autocomplete="on">
        <p>Identifiez-vous pour ouvrir cette table ronde à distance.</p>
        ${invalidCredentials ? '<p class="error" role="alert">Identifiant ou mot de passe incorrect.</p>' : ""}
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
        <label for="remote-username">Identifiant<input id="remote-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${escapeHtml(attemptedUsername)}" required autofocus></label>
        <label for="remote-password">Mot de passe<input id="remote-password" name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Accéder à la table</button>
      </form>
    </main>
  </body>
</html>`;

const app = new Hono();

app.post(loginPath, async (context) => {
  const fields = new URLSearchParams(await context.req.text());
  const suppliedUsername = fields.get("username") || "";
  const suppliedPassword = fields.get("password") || "";
  const returnTo = safeReturnTo(fields.get("returnTo") || undefined);

  if (!secureEqual(username, suppliedUsername) || !secureEqual(password, suppliedPassword)) {
    return context.html(loginPage(returnTo, true, suppliedUsername), 401);
  }

  const expiresAt = Date.now() + sessionDurationSeconds * 1000;
  context.header("Set-Cookie", `${sessionCookieName}=${expiresAt}.${signSession(expiresAt)}; Max-Age=${sessionDurationSeconds}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  return context.redirect(returnTo, 303);
});

app.use("*", async (context, next) => {
  if (hasValidSession(context.req.header("cookie"))) return next();

  const sourceUrl = new URL(context.req.url);
  const returnTo = `${sourceUrl.pathname}${sourceUrl.search}`;
  if (context.req.method === "GET" && context.req.header("accept")?.includes("text/html")) return context.html(loginPage(returnTo), 401);
  return context.text("Authentification Consilium requise.", 401);
});

app.all("*", async (context) => {
  const sourceUrl = new URL(context.req.url);
  const targetPort = sourceUrl.pathname.startsWith("/api/") ? 4337 : 5173;
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, `http://127.0.0.1:${targetPort}`);
  const headers = new Headers(context.req.raw.headers);
  headers.delete("cookie");
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
