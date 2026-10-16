# Shared Supabase compatibility review

Prepared 15 October 2026 for **JB3Ai's Command Dash**, project reference `uxeolplwhtyyefpmwktw`, URL `https://uxeolplwhtyyefpmwktw.supabase.co`.

This is a local, conditional compatibility report and application plan. No database changes, user creation, content upload, project linking, configuration push, Git publication or deployment were performed. The approved console and private content were not modified. The two reviewed migration files remain unchanged.

## Evidence and approval boundary

The owner supplied the initial remote findings: project active; no Vault-specific public tables/policies/buckets; twelve migration entries for other JB3 systems. These findings are accepted as supplied evidence, not independently refreshed in this session. The read-only CLI project-list attempt failed because no Supabase access token is configured. No live compatibility or security PASS is claimed.

The metadata-only query pack is [shared-project-read-only.sql](../supabase/preflight/shared-project-read-only.sql). It is outside the migrations directory and must never be applied as a migration. Its executable statements are BEGIN READ ONLY, SELECT and ROLLBACK. It does not select application records, Auth user identities, passwords or function bodies. Run it only after verifying the dashboard project identity. Store exported hosted metadata privately, outside Git/public assets; inspect relevant trigger/function bodies separately in trusted operator custody.

Missing live evidence: current migration versions and definitions; database version; all Storage policies including ALL/write policies; grants/default privileges; DDL event triggers; Auth user-creation triggers/hooks; hosted Auth configuration. Approval to change the shared database is still required after this evidence and the exact migration batch have been reviewed.

## Reviewed files and order

| Order | Existing SQL file | SHA-256 |
|---|---|---|
| 1 | `supabase/migrations/20261013195840_vault_access.sql` | `a5e8235c75b1e27d946b9b1a0445124fd0ab444b64f315488ff76303142d3425` |
| 2 | `supabase/migrations/20261014085915_private_content_ingestion.sql` | `87167e891c24f70ebde0c1f753ec728e18240ec626dd50f0b8219e0554419943` |

The second file depends on the first file's `public.vault_settings`. Both are additive but not idempotent: plain CREATE TABLE/INDEX/POLICY and bucket INSERT fail on conflicting names. Do not hide conflicts with IF NOT EXISTS or overwrite existing objects.

## Object inventory and scope

| File | New objects/data |
|---|---|
| 1 | `public.vault_settings`, `public.vault_memberships`, `public.vault_sections`, `public.vault_documents` |
| 1 | Explicit index `vault_documents_section_idx`; table-derived primary/unique indexes and constraints |
| 1 | Singleton `vault_settings(id=1, access_enabled=false)` |
| 1 | Private bucket `vault-documents`, PDF only, 25 MiB limit |
| 1 | Four table SELECT policies and one `storage.objects` SELECT policy |
| 2 | `public.vault_content_settings`, `public.vault_content_grants`, `public.vault_content_records` |
| 2 | Explicit index `vault_content_class_section`; table-derived primary/unique indexes and constraints |
| 2 | Singleton `vault_content_settings(id=1, access_enabled=false)` |
| 2 | Private bucket `vault-evidence`, PDF/JPEG/PNG/WebP, 25 MiB limit |
| 2 | Three table SELECT policies and one `storage.objects` SELECT policy |
| Both | RLS and privileges only on the seven newly created Vault tables; no new functions, triggers, roles, extensions, users, grants-to-users or content records |

All new table/index/constraint names have Vault prefixes (implicit constraint/index names inherit their Vault table names). Storage namespaces are `vault-documents/<path>` and `vault-evidence/<classification>/<record-uuid>/<sha256>`. Neither migration creates Storage objects; it inserts only the two new bucket rows. Classification strings remain exactly `BRUCE_PRIVATE`, `COMMERCIAL`, `LEGAL_RESTRICTED`; they have no hierarchy and confer no rights in other applications.

Policy inventory, scoped to its relation:

- `vault_settings`: `Read release state`.
- `vault_memberships`: `Read own current membership`.
- `vault_sections`: `Read authorised sections`.
- `vault_documents`: `Read authorised documents`.
- `vault_content_settings`: `Read content release state`.
- `vault_content_grants`: `Read own exact content grants`.
- `vault_content_records`: `Read explicitly granted approved content`.
- Shared `storage.objects`: `Read authorised vault objects` and `Read approved private evidence objects`.

Policy names are relation-scoped. Generic table-policy names cannot collide on unrelated tables. Both shared Storage policy names must be checked for exact collisions even if no existing bucket is Vault-specific. No existing application table/policy is dropped, replaced or altered. The intentional shared-surface additions are two bucket metadata rows and two new SELECT policies on `storage.objects`; their bucket predicates are false for unrelated buckets.

## Dependencies and shared-project risks

1. **Platform dependencies.** References to `auth.users(id)` from memberships/grants; `auth.uid()` and `auth.jwt()` in policies; platform roles `anon`, `authenticated`, `service_role`; existing `storage.buckets`/`storage.objects` and enabled Storage RLS; `gen_random_uuid()` for legacy document IDs. There is no direct dependency on `public.profiles`, existing JB3 functions, custom profiles/roles or extensions. Validate actual platform objects/version remotely; local configuration requests PostgreSQL 17. Deleting a shared Auth user cascades only that user's Vault membership/grant rows; the Vault migrations do not delete Auth users.
2. **Indirect Auth provisioning.** Existing triggers/hooks on `auth.users` can create profiles, assign roles or require metadata when a synthetic user is later created. Review these before any user creation. Do not disable/change shared triggers or assume creating a test user is isolated from other JB3 apps. [Supabase user-data triggers](https://supabase.com/docs/guides/auth/managing-user-data).
3. **Storage policy composition.** Existing broad SELECT/ALL policies may permit Vault reads despite the new policies; existing INSERT/UPDATE/DELETE/ALL policies may permit Vault writes. Existing restrictive policies can instead deny intended reads. Evaluate all roles, predicates and inherited role memberships. Permissive policies combine with OR, restrictive policies with AND. If conflicts exist, stop and propose separately approved, additive Vault-bucket-only restrictive guards that evaluate true for unrelated buckets; never remove/replace shared policies. Verify unrelated-bucket behavior before and after. [PostgreSQL policy composition](https://www.postgresql.org/docs/17/sql-createpolicy.html).
4. **Privileges and DDL triggers.** The SQL revokes PUBLIC/anon/authenticated privileges on only its new tables, then grants authenticated SELECT and trusted service-role administration. Existing default grants to other custom roles or DDL triggers may still affect new tables; inspect them and effective roles. Service-role/secret credentials bypass RLS and are excluded from end-user security probes. Other JB3 backends using this project's privileged credentials therefore share the Vault administrative trust boundary. Review exposed security-definer/dynamic-SQL RPCs and generic backend data routes for unintended access to new Vault tables; exact client grants do not isolate data from privileged shared operators/backends. [Supabase elevated API keys](https://supabase.com/docs/guides/getting-started/api-keys).
5. **Migration-history divergence.** This checkout contains only two Vault migration files; the reported shared history contains twelve unrelated entries. Do not run a blind `db push`, `--include-all`, `migration repair`, remote reset or a history rewrite from this checkout. Obtain the authoritative shared migration workflow and preserve all twelve versions/definitions. Check whether the Vault timestamps precede the latest hosted version. If so, propose fresh ordered migration versions after that head (same reviewed SQL, new filenames) before approval; do not renumber already-applied shared migrations. No CLI dry run has been performed here. [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).
6. **Global Auth settings.** Email/password provider, signup, anonymous sign-in, JWT lifetime, password rules, SMTP, Auth hooks, Site URL and allowed redirects are shared. Do not push this repository's `config.toml` to the hosted project or overwrite existing settings to match the prior dedicated-project proposal. Preserve other apps' settings and obtain separate approval for any global change.
7. **Legacy permissions differ.** Legacy PRIVATE membership permits legacy drafts. New content requires explicit exact-class grants, approved status and both release gates. Never place restricted content in legacy tables. Vault navigation still needs safe legacy section metadata/membership independently of classification grants. Use synthetic legacy metadata for the later UI test; a legacy PRIVATE membership must not bypass the new grants.
8. **Data checks are not identical to the importer.** SQL JSON/date/media checks are less strict than local import validation, including nullable CHECK-expression cases. Trusted operators must use the existing validator. No client writes are granted by these migrations; shared policies/default grants still require the review above.

## Configuration to verify, not apply

Existing local defaults: `site_url=http://127.0.0.1:5173`, empty additional redirects, password sign-in, signup/anonymous sign-in disabled, JWT expiry 900 seconds, refresh rotation enabled, minimum password length 6. These are not evidence of hosted settings and must not overwrite shared settings.

For Vault local acceptance after approval, the ignored frontend environment would be:

```dotenv
VITE_VAULT_MODE=secure
VITE_SUPABASE_URL=https://uxeolplwhtyyefpmwktw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<this-project-publishable-key>
```

No environment file was created. Privileged credentials belong only in trusted operator tooling, never `VITE_*`, source code or test reports. CLI access requires a configured login or `SUPABASE_ACCESS_TOKEN`; migration application also needs the approved project's operator database access. Neither is available in this session.

Verify email/password is enabled and test passwords satisfy existing hosted rules. Do not weaken passwords or disable shared signup/anonymous providers merely for Vault isolation; Vault access relies on membership/exact grants and policies that reject anonymous-auth identities. Review JWT expiry/rotation and record any residual token window without changing shared lifetime settings automatically.

Preserve the shared project's current Site URL and existing redirect allowlist. Password `signInWithPassword` does not redirect. If an approved email/reset flow later needs redirects, append only the exact local Vault URL actually used, `http://127.0.0.1:5173/`; optionally `http://localhost:5173/` only if used. Do not add broad wildcards or replace another application's Site URL. Ports 5174/5175 are existing mocked test servers, not requested hosted redirects. The current app has `detectSessionInUrl:false` and no completed invitation/reset callback; allowlisting alone does not implement those flows. SMTP/email-template changes and emails/invitations are outside this approval. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Proposed application sequence; approval required

1. Verify project reference/name/organization/URL against authenticated project metadata. Capture read-only preflight results and hosted Auth configuration privately. Confirm all proposed names are absent, required platform functions exist, and shared policies/triggers/default grants are compatible.
2. Inventory the twelve remote migration versions using the optional read-only history query. Obtain their authoritative migration files/workflow without changing history. Choose compatible new Vault version IDs if needed. Preserve before-state fingerprints for unrelated schemas, policies, buckets and migration entries.
3. Present exact final filenames, reviewed SQL hashes, pending migration list and any narrowly scoped policy amendments for explicit owner approval. Shared Auth changes, if necessary, require their own impact review/approval. Do not use the current two-file checkout to apply unrelated missing history.
4. After approval only, apply the first Vault SQL in the shared project's established transactional migration workflow. Verify its new gate is false and bucket private. Apply the second next, then verify both gates false, exact grants, RLS/ACLs and both private buckets. If a migration fails, stop; use transaction rollback for that operation, not a reset/drop of shared resources.
5. Compare unrelated objects/policies/bucket definitions and all twelve historical entries against the before-state. No differences are acceptable except the specifically approved Vault additions and the two new migration-history entries.
6. Seek approval for the scoped synthetic acceptance execution if not already included in the concrete approved batch. Create only tagged synthetic accounts/records/documents after reviewing Auth provisioning effects. Never use the external private manifests as test seeds.
7. Run the matrix below with a bounded synthetic-only gate window and trusted operator cleanup/finally restoration. Verify both gates false at exit even on failure; if the test process loses connectivity, a designated operator must restore/check them directly. No real investor content may be present during an open test window.

## Synthetic security acceptance plan

Every case is currently **NOT RUN LIVE**. Local PGlite and mocked-browser tests are implementation evidence only.

| Area | Cases and required evidence |
|---|---|
| Identities | Separate BRUCE_PRIVATE, COMMERCIAL, LEGAL_RESTRICTED, unassigned and legacy-only synthetic users; no auto-grants from existing JB3 profile/roles; password success/failure and refresh behavior |
| Exact classification | Each account reads only its explicitly granted approved class; Bruce cannot read commercial/legal without separate grants; unassigned, anon and anonymous-auth denied; legacy PRIVATE alone grants no new content |
| Approval | Approved vs draft/rejected/awaiting-verification rows; direct ID queries and listing; expected denial is empty rows or policy/privilege errors, never returned private bytes |
| Gates | New content/assets denied at false/false, true/false and false/true; true/true permits only authorized synthetic rows; legacy route depends on its own gate, so all legacy rows must also be synthetic |
| Storage | Real synthetic PDF/JPEG upload through trusted operator only; private bucket flags; authorized download; class-crossing, orphan, guessed paths, public endpoints and draft-object denial; content SHA-256; client upload/overwrite/delete denied |
| Privilege escalation | Client attempts to self-grant, approve rows, change either gate, alter/delete metadata or use another user's UUID are denied |
| Revocation/expiry | Revoke/expire exact grant and legacy membership; new REST/Storage reads and new signing denied; keep captured JWT tests separate from UI logout; already-fetched bytes cannot be recalled |
| Sign-out | Actual app sign-in and local sign-out; all rendered content cleared; delayed responses cannot restore content; refresh for the signed-out session rejected; document signed-link lifetime and JWT residual window measured separately |
| UI | Real authorized synthetic narrative in the existing reader, exact paragraphs/provenance, loading/unavailable/denied states, desktop/mobile navigation; no UI redesign |
| Shared regression | Existing JB3 login/navigation behavior, buckets and relevant access unchanged; existing users' Vault queries denied without new exact grants; preserve unrelated rows/policies/history |
| Cleanup/report | Close both gates first; revoke test-only grants/memberships; remove only run-tagged synthetic objects/records and approved synthetic users after checking shared-trigger side effects; preserve unrelated data; report PASS/FAIL/NOT RUN with timestamps and redacted evidence |

The new asset adapter uses authenticated download. The legacy library uses signed URLs; existing links may survive grant revocation until expiry, and the client-chosen 60-second URL lifetime is not a server-enforced maximum. JWTs can also remain valid after sign-out until expiry; these limits must be reported rather than mislabeled as immediate revocation. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [Storage downloads](https://supabase.com/docs/guides/storage/serving/downloads).

Until explicit approval and successful acceptance, both release gates remain false by migration defaults. No shared gate rows exist according to the supplied initial inspection; no hosted gate state was queried or changed in this session. Confidential loading/release, Cloudflare deployment and GitHub push remain unauthorized.

## Preparation validation

The metadata-only preflight pack executes successfully against synthetic embedded PostgreSQL (14 statements). Both existing SQL migration SHA-256 hashes remain unchanged. These checks validate local query syntax and reviewed-file integrity; they do not establish hosted compatibility or live security acceptance. No application-code or UI changes require a new build/browser run in this documentation/preflight-only task.
