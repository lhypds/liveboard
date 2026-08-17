import { useEffect, useRef, useState } from "react";
import styles from "./dropdown.module.css";

type Props<T extends string> = {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

/**
 * The board's own dropdown idiom (as hand-rolled in components/Add and components/BoardSwitcher): a
 * bordered trigger with an absolutely positioned column of options, opened by hover or click and
 * inverted to black on hover. A native <select> would render the OS widget instead, which is the
 * one thing that would look out of place on a board drawn entirely in hairlines.
 *
 * `value` is matched against the options to label the trigger, so it is safe to pass a value that
 * is not in the list — the first option stands in until it is.
 */
export default function Dropdown<T extends string>({ value, options, onChange, ariaLabel }: Props<T>) {
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

  const current = options.find((o) => o.value === value) ?? options[0];

  function pick(next: T) {
    onChange(next);
    setOpen(false);
    setDismissed(true);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open} data-dismissed={dismissed}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onPointerEnter={() => setDismissed(false)}
        onClick={() => {
          setDismissed(false);
          setOpen((v) => !v);
        }}
      >
        <span className={styles.triggerLabel}>{current?.label}</span>
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
      <div className={styles.dropdown} role="listbox" aria-label={ariaLabel}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={`${styles.option} ${o.value === value ? styles.active : ""}`}
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
