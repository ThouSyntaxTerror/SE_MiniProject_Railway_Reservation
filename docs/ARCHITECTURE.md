# Architecture overview — Railway Reservation System (Team E15)

A one-page picture of how the running system is put together. It is drawn from the code on `main`
and complements the formal design document
[`03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272.pdf`](../03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272.pdf)
(Figure 1 there is the layered component view; Figures 2 and 3 are the booking and cancellation sequences).

The diagrams are [Mermaid](https://mermaid.js.org/) and render directly on GitHub.

## 1. System and component view

```mermaid
flowchart TB
  subgraph Browser["Browser: Chrome, Edge, Firefox"]
    SPA["React + Vite single-page app<br/>Search, My bookings, Sign in, Register, Admin<br/>api/client.js adds the bearer token and Idempotency-Key"]
  end

  subgraph API["Express API (Node.js)"]
    MW["Middleware<br/>request id, bearer-token auth,<br/>server-side role check, error handler"]
    RT["Routes<br/>/api/register, /api/sessions<br/>/api/trips, /api/bookings<br/>/api/admin, /health"]
    SV["Services<br/>authService, trainSearchService,<br/>bookingService, adminService, auditService"]
    PAY["Payment simulator<br/>authorize and refund"]
  end

  DB[("PostgreSQL<br/>users, sessions, trips, seats,<br/>bookings, payment_events, audit_events")]
  CI["GitHub Actions CI<br/>backend-tests, frontend-build"]

  SPA -->|"HTTP + JSON (Vite proxies /api in dev)"| MW
  MW --> RT --> SV
  SV -->|"pg pool, transactions, row locks"| DB
  SV --> PAY
  CI -. "runs the Jest suite on a real Postgres" .-> API
```

| Layer | What it does | Code |
|---|---|---|
| Frontend | Passenger and admin screens, keyboard-accessible, responsive to 375 px | `frontend/src/` |
| Middleware | Tags each request with an id, authenticates the bearer token, enforces roles on the server (SEC-01), returns `{code, message, requestId}` errors | `backend/src/middleware/` |
| Routes | Thin HTTP handlers, one file per area | `backend/src/routes/` |
| Services | Business rules and transactions: sign-in and lockout, search, booking, cancellation, admin changes, audit | `backend/src/services/` |
| Payment simulator | Deterministic stand-in for a payment provider (also used to force failures in tests) | `backend/src/paymentSimulator.js` |
| Database | System of record; schema and demo data are created by `npm run migrate` | `backend/src/db/` |

## 2. Request flow: booking and cancellation

```mermaid
sequenceDiagram
  actor P as Passenger
  participant UI as React app
  participant API as Express routes
  participant BS as bookingService
  participant DB as PostgreSQL
  participant PAY as Payment simulator

  P->>UI: Book
  UI->>API: POST /api/bookings (Idempotency-Key)
  API->>BS: book(userId, tripId, key)
  BS->>DB: BEGIN, find existing booking for key
  BS->>DB: lock a free seat (FOR UPDATE SKIP LOCKED)
  BS->>PAY: authorize
  alt payment approved
    BS->>DB: insert booking with unique PNR, COMMIT
    API-->>UI: 201 PNR and seat
  else payment failed
    BS->>DB: record event, COMMIT (seat hold released)
    API-->>UI: 402 PAYMENT_FAILED
  end

  P->>UI: Cancel
  UI->>API: POST /api/bookings/:id/cancel
  API->>BS: cancel(userId, bookingId)
  BS->>DB: BEGIN, lock booking row
  Note over BS: owner? still confirmed? before departure?
  BS->>DB: status = cancelled (seat is free again)
  BS->>PAY: refund
  BS->>DB: record refund event and audit, COMMIT
  API-->>UI: 200 refund reference
```

## 3. Data model

```mermaid
erDiagram
  users ||--o{ sessions : "signs in with"
  users ||--o{ bookings : makes
  trips ||--o{ seats : has
  trips ||--o{ bookings : "is booked on"
  seats ||--o{ bookings : "is assigned to"
  bookings ||--o{ payment_events : records
  users ||--o{ audit_events : "acts in"
```

Two database rules carry the correctness guarantees:

- `one_confirmed_booking_per_seat`: a partial unique index (`WHERE status = 'confirmed'`), so a seat can never be confirmed twice and cancelling frees it.
- `UNIQUE (user_id, idempotency_key)`: a retried booking request returns the original booking.

## 4. Security and operations notes

- Passwords are stored as salted hashes (SEC-02); five failed sign-ins lock an account for 15 minutes (SEC-04).
- Every sign-in, booking, cancellation and admin change is written to `audit_events` (FR-09).
- `GET /health` supports restart and recovery checks (NFR-04).
- HTTPS is configured for deployment (see [`HTTPS_DEPLOYMENT.md`](HTTPS_DEPLOYMENT.md)) but has not been exercised on a deployed instance yet, so it is not claimed as verified.
