import { useCallback, useRef } from "react";

/**
 * Fractional line heights leave a pixel or two between a scrolled-all-the-way-down
 * element's scrollTop and the arithmetic bottom, so anything within this counts as
 * the bottom.
 */
const SLACK_PX = 4;

/**
 * Keeps a scrolling element following its last line while text arrives from
 * outside it — a generation streaming into a card — the way a terminal follows
 * its output. Only for a reader who is already down there: scrolled up to read
 * something further back, they stay where they put themselves.
 *
 * It takes two calls because the decision can only be made *before* the new text
 * lands. Once it has, the old bottom is no longer the bottom and every element
 * looks scrolled up, so there is nothing left to tell the two cases apart. Call
 * `mark` while the element still shows the old text, and `follow` from a layout
 * effect on the render that lands the new text.
 */
export function useFollowBottom(ref: React.RefObject<HTMLElement | null>) {
  const pendingRef = useRef(false);

  /** Records whether the bottom is in view; call before the new text lands */
  const mark = useCallback(() => {
    const el = ref.current;
    pendingRef.current = !!el && el.scrollHeight - el.scrollTop - el.clientHeight <= SLACK_PX;
  }, [ref]);

  /** Scrolls down if the last `mark` found the bottom in view; returns whether it moved */
  const follow = useCallback(() => {
    if (!pendingRef.current) return false;
    pendingRef.current = false;
    const el = ref.current;
    if (!el) return false;
    el.scrollTop = el.scrollHeight;
    return true;
  }, [ref]);

  return { mark, follow };
}
