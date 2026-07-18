import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toPng } from "html-to-image";
import { ActionButton } from "@ui";
import styles from "./export.module.css";

const FORMATS = [{ key: "png", label: "PNG" }] as const;

type ExportProps = {
  title?: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "export";
}

export default function Export({ title }: ExportProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  async function exportPng() {
    const card = wrapperRef.current?.closest<HTMLElement>("[data-modal-boundary]");
    if (!card || loading) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(card, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (node) => !(node instanceof HTMLElement && "cardActions" in node.dataset),
      });
      const link = document.createElement("a");
      link.download = `${sanitizeFilename(title ?? "")}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setLoading(false);
    }
  }

  function pick(format: (typeof FORMATS)[number]["key"]) {
    setOpen(false);
    if (format === "png") void exportPng();
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-open={open} data-loading={loading}>
      <ActionButton tooltip={t("export.tooltip")} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </ActionButton>
      <div className={styles.dropdown}>
        {FORMATS.map(({ key, label }) => (
          <button key={key} type="button" className={styles.option} onClick={() => pick(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
