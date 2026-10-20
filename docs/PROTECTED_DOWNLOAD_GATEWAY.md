# Protected download gateway — local implementation review

Target: `uxeolplwhtyyefpmwktw`. Implementation/local testing authorised on 17 October 2026. **No deployment or policy application authorised or performed.** Live acceptance remains BLOCKED by the previously demonstrated direct Storage cache path. Both release gates remain false; no investor content is loaded.

## Architecture

`GET|HEAD /api/vault/assets/:UUID` serves classified PDFs/images. `GET|HEAD /api/vault/documents/:UUID` serves permitted legacy PDFs. The Cloudflare Worker runs these paths before static assets; Vite provides the same handler in its local Node process. Unknown API paths do not fall through to the SPA.

Each request independently:

1. Rejects unsupported methods, query selectors and foreign browser origins; requires a bearer token in the Authorization header.
2. Validates the user remotely through Auth; rejects anonymous users. Uses the publishable key and that token for all metadata reads, with `Accept-Profile: public` explicitly set. No service-key metadata lookups or editable user-metadata roles.
3. Requires both singleton release gates true. Reads RLS-visible metadata and explicitly checks current exact-class grants or legacy memberships, including active/expiry conditions. Approved classified assets must have a permitted verification value, matching kind/MIME, and the canonical `classification/UUID/SHA-256` path. Legacy documents require visible parent metadata; legacy PRIVATE membership retains its existing draft permissions, while commercial access requires commercial, approved parent and document. Gateway legacy downloads deliberately require **both** gates, stricter than the legacy database's single gate.
4. Fetches only the metadata-bound path in the fixed `vault-evidence` or `vault-documents` bucket using the server-only key. It never accepts a caller bucket/path or issues redirects/signed links. Privileged headers and upstream error details are never returned.
5. Buffers at most 25 MiB with a 30-second operation deadline and request cancellation. Verifies classified asset SHA-256; legacy hashes remain the existing ingestion/integrity responsibility. Repeats Auth, gates and database authorisation after buffering; changed permissions or asset identity discard all bytes.
6. Returns a whole response or one validated HTTP byte range. HEAD and every range request repeat the same authorisation; multiple/malformed/unsatisfiable ranges return 416 without bytes. Conditional cache headers never produce 304 or bypass authorisation. Range requests currently retrieve/verify the whole object before slicing.

No user/content caches, cookies, signed URLs, public object URLs or direct Storage fallbacks exist in the handler/adapters. Auth/database cache HIT/STALE/UPDATING/REVALIDATED or positive Age responses fail closed. Cached file bytes upstream are usable only after fresh user permissions and integrity checks. Responses, including errors, send:

```text
Cache-Control: private, no-store, max-age=0, must-revalidate
CDN-Cache-Control: no-store
Cloudflare-CDN-Cache-Control: no-store
Pragma: no-cache
Expires: 0
Vary: Authorization
X-Content-Type-Options: nosniff
```

The browser transport uses same-origin UUID endpoints, bearer headers, `cache: no-store`, no cookies and no redirects. It discards results after token changes/sign-out. The document viewer receives in-memory Uint8Array bytes; no object URLs need revoking. Pending requests abort on unmount/sign-out. Existing viewer controls, 55-second viewing timeout, console, CSS, section order and mobile layout remain intact. The private asset adapter retains its `{ blob, record }` contract for PDF and photograph callers.

## Runtime configuration (no values in Git)

Worker server bindings: `SUPABASE_URL` (the exact target URL), `SUPABASE_PUBLISHABLE_KEY` and **secret** `SUPABASE_SECRET_KEY`. Modern sb_secret_ keys are sent only in the apikey header; legacy service-role JWTs use apikey plus bearer after checking role/project metadata. [Supabase key headers and roles](https://supabase.com/docs/guides/getting-started/api-keys). Supabase validates the credential remotely; local JWT decoding does not prove its signature or administrative permissions. Provision these through the approved deployment environment/secret mechanism after separate approval. No privileged `VITE_` variable, build substitution or frontend import. Missing/mismatched configuration fails closed with 503. No Worker credentials are configured by this implementation.

Local Vite reads existing ignored `.env.local` in its Node process only: the first two bindings come from `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`; the third from `SUPABASE_SECRET_KEY`. The build configuration does not inject the gateway secret; privileged values are absent from the generated frontend and Worker artifacts. The build boundary now rejects `server/` imports and privileged credential references in browser modules. Source documents remain external; no content importer changes.

## Exact proposed policy (not applied)

File: `supabase/proposals/vault_gateway_storage_guard.sql`.

SHA-256: `4580938cf404d1552a7c75f46bb84b27b27908b5c8e694b3be0e93cf4894f57d`.

```sql
begin;
create policy "Vault downloads require trusted gateway"
on storage.objects as restrictive for select to anon, authenticated
using (bucket_id not in ('vault-documents', 'vault-evidence'));
commit;
```

The hash covers the complete proposal file, including comments/newlines, not just this excerpt. No changes to either installed migration or migration history are required.

Read-only hosted verification on 17 October 2026 found **no policy-name collision**, both gates false, all six Vault fixture/content counts zero and fourteen migration-history entries. Seven existing unrelated Storage policies are limited to `documents`/`media`; the two existing Vault SELECT policies are permissive. The new restrictive condition ANDs with the permissive-policy OR: false for Vault buckets, true for all other bucket IDs. It restricts SELECT only; existing shared reads/writes/deletes and policy definitions remain unchanged. Trusted service_role bypass remains available server-side. This does not purge previous CDN entries or invalidate previously issued signed URLs. Repeat collision/definition checks immediately before any approved application.

## Ordered rollout — requires separate owner approval

1. Keep gates false and confirm the Vault remains empty. Verify project identity, secret custody/admin permissions, hosted Auth settings, fourteen migration entries, all policy definitions and baseline shared-resource/Auth fingerprints. Check the exact proposal hash/name absence again. Abort on drift; do not repair history or change shared Auth settings.
2. Stage the matching Worker and frontend in a separately approved controlled environment, with server bindings and HTTPS. Verify `/api/vault/*` runs Worker-first and no Cloudflare cache rule/service worker caches these paths. Do not redirect API failures to the SPA. Verify no credential/private content in frontend artifacts. Missing credentials must return 503, not direct Storage fallback.
3. After explicit SQL approval, apply only the hashed proposal transaction using the established shared-project workflow. Do not use a blind database push or reapply installed migrations. Verify policy name, roles, SELECT command, restrictive mode and predicate. Preserve all other definitions/history. The paired gateway must be available before granting any file access. Applying the guard alone would break direct viewers; gates are deliberately closed and the Vault currently has no documents, so there is no active investor document session to interrupt.
4. Run controlled synthetic acceptance below, with a fixture ownership ledger and guaranteed cleanup/watchdog. Keep test-gate windows brief. Prove direct browser Storage/signing paths cannot bypass the gateway even after warming caches. Account for old synthetic cached responses/signed links: policy application alone is not proof of their removal. Any surviving direct bytes block acceptance; resolve propagation/expiry/purge before further release.
5. Restore gates false first, delete only positively owned fixtures, compare all shared fingerprints/Auth configuration, and retain sanitised assertion-level evidence. Confirm `documents`/`media` remain unchanged. Publish a new acceptance decision; do not turn historical failure into PASS based on local tests. Loading real narratives/assets or enabling release needs subsequent owner approval.

## Rollback — gates closed first

1. Disable and verify both gates before changing routes, frontend or policies; stop synthetic requests. If verification fails, declare a critical blocker and stop rollout.
2. Prefer retaining the guard and rolling back to a compatible gateway/frontend pair, or keeping the gateway unavailable (fail closed). Never add a direct Storage fallback while serving protected content.
3. If the owner separately approves removing the guard, first compare its complete current definition with this proposal and capture shared fingerprints. Drop only this positively identified policy in a transaction; leave existing policies, buckets, data and migration history intact:

```sql
begin;
drop policy "Vault downloads require trusted gateway" on storage.objects;
commit;
```

4. Verify gates false, shared definitions/data unchanged and no fixtures left. Old adapters may only be restored while release is disabled. Removing the guard restores the known direct-Storage vulnerability; it is not a safe released state or a reason to reopen gates.

## Mandatory live acceptance after deployment/policy approval

- Fresh Auth Admin and hosted Auth read-only prerequisites; baseline shared-data/schema/Storage/Auth fingerprints. Synthetic users: three exact classes plus unassigned; separate legacy memberships where needed. No real investor files.
- Auth/sign-out/refresh behaviour; missing, anonymous, unassigned, invalid and expired-token requests. Exact classification isolation, approved/draft/awaiting-verification denial, direct REST/client-write denial, no implicit legacy-role classification promotion.
- Approved PDF and image gateway success, permitted legacy PRIVATE/commercial parent/document matrix, orphan/path substitution denial and integrity failures. Test all four gate combinations; either closed gate denies both gateway resource types.
- Warm generic/authenticated/public Storage routes and signing endpoints; then expire/revoke grants and memberships, close each gate and delete fixtures. Gateway, HEAD, ranges, conditional GET and concurrent users must deny new unauthorised requests with no bytes. Direct Storage and signing must remain denied under the guard; inspect CDN behaviour, not just origin RLS.
- Assert no Location/signed URL/privileged headers, no-store browser/CDN headers on success and errors, no 304, and fresh reads after a formerly authorised response. Test real deployed cache rules and multiple regions where applicable.
- Desktop/mobile authenticated viewer success, denial, pending request cancellation/sign-out; no direct Storage fallback. Verify `documents`/`media` authorised and anonymous behaviour matches baseline without modifying shared fixtures.
- Close gates first, remove ledger-owned users/rows/grants/files only, verify zero residue and all fingerprints match. Any cleanup/gate uncertainty is critical. Overall acceptance cannot PASS until every mandatory scenario passes.

## Limits and remaining holds

This is access control for **new requests**, not DRM: already delivered bytes cannot be recalled. Supabase sign-out removes refresh/local session state; a copied access JWT may remain valid until expiry. [Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout). Immediate resource revocation relies on current grants/memberships/gates, not local sign-out alone. Live tests must distinguish these behaviours rather than assume instant JWT blacklisting.

Full-object verification for ranges costs bandwidth/memory (25 MiB object limit). Before release, validate deployed Worker memory/concurrency capacity and configure owner-approved route rate limits if required. An upstream outage, hash mismatch, deadline or malformed metadata fails closed. There is an unavoidable instant between the last permission read and response delivery; revocation cannot recall already delivered bytes. No local test proves hosted cache propagation, deployed Auth/Storage behaviour or production performance.

Local validation results are recorded after execution below. Live policy application, deployment, hosted gateway acceptance and confidential release remain pending.


## Implementation file inventory

New server files: server/downloadGateway.ts (authorisation/retrieval/ranges), server/worker.ts (Worker routing), server/viteGateway.ts (local Node middleware), server/downloadGateway.test.ts and server/downloadBoundary.test.ts.

New client files: src/lib/protectedDownloads.ts and src/lib/protectedDownloads.test.ts. New review document: this file.

Updated runtime/configuration: src/lib/privateContent.ts, src/components/DocumentLibrary.tsx, vite.config.ts, tsconfig.json, wrangler.jsonc and content-migration/build-boundary.ts. No console component, stylesheet, narrative, source manifest or installed migration changed.

Updated checks: tests/narrative-reader.spec.ts and src/lib/gatewayStorageGuard.test.ts. Existing security.test.ts/contentPolicies.test.ts setup hooks now allow 180 seconds rather than 60 for observed Windows WASM startup delays; assertions are unchanged. New mocked stream tests allow 30 seconds; the gateway's operational deadline remains 30 seconds. The initial full run had 87 passes, two five-second test timeouts and seventeen skipped assertions after two sixty-second setup timeouts; it was not a passing run. The initial browser run was interrupted by development-server reloads and is not final acceptance evidence.

Updated documentation: README.md, SECURITY.md, docs/STORAGE_REVOCATION_PROPOSAL.md and docs/LIVE_SECURITY_ACCEPTANCE.md. The exact proposal SQL remains unchanged and unapplied. Existing untracked work predating this task is preserved.

The existing hosted runner's successful direct-Storage reads describe the old boundary. Before a future approved live run, use gateway-aware positive download assertions while retaining raw Storage/signing routes as negative tests. No hosted test runner was executed in this implementation phase.

## Primary implementation references

- [Supabase API key headers, roles and custody](https://supabase.com/docs/guides/getting-started/api-keys).
- [Supabase sign-out and access-token lifetime](https://supabase.com/docs/guides/auth/signout).
- [Cloudflare Worker-first static-asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
- [Cloudflare response headers must be attached by Worker code](https://developers.cloudflare.com/workers/static-assets/headers/).
- [Cloudflare Request cache modes](https://developers.cloudflare.com/workers/runtime-apis/request/).


## Completed local validation — 17 October 2026

| Check | Result and evidence scope |
| --- | --- |
| Full unit/policy suite | PASS: 112 tests, 13 files; npm.cmd test -- --maxWorkers=1. Zero skipped assertions in the final run. Includes gateway permissions, expiry/revocation, legacy membership, all release-gate combinations, classification isolation, stale metadata/cache rejection, integrity/path checks, ranges, concurrent callers and Storage-policy composition. |
| Final type checking | PASS: npm.cmd run typecheck, including the corrected browser test. |
| Production frontend build | PASS: npm.cmd run build. Existing large-chunk warning remains; console components and stylesheets are unchanged. |
| Worker bundle | PASS: wrangler deploy --dry-run --outdir tmp/gateway-worker; local bundle only, no deployment. Only ASSETS was declared; runtime credentials have not been provisioned. |
| Export scan | PASS: 8 frontend files and 3 Worker output files inspected. Zero configured privileged-key values or prohibited private-source markers in exported artifacts. The scan reads .env.local only inside a Node process and prints no values. |
| Main relevant browser run | 17 PASS / 2 FAIL out of 19 desktop/mobile/secure scenarios. Initial canvas waits were too short during cold bootstrap. The first focused retry then exposed an over-broad canvas selector matching PDF.js's unrelated hidden zero-size measurement canvas. Trace metadata showed HTTP 200 for the gateway, reader module and PDF worker; the actual PDF page rendered. These failures were not silently discarded. |
| Corrected focused browser run | PASS: 6/6 desktop/mobile protected-PDF success, denial/no-fallback and pending-download sign-out checks. Selector now targets the rendered .react-pdf__Page__canvas; its bounded 45-second wait is below the unchanged 55-second viewing window. Expected gateway count is one, direct Storage count zero, and the protected page disappears on sign-out. No application code or security assertion was relaxed to make this pass. |
| Browser coverage conclusion | All 19 relevant scenarios have passing executions against unchanged application code: the other 13 scenarios passed in the main run; the six PDF scenarios passed in the focused run. This is not a claim that a new single 19-test run was executed after the test-only correction. Commands: npm.cmd run test:e2e -- --project=narrative-desktop --project=narrative-mobile --project=secure --workers=1 --timeout=180000; focused --grep 'protected PDF' on the two narrative projects. |
| Local HTTP boundary | PASS on both browser projects: actual Node/Vite endpoints return empty, non-cacheable 401 (anonymous), 503 (deliberately unconfigured local provider fixture) and 404 (arbitrary bucket/path query). Gateway/core and Worker-before-assets contracts also pass unit tests. |
| Interactive workerd HTTP probe | NOT RUN: Windows ConPTY process creation was denied before the local server started. Dry-run compilation passed; deployed Worker runtime/edge-cache behaviour remains a live acceptance requirement. |
| Git/export hygiene | git diff --check passed; HEAD remains bcdd33d. .env.local, dist and tmp/gateway-worker are ignored. No commit, push, deployment, source-document copy or hosted fixture creation occurred. |

Sanitised early failure snapshots are retained locally in ignored tmp/gateway-browser-initial and tmp/gateway-browser-selector. They contain synthetic UI/error information only; the trace investigation printed paths/status/MIME only, never headers, JWTs, query strings or bodies.

## Final read-only hosted state

Verified at 2026-10-17T11:12:50.102Z (13:12:50 SAST), using the existing Windows CLI authentication against uxeolplwhtyyefpmwktw: both gates FALSE; memberships, sections, legacy documents, grants, content records and Vault objects all ZERO; proposed policy-name collision FALSE; nine existing Storage policies; fourteen migration-history entries. A prior refresh attempt did not complete; this final bounded retry succeeded. No live mutation was attempted in either check.

The exact proposal SHA-256 was independently recomputed as 4580938cf404d1552a7c75f46bb84b27b27908b5c8e694b3be0e93cf4894f57d. The proposal remains unapplied. No full 66-resource live acceptance fingerprint comparison was repeated in this local implementation phase; historical comparisons remain in the live report. All hosted operations in this phase were read-only.

**Local implementation/testing is complete. Overall hosted security acceptance remains BLOCKED.** Separate approval is still needed for server-secret provisioning/deployment and this exact Storage guard. Then complete the mandatory hosted gateway/direct-route warm-cache, revocation, Auth and cleanup tests above. Keep both gates false and the Vault empty until further owner approval. No real-content loading is authorised by these local results.
