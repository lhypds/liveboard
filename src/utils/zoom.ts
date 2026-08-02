const FIELD_SELECTOR = "input, textarea, select, [contenteditable]";

/**
 * iOS Safari zooms the whole page in when a field is focused and its font-size
 * computes to less than 16px. Capping `maximum-scale` at 1 suppresses that
 * automatic zoom, so this caps it while a field is being focused and lifts the
 * cap once focus leaves — pinch-to-zoom stays available the rest of the time,
 * and card text keeps whatever size the design asks for.
 */
export function preventInputZoom() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;

  const unlocked = meta.content;
  const locked = /maximum-scale/.test(unlocked)
    ? unlocked
    : `${unlocked}, maximum-scale=1.0`;

  const lock = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(FIELD_SELECTOR)) return;
    if (meta.content !== locked) meta.content = locked;
  };

  const unlock = () => {
    // Deferred so moving between two fields does not flicker the cap off and on,
    // which iOS would read as a fresh viewport and zoom for.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof Element && active.closest(FIELD_SELECTOR)) return;
      if (meta.content !== unlocked) meta.content = unlocked;
    });
  };

  // `touchstart` lands before focus, so the cap is already in place by the time
  // iOS decides whether to zoom; `focusin` backstops taps that skip it and
  // programmatic or keyboard focus.
  document.addEventListener("touchstart", lock, { capture: true, passive: true });
  document.addEventListener("focusin", lock, true);
  document.addEventListener("focusout", unlock, true);
}
