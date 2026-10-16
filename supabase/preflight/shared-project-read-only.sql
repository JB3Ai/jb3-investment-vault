-- Metadata-only compatibility preflight. NOT a migration; do not move into migrations/.
-- Intended dashboard project: JB3Ai's Command Dash / uxeolplwhtyyefpmwktw.
-- Verify dashboard project identity first: SQL database names do not prove project identity.
-- No application rows, Auth user identities, passwords or function bodies are selected.
-- Keep exported results in private operator custody, outside Git/public assets.
begin transaction read only;

select current_database() as database_name, current_user as inspection_role,
       current_setting('server_version') as server_version,
       current_setting('transaction_read_only') as read_only;

-- Required platform objects/functions and optional shared profile/migration tables.
select to_regclass('auth.users') as auth_users,
       to_regclass('storage.buckets') as storage_buckets,
       to_regclass('storage.objects') as storage_objects,
       to_regclass('public.profiles') as profiles_if_present,
       to_regclass('supabase_migrations.schema_migrations') as migration_history,
       to_regprocedure('auth.uid()') as auth_uid,
       to_regprocedure('auth.jwt()') as auth_jwt,
       to_regprocedure('pg_catalog.gen_random_uuid()') as uuid_generator;

-- Public relations/ACLs and platform RLS state; no application data is read.
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as explicit_acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relkind in ('r','p','v','m','S','i','I'))
   or (n.nspname='storage' and c.relname in ('objects','buckets'))
   or (n.nspname='auth' and c.relname='users')
order by n.nspname,c.relname;

-- Vault-prefixed names require collision review; shared RPCs require privilege review.
-- Inspect callable privileged/dynamic-SQL function bodies separately in private custody.
select n.nspname as schema_name,p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,p.proconfig,p.proacl::text as function_acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
order by p.proname;

-- Review EVERY Storage policy, including ALL/write and PUBLIC-role policies.
-- Names alone cannot establish compatibility: evaluate expressions and role membership.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='storage' and tablename in ('objects','buckets'))
   or (schemaname='public' and left(tablename,6)='vault_')
order by schemaname,tablename,policyname;

-- No bucket insert/update/delete; include existing metadata for isolation/regression review.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets order by id;

-- Shared signup triggers may provision profiles or other JB3 memberships indirectly.
select n.nspname as table_schema,c.relname as table_name,t.tgname,t.tgenabled,
       fn.nspname as function_schema,p.proname as function_name,
       p.prosecdef as security_definer,p.proconfig
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_proc p on p.oid=t.tgfoid
join pg_namespace fn on fn.oid=p.pronamespace
where not t.tgisinternal and n.nspname='auth' and c.relname='users'
order by t.tgname;

-- DDL event triggers can change behavior/default grants when new tables are created.
select e.evtname,e.evtevent,e.evtenabled,e.evttags,
       n.nspname as function_schema,p.proname as function_name
from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
join pg_namespace n on n.oid=p.pronamespace order by e.evtname;

select pg_get_userbyid(d.defaclrole) as creator_role,
       coalesce(n.nspname,'<all schemas>') as schema_name,
       d.defaclobjtype,d.defaclacl::text as default_acl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where d.defaclnamespace=0 or n.nspname='public'
order by creator_role,schema_name,d.defaclobjtype;

select rolname,rolsuper,rolbypassrls,rolinherit from pg_roles
where rolname in ('anon','authenticated','service_role','postgres');
select pg_get_userbyid(roleid) as granted_role,
       pg_get_userbyid(member) as member_role,admin_option
from pg_auth_members order by granted_role,member_role;

-- Inspect history shape without changing, repairing or registering any migrations.
select column_name,data_type from information_schema.columns
where table_schema='supabase_migrations' and table_name='schema_migrations'
order by ordinal_position;
rollback;

-- Run the following separate metadata-only transaction ONLY if the preceding
-- check confirms schema_migrations has version/name columns. Preserve all 12 rows.
-- begin transaction read only;
-- select version,name from supabase_migrations.schema_migrations order by version;
-- rollback;

-- Auth provider/hooks/SMTP/JWT/Site URL/redirect settings require separate
-- read-only Dashboard or Management API inspection; they are not verified here.
