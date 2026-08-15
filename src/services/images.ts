/**
 * Dropping an image on a card: compress it to WebP in the browser, then upload it to the board's
 * image API (`server/file.ts`), which stores it under `data/images` and serves it back by URL.
 *
 * The compression is done here rather than on the server so the board needs no image library —
 * every browser that can show a card can also encode a canvas to WebP. It also means the wire
 * carries the small file, not the 8 MB one off a phone.
 *
 * Lives in the board rather than in one module repo because the contract is the board's: any
 * component, in any repo, uploads the same way (`@services/images`).
 */

const ENDPOINT = "/api/images";

export type StoredImage = {
  /** Stored file name, the digest of its own bytes */
  name: string;
  /** Where the card points its `<img>` — this is all a layout keeps */
  url: string;
  bytes: number;
  /** What was actually stored: `image/webp`, unless the browser could not encode it */
  type: string;
};

export type CompressOptions = {
  /** 0–1, passed to the WebP encoder. Default 0.85. */
  quality?: number;
  /** Longest edge in px; a larger image is scaled down first. 0 keeps the original size. Default 2560. */
  maxSize?: number;
};

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/**
 * Safari only grew `createImageBitmap` for blobs in 15, and the board is opened on older iPads, so
 * an `<img>` decode stands behind it. `imageOrientation` is what keeps a phone photo upright —
 * EXIF rotation is dropped the moment the pixels reach a canvas, and the fallback path gets it from
 * the browser's own orientation handling for `<img>`.
 */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // falls through to the <img> path below
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("could not read that image"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The image as WebP, scaled to fit `maxSize`. Falls back to the original file when the browser
 * cannot encode WebP — `toBlob` silently hands back a PNG in that case, which the server would
 * store as an unshrunk copy of a re-encoded picture; the original is both smaller and truer.
 */
export async function compressToWebp(
  file: Blob,
  { quality = 0.85, maxSize = 2560 }: CompressOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const image = await decode(file);
  try {
    const longest = Math.max(image.width, image.height);
    const scale = maxSize > 0 && longest > maxSize ? maxSize / longest : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("could not draw that image");
    ctx.drawImage(image.source, 0, 0, width, height);

    const webp = await toBlob(canvas, "image/webp", quality);
    if (webp?.type === "image/webp") return { blob: webp, width, height };
    return { blob: file, width: image.width, height: image.height };
  } finally {
    image.close();
  }
}

/** Sends the bytes as they are; the server names the file after their digest and hands back its URL. */
export async function uploadImage(blob: Blob): Promise<StoredImage> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `upload failed (${res.status})`);
  }
  return (await res.json()) as StoredImage;
}

/** `240 KB` — for a card that wants to say how big the picture it is holding turned out. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
