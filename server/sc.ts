import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const DEFAULT_BASE_URL = "https://simple-ai.io";

const MAX_BODY_BYTES = 4 * 1024;

/** A card's whole text goes up with every generate, so that route needs far more room than a login. */
const MAX_GENERATE_BODY_BYTES = 512 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: Connect.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** The JWT simple-ai hands back, which it sends as the HttpOnly `auth` cookie. */
function readAuthCookie(headers: Headers): string {
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const single = headers.get("set-cookie");
  for (const cookie of cookies.length ? cookies : single ? [single] : []) {
    const match = cookie.match(/(?:^|,\s*)auth=([^;,]*)/);
    if (match) return match[1];
  }
  return "";
}

async function handleLogin(baseUrl: string, req: Connect.IncomingMessage, res: ServerResponse) {
  const { username, password } = JSON.parse(await readBody(req, MAX_BODY_BYTES)) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) return sendJson(res, 400, { error: "username and password are required" });

  const upstream = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await upstream.json().catch(() => ({}))) as { error?: string };
  if (!upstream.ok) return sendJson(res, upstream.status, { error: body.error ?? `HTTP ${upstream.status}` });

  // The token only ever travels in the cookie; a login with no cookie on it
  // is nothing the board can use
  const token = readAuthCookie(upstream.headers);
  if (!token) return sendJson(res, 502, { error: "no auth cookie in the login response" });

  sendJson(res, 200, { token });
}

/**
 * simple-ai's session ids are millisecond timestamps, and it rejects any that
 * fall outside the window it considers plausible. One id per request is enough:
 * a rewrite is a single turn, not a conversation.
 */
function newSessionId(): string {
  return String(Date.now());
}

/**
 * Rewrites a card's text through simple-ai's `/api/generate/edit`. It answers as
 * a `text/event-stream`, so the bytes are relayed to the card untouched and the
 * card does the parsing — this end only has to get the credential onto the
 * request, which the browser cannot do itself (the token is an HttpOnly cookie
 * belonging to simple-ai's origin, so it is held in localStorage and posted here).
 */
async function handleGenerateEdit(baseUrl: string, req: Connect.IncomingMessage, res: ServerResponse) {
  const { content, prompt, instruct, token, model } = JSON.parse(
    await readBody(req, MAX_GENERATE_BODY_BYTES),
  ) as {
    content?: string;
    prompt?: string;
    instruct?: string;
    token?: string;
    model?: string;
  };
  if (!token) return sendJson(res, 401, { error: "no simple-ai credential" });
  if (!prompt?.trim()) return sendJson(res, 400, { error: "instruction is required" });
  if (!content?.trim()) return sendJson(res, 400, { error: "content is required" });

  const upstream = await fetch(`${baseUrl}/api/generate/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      content,
      // What simple-ai calls the prompt is the one-off instruction; what it calls
      // the instruct is the card's standing description of its own content
      prompt,
      instruct: instruct ?? "",
      auth: token,
      session: newSessionId(),
      ...(model ? { model } : {}),
    }),
  });

  // simple-ai opens the stream before it validates anything and reports failures
  // as `###ERR###` events inside it, so a non-OK status here is the transport
  // itself failing and there is nothing to relay
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return sendJson(res, upstream.status || 502, { error: text.slice(0, 200) || `HTTP ${upstream.status}` });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Disables proxy buffering for NGINX, without which nothing arrives until the end
    "X-Accel-Buffering": "no",
  });

  const reader = upstream.body.getReader();
  // A card that is closed or navigated away from mid-generation should stop the
  // upstream request too, rather than leave it running to completion
  req.on("close", () => void reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch {
    /* the stream died; the card sees the response end without a [DONE] */
  } finally {
    res.end();
  }
}

function middleware(baseUrl: string): Connect.NextHandleFunction {
  const routes: Record<string, (req: Connect.IncomingMessage, res: ServerResponse) => Promise<void>> = {
    "/api/sc/login": (req, res) => handleLogin(baseUrl, req, res),
    "/api/sc/generate/edit": (req, res) => handleGenerateEdit(baseUrl, req, res),
  };

  return async (req, res, next) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const route = routes[url.pathname];
    if (!route) return next();
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });

    try {
      await route(req, res);
    } catch (err) {
      // Once the stream is open the headers are already out; all that is left is to hang up
      if (res.headersSent) res.end();
      else sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  };
}

/**
 * Where to log in. Trims and drops any trailing slash first, so a SC_BASE_URL
 * that is unset, empty, or only whitespace falls back to simple-ai.io rather
 * than leaving an empty base that would make the upstream URL relative.
 */
export function resolveBaseUrl(configured?: string): string {
  return (configured ?? "").trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

/**
 * Talks to simple-ai on the board's behalf: logging in, and rewriting a card's
 * text. Both have to happen here rather than in the browser — the login token
 * comes back as an HttpOnly cookie for another origin, which page scripts can
 * neither read nor send. Registered for preview as well as dev because
 * production serves through `vite preview` (pm2).
 */
export default function scApiPlugin(baseUrl?: string): Plugin {
  const handler = middleware(resolveBaseUrl(baseUrl));
  return {
    name: "sc-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
