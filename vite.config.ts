import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { readdirSync, existsSync } from "fs";
import userApiPlugin from "./server/users";

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
          throw new Error(
            `${key} is defined with different values in ${previous.componentDir} and ${componentDir}`,
          );
        }
        values[key] = { value, componentDir };
      }
    }
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, { value }]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );
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
        const modulesDir = path.join(__dirname, "src/modules");
        let scriptPath: string | null = null;
        try {
          for (const repo of readdirSync(modulesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith("."))
            .map((d) => d.name)) {
            const candidate = path.join(modulesDir, repo, moduleName, "refresh.sh");
            if (existsSync(candidate)) { scriptPath = candidate; break; }
          }
        } catch { /* modulesDir missing */ }
        if (!scriptPath) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "refresh.sh not found" }));
          return;
        }
        try {
          await new Promise<void>((resolve, reject) =>
            execFile("bash", [scriptPath!], { cwd: path.dirname(scriptPath!) }, (err) =>
              err ? reject(err) : resolve()
            )
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
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
  const allowedHosts = env.HOST ? [env.HOST] : [];
  const componentEnv = loadComponentEnv(mode);

  return {
    plugins: [react(), refreshApiPlugin(), userApiPlugin()],
    // Root .env is for board/runtime settings. Component VITE_ values are
    // injected by loadComponentEnv instead of being read from the root.
    envDir: path.join(__dirname, "src/modules"),
    define: {
      "process.env": {},
      ...componentEnv,
    },
    optimizeDeps: {
      include: ["pyodide"],
    },
    server: {
      allowedHosts,
    },
    preview: {
      allowedHosts,
    },
    resolve: {
      alias: {
        "@ui": path.resolve(__dirname, "src/ui"),
        "@components": path.resolve(__dirname, "src/components"),
        "@contexts": path.resolve(__dirname, "src/contexts"),
        "@pages": path.resolve(__dirname, "src/pages"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@modules": path.resolve(__dirname, "src/module.ts"),
      },
    },
  };
});
