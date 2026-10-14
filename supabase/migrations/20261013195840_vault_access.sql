-- Server-enforced access. No real content or users are seeded.
-- Enable access only after real Auth + Storage integration tests have passed.
create table public.vault_settings (
  id integer primary key check (id = 1),
  access_enabled boolean not null default false
);
insert into public.vault_settings (id) values (1);

create table public.vault_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level text not null check (access_level in ('PRIVATE', 'COMMERCIAL')),
  active boolean not null default true,
  expires_at timestamptz
);
create table public.vault_sections (
  id text primary key,
  number integer unique not null check (number between 1 and 11),
  title text not null,
  subtitle text not null,
  overview text not null,
  narrative jsonb not null default '[]' check (jsonb_typeof(narrative) = 'array'),
  evidence jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array'),
  updated_at date not null default current_date,
  verification text not null default 'PENDING' check (verification in ('DEMONSTRATION','PENDING','VERIFIED')),
  disclosure text not null default 'PRIVATE' check (disclosure in ('PRIVATE','COMMERCIAL')),
  approved boolean not null default false
);
create table public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  section_id text not null references public.vault_sections(id) on delete restrict,
  title text not null,
  disclosure text not null default 'PRIVATE' check (disclosure in ('PRIVATE','COMMERCIAL')),
  verification text not null default 'PENDING' check (verification in ('DEMONSTRATION','PENDING','VERIFIED')),
  approved boolean not null default false,
  storage_path text unique not null check (storage_path !~ '(^/|\\.\\.)'),
  updated_at date not null default current_date
);
create index vault_documents_section_idx on public.vault_documents(section_id);

alter table public.vault_settings enable row level security;
alter table public.vault_memberships enable row level security;
alter table public.vault_sections enable row level security;
alter table public.vault_documents enable row level security;

revoke all on public.vault_settings, public.vault_memberships, public.vault_sections, public.vault_documents from public, anon, authenticated;
grant select on public.vault_settings, public.vault_memberships, public.vault_sections, public.vault_documents to authenticated;
grant all on public.vault_settings, public.vault_memberships, public.vault_sections, public.vault_documents to service_role;

create policy "Read release state" on public.vault_settings for select to authenticated using (true);
create policy "Read own current membership" on public.vault_memberships for select to authenticated using (
  user_id = (select auth.uid()) and active
  and (expires_at is null or expires_at > now())
  and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
);
create policy "Read authorised sections" on public.vault_sections for select to authenticated using (
  exists (select 1 from public.vault_settings where id = 1 and access_enabled)
  and exists (
    select 1 from public.vault_memberships m
    where m.user_id = (select auth.uid())
    and (m.access_level = 'PRIVATE' or (disclosure = 'COMMERCIAL' and approved))
  )
);
create policy "Read authorised documents" on public.vault_documents for select to authenticated using (
  exists (select 1 from public.vault_settings where id = 1 and access_enabled)
  and exists (select 1 from public.vault_sections s where s.id = section_id)
  and exists (
    select 1 from public.vault_memberships m
    where m.user_id = (select auth.uid())
    and (m.access_level = 'PRIVATE' or (disclosure = 'COMMERCIAL' and approved))
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-documents', 'vault-documents', false, 26214400, array['application/pdf']);
-- Storage RLS is enabled by Supabase. Only matching authorised metadata permits reads.
create policy "Read authorised vault objects" on storage.objects for select to authenticated using (
  bucket_id = 'vault-documents'
  and exists (select 1 from public.vault_documents d where d.storage_path = name)
);
-- There are no client insert/update/delete policies. Uploads and approvals are owner operations.
