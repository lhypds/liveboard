import { useTranslation } from "react-i18next";
import { Modal } from "@ui";
import styles from "./confirm.module.css";

type ConfirmModalProps = {
  isOpen: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  isOpen,
  message,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onCancel} className={styles.modal}>
      <div className={styles.body}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {cancelLabel ?? t("button.cancel")}
          </button>
          <button type="button" className={styles.confirm} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel ?? t("button.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
