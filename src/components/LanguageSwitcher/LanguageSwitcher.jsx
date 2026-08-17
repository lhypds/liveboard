import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import styles from "./lang.module.css";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "zh", label: "ZH" },
  { code: "ja", label: "JA" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = LANGS.find((l) => l.code === i18n.language) || LANGS[0];
  const [open, setOpen] = useState(false);
  // A pick leaves the pointer sitting inside the wrapper, where the hover rule would hold the list
  // open; this latches it shut until the pointer comes back over the trigger (see the CSS)
  const [dismissed, setDismissed] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  function switchLang(code) {
    i18n.changeLanguage(code);
    localStorage.setItem("lang", code);
    setOpen(false);
    setDismissed(true);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open} data-dismissed={dismissed}>
      <button
        type="button"
        className={styles.trigger}
        onPointerEnter={() => setDismissed(false)}
        onClick={() => {
          setDismissed(false);
          setOpen((v) => !v);
        }}
      >
        {current.label}
      </button>
      <div className={styles.dropdown}>
        {LANGS.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            className={`${styles.option} ${i18n.language === code ? styles.active : ""}`}
            onClick={() => switchLang(code)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
