import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync, existsSync } from "fs";
import userApiPlugin from "./server/users";
import scApiPlugin, { resolveBaseUrl } from "./server/sc";
import dataApiPlugin from "./server/data";
import refreshApiPlugin from "./server/refresh";

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
    plugins: [react(), refreshApiPlugin(), userApiPlugin(), scApiPlugin(env.SC_BASE_URL), dataApiPlugin()],
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
        "@services": path.resolve(__dirname, "src/services"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@modules": path.resolve(__dirname, "src/module.ts"),
      },
    },
  };
});
