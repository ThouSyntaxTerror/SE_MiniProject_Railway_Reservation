# Affan — FR-05/FR-07/SEC-04/NFR-05/NFR-06 (Test Case owner)

> Merge position 3: this branch is the base of Mohit's passenger branch, so merge it before his.

**Branch:** `feat/fr05-fr07-cancellation`
**Issues:** #10 (FR-07); refs #5 (FR-05), #13 (SEC-04), #18, #19
**Reviewer for your PR:** Mohit

## 1. Verify locally

```bash
git fetch origin
git checkout feat/fr05-fr07-cancellation
git pull
cd backend && npm install && npm test          # expect 14 passed
cd ../frontend && npm install && npm run build # expect success
```

## 2. Check your slice

- `backend/src/services/bookingService.js` — `cancel()`: owner-only (404 otherwise), pre-departure
  (409 `DEPARTED`), one `cancelled` transition, one refund event, audit row; repeat returns the
  existing refund and releases nothing.
- `backend/src/paymentSimulator.js` — `refund()` adapter.
- `backend/src/routes/bookings.js` — `POST /api/bookings/:id/cancel`.
- `frontend/src/pages/MyBookings.jsx` — Cancel action, refund reference, refresh after cancel.
- `backend/tests/booking.test.js` — cancellation group.
- SEC-04 lockout lives in `authService.js` (shared with Mohit's file) and is tested in
  `auth.test.js` — run it and record TC-02.

## 3. Open the PR

Title: `feat(booking): cancellation with ownership, refund and single release (FR-05, FR-07, SEC-01)`

Body:

```markdown
## Summary
- `POST /api/bookings/{id}/cancel`: owner-only (404 for others), pre-departure, one refund event.
- Repeat cancellation is idempotent and never releases a second seat.
- Booking rejects unknown/disabled trips and respects capacity.
- UI: Cancel action with refund reference.

## Verification
- `cd backend && npm test` → 14 passed.
- Manual: owner cancel shows `REF-…`; second cancel shows `alreadyCancelled: true`; seat count unchanged.

Closes #10 #13
Refs #5 #18 #19
```

## 4. Review Mohit's PR

`feat/fr01-fr03-passenger` — check the name is required at the API (not only in the form) and that
search is case-insensitive and ordered.

## 5. Sign-off and demo

- Execute TC-02 and TC-06; fill tester/date/evidence in `docs/TEST_EXECUTION_REPORT.md`.
- NFR-05/NFR-06 manual matrix: Chrome, Edge, Firefox at 375 px and 1280 px; keyboard-only
  register → search → book → cancel; no horizontal scroll of primary forms.
- Demo segment (Sprint 2 video): cancel, refund reference, repeat cancel, seat restored.
