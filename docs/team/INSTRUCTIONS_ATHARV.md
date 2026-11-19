# Atharv — FR-09/SEC-01/02/03/NFR-04 (Test Plan owner, repository owner)

**Branch:** `test/security-recovery`
**Issues:** #9 (SEC-03), #12 (SEC-01); refs #7, #8, #17
**Reviewer for your PR:** Rizwan

## 1. Wait for #24, then verify

Your RBAC test calls `/api/admin/trips`, so open this PR **after** `feat/fr08-admin` (PR #24)
merges. Before that the route 404s and one test fails by design.

```bash
git fetch origin
git checkout test/security-recovery
git pull
git merge origin/main            # pick up admin + any earlier merges
cd backend && npm install && npm test          # expect all suites passed
```

## 2. Check your slice

- `backend/tests/security.test.js` — expired session, sign-out replay, malformed token, server-side
  role check, no password in responses/audit.
- `docs/HTTPS_DEPLOYMENT.md` + `deploy/Caddyfile` — TLS termination, HSTS, verification steps.
- `scripts/recoveryCheck.sh` — restart/health evidence helper.

## 3. Open the PR

Title: `test(security): session, RBAC and HTTPS/recovery evidence (SEC-01, SEC-02, SEC-03, NFR-04)`

Body:

```markdown
## Summary
- Automated expiry, sign-out replay and malformed-token tests.
- Server-side role enforcement and no-password-in-audit assertions.
- Caddy TLS config and the TC-09 verification steps.
- Restart helper: health 691 ms, committed booking survived.

## Verification
- `cd backend && npm test` → all suites passed.
- `caddy run --config deploy/Caddyfile`, then `curl -kI https://rrs.localhost/health`.

Closes #9 #12
Refs #7 #8 #17
```

## 4. Review Rizwan's PRs

- #23 foundation — schema `ALTER`s are idempotent; no plaintext secrets; `npm test` green.
- #25 availability — counts never below zero or above capacity.

## 5. As repository owner

1. Configure the Project board using `docs/GITHUB_PROJECT_BACKLOG.md` (19 items, 76 points,
   19 per member, two sprints).
2. Merge PRs only when CI is green **and** the named reviewer approved.
3. Create milestones `Sprint 1` and `Sprint 2` with the issue split in that document.
4. Record/upload the 1-minute and 2-minute videos using `docs/DEMO_SCRIPT.md`.
5. Tick TC-09/TC-10 manual items in `docs/TEST_EXECUTION_REPORT.md`.
6. Final check: every issue closed by a merged PR; no open critical/high defect.
