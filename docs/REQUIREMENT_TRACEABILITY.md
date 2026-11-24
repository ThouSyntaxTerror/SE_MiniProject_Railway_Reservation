# Requirement traceability — Team E15

Every SRS identifier → implementation → test → status. Suite: 55 automated tests on the merged stack, all passing.

## Functional requirements

| ID | Implementation | Test | Status |
|---|---|---|---|
| FR-01 | `services/authService.js` (`register`), `pages/Register.jsx`, `users.name` | `auth.test.js` registration group | Met |
| FR-02 | `services/authService.js` (`login`), `routes/auth.js` | `auth.test.js` login group | Met |
| FR-03 | `services/trainSearchService.js` (`search`), `pages/Search.jsx` | `search.test.js` | Met |
| FR-04 | `services/trainSearchService.js` (`availability`) | `availability.test.js` | Met |
| FR-05 | `services/bookingService.js` (`book`), `paymentSimulator.js` | `booking.test.js` booking group | Met |
| FR-06 | `services/bookingService.js` (`listForUser`), `pages/MyBookings.jsx` | `booking.test.js` history case | Met |
| FR-07 | `services/bookingService.js` (`cancel`), `routes/bookings.js` | `cancellation.test.js` (9 tests) | Met |
| FR-08 | `services/adminService.js`, `routes/admin.js`, `pages/Admin.jsx` | `admin.test.js` | Met |
| FR-09 | `services/auditService.js`, all services, `GET /api/admin/audit` | `auth.test.js`, `booking.test.js`, `admin.test.js` | Met |

## Non-functional requirements

| ID | Implementation / evidence | Test | Status |
|---|---|---|---|
| NFR-01 | `trips_search_idx`, `scripts/seedPerformance.js`, `scripts/loadTest.js` | p95 301 ms / 10,000 trips | Met |
| NFR-02 | transactional booking, same load script | p95 456 ms | Met |
| NFR-03 | `FOR UPDATE SKIP LOCKED` + partial unique index | 20-way race test | Met |
| NFR-04 | DB-backed sessions/bookings, `/health`, `scripts/recoveryCheck.sh` | 691 ms, booking persisted | Met |
| NFR-05 | labels on every input, `aria-label` nav, `.sr-only`, focus-visible, skip link | keyboard matrix, `evidence/nfr05-nfr06/RESULTS.md` (27/27 steps in Chrome, Edge, Firefox; headless, one machine) | Met |
| NFR-06 | responsive CSS, `.table-wrap`, viewport meta | viewport matrix, `evidence/nfr05-nfr06/RESULTS.md` (8/8 pages, 3 browsers, 375 and 1280 px; headless, one machine) | Met |

## Security requirements

| ID | Implementation | Test | Status |
|---|---|---|---|
| SEC-01 | `requireRole('admin')`, ownership check in `cancel`, passenger-scoped history | `admin.test.js`, `booking.test.js`, `security.test.js` | Met |
| SEC-02 | bcryptjs adaptive salted hash (12 rounds), no password in response/audit | `auth.test.js`, `security.test.js` | Met |
| SEC-03 | 30-minute sliding session, delete on sign-out, Caddy TLS config | `security.test.js`, `docs/HTTPS_DEPLOYMENT.md` | Met (HTTPS verified in demo) |
| SEC-04 | `failed_attempts`, `locked_until`, 429, audit without password | `auth.test.js` lockout group | Met |

## Test Plan §5.2 coverage

TC-01 → FR-01, SEC-02 · TC-02 → FR-02, FR-09, SEC-02, SEC-04 · TC-03 → FR-03, FR-04 ·
TC-04 → FR-05, FR-06, NFR-03 · TC-05 → FR-05, NFR-03 · TC-06 → FR-06, FR-07, SEC-01 ·
TC-07 → FR-08, FR-09, SEC-01 · TC-08 → FR-04, FR-05, NFR-03 · TC-09 → FR-09, SEC-02,
SEC-03, NFR-04 · TC-10 → NFR-01, NFR-02, NFR-05, NFR-06.

Every FR, NFR and SEC identifier is covered by at least one automated test or a named manual
check; there are no untraced identifiers.

Clause-level mapping for FR-05, FR-07, SEC-04, NFR-05 and NFR-06 (including the clauses with no check):
[`AFFAN_TEST_TRACEABILITY.md`](AFFAN_TEST_TRACEABILITY.md).
