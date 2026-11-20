# NFR-05 / NFR-06 manual-matrix record (issues #18, #19)

Run date: 2026-11-19 · Tester: Affan Dumba (PES1UG24CS280) · App: `main` @ 53c4a9e, local Postgres, Vite dev server. Automated driving via Selenium against the installed browsers (headless). Screenshots and raw JSON are in `before/` and `after/`.

Browsers: Chrome 157.0.8103.79, Edge 157.0.4341.60, Firefox 160.0.1

## Keyboard-only workflow (NFR-05) at 1280 px
Register → sign in → search → book → My bookings → cancel, using only Tab / Shift+Tab / Enter / typed characters.

| Step | Chrome | Edge | Firefox |
|---|---|---|---|
| First Tab stop is the skip link | PASS | PASS | PASS |
| Enter on skip link moves past navigation | PASS | PASS | PASS |
| Tab to Full name | PASS | PASS | PASS |
| Tab to Email | PASS | PASS | PASS |
| Tab to Password | PASS | PASS | PASS |
| Tab to Create account | PASS | PASS | PASS |
| Register submitted with Enter, lands on sign-in | PASS | PASS | PASS |
| Tab to sign-in Email | PASS | PASS | PASS |
| Tab to sign-in Password | PASS | PASS | PASS |
| Sign-in submitted with Enter (in password field), lands on search | PASS | PASS | PASS |
| Tab to Origin | PASS | PASS | PASS |
| Tab to Destination | PASS | PASS | PASS |
| Tab to Travel date | PASS | PASS | PASS |
| Typed travel date with keys only (tried mdy->alt) | PASS | PASS | PASS |
| Tab to Search button | PASS | PASS | PASS |
| Search submitted with Enter, results listed | PASS | PASS | PASS |
| Tab to first Book button | PASS | PASS | PASS |
| Booking confirmed with Enter, PNR announced in role=status | PASS | PASS | PASS |
| Shift+Tab back to the My bookings nav link | PASS | PASS | PASS |
| Enter on My bookings link opens the list | PASS | PASS | PASS |
| Tab to Cancel button | PASS | PASS | PASS |
| Cancellation done with Enter, refund reference announced in role=status | PASS | PASS | PASS |
| Focus indicator visible on every focused control | PASS | PASS | PASS |

Focus indicator visible on every focused control, and no control without an accessible name (labels / aria-label / text) on /login, /register, /search, /my-bookings: see audit arrays in the JSON (all empty = pass).

## No horizontal scroll at 375 px and 1280 px (NFR-06)
Measured `document.scrollWidth` vs viewport and whether any element or form overflows. 375 px is a real 375-CSS-px viewport (page rendered in a 375 px-wide frame; headless windows cannot go below ~500 px).

| Page | Width | Chrome before | Edge before | Firefox before | Chrome after | Edge after | Firefox after |
|---|---|---|---|---|---|---|---|
| login | 375 | PASS | PASS | PASS | PASS | PASS | PASS |
| register | 375 | PASS | PASS | PASS | PASS | PASS | PASS |
| search-results | 375 | PASS | PASS | PASS | PASS | PASS | PASS |
| my-bookings | 375 | FAIL (scroll 572 > 375) | FAIL (scroll 572 > 375) | FAIL (scroll 572 > 375) | PASS | PASS | PASS |
| login | 1280 | PASS | PASS | PASS | PASS | PASS | PASS |
| register | 1280 | PASS | PASS | PASS | PASS | PASS | PASS |
| search-results | 1280 | PASS | PASS | PASS | PASS | PASS | PASS |
| my-bookings | 1280 | PASS | PASS | PASS | PASS | PASS | PASS |

## Defect found and fixed
- **D-07 (NFR-06):** `My bookings` table was not inside `.table-wrap`, so at 375 px the whole page scrolled horizontally (scrollWidth 572 vs 375) in Chrome, Edge and Firefox. Fix: wrap the table in `.table-wrap` and add a caption and `scope="col"` headers in `frontend/src/pages/MyBookings.jsx`. Re-run: all pages pass in all three browsers.

## Limits of this record
- Headless runs, one machine (Windows 11). A person looking at a screen reader or a real phone was not part of this.
- Admin pages were not exercised in this run.
- Firefox is the installed release (not a Playwright build); Edge and Chrome are the installed stable releases.

## Re-run on the redesigned UI (PR #31)
Run date: 2026-11-20 · Tester: Affan Dumba (PES1UG24CS280) · App: branch `affan/ui-polish`, local Postgres, Vite dev server. Same method as above (Selenium, installed browsers, headless, true 375 px frame). Screenshots and raw JSON are in `after-redesign/`.

Browsers: Chrome 157.0.8103.79, Edge 157.0.4341.60, Firefox 160.0.1

| Check | Chrome | Edge | Firefox |
|---|---|---|---|
| Keyboard-only workflow at 1280 px (27 steps) | 27/27 PASS | 27/27 PASS | 27/27 PASS |
| No horizontal scroll, 4 pages × 375 px and 1280 px (8 checks) | 8/8 PASS | 8/8 PASS | 8/8 PASS |
| Controls without an accessible name (login, register, search, my-bookings) | none | none | none |
| Focus indicator visible on every focused control | 13/13 | 13/13 | 13/13 |

The workflow gained four steps because the Search page gained controls. New steps, all PASS in the three browsers:
- Tab to the Night departure filter, Space changes the results (2 to 0 journeys), Space again restores them (2 journeys)
- Enter on the selected date-strip button re-runs the search; results and the pressed state stay intact
- "Book" buttons are now named per train (for example "Book train 12627 departing 11:02")

Notes:
- The Search results are now a list of journey cards (not a table). The 375 px check excludes the date strip and the decorative hero SVG, which scroll or clip inside their own containers; `document.scrollWidth` equals the viewport in every case.
- Same limits as above: headless, one machine, no screen reader or physical phone, admin pages not exercised.
