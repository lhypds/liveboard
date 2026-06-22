import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import styles from "./layoutIO.module.css";

type StoredItem = LayoutItem & { config?: Record<string, unknown> };

type LayoutIOProps = {
  layout: Layout;
  configs: Record<string, Record<string, unknown>>;
  onImport: (layout: Layout, configs: Record<string, Record<string, unknown>>) => void;
};

export default function LayoutIO({ layout, configs, onImport }: LayoutIOProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  function handleExport() {
    const stored: StoredItem[] = layout.map((item) => ({
      ...item,
      ...(configs[item.i] ? { config: configs[item.i] } : {}),
    }));
    const blob = new Blob([JSON.stringify(stored, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `layout_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
    setOpen(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as StoredItem[];
        const nextLayout: Layout = parsed.map(({ config: _, ...item }) => item);
        const nextConfigs: Record<string, Record<string, unknown>> = Object.fromEntries(
          parsed
            .filter((it): it is StoredItem & { config: Record<string, unknown> } => Boolean(it.config))
            .map((it) => [it.i, it.config]),
        );
        onImport(nextLayout, nextConfigs);
      } catch {
        // ignore invalid files
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <svg className={styles.icon} viewBox="0 0 24 24">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </button>
      <div className={styles.dropdown}>
        <button type="button" className={styles.option} onClick={handleExport}>
          {t("layoutIO.export")}
        </button>
        <button type="button" className={styles.option} onClick={handleImportClick}>
          {t("layoutIO.import")}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className={styles.fileInput}
        onChange={handleFileChange}
      />
    </div>
  );
}
