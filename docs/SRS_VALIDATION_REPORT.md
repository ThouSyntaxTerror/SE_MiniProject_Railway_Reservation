# SRS validation report — Team E15

Requirements validation of the
[Software Requirements Specification v1.1](../01_SRS_Mohit_Singh_P_PES1UG24CS273.pdf)
(author Mohit Singh P) against the system as built. Prepared by Muhammad Affan Dumba
(PES1UG24CS280), 24 November 2026.

The SRS itself is unchanged: the Part 1 PDFs are frozen at v1.1 (deviation D-07). This report checks
each requirement the way ISO/IEC/IEEE 29148 describes validation: is the statement verifiable, is it
implemented, and what evidence shows it. Where the system did not meet the SRS, the system was fixed;
where the SRS and the system disagree on purpose, the difference is recorded for the team.

## Method

1. Read every "shall" statement, constraint (§2.4, §2.5, §3) and use case (UC-01, UC-02).
2. For each, find the code that implements it and the automated test, live check or manual record
   that verifies it.
3. Probe the running system for the cases the tests did not cover (for example, booking a trip that
   the use case says must not be bookable).
4. Record each gap as a finding, fix it with a test that fails on the old code, or record it as a
   deviation when it is a team decision.

## Requirement by requirement

| ID | Verifiable as written? | Implemented | Verified by | Verdict |
|---|---|---|---|---|
| FR-01 Registration | Yes (11 vs 12 characters, duplicate email) | `authService.register` | `auth.test.js`, frontend `App.test.jsx` | Met |
| FR-02 Authentication | Yes | `authService.login` | `auth.test.js`, `errorPaths.test.js`, live TC-02a | Met |
| FR-03 Search | Yes | `trainSearchService.search` | `search.test.js` | **Differs**: returns trips *on or after* the date, the SRS says matching the date (F-08) |
| FR-04 Availability | Yes | `trainSearchService.availability` | `availability.test.js`, live TC-04b | Met |
| FR-05 Booking | Yes | `bookingService.book` | `booking.test.js`, `bookingFailurePaths.test.js`, `bookingEligibility.test.js`, live TC-04/05 | Met **after F-01 to F-03** |
| FR-06 History | Yes (PNR, trip, seat, fare, status) | `listForUser`, My bookings page | `booking.test.js`, `MyBookings.test.jsx` | Met |
| FR-07 Cancellation | Yes | `bookingService.cancel` | `cancellation.test.js`, `cancellationRecord.test.js`, live TC-06 | Met (refund reference kept on the booking since #40, F-06) |
| FR-08 Administration | Yes (403 for non-admins) | `adminService`, `requireRole` | `admin.test.js`, `Admin.test.jsx`, admin browser matrix | Met |
| FR-09 Audit | Yes (timestamp, actor, action, outcome) | `auditService` | `auth.test.js`, `cancellation.test.js`, `admin.test.js`, live TC-02d | Met |
| NFR-01 Search performance | Yes (10,000 trips, 50 users, p95 ≤ 2 s) | index, load script | load run: p95 301 ms | Met |
| NFR-02 Booking performance | Partly: the "injected simulator delay" clause cannot be exercised, the simulator has no delay | transactional booking | load run: p95 456 ms | Met (F-11) |
| NFR-03 Concurrency | Yes | `SKIP LOCKED`, partial unique index | `admin.test.js` 20-way race, live 8-way race | Met |
| NFR-04 Recovery | Yes | DB-backed state, `/health` | restart run: 691 ms | Met |
| NFR-05 Accessibility | Yes | labels, skip link, focus styles | keyboard matrix (passenger and admin pages, 3 browsers) | Met (row buttons named per trip since #41, F-07) |
| NFR-06 Compatibility | Yes | responsive CSS | viewport matrix (3 browsers × 375 / 1280 px) | Met |
| SEC-01 Access control | Yes (403 or 404, no details) | `requireAuth`, `requireRole`, ownership checks | `security.test.js`, `cancellation.test.js`, live SEC-01 | Met |
| SEC-02 Credentials | Yes | bcrypt (12 rounds) | `auth.test.js`, `security.test.js` | Met |
| SEC-03 Transport and session | Yes | 30-minute sliding expiry, sign-out deletes the session, TLS proxy | `security.test.js`, TC-09 | Met locally; not on a public host (D-04, F-12) |
| SEC-04 Lockout | Yes | sliding 15-minute window since #39 | `lockoutWindow.test.js`, live TC-02 | Met **after F-05** |
| UC-01 Book Ticket | Yes; precondition "the selected trip is enabled" | `book` | `bookingEligibility.test.js` | Met **after F-01** |
| UC-02 Cancel Booking | Yes | `cancel` | `cancellation.test.js` | Met |
| §2.4 Times displayed with an explicit timezone label | Yes | `time.js`, Search, Admin | `time.test.js`, `Search.test.jsx`, `Admin.test.jsx` | Met **after F-04** |
| §2.4 Timestamps stored in UTC | Yes | `TIMESTAMPTZ` columns | schema | Met |
| §3.1 Forms identify required fields | Partly: "identify" is not defined | `required` attribute on every input, plus a visible note on the data-entry forms | `App.test.jsx`, `Admin.test.jsx` | Met after F-09 |
| §3.3 ISO 8601 dates with a UTC offset | Yes | the API returns `…Z` timestamps | API responses | Met |

## Findings

| # | Finding | Requirement | Found by | Status |
|---|---|---|---|---|
| F-01 | A **disabled** trip could be booked (201, booking confirmed) | UC-01 precondition, FR-05 | Probing the running API | **Fixed in PR #44**: 409 `TRIP_NOT_BOOKABLE`, audited |
| F-02 | A trip that had **already departed** could be booked | FR-05 "an available trip" | Probing the running API | **Fixed in PR #44**: 409 "This train has already departed" |
| F-03 | A trip id that does not exist returned 409 "No seats available"; a non-numeric id (`"abc"`, `1.5`) returned **500** | FR-05, design §3.4 (no internal errors) | Probing the running API | **Fixed in PR #44**: 404 `TRIP_NOT_FOUND` and 400 `VALIDATION_ERROR` |
| F-04 | No time in the UI said which time zone it was in | §2.4 | Reading the UI against §2.4 | **Fixed in PR #44**: "Times shown in …" on search results; zone on every admin date-time |
| F-05 | The lockout counted consecutive failures with no time limit, not five failures "within 15 minutes" | SEC-04 | Writing the design note | **Fixed in PR #39** (sliding window) |
| F-06 | The refund reference was recorded only in `payment_events` and disappeared from the passenger's view after a reload; two cancellation columns were never written | FR-07 | Writing the design note | **Fixed in PR #40** |
| F-07 | Every row of the admin Trips table had buttons named just "Save" and "Disable" | NFR-05 | Admin keyboard matrix | **Fixed in PR #41** |
| F-08 | FR-03 and Test Plan TC-03 say search returns trips matching the date; the system returns trips **on or after** it | FR-03 | Comparing SRS and Test Plan wording with `search.test.js` | **Recorded as deviation D-09**; not reverted because the date strip and tests depend on it. Team decision needed |
| F-09 | Required fields were marked only programmatically (`required`), with no visible indication | §3.1 | Reading the forms | **Fixed in PR #44**: "All fields are required." on Register and Create trip |
| F-10 | An administrator can create a trip whose departure is already in the past | FR-08 (silent) | Probing the running API | **Open, observation**: the SRS does not forbid it, and since F-02 such a trip cannot be booked |
| F-11 | NFR-02 excludes "any injected simulator delay above 1 second", but the simulator has no delay injection | NFR-02 | Reading the simulator | **Open, observation**: the clause is untestable as built; harmless |
| F-12 | HTTPS was exercised through a local TLS proxy, never on a public host | SEC-03 | Test execution report | **Recorded as D-04** |

## Suggested wording for a future SRS revision (v1.2)

These are suggestions for the SRS owner; nothing in the submitted v1.1 was changed.

- **FR-03:** "…shall return only trips matching the origin and destination and departing on or after
  the travel date, ordered by departure time" (if the team keeps the current behaviour), or keep the
  wording and revert the search.
- **FR-05:** add "a trip is available when it is enabled, has not departed and has at least one
  unreserved seat", so the UC-01 precondition is also a testable requirement.
- **SEC-04:** say whether "within 15 minutes" is a sliding window (as now implemented) and that
  unknown accounts are not counted.
- **NFR-02:** drop the simulator-delay clause or add delay injection to the simulator.
- **§3.1:** define "identify required fields" (visible marker, text note, or both).
- **FR-08:** say whether a trip may be created with a departure in the past.

## Summary

25 requirements and constraints checked. 23 are met, one differs on purpose and is recorded (FR-03,
D-09), and one (SEC-03) is met locally but not on a public host. Of the 12 findings, 8 were fixed in
code with tests that fail on the old code (#39, #40, #41, #44), 2 are recorded deviations, and 2 are
open observations with no effect on the required behaviour.
