# Security handoff

## Current status

Safe for local demonstration with synthetic content. **Not approved for confidential production material.**
No hosted project, authentication account, document bucket or deployment has been altered.
The UI animation is not an authentication mechanism.

The new offline ingestion path is documented in [PRIVATE_CONTENT_INGESTION.md](docs/PRIVATE_CONTENT_INGESTION.md). Its prepared migration uses separate BRUCE_PRIVATE, COMMERCIAL and LEGAL_RESTRICTED grants, with no automatic hierarchy or mapping from legacy PRIVATE membership. Both the existing and new content release switches must be enabled for new records to be readable; both remain disabled. No live migration has been applied. The two-tier model below describes the existing application path, not permission to place new restricted records into legacy tables.

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

1. Choose a dedicated Supabase project; review the migration and existing policies. Do not apply to an unrelated project.
2. Apply `supabase/migrations/*_vault_access.sql` through the approved migration workflow. Existing permissive policies on Storage must not broaden this bucket's access.
3. Keep signup/anonymous access disabled; configure password policy, email delivery, URL settings and short JWT lifetime. Consider MFA for the intended risk profile.
4. Create separate synthetic PRIVATE, COMMERCIAL and unassigned test accounts. Add memberships only through a trusted owner operation.
5. Load synthetic approved, unapproved, private and commercial sections and PDF fixtures only. Temporarily enable `vault_settings.access_enabled` for those synthetic integration tests.
6. Verify password sign-in, sign-out, unauthenticated denial, unassigned denial, approval rules, direct REST access, direct Storage access, URL issuance and expiry, role revocation, and expired membership against the real services. Confirm the bucket is not public and inspect Supabase security advisors.
7. Confirm production CSP, HTTPS, cache headers and the correct Cloudflare/Supabase account. Set the exact Supabase host in CSP if using a custom domain.
8. Record the evidence, then obtain authorisation before loading confidential material or deploying. Leave the access switch false if verification is incomplete.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Signed URL behaviour](https://supabase.com/docs/guides/storage/serving/downloads)
- [Cloudflare SPA assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
