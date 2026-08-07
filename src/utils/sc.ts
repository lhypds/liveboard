export type ScAccount = {
  username: string;
  /** The JWT simple-ai issued at login; empty until a login succeeds */
  token: string;
};

const EMPTY: ScAccount = { username: "", token: "" };

// One record for the whole board rather than one per liveboard user, so a card
// can read the credential without knowing who is signed in
const KEY = "liveboard:sc:auth";

/**
 * Earlier builds kept the record under `liveboard:sc:<liveboard user>`. Returns
 * the first one found and clears them all, so a token saved before the change
 * moves across instead of being orphaned.
 */
function takeLegacy(): string | null {
  let found: string | null = null;
  for (const name of Object.keys(localStorage)) {
    if (name === KEY || !name.startsWith("liveboard:sc:")) continue;
    found ??= localStorage.getItem(name);
    localStorage.removeItem(name);
  }
  return found;
}

export function getScAccount(): ScAccount {
  try {
    let stored = localStorage.getItem(KEY);
    if (stored === null) {
      stored = takeLegacy();
      if (stored !== null) localStorage.setItem(KEY, stored);
    }
    if (!stored) return EMPTY;
    const { username, token } = JSON.parse(stored) as Partial<ScAccount>;
    return { username: username ?? "", token: token ?? "" };
  } catch {
    return EMPTY;
  }
}

export function setScAccount(account: ScAccount) {
  localStorage.setItem(KEY, JSON.stringify(account));
}

export function clearScAccount() {
  localStorage.removeItem(KEY);
}

/**
 * Logs in through the board's own server: simple-ai returns the token as an
 * HttpOnly cookie for its own origin, so only the server can read it out.
 * Resolves with the token; rejects with the message simple-ai gave.
 */
export async function loginSc(username: string, password: string): Promise<string> {
  const res = await fetch("/api/sc/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.token;
}
