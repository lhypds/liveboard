import type { ComponentType } from "react";
import boardConfig from "../board.config.json";

type InfoItem = { key: Record<string, string>; value: Record<string, string> };
type InfoSection = { title: Record<string, string>; items: InfoItem[] };

export type ModuleConfig = {
  i: string;
  title: Record<string, string>;
  refreshAgeMinutes: number;
  lastUpdated?: string;
  hasRefresh?: boolean;
  info: InfoSection[];
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  allowMultipleInstances?: boolean;
  comp?: Record<string, unknown>;
};

export type ModuleEntry = {
  component: ComponentType<{ config: Record<string, unknown> }>;
  config: ModuleConfig;
};

const raw = import.meta.glob("./modules/*/index.ts", { eager: true });

// Order module repos the same way pull.sh does: by componentsGitUrl in board.config.json,
// not by the alphabetical order import.meta.glob happens to return.
function repoDirName(url: string): string {
  const base = url.split("/").filter(Boolean).pop() ?? "";
  const noGit = base.endsWith(".git") ? base.slice(0, -4) : base;
  return noGit.startsWith("liveboard-mod-") ? noGit.slice("liveboard-mod-".length) : noGit;
}

const repoOrder = ((boardConfig as { componentsGitUrl?: string[] }).componentsGitUrl ?? []).map(repoDirName);
const orderedPaths = [
  ...repoOrder.map((name) => `./modules/${name}/index.ts`).filter((path) => path in raw),
  ...Object.keys(raw).filter((path) => !repoOrder.includes(path.split("/")[2])),
];

const registry: Record<string, ModuleEntry> = {};

for (const path of orderedPaths) {
  const mod = raw[path] as Record<string, unknown>;
  const def = mod.default;

  if (typeof def === "object" && def !== null) {
    // Repo-level index: default export is a map of { [name]: { component, config } }
    const collection = def as Record<string, ModuleEntry>;
    for (const [name, entry] of Object.entries(collection)) {
      if (!entry.component || !entry.config) continue;
      registry[name] = entry;
    }
  } else if (typeof def === "function") {
    // Single module index: default export is the component, config exported separately
    const config = mod.config as ModuleConfig | undefined;
    if (!config) continue;
    const name = path.split("/").at(-2)!;
    registry[name] = { component: def as ComponentType<{ config: Record<string, unknown> }>, config };
  }
}

// Annotate each module with allowMultipleInstances from its repo's modules.config.json
const repoConfigs = import.meta.glob("./modules/*/modules.config.json", { eager: true });
for (const path in repoConfigs) {
  const cfg = repoConfigs[path] as Record<string, { enabled?: boolean; allowMultipleInstances?: boolean }>;
  for (const [name, settings] of Object.entries(cfg)) {
    if (registry[name] && settings.allowMultipleInstances !== undefined) {
      registry[name].config.allowMultipleInstances = settings.allowMultipleInstances;
    }
  }
}

// Load last_update.txt files and attach timestamps to each module
const lastUpdateFiles = import.meta.glob('./modules/*/*/last_updated.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

for (const [path, content] of Object.entries(lastUpdateFiles)) {
  const name = path.split('/').at(-2)!;
  if (registry[name] && typeof content === 'string') {
    const text = content.trim();
    if (text) registry[name].config.lastUpdated = text;
  }
}

const refreshScripts = import.meta.glob('./modules/*/*/refresh.sh', { query: '?raw' });
for (const p in refreshScripts) {
  const name = p.split('/').at(-2)!;
  if (registry[name]) registry[name].config.hasRefresh = true;
}

console.log(`[registry] loaded ${Object.keys(registry).length} / ${Object.keys(raw).length} modules`);

export default registry;
