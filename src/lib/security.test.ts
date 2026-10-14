import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
let db: PGlite
const privateUser = '00000000-0000-0000-0000-000000000001'
const commercialUser = '00000000-0000-0000-0000-000000000002'
const outsider = '00000000-0000-0000-0000-000000000003'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth, storage, public to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
  `)
  const migrationDir = path.resolve('supabase/migrations')
  const migration = readdirSync(migrationDir).find(name => name.endsWith('_vault_access.sql'))!
  await db.exec(readFileSync(path.join(migrationDir, migration), 'utf8'))
  await db.exec(`
    insert into auth.users values ('${privateUser}'), ('${commercialUser}'), ('${outsider}');
    insert into public.vault_memberships(user_id, access_level) values ('${privateUser}', 'PRIVATE'), ('${commercialUser}', 'COMMERCIAL');
    insert into public.vault_sections(id,number,title,subtitle,overview,disclosure,approved) values
      ('private',1,'Private fixture','Fixture','Synthetic','PRIVATE',true),
      ('approved',2,'Approved fixture','Fixture','Synthetic','COMMERCIAL',true),
      ('draft',3,'Draft fixture','Fixture','Synthetic','COMMERCIAL',false);
    insert into public.vault_documents(section_id,title,disclosure,approved,storage_path) values
      ('private','Private fixture','PRIVATE',true,'private.pdf'),
      ('approved','Commercial fixture','COMMERCIAL',true,'approved.pdf'),
      ('approved','Unapproved fixture','COMMERCIAL',false,'draft.pdf'),
      ('draft','Hidden parent fixture','COMMERCIAL',true,'hidden-parent.pdf');
    insert into storage.objects(bucket_id,name) values
      ('vault-documents','private.pdf'),('vault-documents','approved.pdf'),
      ('vault-documents','draft.pdf'),('vault-documents','hidden-parent.pdf'),('vault-documents','orphan.pdf');
  `)
}, 60000)
afterAll(async () => { await db?.close() })

async function asUser<T>(id: string | null, query: string, anonymous = false): Promise<T[]> {
  await db.exec('begin')
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ''])
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, is_anonymous: anonymous })])
    await db.exec('set local role ' + (id ? 'authenticated' : 'anon'))
    return (await db.query<T>(query)).rows
  } finally { await db.exec('rollback') }
}
describe('migration policies in embedded PostgreSQL (not live Supabase)', () => {
  it('ships disabled and denies all content even to PRIVATE members', async () => {
    expect(await asUser(privateUser, 'select * from vault_sections')).toEqual([])
    expect(await asUser(privateUser, 'select * from vault_documents')).toEqual([])
    expect(await asUser(privateUser, 'select * from storage.objects')).toEqual([])
    await db.exec('update vault_settings set access_enabled = true')
  })
  it('denies unauthenticated database reads', async () => {
    await expect(asUser(null, 'select * from vault_sections')).rejects.toThrow(/permission denied/)
    await expect(asUser(null, 'select * from vault_documents')).rejects.toThrow(/permission denied/)
  })
  it('denies accounts without a membership and anonymous-auth users', async () => {
    expect(await asUser(outsider, 'select * from vault_sections')).toEqual([])
    expect(await asUser(outsider, 'select * from storage.objects')).toEqual([])
    expect(await asUser(privateUser, 'select * from vault_sections', true)).toEqual([])
  })
  it('limits COMMERCIAL members to approved commercial sections', async () => {
    expect(await asUser<{ id: string }>(commercialUser, 'select id from vault_sections')).toEqual([{ id: 'approved' }])
    expect(await asUser<{ storage_path: string }>(commercialUser, 'select storage_path from vault_documents')).toEqual([{ storage_path: 'approved.pdf' }])
  })
  it('blocks direct private, unapproved, hidden-parent and orphan storage paths', async () => {
    expect(await asUser<{ name: string }>(commercialUser, 'select name from storage.objects')).toEqual([{ name: 'approved.pdf' }])
    expect(await asUser(commercialUser, "select * from storage.objects where name = 'private.pdf'")).toEqual([])
  })
  it('permits PRIVATE membership to see both tiers, including drafts', async () => {
    expect(await asUser(privateUser, 'select id from vault_sections')).toHaveLength(3)
    expect(await asUser(privateUser, 'select id from vault_documents')).toHaveLength(4)
    expect(await asUser(privateUser, 'select name from storage.objects')).toHaveLength(4)
  })
  it('rejects client self-promotion, approval, deletion, and access activation', async () => {
    for (const query of [
      "update vault_memberships set access_level = 'PRIVATE'",
      'update vault_sections set approved = true',
      'delete from vault_documents',
      'update vault_settings set access_enabled = true',
      "insert into vault_memberships(user_id,access_level) values ('" + outsider + "','PRIVATE')",
      "insert into storage.objects(bucket_id,name) values ('vault-documents','injected.pdf')"
    ]) await expect(asUser(commercialUser, query)).rejects.toThrow()
  })
  it('enforces membership expiry and immediate revocation for future reads', async () => {
    await db.exec("update vault_memberships set expires_at = now() - interval '1 second' where user_id = '" + commercialUser + "'")
    expect(await asUser(commercialUser, 'select * from vault_documents')).toEqual([])
    await db.exec("update vault_memberships set active = false where user_id = '" + privateUser + "'")
    expect(await asUser(privateUser, 'select * from storage.objects')).toEqual([])
  })
  it('keeps the document bucket private and only allows PDF uploads', async () => {
    const result = await db.query<{ public: boolean; allowed_mime_types: string[] }>('select public, allowed_mime_types from storage.buckets')
    expect(result.rows).toEqual([{ public: false, allowed_mime_types: ['application/pdf'] }])
  })
})
