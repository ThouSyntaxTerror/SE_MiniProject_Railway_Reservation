# Demo scripts and recording checklist

Record on the merged `main`, at 1280×720, browser zoom 100%. Seed first:

```bash
docker compose up -d
cd backend && npm run migrate && npm run dev      # terminal 1
cd frontend && npm run dev                        # terminal 2
```

Accounts: `admin@rrs.test / AdminPassword123`, `passenger@rrs.test / PassengerPass123`.

## Sprint 1 video — 1 minute

| Time | Action | Say |
|---|---|---|
| 0:00–0:08 | Show the search page and the nav | "Railway Reservation System, Team E15. Sprint 1: passenger flows." |
| 0:08–0:18 | Register a new passenger with a name; show the 12-character rule | "Registration requires a name, a unique email and a 12-character password." |
| 0:18–0:26 | Sign in as the seeded passenger | "Sign-in issues a 30-minute session." |
| 0:26–0:38 | Search Bengaluru → Chennai, tomorrow; point at seats left and order | "Only matching trips, ordered by departure, with live availability." |
| 0:38–0:50 | Book; show the PNR confirmation | "Payment is simulated; a unique PNR and one seat are allocated." |
| 0:50–1:00 | Open My bookings | "The passenger sees only their own bookings." |

## Sprint 2 video — 2 minutes

| Time | Action | Say |
|---|---|---|
| 0:00–0:12 | Open My bookings as the passenger | "Sprint 2: cancellation, administration, security and evidence." |
| 0:12–0:28 | Cancel the booking; show the refund reference; click Cancel again | "Owner-only, pre-departure, one release, one refund reference; a repeat is idempotent." |
| 0:28–0:35 | Show the row as `cancelled` and seats back to the original count | "The seat is released exactly once." |
| 0:35–0:55 | Sign in as admin → Admin → create a trip with capacity 3 | "Only the administrator role reaches these routes; passengers get 403." |
| 0:55–1:10 | Edit capacity, disable the trip | "Capacity changes are guarded if a confirmed seat would be stranded." |
| 1:10–1:20 | Scroll the audit table | "Every sign-in, booking, cancellation and admin change is audited with actor, time and outcome." |
| 1:20–1:32 | Sign out; sign in with 5 wrong passwords; show the lockout message | "Five failures lock the account for 15 minutes; the audit row never stores the password." |
| 1:32–1:45 | Show `https://rrs.localhost` in the address bar and an `/api` request in DevTools | "TLS terminates at the proxy; authenticated traffic is HTTPS." |
| 1:45–1:55 | Show the Actions tab / test report | "55 automated tests across the merged stack; TC-01–TC-08 executed, TC-09/TC-10 manual items still being signed off; p95 search 301 ms, booking 456 ms." |
| 1:55–2:00 | Show the PR list and the Project board | "Four members, reviewed PRs, two sprints." |

## Upload

- Export MP4 (H.264, ≤ 100 MB) to `docs/media/sprint1-demo.mp4` and `docs/media/sprint2-demo.mp4`.
- Commit with `docs: add Sprint 1/Sprint 2 demo recordings`.
- If a file is too large, upload to the repo's Releases and put the link in the README.
