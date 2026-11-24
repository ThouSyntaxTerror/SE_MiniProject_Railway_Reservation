# Frontend unit test report — Team E15

Until this change the React frontend had no automated tests; its only checks were the manual
keyboard and browser matrices. This adds a unit-test suite for every page and the API client.

## How it runs

| Item | Value |
|---|---|
| Tools | Vitest 2.1.9, React Testing Library 16.1, user-event 14.5, jsdom 25 (a simulated browser) |
| Command | `cd frontend && npm test` (coverage: `npm run test:coverage`) |
| CI | The `frontend-build` job now runs `npm test` before `npm run build` |
| API | Replaced by a small fake (`src/test/fakeApi.js`) that answers like the real server and records every request, so the tests check both what the page shows and what it sends |

## Result (24 November 2026)

**64 tests in 6 files, 64 passed** (57 when the suite was added in PR #42; 7 more came with the SRS validation fixes in PR #44).

| File | Tests | What it checks | Requirements |
|---|---|---|---|
| `client.test.js` | 9 | Bearer token sent only when signed in; `Idempotency-Key` and JSON body on a booking; 204 handling; server errors become `ApiError` with code and message; non-JSON error bodies; a 401 clears the stored session, a 403 does not; corrupted stored user reads as signed out | FR-05, SEC-03 |
| `MyBookings.test.jsx` | 7 | Empty state; each booking's PNR, route, seat, fare and status; Cancel offered only for confirmed bookings and named after the PNR; cancelling posts to the right booking, shows the refund reference and reloads; a stored refund reference is shown under a cancelled booking (none for a failed refund); a refused cancel shows the server message and keeps the booking; a load failure is shown | FR-06, FR-07, NFR-05 |
| `Search.test.jsx` | 17 | Empty state; query sent with origin, destination and date; results ordered by departure; the time zone of the times is shown; seats left and sold-out buttons disabled; swap; sort by fare and by seats; seats-only, time-of-day and maximum-fare filters, "no match" state and clearing; Best price; the date strip shows the lowest fare per day and searches again; popular-route chip; failed search; booking sends the trip id with a fresh `Idempotency-Key`, two bookings use different keys, a seat conflict shows the server message | FR-03, FR-04, FR-05, SRS §2.4 |
| `App.test.jsx` | 18 | Signed out, every protected page redirects to sign-in; a passenger opening `/admin` is sent to search; an administrator can open it; navigation by role; the first Tab stop is the skip link; sign-out ends the server session and clears local state, even when the server is unreachable; sign-in success, wrong password and locked account; registration success and refusal; the registration form says every field is required | FR-01, FR-02, SEC-01, SEC-03, SEC-04, NFR-05, SRS §3.1 |
| `Admin.test.jsx` | 11 | Trips (including disabled) and audit events listed; departure and audit times carry a time-zone label; the create form says every field is required and names the time zone; a disabled trip cannot be disabled again; creating a trip sends numbers and UTC times and clears the form; a refused create keeps the input; saving capacity sends a PATCH for that trip only; a refused capacity change; disable asks for confirmation and sends nothing on Cancel; a load failure is shown | FR-08, FR-09, SRS §2.4, §3.1 |
| `time.test.js` | 2 | The time-zone label matches the browser's own formatting; every formatted date-time ends with it | SRS §2.4 |

## Coverage

From [`evidence/frontend-tests/vitest-coverage.txt`](evidence/frontend-tests/vitest-coverage.txt):

| File | Statements | Branches | Functions |
|---|---|---|---|
| `App.jsx` | 100 % | 91.3 % | 100 % |
| `time.js` | 100 % | 75 % | 100 % |
| `api/client.js` | 100 % | 100 % | 100 % |
| `pages/Admin.jsx` | 98.9 % | 96.87 % | 100 % |
| `pages/Login.jsx` | 100 % | 100 % | 100 % |
| `pages/MyBookings.jsx` | 100 % | 100 % | 100 % |
| `pages/Register.jsx` | 100 % | 100 % | 100 % |
| `pages/Search.jsx` | 99.23 % | 91.81 % | 97.05 % |
| **All** | **99.44 %** (891 / 896) | **94.24 %** (213 / 226) | **98.71 %** |

`main.jsx` (the three lines that mount the app) and the test helpers are excluded. Not covered:
the date strip's handling of a day whose request fails (`Search.jsx` 117–118), the fallback to the
email address when a user has no name (`App.jsx` 41 and 68), a disable that the server refuses
(`Admin.jsx` 118–119), and the "local time" fallback for a browser that reports no zone name
(`time.js` 10). The branch percentage
moves by a few hundredths between runs because some branches depend on timing.

## Do the tests catch real mistakes?

Three deliberate faults were put into the code and the suite was run against each:

| Fault | Caught by |
|---|---|
| A 401 no longer clears the stored session | `client.test.js` › a 401 clears the stored session |
| Cancel offered for every booking, not just confirmed ones | `MyBookings.test.jsx` (2 tests) |
| A passenger allowed onto `/admin` | `App.test.jsx` › a passenger who opens /admin is sent to search |

All four failing tests passed again once the code was restored.

## Limits

- jsdom is not a real browser: layout, focus rings and screen-reader output are not tested here. Those
  are covered by the Selenium matrices in `evidence/nfr05-nfr06/` and
  `evidence/admin-matrix/`.
- The API is faked, so these tests do not prove the server agrees; the backend Jest suite and the live
  system test do that.
- Date-time inputs are filled with `fireEvent.change` because jsdom has no date picker.
