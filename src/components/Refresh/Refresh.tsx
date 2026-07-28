import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";

type RefreshProps = {
  moduleId: string;
  onLoadingChange?: (loading: boolean) => void;
};

export default function Refresh({ moduleId, onLoadingChange }: RefreshProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      await fetch(`/api/refresh?module=${encodeURIComponent(moduleId)}`, { method: "POST" });
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
