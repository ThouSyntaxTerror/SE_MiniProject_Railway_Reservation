# Sprint report — Affan Dumba (PES1UG24CS280), Team E15

An individual view of the two sprints: what was assigned, what was delivered, which pull request and
evidence prove it, and what was added beyond the assigned backlog. The team plan is in
[`GITHUB_PROJECT_BACKLOG.md`](GITHUB_PROJECT_BACKLOG.md) and [`SPRINT_LOG.md`](SPRINT_LOG.md).
As recorded there and in [`DEVIATIONS.md`](DEVIATIONS.md), both sprints were run as one compressed
session on 19 November 2026 rather than in the original 19–30 October window; nothing was backdated.

## 1. Assigned backlog (19 of the team's 76 points)

The backlog assigns five issues to Affan. The git history shows that the *code* for two of them was
written by teammates, so the table says who wrote what and what Affan's own part was.

| Issue | ID | Item | Points | Sprint | Status | Code written by | Affan's part |
|---|---|---|---|---|---|---|---|
| #5 | FR-05 | Idempotent booking, payment simulator, PNR | 5 | 1 | Closed 19 Nov | Scaffold PR #20 (Atharv); 409 mapping for final-seat races by Rizwan | Assigned owner and test-case owner. Added failure-path tests (#36), live checks TC-04/TC-05 (#37) and the design note |
| #10 | FR-07 | Cancellation with single release and refund reference | 5 | 1 | Closed 19 Nov | **Affan**, PR #22 | Service, route, refund adapter, 9 tests incl. a concurrent-cancel regression; live checks TC-06a–f; UI evidence |
| #13 | SEC-04 | 5-failure / 15-minute lockout, audit without password | 5 | 1 | Closed 19 Nov | Rizwan (schema in PR #23, logic in PR #27) | Assigned owner; signed off TC-02 per the sprint log; live checks TC-02a–e (#37); design note, including the wording gap found in section 4 |
| #18 | NFR-05 | Keyboard operation and accessible names | 2 | 2 | Closed 19 Nov | Already in place when the matrix was run | **Affan** ran and recorded the keyboard walkthrough in three browsers, then re-ran it after the redesign |
| #19 | NFR-06 | Chrome, Edge, Firefox at 375 / 1280 px | 2 | 2 | Closed 19 Nov | Already in place when the matrix was run | **Affan** ran the three-browser, two-viewport matrix, found and fixed defect D-07 (PR #30) |

| | Assigned | Closed |
|---|---|---|
| Sprint 1 (#5, #10, #13) | 15 points | 15 |
| Sprint 2 (#18, #19) | 4 points | 4 |
| Total | 19 points | 19 |

All five issues are closed with a merged pull request behind them. "Closed" means merged to `main`
with a test or recorded evidence, the rule the team set for Done. The sprint log lists the FR-05
hardening and SEC-04 lockout under Affan's branch, but the commits show those were written elsewhere;
this report follows the commits.

Code written by Affan on `main`, from `git log`: the `cancel` function in `bookingService.js`, the
`refund` adapter in `paymentSimulator.js`, the cancel route in `routes/bookings.js`,
`cancellation.test.js`, and the frontend from PRs #30 and #31 (`index.css`, `App.jsx`, `Search.jsx`,
`MyBookings.jsx`, `Login.jsx`, `Register.jsx`).

## 2. Pull requests

| PR | Date | What it did | Size | State |
|---|---|---|---|---|
| #22 | 19 Nov | Booking cancellation with simulated refund (FR-07, closes #10): ownership, state and departure checks, exactly-once release, refund event, audit; concurrent-cancel regression test and stronger failed-refund assertions | +313 −7, 6 files | Merged (one round of requested changes, then approved) |
| #30 | 19 Nov | Fixed My bookings overflowing at 375 px (defect D-07); recorded the three-browser, two-viewport matrix and the keyboard walkthrough (closes #18, #19) | +2,104 −9, 87 files (mostly screenshots) | Merged |
| #31 | 20 Nov | Redesigned the UI (hero, date strip, filters, journey cards, motion that respects `prefers-reduced-motion`); re-ran the keyboard and viewport matrix on the new design: 27 of 27 steps and 8 of 8 pages in each browser | +2,431 −94, 50 files | Merged |
| #33 | 20 Nov | `ARCHITECTURE.md`: component, sequence and data-model diagrams | +103 | Merged |
| #36 | 24 Nov | Code and branch coverage report; 37 new failure-path tests (branch coverage 85.29 % → 94.51 %); unit test report; CI keeps the coverage report | open | Awaiting review |
| #37 | 24 Nov | System test report; 20-check live API script; UI flow script with screenshots | open | Awaiting review |
| #38 | 24 Nov | Design note for FR-05, FR-07, SEC-04; clause-level test traceability; this report; corrections to the team traceability table | docs only | Awaiting review |
| #39 | 24 Nov | SEC-04 fix: count failures inside any 15-minute span (sliding window), under a row lock, using the database clock (refs #13); 17 tests that move the clock | code + tests | Awaiting review |
| #40 | 24 Nov | FR-07: store the cancellation time and refund reference on the booking, return them in history, show the reference in My bookings after a reload; 5 tests | code + tests | Awaiting review |
| #41 | 24 Nov | NFR-05/06 on the administrator pages: keyboard-only walkthrough and 375/1280 px check in three browsers (28 of 28 each); fixed row buttons that were all named "Save" / "Disable" | code + evidence | Awaiting review |
| #42 | 24 Nov | First frontend unit-test suite: 57 tests over every page and the API client (99.42 % statements, 94.57 % branches), run in CI | tests + docs | Awaiting review |

On `main` today: 9 commits authored by Affan Dumba, 4 merged pull requests, 5 assigned issues closed.

## 3. Work beyond the assigned issues

| Item | Why it was needed |
|---|---|
| UI redesign (#31) | The first interface was functional but plain; the redesign was done to a reference layout and then re-verified for accessibility and viewport width rather than assumed to still pass |
| Architecture overview (#33) | The design PDF had no diagram of the system as built |
| Coverage report and failure-path tests (#36) | The Code and Branch Coverage Report was the one deliverable nobody had produced |
| System test report (#37) | The automated tests check the code from inside; there was no record of the running product being checked from outside |
| Design note and traceability (#38) | Records what the three assigned features do and which test covers each SRS clause, including the gaps |
| Lockout window (#39), cancellation record (#40) | Fix the two code-versus-SRS gaps the design note found, instead of only recording them |
| Admin pages matrix (#41) | The NFR-05/06 evidence listed the administrator pages as not covered |
| Frontend unit tests (#42) | The frontend had no automated tests at all; the coverage report listed it as an accepted gap |

## 4. Defects found in own work

| ID | Defect | Found by | Fix |
|---|---|---|---|
| D-07 | My bookings table overflowed the viewport at 375 px (NFR-06) | The three-browser matrix | `.table-wrap` scroll container, PR #30; re-run clean |
| A-01 | Every row of the admin Trips table had buttons named just "Save" and "Disable", so a screen-reader user could not tell which trip each acts on (NFR-05) | The admin-pages matrix | Buttons named per trip, PR #41; 28 of 28 in three browsers |
| L-01 | Lockout counted consecutive failures instead of failures within 15 minutes (SEC-04), in teammate-written code | Writing the design note | Sliding window, PR #39; the window tests fail against the old logic. A first fixed-window version was itself found weaker than the SRS at the boundary during self-review and replaced before merge |
| L-02 | `cancelled_utc` and `refund_reference` were never written, so the refund reference vanished after a reload (FR-07) | Writing the design note | Stored and shown, PR #40 |

Writing the failure-path tests (#36) and the system test (#37) found no functional defect.

## 5. Review activity

- Approved PR #27 (the passenger feature) as reviewer.
- PR #22 received one round of requested changes from the repository owner before approval.

## 6. Reflection

- **Estimation.** The 19 points were small in elapsed time because both sprints were compressed into
  one session; the points reflect relative size, not hours, and no hours were tracked.
- **What went well.** The booking rules are enforced by database constraints (a unique index for one
  confirmed booking per seat, a unique key for retries) rather than by application code alone; the
  cancellation feature follows the same approach, and both held under concurrent requests in the
  tests and in the live race check.
- **What was late.** Failure-path tests and a coverage run came after the features. Starting from the
  coverage gaps earlier would have caught the untested rollback and validation branches sooner.
- **What is still open.** Unknown emails are not rate-limited (no row to count against); the NFR-05/06
  checks cover headless browsers on one machine only (no screen reader, no physical phone); and the
  deployed-HTTPS checks belong to another team member. Pull requests #36 to #42 are awaiting review.

## 7. Links

| Topic | File |
|---|---|
| Design of the owned features | [`CANCELLATION_AND_LOCKOUT_DESIGN.md`](CANCELLATION_AND_LOCKOUT_DESIGN.md) |
| Clause-level test mapping | [`AFFAN_TEST_TRACEABILITY.md`](AFFAN_TEST_TRACEABILITY.md) |
| Accessibility and browser evidence | [`evidence/nfr05-nfr06/RESULTS.md`](evidence/nfr05-nfr06/RESULTS.md) |
| Overall architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
