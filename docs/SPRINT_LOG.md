# Sprint log — Team E15 (Part 2)

The two sprints were executed as a compressed run on **19 November 2026**; the original window
was 19–30 October 2026. This deviation is recorded in [DEVIATIONS.md](DEVIATIONS.md). No commit
dates, reviews or checks were backdated.

## Sprint 1 — working product (19 Nov 2026)

Goal: make the Sprint 1 scaffold satisfy FR-01–FR-09, SEC-01–SEC-04.

| Branch | Owner | Scope | PR |
|---|---|---|---|
| `chore/sprint2-foundation` | Rizwan | schema, seeds, test harness, bcryptjs | [#23](https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/pull/23) |
| `feat/fr08-admin` | Rizwan | FR-08 admin CRUD + audit view, FR-09 read API | [#24](https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/pull/24) |
| `feat/fr01-fr03-passenger` | Mohit | FR-01 name, FR-02/03 search, FR-06 history | [#27](https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/pull/27) (opened from Atharv's account — see D-08) |
| `affan/issue-10-booking-cancellation` | Affan | FR-05 hardening, FR-07 cancellation, SEC-04 lockout | [#22](https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/pull/22) |
| `test/security-recovery` | Atharv | SEC-01/02/03 tests, HTTPS config, NFR-04 helper | see Pull requests |
| `test/fr04-availability` | Rizwan | FR-04 bounds and disabled-trip tests | [#25](https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/pull/25) |

Merge order: foundation → admin → cancellation → passenger → security → availability → docs. Each PR needs a
green CI run and one approving review from a member other than the author; the repository owner
merges.

Sprint 1 output: 55 automated tests on the merged stack, all passing; registration/name, search, booking, cancellation,
admin and audit working end to end.

## Sprint 2 — prove it (19 Nov 2026)

Goal: execute all ten TCs, measure the NFRs, record evidence, freeze.

| Activity | Owner | Evidence |
|---|---|---|
| TC-01/03/04 re-run and sign-off | Mohit | `TEST_EXECUTION_REPORT.md` |
| TC-02/06 (lockout, cancellation) sign-off | Affan | `TEST_EXECUTION_REPORT.md` |
| TC-09/10 session, HTTPS, recovery, compatibility | Atharv | `security.test.js`, `HTTPS_DEPLOYMENT.md` |
| NFR-01/02 load run, NFR-03 race | Rizwan | p95 301 ms / 456 ms, 1 of 20 confirmed |
| Documentation freeze | all | README, RTM, report, deviations (videos still to be recorded) |

## Evidence pointers

- CI: every PR runs the backend Jest suite against PostgreSQL 16 and the frontend build.
- Test report: [TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md)
- Traceability: [REQUIREMENT_TRACEABILITY.md](REQUIREMENT_TRACEABILITY.md)
- Backlog and points: [GITHUB_PROJECT_BACKLOG.md](GITHUB_PROJECT_BACKLOG.md)
- Videos: **not yet recorded or committed.** Scripts are in [DEMO_SCRIPT.md](DEMO_SCRIPT.md);
  the intended paths are `docs/media/sprint1-demo.mp4` and `docs/media/sprint2-demo.mp4`.
