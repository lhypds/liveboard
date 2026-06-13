import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, Modal } from "@ui";
import styles from "./edit.module.css";

type EditProps = {
  onDelete?: () => void;
  settings?: ComponentType<{ onClose?: () => void }>;
};

export default function Edit({ onDelete, settings: Settings }: EditProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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
        {Settings && (
          <>
            <Settings onClose={() => setOpen(false)} />
            <div className={styles.divider} />
          </>
        )}
        <button type="button" className={styles.deleteButton} onClick={handleDelete}>
          {t("button.delete")}
        </button>
      </Modal>
    </>
  );
}
