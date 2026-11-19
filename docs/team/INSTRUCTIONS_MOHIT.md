# Mohit — FR-01/02/03/06 (SRS owner)

> This branch is stacked on `feat/fr05-fr07-cancellation`, so open the PR **after** that one is
> merged. It keeps the booking tests and the audit test from PR #21 intact.

**Branch:** `feat/fr01-fr03-passenger`
**Issues:** #1 (FR-01), #3 (FR-03); refs #2, #4, #13
**Reviewer for your PR:** Affan

## 1. Verify locally

```bash
git fetch origin
git checkout feat/fr01-fr03-passenger
git pull
cd backend && npm install && npm test          # expect 24 passed (includes cancellation tests)
cd ../frontend && npm install && npm run build # expect success
```

## 2. Check your slice

- `backend/src/services/authService.js` — registration requires `name`, email, 12-char password;
  duplicate email 409; bcrypt hash only.
- `backend/src/services/trainSearchService.js` — origin/destination match, `departure_utc >= date`,
  ordered by departure, disabled trips excluded, availability clamped to `[0, capacity]`.
- `frontend/src/pages/Register.jsx` — name field wired to the API.
- `frontend/src/pages/Search.jsx` — seat counts, sold-out state, booking confirmation.
- `backend/tests/auth.test.js`, `backend/tests/search.test.js`.

## 3. Open the PR

Title: `feat(passenger): name on registration and on-or-after search (FR-01, FR-02, FR-03)`

Body:

```markdown
## Summary
- Registration requires `name` + email + 12-character password (SRS FR-01).
- Search matches origin/destination and departs on or after the date, ordered by departure.
- Disabled trips are excluded; availability is bounded to [0, capacity].
- UI: name field, seat counts, sold-out state, booking feedback.

## Verification
- `cd backend && npm test` → 24 passed.
- `cd frontend && npm run build` → success.

Closes #1
Refs #3 #2 #4
```

## 4. Review Affan's PR

`feat/fr05-fr07-cancellation` — check ownership returns 404 for non-owners, repeat cancellation
does not release a second seat, and the refund reference is stored once. Approve only if CI is green.

## 5. Sign-off and demo

- Run TC-01 and TC-03 manually once in the browser; tick them in `docs/TEST_EXECUTION_REPORT.md`
  if they pass.
- Demo segment (Sprint 1 video): register with a name → sign in → search → book → PNR.
- Do not change the SRS PDF; the code was brought to the document.
