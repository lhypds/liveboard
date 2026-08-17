import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toBlob } from "html-to-image";
import { ActionButton, showToast } from "@ui";
import { NeedsGestureError, saveFile, startActivationWindow } from "@services/download";
import styles from "./export.module.css";

const FORMATS = [{ key: "png", label: "PNG" }] as const;

/**
 * Retina detail without walking off the end of a canvas: iOS caps the backing store at 4096px a side
 * on the older devices and the total area at ~16M px, and a canvas over either limit comes back
 * blank rather than refusing.
 */
const PIXEL_RATIO = 2;
const MAX_EDGE = 4096;
const MAX_AREA = 16_000_000;

type ExportProps = {
  title?: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "export";
}

function pixelRatioFor(el: HTMLElement): number {
  const { offsetWidth: w, offsetHeight: h } = el;
  if (!w || !h) return PIXEL_RATIO;
  return Math.min(PIXEL_RATIO, MAX_EDGE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h)));
}

export default function Export({ title }: ExportProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** A rendered PNG waiting for a tap to save it, because the tap that rendered it has expired */
  const [pending, setPending] = useState<Blob | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
      }
    }
    function close() {
      setOpen(false);
    }
    // Capture phase: card action toolbars stop pointerdown propagation, which
    // would otherwise swallow outside clicks before they reach the document
    document.addEventListener("pointerdown", handleOutside, true);
    // Clicks inside iframes (Website cards) never reach this document; the
    // window losing focus is the only signal we get
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", handleOutside, true);
      window.removeEventListener("blur", close);
    };
  }, [open]);

  /**
   * Saves what we already rendered. Split out so the second, gesture-fresh tap can reuse it when the
   * render outlived the first one.
   */
  async function save(blob: Blob) {
    const filename = `${sanitizeFilename(title ?? "")}.png`;
    try {
      const outcome = await saveFile(blob, filename);
      setPending(null);
      setOpen(false);
      if (outcome === "downloaded" || outcome === "shared") showToast(t("export.done"));
    } catch (err) {
      if (err instanceof NeedsGestureError) {
        // Keep the bytes and let the user tap once more — the tap is all that is missing
        setPending(blob);
        setOpen(true);
        showToast(t("export.ready"));
        return;
      }
      // Handled here rather than thrown on, because the second tap calls this with no catch of its own
      setPending(null);
      setOpen(false);
      showToast(t("export.error"));
    }
  }

  async function exportPng() {
    const card = wrapperRef.current?.closest<HTMLElement>("[data-modal-boundary]");
    if (!card || loading) return;
    setLoading(true);
    const stillActivated = startActivationWindow();
    try {
      // Safari renders the foreignObject before webfonts settle and hands back a card with no text
      await document.fonts?.ready;
      const blob = await toBlob(card, {
        pixelRatio: pixelRatioFor(card),
        backgroundColor: "#ffffff",
        filter: (node) => !(node instanceof HTMLElement && "cardActions" in node.dataset),
      });
      if (!blob) {
        setOpen(false);
        showToast(t("export.error"));
        return;
      }
      // A render this slow has already spent the tap that started it; asking beats being ignored
      if (!stillActivated()) {
        setPending(blob);
        setOpen(true);
        showToast(t("export.ready"));
        return;
      }
      await save(blob);
    } catch {
      setOpen(false);
      showToast(t("export.error"));
    } finally {
      setLoading(false);
    }
  }

  function pick(format: (typeof FORMATS)[number]["key"]) {
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
        {pending ? (
          <button type="button" className={styles.option} data-save="true" onClick={() => void save(pending)}>
            {t("export.save")}
          </button>
        ) : (
          FORMATS.map(({ key, label }) => (
            <button key={key} type="button" className={styles.option} onClick={() => pick(key)}>
              {label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
