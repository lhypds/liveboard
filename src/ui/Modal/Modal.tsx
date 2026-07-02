import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./modal.module.css";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  closeOnOverlay?: boolean;
  className?: string;
};

const VIEWPORT_MARGIN = 12;

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnOverlay = false,
  className,
}: ModalProps) => {
  const markerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Center the modal on the nearest [data-modal-boundary] ancestor (the card
  // it was opened from) instead of the window. The overlay is portaled to
  // <body>, so it can't be clipped or stacked under sibling cards.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const boundary = markerRef.current?.closest("[data-modal-boundary]");
    setAnchorRect(boundary ? boundary.getBoundingClientRect() : null);
  }, [isOpen]);

  // The panel may be larger than its card; shift it back into the viewport
  // so it never renders cut off.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = "";
    const rect = panel.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (rect.left < VIEWPORT_MARGIN) dx = VIEWPORT_MARGIN - rect.left;
    else if (rect.right > window.innerWidth - VIEWPORT_MARGIN) dx = window.innerWidth - VIEWPORT_MARGIN - rect.right;
    if (rect.top < VIEWPORT_MARGIN) dy = VIEWPORT_MARGIN - rect.top;
    else if (rect.bottom > window.innerHeight - VIEWPORT_MARGIN) dy = window.innerHeight - VIEWPORT_MARGIN - rect.bottom;
    if (dx || dy) panel.style.transform = `translate(${dx}px, ${dy}px)`;
  }, [isOpen, anchorRect]);

  // Prevent touchmove on background
  // allow scroll on textarea/input/select but prevent on the rest of the background
  useEffect(() => {
    if (!isOpen) return;
    const isScrollable = (el: Element | null) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      return (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
    };
    const allowTags = ["TEXTAREA", "INPUT", "SELECT"];
    const handleTouchMove = (e: TouchEvent) => {
      let el = e.target as Element | null;
      while (el && el !== document.body) {
        if (allowTags.includes(el.tagName) || isScrollable(el)) {
          return; // allow scroll/touchmove on scrollable elements
        }
        el = el.parentElement;
      }
      e.preventDefault(); // prevent background scroll
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <span ref={markerRef} hidden />
      {isOpen &&
        createPortal(
          <div
            className={styles.overlay}
            style={
              anchorRect
                ? {
                    top: anchorRect.top,
                    left: anchorRect.left,
                    width: anchorRect.width,
                    height: anchorRect.height,
                  }
                : undefined
            }
            onClick={handleOverlayClick}
            onMouseDown={stopPropagation}
            onPointerDown={stopPropagation}
            onTouchStart={stopPropagation}
          >
            <div ref={panelRef} className={[styles.modal, className].filter(Boolean).join(" ")}>
              <div className={styles.header}>
                {title && <span className={styles.title}>{title}</span>}
                <button className={styles.closeButton} onClick={onClose} disabled={!onClose} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className={styles.content}>{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default Modal;
