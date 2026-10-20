-- Read-only metadata/count checks. NOT a migration; never apply via db push.
-- Use only after verifying the linked project is uxeolplwhtyyefpmwktw.
-- Does not select application content, Auth identities or credentials.
select jsonb_build_object(
  'tables', (
    select jsonb_agg(to_jsonb(t)) from (
      select c.relname as name, c.relrowsecurity as rls_enabled
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in (
        'vault_settings','vault_memberships','vault_sections','vault_documents',
        'vault_content_settings','vault_content_grants','vault_content_records'
      ) order by c.relname
    ) t
  ),
  'buckets', (
    select jsonb_agg(to_jsonb(b)) from (
      select id, public, file_size_limit, allowed_mime_types
      from storage.buckets where id in ('vault-documents','vault-evidence') order by id
    ) b
  ),
  'legacy_gate', (select jsonb_agg(jsonb_build_object('id', id, 'access_enabled', access_enabled)) from public.vault_settings),
  'content_gate', (select jsonb_agg(jsonb_build_object('id', id, 'access_enabled', access_enabled)) from public.vault_content_settings),
  'migrations', (
    select jsonb_agg(to_jsonb(m)) from (
      select version, name from supabase_migrations.schema_migrations order by version
    ) m
  ),
  'vault_counts', jsonb_build_object(
    'memberships', (select count(*) from public.vault_memberships),
    'sections', (select count(*) from public.vault_sections),
    'documents', (select count(*) from public.vault_documents),
    'grants', (select count(*) from public.vault_content_grants),
    'records', (select count(*) from public.vault_content_records),
    'objects', (select count(*) from storage.objects where bucket_id in ('vault-documents','vault-evidence'))
  ),
  'policies', (
    select jsonb_agg(to_jsonb(p)) from (
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where (schemaname = 'public' and left(tablename, 6) = 'vault_')
         or (schemaname = 'storage' and tablename in ('objects','buckets'))
      order by schemaname, tablename, policyname
    ) p
  ),
  'client_privileges', (
    select jsonb_agg(to_jsonb(g)) from (
      select grantee, table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and left(table_name, 6) = 'vault_'
        and grantee in ('PUBLIC','anon','authenticated')
      order by grantee, table_name, privilege_type
    ) g
  ),
  'storage_rls', (
    select jsonb_agg(to_jsonb(s)) from (
      select c.relname as name, c.relrowsecurity as rls_enabled
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'storage' and c.relname in ('objects','buckets') order by c.relname
    ) s
  ),
  'auth_triggers', (
    select jsonb_agg(to_jsonb(a)) from (
      select t.tgname as trigger_name, n.nspname as function_schema,
             p.proname as function_name, p.prosecdef as security_definer,
             p.proconfig as function_settings
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace cn on cn.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
      where cn.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
      order by t.tgname
    ) a
  )
) as readiness;
