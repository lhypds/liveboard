import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, Modal } from "@ui";
import styles from "./info.module.css";

type InfoProps = {
  title?: ReactNode;
  dataSource: ReactNode;
  refreshFrequency: ReactNode;
  lastUpdated: Date;
};

const LOCALES: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

function formatTimestamp(date: Date, lang: string): string {
  const locale = LOCALES[lang] ?? lang;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Info({ title, dataSource, refreshFrequency, lastUpdated }: InfoProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionButton tooltip={t("info.tooltip")} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 7.5v.5" />
        </svg>
      </ActionButton>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title ?? t("info.tooltip")}>
        <dl className={styles.list}>
          <dt className={styles.label}>{t("info.dataSource")}</dt>
          <dd className={styles.value}>{dataSource}</dd>
          <dt className={styles.label}>{t("info.refreshFrequency")}</dt>
          <dd className={styles.value}>{refreshFrequency}</dd>
          <dt className={styles.label}>{t("info.lastUpdated")}</dt>
          <dd className={styles.value}>{formatTimestamp(lastUpdated, i18n.language)}</dd>
        </dl>
      </Modal>
    </>
  );
}
