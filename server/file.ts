import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { ServerResponse } from "http";
import type { Connect, Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "data", "images");

/** A card drops a compressed WebP, so this is a ceiling on a mistake (a RAW file, a video), not a
 *  size the board expects to see. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** What the folder can hold, and the type each is served back as. WebP is what the browser encodes
 *  before uploading; the rest are the fallbacks it hands over untouched when it cannot. */
const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  avif: "image/avif",
};

/** Content-addressed: 32 hex characters of the bytes' own digest, plus the sniffed extension. */
const STORED_NAME_RE = new RegExp(`^[0-9a-f]{32}\\.(${Object.keys(CONTENT_TYPES).join("|")})$`);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * The format the bytes actually are, or null when they are not an image this folder holds. The
 * request's own Content-Type is never trusted for this: whatever is written here is served back
 * with a type attached, so the bytes have to say what they are themselves.
 */
function sniffExtension(buf: Buffer): string | null {
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "png";
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 6 && ["GIF87a", "GIF89a"].includes(buf.toString("latin1", 0, 6))) return "gif";
  if (buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp" && ["avif", "avis"].includes(buf.toString("latin1", 8, 12))) {
    return "avif";
  }
  return null;
}

function readBody(req: Connect.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const middleware: Connect.NextHandleFunction = async (req, res, next) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const match = url.pathname.match(/^\/api\/images(?:\/([^/]+))?\/?$/);
  if (!match) return next();

  try {
    if (!match[1] && req.method === "POST") {
      let body: Buffer;
      try {
        body = await readBody(req, MAX_UPLOAD_BYTES);
      } catch {
        return sendJson(res, 413, { error: "image too large" });
      }

      const ext = sniffExtension(body);
      if (!ext) return sendJson(res, 415, { error: "not a supported image" });

      // The digest is the name, so the same picture dropped on two cards is stored once and the
      // URL can be cached forever — a name never points at different bytes than it did before.
      const name = `${createHash("sha256").update(body).digest("hex").slice(0, 32)}.${ext}`;
      await mkdir(IMAGES_DIR, { recursive: true });
      await writeFile(path.join(IMAGES_DIR, name), body);

      return sendJson(res, 200, { name, url: `/api/images/${name}`, bytes: body.length, type: CONTENT_TYPES[ext] });
    }

    if (match[1] && (req.method === "GET" || req.method === "HEAD")) {
      let name: string;
      try {
        name = decodeURIComponent(match[1]);
      } catch {
        return sendJson(res, 400, { error: "invalid image name" });
      }
      // The pattern has no separator and no dot beyond the extension, so a name that passes it
      // cannot address anything outside the folder.
      if (!STORED_NAME_RE.test(name)) return sendJson(res, 400, { error: "invalid image name" });

      let body: Buffer;
      try {
        body = await readFile(path.join(IMAGES_DIR, name));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        return sendJson(res, 404, { error: "image not found" });
      }

      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(name).slice(1)],
        // Content-addressed, so the bytes behind a name never change.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Images dropped on a card — `POST /api/images` stores one under `data/images`, `GET
 * /api/images/<name>` serves it back.
 *
 * A card holds only the URL this hands back, never the bytes: a board is saved as JSON (localStorage
 * and the user's `layout.json`), so a data URL of a photo would be carried in full through every
 * save, export and sync. The picture lives on disk once instead, and the layout keeps a link.
 *
 * Compression happens in the browser before the upload (`@services/images`): the bytes arriving here
 * are already WebP, which is why this needs no image library on the server. What arrives is written
 * as it is, after the bytes have been checked to really be an image.
 *
 * Registered for preview as well as dev because production serves through `vite preview` (pm2).
 */
export default function fileApiPlugin(): Plugin {
  return {
    name: "image-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
