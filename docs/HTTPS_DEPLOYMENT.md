# HTTPS deployment for SEC-03

SEC-03 requires that all authenticated API traffic use HTTPS. The app itself speaks HTTP and
sits behind a TLS-terminating reverse proxy in the test deployment; this is the standard
arrangement described in SAD §2.4 ("HTTPS terminates before the API").

## Local / demo deployment (Caddy)

`deploy/Caddyfile` terminates TLS and proxies `/api` and `/health` to the Express API.

```bash
# 1. API
cd backend && npm start                    # http://localhost:3000

# 2. Frontend
cd frontend && npm run dev                 # http://localhost:5173

# 3. TLS proxy (Caddy)
caddy run --config deploy/Caddyfile
```

Caddy issues a locally trusted certificate (`tls internal`) for `rrs.localhost`, so the
browser and `curl` both see a valid HTTPS origin:

```bash
curl -k https://rrs.localhost/api/trips?origin=Bengaluru&destination=Chennai&date=2026-12-01
```

## Evidence for TC-09

1. Open DevTools → Network on `https://rrs.localhost` and confirm every `/api` request has
   scheme `https`.
2. `curl -sI https://rrs.localhost/health` shows the TLS handshake and `HTTP/2 200`.
3. Sign out, replay the previous bearer token with `curl` → `401 UNAUTHENTICATED`.
4. Idle for 30 minutes, reuse the token → `401 UNAUTHENTICATED` (sliding expiry, `authService.js`).

## Production notes

- Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` as environment variables, never in the repo.
- Keep `app.set('trust proxy', 1)` if the proxy terminates TLS and you later add secure cookies;
  sessions are bearer tokens today, so cookie flags do not apply.
- HSTS and redirect-to-HTTPS are enabled in the Caddyfile.
