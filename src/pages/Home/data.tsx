import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout/legacy";
import modules from "@modules";

export type Lang = "en" | "ja" | "zh";
type I18n = Record<Lang, string>;
type InfoItem = { key: I18n; value: I18n };
export type InfoSection = { title: I18n; items: InfoItem[] };

export type CardConfig = LayoutItem & {
  title: I18n;
  content: (config: Record<string, unknown>) => ReactNode;
  refreshAgeMinutes: number;
  fileLastUpdated?: string;
  hasRefresh?: boolean;
  info: InfoSection[];
  comp?: Record<string, unknown>;
  allowMultipleInstances?: boolean;
};

export const CARDS: CardConfig[] = Object.values(modules).map(({ component: Comp, config: c }) => ({
  i: c.i,
  title: c.title as I18n,
  content: (config: Record<string, unknown>) => <Comp config={config} />,
  refreshAgeMinutes: c.refreshAgeMinutes as number,
  fileLastUpdated: c.lastUpdated,
  info: c.info as InfoSection[],
  x: c.x,
  y: c.y,
  w: c.w,
  h: c.h,
  minW: c.minW,
  minH: c.minH,
  maxW: c.maxW,
  maxH: c.maxH,
  ...(c.comp ? { comp: { ...c.comp } } : {}),
  ...(c.allowMultipleInstances !== undefined ? { allowMultipleInstances: c.allowMultipleInstances } : {}),
  ...(c.hasRefresh ? { hasRefresh: true } : {}),
}));
