# Private content ingestion — local preparation

For the single approved eleven-section master, optional laboratory showcase and separate dual-currency schedules, follow [Approved master intake](APPROVED_MASTER_INTEGRATION.md). The original record-manifest workflow below remains supported.

For independent narrative wording review and the prepared secure reader, follow [Narrative approval workflow](NARRATIVE_APPROVAL_WORKFLOW.md). No private record is automatically approved; the complete master export and confidential release remain gated.

For a master awaiting owner decisions, use the external `master-intake.json` envelope (`JB3_MASTER_INTAKE_V1`). It retains the section/interlude/schedule references and permits draft records and explicitly missing FX review metadata. `validate` checks it; `stage` rejects it before creating any output. The external `manifest.json` remains the record-level intake. Keep the envelope and manifest synchronized during reviewed edits. A complete approved-master presentation cannot be exported until every included record and its FX metadata passes the strict approved schema. Draft financial periods may be null; approved rows still require complete dates and amounts. Never convert blank spreadsheet inputs to zero obligations.

The approved console and mobile UI remain unchanged. Real sources are reviewed only in external private custody; populated records and review reports never belong in this document or repository. Demonstration mode stays synthetic; the secure reader uses the private narrative adapter. On 16 October 2026 the owner reported the two reviewed migrations applied as `20261016101851` and `20261016101857`, both release gates false and no investor content uploaded. These hosted findings have not been independently refreshed in this session. Do not reapply migrations or repair shared history. Live acceptance remains blocked by missing operator access; see [LIVE_SECURITY_ACCEPTANCE.md](LIVE_SECURITY_ACCEPTANCE.md).

## Exact source location

Place approved source documents and photographs under:

`C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content\sources\`

Use the eleven section subfolders created by `init`, such as `introduction`, `history-evidence`, and `financial-forecast`. The editable manifest is one level above them at `...\private-content\manifest.json`. Private output batches go to `...\private-content\batches\<batch-id>\`. These locations are outside Git, public assets and the Vite root. Keep originals, extracted narratives and populated manifests there. The directory relies on Windows account/filesystem protection; it is not an encrypted vault or a replacement for managed backup and permissions.

The repository scan found no original investor PDFs/DOCX/laboratory JPEGs. Documents attached to another application/project are not automatically local files. Copy approved originals into this external location; do not add them to the repository or send them through Superdesign.

## Commands (PowerShell from repository root)

```powershell
$privateRoot = 'C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content'
# init was run during setup; it refuses to overwrite an existing manifest.
npm.cmd run content:import -- validate "$privateRoot"
npm.cmd run content:import -- stage "$privateRoot"
```

For a new external intake directory, create it first, then run `npm.cmd run content:import -- init "<directory>"`. Node 24 is available here; the CLI uses Node TypeScript stripping. There is no public-export mode, upload command or release-enable command.

1. Review originals privately and extract narratives manually into manifest JSON; the importer does not OCR, summarise or fabricate document contents.
2. Keep the eleven section IDs/order from the generated manifest. Add records to the relevant section's `records` array. See `content-migration/ingestion-schema.ts` for the exact fields. Unknown fields and incomplete schema objects are rejected.
3. Assign a unique UUID, kind, classification, evidence verification and approval. Supply original filename, source date (or explicit null), citation/page reference, source reference, reviewer/date and unresolved-conflict note (or null). Original filenames remain only in private metadata; object keys use UUIDs/hashes.
4. `narrative` payload uses heading/body. `pdf` uses title. `photograph` uses caption/alt. `opportunity` uses name, stage, currency, valueMinor, probabilityPercent, asOf and `incomeTreatment: "prospective-only"`. `financial` uses label, kind, basis, amountMinor, currency, periodStart, periodEnd and reconciliationNote. No inferred probabilities, currency conversion or aggregation occurs.
5. File records additionally specify `file: { relativePath, sha256, mimeType }`, e.g. a path under `sources/history-evidence/`. For other record kinds set file to null. Obtain SHA-256 with `Get-FileHash -LiteralPath <external-file> -Algorithm SHA256`. Supported binaries: PDF, JPEG, PNG and WebP. Other originals can remain in private custody and be cited, but must be deliberately extracted/converted for display. Max 25 MiB per file, 100 MiB per batch, 10 MiB manifest. Hash and file-signature checks do not prove authenticity or replace malware scanning.
6. Run validate. It checks every record/file, including drafts; errors identify schema positions rather than dumping confidential text. Fix missing data, mismatches or unsafe paths explicitly. Unknown money stays null; an approved financial record needs a supplied amount.
7. Run stage. Only approved records enter a new immutable batch; drafts/rejected records are counted and withheld. Files are copied privately, and `batch.json` is written last as the completion marker. Failed partial batches must not be loaded. Metadata is prepared for `vault_content_records`; object keys target private `vault-evidence` storage. No SQL is executed and no network request is made by this importer.

Never treat `approval: approved` as independently verified by software: it records the owner's review decision. Documented means a cited record exists, not that every allegation is true. Reported/disputed narratives can be approved only as qualified accounts; disputed records require an unresolved-conflict note. Actual financial records require documented evidence, reconciliation and no unresolved conflict. Forecast revenue stays an assumption; signed pipeline never becomes actual income automatically. Preserve conflicting records with separate IDs and citations instead of merging them into a purported fact.

## Classification and authorisation

| Classification | Meaning | Read requirement |
|---|---|---|
| BRUCE_PRIVATE | Material explicitly cleared for the intended private investor | Explicit current BRUCE_PRIVATE grant |
| COMMERCIAL | Approved commercial material; **not public** | Explicit current COMMERCIAL grant |
| LEGAL_RESTRICTED | Restricted legal/family material | Explicit current LEGAL_RESTRICTED grant |

No hierarchy is inferred. BRUCE_PRIVATE cannot read LEGAL_RESTRICTED or COMMERCIAL without separate grants. A person's name is not authorisation. Existing PRIVATE/COMMERCIAL memberships do not automatically grant access to the new content tables. Grant verified account UUIDs deliberately. Redact and approve a separate record for wider disclosure; never relabel a restricted original casually.

The prepared migration creates `vault_content_settings`, `vault_content_grants`, `vault_content_records` and private `vault-evidence` storage. All tables use RLS and SELECT-only authenticated grants; no client writes, self-promotion or anonymous access. Records require approval, exact active/unexpired grants, and **both** `vault_settings.access_enabled` and `vault_content_settings.access_enabled`. Storage SELECT requires an accessible matching record; orphan/private paths do not bypass RLS. No records, user grants or enabled releases are seeded.

These policies follow the official [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access-control model](https://supabase.com/docs/guides/storage/security/access-control). Existing additional policies on a future hosted project must be audited, since permissive policies can broaden access.

## Authenticated adapters and remaining setup

`src/lib/privateContent.ts` exposes `loadApprovedSection(client, sectionId)` and `downloadApprovedAsset(client, recordId)`. Both verify the user and release gates first. The latter re-queries accessible metadata and uses authenticated Storage download; callers cannot supply arbitrary storage paths. Returned records retain classification, verification and provenance. No frontend service key, persistent content cache, signed-link shortcut or demo fallback is introduced. The adapter does not flatten disputes into VERIFIED narratives.

The narrative-only adapter is prepared in the secure SectionReader path and remains behind authentication, exact grants and both release gates. Asset adapters are not connected to that reader. The adapters do not implement a source uploader. An authorised owner must later apply/review the migration, scan and upload approved batch objects to the private bucket, insert corresponding metadata transactionally and verify hashes. Batch JSON omits local filesystem paths; original filenames remain private database fields. Do not load new classified content into the older two-tier tables.

Before confidential use:

- Verify the owner-approved shared Supabase project, the reported applied migration versions and existing policies/advisors. Preserve other JB3 applications and migration history; do not reapply the reviewed SQL or push local Auth configuration to the shared project.
- Use synthetic fixtures to test real sign-in/sign-out, unassigned/anonymous denial, all three grants, draft rejection, direct REST/Storage denial, expiry and revocation. Keep release false outside the controlled synthetic test window.
- Confirm bucket privacy, project policies, source review, Windows/private-backup permissions and any redaction requirements.
- Verify the prepared narrative reader live before confidential use; connect separately approved asset adapters later and clear records/blob URLs on sign-out. Downloaded/copied bytes cannot be revoked.
- Record live acceptance and obtain explicit confidential-release approval. No tooling in this change activates release.

## Public-build safeguards and scope

The local importer resolves real paths and rejects repository roots, ancestor roots, outside-root inputs and symlink output escapes. The production build guard allowlists the existing public favicon/headers, rejects ingestion/private paths in the frontend module graph, and rejects private-manifest markers and document binaries in output. Tests exercise these boundaries with synthetic files in OS temporary directories. An operator can still deliberately paste sensitive prose into ordinary source code: these controls are workflow/export boundaries, not universal data-loss prevention. Review future source changes and never import populated manifests into frontend modules.

## Validation completed

- `npm test`: **45 passed** across seven files. New tests cover private staging, schema/provenance rejection, unresolved financial disputes, real-path and symlink escapes, source hashes, public export boundaries, unauthenticated adapter calls, closed release gates, and exact-class database/storage policies.
- `npm run build`: **passed**. The existing PDF chunk-size advisory remains. Frontend output hashes match the approved checkpoint because no UI or runtime import changed.
- Full Playwright suite: **18 passed, 1 skipped**. Desktop duplicate touch check is skipped; mobile touch, every section, finance/pipeline, PDF/print and fail-closed secure mode passed.
- Local CLI initialisation and validation: **11 sections, 0 records, releaseEnabled=false**. No investor facts or source files were imported.
- Approved components, CSS, registry, financial demo and existing public assets have no diff from `eeef9c1`.

These results demonstrate local implementation and synthetic policy behaviour, not live Supabase Auth/Storage acceptance. Confidential release remains blocked pending the setup and acceptance steps above.
