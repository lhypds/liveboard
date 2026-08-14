import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { readdirSync, existsSync } from "fs";
import userApiPlugin from "./server/users";
import scApiPlugin, { resolveBaseUrl } from "./server/sc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Component-owned VITE_ variables live beside the component that consumes
 * them. Vite only reads the root .env by default, so expose values from each
 * direct component directory explicitly at build time.
 */
function loadComponentEnv(mode: string): Record<string, string> {
  const modulesDir = path.join(__dirname, "src/modules");
  if (!existsSync(modulesDir)) return {};

  const values: Record<string, { value: string; componentDir: string }> = {};
  const envFileNames = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

  for (const moduleDirent of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!moduleDirent.isDirectory() || moduleDirent.name.startsWith(".")) continue;
    const moduleDir = path.join(modulesDir, moduleDirent.name);

    for (const componentDirent of readdirSync(moduleDir, { withFileTypes: true })) {
      if (!componentDirent.isDirectory() || componentDirent.name.startsWith(".")) continue;
      const componentDir = path.join(moduleDir, componentDirent.name);
      if (!envFileNames.some((fileName) => existsSync(path.join(componentDir, fileName)))) continue;

      for (const [key, value] of Object.entries(loadEnv(mode, componentDir, "VITE_"))) {
        const previous = values[key];
        if (previous && previous.value !== value) {
          throw new Error(`${key} is defined with different values in ${previous.componentDir} and ${componentDir}`);
        }
        values[key] = { value, componentDir };
      }
    }
  }

  return Object.fromEntries(Object.entries(values).map(([key, { value }]) => [`import.meta.env.${key}`, JSON.stringify(value)]));
}

function refreshApiPlugin(): Plugin {
  return {
    name: "refresh-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || !req.url?.startsWith("/api/refresh")) {
          return next();
        }
        const url = new URL(req.url, "http://localhost");
        const moduleName = url.searchParams.get("module") ?? "";
        if (!/^[\w-]+$/.test(moduleName)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid module name" }));
          return;
        }
        // A component may be asked for one repository rather than its whole dataset (GitHubRanking's
        // repo card fetches the one that was clicked). Validated to a GitHub owner/name here and
        // handed to execFile as an argument — never through a shell, so nothing in it can be read as
        // anything but a value.
        const repo = url.searchParams.get("repo") ?? "";
        if (repo && !/^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(repo)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid repo" }));
          return;
        }
        const modulesDir = path.join(__dirname, "src/modules");
        let scriptPath: string | null = null;
        try {
          for (const repo of readdirSync(modulesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith("."))
            .map((d) => d.name)) {
            const candidate = path.join(modulesDir, repo, moduleName, "refresh.sh");
            if (existsSync(candidate)) {
              scriptPath = candidate;
              break;
            }
          }
        } catch {
          /* modulesDir missing */
        }
        if (!scriptPath) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "refresh.sh not found" }));
          return;
        }
        try {
          // stdout comes back with the answer: a script asked for a single item can print it, and
          // the card then has it without waiting for the file it wrote to be picked up by a build.
          const stdout = await new Promise<string>((resolve, reject) =>
            execFile(
              "bash",
              repo ? [scriptPath!, `--repo=${repo}`] : [scriptPath!],
              { cwd: path.dirname(scriptPath!), maxBuffer: 8 * 1024 * 1024 },
              (err, out) => (err ? reject(err) : resolve(out)),
            ),
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, stdout }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // One board is often reachable under more than one name — a public domain plus the
  // deploy host's own — and Vite blocks every name it wasn't told about, so HOST takes a
  // comma-separated list. Empty stays empty: that is local development, where Vite's own
  // localhost default applies.
  const allowedHosts = (env.HOST ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const componentEnv = loadComponentEnv(mode);

  return {
    plugins: [react(), refreshApiPlugin(), userApiPlugin(), scApiPlugin(env.SC_BASE_URL)],
    // Root .env is for board/runtime settings. Component VITE_ values are
    // injected by loadComponentEnv instead of being read from the root.
    envDir: path.join(__dirname, "src/modules"),
    define: {
      "process.env": {},
      // The board only talks to simple-ai through its own server, so this is not
      // needed to make a request — it is there for the User modal to say which
      // simple-ai the SC account signs in to
      __SC_BASE_URL__: JSON.stringify(resolveBaseUrl(env.SC_BASE_URL)),
      ...componentEnv,
    },
    optimizeDeps: {
      include: ["pyodide"],
    },
    worker: {
      format: "es",
    },
    // Two boards on one machine each need their own PORT. Without strictPort a second
    // instance asking for a taken port silently moves to the next one, where it answers
    // nothing the reverse proxy sends it — so a clash fails loudly here instead.
    server: {
      allowedHosts,
      strictPort: true,
    },
    preview: {
      allowedHosts,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@ui": path.resolve(__dirname, "src/ui"),
        "@components": path.resolve(__dirname, "src/components"),
        "@contexts": path.resolve(__dirname, "src/contexts"),
        "@hooks": path.resolve(__dirname, "src/hooks"),
        "@pages": path.resolve(__dirname, "src/pages"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@modules": path.resolve(__dirname, "src/module.ts"),
      },
    },
  };
});
