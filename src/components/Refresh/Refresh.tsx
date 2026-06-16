import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";
import styles from "./refresh.module.css";

type RefreshProps = {
  moduleId: string;
};

export default function Refresh({ moduleId }: RefreshProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch(`/api/refresh?module=${encodeURIComponent(moduleId)}`, { method: "POST" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper} data-loading={loading}>
      <ActionButton tooltip={t("refresh.tooltip")} onClick={handleClick}>
        <svg viewBox="0 0 24 24">
          <path d="M1 4v6h6" />
          <path d="M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      </ActionButton>
    </div>
  );
}
