# Investor content integration checklist

Local checkpoint: `51fea8c` (14 October 2026), created after 23 passing unit tests and a successful production build. No push or deployment. The approved desktop/mobile components, CSS, rendered copy and registry are preserved exactly; intake preparation is outside the frontend.

## Audit of all eleven sections

All sections remain `DEMONSTRATION`, with pending evidence, no approved source links and no real documents. The following requests are editorial placeholders, not verified claims.

| Section | Current content | Investor material to receive |
|---|---|---|
| 01 Introduction | Synthetic introductory narrative | Jonathan Blackburn's approved professional history; The Compounding Architecture |
| 02 Current Position | Baseline placeholder; no actual income or liabilities | Private family circumstances/responsibilities; Micore Solutions and family-property legal review |
| 03 History & Evidence | Two placeholder years; three empty photo slots | GTR³ founder journey; iMED laboratory case study; 2024–2025 iMED/KULA chronology |
| 04 Assets & Claims | No ownership or valuation established | JB³ product inventory, maturity, assets, title and IP evidence |
| 05 Financial Requirements | Funding amount unagreed; illustrative calculator | Immediate funding, use of funds, obligations, dates and supporting quotes |
| 06 Beobacht Alignment | Proposed relationship only | Approved partnership scope, correspondence, commitments and permissions |
| 07 Commercial Pipeline | Three synthetic A/B/C opportunities | Dated actual opportunity register and stage evidence, separate from actual income |
| 08 Southern African Strategy | Regional framework placeholder | Approved market priorities, partner evidence and delivery constraints |
| 09 Financial Forecast | Hypothetical model only | Reconciled actuals, dated assumptions, financial responsibilities and method |
| 10 Investment Structures | Equity, loan and JV discussion frameworks | Reviewed proposed terms, obligations and agreement status |
| 11 Closing | Generic diligence next step | Approved diligence process, owner and contact permission |

## Module audit

- **Registry:** eleven synthetic narratives, `PENDING` evidence, image URLs null and document arrays empty. Do not substitute investor material into this publicly bundled demo registry.
- **Financial dashboard:** illustrative starting revenue R100,000, costs R70,000, opening cash R300,000, 2% growth and 12 months. These are demo assumptions, not actuals. No real amount has been inserted; pipeline remains excluded.
- **Timeline:** 2024 and 2025 are empty editorial periods. No iMED/KULA event, date, role or outcome has been asserted.
- **Gallery:** three empty laboratory/environment, equipment and team slots. No generated photograph is presented as evidence. The user-described 23-day build requires dated start/completion and commissioning records before being described as fact.
- **Document library:** locally generated synthetic briefing only in demo mode. No real PDF is imported. Secure mode uses private metadata and signed links, but live service acceptance is outstanding.

## Ready now

`content-migration/investor-intake.ts` adds a typed request catalogue for every named topic and an eleven-section placeholder factory bound to the existing IDs, titles and order. Call `createInvestorIntake(demoSections)` in offline tooling. Its returned records are PRIVATE, unapproved and awaiting verification; all five content collections are null (not supplied), and its Phase 2 manifest is empty with access disabled.

These are source-request placeholders only. There is no ingestion, upload, publication, database write, or automatic conversion into verified copy. No populated investor manifest belongs in this repository. Existing typed validation in `phase2.ts` remains the next review step after source material is obtained.

## Missing sources / integration checklist

- [ ] Approved biography, role/qualification records, GTR³ founder account and dated milestones.
- [ ] Author-approved Compounding Architecture explanation, diagrams, definitions and ownership/disclosure permissions.
- [ ] iMED laboratory start/completion and operational records, original photos, captions and rights; evidence for the user-described 23-day duration.
- [ ] Dated 2024–2025 iMED/KULA records, attributed correspondence and dispute annotations.
- [ ] Private, redacted family responsibilities and liabilities summary with consent.
- [ ] Relevant Micore Solutions agreements/correspondence and authorised legal-position summary; no liability conclusion inferred.
- [ ] Private property title, encumbrance and legal records with authorised redaction; no ownership or exposure conclusion inferred.
- [ ] JB³ product/asset inventory, maturity, ownership/IP records and valuation basis where applicable.
- [ ] Beobacht scope/correspondence or agreements and mutual permission to describe the relationship.
- [ ] Dated pipeline, prospective values/currencies and stage evidence; independently reconciled actual income.
- [ ] Funding schedule, costs/cash actuals, forecast assumptions and reviewed investment terms.
- [ ] Approved regional strategy, diligence owner, contact information and disclosure decisions.

## Security boundary and unresolved blockers

Keep source files and populated manifests **outside both the Git repository and the Vite server root**. The existing private-content ignore rule is only protection against accidental commits, not access control. No sensitive originals have been supplied or copied. The public directory remains favicon/headers only.

The secure-release gate remains disabled. Do not activate it for confidential content until live authentication, both membership tiers, direct data/storage denial, approval rules, expiry and revocation pass end-to-end acceptance. Current fixture tests do not prove live security. Existing signed-link lifetime limitations remain in SECURITY.md.

Production content adapters for timeline, private photographs, pipeline and financial figures remain pending: these modules currently render only for demo sections. Secure image loading is not implemented. Do not bypass those limitations with public assets or change the approved layout. See PHASE2_CONTENT_MIGRATION.md for the full contract and integration constraints.

## Post-implementation validation

- `npm test`: **27 passed**, including four additional intake tests. No failures.
- `npm run build`: **passed**; frontend output hashes match the checkpoint. The existing lazy PDF chunk-size advisory remains.
- `playwright test tests/navigation.spec.ts tests/secure-mode.spec.ts`: **5 passed**; desktop/mobile keyboard controls, all eleven sections, reduced motion and unconfigured secure-mode denial verified.
- `git diff HEAD -- src/components src/styles.css src/content src/App.tsx src/types.ts src/lib/useVault.ts src/lib/finance.ts supabase public`: empty against the checkpoint. Approved presentation, demo data and release gate are unchanged.

Files added for this preparation: `content-migration/investor-intake.ts`, `src/lib/investor-intake.test.ts`, and this checklist. No factual narratives, actual financial figures, private records or source files have been integrated; only typed intake placeholders and source requirements are ready.
