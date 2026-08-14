/**
 * Reading a component's own `data/` folder over the board's data API (`server/data.ts`), which
 * serves the `.json`/`.txt`/`.csv` files a fetch script writes there.
 *
 * The alternative is `import.meta.glob`, which resolves at build time: a fetch that ran after the
 * board was built is invisible until the next build, and every file kept on disk is bundled whether
 * it is looked at or not. Read through here instead, a card sees the folder as it is now, so
 * `fetch.sh` — or the board's Refresh button, which runs the same script — is enough on its own.
 *
 * Lives in the board rather than in one module repo because the contract is the board's: any
 * module, in any repo, reaches its own data the same way (`@services/data`).
 */

const BASE = "/api/data";

/** Every `.json`/`.txt`/`.csv` file in the component's data folder, sorted by name. Empty when the
 *  folder is not there yet, which is what a board that has never fetched looks like. */
export async function listData(module: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(module)}`);
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { files?: unknown } | null;
  return Array.isArray(body?.files) ? body.files.filter((name): name is string => typeof name === "string") : [];
}

/** One JSON file, or null when it is missing or unreadable — a card says "no data yet" rather than
 *  throwing on a folder a fetch has not filled in. */
export async function loadJson<T>(module: string, file: string): Promise<T | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(module)}/${encodeURIComponent(file)}`);
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** One `.txt`/`.csv` file as it sits on disk, or null when it is missing. */
export async function loadText(module: string, file: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(module)}/${encodeURIComponent(file)}`);
  if (!res.ok) return null;
  return res.text().catch(() => null);
}

/** The `YYYY-MM-DD.json` files a per-day fetch has written, newest first. */
export function datesFrom(files: string[]): string[] {
  return files
    .map((name) => name.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter((date): date is string => !!date)
    .sort()
    .reverse();
}
