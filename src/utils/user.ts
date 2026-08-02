export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

const userPath = (username: string) => encodeURIComponent(username);

export const userExists = (username: string) =>
  request<{ exists: boolean }>(`/api/users/${userPath(username)}`).then((r) => r.exists);

/** Creates data/users/<username> on the server when it doesn't exist yet */
export const login = (username: string) =>
  request<{ ok: boolean; username: string }>(`/api/users/${userPath(username)}/login`, { method: "POST" });

export const getLayout = (username: string) => request<unknown>(`/api/users/${userPath(username)}/layout`);

export const putLayout = (username: string, layout: unknown) =>
  request(`/api/users/${userPath(username)}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
