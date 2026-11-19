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
| 3 | [Software Architecture and Design Specification](03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272.pdf) | Mohammed Rizwan Shaikh (PES1UG24CS272) |
| 4 | [Test Case Update](04_Test_Case_Update_Muhammad_Affan_Dumba_PES1UG24CS280.pdf) | Muhammad Affan Dumba (PES1UG24CS280) |

The Test Case Update is also incorporated into §5.2 of the Test Plan, as required.

## Part 2 evidence

- [Sprint log](docs/SPRINT_LOG.md) and [backlog / story points](docs/GITHUB_PROJECT_BACKLOG.md)
- [Requirement traceability](docs/REQUIREMENT_TRACEABILITY.md)
- [Test execution report](docs/TEST_EXECUTION_REPORT.md) (all ten TCs)
- [Deviations](docs/DEVIATIONS.md)
- [HTTPS deployment](docs/HTTPS_DEPLOYMENT.md)
- [Demo scripts](docs/DEMO_SCRIPT.md) (1-minute Sprint 1, 2-minute Sprint 2)
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
npm test                             # 36 Jest/Supertest tests, real Postgres
npm run seed:perf                    # 10,000 trips for NFR-01
npm run test:load -- --base http://localhost:3000
./scripts/recoveryCheck.sh http://localhost:3000   # NFR-04 restart evidence
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
