# Railway Reservation System

Software Engineering Mini Project — Part 1, Team E15.

## Deliverables

1. [Software Requirements Specification — Mohit Singh P](01_SRS_Mohit_Singh_P_PES1UG24CS273.pdf)
2. [Test Plan — Atharv More](02_Test_Plan_Atharv_More_PES1UG24CS276.pdf)
3. [Software Architecture and Design Specification — Mohammed Rizwan Shaikh](03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272.pdf)
4. [Test Case Update — Muhammad Affan Dumba](04_Test_Case_Update_Muhammad_Affan_Dumba_PES1UG24CS280.pdf)

The Test Case Update is also incorporated into §5.2 of the Test Plan, as required by the assignment.

## Running the application

Sprint 1 scope only: registration, login, train search, booking, booking history (FR-01–06, FR-09,
SEC-02–03). Cancellation, admin, and the remaining NFRs are Sprint 2.

```bash
docker compose up -d                 # starts Postgres on localhost:5432

cd backend
cp .env.example .env
npm install
npm run migrate                      # creates tables + seeds one demo trip
npm run dev                          # http://localhost:3000

cd ../frontend
npm install
npm run dev                          # http://localhost:5173 (proxies /api to the backend)
```

Run the backend test suite with `npm test` inside `backend/` (needs Postgres running, see above).

