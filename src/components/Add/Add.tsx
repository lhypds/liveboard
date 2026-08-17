import { useState, useRef, useEffect } from "react";
import styles from "./add.module.css";

type AddItem = { id: string; label: string; disabled?: boolean };

type AddProps = {
  items?: AddItem[];
  onAdd?: (id: string) => void;
};

export default function Add({ items = [], onAdd }: AddProps) {
  const [open, setOpen] = useState(false);
  // A pick leaves the pointer sitting inside the wrapper, where the hover rule would hold the list
  // open; this latches it shut until the pointer comes back over the trigger (see the CSS)
  const [dismissed, setDismissed] = useState(false);
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

  function pick(id: string) {
    onAdd?.(id);
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
        <svg className={styles.icon} viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
      <div className={styles.dropdown}>
        {items.map(({ id, label, disabled }) => (
          <button
            key={id}
            type="button"
            className={styles.option}
            disabled={disabled}
            onClick={() => pick(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
