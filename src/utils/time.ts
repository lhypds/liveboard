export type Lang = "en" | "ja" | "zh";

const DATE_LOCALE: Record<Lang, string> = { en: "en-US", ja: "ja-JP", zh: "zh-CN" };

/**
 * A card that stamps `createdAt` / `updatedAt` (epoch ms) into its comp config gets
 * those times listed in its Info modal — see Note, which stamps both as you type.
 */
export function formatTimestamp(value: unknown, lang: Lang): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value).toLocaleString(DATE_LOCALE[lang], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
