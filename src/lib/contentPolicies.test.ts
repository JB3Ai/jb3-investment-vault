import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
let db: PGlite
const bruce = '00000000-0000-4000-8000-000000000001', commercial = '00000000-0000-4000-8000-000000000002', legal = '00000000-0000-4000-8000-000000000003', outsider = '00000000-0000-4000-8000-000000000004'
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `)
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
  await db.exec(`insert into auth.users values ('${bruce}'),('${commercial}'),('${legal}'),('${outsider}');
    insert into vault_content_grants(user_id,classification) values ('${bruce}','BRUCE_PRIVATE'),('${commercial}','COMMERCIAL'),('${legal}','LEGAL_RESTRICTED');`)
  let n = 1
  for (const classification of ['BRUCE_PRIVATE','COMMERCIAL','LEGAL_RESTRICTED']) for (const approval of ['approved','draft']) {
    const id = `11111111-1111-4111-8111-${String(n++).padStart(12,'0')}`, key = `${classification}/${id}/${'a'.repeat(64)}`
    await db.query(`insert into vault_content_records(id,section_id,kind,classification,verification,approval,provenance,payload,storage_path,sha256,mime_type) values ($1,'introduction','pdf',$2,'documented',$3,$4,'{"title":"Synthetic"}',$5,$6,'application/pdf')`, [id,classification,approval,JSON.stringify({originalFilename:'synthetic.pdf',sourceDate:null,citation:'Synthetic page 1',sourceReference:'test',reviewedBy:'Test',reviewedOn:'2026-10-14',conflictNote:null}),key,'a'.repeat(64)])
    await db.query("insert into storage.objects(bucket_id,name) values ('vault-evidence',$1)",[key])
  }
  await db.exec("insert into storage.objects(bucket_id,name) values ('vault-evidence','orphan.pdf')")
}, 180000)
afterAll(async () => { await db?.close() })
async function asUser(id: string | null, sql: string, anonymous = false) {
  await db.exec('begin')
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id ?? ''])
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({ is_anonymous: anonymous })])
    await db.exec('set local role ' + (id ? 'authenticated' : 'anon'))
    return (await db.query<Record<string, unknown>>(sql)).rows
  } finally { await db.exec('rollback') }
}
describe('three-class content RLS and storage (local PostgreSQL fixtures)', () => {
  it('ships both release gates disabled and denies privileged-class reads', async () => {
    expect((await db.query('select access_enabled from vault_content_settings')).rows).toEqual([{access_enabled:false}])
    expect(await asUser(bruce,'select * from vault_content_records')).toEqual([])
    await db.exec('update vault_settings set access_enabled=true')
    expect(await asUser(bruce,'select * from vault_content_records')).toEqual([])
    await db.exec('update vault_content_settings set access_enabled=true') // synthetic fixture only
  })
  it('denies anonymous, unassigned and anonymous-auth identities', async () => {
    await expect(asUser(null,'select * from vault_content_records')).rejects.toThrow(/permission denied/)
    expect(await asUser(outsider,'select * from vault_content_records')).toEqual([])
    expect(await asUser(bruce,'select * from vault_content_records',true)).toEqual([])
    expect(await asUser(outsider,'select * from storage.objects')).toEqual([])
  })
  it.each([[bruce,'BRUCE_PRIVATE'],[commercial,'COMMERCIAL'],[legal,'LEGAL_RESTRICTED']])('limits %s to its approved classification', async (id, classification) => {
    expect(await asUser(id,'select classification,approval from vault_content_records')).toEqual([{classification,approval:'approved'}])
    const objects = await asUser(id,'select name from storage.objects')
    expect(objects).toHaveLength(1); expect(objects[0].name).toMatch(new RegExp('^' + classification + '/'))
  })
  it('blocks Bruce from direct legal metadata and objects, including orphans', async () => {
    expect(await asUser(bruce,"select * from vault_content_records where classification='LEGAL_RESTRICTED'")).toEqual([])
    expect(await asUser(bruce,"select * from storage.objects where name like 'LEGAL_RESTRICTED/%' or name='orphan.pdf'")).toEqual([])
  })
  it('prevents client self-grants, approval, release activation and uploads', async () => {
    for (const sql of ["update vault_content_grants set classification='LEGAL_RESTRICTED'", "update vault_content_records set approval='approved'", 'update vault_content_settings set access_enabled=true', "insert into storage.objects(bucket_id,name) values ('vault-evidence','injected')"]) await expect(asUser(bruce,sql)).rejects.toThrow()
  })
  it('enforces grant expiry/revocation and keeps the new bucket private', async () => {
    await db.query("update vault_content_grants set expires_at=now()-interval '1 second' where user_id=$1",[bruce])
    expect(await asUser(bruce,'select * from vault_content_records')).toEqual([])
    await db.query('update vault_content_grants set active=false where user_id=$1',[legal])
    expect(await asUser(legal,'select * from storage.objects')).toEqual([])
    expect((await db.query("select public from storage.buckets where id='vault-evidence'")).rows).toEqual([{public:false}])
  })
})
