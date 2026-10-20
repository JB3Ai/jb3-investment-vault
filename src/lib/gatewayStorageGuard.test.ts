import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { exactStorageGuard } from '../../supabase/acceptance/gateway-probes'
let db: PGlite
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema storage; grant usage on schema storage to anon,authenticated,service_role;
    create table storage.objects(bucket_id text);
    alter table storage.objects enable row level security;
    grant select on storage.objects to anon,authenticated,service_role;
    create policy "Existing shared buckets" on storage.objects for select to anon,authenticated using (bucket_id in ('documents','media'));
    create policy "Existing Vault reads" on storage.objects for select to authenticated using (bucket_id in ('vault-documents','vault-evidence'));
    insert into storage.objects values ('documents'),('media'),('vault-documents'),('vault-evidence');
  `)
},120000)
afterAll(async()=>{await db?.close()})
async function buckets(role:'anon'|'authenticated'|'service_role'){
  await db.exec(`begin; set local role ${role}`)
  try {return (await db.query<{bucket_id:string}>('select bucket_id from storage.objects order by bucket_id')).rows.map(row=>row.bucket_id)}
  finally {await db.exec('rollback')}
}
describe('proposed gateway-only Storage guard (local, never applied live)',()=>{
  it('removes direct authenticated Vault reads while preserving shared reads',async()=>{
    expect(await buckets('authenticated')).toEqual(['documents','media','vault-documents','vault-evidence'])
    await db.exec(readFileSync('supabase/proposals/vault_gateway_storage_guard.sql','utf8'))
    const liveShape=await db.query<Parameters<typeof exactStorageGuard>[0][number]>("select schemaname,tablename,policyname,permissive,cmd,roles,qual,with_check from pg_policies where policyname='Vault downloads require trusted gateway'")
    expect(exactStorageGuard(liveShape.rows)).toBe(true)
    expect(await buckets('authenticated')).toEqual(['documents','media'])
  })
  it('preserves anonymous access to unrelated buckets',async()=>{
    expect(await buckets('anon')).toEqual(['documents','media'])
  })
  it('preserves trusted backend access without modifying existing policies',async()=>{
    expect(await buckets('service_role')).toEqual(['documents','media','vault-documents','vault-evidence'])
    expect((await db.query("select policyname from pg_policies where tablename='objects' order by policyname")).rows).toHaveLength(3)
  })
  it('still blocks Vault reads if a future permissive policy is accidentally broad',async()=>{
    await db.exec('create policy "Synthetic broad permissive read" on storage.objects for select to anon,authenticated using (true)')
    expect(await buckets('authenticated')).toEqual(['documents','media'])
    expect(await buckets('anon')).toEqual(['documents','media'])
  })
})
