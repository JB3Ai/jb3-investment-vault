-- Prepared locally only. No grants or confidential records are seeded.
create table public.vault_content_settings (
  id integer primary key check (id = 1),
  access_enabled boolean not null default false
);
insert into public.vault_content_settings(id) values (1);

create table public.vault_content_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  classification text not null check (classification in ('BRUCE_PRIVATE','COMMERCIAL','LEGAL_RESTRICTED')),
  active boolean not null default true,
  expires_at timestamptz,
  primary key(user_id, classification)
);
create table public.vault_content_records (
  id uuid primary key,
  section_id text not null check (section_id in ('introduction','current-position','history-evidence','assets-claims','financial-requirements','beobacht-alignment','commercial-pipeline','southern-african-strategy','financial-forecast','investment-structures','closing')),
  kind text not null check (kind in ('narrative','photograph','pdf','opportunity','financial')),
  classification text not null check (classification in ('BRUCE_PRIVATE','COMMERCIAL','LEGAL_RESTRICTED')),
  verification text not null check (verification in ('documented','reported','disputed','awaiting-verification')),
  approval text not null default 'draft' check (approval in ('draft','approved','rejected')),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  storage_path text unique,
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text,
  created_at timestamptz not null default now(),
  check (provenance ?& array['originalFilename','sourceDate','citation','sourceReference','reviewedBy','reviewedOn','conflictNote']),
  check (approval <> 'approved' or (verification <> 'awaiting-verification' and length(coalesce(provenance->>'reviewedBy','')) > 0 and length(coalesce(provenance->>'reviewedOn','')) > 0)),
  check (verification <> 'disputed' or length(coalesce(provenance->>'conflictNote','')) > 0),
  check (kind <> 'financial' or payload->>'basis' <> 'actual' or (verification = 'documented' and provenance->>'conflictNote' is null and length(coalesce(payload->>'reconciliationNote','')) > 0)),
  check ((kind in ('photograph','pdf') and sha256 is not null and storage_path = classification || '/' || id::text || '/' || sha256 and mime_type in ('application/pdf','image/jpeg','image/png','image/webp'))
    or (kind not in ('photograph','pdf') and storage_path is null and sha256 is null and mime_type is null))
);
create index vault_content_class_section on public.vault_content_records(classification, section_id);
alter table public.vault_content_settings enable row level security;
alter table public.vault_content_grants enable row level security;
alter table public.vault_content_records enable row level security;
revoke all on public.vault_content_settings, public.vault_content_grants, public.vault_content_records from public, anon, authenticated;
grant select on public.vault_content_settings, public.vault_content_grants, public.vault_content_records to authenticated;
grant all on public.vault_content_settings, public.vault_content_grants, public.vault_content_records to service_role;
create policy "Read content release state" on public.vault_content_settings for select to authenticated using (true);
create policy "Read own exact content grants" on public.vault_content_grants for select to authenticated using (
  user_id = (select auth.uid()) and active and (expires_at is null or expires_at > now())
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
);
create policy "Read explicitly granted approved content" on public.vault_content_records for select to authenticated using (
  approval = 'approved' and verification <> 'awaiting-verification'
  and exists(select 1 from public.vault_settings where id = 1 and access_enabled)
  and exists(select 1 from public.vault_content_settings where id = 1 and access_enabled)
  and exists(select 1 from public.vault_content_grants g where g.user_id = (select auth.uid()) and g.classification = vault_content_records.classification)
);
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('vault-evidence','vault-evidence',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy "Read approved private evidence objects" on storage.objects for select to authenticated using (
  bucket_id = 'vault-evidence'
  and exists(select 1 from public.vault_content_records r where r.storage_path = name and r.kind in ('pdf','photograph'))
);
-- No client writes, public policies, implicit legacy PRIVATE-role mapping, or release activation.
