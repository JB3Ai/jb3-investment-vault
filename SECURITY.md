# Security handoff

## Current status

Safe for local demonstration with synthetic content. **Not approved for confidential production material.**
The owner reported installation of the reviewed Vault migrations on the shared Supabase project on 16 October 2026. The recorded versions are `20261016101851` (`vault_access`) and `20261016101857` (`private_content_ingestion`). Do not reapply the local files or repair shared migration history. The owner reports seven tables, two private buckets, nine policies, both gates false and no investor content uploaded; these hosted findings have not been independently refreshed in this session. Live acceptance remains **BLOCKED / NOT RUN** because privileged operator access is unavailable. See [LIVE_SECURITY_ACCEPTANCE.md](docs/LIVE_SECURITY_ACCEPTANCE.md).
The UI animation is not an authentication mechanism.

The offline ingestion path is documented in [PRIVATE_CONTENT_INGESTION.md](docs/PRIVATE_CONTENT_INGESTION.md). Its migration uses separate BRUCE_PRIVATE, COMMERCIAL and LEGAL_RESTRICTED grants, with no automatic hierarchy or mapping from legacy PRIVATE membership. Both release switches must be enabled for new records to be readable; leave both false outside approved synthetic test windows. The two-tier model below describes the legacy application path, not permission to place new restricted records into legacy tables.

## Enforcement model

- Supabase email/password Auth; no public registration interface. Local Supabase signup and anonymous sign-in are disabled.
- `vault_memberships` is owner-managed. Users can read only their own active, unexpired membership and cannot promote themselves.
- PRIVATE membership can read private and commercial rows, including drafts.
- COMMERCIAL membership can read only approved COMMERCIAL sections and documents.
- A document also requires access to its parent section.
- All four public tables use RLS, explicit SELECT-only authenticated grants and no client write policies.
- Anonymous requests have no grants to these tables. Anonymous-auth identities cannot read a membership.
- No user-editable JWT metadata is used for authorisation; membership is checked in Postgres on each new read.
- `vault_settings.access_enabled` defaults to false. Only a trusted owner/server operation can enable it.
- The `vault-documents` bucket is private, PDF-only, with a 25 MiB upload limit. Object SELECT requires a visible matching document row.
- Metadata-free orphan objects are inaccessible. No client upload, delete or overwrite policy is supplied.
- The browser requests a 60-second signed URL using the current user's JWT. Storage applies RLS before signing. The reader closes its viewing session at 55 seconds.
- No service-role key, database password or production secret belongs in frontend variables, local example files or Git.
- The browser keeps Auth sessions in memory. Sign-out clears the rendered private content. No service worker or offline document cache is implemented.

## Important limits

Signed URLs remain usable until expiry even after membership revocation. Content already fetched, copied, printed or downloaded cannot be revoked; this is access control, not DRM.
The client-supplied 60-second expiry is a UI policy; Supabase's direct signed-URL API can be called with another expiry by an already authorised user. If hard enforcement of maximum URL lifetime is required, route signing through a dedicated backend and restrict direct signing before production.
The app does not block screenshots or copying. The executive briefing is printable.
PRIVATE is a database membership, not a name inferred from “Bruce”. Grant access only to the verified intended account.

## Verified locally

The actual migration is executed against embedded PostgreSQL using PGlite with minimal fixtures for `auth.uid()`, `auth.jwt()`, Auth users and Storage tables. Tests cover disabled release state, unauthenticated requests, non-members, anonymous-auth users, both access tiers, unapproved rows, parent-section visibility, direct private paths, orphan objects, membership expiry/revocation and rejected writes/self-promotion.

These are SQL policy tests, **not live Supabase service tests**. Docker was unavailable, so Auth and Storage services have not been exercised together. The browser also tests that secure mode with missing configuration fails closed.

## Before any confidential use

1. Verify the owner-approved shared project and existing policies using the [compatibility assessment](docs/SHARED_SUPABASE_COMPATIBILITY.md). Preserve unrelated JB3 resources, Auth settings and migration history.
2. Verify the two owner-reported applied migrations and all effective policies; do not reapply them. Existing permissive policies on Storage must not broaden Vault access.
3. Inspect shared password authentication, JWT lifetime, providers, email delivery, URLs and triggers without changing them. Any shared-setting change requires separate impact review and approval. Vault membership/grant policies reject anonymous-auth content access independently of other applications' provider settings.
4. Create separate synthetic PRIVATE, COMMERCIAL and unassigned test accounts. Add memberships only through a trusted owner operation.
5. Load synthetic legacy metadata plus approved/draft records for all three exact classifications and synthetic PDF/image fixtures only. Test each release-gate combination in a bounded synthetic-only window and restore both gates false afterward.
6. Verify password sign-in, sign-out, unauthenticated denial, unassigned denial, approval rules, direct REST access, direct Storage access, URL issuance and expiry, role revocation, and expired membership against the real services. Confirm the bucket is not public and inspect Supabase security advisors.
7. Confirm production CSP, HTTPS, cache headers and the correct Cloudflare/Supabase account. Set the exact Supabase host in CSP if using a custom domain.
8. Record the evidence, then obtain authorisation before loading confidential material or deploying. Leave the access switch false if verification is incomplete.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Signed URL behaviour](https://supabase.com/docs/guides/storage/serving/downloads)
- [Cloudflare SPA assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
