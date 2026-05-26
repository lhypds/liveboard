import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";
import styles from "./export.module.css";

const FORMATS = [
  { key: "csv", label: "CSV" },
  { key: "excel", label: "Excel" },
  { key: "png", label: "PNG" },
];

export default function Export({ onExport = () => {} }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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

  function pick(format) {
    onExport?.(format);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open}>
      <ActionButton tooltip={t("export.tooltip")} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </ActionButton>
      <div className={styles.dropdown}>
        {FORMATS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={styles.option}
            onClick={() => pick(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
