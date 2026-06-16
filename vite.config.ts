import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { readdirSync, existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export default defineConfig({
  plugins: [react(), refreshApiPlugin()],
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "src/ui"),
      "@components": path.resolve(__dirname, "src/components"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@modules": path.resolve(__dirname, "src/module.ts"),
    },
  },
});
