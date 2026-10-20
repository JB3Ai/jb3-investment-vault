# Controlled synthetic security acceptance plan

Target: `uxeolplwhtyyefpmwktw` / JB3Ai's Command Dash. **The owner-authorized focused retest on 17 October isolated an expired-grant CDN HIT on the generic SDK Storage route, including with upload cacheControl zero. All fixtures were removed; gates are false and baseline fingerprints match. Live testing stopped pending the [gateway-only Storage proposal](STORAGE_REVOCATION_PROPOSAL.md).** See [current acceptance report](LIVE_SECURITY_ACCEPTANCE.md). This plan grants no policy-change approval or permission to ignore that failure. No migration reapplication, Auth setting change, investor upload, push or deployment is part of this plan.

## Preflight and execution boundary

1. Preserve the owner's existing conditional approval for temporary accounts, synthetic records/files and bounded gate windows. Before executing it, verify both prerequisites in the current acceptance report. Stop before fixtures/gates if either prerequisite is unverified.
2. Use the existing Windows CLI login outside the sandbox, with the explicit target reference. Recheck the local link, healthy project metadata and [SELECT-only readiness file](../supabase/preflight/live-security-readiness.sql). Require both gates false, the installed Vault versions `20261016101851` and `20261016101857` and an empty Vault. Stop on unexpected content/grants/memberships/objects; never overwrite them or open gates over them.
3. Review hosted Auth hooks, password rules, JWT/refresh configuration and rate limits read-only. The complete Management API inspection now succeeds through the existing Windows CLI login; normalized CLI diffs omit some hook fields. The last run found all seven hooks disabled and no custom database Auth triggers. Recheck before a later resumed run and stop for impact review on provisioning side effects. Preserve signup, providers, URLs, SMTP, triggers and existing users.
4. Confirm the ignored server-only `SUPABASE_SECRET_KEY` is accepted by the intended project's admin API. Never read it through a Vite module, put it in command arguments, print response headers/tokens or copy it into reports. All end-user tests use the publishable key plus the ordinary user's JWT; privileged success is not an RLS test.
5. Capture timestamped schema/policy/ACL/bucket/migration fingerprints and agreed unrelated-app read-only probes before mutations. Keep raw audit output and the ownership ledger outside Git under `C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content\security-acceptance\<run-id>\`.
6. Choose a fresh run UUID; generate passwords in memory only and independent fixture UUIDs. Record returned Auth IDs, exact object paths and hashes privately. Never reuse existing users or assume an email match proves ownership. A designated operator must be able to restore gates if connectivity is lost.

## Four temporary identities

| Identity | Exact content grant | Legacy membership for UI tests | Expected new content |
|---|---|---|---|
| B | BRUCE_PRIVATE only | PRIVATE | Approved Bruce-class synthetic rows only |
| C | COMMERCIAL only | COMMERCIAL | Approved commercial-class synthetic rows only |
| L | LEGAL_RESTRICTED only | None needed for direct API tests | Approved legal-class synthetic rows only |
| U | None | None initially | No content |

Admin-create confirmed, run-unique synthetic accounts in a non-delivering test domain accepted by existing Auth settings. Do not call public signup, invite Bruce, impersonate his account or send mail. B models Bruce's intended grant, not his identity. Temporarily give U a run-owned PRIVATE membership for the legacy-only negative case, then remove it; that must confer no new content grant. Anonymous requests use the publishable key without a session. Anonymous sign-in is disabled: leave it disabled, mark a real anonymous-auth case NOT RUN and cite local policy coverage instead of changing shared settings.

## Synthetic fixtures

- Prepare safe legacy navigation metadata for all eleven existing section IDs using the current schema/order. All text is synthetic; never seed real narratives into legacy tables. Include PRIVATE/COMMERCIAL approved/draft legacy metadata and synthetic PDFs to test legacy permissions independently.
- For each exact classification prepare a reported/approved narrative, reported/draft narrative, reported/rejected narrative and awaiting-verification/draft narrative. Approved records carry synthetic review/provenance and visibly synthetic paragraphs. The schema forbids approved/awaiting-verification combinations: test constraint rejection in a rollback-only transaction rather than weakening constraints.
- Generate a tiny synthetic PDF and image. Validate proposed records with the existing ingestion schema/validator, including filename, source date/reference, citation, synthetic reviewer/date and real SHA-256. Do not introduce another content format or use the investor manifest as a fixture source.
- Include approved/draft assets per class and a metadata-free orphan. `vault-evidence` keys must be `CLASSIFICATION/<record-uuid>/<sha256>`; legacy keys contain the run ID. Upload/remove bytes through the trusted Storage API, never by directly inserting/deleting `storage.objects` metadata.
- Before every gate opening, establish that every Vault row/grant/member/object belongs to this synthetic run. Stop on concurrent or unrecognized changes.

## Required live cases

| Case | Actions and expected result |
|---|---|
| Authentication | All four sign in with passwords; wrong passwords fail. Verify `getUser`, refresh, local sign-out and refresh rejection after sign-out. No emails/settings changes. |
| Anonymous/unassigned | Direct list and UUID REST queries return no protected rows or privilege errors. Authenticated release-state flags and own current grants/membership are permitted metadata. U receives no content/asset bytes. |
| Exact grants | B/C/L see only their explicitly granted approved class via list/ID reads and authenticated downloads. Test every cross-class pair, including B denied COMMERCIAL/LEGAL_RESTRICTED. User-editable class/role metadata grants nothing. |
| Approval | Draft/rejected/awaiting-verification rows and objects denied to all ordinary users, including B. Assert no bytes, not a specific status code alone. |
| Legacy distinction | U with PRIVATE membership alone still cannot read new content. Legacy PRIVATE may see legacy drafts by design; report separately. Commercial legacy metadata/documents need approved commercial parents. |
| Direct API/Storage | Repeat reader restrictions with raw REST, known UUIDs and Storage endpoints. Probe public downloads, guessed/orphan paths, lists and signing; no unauthorized private bytes. Hash successful downloads. |
| Client writes | INSERT/UPDATE/DELETE on all seven tables, self-grant/membership, approval and gate edits fail. Verify state afterward; zero-row writes alone do not prove privilege denial. Upload/overwrite/move/delete in both Vault buckets denied. |
| Revocation/expiry | Revoke/expire test exact grants: next REST/download/new signing denied with the existing JWT. Repeat legacy membership expiry/revocation. Restore only test-owned fixtures to continue cases. |
| Reader | B sees exact synthetic paragraphs/provenance in the current reader. Test loading/unavailable/denied states, desktop/mobile navigation, sign-out clearing and delayed-response handling. C/L are not entitled to the Bruce-only reader. No redesign. |
| Session/link limits | Measure access-token validity separately from refresh invalidation. Capture a synthetic legacy signed URL, revoke membership and measure expiry; never claim downloaded bytes or already-issued links are immediately revocable. |
| Shared regression | Repeat agreed unrelated-app read-only functional probes and compare baseline fingerprints. Preserve shared Auth settings, policies, history and existing resources. |

## Gate sequence

`vault_settings` is the legacy gate; `vault_content_settings` is the new gate and does not close the legacy metadata/document route.

| Legacy gate | Content gate | New narratives / vault-evidence | Legacy sections / vault-documents |
|---|---|---|---|
| false | false | Denied | Denied |
| false | true | Denied | Denied |
| true | false | Denied | Legacy membership/approval rules apply |
| true | true | Approved exact-granted synthetic records only | Legacy membership/approval rules apply |

After approval, use short sequential windows with an agreed operator deadline, closing both gates between windows. Repeat synthetic-only ownership checks before each opening. Do not leave an unattended process holding gates open. Transaction-local SQL checks cannot replace live REST/Storage tests across requests.

## Cleanup and acceptance

Run cleanup in `finally`; the designated operator verifies closure independently on interruption. Close both gates first and verify both singleton rows false. Revoke run-owned grants/memberships and test sessions. Remove only ledger-matched Storage files through the Storage API, then content/document/section fixtures in FK-safe order. Delete only positively identified admin-created test users after reviewing hook side effects. If ownership cannot be established, quarantine/report rather than deleting by broad email/domain/path prefix.

Rerun readiness SELECTs, compare schema/policy/bucket/history fingerprints and confirm Vault row/object counts returned to baseline. Preserve redacted PASS/FAIL/NOT RUN evidence and timestamps in `LIVE_SECURITY_ACCEPTANCE.md`; raw identifiers/credentials stay outside Git. Run existing unit/build/browser checks as implementation evidence, separate from live results. Scan build/public output for private material and privileged keys without printing contents.

Failed/incomplete cases, cleanup discrepancies, unexpected shared changes or inability to verify closed gates block confidential release. Successful synthetic acceptance does not authorize investor-content uploads, real access, Git push or deployment.
