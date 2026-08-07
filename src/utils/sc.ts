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

/** Thrown when nothing has been signed in yet, so the caller can say so in its own words. */
export class NoScCredentialError extends Error {
  constructor() {
    super("no simple-ai credential");
    this.name = "NoScCredentialError";
  }
}

// simple-ai streams its answer as SSE, one `data:` frame per piece, and marks
// the non-content pieces with these sentinels. Newlines inside a content piece
// are escaped as ###RETURN### so a frame is always a single line.
const DONE = "[DONE]";
const ERR = "###ERR###";
const STATUS = "###STATUS###";
const MODEL = "###MODEL###";
const RETURN = "###RETURN###";

/**
 * simple-ai's edit endpoint refuses an empty content, but a card with nothing in
 * it yet is exactly when writing a first draft is most useful. Standing in a line
 * that says so keeps the one endpoint serving both — the model is being asked to
 * rewrite a blank page rather than being handed nothing at all.
 */
const EMPTY_CONTENT_SEED = "(This is empty. Write its first version from scratch.)";

export type GenerateEditRequest = {
  /** The text to rewrite; blank asks for a first draft */
  content: string;
  /** A standing description of what the content is — the card's own `prompt` config */
  instruct?: string;
  /** The one-off instruction the user typed: how to edit it */
  prompt: string;
  /** Called with the whole answer so far as it streams in */
  onText?: (text: string) => void;
  /** Called with simple-ai's progress notes ("Start generating...") */
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
};

/**
 * Rewrites `content` per `prompt`, through the board's own server (see server/sc.ts).
 * Resolves with the finished text; rejects with whatever simple-ai reported.
 */
export async function generateEdit({
  content,
  instruct,
  prompt,
  onText,
  onStatus,
  signal,
}: GenerateEditRequest): Promise<string> {
  const { token } = getScAccount();
  if (!token) throw new NoScCredentialError();

  const res = await fetch("/api/sc/generate/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: content.trim() ? content : EMPTY_CONTENT_SEED,
      instruct: instruct ?? "",
      prompt,
      token,
    }),
    signal,
  });

  // Anything that failed before the stream opened answers as JSON instead
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = false;

  const takeFrame = (frame: string) => {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data:")) continue;
      // Exactly one space follows `data:`; any further leading space belongs to the content
      const payload = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
      if (payload === DONE) {
        done = true;
      } else if (payload.startsWith(ERR)) {
        throw new Error(payload.slice(ERR.length));
      } else if (payload.startsWith(STATUS)) {
        onStatus?.(payload.slice(STATUS.length));
      } else if (payload.startsWith(MODEL)) {
        /* which model answered; the card doesn't show it */
      } else {
        text += payload.replaceAll(RETURN, "\n");
        onText?.(text);
      }
    }
  };

  try {
    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      // The last piece is whatever hasn't been terminated by a blank line yet
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) takeFrame(frame);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }

  return text;
}
