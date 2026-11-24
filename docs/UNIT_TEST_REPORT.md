# Unit and integration test report — Team E15

All automated tests live in `backend/tests/` and run with `cd backend && npm test`
(Jest 29 + Supertest, `--runInBand`, against a real PostgreSQL 16; CI runs the same command on every
pull request). The suite is **94 tests in 10 files, 94 passed**, run on 24 November 2026.

"Unit" here means one service or route exercised through its public interface with a real database
underneath. The payment provider is the built-in deterministic simulator, and in the two
failure-path files (`bookingFailurePaths.test.js`, `errorPaths.test.js`) the database connection is
replaced by a fake that throws, to force driver errors a real server will not produce on demand.

## Results by file

| File | Tests | Passed | What it checks | Requirements |
|---|---|---|---|---|
| `auth.test.js` | 11 | 11 | Registration with name (trimmed, required), 12-character minimum password, duplicate email (also with different case or spaces), hash-only storage, generic error for unknown account and wrong password, session token on success, sign-ins audited without passwords, sixth attempt rejected for 15 minutes | FR-01, FR-02, FR-09, SEC-02, SEC-04 |
| `search.test.js` | 4 | 4 | Only matching trips ordered by departure, on-or-after the requested date, case-insensitive and disabled trips ignored, missing filter is a 400 | FR-03 |
| `availability.test.js` | 3 | 3 | N seats reports N unreserved; sold-out reports zero, never negative; unknown and disabled trips rejected | FR-04 |
| `booking.test.js` | 4 | 4 | A retried `Idempotency-Key` returns the original booking; 409 once every seat is confirmed; a failed payment releases the hold and creates no confirmed booking; a passenger sees only their own bookings | FR-05, FR-06, NFR-03 |
| `bookingFailurePaths.test.js` | 16 | 16 | Missing trip id or key; serialization, deadlock and unique-index errors become 409; unrelated driver errors are not disguised; rollback failure does not hide the real error; invalid cancel ids; audit with no actor | FR-05, FR-07, NFR-03, FR-09 |
| `cancellation.test.js` | 9 | 9 | Owner cancels before departure and gets a refund reference; seat is released and rebookable; repeat cancel is 409 with no second refund; cancel after departure is 409 and the booking stays confirmed; non-owner cannot cancel; unknown or malformed ids are 404 and unauthenticated calls 401; a failed refund is recorded but the booking stays cancelled; two concurrent cancels give one success and one refund; every outcome is audited | FR-07, SEC-01, FR-09 |
| `admin.test.js` | 19 | 19 | Passenger gets 403 on every admin route; create, edit, disable; capacity cannot shrink below a confirmed seat; audit trail; 20 simultaneous bookings confirm exactly one; field validation and trimming | FR-08, FR-09, SEC-01, NFR-03 |
| `errorPaths.test.js` | 21 | 21 | Central error handler leaks nothing; search and sign-in validation; admin list, missing field, unknown trip, failed create with rollback | design §3.4, FR-02, FR-03, FR-08 |
| `security.test.js` | 5 | 5 | Expired session rejected; token valid before expiry and rejected after sign-out (replay); missing or malformed token rejected without detail; access control enforced on the server; no password in responses or audit rows | SEC-01, SEC-02, SEC-03 |
| `migration.test.js` | 2 | 2 | Demo seed never promotes an existing passenger who owns the admin email; creates the demo admin only when the email is absent | SEC-01, FR-01 |
| **Total** | **94** | **94** | | |

Coverage of this suite is in [`CODE_BRANCH_COVERAGE_REPORT.md`](CODE_BRANCH_COVERAGE_REPORT.md):
97.95 % statements, 94.51 % branches.

## Traceability to the ten test cases

The ten cases in Test Plan §5.2 map to these files; see
[`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md) for each case's verdict.

| Case | Files |
|---|---|
| TC-01, TC-02 | `auth.test.js` |
| TC-03 | `search.test.js`, `availability.test.js` |
| TC-04, TC-05 | `booking.test.js`, `bookingFailurePaths.test.js` |
| TC-06 | `cancellation.test.js` |
| TC-07, TC-08 | `admin.test.js` |
| TC-09 | `security.test.js`, `migration.test.js` (HTTPS part is not a unit test; see the execution report) |
| TC-10 | non-functional: load script and the browser matrix, not Jest |

## Defects the added tests would have caught

No new defect was found while writing the failure-path tests, and none was hidden: every test
passed against the code on `main` without changes to `backend/src`. The value of the new tests is
that these behaviours are now protected against future changes, not that a bug was fixed.
