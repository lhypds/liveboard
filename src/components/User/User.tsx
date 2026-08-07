import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, showToast } from "@ui";
import LoginModal from "@components/LoginModal";
import { useUser } from "@contexts/user";
import * as api from "@utils/user";
import { getScAccount, setScAccount, clearScAccount, loginSc } from "@utils/sc";
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
  const [scName, setScName] = useState("");
  const [scPassword, setScPassword] = useState("");
  const [scToken, setScToken] = useState("");

  // Read the saved account each time the modal opens. Only the username and
  // the token are kept, so the password box always starts empty. With nothing
  // saved yet the box starts on the liveboard username, which is usually the
  // same account
  useEffect(() => {
    if (!profileOpen || !user) return;
    const account = getScAccount();
    setScName(account.username || user);
    setScToken(account.token);
    setScPassword("");
  }, [profileOpen, user]);

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

  async function handleScGet() {
    if (!user || busy) return;
    const username = scName.trim();
    if (!username || !scPassword) return;
    setBusy(true);
    try {
      const token = await loginSc(username, scPassword);
      setScAccount({ username, token });
      setScToken(token);
      setScPassword("");
      showToast(t("user.scSaveDone"));
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t("user.error"));
    } finally {
      setBusy(false);
    }
  }

  function handleScClear() {
    if (!user || busy) return;
    clearScAccount();
    // Back to the same default the modal opens with rather than an empty box
    setScName(user);
    setScPassword("");
    setScToken("");
    showToast(t("user.scClearDone"));
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
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t("user.layoutSection")}</h3>
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
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t("user.scAccountSection")}</h3>
            <div className={styles.fields}>
              {/* Browsers ignore autocomplete="off" on credential-shaped fields, so both
                  names are deliberately non-semantic, the password is a masked text box
                  rather than an input[type="password"] — the only field a browser offers
                  to save — and data-1p-ignore / data-lpignore keep the third-party
                  managers out. The password is never persisted anywhere; only the token
                  the server trades it for is. */}
              <input
                className={styles.input}
                name="sc-account"
                value={scName}
                placeholder={t("user.scUsername")}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-1p-ignore=""
                data-lpignore="true"
                onChange={(e) => setScName(e.target.value)}
              />
              <input
                className={`${styles.input} ${styles.masked}`}
                name="sc-secret"
                value={scPassword}
                placeholder={t("user.scPassword")}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-1p-ignore=""
                data-lpignore="true"
                onChange={(e) => setScPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScGet();
                }}
              />
              <div className={styles.scButtons}>
                <button type="button" className={styles.scButton} onClick={handleScGet} disabled={busy}>
                  {t("user.scGetCredential")}
                </button>
                <button
                  type="button"
                  className={styles.scButton}
                  onClick={handleScClear}
                  disabled={busy || !(scToken || scPassword)}
                >
                  {t("user.scClearCredential")}
                </button>
              </div>
            </div>
          </section>

          <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={busy}>
            {t("user.logout")}
          </button>
        </div>
      </Modal>
    </>
  );
}
