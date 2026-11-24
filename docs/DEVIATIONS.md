# Deviations from the submitted documents

The handout says deviations must be documented and explained during the final demo. These are the
real ones, recorded at the time of completion (19 November 2026).

| # | Planned | Actual | Why | Impact |
|---|---|---|---|---|
| D-01 | Sprint 1 = 19–23 Oct, Sprint 2 = 26–30 Oct 2026 | Both executed as a compressed run on 19 Nov 2026 | Part 2 was not started in the October window; the code and evidence were produced now rather than backdated | Timeline deviation only; all Sprint activities and artifacts exist |
| D-02 | Backlog from FR/NFR only | 19 items: 9 FR + 6 NFR + 4 SEC | The SRS defines SEC-01–04 and the Test Plan traces them; excluding them would leave tested requirements off the board | Additive; FR/NFR items are all present |
| D-03 | `bcrypt` native package | `bcryptjs` (same bcrypt algorithm, pure JS) | The native binding failed to load on Node 26 and adds a compiler dependency to CI/fresh clones | SEC-02 unchanged: salted adaptive hash, cost 12, no plaintext |
| D-04 | HTTPS deployment | Caddy reverse proxy with locally trusted TLS (`deploy/Caddyfile`) | No cloud account was available for the demo and Caddy was not installed in the demo environment, so HTTPS was performed with a local self-signed TLS reverse proxy (minimal Node server, port 8443 → API 4000). This is the same TLS-termination arrangement described in SAD §2.4; `deploy/Caddyfile` remains the deployment configuration | SEC-03 is demonstrated end to end locally (login, authenticated request, expired-token 401 over TLS), not on a cloud deployment |
| D-05 | Sprint 1 demo video recorded during Sprint 1 | Both videos were recorded after the compressed run from the merged `main` using a scripted headless-Firefox walkthrough of the real UI, and committed as `docs/media/sprint1-demo.mp4` (60 s) and `docs/media/sprint2-demo.mp4` (121 s) | The sprints were compressed into one day; the walkthrough is reproducible from `docs/DEMO_SCRIPT.md` | Content is genuine working-product footage; captions state each requirement being shown |
| D-06 | NFR-05/NFR-06 closed by automated tests | Implemented and verified by Affan’s headless keyboard and 3-browser matrix; not a screen-reader or physical-device test | The matrix is manual by nature; the evidence is automated-driven and its limits are stated | TC-10 is recorded as PASS with those limits in `TEST_EXECUTION_REPORT.md` |
| D-07 | Part 1 PDFs v1.1 | Unchanged | The implementation was brought to the documents, not the other way round | No requirement changes; traceability holds |
| D-08 | Every PR is raised by the member assigned to the issue | **#27** (FR-01/02/03) was opened and merged from Atharv's account although issues **#1–#3** are assigned to Mohit | The branch was prepared during the compressed run; Mohit added the edge-case tests, but the PR was opened from the wrong account. Git history was not rewritten. | Mohit can explain and demo the code; the contribution split is recorded here instead of faking authorship |
| D-09 | FR-03 (SRS v1.1) and TC-03 (Test Plan): search returns only trips matching origin, destination **and the exact travel date** | Search returns trips departing **on or after** the travel date (`departure_utc >= date`), ordered by departure | The change was made during Sprint 1 and logged as defect D-02 in the test report, but it was not recorded against the SRS. Found on 24 November 2026 while validating the SRS against the system ([`SRS_VALIDATION_REPORT.md`](SRS_VALIDATION_REPORT.md)). | The behaviour is wider than the SRS. The date strip and search tests depend on it, so it was **not** reverted; the team should either keep it and amend FR-03 in a later SRS revision, or revert to exact-date matching |

## Not claimed

- No simulated teammate commits, reviews, PR dates or merge conflicts.
- No load, accessibility or browser result is reported that was not actually produced.
- The Part 2 numbers in the test report come from the run on 19 Nov 2026 and the seed described
  in the README.
