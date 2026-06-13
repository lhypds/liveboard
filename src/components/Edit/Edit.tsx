import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, Modal } from "@ui";
import styles from "./edit.module.css";

type EditProps = {
  title?: string;
  onSave?: (title: string) => void;
  onDelete?: () => void;
};

export default function Edit({ title = "", onSave, onDelete }: EditProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    if (open) setDraft(title);
  }, [open, title]);

  function handleSave() {
    onSave?.(draft);
    setOpen(false);
  }

  function handleDelete() {
    onDelete?.();
    setOpen(false);
  }

  return (
    <>
      <ActionButton tooltip={t("edit.tooltip")} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </ActionButton>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={t("edit.tooltip")}>
        <div className={styles.field}>
          <label className={styles.label}>{t("edit.titleLabel")}</label>
          <input
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.saveButton} onClick={handleSave}>
            {t("button.save")}
          </button>
          <button type="button" className={styles.deleteButton} onClick={handleDelete}>
            {t("button.delete")}
          </button>
        </div>
      </Modal>
    </>
  );
}
