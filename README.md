# Railway Reservation System

### Software Engineering Mini Project · Team E15 · Part 1

This repository contains the submission-ready requirements, test, architecture and design documentation for a proposed Railway Reservation System. Application code is outside the scope of Part 1.

## Files to submit

Upload exactly these four role-specific PDFs from [`submission/`](submission/):

1. [Software Requirements Specification — Mohit Singh P](submission/01_SRS_Mohit_Singh_P_PES1UG24CS273.pdf)
2. [Test Plan — Atharv More](submission/02_Test_Plan_Atharv_More_PES1UG24CS276.pdf)
3. [Software Architecture and Design Specification — Mohammed Rizwan Shaikh](submission/03_Architecture_Design_Mohammed_Rizwan_Shaikh_PES1UG24CS272.pdf)
4. [Test Case Update — Muhammad Affan Dumba](submission/04_Test_Case_Update_Muhammad_Affan_Dumba_PES1UG24CS280.pdf)

Deliverable 4 is a separate role-specific file and is also incorporated into Test Plan §5.2. This satisfies both the four-file submission arrangement and the assignment instruction that the update be made “in the Test Plan Document.”

An optional [combined review PDF](docs/Team_E15_Railway_Reservation_System.pdf) contains Deliverables 1–3; the Test Plan inside it already contains Deliverable 4.

## Deliverable ownership

| Deliverable | Owner | Student ID |
|---|---|---|
| Software Requirements Specification | Mohit Singh P | PES1UG24CS273 |
| Test Plan | Atharv More | PES1UG24CS276 |
| Architecture and Design Specification | Mohammed Rizwan Shaikh | PES1UG24CS272 |
| Test Case Update in Test Plan §5.2 | Muhammad Affan Dumba | PES1UG24CS280 |

## Coverage summary

- 9 functional, 6 non-functional and 4 security requirements
- 3 security objectives
- UML use-case and component diagrams
- 2 UML sequence diagrams
- API design, error handling, security architecture and architecture traceability
- 10 test cases covering functional, non-functional and security requirements
- Explicit tests for password length/hash storage, late cancellation, booking/cancellation audit, authorization, concurrency, session expiry, restart recovery, performance, accessibility and compatibility
- Complete SRS-to-test requirement traceability matrix

## Repository layout

```text
submission/              # The four PDFs to upload
docs/editable/           # Four editable DOCX copies
docs/source/             # Version-controlled HTML/CSS sources
docs/archive/            # Original combined files retained for recovery
docs/Team_E15_Railway_Reservation_System.pdf
assets/diagrams/         # SVG sources and rendered PNG diagrams
build_submission.sh      # Reproducible document build and validation
```

## Build the documents

The build requires `weasyprint`, LibreOffice, `pdfunite`, `pdfinfo`, `pdftotext`, `zip` and `unzip`.

```bash
./build_submission.sh
```

The script regenerates all four submission PDFs, all four editable DOCX files and the optional combined PDF. It embeds diagram images in the applicable DOCX packages and runs basic PDF-content validation.

## Important submission check

The repository may be private. Before submitting a GitHub link, either make it visible to the evaluator or add the evaluator as a collaborator. Verify access in a signed-out/private browser window.

## Standards referenced

- ISO/IEC/IEEE 29148:2018 — requirements engineering
- ISO/IEC/IEEE 29119-3:2021 — test documentation
- IEEE 1016:2009 — software design descriptions

The payment and refund flows use a deterministic simulator; no real payment information is processed.
