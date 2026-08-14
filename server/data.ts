import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.join(__dirname, "..", "src", "modules");

/** Same shape the refresh API accepts: a component folder name, so no separator can be in it. */
const MODULE_RE = /^[\w-]+$/;

/** What a component's `data/` folder is allowed to hand out. Anything else — a script, a `.env`, a
 *  half-written `.tmp` — is not data and is not served, whatever a request asks for. */
const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * `src/modules/<repo>/<module>/data`, for whichever repo carries that component — the modules
 * directory is one folder per cloned repo, and a board only knows components by name.
 *
 * Read per request rather than cached: a repo can be pulled in while the board is running, and a
 * readdir of a handful of directories is cheaper than a stale map is worth.
 */
async function resolveDataDir(moduleName: string): Promise<string | null> {
  let repos: string[];
  try {
    repos = (await readdir(MODULES_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch {
    return null; // no modules cloned yet
  }

  for (const repo of repos) {
    const candidate = path.join(MODULES_DIR, repo, moduleName, "data");
    const isDir = await stat(candidate)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}

/**
 * The file name as it sits in the folder, or null when the request is not asking for one file in
 * it. Names are compared after decoding, so a component whose files carry spaces or `&` is reached
 * the same way as any other; a name carrying a separator, a `..`, or a NUL never resolves — but the
 * containment check in the handler is what the folder actually relies on.
 */
function safeFileName(raw: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!name || name.startsWith(".") || name.includes("/") || name.includes("\\") || name.includes("\0")) return null;
  if (!(path.extname(name).toLowerCase() in CONTENT_TYPES)) return null;
  return name;
}

const middleware: Connect.NextHandleFunction = async (req, res, next) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const match = url.pathname.match(/^\/api\/data\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return next();
  // HEAD is answered like GET; Node drops the body itself, so a check for one costs nothing.
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "method not allowed" });

  const moduleName = match[1];
  if (!MODULE_RE.test(moduleName)) return sendJson(res, 400, { error: "invalid module name" });

  try {
    const dataDir = await resolveDataDir(moduleName);
    if (!dataDir) return sendJson(res, 404, { error: `no data folder for ${moduleName}` });

    // No file named: the folder's own listing, which is how a card discovers what it has (the day
    // files a crawler has written so far, say) without knowing the names in advance.
    if (!match[2]) {
      const files = (await readdir(dataDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() in CONTENT_TYPES)
        .map((entry) => entry.name)
        .sort();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ module: moduleName, files }));
      return;
    }

    const name = safeFileName(match[2]);
    if (!name) return sendJson(res, 400, { error: "invalid file name" });

    // Second lock on the same door: whatever the name decoded to, the path it produces has to be
    // inside the folder that was resolved above, or it is not served.
    const filePath = path.join(dataDir, name);
    if (path.dirname(filePath) !== dataDir) return sendJson(res, 400, { error: "invalid file name" });

    let body: Buffer;
    try {
      body = await readFile(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      return sendJson(res, 404, { error: "file not found" });
    }

    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(name).toLowerCase()],
      // The point of reading these over HTTP is that a refresh shows up without a rebuild, so a
      // cached copy would undo the whole exercise.
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Serves the contents of a component's own `data/` folder — `GET /api/data/<module>` lists the
 * files, `GET /api/data/<module>/<file>` returns one.
 *
 * Data written by a fetch script is otherwise only reachable through `import.meta.glob`, which
 * resolves at build time: on a production board a crawl that ran after the build is invisible until
 * the next one. Read through this instead, a card shows what is on disk now, and `fetch.sh` (or the
 * board's own Refresh button) is enough on its own.
 *
 * Registered for preview as well as dev because production serves through `vite preview` (pm2).
 */
export default function dataApiPlugin(): Plugin {
  return {
    name: "data-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
