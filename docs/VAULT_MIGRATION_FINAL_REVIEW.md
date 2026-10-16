# Final Vault migration approval review

Date: 15 October 2026. Intended shared project: `uxeolplwhtyyefpmwktw` (JB3Ai's Command Dash).

**Recommendation: PASS for the reviewed additive SQL and installation with both gates disabled, after explicit owner approval. No SQL corrections are required for that scope.** This is not a live Auth/Storage acceptance result or permission to load confidential content. Neither migration was applied remotely.

The latest live findings were supplied by the owner: seven Vault tables absent; both Vault buckets absent; no Vault-specific policies; seven existing Storage policies restricted to `documents` and `media`; existing shared migration history must remain intact. These are accepted as supplied inspection evidence, not independently refreshed hosted results in this review. No authenticated hosted database query was available in this session.

## Exact approved-review inputs and application order

| Order | SQL filename | SHA-256 |
|---|---|---|
| 1 | `20261013195840_vault_access.sql` | `a5e8235c75b1e27d946b9b1a0445124fd0ab444b64f315488ff76303142d3425` |
| 2 | `20261014085915_private_content_ingestion.sql` | `87167e891c24f70ebde0c1f753ec728e18240ec626dd50f0b8219e0554419943` |

File 2 requires `public.vault_settings` from file 1. Platform prerequisites are `auth.users(id)`, `auth.uid()`, `auth.jwt()`, `gen_random_uuid()`, the Supabase platform roles, and existing Storage tables with RLS enabled. Neither file depends directly on `public.profiles`, custom JB3 functions or a new extension.

## Exact migration inventory

The companion [VAULT_MIGRATION_INVENTORY.json](VAULT_MIGRATION_INVENTORY.json) records every table, policy expression, index definition, constraint, non-null column default, bucket and gate obtained by executing these exact files against synthetic embedded PostgreSQL. It is a local catalog inventory, not a hosted schema dump.

| Migration | New tables | Explicit index | Bucket and seed |
|---|---|---|---|
| 1 | `vault_settings`, `vault_memberships`, `vault_sections`, `vault_documents` in `public` | `vault_documents_section_idx` | `vault-documents`: private, PDF, 25 MiB; one settings row with `access_enabled=false` |
| 2 | `vault_content_settings`, `vault_content_grants`, `vault_content_records` in `public` | `vault_content_class_section` | `vault-evidence`: private, PDF/JPEG/PNG/WebP, 25 MiB; one content-settings row with `access_enabled=false` |

Total: seven new tables, nine SELECT policies, twelve indexes (two explicit and ten primary/unique indexes), 38 CHECK/primary-key/foreign-key/unique constraints plus 38 NOT NULL requirements, and two private bucket rows. The embedded server lists NOT NULL constraints in `pg_constraint`, yielding 76 catalog entries; older PostgreSQL catalogs may expose them only as column metadata. The inventory records the embedded server version; do not require the hosted catalog to use the same representation. No Storage objects, Auth users, memberships, classification grants, narratives, financial records or evidence are seeded. No functions, triggers, roles or extensions are created or changed. The existing seed file is empty.

## Every policy reviewed

All nine policies target only `authenticated` and only SELECT. No policy targets `anon` or authorizes client INSERT, UPDATE or DELETE.

| Relation / policy | Effective scope |
|---|---|
| `vault_settings` / `Read release state` | Only the Vault settings table's release flag; table constrains singleton ID to 1 |
| `vault_memberships` / `Read own current membership` | Current user's own active, unexpired membership; anonymous-auth excluded |
| `vault_sections` / `Read authorised sections` | First gate true plus visible own membership; PRIVATE can read legacy drafts, COMMERCIAL only approved COMMERCIAL sections |
| `vault_documents` / `Read authorised documents` | First gate true, visible parent section and own membership; same legacy disclosure/approval rules |
| `storage.objects` / `Read authorised vault objects` | Exactly `bucket_id='vault-documents'` and matching visible document metadata; false for `documents`, `media` and all other buckets |
| `vault_content_settings` / `Read content release state` | Only the Vault content-settings release flag; singleton ID 1 |
| `vault_content_grants` / `Read own exact content grants` | Own active, unexpired explicit classification grants; anonymous-auth excluded |
| `vault_content_records` / `Read explicitly granted approved content` | Approved and not awaiting verification, both gates true, and visible own grant with exactly matching classification |
| `storage.objects` / `Read approved private evidence objects` | Exactly `bucket_id='vault-evidence'` plus visible matching photo/PDF record; false for every other bucket |

Membership/grant subqueries are subject to their own RLS, which supplies user, expiry, active and anonymous-auth checks. `BRUCE_PRIVATE`, `COMMERCIAL` and `LEGAL_RESTRICTED` remain exact independent classifications; legacy membership does not create or imply these grants. Default `active=true` takes effect only after a trusted operator explicitly inserts a membership/grant; nothing auto-promotes an account.

The `anon` database role has no privileges on any Vault table. Anonymous-auth identities are authenticated database callers, so the two settings policies intentionally expose release flags to them as to other signed-in callers; protected memberships/grants/content remain inaccessible. Thus the PASS covers denial of anonymous investor content, not a claim that harmless gate-state metadata is hidden from every signed-in identity.

Each migration revokes PUBLIC/anon/authenticated privileges on only its newly created Vault tables, grants authenticated SELECT, and reserves administration for service_role. There are no end-user table-write privileges. Existing shared Storage policies are reported as confined to other buckets and therefore do not authorize Vault writes. Supabase Storage requires corresponding RLS permissions for operations. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Effects on existing applications

No DROP, CREATE OR REPLACE, existing application-table ALTER/DML, global-role alteration, shared-policy replacement, Auth setting change or migration-history mutation is present in either file. The intentional shared-surface additions are two new rows in `storage.buckets`, two new SELECT policies on `storage.objects`, and foreign-key dependencies from new Vault tables to `auth.users`. Existing Storage bucket rows/policies are not updated or deleted. New Storage predicates evaluate false outside their own Vault buckets, so they do not broaden other-bucket permissions. DDL can take locks, including while establishing Auth-user foreign keys; use short controlled migration transactions.

Neither migration changes password providers, signup/anonymous sign-in settings, JWT lifetime, Site URL, redirects, SMTP, MFA or Auth hooks. Do not execute a config push alongside migration application. Synthetic user creation later can invoke existing shared Auth/profile triggers and must be reviewed separately.

Privileged service-role backends, table owners and BYPASSRLS roles remain trusted administrators; RLS does not isolate the Vault from those shared privileged systems. Review exposed privileged RPCs/backend routes before real content use. Existing policy composition remains relevant: permissive policies combine with OR. [PostgreSQL RLS behavior](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Final installation checklist

- [x] Read both SQL files in full and record exact hashes.
- [x] All seven new public tables enable RLS explicitly.
- [x] Both `access_enabled` columns are NOT NULL with false defaults; inserted singleton rows start false.
- [x] Both bucket rows are private and constrained to 25 MiB and intended MIME types.
- [x] New Storage policies are bucket-specific and require authorized matching metadata.
- [x] No anonymous investor-content access, client table writes, automatic memberships/grants or self-promotion supplied.
- [x] No existing Auth configuration, JB3 application tables, existing policies or historical migration rows changed by these SQL files.
- [x] Application order and platform dependencies reviewed.
- [x] Existing local SQL policy tests pass: 17 tests across two files.
- [x] Synthetic shared-project regression preserves other-bucket metadata/read behavior, seven representative other-bucket policies, twelve synthetic historical migration rows and existing application/profile rows.
- [ ] Obtain explicit approval to apply these exact reviewed inputs to the named shared project; this review is not that approval.
- [ ] Immediately before application, recheck project identity and file hashes; verify name absence, including implicit index names and both exact Storage policy names.
- [ ] Use the authoritative shared-project migration executor/history workflow. Preserve all existing migration versions and definitions. Confirm only the two reviewed Vault changes are pending. If history/version ordering conflicts, stop and review the application mapping; do not blindly push this two-file checkout, reset the project, repair history or use include-all to bypass a discrepancy.
- [ ] Verify platform prerequisites, effective/default grants and relevant DDL triggers in the hosted execution context. No unreviewed hooks or extra grants should be introduced during application.
- [ ] Apply migration 1 transactionally and verify its gate false; apply migration 2 next and verify both gates false, all RLS/ACLs and private bucket flags. Roll back the failed operation and stop if an error occurs; do not delete shared resources to force completion.
- [ ] Confirm all existing history entries, application objects, shared bucket definitions and policies remain unchanged, apart from the specifically approved Vault additions and new history entries from the migration executor.
- [ ] Run live synthetic Auth/REST/Storage, classification, revocation/expiry, gate and shared-application regression tests before any confidential loading/release. Report actual PASS/FAIL/NOT RUN results and restore both gates false after the controlled window.

No SQL corrections are required for installing the empty, closed Vault schema under the supplied inspection findings. Existing SQL metadata/date/media checks are weaker than importer validation and can admit malformed trusted-owner inputs via nullable CHECK cases; retain the importer validation requirement. This does not grant client writes, but data hardening should not be confused with independent evidence verification. Legacy draft access, residual JWT/signed-link lifetimes and privileged shared backends remain documented limits of later confidential acceptance.

## Validation scope

The 17 policy tests execute actual SQL using embedded PostgreSQL, synthetic platform roles and mocked Auth/Storage tables. The separate catalog/regression review applies exact migration bytes transactionally in another embedded database. Its seven Storage policies and twelve history rows are representative synthetic fixtures, not copies of the live project's definitions. The complete inventory JSON makes that distinction explicit. No live services, real accounts or private sources were used, and no live acceptance PASS is asserted.

Only review documentation/inventory files were added. Migration SQL, frontend, approved design and private source documents remain unchanged. No live application, confidential upload, release activation, push or deployment occurred.
