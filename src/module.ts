import type { ComponentType } from "react";

export type ModuleConfig = {
  i: string;
  title: Record<string, string>;
  info: {
    dataSource: Record<string, string>;
    refreshFrequency: Record<string, string>;
    refreshAgeMinutes: number;
  };
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

const registry: Record<string, ModuleEntry> = {};

for (const path in raw) {
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

console.log(`[registry] loaded ${Object.keys(registry).length} / ${Object.keys(raw).length} modules`);

export default registry;
