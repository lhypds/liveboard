import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";

type RefreshProps = {
  /**
   * Re-fetch what the card shows — its own `data/` folder, or whichever API it reads. Nothing
   * runs on the server: fetching new data into a component's folder is `fetch.sh`'s job, on a
   * cron or by hand, and clicking this must never kick off a crawl. Like Reset, the button only
   * appears for cards that register a handler (see `_setRefresh` in Home).
   */
  onRefresh: () => void | Promise<void>;
  onLoadingChange?: (loading: boolean) => void;
};

export default function Refresh({ onRefresh, onLoadingChange }: RefreshProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      await onRefresh();
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <ActionButton tooltip={t("refresh.tooltip")} onClick={handleClick}>
      <svg viewBox="0 0 24 24">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v5h-5" />
      </svg>
    </ActionButton>
  );
}
