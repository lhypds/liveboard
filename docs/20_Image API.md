Image API
=========


A card that holds a picture — `basic/Image` is the first — stores it on the
board rather than in the layout. `POST /api/images` takes the bytes and answers
with a URL; `GET /api/images/<name>` serves them back.

`server/file.ts` is the Vite plugin behind it. `vite.config.ts` registers it
for the dev server and for `vite preview`, which is what a production board runs
under pm2, so it answers the same in both.


Why not keep the picture in the card
------------------------------------

A board is saved as JSON — to localStorage, to the user's `layout.json` through
the Profile modal, and to a file through Export/Import. A data URL of a photo
would be carried in full through every one of those, on every save. A 2 MB
picture is a 2.7 MB base64 string sitting in a config that is rewritten each
time a card moves.

Stored through this instead, the picture lives on disk once and the layout keeps
a link, so a board with twenty images is the same size as a board with none.


Endpoints
---------

```
POST /api/images            store one, body = the raw image bytes
GET  /api/images/<name>     return one
```

```
$ curl --data-binary @cat.webp -H 'Content-Type: image/webp' localhost:4173/api/images
{"name":"47af1e2be55128fe403c26e8e679ad82.webp","url":"/api/images/47af1e2be55128fe403c26e8e679ad82.webp","bytes":28198,"type":"image/webp"}
```

The name is 32 hex characters of the bytes' own SHA-256 plus the format. Being
content-addressed buys two things: the same picture dropped on two cards is
stored once, and the URL is served
`Cache-Control: public, max-age=31536000, immutable` — a name never points at
different bytes than it did before.

`.webp`, `.png`, `.jpg`, `.gif` and `.avif`, decided by the bytes' own magic
number, never by the request's `Content-Type` — whatever is written here is
served back with a type attached, so the bytes have to say what they are
themselves. Anything else is refused, which is also what stops the folder being
used as a general file drop.

| Status | When                                                             |
|--------|------------------------------------------------------------------|
| 400    | a stored name that is not `<32 hex>.<format>`                     |
| 404    | no such image                                                     |
| 405    | anything other than `POST /api/images` or `GET`/`HEAD` on a name  |
| 413    | over 20 MB                                                        |
| 415    | the bytes are not one of the formats above                        |

Files land in `data/images/`, beside `data/users/`, and are gitignored the same
way.


Compression
-----------

The bytes arriving at the server are already WebP: `@services/images`
(`src/services/images.ts`) is the browser side, and it compresses before it
uploads.

```ts
compressToWebp(file, { quality, maxSize })   // { blob, width, height }
uploadImage(blob)                            // { name, url, bytes, type }
formatBytes(n)                               // "28 KB"
```

`compressToWebp` decodes the file, scales it so its longest edge is at most
`maxSize`, draws it to a canvas and encodes that at `quality`. A 3000x2000 PNG
of 1.4 MB comes out 2560x1707 and 28 KB.

Doing it in the browser is what keeps the board free of an image library — every
browser that can show a card can encode a canvas to WebP — and it means the wire
carries the small file rather than the 8 MB one off a phone. Two details the
canvas needs help with are handled there: the decode asks for
`imageOrientation: "from-image"`, or a phone photo lands on its side, and a
browser too old to encode WebP silently hands back a PNG, so the original file
is uploaded untouched instead of a re-encoded, unshrunk copy.

If a board ever needs transcoding the browser cannot do — an HEIC drop, say —
that is the point at which the server would grow an image library. Nothing else
about the contract would change.


Using it in a new component
---------------------------

1. Take the file from a drop (`e.dataTransfer.files[0]`) or a file input.
2. `compressToWebp` then `uploadImage`.
3. Save the returned `url` into the card's `comp` through `config._save` — the
   URL and the dimensions, not the bytes.

`basic/Image` is the whole pattern, in about 150 lines.


Notes
-----

- **Nothing is deleted.** Removing a picture from a card clears the card's URL
  and leaves the file: it is named after its own bytes, so another card may be
  pointing at the same one, and dropping it again costs nothing. A board that
  churns through images accumulates files nobody looks at; there is no GC yet.
- **Not private.** Anyone who can reach the board can read any image on it — the
  names are unguessable, but they are also in the layout JSON.
