import { vi } from 'vitest';

// Replaces window.fetch with a tiny router so components talk to a fake API. `routes` maps
// "METHOD /path-prefix" to a handler (request) => [status, body]. Every request is recorded.
export function fakeApi(routes) {
  const calls = [];
  const fetch = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = url.replace(/^\/api/, '');
    const request = { method, path, headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : undefined };
    calls.push(request);
    const key = Object.keys(routes)
      .filter((k) => {
        const [m, prefix] = k.split(' ');
        return m === method && path.startsWith(prefix);
      })
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return new Response(JSON.stringify({ message: `no fake for ${method} ${path}` }), { status: 500 });
    const [status, body] = routes[key](request);
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetch);
  return calls;
}
