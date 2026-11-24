# Design note: booking, cancellation and sign-in lockout (FR-05, FR-07, SEC-04)

A supplement to the architecture document
([`03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272_with_Architectural_Diagram.pdf`](../03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272_with_Architectural_Diagram.pdf))
and to [`ARCHITECTURE.md`](ARCHITECTURE.md). It records, for the three features assigned to Affan,
what the code on `main` actually does and why, so a reviewer can check the behaviour against the
SRS without reading the source. Where the code is weaker than the SRS it says so (section 5).

Authorship, from `git log`: the cancellation feature (section 2) was written by Affan; the booking
flow (section 1) comes from the Sprint 1 scaffold with a later fix by Rizwan; the lockout (section 3)
was written by Rizwan, and its 15-minute window fix (PR #39) is Affan's. Sections 1 and 3 otherwise
document and verify teammates' code; they are not claimed as Affan's implementation.

Sources: `backend/src/services/bookingService.js`, `backend/src/services/authService.js`,
`backend/src/paymentSimulator.js`, `backend/src/db/schema.sql`.

## 1. Booking (FR-05)

SRS: allocate exactly one seat and create exactly one confirmed booking with a unique PNR; a failed
payment releases the hold and creates nothing; retrying the same idempotency key creates no second
booking.

All of it happens in one database transaction in `bookingService.book()`:

| Step | What happens | Why |
|---|---|---|
| 1 | Reject a request with no `tripId` or no `Idempotency-Key` header (400) | The key is what makes a retry safe, so it is mandatory |
| 2 | Look for an existing booking with the same `(user_id, idempotency_key)`; if found, return it | A retry after a timeout returns the original booking |
| 3 | Pick the lowest-numbered seat on the trip that has no confirmed booking, locking the row with `FOR UPDATE SKIP LOCKED` | Two simultaneous requests take different seats instead of queueing behind each other |
| 4 | No seat found: audit `seat_unavailable`, commit, 409 `SEAT_UNAVAILABLE` | Sold out is a normal answer, not an error |
| 5 | Ask the payment simulator to authorise | The provider is a stand-in; the adapter isolates the rest of the code from it |
| 6 | Payment not approved: record a failed payment event, audit `payment_failed`, commit, 402 `PAYMENT_FAILED` | The seat was only locked, never booked, so committing releases it; no booking row exists |
| 7 | Approved: insert the booking with status `confirmed` and a generated PNR, record the payment event, audit `confirmed`, commit | Booking, payment record and audit row become visible together or not at all |

Two database rules are the backstop if the application logic is ever wrong:

- `one_confirmed_booking_per_seat`, a unique index on `bookings(seat_id) WHERE status = 'confirmed'`.
  A seat cannot be confirmed twice, and because only *confirmed* rows count, cancelling frees the seat.
- `UNIQUE (user_id, idempotency_key)`. Even two simultaneous requests with the same key cannot both insert.

If a race still reaches the unique index, or Postgres reports a serialization failure (`40001`) or
deadlock (`40P01`), the service answers 409 `SEAT_UNAVAILABLE` instead of a 500.

A failed payment does not store the idempotency key (there is no booking row), so retrying the same
key after a failure tries the payment again. That is intended: the first attempt created nothing.

## 2. Cancellation (FR-07)

SRS: for a confirmed booking owned by the signed-in passenger and requested before departure, mark
it cancelled, release the seat exactly once and record a simulated refund reference; reject late,
repeated and non-owner attempts without a second inventory change.

`bookingService.cancel()` locks the booking row (`SELECT … FOR UPDATE`) and then checks, in this order:

| Order | Check | Failure | Audit outcome | State change |
|---|---|---|---|---|
| 0 | Booking id is a positive whole number | 404 `NOT_FOUND`, database never touched | none | none |
| 1 | The booking exists **and** belongs to the caller | 404 `NOT_FOUND` | `not_owner` | none |
| 2 | Status is `confirmed` | 409 `ALREADY_CANCELLED` | `already_cancelled` | none |
| 3 | Departure is still in the future (decided by the database clock) | 409 `CANCELLATION_TOO_LATE` | `too_late` | none |
| 4 | All passed | 200 with the refund reference | `cancelled` | status set to `cancelled`, refund event recorded |

Design decisions:

- **Non-owner and missing booking look identical** (same 404, no PNR in the body). A passenger cannot
  discover which booking ids exist (SEC-01).
- **The row lock makes cancellation exactly-once.** Two simultaneous cancels queue on the lock; the
  second then sees `cancelled` and gets 409. Exactly one refund event is written.
- **The seat is released by the status change itself.** No seat row is edited; the partial unique index
  only counts confirmed bookings, so the seat is immediately bookable again.
- **Rejections are audited and committed before the error is thrown**, so a probing attempt leaves a
  trace even though it changed nothing.
- **A failed refund does not undo the cancellation.** The refund event is stored with status `failed`,
  the booking stays cancelled and the response says `refundStatus: "failed"`. The passenger has given
  up the seat; the refund is a payments problem that can be retried, not a reason to keep the seat.
- **The refund reference is deterministic**: `RFND-` plus the PNR. A reader can recompute it, and a
  repeated request cannot invent a different one.

## 3. Sign-in lockout (SEC-04)

SRS: after five failed sign-in attempts for one account, further attempts are rejected for 15 minutes
and logged without the submitted password.

State lives on the user row: `failed_attempts` (integer) and `locked_until` (timestamp).

```
login(email, password)
  user not found, or wrong password  ──►  if the user exists:
                                             this is the 5th failure?  yes → failed_attempts = 0, locked_until = now + 15 min,
                                                                              audit account_lockout
                                                                       no  → failed_attempts + 1
                                           audit login:failure, return 401 "Invalid email or password."
  locked_until in the future        ──►  audit login:locked, return 429 ACCOUNT_LOCKED   (checked BEFORE the password)
  correct password                  ──►  failed_attempts = 0, locked_until = NULL, create session, audit login:success
```

**Failure window (PR #39).** As first written, `failed_attempts` counted consecutive failures with no
time limit (section 5, item 1). PR #39 adds `recent_failures`, the times of the failed attempts in the
last 15 minutes. Each failure drops the entries older than 15 minutes and adds itself; five entries lock
the account. That is a sliding window: five failures inside *any* 15-minute span lock, as the SRS says,
including a burst that straddles a boundary (a fixed window that reset every 15 minutes would let up to
eight guesses through around the reset). The list is updated under a row lock (`SELECT … FOR UPDATE`), so
simultaneous wrong guesses are counted one at a time and lock the account exactly once, and a guess
that arrives after the lock is set changes nothing. The "is it locked?" check uses the database clock.

- **The lock check comes before the password check**, so the correct password is refused while locked.
  Otherwise an attacker could keep guessing and stop being blocked on a lucky hit.
- **Unknown email and wrong password return the same 401 and message** (FR-02), so the endpoint does not
  reveal which emails are registered.
- **Audit rows never contain the password**: only actor, action, outcome and request id are stored.
- The counter is reset when the lock is set, so the account is usable again as soon as the 15 minutes pass.

## 4. How each rule is enforced

| Rule | Application code | Database |
|---|---|---|
| One confirmed booking per seat | seat query excludes confirmed seats, `SKIP LOCKED` | partial unique index |
| Retry creates nothing new | idempotency lookup | `UNIQUE (user_id, idempotency_key)` |
| Cancel once, refund once | row lock, status check | row lock |
| Only the owner can cancel | `user_id` comparison, same 404 as missing | none (application-level) |
| Lockout after 5 failures | counter and `locked_until` | columns on `users` |

## 5. Known limits (not hidden)

Items 1, 3 and 4 were found while writing this note and have since been fixed; they stay listed so
the history is visible. Until the named pull request is merged, the limit still applies on `main`.

1. **Fixed by PR #39.** The lockout counted consecutive failures, not failures "within 15 minutes":
   `failed_attempts` was reset only by a successful sign-in or by locking and never expired, so five wrong
   passwords spread over several days locked the account. Stricter than the SRS, never weaker, but
   different. PR #39 adds the sliding 15-minute window described in section 3 and tests that move the clock.
2. **Open.** Unknown emails are never locked (there is no row to hold a counter). They also leak nothing,
   but a password-guessing run against a non-existent email is not slowed.
3. **Fixed by PR #39.** Two clocks: `locked_until` was written with the database clock and compared with
   the application server's clock. The check now uses the database clock too.
4. **Fixed by PR #40.** `bookings.cancelled_utc` and `bookings.refund_reference` existed in the schema but
   no code wrote them. Cancellation now stores both (the reference only when the refund succeeded), the
   history returns them, and My bookings shows the reference after a reload.
5. **The payment and refund provider is a simulator.** The design isolates it behind one small adapter
   (`paymentSimulator.js`), but real-gateway behaviours such as timeouts and partial refunds are not modelled.
6. **Retrying an old key after a cancellation returns the cancelled booking**, not a new one. That follows
   from the idempotency rule; a passenger who wants a new seat must use a new key, which the UI does.

## 6. Where it is tested

See [`AFFAN_TEST_TRACEABILITY.md`](AFFAN_TEST_TRACEABILITY.md) for each SRS clause mapped to the
automated test, live check and manual evidence that covers it.
