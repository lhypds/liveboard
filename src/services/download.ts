/**
 * Handing a generated file to the user, on every browser the board gets opened in.
 *
 * The obvious `a.href = dataUrl; a.click()` works on desktop Chrome and nowhere else reliably.
 * Four separate things break it, and each needs its own answer:
 *
 * - **`data:` URLs.** WebKit blocks top-level navigation to them, and iOS Safari caps their length,
 *   so a 2 MB PNG goes nowhere without so much as an error. Everything here takes a `blob:` URL.
 * - **A detached anchor.** Firefox and several mobile browsers only fire the download when the
 *   anchor is actually in the document, so it is appended and removed around the click.
 * - **No `download` attribute at all.** Safari before 13 ignores it, which turns the click back
 *   into a navigation. Those browsers get the file opened in a tab to long-press instead.
 * - **The expired user gesture.** Rendering a card to PNG easily outlives the tap that asked for it
 *   (WebKit's activation window is ~5s), and both a synthetic download click and `navigator.share`
 *   are refused without one — silently, in the download case. So callers check
 *   {@link hasUserActivation} before a slow render's result is saved, and ask for a second tap when
 *   it has gone; see `Export`.
 *
 * `<a download>` is tried before `navigator.share` on purpose: desktop Chrome supports file sharing
 * too, and popping an OS share sheet where the user asked for a download would be the worse answer.
 */

export type SaveOutcome =
  /** Went through the OS share sheet */
  | "shared"
  /** Written to the browser's downloads */
  | "downloaded"
  /** Opened in a tab for the user to save by hand — the old-Safari path */
  | "opened"
  /** The user dismissed the share sheet */
  | "cancelled";

/** Thrown when the save needs a user gesture the current task no longer has. Ask for another tap. */
export class NeedsGestureError extends Error {
  constructor() {
    super("saving needs a fresh user gesture");
    this.name = "NeedsGestureError";
  }
}

/**
 * Roughly how long a tap keeps counting as user activation. WebKit's window is 5s; staying under it
 * costs one extra tap in the rare slow render and buys never silently dropping a save.
 */
const ACTIVATION_WINDOW_MS = 4000;

/** A minute is far longer than a download or a new tab needs to read the URL, and costs one blob. */
const REVOKE_DELAY_MS = 60_000;

type WithUserActivation = Navigator & { userActivation?: { isActive: boolean } };

/**
 * Whether a save started right now would still be allowed to reach the user. Only Chromium reports
 * this; Safari does not, and there it answers `true` — the elapsed-time half of
 * {@link startActivationWindow} is what covers that gap.
 */
function hasUserActivation(): boolean {
  const activation = (navigator as WithUserActivation).userActivation;
  return activation ? activation.isActive : true;
}

/**
 * Call this at the top of the handler the tap fired, before anything slow. The predicate it returns
 * answers whether a save started *now* would still reach the user, so a caller that had to render
 * first can ask for a second tap instead of handing bytes to a browser that will drop them.
 */
export function startActivationWindow(): () => boolean {
  const startedAt = performance.now();
  return () => performance.now() - startedAt <= ACTIVATION_WINDOW_MS && hasUserActivation();
}

function withBlobUrl<T>(blob: Blob, consume: (url: string) => T): T {
  const url = URL.createObjectURL(blob);
  // Revoking right after the click races the browser's own read of the URL: neither the download
  // nor the new tab has necessarily started yet.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return consume(url);
}

function isDomError(err: unknown, name: string): boolean {
  return err instanceof DOMException ? err.name === name : (err as Error | null)?.name === name;
}

/** `null` when this browser cannot share the file at all, so the caller moves on to the next path. */
async function shareFile(file: File): Promise<SaveOutcome | null> {
  if (typeof navigator.share !== "function") return null;
  if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) return null;
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (err) {
    // A dismissed sheet is a finished save, not a failure to retry through another path
    if (isDomError(err, "AbortError")) return "cancelled";
    if (isDomError(err, "NotAllowedError")) throw new NeedsGestureError();
    return null;
  }
}

/** `null` on browsers without the `download` attribute — Safari 12 and the older iPads. */
function downloadViaAnchor(blob: Blob, filename: string): SaveOutcome | null {
  if (!("download" in HTMLAnchorElement.prototype)) return null;
  return withBlobUrl(blob, (url) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "downloaded";
  });
}

function openInTab(blob: Blob): SaveOutcome {
  return withBlobUrl(blob, (url) => {
    const opened = window.open(url, "_blank");
    // A blocked popup is the gesture running out by another name
    if (!opened) throw new NeedsGestureError();
    return "opened";
  });
}

/**
 * Gets `blob` to the user by the best route this browser has.
 *
 * Must be called from a task that still has user activation — see {@link startActivationWindow} if
 * anything slow happened since the tap. Throws {@link NeedsGestureError} when the gesture turns out
 * to be gone anyway, which is the caller's cue to ask for another tap rather than report an error.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveOutcome> {
  return (
    downloadViaAnchor(blob, filename) ??
    (await shareFile(new File([blob], filename, { type: blob.type || "application/octet-stream" }))) ??
    openInTab(blob)
  );
}
