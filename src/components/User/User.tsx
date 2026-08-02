import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, showToast } from "@ui";
import LoginModal from "@components/LoginModal";
import { useUser } from "@contexts/user";
import * as api from "@utils/user";
import styles from "./user.module.css";

type UserProps = {
  /** The whole boards store; uploaded to the server as-is */
  store: unknown;
  /** Applies a downloaded store; returns false when the data isn't usable */
  onRestore: (data: unknown) => boolean;
};

export default function User({ store, onRestore }: UserProps) {
  const { t } = useTranslation();
  const { user, logout } = useUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const data = await api.getLayout(user);
      if (onRestore(data)) {
        setProfileOpen(false);
        showToast(t("user.downloadDone"));
      } else {
        showToast(t("user.error"));
      }
    } catch (err) {
      showToast(err instanceof api.ApiError && err.status === 404 ? t("user.noLayout") : t("user.error"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await api.putLayout(user, store);
      setProfileOpen(false);
      showToast(t("user.uploadDone"));
    } catch {
      showToast(t("user.error"));
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    logout();
    setProfileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-loggedin={Boolean(user)}
        aria-label={t(user ? "user.profile" : "user.login")}
        onClick={() => (user ? setProfileOpen(true) : setLoginOpen(true))}
      >
        <svg className={styles.icon} viewBox="0 0 24 24">
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
        </svg>
      </button>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />

      <Modal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={t("user.profile")}
        closeOnOverlay
        className={styles.modal}
      >
        <div className={styles.profile}>
          <p className={styles.username}>
            {t("user.username")} @{user}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.actionButton} onClick={handleDownload} disabled={busy}>
              {t("user.download")}
              <svg className={styles.actionIcon} viewBox="0 0 24 24">
                <path d="M12 3v10" />
                <path d="M7 8l5 5 5-5" />
                <path d="M5 19h14" />
              </svg>
            </button>
            <button type="button" className={styles.actionButton} onClick={handleUpload} disabled={busy}>
              {t("user.upload")}
              <svg className={styles.actionIcon} viewBox="0 0 24 24">
                <path d="M12 13V3" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 19h14" />
              </svg>
            </button>
          </div>
          <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={busy}>
            {t("user.logout")}
          </button>
        </div>
      </Modal>
    </>
  );
}
