# Team playbooks — Sprint 2

Read your own file, run the two commands, open the PR, then review the PR named below. Do not
merge your own PR; the repository owner merges after CI is green and the review is in.

## Merge order (important)

1. `chore/sprint2-foundation` — PR #23 (Rizwan)
2. `feat/fr08-admin` — PR #24 (Rizwan)
3. Affan's cancellation PR #22
4. `feat/fr01-fr03-passenger` (Mohit) — stacked on #22 + the foundation
5. `test/security-recovery` (Atharv) — open **after** step 2; its 403 test needs the admin route
6. `test/fr04-availability` — PR #25 (Rizwan)
7. `docs/sprint2-report` — PR #26 (Rizwan) — merge last so CI runs against the full code

## Review matrix

| PR | Author | Reviewer |
|---|---|---|
| #23 foundation | Rizwan | Atharv |
| #24 admin | Rizwan | Mohit |
| #25 availability | Rizwan | Atharv |
| passenger | Mohit | Affan |
| #22 cancellation | Affan | Mohit |
| security/recovery | Atharv | Rizwan |

## Common commands

```bash
git fetch origin
git checkout <your-branch>
git pull
cd backend && npm install && npm test
cd ../frontend && npm install && npm run build
```

Everything must be green before you open the PR. Paste the actual `Tests: … passed` line into the
PR body. Do not edit dates, commits or results to look better than the run.

Files: [Mohit](INSTRUCTIONS_MOHIT.md) · [Affan](INSTRUCTIONS_AFFAN.md) ·
[Atharv](INSTRUCTIONS_ATHARV.md) · [Rizwan](INSTRUCTIONS_RIZWAN.md)
