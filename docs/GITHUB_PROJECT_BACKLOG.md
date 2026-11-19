# GitHub Project backlog — Team E15

Create one GitHub Project (Projects v2) linked to
`ThouSyntaxTerror/SE_MiniProject_Railway_Reservation`, add issues **#1–#19** as items, and set:

- **Story Points** (number field)
- **Sprint** (single-select: `Sprint 1`, `Sprint 2`)
- **Assignee** (built-in, already on the issues)

Suggested fields to add: `Story Points` (Number), `Sprint` (Single select), `Status`
(Todo / In progress / In review / Done).

## Backlog (19 items, 76 points, 19 points per member)

| Issue | ID | Item | Points | Sprint | Assignee |
|---|---|---|---|---|---|
| #1 | FR-01 | Registration with name, unique email, 12+ password | 5 | Sprint 1 | Mohit |
| #2 | FR-02 | Authentication and generic invalid-login error | 3 | Sprint 1 | Mohit |
| #3 | FR-03 | Filtered, ordered train search (on or after date) | 8 | Sprint 1 | Mohit |
| #4 | FR-04 | Availability bounded to 0..capacity | 3 | Sprint 2 | Rizwan |
| #5 | FR-05 | Idempotent booking, payment simulator, PNR | 5 | Sprint 1 | Affan |
| #6 | FR-06 | Passenger-scoped booking history | 3 | Sprint 1 | Mohit |
| #7 | FR-09 | Audit trail for sign-in, booking, cancel, admin changes | 5 | Sprint 1 | Atharv |
| #8 | SEC-02 | Salted adaptive password hashes, no plaintext | 2 | Sprint 1 | Atharv |
| #9 | SEC-03 | HTTPS, 30-minute expiry, sign-out invalidation | 5 | Sprint 1 | Atharv |
| #10 | FR-07 | Cancellation with single release and refund reference | 5 | Sprint 1 | Affan |
| #11 | FR-08 | Admin trip/capacity CRUD, 403 for passengers | 5 | Sprint 1 | Rizwan |
| #12 | SEC-01 | Server-side resource and role access control | 5 | Sprint 1 | Atharv |
| #13 | SEC-04 | 5-failure/15-minute lockout, audit without password | 5 | Sprint 1 | Affan |
| #14 | NFR-01 | Search p95 ≤ 2 s at 10k trips / 50 users | 3 | Sprint 2 | Rizwan |
| #15 | NFR-02 | Booking p95 ≤ 3 s at 50 users | 3 | Sprint 2 | Rizwan |
| #16 | NFR-03 | Final-seat race: at most one confirmation | 5 | Sprint 2 | Rizwan |
| #17 | NFR-04 | Restart recovery and health ≤ 60 s | 2 | Sprint 2 | Atharv |
| #18 | NFR-05 | Keyboard operation and accessible names | 2 | Sprint 2 | Affan |
| #19 | NFR-06 | Chrome/Edge/Firefox at 375/1280 px | 2 | Sprint 2 | Affan |

Totals: **Sprint 1 = 56 points**, **Sprint 2 = 20 points**, 76 points overall.

Mohit 19 · Affan 19 · Atharv 19 · Rizwan 19.

## Current GitHub state (19 Nov 2026)

- Milestones **Sprint 1** (#1, #2, #3, #5, #6, #7, #8, #9, #10, #11, #12, #13) and **Sprint 2**
  (#4, #14, #15, #16, #17, #18, #19) are created and every issue is assigned to one.
- The Projects v2 board itself still has to be created in the UI (the available token has `repo`
  but not `project` scope); the fields/values are in the table above.

## Setting it up (UI, ~10 minutes)

1. Repo → **Projects** → **New project** → *Board* → name it `RRS Sprint Board`.
2. **Link** the project to the repository.
3. Add the three custom fields above, then **Add items** → search each issue number `#1`…`#19`.
4. Fill Points/Sprint from the table.
5. Set each item's Status: `Done` only when its PR is merged and its test is in the report.
6. Create two milestones (`Sprint 1`, `Sprint 2`) with the same issue split — milestones are
   visible to the API and to graders even if the Projects scope is unavailable.

> Note: the handout says to derive backlog items from FR/NFR. This project also carries the four
> SEC items because the SRS defines them and the Test Plan traces them. Recorded in
> [DEVIATIONS.md](DEVIATIONS.md).
