import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TextareaHTMLAttributes } from "react";
import { ActionButton, Modal, TextArea as TextAreaBase } from "@ui";
import styles from "./edit.module.css";

const TextArea = TextAreaBase as React.ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement> & { minHeight?: number }>;

// T is the shape of the edited JSON: a card's config object, or a board's item array
type EditProps<T> = {
  config?: T;
  onSave?: (config: T) => void;
  onDelete?: () => void;
  /** Modal heading; defaults to the shared "Edit" label */
  title?: string;
  /** Cards label their pencil on hover; the board's pencil stands alone in the header and doesn't */
  hideTooltip?: boolean;
};

export default function Edit<T = Record<string, unknown>>({
  config,
  onSave,
  onDelete,
  title,
  hideTooltip,
}: EditProps<T>) {
  const { t } = useTranslation();
  const label = title ?? t("edit.tooltip");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(JSON.stringify(config ?? {}, null, 2));
      setError("");
    }
  }, [open]);

  function handleSave() {
    try {
      const parsed = JSON.parse(draft) as T;
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
      <ActionButton tooltip={hideTooltip ? undefined : label} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </ActionButton>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={label}>
        <TextArea
          className={styles.json}
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setDraft(e.target.value);
            setError("");
          }}
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
