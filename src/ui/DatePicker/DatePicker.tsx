import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./datepicker.module.css";

type DatePickerLabels = {
  placeholder?: string;
  previousMonth?: string;
  nextMonth?: string;
};

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  locale?: string;
  labels?: DatePickerLabels;
  min?: string;
  max?: string;
  /**
   * Which days have something behind them. A day this says no to is drawn grey but stays
   * selectable — being told a day is empty is an answer, where a day taken out of the calendar
   * only leaves the reader wondering. Unset means every day is drawn normally.
   */
  hasData?: (date: string) => boolean;
  align?: "start" | "end";
  variant?: "default" | "subtle";
  openAt?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DAY_MS = 86_400_000;

function parseDate(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return time;
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function monthGrid(monthTime: number): string[] {
  const month = new Date(monthTime);
  const first = Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1);
  const leading = new Date(first).getUTCDay();
  return Array.from({ length: 42 }, (_, index) => isoDate(first + (index - leading) * DAY_MS));
}

function startOfMonth(value: string): number {
  const time = parseDate(value) ?? Date.now();
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function dateLabel(value: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const time = parseDate(value);
  if (time === null) return "";
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(time));
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" />
      <path d="M5 1.5v4M11 1.5v4M2.5 6.5h11" />
    </svg>
  );
}

export default function DatePicker({
  value,
  onChange,
  ariaLabel,
  locale = "en-US",
  labels,
  min,
  max,
  hasData,
  align = "start",
  variant = "default",
  openAt,
  open: controlledOpen,
  onOpenChange,
}: DatePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const anchorMonth = startOfMonth(openAt || value);
  const [monthView, setMonthView] = useState(() => ({ anchor: anchorMonth, month: anchorMonth }));
  const viewMonth = monthView.anchor === anchorMonth ? monthView.month : anchorMonth;
  const rootRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(
        new Date(Date.UTC(2024, 0, 7 + index)),
      )),
    [locale],
  );
  const month = new Date(viewMonth).getUTCMonth();

  const setOpen = useCallback((next: boolean) => {
    if (!next) setMonthView({ anchor: anchorMonth, month: anchorMonth });
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [anchorMonth, controlledOpen, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, setOpen]);

  function toggle() {
    if (!open) setMonthView({ anchor: anchorMonth, month: anchorMonth });
    setOpen(!open);
  }

  function changeMonth(offset: number) {
    const date = new Date(viewMonth);
    setMonthView({
      anchor: anchorMonth,
      month: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
    });
  }

  return (
    <div ref={rootRef} className={`${styles.root} ${variant === "subtle" ? styles.subtle : ""}`}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{value ? dateLabel(value, locale, { year: "numeric", month: "short", day: "numeric" }) : labels?.placeholder ?? "Choose date"}</span>
        <CalendarIcon />
      </button>
      {open && (
        <div className={`${styles.panel} ${align === "end" ? styles.panelEnd : ""}`} role="dialog" aria-label={ariaLabel}>
          <div className={styles.header}>
            <button type="button" onClick={() => changeMonth(-1)} aria-label={labels?.previousMonth ?? "Previous month"}>‹</button>
            <strong>{dateLabel(isoDate(viewMonth), locale, { year: "numeric", month: "long" })}</strong>
            <button type="button" onClick={() => changeMonth(1)} aria-label={labels?.nextMonth ?? "Next month"}>›</button>
          </div>
          <div className={styles.grid}>
            {weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`} className={styles.weekday}>{weekday}</span>
            ))}
            {days.map((day) => {
              const disabled = Boolean((min && day < min) || (max && day > max));
              const outside = new Date(parseDate(day) ?? 0).getUTCMonth() !== month;
              const empty = hasData ? !hasData(day) : false;
              return (
                <button
                  key={day}
                  type="button"
                  className={`${styles.day} ${outside ? styles.outside : ""} ${empty ? styles.empty : ""} ${day === value ? styles.selected : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  aria-label={dateLabel(day, locale, { year: "numeric", month: "long", day: "numeric" })}
                  aria-pressed={day === value}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
