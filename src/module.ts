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
};

export type ModuleEntry = {
  component: ComponentType;
  config: ModuleConfig;
};

const raw = import.meta.glob("./modules/*/index.ts", { eager: true });

const registry: Record<string, ModuleEntry> = {};

if (Object.keys(raw).length) {
  for (const path in raw) {
    const mod = raw[path] as { default: ComponentType; config?: ModuleConfig };
    if (!mod.default || !mod.config) continue;
    const name = path.split("/").at(-2)!;
    registry[name] = { component: mod.default, config: mod.config };
  }
}

export default registry;
