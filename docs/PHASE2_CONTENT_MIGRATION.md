# Phase 2 content migration preparation

The approved Asymmetrical Luxury Console v2 desktop composition and existing mobile presentation are unchanged. This is an **offline intake contract and dry-run review plan**, not a database migration or publishing operation. No Phase 2 narrative, photograph, PDF, opportunity, or actual financial figure was found in the repository. Existing synthetic demonstration content remains unchanged.

## Section mapping and missing inputs

The keys, numbering and displayed titles remain those in `src/content/registry.ts`. New editorial terminology maps to existing keys; it does not rename the interface.

| # | Phase 2 material | Existing section ID | Required material / verification blocker |
|---|---|---|---|
| 01 | Introduction | introduction | Approved biography and executive introduction; sources for factual statements; permission to publish |
| 02 | Current position | current-position | Dated operating position, liabilities, resources, reconciled income and opening cash |
| 03 | History and evidence | history-evidence | Dated 2024–2025 chronology; laboratory ownership/role and activity records; original photographs, captions, dates and permissions |
| 04 | Assets | assets-claims | Asset inventory, title, valuation date/method, encumbrances; separate reported or disputed claims |
| 05 | Immediate funding | financial-requirements | Amount, currency, deadline, itemised use of proceeds, quotations and milestones; no default funding amount |
| 06 | Beobacht alignment | beobacht-alignment | Proposed scope, attributed correspondence, roles and mutually approved commitments; no inferred endorsement |
| 07 | Pipeline | commercial-pipeline | Counterparties, sector, stage date, stage evidence, prospective value and probability basis; signed evidence where applicable |
| 08 | Southern African strategy | southern-african-strategy | Priority countries, dated market evidence, delivery constraints and documented partner status |
| 09 | Financial forecast | financial-forecast | Reconciled historical actuals, costs and cash; assumption basis, dates, currency, method and exclusions |
| 10 | Investment structures | investment-structures | Reviewed proposed equity, loan and joint-venture terms; distinguish proposals from agreed rights and obligations |
| 11 | Closing | closing | Approved next steps, diligence owner, authorised contact details and consent to publish |

All eleven sections currently have status **awaiting material or verification**. No factual copy is ready for verified insertion. The mapping, typed contracts and empty intake factory are ready for use.

## Import contract

`content-migration/phase2.ts` is outside the frontend source tree and is not imported by the application. It is included in TypeScript checking. Begin a private intake with `emptyPhase2Import()` and review it using `inspectPhase2(manifest)`. The latter returns issues, eleven mapped section statuses and narrative IDs eligible for **private staging only**. It never writes files, sends requests, uploads assets, executes SQL, changes approval, or enables access.

Keep populated manifests and original files outside the repository and outside the Vite server root. A `private-content/` Git ignore rule is a backup against accidental commits, **not** an access-control mechanism; do not rely on it to hide files from a development server. Never place source material in `src`, `public`, documentation, test fixtures, or Superdesign context. No private sources have been copied here.

| Structure | Required intake fields | Existing destination / constraint |
|---|---|---|
| NarrativeImport | Stable ID, section ID, heading/body, disclosure, evidence links, editorial review | Future `vault_sections.narrative`; preserve current title, subtitle, overview and layout unless separately approved |
| EvidenceRecord | Claim, classification, private source references, reporter/dispute where relevant, independent review, disclosure | Future `vault_sections.evidence` JSON; richer provenance requires a deliberate adapter, not an enum cast |
| PrivateSource | Opaque inventory ID, title, received date, SHA-256, private custody | Offline source inventory only; checksum format is checked, source bytes/authenticity must be checked separately |
| PhotographImport | Private source ID, MIME, caption, alt text, capture date or null, owner and documented permission | Existing gallery takes URL/null, but no secure photo store or loader is implemented; do not insert public links |
| PdfImport | Private source ID, title, section/disclosure, MIME, size, date, optional opaque object key, approved=false | Existing private `vault-documents` bucket; PDF-only, maximum 25 MiB; server generates UUID and timestamps later |
| OpportunityImport | Name, counterparty or null, sector, dated stage, evidence, prospective money/probability or null | Existing demo Opportunity is insufficient for provenance/currency/unknown values; keep offline until adapter approved |
| FinancialFigureImport | Kind, actual/reported/assumption basis, money or null, period, as-of date, evidence, review and methodology | Separate actuals and assumptions; do not overwrite the hypothetical slider defaults |

Money uses integer minor units and an explicit three-letter currency code. Unknown values are `null`, not zero. The validator checks code syntax, not the ISO currency catalogue or currency exponent. No currency conversion or aggregation is performed. A signed opportunity remains prospective; recognised income requires a separate documented, reconciled actual-income record. Forecast revenue always remains an assumption. Negative financial amounts are retained for explicit review rather than clamped by the existing illustrative calculator.

The inspector accepts a **typed TypeScript object**; it is not an untrusted JSON parser or proof that source documents are authentic. External JSON needs structural parsing before this API. Tests use synthetic fixtures only. Any issue conservatively prevents the manifest from yielding verified narrative IDs. Empty manifests have no malformed-record issues but remain incomplete in all eleven section statuses.

## Evidence classification and review

- **documented**: a source record exists. This alone does not mean the claim is true, independently verified, legally enforceable or approved for release.
- **reported**: attributed account, without sufficient reviewed documentary support. Preserve the reporter and qualification.
- **disputed**: contested account. Preserve the dispute and competing evidence; do not flatten it into a verified narrative.
- **awaiting-verification**: source or verification is outstanding. Do not imply completion.

These classifications are separate from the existing `DEMONSTRATION / PENDING / VERIFIED` presentation enum. Do not replace that enum or change the database check constraint. Documented sources plus source review and editorial review can make a narrative eligible for private staging; publication remains a separate decision. Reported, disputed and awaiting-verification material must retain its qualifications and cannot be automatically promoted. PRIVATE evidence cannot silently support COMMERCIAL copy; prepare and approve redacted evidence separately.

## Integration and release blockers

1. Phase 2 originals and approved narratives have not been provided. Their provenance, custody, rights, claims and financial reconciliation cannot yet be verified.
2. `SectionModules` intentionally renders the timeline, gallery, pipeline, finance and structures only for DEMONSTRATION sections. `useVault` currently loads empty image/document arrays. Real module data requires a later adapter, preserving the approved presentation.
3. The existing gallery accepts a URL but has no private photo loader. Existing storage policies cover PDFs only. Do not repurpose public assets or assume a new photo bucket is authorised.
4. Current opportunity data lacks currency/provenance and requires numeric values. Current financial defaults are hypothetical, clamp values and exclude tax, financing, capex and collection timing. They cannot be used as actuals or a full financial forecast without a separately reviewed data/calculation adapter.
5. Current PDF metadata has no checksum, rights or evidence classification fields. The richer offline manifest must stay available until a deliberate storage/provenance schema plan is reviewed; no metadata is silently dropped or inserted now.
6. The local migration keeps `access_enabled` default false and seeds it disabled. This work leaves SQL, auth, storage, release gates and cloud configuration unchanged. Live Auth/Storage and PRIVATE/COMMERCIAL end-to-end acceptance remain unverified, as previously documented in SECURITY.md.

Before eventual insertion, review every claim and asset, reconcile actuals, approve disclosure/redaction, validate against the original bytes, then stage records unapproved/PENDING in a private environment. This preparation does not authorise publication or enabling the release gate.

## Verification completed

- `npm test`: **23 passed**, including 11 Phase 2 contract checks and the existing finance/security tests. Database policy tests use local fixtures, not a live backend.
- `npm run build`: **passed**. The existing lazy PDF bundle-size advisory remains. Frontend JS/CSS output hashes match the prior approved build because the intake module is not bundled.
- `npx playwright test`: **18 passed, 1 skipped**. The skip is the desktop duplicate of the mobile touch test; the mobile touch test passed. Desktop/mobile navigation, every section, modules, PDF viewing, print presentation and fail-closed unconfigured secure mode passed.
- SHA-256 matches confirmed the approved stylesheet, console/knob/OLED/index components, content registry and existing types were unchanged.
- `public/` still contains only `favicon.svg` and `_headers`. No Phase 2 source files were copied into assets or the bundle. The existing SQL release default remains false.
