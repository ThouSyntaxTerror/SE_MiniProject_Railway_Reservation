# Rizwan — FR-08/FR-04/NFR-01/02/03 (SAD owner)

**Branches:** `chore/sprint2-foundation` (PR #23), `feat/fr08-admin` (PR #24),
`test/fr04-availability` (PR #25)
**Issues:** #11 (FR-08), #4 (FR-04), #14, #15, #16
**Reviewer for your PRs:** Atharv (#23, #25), Mohit (#24)

## 1. Verify locally

```bash
git fetch origin
git checkout chore/sprint2-foundation && npm --prefix backend test
git checkout feat/fr08-admin           && npm --prefix backend test   # 15 passed
git checkout test/fr04-availability    && npm --prefix backend test   # 12 passed
npm --prefix frontend run build
```

Run the real measurements once more on `feat/fr08-admin`:

```bash
cd backend
npm run seed:perf
npm run dev                                  # separate terminal; DATABASE_URL set
npm run test:load -- --base http://localhost:4000 --searches 200 --bookings 100
```

Recorded on 19 Nov 2026: search p95 **301.3 ms**, booking p95 **455.6 ms**, 100/100 bookings
confirmed. Keep these numbers in the PR body; they are already in the test report.

## 2. Review Atharv's PR

`test/security-recovery` — the 403 test must hit the admin route; ensure the expiry test really
moves `expires_at` into the past; approve only with green CI.

## 3. Your demo segment (Sprint 2 video)

Admin sign-in → create trip (capacity 3) → edit capacity → disable → scroll audit.
Say which requirements are being shown: FR-08, FR-09, SEC-01.

## 4. Final documentation (yours)

- `README.md`, `docs/SPRINT_LOG.md`, `docs/TEST_EXECUTION_REPORT.md`, `docs/RTM`, `docs/DEVIATIONS.md`.
- Update the SAD only if an API changed from v1.1. It did not: the implemented endpoints match
  §3.3. Note the HTTPS proxy in the demo notes.
- Do not backdate anything; the compressed sprint dates are recorded in `DEVIATIONS.md` D-01.
