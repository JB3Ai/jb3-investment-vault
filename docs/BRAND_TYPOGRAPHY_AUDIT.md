# JB³ brand and typography audit

Completed locally on 19 October 2026. Scope: application-owned visible copy, accessible labels, all eleven narrative displays, Portfolio, financial display, print HTML, generated Master/demo PDFs and generated Excel presentation sheets.

| Correction | Count |
| --- | --- |
| Public-facing brand corrections | 20 |
| Em dashes removed from presentation | 25 |

Counts are distinct copy occurrences/record fields, not repeated renders: 5 fixed brand strings, 6 human-readable display fields and 9 curated Portfolio fields; 20 fixed em-dash uses plus 5 approved-narrative display corrections across Sections 07, 10 and 11. Other narrative words and paragraph boundaries remain unchanged. Date/index ranges use “to”; explanatory punctuation uses colons, commas or parentheses. Spreadsheet zero formats display actual numeric zero rather than an em dash; unresolved inputs stay null/blank or explicitly unresolved. No figures, formulas or approvals changed.

A shared pure presentation projection provides consistent web/print/PDF typography while leaving the canonical master, private manifests, provenance and evidence originals unchanged. Original master/manifest hashes were checked; the existing private loader also validates referenced source hashes. No populated content or audit excerpts were introduced into frontend source or build output.

Intentional exceptions retain their original spelling: JB³Ai where it is a formal legal/contractual name; historical quotations and documentary assertions; original PDF/thumbnail content and PDF-reported metadata; source filenames, citations and provenance (including an existing JB3 citation); download filenames; repository names; identifiers, format markers, database/API/storage names; URLs, email addresses, environment variables, formulas and hashes. Superscript logo markup is already visually correct and remains intact. Exceptions are not general public-brand aliases.

Automation: npm run check:copy scans 70 source/render files using the existing parser. It checks JSX text, accessible labels, runtime strings, HTML metadata/favicon and renderer literals. Synthetic checks prove that bad copy is caught while identifiers, routes and legal-name exceptions are excluded. Every production build now runs this guard. The private browser/export checks do not log source text.

Validation: 329 unit/integration/policy tests passed; 77 desktop/mobile typography assertions passed; generated Excel exports passed 678 formula/scope/copy assertions; final 48-page Master PDF passed all 387 narrative paragraphs, 15 outline entries, contents numbering, 12 image instances and safe bounds. Actual Master and demo PDF text/metadata passed brand/punctuation checks, including the superscript glyph. Production build and private-asset scan passed. The pre-existing large-chunk advisory remains.

Updated files (35, plus this report):

- [content-migration/master-content.ts](../content-migration/master-content.ts)
- [index.html](../index.html)
- [package.json](../package.json)
- [scripts/check-consolidated.mjs](../scripts/check-consolidated.mjs)
- [scripts/check-portfolio-entry.mjs](../scripts/check-portfolio-entry.mjs)
- [scripts/check-presentation-copy.mjs](../scripts/check-presentation-copy.mjs)
- [scripts/check-visible-copy.mjs](../scripts/check-visible-copy.mjs)
- [server/financialExport.ts](../server/financialExport.ts)
- [server/masterPdf.ts](../server/masterPdf.ts)
- [server/master_pdf.py](../server/master_pdf.py)
- [src/App.tsx](../src/App.tsx)
- [src/components/AssetsRegister.tsx](../src/components/AssetsRegister.tsx)
- [src/components/ChapterNavigation.tsx](../src/components/ChapterNavigation.tsx)
- [src/components/CommercialRegister.tsx](../src/components/CommercialRegister.tsx)
- [src/components/ConsoleFrame.tsx](../src/components/ConsoleFrame.tsx)
- [src/components/DocumentLibrary.tsx](../src/components/DocumentLibrary.tsx)
- [src/components/EvidenceReviewCard.tsx](../src/components/EvidenceReviewCard.tsx)
- [src/components/ExecutiveBriefing.tsx](../src/components/ExecutiveBriefing.tsx)
- [src/components/FinancialWorkspace.tsx](../src/components/FinancialWorkspace.tsx)
- [src/components/HistoricalTimeline.tsx](../src/components/HistoricalTimeline.tsx)
- [src/components/HouseholdFundingProposal.tsx](../src/components/HouseholdFundingProposal.tsx)
- [src/components/NarrativeText.tsx](../src/components/NarrativeText.tsx)
- [src/components/Portfolio.tsx](../src/components/Portfolio.tsx)
- [src/components/PortfolioCarousel.tsx](../src/components/PortfolioCarousel.tsx)
- [src/components/PrivateLocalVault.tsx](../src/components/PrivateLocalVault.tsx)
- [src/components/RepaymentCalculator.tsx](../src/components/RepaymentCalculator.tsx)
- [src/components/SectionIndex.tsx](../src/components/SectionIndex.tsx)
- [src/components/SectionReader.tsx](../src/components/SectionReader.tsx)
- [src/content/registry.ts](../src/content/registry.ts)
- [src/lib/brochures.ts](../src/lib/brochures.ts)
- [src/lib/demoPdf.ts](../src/lib/demoPdf.ts)
- [src/lib/financialScenarios.ts](../src/lib/financialScenarios.ts)
- [src/lib/portfolio.ts](../src/lib/portfolio.ts)
- [src/lib/presentationCopy.test.ts](../src/lib/presentationCopy.test.ts)
- [src/lib/presentationCopy.ts](../src/lib/presentationCopy.ts)

Private review artifacts remain in OS Temp/JB3Vault-typography. Original documents, technical names, layout, navigation, financial assumptions and access controls were preserved. No staging, commit, push, deployment or Supabase access changes occurred; the previously reported publication/security blockers remain unchanged.
