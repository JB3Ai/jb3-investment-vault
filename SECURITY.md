# Security handoff

## Current status

Safe for local demonstration with synthetic content. **Not approved for confidential production material.**
The 17 October 2026 focused retest isolated a cached Storage authorization window on shared project `uxeolplwhtyyefpmwktw`: an expired grant produces zero REST rows but the SDK's generic Storage route returns HTTP 200/CDN HIT. Upload cacheControl zero did not fix it. Origin RLS denies the fresh authenticated route. Both gates are false, all synthetic fixtures are removed and 66 shared-resource fingerprints match. **Confidential release remains BLOCKED** pending the [gateway-only Storage proposal](docs/STORAGE_REVOCATION_PROPOSAL.md) and skipped revocation/sign-out/membership tests. No proposed SQL was applied. Existing migrations `20261016101851` and `20261016101857` remain installed alongside twelve prior entries; never reapply or repair them. See [LIVE_SECURITY_ACCEPTANCE.md](docs/LIVE_SECURITY_ACCEPTANCE.md) for exact findings and validation limits.
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
- The browser requests bytes through the same-origin protected gateway using its JWT in a header. The gateway rechecks Auth, both gates, RLS-visible metadata and current exact grants/legacy membership before and after privileged retrieval. It returns no signed URL. The reader closes its in-memory viewing session at 55 seconds. See [gateway review and rollout](docs/PROTECTED_DOWNLOAD_GATEWAY.md).
- No service-role key, database password or production secret belongs in frontend variables, local example files or Git.
- The browser keeps Auth sessions in memory. Sign-out clears the rendered private content. No service worker or offline document cache is implemented.

## Important limits

Previously issued signed URLs and CDN responses are transition risks: the proposed restrictive policy does not invalidate them retroactively. The gateway is locally implemented, but its deployment and the direct-Storage guard remain pending separate approval. Existing direct endpoints remain a live acceptance blocker until tested under that guard. Content already fetched, copied, printed or downloaded cannot be revoked; this is access control, not DRM. The 55-second viewer timeout does not revoke delivered bytes. Sign-out alone does not guarantee immediate invalidation of a copied access JWT; current resource grants/memberships/gates enforce resource revocation.
The app does not block screenshots or copying. The executive briefing is printable.
PRIVATE is a database membership, not a name inferred from “Bruce”. Grant access only to the verified intended account.

## Verified locally

The actual migration is executed against embedded PostgreSQL using PGlite with minimal fixtures for `auth.uid()`, `auth.jwt()`, Auth users and Storage tables. Tests cover disabled release state, unauthenticated requests, non-members, anonymous-auth users, both access tiers, unapproved rows, parent-section visibility, direct private paths, orphan objects, membership expiry/revocation and rejected writes/self-promotion.

These local SQL policy and gateway tests are **not deployed gateway acceptance**. Historical hosted Auth/Storage tests and the unresolved cached-response finding are recorded separately in the live acceptance report. Browser fixtures verify the viewer, denial and sign-out flows without connecting to hosted Supabase.

## Before any confidential use

1. Verify the owner-approved shared project and existing policies using the [compatibility assessment](docs/SHARED_SUPABASE_COMPATIBILITY.md). Preserve unrelated JB3 resources, Auth settings and migration history.
2. Recheck the two live-verified installed migrations and all effective policies before testing; do not reapply them. Existing permissive policies on Storage must not broaden Vault access.
3. Inspect shared password authentication, JWT lifetime, providers, email delivery, URLs and triggers without changing them. Any shared-setting change requires separate impact review and approval. Vault membership/grant policies reject anonymous-auth content access independently of other applications' provider settings.
4. After explicit execution approval, create synthetic accounts for BRUCE_PRIVATE, COMMERCIAL, LEGAL_RESTRICTED and unassigned access. Add exact grants and any separate legacy UI memberships only through a trusted owner operation.
5. Load synthetic legacy metadata plus approved/draft records for all three exact classifications and synthetic PDF/image fixtures only. Test each release-gate combination in a bounded synthetic-only window and restore both gates false afterward.
6. Verify password sign-in, sign-out, unauthenticated denial, unassigned denial, approval rules, direct REST access, direct Storage access, URL issuance and expiry, role revocation, and expired membership against the real services. Confirm the bucket is not public and inspect Supabase security advisors.
7. Confirm production CSP, HTTPS, cache headers and the correct Cloudflare/Supabase account. Set the exact Supabase host in CSP if using a custom domain.
8. Record the evidence, then obtain authorisation before loading confidential material or deploying. Leave the access switch false if verification is incomplete.

## References

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Signed URL behaviour](https://supabase.com/docs/guides/storage/serving/downloads)
- [Cloudflare SPA assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
