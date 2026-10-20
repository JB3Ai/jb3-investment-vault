# Live security acceptance — expiry failure isolated

Stage 1 update, 17 October 2026: the closed Vault Worker and secret bindings are now
deployed. A configured-gateway invalid-bearer smoke returned 503 instead of 401/403;
live actions stopped. See [STAGE_1_CLOSED_GATE_DEPLOYMENT.md](STAGE_1_CLOSED_GATE_DEPLOYMENT.md).
Both gates are verified false, the Vault is empty and the Storage guard is still absent.
No synthetic acceptance or investor upload occurred. Overall live acceptance remains
BLOCKED by the historical cache issue and the newly recorded Stage 1 runtime failure.

17 October final preparation: the existing acceptance runner now tests successful
downloads through the protected gateway and denies direct Storage/client signing.
It includes identical warmed URL replay and assertion-level cache diagnostics. See
[FINAL_PRODUCTION_PREPARATION.md](FINAL_PRODUCTION_PREPARATION.md) for current local
results and exact staged commands. This update does not resolve or replace the
historical live failure: no deployed gateway acceptance has been run, the guard is
not installed, both gates remain false and the Vault remains empty.

Date: **17 October 2026**. Project: **JB3Ai's Command Dash**, `uxeolplwhtyyefpmwktw`.

**Overall: BLOCKED. A cached Storage response remains accessible after grant expiry. Production correction requires owner approval.** No proposed policy was applied, and no confidential content was used. Every diagnostic attempt ended with verified cleanup, both gates false and unchanged shared-resource fingerprints.

17 October local implementation update: the owner authorised implementation/local testing of the protected download gateway. That code and the browser adapters are now prepared; see [PROTECTED_DOWNLOAD_GATEWAY.md](PROTECTED_DOWNLOAD_GATEWAY.md) for architecture, local results, exact SQL hash and rollout/rollback. No deployment, hosted fixtures or policy application occurred in this implementation phase. A fresh read-only check confirms both gates false, an empty Vault and no proposed policy-name collision. **The historical live failure and skipped live cases remain unresolved until the deployed boundary is separately approved and tested.**

The [16 October report](LIVE_SECURITY_ACCEPTANCE_2026-10-16.md) preserves the previous 15 passing groups and unisolated failure. This phase used the owner's existing authorization for focused synthetic testing; it did not repeat the full acceptance suite.

## Exact failure and what it establishes

Assertion: **`BRUCE_PRIVATE.expiry.storage`**.

| Observation | Expected | Independently observed |
|---|---|---|
| Grant PATCH | One row updated | HTTP 200, one row updated |
| Postgres grant state | Expired | `active=true`, `expires_at < now() = true` |
| SDK REST listing, same query as previous runner | Zero rows | HTTP 200, zero rows |
| Fresh raw REST request, explicit public schema | Zero rows | HTTP 200, zero rows |
| SDK authenticated download through `/storage/v1/object/...` | Denial, no bytes | **HTTP 200, `cf-cache-status: HIT`, 607 bytes returned** |
| Fresh request through `/storage/v1/object/authenticated/...` | Denial, no bytes | HTTP 400, DYNAMIC, no file bytes |
| Authenticated endpoint with a fresh probe query | Denial, no bytes | HTTP 400, DYNAMIC, no file bytes |

The ordinary SDK download had been primed while the grant was valid. After expiry, it returned a cached response for the same synthetic PDF object. The origin metadata policies correctly denied access: REST returned no records and the documented authenticated Storage endpoint returned no file bytes. This is a demonstrated **cache-path authorization window**, not a timezone comparison error, stale React state or proof that the grant RLS predicate is wrong. The cached 607-byte response was not assigned a post-expiry checksum in these recorded attempts; no response bodies were logged.

The decisive retry uploaded fresh synthetic objects using **`cacheControl: '0'`**. It failed the same unchanged denial assertion, again with HTTP 200/CDN HIT/607 bytes. At failure, the database reported:

- Expiry: `2026-10-17T08:09:42.194Z`.
- Database current time: `2026-10-17T08:10:47.996Z`.
- SDK and fresh REST row counts: zero.
- Failure timestamp: **10:10:50 SAST**.

Upload cache settings alone did not repair the observed behavior. Supabase documents that Storage requests pass through its CDN, and that Smart CDN edge retention is separate from the upload option controlling browser cache duration. These documents support the caching explanation; the authorization-window finding itself comes from the live assertions above. [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals), [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

No anonymous access, cross-class leak or exposure of real investor material was demonstrated. The failing request used a previously authorized synthetic session and object. It nevertheless violates the Vault requirement to deny **new** downloads immediately after expiry. Previously downloaded bytes cannot be recalled and are a separate limitation.

## Diagnostic attempts and retained evidence

Each attempt used **one temporary user, three approved synthetic PDF records, one legacy document/section, four PDF objects and only test-owned grants/membership**. Classifications were intended to be granted sequentially to the same identity; no existing users were reused. No narratives, photographs or financial sources were uploaded.

| Run | Outcome | Cleanup / baseline |
|---|---|---|
| `8291b5f5-c29a-47e6-92ce-1a3acba8d557` | Raw REST positive control returned 404 before expiry; test-probe error | PASS |
| `b8090187-3539-447d-ad7f-55b6ccaae8cc` | Watchdog readiness timeout; no gates opened | PASS |
| `524e6539-e1fe-454e-a25c-e49d84be8ea3` | Reproduced expired-grant Storage HIT with original upload defaults | PASS |
| `e486fc4d-9c8b-42b4-8918-3e1682bc71b6` | Reproduced the same failure with upload cacheControl zero | PASS |

The 404 control was caused by this shared project's default exposed schema, `api`. SDK queries explicitly use `public`; the initial raw probe did not. Raw probes now send `Accept-Profile: public`, with a regression test. This was a diagnostic-harness error, not the original expiry failure.

The watchdog now uses a ready/arm protocol. Startup occurs while gates are false; the unchanged **60-second gate deadline** is armed only after readiness. Expiry and revocation states use separate short windows. The startup failure was operational, not an authorization result; it did not justify opening gates without a watchdog.

The final two runs each recorded **12 passing check groups/assertions and one failed assertion**. Individual expected/actual statuses, row counts, timestamps and safe cache observations are retained. The failed Storage assertion stopped further tests and closed both gates before cleanup.

Private evidence root:

`C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content\security-acceptance\`

Each run folder contains `ownership.json`, `assertions.json`, `results.json`, generated synthetic manifest and baseline/after fingerprints. They contain no passwords, API keys, JWTs or real investor sources. Original evidence was not overwritten. In the recorded traces, `freshRequest` means the **authenticated endpoint**, not an identical request to the SDK's generic object route; the route distinction is material.

## Individual current results and remaining mandatory cases

| Case | Result |
|---|---|
| Fresh project/link, Admin API and complete Auth prerequisites | PASS |
| Seven hooks disabled; no custom Auth user trigger | PASS |
| Synthetic sign-in, approved record and initial Storage access | PASS |
| BRUCE_PRIVATE expiry update and database comparison | PASS |
| BRUCE_PRIVATE expiry: SDK REST denied | PASS |
| BRUCE_PRIVATE expiry: fresh explicit-public-schema REST denied | PASS |
| BRUCE_PRIVATE expiry: generic SDK Storage download denied | **FAIL** |
| BRUCE_PRIVATE expiry: authenticated Storage endpoint denied | PASS, diagnostic observation |
| Upload cacheControl zero repairs the generic cached route | **FAIL** |
| Inactive/revoked exact grant, and other classes' expiry/revocation | NOT RUN after the confirmed failure |
| Legacy membership-only negative case and membership expiry/revocation | NOT RUN |
| Sign-out and refresh-token invalidation | NOT RUN |
| Gateway/direct-Storage isolation after proposed correction | NOT RUN; correction not applied |
| Authenticated desktop/mobile reader checks | NOT RUN in this phase |

The prior exact-class/cross-class/draft/client-write and four gate-combination passes remain historical evidence. They do not establish immediate gate revocation after a Storage cache has been warmed. That scenario must be covered after correction. **Overall live acceptance is not PASS.**

## Cleanup and unchanged shared resources

The last run finished verification at **10:11:27 SAST**:

- Both gate singleton flags are false. Gates were closed first in cleanup.
- The temporary user, three content records, four Storage objects, legacy document/section and all run-owned grants/membership were removed.
- Vault memberships, sections, documents, grants, records and objects are all zero.
- All **66 captured resource fingerprints** match the fresh baseline.
- The full hosted Auth configuration fingerprint matches.
- Existing Auth users, public/ops application rows, Storage rows/buckets, policies, ACL/RLS metadata, application functions/triggers and migration history match within the captured scope.
- The fourteen migration-history entries remain intact, including `20261016101851` and `20261016101857`; no migration was reapplied or repaired.

No critical cleanup or gate-restoration blocker remains. Platform Auth audit/telemetry logs were not deleted and were outside the baseline scope. Data fingerprints do not substitute for functional tests of unrelated applications' UIs. Deleting origin objects is not a claim that every CDN node purged its cached synthetic response immediately.

## Proposed correction — not applied

Review [STORAGE_REVOCATION_PROPOSAL.md](STORAGE_REVOCATION_PROPOSAL.md) and the exact [Vault-only Storage guard SQL](../supabase/proposals/vault_gateway_storage_guard.sql).

The proposed boundary is a trusted download gateway that freshly validates the viewer's JWT, both release gates and RLS-visible metadata, then obtains the metadata-bound bytes using a server-only key and returns a non-cacheable response. An additive restrictive Storage SELECT policy prevents viewers from bypassing that gateway through direct Vault Storage reads or signing. Its predicate is false only for the two Vault buckets and true for all unrelated buckets.

**Applying the guard alone would break current downloads.** The gateway/adapters must be implemented and tested first, followed by a final live-application review. No backend deployment or policy change is authorized by the proposal file. Existing CDN responses/signed links are a transition concern, not something the SQL itself purges; no real investor objects exist yet.

A speculative client-only cache-bypass edit was reverted after upload cacheControl zero failed in the diagnostic phase. The subsequent owner-authorised local implementation replaces direct Storage/signing adapters with the server gateway while preserving the approved UI; this is not yet a deployed fix or a live acceptance PASS.

## Local validation

| Validation | Result |
|---|---|
| Existing legacy/new-content policy tests plus proposed guard isolation tests | **20 PASS**, three files |
| Diagnostic sanitization and explicit-schema regression tests | **5 PASS** |
| Production build | **PASS**, existing large-chunk advisory only |
| Operator JavaScript syntax checks | PASS |
| Full unit-suite attempts | Not a single clean full-suite run: sandbox attempt had 65 passes/one PDF timeout; normal-account attempt had 58 passes/eight skips after a policy setup timeout |

The focused policy rerun passed all eight previously skipped content-policy tests and all nine legacy-policy tests, plus three new proposal tests. Timeouts were recorded, not relabeled as full-suite passes. No browser tests were run in this phase.

Completion verification: an independent live SELECT at **10:18:36 SAST** confirmed both gates false, all six Vault row/object counts zero, fourteen migration entries and the proposed guard **absent**. The final ten-file `dist/`/`public/` scan found no configured privileged keys, private-manifest markers or prohibited document binaries. `git diff --check` passed; both installed migration SQL hashes are unchanged. The historical report was preserved successfully, and tracked frontend source has no diff.

Changed in this phase: focused runner/diagnostic modules and tests, watchdog lifecycle, the local-only policy proposal/isolation test, proposal documentation, this report and status links. The approved frontend components, design, canonical narratives, original private sources and `.env.local` were not changed. No investor upload, live policy application, shared Auth change, Git push or deployment occurred.

**Owner decision required:** review the completed local gateway implementation and separately authorise any deployment and exact Storage policy application. Then complete all skipped live security cases and warm-cache/gate-revocation tests. Keep confidential release disabled throughout.


## Local gateway validation completion — 17 October 2026

Implementation and local testing are complete; [the gateway review](PROTECTED_DOWNLOAD_GATEWAY.md) contains the file inventory, exact SQL/hash, deployment/rollback procedure and remaining hosted test plan. Final local results: 112/112 unit/policy tests; type checking, production build, Worker dry run and export scan PASS. Relevant browser coverage: main run 17/19 passed; the two positive PDF checks exposed lazy-bootstrap timing and an overly broad measurement-canvas selector. After correcting only the test wait/selector, all six focused desktop/mobile PDF success, denial and sign-out checks passed. All nineteen scenarios have passing executions against unchanged application code; this is not hosted acceptance.

Final read-only check 2026-10-17T11:12:50.102Z: both release gates false, all Vault record/object/fixture counts zero, nine existing Storage policies, fourteen migration rows, and no collision for the proposed guard name. SQL SHA-256 remains 4580938cf404d1552a7c75f46bb84b27b27908b5c8e694b3be0e93cf4894f57d. No policy, user, grant, file, shared Auth setting or application resource was changed on Supabase. No confidential upload, GitHub push or Cloudflare deployment occurred. Live cache/revocation acceptance remains BLOCKED until separately authorised deployment/policy application and complete synthetic hosted tests.
