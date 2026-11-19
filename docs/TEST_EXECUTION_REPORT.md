# Test execution report — Team E15

Build under test: Sprint 2 integration (`feat/fr08-admin` + `feat/fr01-fr03-passenger` +
`feat/fr05-fr07-cancellation` + `test/security-recovery` + `test/fr04-availability`).
Environment: Node 22 (CI) / Node 26 (local), PostgreSQL 16, Chrome/Edge/Firefox (manual checks),
19 November 2026. Merged stack: `cd backend && npm test` — **49 tests, 49 passed, 7 suites** (verified on `integration/final`). This documents-only PR runs the foundation subset until the code PRs merge.

The cases below are the ten specifications from Test Plan §5.2. "Executed" records what was
actually run; the automated suite is executed by GitHub Actions on every pull request.

| Case | Requirement | Result | Evidence |
|---|---|---|---|
| TC-01 Registration and duplicate email | FR-01, SEC-02 | **PASS** | `auth.test.js` — creates account with name; duplicate returns 409 and count stays 1; hash-only storage |
| TC-02 Sign-in and failed attempts | FR-02, FR-09, SEC-02, SEC-04 | **PASS** | `auth.test.js` — generic 401 for unknown/wrong; 5 failures then 429 `ACCOUNT_LOCKED`; audit rows contain no password |
| TC-03 Search and availability | FR-03, FR-04 | **PASS** | `search.test.js`, `availability.test.js` — ordering, origin/destination match, on-or-after date, case-insensitive, sold-out 0 |
| TC-04 Successful booking | FR-05, FR-06, NFR-03 | **PASS** | `booking.test.js` — one confirmed booking, unique PNR, seat allocated, appears in owner history |
| TC-05 Payment failure and repeated submission | FR-05, NFR-03 | **PASS** | `booking.test.js` — 402 creates no booking and releases the seat; same Idempotency-Key returns one booking |
| TC-06 Booking ownership and cancellation | FR-06, FR-07, SEC-01 | **PASS** | `booking.test.js` — non-owner 404 without PNR; owner cancel returns `REF-…`; repeat cancel releases no second seat |
| TC-07 Administrator inventory and audit | FR-08, FR-09, SEC-01 | **PASS** | `admin.test.js` — passenger 403; admin create/edit/disable persists; audit has actor, time, action, outcome |
| TC-08 Concurrent final seat | FR-04, FR-05, NFR-03 | **PASS** | `admin.test.js` — 20 simultaneous bookings → exactly 1 confirmed, 19 × 409, unreserved 0 |
| TC-09 Security, session and restart | FR-09, SEC-02, SEC-03, NFR-04 | **PARTIAL — automated part PASS; HTTPS PENDING** | `security.test.js` (expiry, sign-out replay, malformed token, no plaintext) + restart run below. HTTPS is configured but has **not** been exercised on a deployed instance yet |
| TC-10 Performance, accessibility, compatibility | NFR-01, NFR-02, NFR-05, NFR-06 | **PARTIAL — NFR-01/02 PASS; NFR-05/06 NOT YET VERIFIED** | Load run below. Labels, focus styles and responsive CSS are implemented, but no named teammate has yet performed the keyboard and 3-browser × 2-viewport matrix |

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

## Manual checks — not yet verified

The automated suite covers every functional invariant above. The following are manual by nature;
they are **not claimed as passed** until the named owner performs them and records the result:

- [ ] Chrome, Edge, Firefox at 375 px and 1280 px: no horizontal scroll of primary forms (Affan)
- [ ] Keyboard-only registration → search → booking → cancel (Affan)
- [ ] DevTools shows `https` for `/api` requests under Caddy (Atharv)
- [ ] 30-minute idle expiry observed on the deployed instance (Atharv)
