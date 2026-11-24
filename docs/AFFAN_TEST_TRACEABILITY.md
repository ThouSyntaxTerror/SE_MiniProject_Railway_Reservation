# Test traceability for FR-05, FR-07, SEC-04, NFR-05 and NFR-06

A supplement to the Test Plan
([`02_Test_Plan_Atharv_More_PES1UG24CS276.pdf`](../02_Test_Plan_Atharv_More_PES1UG24CS276.pdf)) and to
[`REQUIREMENT_TRACEABILITY.md`](REQUIREMENT_TRACEABILITY.md). The team-wide table maps each
requirement to a test file. This one goes one level down: every **clause of the SRS wording** for the
five requirements assigned to Affan, mapped to the individual test, live check or manual evidence that
checks it, and it says which clauses have no check.

Key to the evidence column:

| Mark | Meaning | Where |
|---|---|---|
| none | Jest test, in `backend/tests/` on `main` | `cd backend && npm test` |
| † | Jest test added by PR #36 (failure paths) | `bookingFailurePaths.test.js`, `errorPaths.test.js` |
| ‡ | Live system-test check added by PR #37 | `node scripts/systemTest.js`, output in `docs/evidence/system-test/` |
| M | Manual or browser-driven evidence | `docs/evidence/…` |

† and ‡ items only exist once those pull requests are merged.

## FR-05 Booking (issue #5, Sprint 1)

| SRS clause | Check |
|---|---|
| One seat and one confirmed booking with a unique PNR | `booking.test.js`: a retried key returns the original booking; 409 once every seat is confirmed. `admin.test.js`: 20 simultaneous bookings for one seat confirm at most one (recorded as 1 confirmed, 19 conflicts). ‡ TC-04a/b (PNR and seat returned, free seats 3 → 2), NFR-03 race (8 passengers, one wins). M `system-test/2-booked-banner.png` |
| A failed payment releases the hold and creates no confirmed booking | `booking.test.js`: a failed payment releases the hold and creates no confirmed booking |
| Retrying the same idempotency key creates no second booking | `booking.test.js`: retried `Idempotency-Key`. ‡ TC-05 (same booking id, free seats unchanged) |
| Missing trip id or key is rejected | † `bookingFailurePaths.test.js` input validation (3 tests) |
| Race and driver failures never become a 500 | † `bookingFailurePaths.test.js` database failures (6 tests) |
| **Not checked live** | A payment failure cannot be forced on a running server; it is Jest-only |

## FR-07 Cancellation (issue #10, Sprint 1)

| SRS clause | Check |
|---|---|
| Owner cancels a confirmed booking before departure and gets a refund reference | `cancellation.test.js`: owner cancels and gets a refund reference. ‡ TC-06c (`RFND-<PNR>`). M `system-test/4-cancelled-refund.png` |
| The seat is released exactly once | `cancellation.test.js`: cancelling releases the seat so it can be booked again; a repeated cancel does not refund twice; two concurrent cancels give one success and one refund. ‡ TC-06d/e/f |
| Late cancellation is rejected with no inventory change | `cancellation.test.js`: cancel after departure is 409 and the booking stays confirmed |
| Repeated cancellation is rejected | `cancellation.test.js`: repeat is 409; ‡ TC-06e (409 `ALREADY_CANCELLED`, free seats unchanged) |
| Non-owner cancellation is rejected | `cancellation.test.js`: a non-owner cannot cancel. ‡ TC-06a/b (404, no PNR leaked, booking still confirmed) |
| Unknown or malformed ids and unauthenticated calls | `cancellation.test.js`: 404 and 401. † `bookingFailurePaths.test.js` (non-numeric, zero, negative, fractional ids never reach the database) |
| A failed refund is recorded but the booking stays cancelled | `cancellation.test.js`: failed refund recorded |
| Every outcome is audited (FR-09) | `cancellation.test.js`: every cancellation outcome is audited |
| Database failure mid-cancel rolls back cleanly | † `bookingFailurePaths.test.js` database failures during cancellation (2 tests) |

## SEC-04 Lockout (issue #13, Sprint 1)

| SRS clause | Check |
|---|---|
| After five failed attempts, further attempts are rejected for 15 minutes | `auth.test.js`: the sixth attempt is rejected and the rejection is audited. ‡ TC-02b/c (five 401s, then 429 `ACCOUNT_LOCKED` even with the correct password) |
| Attempts are logged without the submitted password | `auth.test.js`: sign-ins audited without passwords. `security.test.js`: no password in responses or audit rows. ‡ TC-02d/e |
| Unknown email and wrong password are indistinguishable (FR-02) | `auth.test.js`: generic error. ‡ TC-02a. † `errorPaths.test.js` sign-in validation (empty body, missing email, missing password: same 401) |
| **No check** | That the lock really ends after 15 minutes is not tested (no test moves the clock). **Failures spread over time** are not tested, and the code counts consecutive failures rather than failures "within 15 minutes"; see `CANCELLATION_AND_LOCKOUT_DESIGN.md` section 5 |

## NFR-05 Accessibility (issue #18, Sprint 2)

| SRS clause | Check |
|---|---|
| Required workflows work with the keyboard alone | M `evidence/nfr05-nfr06/RESULTS.md`: register → search → book → cancel with keyboard only, 23 of 23 steps in Chrome, Edge and Firefox on the first design; 27 of 27 after the redesign (PR #31) |
| Every input and button has an accessible name | M the same matrix: no unnamed controls on any page after the redesign |
| **Not covered** | A real screen reader; the administrator pages |

## NFR-06 Compatibility (issue #19, Sprint 2)

| SRS clause | Check |
|---|---|
| Chrome, Edge and Firefox at 375 px and 1280 px without horizontal scrolling of primary forms | M `evidence/nfr05-nfr06/RESULTS.md`: all pages with no horizontal scroll in all three browsers at both widths (8 of 8 pages per browser after the redesign). One real defect (D-07, My bookings overflowing at 375 px) was found, fixed in PR #30 and re-run clean |
| **Not covered** | A physical phone; the administrator pages |

## Summary

| Requirement | Every SRS clause has at least one check? | Gaps |
|---|---|---|
| FR-05 | Yes | A payment failure is checked in Jest only, not on a live server |
| FR-07 | Yes | None found |
| SEC-04 | Partly | The lock ending after 15 minutes is not tested; failures spread over time are not tested (and the code differs from the SRS wording there) |
| NFR-05 | Yes, on one machine in headless browsers | No screen reader; administrator pages not walked |
| NFR-06 | Yes, on one machine in headless browsers | No physical phone; administrator pages not walked |
