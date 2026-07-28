import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./boardSwitcher.module.css";

type BoardSwitcherProps = {
  count: number;
  active: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
};

export default function BoardSwitcher({ count, active, onSelect, onAdd }: BoardSwitcherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  function pick(index: number) {
    onSelect(index);
    setOpen(false);
  }

  function add() {
    onAdd();
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        {active + 1}
      </button>
      <div className={styles.dropdown}>
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.option} ${i === active ? styles.active : ""}`}
            onClick={() => pick(i)}
          >
            {t("board.label", { n: i + 1 })}
          </button>
        ))}
        <button type="button" className={styles.option} onClick={add} title={t("board.add")}>
          <svg className={styles.icon} viewBox="0 0 24 24">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
