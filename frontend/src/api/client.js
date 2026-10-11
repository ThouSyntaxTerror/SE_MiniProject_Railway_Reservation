const TOKEN_KEY = 'rrs_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Talks only to the REST API, never the database directly, per the Web UI's responsibilities in
// the architecture doc.
export async function apiFetch(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}
