import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@ui";
import ConfirmModal from "@components/ConfirmModal";
import { useUser, isValidUsername } from "@contexts/user";
import * as api from "@utils/user";
import styles from "./login.module.css";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t } = useTranslation();
  const { login } = useUser();
  const [name, setName] = useState("");
  const [error, setError] = useState<"username" | "login" | "">("");
  const [submitting, setSubmitting] = useState(false);
  // Set once submit() finds the username has no folder on the server yet;
  // showing this swaps the login form for a create-user confirmation
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  async function finishLogin(username: string) {
    setSubmitting(true);
    try {
      await login(username);
      setName("");
      setError("");
      setPendingUsername(null);
      onClose();
    } catch {
      setError("login");
      setPendingUsername(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (submitting) return;
    const username = name.trim().normalize("NFKC").toLowerCase();
    if (!isValidUsername(username)) {
      setError("username");
      return;
    }
    setSubmitting(true);
    try {
      const exists = await api.userExists(username);
      setSubmitting(false);
      if (exists) {
        await finishLogin(username);
      } else {
        setPendingUsername(username);
      }
    } catch {
      setSubmitting(false);
      setError("login");
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !pendingUsername}
        onClose={onClose}
        title={t("user.login")}
        closeOnOverlay
        className={styles.modal}
      >
        <div className={styles.form}>
          <input
            className={styles.input}
            value={name}
            placeholder={t("user.usernamePlaceholder")}
            autoFocus
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          {error && (
            <p className={styles.error}>{t(error === "username" ? "user.usernameInvalid" : "user.loginFailed")}</p>
          )}
          <button type="button" className={styles.submit} onClick={submit} disabled={submitting}>
            {t("user.login")}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isOpen && Boolean(pendingUsername)}
        message={t("user.confirmCreate", { name: pendingUsername })}
        confirmLabel={t("user.create")}
        confirmDisabled={submitting}
        onCancel={() => setPendingUsername(null)}
        onConfirm={() => pendingUsername && finishLogin(pendingUsername)}
      />
    </>
  );
}
