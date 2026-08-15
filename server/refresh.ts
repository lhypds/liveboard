import { execFile } from "child_process";
import { readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.join(__dirname, "..", "src", "modules");

/** Same shape the data API accepts: a component folder name, so no separator can be in it. */
const MODULE_RE = /^[\w-]+$/;

/** A GitHub owner/name, and nothing else — see the `repo` parameter below. */
const REPO_RE = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * `src/modules/<repo>/<module>/refresh.sh`, for whichever repo carries that component — the modules
 * directory is one folder per cloned repo, and a board only knows components by name.
 *
 * Read per request rather than cached: a repo can be pulled in while the board is running.
 */
async function resolveScript(moduleName: string): Promise<string | null> {
  let repos: string[];
  try {
    repos = (await readdir(MODULES_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch {
    return null; // no modules cloned yet
  }

  for (const repo of repos) {
    const candidate = path.join(MODULES_DIR, repo, moduleName, "refresh.sh");
    const isFile = await stat(candidate)
      .then((s) => s.isFile())
      .catch(() => false);
    if (isFile) return candidate;
  }
  return null;
}

const middleware: Connect.NextHandleFunction = async (req, res, next) => {
  if (req.method !== "POST" || !req.url?.startsWith("/api/refresh")) return next();

  const url = new URL(req.url, "http://localhost");
  const moduleName = url.searchParams.get("module") ?? "";
  if (!MODULE_RE.test(moduleName)) return sendJson(res, 400, { error: "invalid module name" });

  // A component may be asked for one repository rather than its whole dataset (GitHubRanking's
  // repo card fetches the one that was clicked). Validated to a GitHub owner/name here and
  // handed to execFile as an argument — never through a shell, so nothing in it can be read as
  // anything but a value.
  const repo = url.searchParams.get("repo") ?? "";
  if (repo && !REPO_RE.test(repo)) return sendJson(res, 400, { error: "invalid repo" });

  const scriptPath = await resolveScript(moduleName);
  if (!scriptPath) return sendJson(res, 404, { error: "refresh.sh not found" });

  try {
    // stdout comes back with the answer: a script asked for a single item can print it, and
    // the card then has it without waiting for the file it wrote to be picked up by a build.
    const { stdout } = await execFileAsync("bash", repo ? [scriptPath, `--repo=${repo}`] : [scriptPath], {
      cwd: path.dirname(scriptPath),
      maxBuffer: 8 * 1024 * 1024,
    });
    sendJson(res, 200, { ok: true, stdout });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Runs a component's own `refresh.sh` on demand — `POST /api/refresh?module=<module>`, optionally
 * `&repo=<owner/name>` for a component that can fetch one item rather than its whole dataset.
 *
 * Pairs with the data API: this writes the component's `data/` folder, that one serves it, so a
 * refresh shows up on a card without a rebuild.
 *
 * Registered for preview as well as dev because production serves through `vite preview` (pm2).
 */
export default function refreshApiPlugin(): Plugin {
  return {
    name: "refresh-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
