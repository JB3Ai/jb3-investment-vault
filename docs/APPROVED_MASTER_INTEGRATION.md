# Approved master intake

The private intake supports supplied master sources without generating, summarising or substituting their wording. The console, mobile design, eleven-section registry and navigation remain unchanged. The current demonstration is not connected to private content. No deployment, push, live database change or confidential release is part of this phase. Source-specific findings and approval decisions are recorded only in external private custody.

## Exact private locations

Base: `C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content`

| Material | Location beneath the base |
|---|---|
| Approved master original (retain its original filename and extension) | `sources\master\` |
| Personal financial originals (XLSX/CSV/PDF) | `sources\financials\personal\` |
| Business financial originals (XLSX/CSV/PDF) | `sources\financials\business\` |
| Reviewed machine-readable master | `approved-master.json` |
| Laboratory photographs and supporting evidence | `sources\history-evidence\` |
| Other evidence | Existing `sources\<section-id>\` folders |
| Generated private web model and PDF | `batches\<batch-id>\presentation.json` and `investor-presentation.pdf` |

The master, Personal and Business subfolders have been created in this external base; they contain no supplied originals yet. Never put these files in the repository, `src`, `public` or `dist`. Original spreadsheet files remain custody sources, not public assets or automatically published attachments. Windows account permissions and private backup remain the owner's responsibility.

## Canonical contract

The accepted machine-readable envelope is defined by `content-migration/master-content.ts`:

During review, use `JB3_MASTER_INTAKE_V1` in `master-intake.json`. This review-only variant accepts draft records and null exchange-rate review/date fields, but cannot be staged or rendered as the approved presentation. Keep the separate record manifest synchronized. The strict approved format below remains the final export gate; changing only the format string cannot bypass pending approvals or missing metadata.

```
{ format: "JB3_APPROVED_MASTER_V1",
  content: <existing JB3_PRIVATE_CONTENT_V1 manifest, releaseEnabled: false>,
  laboratoryShowcase: null | { title: <approved title>, recordIds: [...] },
  financialSchedules: { personal: [...financial record UUIDs], business: [...] },
  exchangeRate: null | { zarPerGbp: <positive number>, asOf: "YYYY-MM-DD",
    source: <explicit assumption source>, approvedBy: <reviewer>, approvedOn: "YYYY-MM-DD" }
}
```

This is a contract illustration, not approved content. No populated template is committed. The single `content` manifest owns every narrative, financial row and evidence record; the other fields reference it rather than copying or rewriting its text. Use the existing ingestion schema for full record fields and review requirements. All included records must be approved; hold drafts separately. Classification remains BRUCE_PRIVATE, COMMERCIAL or LEGAL_RESTRICTED. Every record retains its provenance, evidence status, approval and conflict note. Metadata approval is an owner's recorded decision, not independent verification by the importer.

Retain exact supplied headings and body strings, including paragraph breaks and punctuation. Each of the eleven sections requires its own approved narrative. The importer rejects incomplete/misordered section lists and never guesses headings, extracts prose from a DOCX/PDF, or reconciles financial conflicts. If the supplied original is not already this JSON format, perform a lossless transcription into the external envelope and review it against the original before staging. Keep citations to the original filename and pages. Complete this comparison against the supplied original before promoting the review intake.

The optional showcase references approved narrative/photo/PDF records held in history-evidence. The canonical presentation moves those records to a separate unnumbered block immediately after 03 and before 04; it never adds a twelfth navigation section. Main Section 03 must retain its own narrative. Null means no showcase. The text PDF includes captions and evidence metadata/references; original photographs and PDFs remain separate private supporting files, not embedded in this text edition.

Every financial record must belong to exactly one schedule. Personal and Business stay separate, with no combined total or assumed cash transfer. Empty schedules explicitly report no approved figures. Each row retains its original integer minor-unit amount, currency, period, basis and reconciliation note. With any figures present, an approved exchange-rate assumption is mandatory: **1 GBP = zarPerGbp ZAR**. Both currencies are formatted using that assumption, conversions round to the nearest penny/cent, and originals remain unchanged. No live rate, default rate, forecast income or missing amount is inferred. Spreadsheet formulas, totals and discrepancies require explicit owner reconciliation before approved structured rows are entered.

## Local workflow

```powershell
$privateRoot = 'C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content'
npm.cmd run content:import -- validate "$privateRoot" approved-master.json
npm.cmd run content:import -- stage "$privateRoot" approved-master.json
```

Staging reuses the existing path, hash, media and approval checks. For a master envelope it also writes an immutable approved-master snapshot, a canonical presentation model and a text PDF using installed Playwright Chromium. The PDF renderer disables JavaScript, escapes content and blocks network requests. All output is private, outside the repository. `batch.json` is the completion marker and records the input SHA-256; ignore any incomplete batch lacking it. Chromium must be installed (`npx.cmd playwright install chromium`) before master staging. Validation alone does not require Chromium.

The PDF and future web view derive from the same `canonicalPresentation` model. The PDF is currently a local owner-review/download artifact, not a public link or authenticated investor download. The future authenticated web adapter must deliver an authorized canonical snapshot together with its matching PDF; loading individual database rows alone loses showcase/schedule associations. Do not upload the full snapshot or generated PDF under a single weaker classification: each is a composite of all contained classes and requires all corresponding grants, or a separately reviewed audience-specific edition. The existing record-level RLS/storage adapters are unchanged. A dedicated authenticated composite-artifact delivery path and live Supabase tests are prerequisites before wiring these outputs into the existing interface.

Release remains disabled. Live sign-in, row and storage policies, exact-class grants, anonymous/unassigned denial, expiry/revocation, composite PDF permissions and logout cleanup remain untested on a dedicated Supabase project. Local tests do not authorize confidential release.

## Preparation validation (before real-source intake)

- 50 unit tests passed, including an actual offline Chromium PDF generated from synthetic master content.
- Production build passed; the existing large PDF chunk advisory remains.
- All 18 applicable browser tests passed with one expected desktop touch skip. A one-worker confirmation run also passed all assertions; Playwright recorded `status: passed` with no failed tests. The initial two-worker run stalled between groups before completing its assertions.
- Approved UI components, CSS, registry, navigation, demo finance and public assets have no source diff.
- No real narrative, financial figures or private evidence has been ingested. No commit, push, deployment or confidential release was performed in this phase.
