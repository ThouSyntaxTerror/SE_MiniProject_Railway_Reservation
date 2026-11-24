# System test report — Team E15

A system test runs the whole product the way a user would: a real browser or HTTP client, the
real API, a real PostgreSQL database, no test doubles. This report covers the passenger journey
(sign in, search, book, cancel) and the access-control and concurrency rules around it.
Executed on 24 November 2026.

The Jest suite ([`UNIT_TEST_REPORT.md`](UNIT_TEST_REPORT.md)) tests the code from the inside.
This report is the other half: the same behaviour checked from the outside, on a running instance.
The ten formal cases and their verdicts are in [`TEST_EXECUTION_REPORT.md`](TEST_EXECUTION_REPORT.md).

## Environment

| Item | Value |
|---|---|
| Build | `main` at `84669d6` (Sprint 2 integration plus the UI redesign) |
| API | Node 24.22.1, Express, started with `npm start`, `localhost:3000` |
| UI | React and Vite dev server, `localhost:5173`, driven in headless Chrome by Selenium |
| Database | PostgreSQL 18.6 (embedded local server; CI uses 16), freshly created and seeded with `npm run migrate` |
| Payment | The built-in deterministic simulator (there is no real gateway) |
| Data | Each run creates its own passengers and a throw-away trip and disables it afterwards |

## How it was run

| Part | Command | What it does |
|---|---|---|
| API checks | `node scripts/systemTest.js` | 20 checks through the public HTTP API, the same calls the browser makes |
| UI flow | `python scripts/uiFlow.py docs/evidence/system-test` | Registers, signs in, searches, books and cancels in the real UI, saving a screenshot per step |

Both exit with a failure code if any check fails, so they can be re-run at any time. The API script
was run twice in a row on the same database (second run saved as evidence) to show it does not
depend on leftover data.

## Results

### API checks (`evidence/system-test/live-run.txt`): 20 of 20 passed

| ID | Case | Requirement | Result | Observed |
|---|---|---|---|---|
| ST-00 | API is up | NFR-04 | PASS | `GET /health` → 200 |
| ST-01 | Administrator creates a 3-seat trip | FR-08 | PASS | 201, capacity 3 |
| TC-02a | Unknown email and wrong password give the same 401 and message | FR-02 | PASS | both "Invalid email or password." |
| TC-02b | Five wrong passwords are five 401s | SEC-04 | PASS | 401 ×5 |
| TC-02c | Sixth attempt refused even with the correct password | SEC-04 | PASS | 429 `ACCOUNT_LOCKED` |
| TC-02d | Failed attempts and the lock are in the audit trail | FR-09 | PASS | `login:failure`, `login:locked`, `account_lockout:locked` recorded |
| TC-02e | No password anywhere in the audit trail | SEC-02 | PASS | none found |
| TC-03 | Search finds the trip by origin, destination and date | FR-03 | PASS | 1 result |
| TC-04a | Booking returns a PNR and a seat | FR-05 | PASS | 201, PNR and seat 1 |
| TC-04b | Availability drops by exactly one | FR-04 | PASS | 3 → 2 |
| TC-04c | Booking is in the owner's history, not another passenger's | FR-06, SEC-01 | PASS | |
| TC-05 | Same `Idempotency-Key` returns the same booking, no second seat | FR-05, NFR-03 | PASS | same booking id; still 2 free |
| TC-06a | Another passenger cannot cancel it | FR-07, SEC-01 | PASS | 404 `NOT_FOUND`, PNR not in the response |
| TC-06b | The failed attempt left the booking confirmed | FR-07 | PASS | status `confirmed` |
| TC-06c | Owner cancels and gets `RFND-<PNR>` | FR-07 | PASS | 200, `RFND-DFF6C9D8` |
| TC-06d | The seat is released | FR-07 | PASS | free seats back to 3 |
| TC-06e | Cancelling twice is a 409 and releases no second seat | FR-07, NFR-03 | PASS | 409 `ALREADY_CANCELLED`; free seats stay 3 of capacity 3 |
| TC-06f | The released seat can be booked by someone else | FR-07 | PASS | 201, seat 1 |
| SEC-01 | No token is 401; passenger on an admin route is 403 | SEC-01 | PASS | 401 and 403 |
| NFR-03 | 8 passengers race for the last seat | NFR-03 | PASS | one 201, seven 409, free seats 0 |

PNRs differ on every run; the table matches the saved second run (PNR `DFF6C9D8`). The UI flow used its own passenger and PNR `34FD1F1D`.

### UI flow (`evidence/system-test/ui-flow-log.txt`): passed

| Step | Screenshot | Observed |
|---|---|---|
| Search Bengaluru → Chennai | `1-search-results.png` | Journey cards for train 12627 |
| Book | `2-booked-banner.png` | "Booked. PNR 34FD1F1D, seat 1 on train 12627" |
| My bookings | `3-my-bookings-confirmed.png` | The booking listed as confirmed with a Cancel button |
| Cancel | `4-cancelled-refund.png` | "Booking 34FD1F1D cancelled. Refund reference: RFND-34FD1F1D"; status badge Cancelled |

The script also asserts that the refund reference on screen is `RFND-` plus the PNR and that the
badge reads Cancelled, so a wrong value would have failed the run.

## What this report does not cover

| Not covered here | Where it is covered instead |
|---|---|
| Payment failure (TC-05, the first half) | Cannot be forced on a live server because the simulator only fails when a test switches it. Covered in `booking.test.js` and `cancellation.test.js` (failed payment creates no booking; failed refund leaves the booking cancelled). |
| HTTPS and the 30-minute idle expiry (TC-09) | Exercised through a local TLS reverse proxy and recorded in `TEST_EXECUTION_REPORT.md` (TC-09 and the manual checks). Not on a public host: no cloud instance was deployed (D-04) |
| Search and booking speed under load (NFR-01, NFR-02) | `npm run test:load` results in the execution report |
| Three browsers at 375 px and 1280 px, keyboard-only walkthrough (NFR-05, NFR-06) | `evidence/nfr05-nfr06/RESULTS.md` |
| Administrator screens in the browser | Admin API is checked here and in `admin.test.js`; the admin pages are walked through with the keyboard in three browsers in `evidence/admin-matrix/RESULTS.md` (PR #41) and unit-tested in `FRONTEND_TEST_REPORT.md` (PR #42) |
| A physical phone, a screen reader | Not done |

## Limits of this evidence

- It ran on one machine against local servers and the development build of the UI, not a deployed
  instance.
- The UI half used one browser (headless Chrome). The cross-browser result is the NFR-05/06 matrix.
- Money is simulated; "refund reference" proves the system records and shows a reference, not that
  any money moved.
- No defect was found in this run. That is a statement about these 20 checks and one flow, not a
  claim that the system has no defects.
