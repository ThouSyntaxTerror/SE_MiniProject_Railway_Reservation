# Railway Reservation System

Software Engineering Mini Project — Team E15 (PES1UG24CS272/273/276/280).

A browser-based Railway Reservation System: passenger registration, sign-in, train search,
seat availability, simulated-payment booking with a unique PNR, booking history, cancellation
with a refund reference, administrator trip/capacity management, and an audit trail.

## Part 1 deliverables

| # | Document | Owner |
|---|---|---|
| 1 | [Software Requirements Specification](01_SRS_Mohit_Singh_P_PES1UG24CS273.pdf) | Mohit Singh P (PES1UG24CS273) |
| 2 | [Test Plan](02_Test_Plan_Atharv_More_PES1UG24CS276.pdf) | Atharv More (PES1UG24CS276) |
| 3 | [Software Architecture and Design Specification](03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272_with_Architectural_Diagram.pdf) | Mohammed Rizwan Shaikh (PES1UG24CS272) |
| 4 | [Test Case Update](04_Test_Case_Update_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) | Muhammad Affan Dumba (PES1UG24CS280) |
| 5 | [Test Execution Report](05_Test_Execution_Report_Team_E15.pdf) | Team E15 (Sprint 2 results) |

The Test Case Update is also incorporated into §5.2 of the Test Plan, as required.

## Part 3 deliverables

| # | Document | Owner | Markdown source |
|---|---|---|---|
| 6 | [Unit Test Report](06_Unit_Test_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) | Muhammad Affan Dumba (PES1UG24CS280) | [`docs/UNIT_TEST_REPORT.md`](docs/UNIT_TEST_REPORT.md), [`docs/FRONTEND_TEST_REPORT.md`](docs/FRONTEND_TEST_REPORT.md) |
| 7 | [System Test Report](07_System_Test_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) | Muhammad Affan Dumba (PES1UG24CS280) | [`docs/SYSTEM_TEST_REPORT.md`](docs/SYSTEM_TEST_REPORT.md) |
| 8 | [Code and Branch Coverage Report](08_Code_and_Branch_Coverage_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) | Muhammad Affan Dumba (PES1UG24CS280) | [`docs/CODE_BRANCH_COVERAGE_REPORT.md`](docs/CODE_BRANCH_COVERAGE_REPORT.md) |
| 9 | [SRS Validation Report](09_SRS_Validation_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) (supplement to deliverable 1) | Muhammad Affan Dumba (PES1UG24CS280) | [`docs/SRS_VALIDATION_REPORT.md`](docs/SRS_VALIDATION_REPORT.md) |

The PDFs are rendered from the markdown with `python scripts/renderReports.py`, so the two always match.
The Test Execution Report (5) is the 20 November snapshot; the current figures are in 6 to 8.

## Where each rubric item is

| Rubric item | Evidence |
|---|---|
| SRS | Deliverable 1; validated against the built system in Deliverable 9 / [`docs/SRS_VALIDATION_REPORT.md`](docs/SRS_VALIDATION_REPORT.md) (25 requirements checked, 8 defects fixed) |
| Test Plan | Deliverable 2, with the Test Case Update (4) as §5.2; clause-level mapping in [`docs/AFFAN_TEST_TRACEABILITY.md`](docs/AFFAN_TEST_TRACEABILITY.md) |
| SAD | Deliverable 3; [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (component, sequence and data-model diagrams); [`docs/CANCELLATION_AND_LOCKOUT_DESIGN.md`](docs/CANCELLATION_AND_LOCKOUT_DESIGN.md) |
| Backlog creation | Issues #1–#19 with story-point labels and Sprint milestones; [`docs/GITHUB_PROJECT_BACKLOG.md`](docs/GITHUB_PROJECT_BACKLOG.md) |
| Sprint 1 and Sprint 2 | [`docs/SPRINT_LOG.md`](docs/SPRINT_LOG.md), [`docs/SPRINT_BURNDOWN.md`](docs/SPRINT_BURNDOWN.md), the two demo videos, milestones *Sprint 1* and *Sprint 2* |
| Unit Test Report | Deliverable 6: 127 backend + 64 frontend tests, all passing |
| System Test Report | Deliverable 7: 20 live API checks, a UI book-and-cancel flow, keyboard and viewport checks in three browsers; Deliverable 5 for the ten formal test cases |
| Code and Branch Coverage Report | Deliverable 8: backend 98.12 % statements / 94.56 % branches; frontend 99.44 % / 94.24 % |
| Demonstration | [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) and the demo videos; run the app with the steps below |

## Part 2 evidence

- [Sprint log](docs/SPRINT_LOG.md), [sprint burndown](docs/SPRINT_BURNDOWN.md) and [backlog / story points](docs/GITHUB_PROJECT_BACKLOG.md)
- [Architecture overview](docs/ARCHITECTURE.md) with Mermaid diagrams
- [Requirement traceability](docs/REQUIREMENT_TRACEABILITY.md)
- [Test execution report](docs/TEST_EXECUTION_REPORT.md) (all ten TCs)
- [Deviations](docs/DEVIATIONS.md)
- [HTTPS deployment](docs/HTTPS_DEPLOYMENT.md)
- [Demo scripts](docs/DEMO_SCRIPT.md) (1-minute Sprint 1, 2-minute Sprint 2)
- [Sprint 1 demo video](docs/media/sprint1-demo.mp4) (60 s) · [Sprint 2 demo video](docs/media/sprint2-demo.mp4) (2 min)
- [Team playbooks](docs/team/)

## Running the application

```bash
docker compose up -d                 # Postgres on localhost:5432

cd backend
cp .env.example .env
npm install
npm run migrate                      # schema + demo admin/passenger/trips
npm run dev                          # http://localhost:3000

cd ../frontend
npm install
npm run dev                          # http://localhost:5173 (proxies /api to the backend)
```

Demo accounts created by `npm run migrate`:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@rrs.test` | `AdminPassword123` |
| Passenger | `passenger@rrs.test` | `PassengerPass123` |

## Tests and measurements

```bash
cd backend
npm test                             # 127 Jest/Supertest tests, real Postgres
npm run test:coverage                # the same suite with statement and branch coverage
npm run seed:perf                    # 10,000 trips for NFR-01
npm run test:load -- --base http://localhost:3000
./scripts/recoveryCheck.sh http://localhost:3000   # NFR-04 restart evidence

cd ../frontend
npm test                             # 64 Vitest + Testing Library tests
npm run test:coverage

# with the API on :3000 and the UI on :5173
node scripts/systemTest.js                         # 20 live API checks
python scripts/uiFlow.py docs/evidence/system-test # book and cancel in the real UI
python scripts/adminMatrix.py chrome docs/evidence/admin-matrix   # also edge, firefox
python scripts/burndown.py                         # sprint burndown from GitHub issue closures
python scripts/renderReports.py                    # deliverables 6-9 as PDF
```

Recorded on 19 November 2026 (Postgres 16, Node 22):

| Requirement | Measurement | Result |
|---|---|---|
| NFR-01 search | 200 requests, 50 concurrent, 10,000 trips | p95 **301 ms** (target ≤ 2000 ms) |
| NFR-02 booking | 100 requests, 50 concurrent | p95 **456 ms** (target ≤ 3000 ms) |
| NFR-03 concurrency | 20 requests for the final seat | **1** confirmed, **0** seats left |
| NFR-04 recovery | process restart | health in **691 ms**, committed booking survived |

## Scope

In scope: FR-01–FR-09, NFR-01–NFR-06, SEC-01–SEC-04. Out of scope (per SRS §1.2): real payment
processing, live railway feeds, waitlists, dynamic pricing.
