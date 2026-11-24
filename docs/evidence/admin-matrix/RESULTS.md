# NFR-05 / NFR-06 on the administrator pages

The earlier matrix ([`../nfr05-nfr06/RESULTS.md`](../nfr05-nfr06/RESULTS.md)) covered the passenger
pages and listed the administrator pages as not covered. This closes that gap. Run on 24 November 2026
against the local build (API on :3000, UI on :5173, seeded administrator), headless, one machine.

```
python scripts/adminMatrix.py chrome  docs/evidence/admin-matrix
python scripts/adminMatrix.py edge    docs/evidence/admin-matrix
python scripts/adminMatrix.py firefox docs/evidence/admin-matrix
```

## Result

| Browser | Keyboard and naming steps | 1280 px | 375 px |
|---|---|---|---|
| Chrome 158 | 28 / 28 | no horizontal scroll | no horizontal scroll |
| Edge 158 | 28 / 28 | no horizontal scroll | no horizontal scroll |
| Firefox 160 | 28 / 28 | no horizontal scroll | no horizontal scroll |

Per-step detail is in `<browser>-run.txt` and `<browser>.json`; screenshots are `<browser>-1…5-*.png`.

## What the keyboard-only walkthrough does

Using only Tab, typing, Enter and the arrow key inside the date fields:

1. Sign in as the administrator and press Enter in the password field.
2. Tab to **Admin** in the navigation and press Enter.
3. Fill the whole **Create trip** form (train number, origin, destination, departure and arrival
   date-time, fare, capacity) and press Enter on **Create trip**; the success message appears and the
   trip is in the table.
4. Tab to that trip's capacity field, change it, Tab to its **Save** button and press Enter.
5. Tab to its **Disable** button, press Enter, confirm the browser's dialog; the trip shows as
   disabled and its button becomes inactive.

Every stop recorded a visible focus indicator. Every link, button and input on the page has an
accessible name.

## Defect found and fixed: row buttons had the same name

| | Before | After |
|---|---|---|
| Buttons in the Trips table | Every row had a button named "Save" and one named "Disable" (`before-fix-chrome.json`: "Save x5; Disable x5") | "Save capacity for 12627", "Disable trip 12627", and so on |
| Effect | A screen-reader user tabbing through the table heard "Save, Disable, Save, Disable…" with nothing saying which trip each acts on | Each button says which trip it acts on |
| Keyboard walkthrough | Could not find the new trip's Save and Disable buttons by name (steps failed) | 28 / 28 |

The capacity inputs already had names per trip ("Capacity for 12627"); only the buttons did not.
The fix is two `aria-label` attributes in `frontend/src/pages/Admin.jsx`; the visible text is unchanged.

## Notes on the method

- **375 px is real.** A headless browser window cannot be made narrower than about 500 px, so the
  page is loaded into a same-origin frame exactly 375 px wide and its own scroll width is measured.
  The 375 px screenshots show the frame at the left.
- **Date-time fields differ by browser.** Chrome and Edge accept a six-digit year and wait for the
  right-arrow key; Firefox stops at four digits and moves on by itself. The script handles both and
  checks the resulting value rather than assuming the typing worked.
- **The confirmation dialog** is the browser's own, which is keyboard operable (Enter confirms,
  Escape cancels); the driver accepts it the way Enter would.

## Not covered

A real screen reader, a physical phone, and the audit table's readability at 375 px beyond "no page
scroll" (it scrolls inside its own container, like the other tables).
