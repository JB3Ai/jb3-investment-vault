# Proposed Vault download boundary — approval required

Target: `uxeolplwhtyyefpmwktw`. **Local proposal only. No policy, backend deployment or shared setting has been changed.** Both gates are false and the Vault is empty after the diagnostic runs.

## Observed problem

On 17 October 2026, an expired BRUCE_PRIVATE grant was confirmed in Postgres. Both SDK and raw REST queries returned zero rows, but the SDK's `/storage/v1/object/...` download returned HTTP 200, CDN HIT and the 607-byte synthetic PDF. Fresh requests to `/storage/v1/object/authenticated/...` returned HTTP 400 with no file bytes. The same failure reproduced after uploading fresh files with `cacheControl: '0'`.

This is a demonstrated cached-response access window, not an incorrect timestamp comparison or evidence that the origin RLS predicates are wrong. Client cache-bypass flags alone cannot protect a direct endpoint that a caller can request independently. Supabase documents CDN caching for Storage and that Smart CDN cache duration is distinct from the upload option's browser cache duration. [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals), [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

## Exact proposed database change

Review [vault_gateway_storage_guard.sql](../supabase/proposals/vault_gateway_storage_guard.sql).

SHA-256: `4580938cf404d1552a7c75f46bb84b27b27908b5c8e694b3be0e93cf4894f57d`.

It adds one restrictive SELECT policy on `storage.objects` for `anon` and `authenticated`. Its predicate is false only for `vault-documents` and `vault-evidence`, and true for every unrelated bucket. Existing permissive policies remain in place; authenticated viewers will no longer fetch or sign Vault objects directly. The trusted service-role backend retains access through RLS bypass. No existing policies are dropped or replaced, and no tables, Auth settings, users or migration history are changed.

**Do not apply the guard alone:** it would disable the current authenticated download and document-signing routes. It belongs with the protected gateway below. It also does not retroactively purge cached responses or revoke already issued signed URLs. No real investor assets have been uploaded, allowing this boundary to be established before any confidential upload.

## Required gateway behavior before live application

1. Add server-only Vault endpoints, for example `GET /api/vault/assets/:recordId` and `GET /api/vault/documents/:documentId`. Keep the existing reader/viewer appearance and navigation.
2. Require the user's bearer JWT and validate it through Supabase Auth. Reject missing/anonymous users. Do not infer grants from editable user metadata.
3. Use a separate user-scoped client selecting the **public** schema explicitly. Recheck the release gates and retrieve accessible metadata through current RLS on every request. New content requires approved status and an active, unexpired exact-class grant. Legacy documents require the current legacy membership and visible parent. Fail closed before reading Storage bytes.
4. Only after authorization, use a server-only service-role/secret key to retrieve the metadata-bound object. Never accept arbitrary bucket/path arguments, return privileged headers, redirect to Storage, issue viewer signed links or put the admin key into frontend variables.
5. Send bytes with `Cache-Control: private, no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, `Vary: Authorization` and `X-Content-Type-Options: nosniff`. Reauthorize range requests. Keep hash verification in the existing ingestion/integrity path and prevent cross-record path substitution.
6. Update existing asset/document adapters to use the gateway. Clear downloaded object URLs on sign-out and document close. Previously downloaded bytes cannot be recalled; this proposal controls new server requests.

The owner subsequently authorised implementation and local testing only. The gateway and adapters are now implemented locally; see [the implementation review, configuration and ordered rollout/rollback](PROTECTED_DOWNLOAD_GATEWAY.md). It has not been deployed, the policy has not been applied and the prior live failure is not marked resolved by local tests.

## Ordered approval and validation boundary

1. Owner reviews/authorizes the gateway boundary and this exact Vault-only policy proposal.
2. Implement and locally test the gateway/adapters while gates remain false. Present final code, SQL hash, project identity and policy-name collision check before live application; approval of this proposal is not approval to push or deploy.
3. Apply only the new approved policy in the shared project's established workflow, preserving all fourteen existing migration-history rows. Never reapply or repair the two installed Vault migrations.
4. Repeat minimal synthetic testing: warm backend caches, revoke/expire grants and memberships, close each gate, then prove new gateway requests and every direct Storage/signing route are denied. Cover all three classes, anonymous/unassigned users and service-role cache isolation. Complete sign-out/refresh and desktop/mobile reader checks.
5. Verify gates false first in cleanup, remove only ledger-owned fixtures and compare shared-data/Auth/schema fingerprints. Confirm existing `documents`/`media` behavior is unchanged. No confidential loading/release until every mandatory case passes.

Rollback, if separately authorized, removes only the newly created guard after checking its exact definition. It restores direct-origin access; it does not solve the cached-response finding. Other shared policies must remain untouched.
