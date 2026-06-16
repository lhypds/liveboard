import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, Modal } from "@ui";
import styles from "./info.module.css";

type I18nText = Record<string, string>;
type InfoItem = { key: I18nText; value: I18nText };
export type InfoSection = { title: I18nText; items: InfoItem[] };

type InfoProps = {
  title?: ReactNode;
  sections: InfoSection[];
  lastUpdated?: string;
};

function resolve(text: I18nText, lang: string): string {
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? "";
}

export default function Info({ title, sections, lastUpdated }: InfoProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const lang = i18n.language;

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
          {sections.flatMap((section) =>
            section.items.map((item, j) => (
              <Fragment key={j}>
                <dt className={styles.label}>{resolve(item.key, lang)}</dt>
                <dd className={styles.value}>{resolve(item.value, lang)}</dd>
              </Fragment>
            ))
          )}
          {lastUpdated && (
            <>
              <dt className={styles.label}>{t("info.lastUpdated")}</dt>
              <dd className={styles.value}>{lastUpdated}</dd>
            </>
          )}
        </dl>
      </Modal>
    </>
  );
}
