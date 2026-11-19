# Deviations from the submitted documents

The handout says deviations must be documented and explained during the final demo. These are the
real ones, recorded at the time of completion (19 November 2026).

| # | Planned | Actual | Why | Impact |
|---|---|---|---|---|
| D-01 | Sprint 1 = 19–23 Oct, Sprint 2 = 26–30 Oct 2026 | Both executed as a compressed run on 19 Nov 2026 | Part 2 was not started in the October window; the code and evidence were produced now rather than backdated | Timeline deviation only; all Sprint activities and artifacts exist |
| D-02 | Backlog from FR/NFR only | 19 items: 9 FR + 6 NFR + 4 SEC | The SRS defines SEC-01–04 and the Test Plan traces them; excluding them would leave tested requirements off the board | Additive; FR/NFR items are all present |
| D-03 | `bcrypt` native package | `bcryptjs` (same bcrypt algorithm, pure JS) | The native binding failed to load on Node 26 and adds a compiler dependency to CI/fresh clones | SEC-02 unchanged: salted adaptive hash, cost 12, no plaintext |
| D-04 | HTTPS deployment | Caddy reverse proxy with locally trusted TLS (`deploy/Caddyfile`) | No cloud account was available for the demo; the proxy is the same TLS-termination arrangement described in SAD §2.4 | SEC-03 is demonstrable end to end, not just in code |
| D-05 | Sprint 1 demo video recorded during Sprint 1 | **Not recorded yet.** Both videos are to be recorded from the merged `main` and committed under `docs/media/` | The sprints were compressed into one day and recording equipment/voice-over was not available during the run | No video is claimed as evidence until it is committed; scripts are ready |
| D-06 | NFR-05/NFR-06 closed by automated tests | Implemented and reviewed, but the manual browser/keyboard matrix is **awaiting sign-off** | Browser matrix is manual by nature; no browser automation runner was added | Named manual checks remain pending in `TEST_EXECUTION_REPORT.md` |
| D-07 | Part 1 PDFs v1.1 | Unchanged | The implementation was brought to the documents, not the other way round | No requirement changes; traceability holds |

## Not claimed

- No simulated teammate commits, reviews, PR dates or merge conflicts.
- No load, accessibility or browser result is reported that was not actually produced.
- The Part 2 numbers in the test report come from the run on 19 Nov 2026 and the seed described
  in the README.
