import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toCanvas } from "html-to-image";
import { ActionButton, showToast } from "@ui";
import { NeedsGestureError, saveFile, startActivationWindow } from "@services/download";
import styles from "./export.module.css";

const FORMATS = [{ key: "png", label: "PNG" }] as const;

/**
 * How much detail to ask for. Text and borders reach the canvas as vector — html-to-image draws the
 * card as an SVG foreignObject — so the export keeps getting sharper with every step up here, and
 * the only ceiling is the canvas itself. A card is a grid cell, so it is small: 400x300 CSS px is
 * typical, and at 2x that came out an 800x600 PNG that read as blurry on any screen bigger than the
 * card. So the ratio is raised until the longest edge clears TARGET_EDGE, with MIN_RATIO as the
 * floor for a card already that big and MAX_RATIO as the ceiling for a tiny one.
 */
const TARGET_EDGE = 2400;
const MIN_RATIO = 3;
const MAX_RATIO = 6;

/**
 * And the canvas limits that outrank all of it: iOS caps the backing store at 4096px a side on the
 * older devices and the total area at ~16M px, and a canvas over either limit comes back blank
 * rather than refusing.
 */
const MAX_EDGE = 4096;
const MAX_AREA = 16_000_000;

/**
 * The white border the card sits in, in card px — it is multiplied by the pixel ratio like
 * everything else, so it reads as the same thin margin whatever resolution the export came out at,
 * and matches the card's own 8–10px padding rather than being a hairline at 6x.
 */
const PADDING = 10;

type ExportProps = {
  title?: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "export";
}

function pixelRatioFor(el: HTMLElement): number {
  const { offsetWidth: w, offsetHeight: h } = el;
  if (!w || !h) return MIN_RATIO;
  // The border grows with the ratio too, so the canvas that has to stay inside the limits is the
  // padded one, not the card
  const paddedW = w + PADDING * 2;
  const paddedH = h + PADDING * 2;
  const longest = Math.max(paddedW, paddedH);
  const wanted = Math.min(MAX_RATIO, Math.max(MIN_RATIO, TARGET_EDGE / longest));
  return Math.min(wanted, MAX_EDGE / longest, Math.sqrt(MAX_AREA / (paddedW * paddedH)));
}

/**
 * The card's canvas, centred on a white one that is `PADDING` bigger on every side.
 *
 * Done after the render rather than by padding the clone: html-to-image's `width`/`height` options
 * resize the clone itself, which re-flows the card at the new size instead of framing it, and a
 * `padding` in its `style` option is eaten by the card's own `box-sizing: border-box`.
 */
function withBorder(card: HTMLCanvasElement, ratio: number): HTMLCanvasElement {
  const pad = Math.round(PADDING * ratio);
  const out = document.createElement("canvas");
  out.width = card.width + pad * 2;
  out.height = card.height + pad * 2;
  const ctx = out.getContext("2d");
  // Nothing to fall back to but the unframed card, which is still the picture the user asked for
  if (!ctx) return card;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(card, pad, pad);
  // Two canvases this size is twice the backing store for iOS to hold at once, and it is this one
  // that still has to be encoded; the card's has nothing left to give
  card.width = 0;
  card.height = 0;
  return out;
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
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
      const ratio = pixelRatioFor(card);
      const rendered = await toCanvas(card, {
        pixelRatio: ratio,
        backgroundColor: "#ffffff",
        filter: (node) => !(node instanceof HTMLElement && "cardActions" in node.dataset),
      });
      const blob = await toPngBlob(withBorder(rendered, ratio));
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
