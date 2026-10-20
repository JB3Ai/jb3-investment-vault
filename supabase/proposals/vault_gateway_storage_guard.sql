-- PROPOSAL ONLY. Not a migration. Owner approval required before live application.
-- Target: uxeolplwhtyyefpmwktw, shared JB3Ai's Command Dash project.
-- Deploy/test a protected download gateway and update the adapters BEFORE applying.
-- Both gates must stay false throughout the transition; no real content exists yet.
-- This does not purge existing CDN entries or revoke already issued signed URLs.
-- Verify this policy name is absent and fingerprint existing policies before approval.
begin;
create policy "Vault downloads require trusted gateway"
on storage.objects as restrictive for select to anon, authenticated
using (bucket_id not in ('vault-documents', 'vault-evidence'));
commit;
-- No other buckets, policies, tables, users, Auth settings or history are modified.
-- Trusted service_role bypasses RLS; never expose that key to browsers.
-- Rollback, only after positively verifying this exact test-owned policy definition:
-- drop policy "Vault downloads require trusted gateway" on storage.objects;
