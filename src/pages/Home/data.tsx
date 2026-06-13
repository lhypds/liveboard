import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout/legacy";
import modules from "@modules";

export type Lang = "en" | "ja" | "zh";
type InfoField = Record<Lang, string>;

export type CardConfig = LayoutItem & {
  title: Record<Lang, string>;
  content: (config: Record<string, unknown>) => ReactNode;
  info: {
    dataSource: InfoField;
    refreshFrequency: InfoField;
    refreshAgeMinutes: number;
    lastUpdated: Date;
  };
};

const BOOT = Date.now();

export const CARDS: CardConfig[] = Object.values(modules).map(({ component: Comp, config: c }) => ({
  i: c.i,
  title: c.title as Record<Lang, string>,
  content: (config: Record<string, unknown>) => <Comp config={config} />,
  info: {
    dataSource: c.info.dataSource as InfoField,
    refreshFrequency: c.info.refreshFrequency as InfoField,
    refreshAgeMinutes: c.info.refreshAgeMinutes,
    lastUpdated: new Date(BOOT - c.info.refreshAgeMinutes * 60_000),
  },
  x: c.x,
  y: c.y,
  w: c.w,
  h: c.h,
  minW: c.minW,
  minH: c.minH,
  maxW: c.maxW,
  maxH: c.maxH,
}));
