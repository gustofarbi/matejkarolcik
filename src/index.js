// Password gate for the Ecce Homo v2 post.
//
// Configured via wrangler.jsonc `assets.run_worker_first` to run ONLY on the
// three language paths of this post; every other request is served as a pure
// static asset and never reaches this script.
//
// Secrets (wrangler secret put / .dev.vars for local dev):
//   GATE_PASSWORD  the shared password visitors type
//   GATE_SECRET    random string used to sign the unlock cookie (HMAC-SHA256)

const COOKIE_NAME = "ehv2_gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Login form submission.
    if (request.method === "POST") {
      const form = await request.formData();
      const password = String(form.get("password") || "");
      if (env.GATE_PASSWORD && timingSafeEqual(password, env.GATE_PASSWORD)) {
        const cookie = await signCookie(env.GATE_SECRET, MAX_AGE);
        return new Response(null, {
          status: 303,
          headers: {
            Location: path,
            "Set-Cookie": `${COOKIE_NAME}=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
          },
        });
      }
      return loginPage(path, true);
    }

    // Any other method: serve the real content only with a valid cookie.
    const token = parseCookie(request.headers.get("Cookie"), COOKIE_NAME);
    if (token && (await verifyCookie(env.GATE_SECRET, token))) {
      return env.ASSETS.fetch(request);
    }
    return loginPage(path, false);
  },
};

// --- cookie signing -------------------------------------------------------

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signCookie(secret, maxAge) {
  const expiry = Math.floor(Date.now() / 1000) + maxAge;
  const sig = await sign(secret, String(expiry));
  return `${expiry}.${sig}`;
}

async function verifyCookie(secret, token) {
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(expiry)) return false;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(secret, expiry);
  return timingSafeEqual(sig, expected);
}

async function sign(secret, data) {
  const key = await hmacKey(secret);
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(buf);
}

function base64url(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Constant-time string comparison (avoids leaking length-prefix matches by
// timing). Returns false on length mismatch.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

// --- login page -----------------------------------------------------------

function loginPage(path, isError) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Private page</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #f8f8f8; color: #1a1a1a;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #e8e8e8; }
    .card { background: #262626; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
    input { background: #1a1a1a; color: #e8e8e8; border-color: #444; }
  }
  .card {
    width: 100%; max-width: 22rem; margin: 1rem;
    background: #fff; border-radius: .75rem; padding: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
  }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { margin: 0 0 1.25rem; color: #777; font-size: .9rem; line-height: 1.4; }
  label { display: block; font-size: .85rem; margin-bottom: .35rem; }
  input {
    width: 100%; box-sizing: border-box; padding: .6rem .75rem;
    border: 1px solid #ccc; border-radius: .5rem; font-size: 1rem;
  }
  button {
    margin-top: 1rem; width: 100%; padding: .65rem; border: 0;
    border-radius: .5rem; background: #ea580c; color: #fff;
    font-size: 1rem; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #c2410c; }
  .error { color: #dc2626; font-size: .85rem; margin-top: .75rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>This page is private</h1>
    <p>Enter the password to read this post.</p>
    <form method="POST" action="${escapeHtml(path)}">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus autocomplete="current-password" required>
      <button type="submit">Enter</button>
      ${isError ? '<div class="error">Wrong password — try again.</div>' : ""}
    </form>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: isError ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
