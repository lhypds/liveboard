import type { ReactNode } from "react";
import type { LayoutItem } from "react-grid-layout/legacy";
import { HeatMap } from "@components";

export type Lang = "en" | "ja" | "zh";

type InfoField = Record<Lang, string>;

export type CardConfig = LayoutItem & {
  title: Record<Lang, string>;
  content: ReactNode;
  info: {
    dataSource: InfoField;
    refreshFrequency: InfoField;
    lastUpdated: Date;
  };
};

const REFRESH_LABEL: Record<string, InfoField> = {
  realtime: { en: "Realtime", ja: "リアルタイム", zh: "实时" },
  hourly: { en: "Every hour", ja: "1時間ごと", zh: "每小时" },
  daily: { en: "Daily", ja: "毎日", zh: "每日" },
  weekly: { en: "Weekly", ja: "毎週", zh: "每周" },
};

const REFRESH_AGE_MIN: Record<string, number> = {
  realtime: 1,
  hourly: 24,
  daily: 60 * 6,
  weekly: 60 * 24 * 2,
};

const BOOT = Date.now();

function refresh(key: keyof typeof REFRESH_LABEL) {
  return {
    refreshFrequency: REFRESH_LABEL[key],
    lastUpdated: new Date(BOOT - REFRESH_AGE_MIN[key] * 60_000),
  };
}

const REFRESH = {
  realtime: refresh("realtime"),
  hourly: refresh("hourly"),
  daily: refresh("daily"),
  weekly: refresh("weekly"),
};

export const CARDS: CardConfig[] = [
  {
    i: "heatmap",
    title: {
      en: "Tokyo Heatmap",
      ja: "東京ヒートマップ",
      zh: "东京热力图",
    },
    content: <HeatMap />,
    info: {
      dataSource: {
        en: "STR + internal PMS",
        ja: "STR + 自社PMS",
        zh: "STR + 内部 PMS",
      },
      ...REFRESH.hourly,
    },
    x: 0,
    y: 0,
    w: 24,
    h: 18,
    minW: 16,
    minH: 16,
  },
];
