# Clean Git release candidate, 20 October 2026

Prepared in the separate jb3-investment-vault-release checkout from main at bcdd33d2ecde066b3061e7eaf473a85fca4ff14c. The original working checkout, confidential originals and populated private manifests were preserved. No original Git references or objects were removed or rewritten.

An explicit allowlist transferred application source, server code, styles, original synthetic audio, tests, package files, configuration and five reviewed documents. Private PDFs, spreadsheets, narrative sources, populated manifests, thumbnails, environment files, screenshots, generated exports, temporary files, tool state and the original .git directory were excluded. The external transfer ledger records individual filenames and checksums.

Validation in the clean checkout:

| Check | Result |
| --- | --- |
| Production build, TypeScript and visible-copy check | PASS; 70 copy-source files, existing large-PDF-chunk advisory only |
| Unit, integration and local policy tests | 330 passed across 32 files |
| Acceptance diagnostic tests | 5 passed |
| Complete Playwright suite on isolated ports | 36 passed, 1 expected desktop touch-only skip; mobile touch passed |
| Populated Portfolio/PIN journey | 362 assertions, six widths from 375 to 1920 pixels; four Client Engagements and nine Showcase families |
| Populated finance, repayment, assets, gallery and briefing | 108 assertions across desktop, tablet and mobile |
| Excel reconciliation | 678 assertions; combined, Personal and Business; formulas, scope, draft treatment and editable FX |
| Narrative/typography browser checks | 77 passed; eleven narratives |
| Master PDF | 48 pages; 387 narrative paragraphs, 15 bookmarks, 12 image instances, pagination and bounds passed |
| Landing and audio | Desktop/tablet/mobile, no autoplay, mute, replay, Skip, reduced motion and denial checks passed |
| Both private intake manifests | PASS; releaseEnabled=false; originals unchanged |
| Frontend/private asset scan | PASS; private source data and server secrets absent |
| Worker packaging | Local dry run PASS; no deployment |
| Worker/frontend artifact scan | 19 files checked; no credential or private-content matches |
| Clean clone object and candidate scan | No private-content or credential findings; includes unreachable objects |

There is no npm run check script. Existing build, test, test:e2e and specialised checks were used instead. The browser suite used temporary configuration to start this checkout on isolated loopback ports; populated checks used port 5184. Temporary wrappers and private QA output are excluded from Git.

## Remaining release limits

This is an application-code release candidate, not confidential production acceptance. Hosted gateway/Storage revocation acceptance remains unresolved in SECURITY.md and docs/LIVE_SECURITY_ACCEPTANCE.md. No live security test, Storage policy change, source upload, deployment or gate activation was performed. Financial/evidence drafts retain their existing review requirements. No new visual or functional failure was found; the PDF bundle-size advisory remains.

Final owner browser review: cinematic entry and mute/Skip, all eleven chapters and Contents navigation, financial assumptions and three exports, nine Showcase families, four Client Engagements including the replacement SNG presentation, protected PDF viewing, desktop/mobile layout, and denied access. Hosted authentication and revocation need separately authorised live acceptance before Bruce receives confidential access.
