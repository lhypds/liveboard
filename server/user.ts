import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_DIR = path.join(__dirname, "..", "data", "users");

// Mirrors isValidUsername in src/contexts/user.ts. The character set has no
// path separators or dots, so a valid name can't escape USERS_DIR.
const USERNAME_RE =
  /^[a-z0-9_\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}-]{1,32}$/u;

const MAX_LAYOUT_BYTES = 10 * 1024 * 1024;

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

const middleware: Connect.NextHandleFunction = async (req, res, next) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const match = url.pathname.match(/^\/api\/users\/([^/]+)(?:\/(login|layout))?$/);
  if (!match) return next();

  let username = "";
  try {
    username = decodeURIComponent(match[1]);
  } catch {
    // falls through to the validity check below
  }
  if (!USERNAME_RE.test(username)) return sendJson(res, 400, { error: "invalid username" });

  const action = match[2];
  const userDir = path.join(USERS_DIR, username);
  const layoutFile = path.join(userDir, "layout.json");

  try {
    if (!action && req.method === "GET") {
      const exists = await stat(userDir)
        .then((s) => s.isDirectory())
        .catch(() => false);
      return sendJson(res, 200, { exists });
    }

    if (action === "login" && req.method === "POST") {
      // Logging in IS registering: the first login creates data/users/<name>
      await mkdir(userDir, { recursive: true });
      return sendJson(res, 200, { ok: true, username });
    }

    if (action === "layout" && req.method === "GET") {
      try {
        const raw = await readFile(layoutFile, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(raw);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        sendJson(res, 404, { error: "layout not found" });
      }
      return;
    }

    if (action === "layout" && req.method === "PUT") {
      const body = await readBody(req, MAX_LAYOUT_BYTES);
      try {
        JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: "invalid JSON" });
      }
      await mkdir(userDir, { recursive: true });
      await writeFile(layoutFile, body);
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 405, { error: "method not allowed" });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * User accounts are one folder per name under data/users, each holding that
 * user's saved layout.json. Registered for preview as well as dev because
 * production serves through `vite preview` (pm2).
 */
export default function userApiPlugin(): Plugin {
  return {
    name: "user-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
