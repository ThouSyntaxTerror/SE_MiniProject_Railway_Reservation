# Code and branch coverage report — Team E15

Measured on the backend (`backend/src`), the code that holds every business rule. Run on
24 November 2026 with Node 24.22.1, PostgreSQL 18.6 (a local embedded server; CI uses PostgreSQL 16)
and Jest 29 using the V8 coverage provider.
The frontend is measured separately with Vitest in [`FRONTEND_TEST_REPORT.md`](FRONTEND_TEST_REPORT.md)
(PR #42: 57 tests, 99.42 % statements, 94.57 % branches); before that PR it had no automated tests and
relied on the keyboard and browser matrix in [`evidence/nfr05-nfr06/RESULTS.md`](evidence/nfr05-nfr06/RESULTS.md).

## Current figures (`main` after PRs #36 to #43)

| Suite | Tests | Statements | Branches | Functions | Raw output |
|---|---|---|---|---|---|
| Backend (Jest) | 116 passed, 12 files | **98.07 %** (916 / 934) | **94.14 %** (241 / 256) | 94.28 % | [`evidence/coverage/main-after-merges.txt`](evidence/coverage/main-after-merges.txt) |
| Frontend (Vitest) | 57 passed, 5 files | **99.42 %** (861 / 866) | **94.57 %** (209 / 221) | 98.68 % | [`evidence/frontend-tests/vitest-coverage.txt`](evidence/frontend-tests/vitest-coverage.txt) |

The backend branch figure is slightly below the 94.51 % measured when the failure-path tests were
added, because the later lockout and cancellation changes (#39, #40) added new branches as well as
the tests for them; every route and service is still at 100 % statements and lines. The sections
below record how the backend figure was raised from 85 % in the first place.

## Result of the failure-path work (PR #36)

| Measure | Before | After | Change |
|---|---|---|---|
| Statements | 93.74 % | **97.95 %** (861 / 879) | +4.21 |
| **Branches** | 85.29 % | **94.51 %** (224 / 237) | +9.22 |
| Functions | 91.17 % | **94.11 %** (32 / 34) | +2.94 |
| Lines | 93.74 % | **97.95 %** (861 / 879) | +4.21 |
| Tests | 57 passed | **94 passed** (10 suites) | +37 |

"Before" is `main` at `84669d6`. "After" adds two test files (`bookingFailurePaths.test.js`,
`errorPaths.test.js`). Raw output of both runs is in
[`evidence/coverage/`](evidence/coverage/) (`before-coverage.txt`, `after-coverage.txt`).

## Reproduce

```
cd backend
npm run test:coverage        # text table, summary and an HTML/lcov report in backend/coverage/
```

`test:coverage` runs the same `jest --runInBand` suite as `npm test` with coverage switched on;
the settings live in the `jest` block of `backend/package.json`.

## Per-file coverage after the new tests (PR #36 run)

| File | Statements | Branches | Functions | Lines | Not covered |
|---|---|---|---|---|---|
| `app.js` | 100 | 100 | 100 | 100 | |
| `paymentSimulator.js` | 100 | 100 | 100 | 100 | |
| `server.js` | 0 | 0 | 0 | 0 | whole file (process start-up) |
| `db/migrate.js` | 81.81 | 60 | 50 | 81.81 | lines 6–12, 60–64 (command-line entry) |
| `db/pool.js` | 100 | 0 | 100 | 100 | line 5 (default connection string) |
| `middleware/auth.js` | 100 | 100 | 100 | 100 | |
| `middleware/errors.js` | 100 | 100 | 100 | 100 | |
| `routes/admin.js` | 100 | 100 | 100 | 100 | |
| `routes/auth.js` | 100 | 100 | 100 | 100 | |
| `routes/bookings.js` | 100 | 100 | 100 | 100 | |
| `routes/trips.js` | 100 | 100 | 100 | 100 | |
| `services/adminService.js` | 100 | 96.15 | 100 | 100 | `finally` blocks at 109, 171; default at 203 |
| `services/auditService.js` | 100 | 100 | 100 | 100 | |
| `services/authService.js` | 100 | 93.93 | 100 | 100 | defaults at 8 and 53 |
| `services/bookingService.js` | 100 | 95.55 | 100 | 100 | `finally` blocks at 112, 193 |
| `services/trainSearchService.js` | 100 | 100 | 100 | 100 | |

Every route and every service now has 100 % statement and line coverage.

On `main` today two of these rows have moved because #39 and #40 changed those files:
`authService.js` is at 91.66 % branches (not taken: the bcrypt-cost default at line 8, the `|| []`
fallback for a row with no failure list at 33, a `finally` at 60, and the empty-password default
at 109) and `bookingService.js` at 95.91 % (`finally` blocks at 112 and 199). Statements and lines
are still 100 % for both.

## What was added, and why

Before this work the gaps were all failure paths: the code that handles bad input or a database
that fails part-way through a transaction. Those are the paths the requirements care most about
(a failed payment or a lost race must never leave a half-made booking), and a real database will
not fail on demand, so the new tests inject a fake connection.

| Gap found in the baseline | Test that closes it | Requirement |
|---|---|---|
| Booking without a trip id or `Idempotency-Key` header was never tried | `bookingFailurePaths.test.js` › booking input validation (3 tests) | FR-05 |
| `40001`, `40P01` and the one-confirmed-seat unique violation were never mapped to 409 | › database failures during booking (6 tests): each is `409 SEAT_UNAVAILABLE`, an unrelated driver error is not disguised, a failed `ROLLBACK` does not hide the real error | NFR-03 |
| Cancel with a bad id, or a driver error mid-cancel, never ran the rollback branch | › database failures during cancellation (6 tests) | FR-07, SEC-01 |
| Audit rows with no actor or request id | › audit events (1 test): stored with `NULL`, not an error | FR-09 |
| Central error handler's "unknown error" branch | `errorPaths.test.js` › central error handler (2 tests): any non-`AppError` becomes a generic 500 with no SQL, table name or stack in the body | design §3.4 |
| Search with missing or malformed filters | › search input validation (5 tests) | FR-03 |
| Sign-in with no email or password | › sign-in input validation (3 tests): same generic 401 as a wrong password | FR-02 |
| Admin trip list, missing field on create, disable of an unknown trip, failed create | › administrator error paths (10 tests) | FR-08 |

## What is still not covered, and why

| Not covered | Reason | Is it a risk? |
|---|---|---|
| `server.js` | It only calls `listen()` on a port. Its behaviour is checked by running the real server: the restart test (NFR-04, 691 ms to healthy) and the load test. | No, three lines |
| `db/migrate.js` 6–12, 60–64 | The command-line entry (`npm run migrate`). The schema and seed code it calls is covered by `migration.test.js`. | Low |
| `db/pool.js` line 5 | The fallback connection string, used only when `DATABASE_URL` is unset. Tests always set it. | No |
| `authService.js` line 8 | The default bcrypt cost of 12. Tests deliberately set it to 4 for speed (`tests/setupEnv.js`); production uses 12. | Low, noted in `setupEnv.js` |
| `finally` and default-value branches (`adminService`, `bookingService`) | V8 counts the implicit "no exception" path of a `finally` as a branch. Both outcomes of the `try` are exercised by the tests above. | No |
| Frontend (`frontend/src`) | Not measured by Jest. Covered by its own Vitest suite (PR #42, see `FRONTEND_TEST_REPORT.md`) and the browser matrices. | None once #42 is merged |

## What coverage does and does not prove

94.5 % branch coverage means almost every decision in the backend was taken both ways by some
test. It does not prove the tests assert the right things. The tests that matter most for
correctness check outcomes directly (one confirmed booking out of 20 simultaneous attempts,
refund recorded exactly once, no booking row after a failed payment) rather than just reaching a
line.
