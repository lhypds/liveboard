import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const DEFAULT_BASE_URL = "https://simple-ai.io";

const MAX_BODY_BYTES = 4 * 1024;

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

function middleware(baseUrl: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== "/api/sc/login") return next();
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });

    try {
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
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
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
 * Logs in to simple-ai on the board's behalf. It has to happen here rather than
 * in the browser: the token comes back as an HttpOnly cookie for another
 * origin, which page scripts cannot read. This hands the cookie's value to the
 * card instead. Registered for preview as well as dev because production serves
 * through `vite preview` (pm2).
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
