# Unit and integration test report — Team E15

All automated tests live in `backend/tests/` and run with `cd backend && npm test`
(Jest 29 + Supertest, `--runInBand`, against a real PostgreSQL (18.6 locally for this run, 16 in CI); CI runs the same command on every
pull request). The suite is **185 tests in 14 files, 185 passed** (24 November 2026, after PR #44).
The frontend has its own suite of 64 tests; see [`FRONTEND_TEST_REPORT.md`](FRONTEND_TEST_REPORT.md).

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
| `bookingEligibility.test.js` | 11 | 11 | Only an existing, enabled trip that has not departed can be booked: a disabled or departed trip is 409 `TRIP_NOT_BOOKABLE`, an unknown trip 404, a malformed id 400 (never 500); a retry of an earlier booking still returns it; each refusal is audited | FR-05, UC-01, FR-09 |
| `idValidation.test.js` | 58 | 58 | Trip and booking ids must be positive whole numbers within the database's INTEGER range, given as a number or plain digits: `true`, `[1]`, `"1e0"`, `" 1"`, `"0x1"`, leading zeros and out-of-range ids are rejected; at the API a bad body id is 400 and nothing is booked, a bad URL id is the same 404 as an unknown one, never a 500, and no other trip is touched | FR-05, FR-07, FR-08, SEC-01 |
| `cancellation.test.js` | 9 | 9 | Owner cancels before departure and gets a refund reference; seat is released and rebookable; repeat cancel is 409 with no second refund; cancel after departure is 409 and the booking stays confirmed; non-owner cannot cancel; unknown or malformed ids are 404 and unauthenticated calls 401; a failed refund is recorded but the booking stays cancelled; two concurrent cancels give one success and one refund; every outcome is audited | FR-07, SEC-01, FR-09 |
| `cancellationRecord.test.js` | 5 | 5 | Cancellation stores its time and the refund reference on the booking; history returns them; a failed refund stores no reference but still logs the attempt; rejected or repeated cancels leave the record untouched; other passengers never see it | FR-07, FR-06, SEC-01 |
| `admin.test.js` | 19 | 19 | Passenger gets 403 on every admin route; create, edit, disable; capacity cannot shrink below a confirmed seat; audit trail; 20 simultaneous bookings confirm exactly one; field validation and trimming | FR-08, FR-09, SEC-01, NFR-03 |
| `errorPaths.test.js` | 21 | 21 | Central error handler leaks nothing; search and sign-in validation; admin list, missing field, unknown trip, failed create with rollback | design §3.4, FR-02, FR-03, FR-08 |
| `lockoutWindow.test.js` | 17 | 17 | Five failures inside any 15-minute span lock the account (sliding window, including a burst across the boundary); older failures do not count; the lock lasts 15 minutes and then ends cleanly; guesses while locked change nothing; eight parallel guesses lock exactly once; no password in audit rows | SEC-04, FR-09 |
| `security.test.js` | 5 | 5 | Expired session rejected; token valid before expiry and rejected after sign-out (replay); missing or malformed token rejected without detail; access control enforced on the server; no password in responses or audit rows | SEC-01, SEC-02, SEC-03 |
| `migration.test.js` | 2 | 2 | Demo seed never promotes an existing passenger who owns the admin email; creates the demo admin only when the email is absent | SEC-01, FR-01 |
| **Total** | **185** | **185** | | |

Coverage of this suite after PR #44: **98.18 % statements, 94.82 % branches** (976 / 994
statements, 275 / 290 branches; `npm run test:coverage`). The before-and-after measurement for the 37
failure-path tests is in [`CODE_BRANCH_COVERAGE_REPORT.md`](CODE_BRANCH_COVERAGE_REPORT.md).

## Traceability to the ten test cases

The ten cases in Test Plan §5.2 map to these files; see
[`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md) for each case's verdict.

| Case | Files |
|---|---|
| TC-01, TC-02 | `auth.test.js`, `lockoutWindow.test.js` |
| TC-03 | `search.test.js`, `availability.test.js` |
| TC-04, TC-05 | `booking.test.js`, `bookingFailurePaths.test.js`, `bookingEligibility.test.js` |
| TC-06 | `cancellation.test.js`, `cancellationRecord.test.js` |
| TC-07, TC-08 | `admin.test.js` |
| TC-09 | `security.test.js`, `migration.test.js` (HTTPS part is not a unit test; see the execution report) |
| TC-10 | non-functional: load script and the browser matrix, not Jest |

## Defects the added tests would have caught

No new defect was found while writing the failure-path tests, and none was hidden: every test
passed against the code on `main` without changes to `backend/src`. The value of the new tests is
that these behaviours are now protected against future changes, not that a bug was fixed.
