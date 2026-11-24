# Test execution report — Team E15

Build under test: Sprint 2 integration (`feat/fr08-admin` + `feat/fr01-fr03-passenger` +
`feat/fr05-fr07-cancellation` + `test/security-recovery` + `test/fr04-availability`).
Environment: Node 22 (CI) / Node 26 (local), PostgreSQL 16, Chrome/Edge/Firefox (manual checks),
19 November 2026. Merged stack: `cd backend && npm test` — **127 tests, 127 passed, 13 suites**, 98.12 % statements and 94.56 % branches (24 November 2026, after PR #44; it was 55 tests in 8 suites on `integration/final` on 19 November and 57 on `main` before those PRs). Frontend: `cd frontend && npm test` — **64 tests, 64 passed**. Per-file breakdown: [`UNIT_TEST_REPORT.md`](UNIT_TEST_REPORT.md) and [`FRONTEND_TEST_REPORT.md`](FRONTEND_TEST_REPORT.md); coverage method and before/after: [`CODE_BRANCH_COVERAGE_REPORT.md`](CODE_BRANCH_COVERAGE_REPORT.md); live checks on a running instance: [`SYSTEM_TEST_REPORT.md`](SYSTEM_TEST_REPORT.md).

The cases below are the ten specifications from Test Plan §5.2. "Executed" records what was
actually run; the automated suite is executed by GitHub Actions on every pull request.

| Case | Requirement | Result | Evidence |
|---|---|---|---|
| TC-01 Registration and duplicate email | FR-01, SEC-02 | **PASS** | `auth.test.js` — creates account with name; duplicate returns 409 and count stays 1; hash-only storage |
| TC-02 Sign-in and failed attempts | FR-02, FR-09, SEC-02, SEC-04 | **PASS** | `auth.test.js` — generic 401 for unknown/wrong; 5 failures then 429 `ACCOUNT_LOCKED`; audit rows contain no password |
| TC-03 Search and availability | FR-03, FR-04 | **PASS** | `search.test.js`, `availability.test.js` — ordering, origin/destination match, on-or-after date, case-insensitive, sold-out 0 |
| TC-04 Successful booking | FR-05, FR-06, NFR-03 | **PASS** | `booking.test.js` — one confirmed booking, unique PNR, seat allocated, appears in owner history |
| TC-05 Payment failure and repeated submission | FR-05, NFR-03 | **PASS** | `booking.test.js` — 402 creates no booking and releases the seat; same Idempotency-Key returns one booking |
| TC-06 Booking ownership and cancellation | FR-06, FR-07, SEC-01 | **PASS** | `cancellation.test.js` — non-owner 404 without PNR; owner cancel returns `RFND-<PNR>`; repeat cancel releases no second seat; `cancellationRecord.test.js` — reference kept on the booking |
| TC-07 Administrator inventory and audit | FR-08, FR-09, SEC-01 | **PASS** | `admin.test.js` — passenger 403; admin create/edit/disable persists; audit has actor, time, action, outcome |
| TC-08 Concurrent final seat | FR-04, FR-05, NFR-03 | **PASS** | `admin.test.js` — 20 simultaneous bookings → exactly 1 confirmed, 19 × 409, unreserved 0 |
| TC-09 Security, session and restart | FR-09, SEC-02, SEC-03, NFR-04 | **PASS** (HTTPS exercised through a local TLS proxy) | `security.test.js` (expiry, sign-out replay, malformed token, no plaintext) + restart run below. HTTPS was exercised end to end through a self-signed TLS reverse proxy on `127.0.0.1:8443` → API `4000` — the same TLS-termination arrangement `deploy/Caddyfile` configures: `/health`, `POST /api/sessions`, authenticated `GET /api/bookings`, and an expired-token `401` all over `https://`. The 30-minute inactivity limit was verified from the session TTL plus the expired-token `401`, not by waiting 30 minutes |
| TC-10 Performance, accessibility, compatibility | NFR-01, NFR-02, NFR-05, NFR-06 | **PASS (NFR-05/06 headless, one machine)** | Load run below. Keyboard workflow and 3-browser × 2-viewport matrix executed by Affan; one defect (D-07, My bookings overflow at 375 px) fixed and re-run clean. Not covered: real screen reader, physical phone, admin pages |

## Measured non-functional results

Executed 19 November 2026 against the seeded database (10,000 trips).

| Requirement | Command | Result |
|---|---|---|
| NFR-01 | `npm run test:load -- --base http://localhost:3000 --searches 200` | 200/200 HTTP 200, **p95 301.3 ms** (≤ 2000 ms) |
| NFR-02 | same run, `--bookings 100` | 100/100 HTTP 201, **p95 455.6 ms** (≤ 3000 ms) |
| NFR-03 | `admin.test.js` concurrency case | 1 confirmed, 0 seats remaining, never negative |
| NFR-04 | kill API → start API → poll `/health` | **691 ms** to health; booking `8520D040` still `confirmed` |

## Defects found and fixed during Sprint 2

| ID | Defect | Fix |
|---|---|---|
| D-01 | FR-01: registration accepted no name | `users.name`, service validation, UI field, tests |
| D-02 | FR-03: search matched the exact date instead of on-or-after | `departure_utc >= $3::date` + index |
| D-03 | FR-07/FR-08: endpoints absent | cancellation and admin services/routes/UI |
| D-04 | SEC-04: no lockout | `failed_attempts` + `locked_until`, 429, audit |
| D-05 | Admin audit view missing | `GET /api/admin/audit` + UI table |
| D-06 | Tables overflowed at 375 px | `.table-wrap` scroll container + focus styles |

No critical or high defect remains open.

## Manual checks

The automated suite covers every functional invariant above. The following are manual by nature;
each is recorded as passed only where the named owner performed it and recorded the result:

- [x] Chrome 157, Edge 157, Firefox 160 at 375 px and 1280 px: no horizontal scroll (Affan; automated-driven, headless; defect D-07 on My bookings found and fixed; see `docs/evidence/nfr05-nfr06/RESULTS.md`)
- [x] Keyboard-only registration → search → booking → cancel (Affan; 23/23 steps in all three browsers; see `docs/evidence/nfr05-nfr06/RESULTS.md`)
- [x] Both checks re-run on the redesigned UI (PR #31): keyboard 27/27 steps and no-overflow 8/8 pages in each of Chrome 157, Edge 157, Firefox 160; no unnamed controls (see "Re-run on the redesigned UI" in `docs/evidence/nfr05-nfr06/RESULTS.md`)
- [x] HTTPS for `/api` requests (owner: Atharv; executed locally during the final run): exercised through a local self-signed TLS reverse proxy (Node, `https://127.0.0.1:8443` → API `4000`) — the same TLS-termination arrangement `deploy/Caddyfile` configures. `/health`, `POST /api/sessions`, authenticated `GET /api/bookings` and an expired-token `401` were all served over TLS; Caddy itself is not installed and no cloud instance was deployed (see D-04)
- [x] 30-minute inactivity expiry (owner: Atharv; executed locally during the final run): verified without waiting — `expires_at - now()` was **`00:29:59.96`** immediately after login, and moving that session's `expires_at` five minutes into the past made the same token return **`401 UNAUTHENTICATED`** on subsequent requests
