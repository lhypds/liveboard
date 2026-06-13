import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TextareaHTMLAttributes } from "react";
import { ActionButton, Modal, TextArea as TextAreaBase } from "@ui";
import styles from "./edit.module.css";

const TextArea = TextAreaBase as React.ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement> & { minHeight?: number }>;

type EditProps = {
  config?: Record<string, unknown>;
  onSave?: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
};

export default function Edit({ config = {}, onSave, onDelete }: EditProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(JSON.stringify(config, null, 2));
      setError("");
    }
  }, [open]);

  function handleSave() {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      onSave?.(parsed);
      setOpen(false);
    } catch {
      setError(t("edit.invalidJson"));
    }
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
        <TextArea
          className={styles.json}
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setDraft(e.target.value);
            setError("");
          }}
          minHeight={240}
          spellCheck={false}
        />
        {error && <span className={styles.error}>{error}</span>}
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
