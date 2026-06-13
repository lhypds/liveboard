import { useEffect, type ReactNode } from "react";
import styles from "./modal.module.css";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  closeOnOverlay?: boolean;
  className?: string;
};

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  closeOnOverlay = false,
  className,
}: ModalProps) => {
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

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <div className={[styles.modal, className].filter(Boolean).join(" ")}>
        <div className={styles.header}>
          {title && <span className={styles.title}>{title}</span>}
          <button className={styles.closeButton} onClick={onClose} disabled={!onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
