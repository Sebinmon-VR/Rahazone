const TOKEN_KEY = 'rz_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Options = { method?: string; body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }

  const res = await fetch(`/api${path}`, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) { setToken(null); window.dispatchEvent(new Event('rz:logout')); }
    throw new ApiError(res.status, data?.error || res.statusText);
  }
  return data as T;
}

export function documentUrl(id: number, inline = false) {
  return `/api/documents/${id}/download?token=${encodeURIComponent(getToken() || '')}${inline ? '&inline=1' : ''}`;
}
