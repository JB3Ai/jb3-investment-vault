// Explicitly authorized operator tool. No real source file is ever loaded.
import { loadEnvFile } from 'node:process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync, fork } from 'node:child_process'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { blankManifest, parseManifest } from '../../content-migration/ingestion-schema.ts'
import { focusedRetest } from './focused-revocation.mjs'
import { createGatewayProbes, exactStorageGuard, GATEWAY_ORIGIN, GUARD_SHA256 } from './gateway-probes.ts'
import { assertionRecord } from './diagnostics.mjs'

const REF = 'uxeolplwhtyyefpmwktw'
const URL = `https://${REF}.supabase.co`
const classes = ['BRUCE_PRIVATE', 'COMMERCIAL', 'LEGAL_RESTRICTED']
const results = []
let admin, baseline, authBefore, directory, probes, gatesTouched = false, fixturesStarted = false
const users = [], records = [], documents = [], objects = [], sections = [], clients = []
const runId = randomUUID()
const focused = process.argv.includes('--focus-expiry')
const exerciseCache = process.argv.includes('--exercise-cache-history')
let probeIndex = 0
// Reproduction is explicit; safe operator uploads default to no cache retention.
const privateCacheControl = process.argv.includes('--reproduce-cache-defaults') ? '3600' : '0'
const diagnostics = {}
const ledger = { runId, projectRef: REF, createdAt: new Date().toISOString(), users, records, documents, objects, sections }
const sha = value => createHash('sha256').update(value).digest('hex')
const quoted = value => `'${String(value).replaceAll("'", "''")}'`
const identifier = value => `"${String(value).replaceAll('"', '""')}"`
class OperatorAssertion extends Error {}
const requireThat = (condition, code) => { if (!condition) throw new OperatorAssertion(code) }
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) } }
const log = message => console.log(message) // Only fixed case identifiers and booleans/counts.
const save = async () => { if (directory) await writeFile(path.join(directory, 'ownership.json'), JSON.stringify(ledger, null, 2), { mode: 0o600 }) }
const saveEvidence = async update => {
  Object.assign(diagnostics,update??{})
  await writeFile(path.join(directory,'assertions.json'),JSON.stringify({results,...diagnostics},null,2),{mode:0o600})
}
const cli = args => {
  try { return execFileSync(path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe'), args, { encoding: 'utf8', windowsHide: true, timeout: 240000, stdio: ['ignore','pipe','pipe'] }) }
  catch { throw new Error('cli-read-only-operation-failed') }
}
async function sql(query) {
  const file = path.join(directory, 'read-only-query.sql')
  await writeFile(file, query, { mode: 0o600 })
  const result = JSON.parse(cli(['db','query','--linked','--project-ref',REF,'--output','json','--file',file]))
  return result.rows
}
function hostedAuth() {
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile','-File',path.resolve('supabase/preflight/inspect-hosted-auth.ps1')], { encoding: 'utf8', windowsHide: true, timeout: 45000, stdio: ['ignore','pipe','pipe'] })
    const auth = JSON.parse(raw)
    const s = auth.settings
    requireThat(auth.passed && auth.project_ref === REF, 'auth-management-prerequisite')
    for (const key of ['password_min_length','password_required_characters','jwt_exp','refresh_token_rotation_enabled','security_refresh_token_reuse_interval','sessions_timebox','sessions_inactivity_timeout','sessions_single_per_user']) requireThat(Object.hasOwn(s,key), 'auth-setting-missing')
    requireThat(s.external_email_enabled === true && s.password_min_length <= 64, 'auth-password-prerequisite')
    requireThat(Object.keys(auth.hooks).length >= 7 && Object.values(auth.hooks).every(enabled => enabled === false), 'auth-hooks-require-impact-review')
    return auth
  } catch { throw new Error('hosted-auth-prerequisite-failed') }
}
async function check(name, action) {
  try { await action(); results.push({ name, result: 'PASS', at: new Date().toISOString() }); log(`PASS ${name}`) }
  catch (error) {
    const detail = error instanceof OperatorAssertion ? error.message : 'operator-exception-without-secret-details'
    results.push({ name, result: 'FAIL', detail, at: new Date().toISOString() })
    log(`FAIL ${name}`)
    throw new OperatorAssertion(`case-failed:${name}`)
  }
}
const ok = (result, code) => { requireThat(!result.error, code); return result.data }
async function closed() {
  for (const table of ['vault_settings','vault_content_settings']) {
    const row = ok(await admin.from(table).select('id,access_enabled').eq('id',1).single(), 'gate-read-failed')
    requireThat(row.id === 1 && row.access_enabled === false, 'gate-not-closed')
  }
}
async function closeGates() {
  for (const table of ['vault_settings','vault_content_settings']) {
    const rows = ok(await admin.from(table).update({ access_enabled:false }).eq('id',1).select('id,access_enabled'), 'gate-close-failed')
    requireThat(rows.length === 1 && rows[0].access_enabled === false, 'gate-close-unverified')
  }
  await closed()
}
async function inventory() {
  const state = JSON.parse(cli(['db','query','--linked','--project-ref',REF,'--output','json','--file','supabase/preflight/live-security-readiness.sql'])).rows[0].readiness
  requireThat(state.tables.length === 7 && state.tables.every(table=>table.rls_enabled), 'vault-table-rls-prerequisite')
  requireThat(state.buckets.length === 2 && state.buckets.every(bucket=>bucket.public === false), 'private-bucket-prerequisite')
  requireThat(!state.auth_triggers?.length, 'auth-trigger-impact-review-required')
  requireThat(state.migrations.some(m=>m.name==='vault_access' && m.version==='20261016101851') && state.migrations.some(m=>m.name==='private_content_ingestion' && m.version==='20261016101857'), 'migration-history-mismatch')
  return state
}
async function snapshot() {
  const relations = await sql("select schemaname,tablename from pg_tables where schemaname in ('public','ops') and left(tablename,6)<>'vault_' order by schemaname,tablename")
  const parts = relations.map(({schemaname,tablename}) => `select ${quoted(`${schemaname}.${tablename}`)} as resource, count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by md5(row_to_json(t)::text)),'')) as fingerprint from ${identifier(schemaname)}.${identifier(tablename)} t`)
  parts.push("select 'auth.users' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from auth.users t")
  parts.push("select 'storage.objects' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from storage.objects t")
  parts.push("select 'storage.buckets' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from storage.buckets t")
  parts.push("select 'migration_history' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from supabase_migrations.schema_migrations t")
  parts.push("select 'policies' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from pg_policies t")
  parts.push("select 'table_acl_rls' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from (select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ops','storage') and c.relkind in ('r','p')) t")
  parts.push("select 'application_functions' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from (select n.nspname,p.proname,p.prosrc,p.proacl::text,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','ops')) t")
  parts.push("select 'application_triggers' as resource,count(*)::text as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint from (select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ops','auth')) t")
  return sql(`select * from (${parts.join(' union all ')}) fingerprints order by resource`)
}
async function proveOwnership() {
  for (const [table, field, owned] of [['vault_content_records','id',records],['vault_sections','id',sections],['vault_documents','id',documents]]) {
    const rows = ok(await admin.from(table).select('*'), 'ownership-inventory-failed')
    requireThat(rows.length === owned.length && rows.every(row=>owned.some(item=>item.id === row[field])), 'unrecognized-vault-record')
  }
  for (const table of ['vault_memberships','vault_content_grants']) {
    const rows = ok(await admin.from(table).select('user_id'), 'ownership-grant-check-failed')
    requireThat(rows.every(row=>users.some(user=>user.id===row.user_id)), 'unrecognized-vault-grant')
  }
  const paths = await sql("select bucket_id,name from storage.objects where bucket_id in ('vault-documents','vault-evidence')")
  requireThat(paths.length === objects.length && paths.every(row=>objects.some(item=>item.bucket===row.bucket_id && item.path===row.name)), 'unrecognized-vault-object')
}
async function window(legacy, content, action) {
  await closed(); await proveOwnership()
  const watchdog = fork(path.resolve('supabase/acceptance/gate-watchdog.mjs'), [], { windowsHide:true, stdio:['ignore','ignore','ignore','ipc'] })
  let deadlineFailed = false, windowDeadline = 0
  watchdog.on('exit', () => { deadlineFailed = true })
  watchdog.on('message', message => { if(Object.hasOwn(message,'watchdogClosed')) deadlineFailed = true })
  try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new OperatorAssertion('watchdog-startup-timeout')),45000)
    watchdog.once('error',()=>{clearTimeout(timeout); reject(new OperatorAssertion('watchdog-startup-failed'))})
    watchdog.once('exit',()=>{clearTimeout(timeout); reject(new OperatorAssertion('watchdog-exited-before-ready'))})
    watchdog.once('message',message=>{
      clearTimeout(timeout)
      if(message.watchdogReady) resolve()
      else reject(new OperatorAssertion('watchdog-not-ready'))
    })
  })
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new OperatorAssertion('watchdog-arm-timeout')),10000)
    watchdog.once('message',message=>{
      clearTimeout(timeout)
      if(message.watchdogArmed)resolve()
      else reject(new OperatorAssertion('watchdog-not-armed'))
    })
    windowDeadline = Date.now()+60000
    watchdog.send({arm:windowDeadline})
  })
  gatesTouched = true
    ok(await admin.from('vault_settings').update({access_enabled:legacy}).eq('id',1), 'gate-window-open-failed')
    ok(await admin.from('vault_content_settings').update({access_enabled:content}).eq('id',1), 'gate-window-open-failed')
    await action()
    requireThat(!deadlineFailed && Date.now() < windowDeadline, 'gate-window-deadline')
  } finally {
    await closeGates()
    if (watchdog.connected) watchdog.send('verified-closed')
  }
}
const contentRows = async client => ok(await client.from('vault_content_records').select('id,classification,approval'), 'content-query-failed')
async function deniedRead(client, id) {
  const result = await client.from('vault_content_records').select('id').eq('id',id)
  requireThat(result.error?.code === '42501' || !result.error && result.data.length===0, 'unauthorized-content-returned-or-unexpected-error')
}
async function deniedAsset(client, asset) {
  const id = `denial.${++probeIndex}`
  await probes.checkGateway(`${id}.gateway`,client,asset,true)
  await probes.directDenied(`${id}.storage`,client,asset)
}
function pdf() {
  const stream='BT /F1 12 Tf 36 80 Td (Synthetic acceptance fixture only) Tj ET'
  const bodies=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let text='%PDF-1.4\n'; const offsets=[0]
  for(const [index,body] of bodies.entries()){ offsets.push(Buffer.byteLength(text)); text+=`${index+1} 0 obj\n${body}\nendobj\n` }
  const start=Buffer.byteLength(text); text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  return Buffer.from(text)
}
const fileBytes = new Map()
async function seed() {
  fixturesStarted = true
  for (let index=0;index<4;index++) {
    const tag=`vault-test-${runId}-${index}`
    const password=`Va!${randomBytes(48).toString('base64url')}9z`
    const response=await admin.auth.admin.createUser({email:`${tag}@example.invalid`,password,email_confirm:true,user_metadata:{vault_test_run:runId}})
    const user=ok(response,'synthetic-user-create-failed')?.user
    requireThat(user?.id && user.user_metadata?.vault_test_run===runId, 'synthetic-user-ownership-unverified')
    users.push({id:user.id,tag}); await save()
    const client=createClient(URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,options)
    ok(await client.auth.signInWithPassword({email:user.email,password}), 'synthetic-sign-in-failed')
    clients.push(client)
    requireThat(ok(await client.auth.getUser(), 'signed-in-user-verify-failed').user.id===user.id, 'signed-in-user-mismatch')
  }
  for (let index=0;index<3;index++) ok(await admin.from('vault_content_grants').insert({user_id:users[index].id,classification:classes[index]}), 'synthetic-grant-insert-failed')
  ok(await admin.from('vault_memberships').insert([{user_id:users[0].id,access_level:'PRIVATE'},{user_id:users[1].id,access_level:'COMMERCIAL'}]), 'synthetic-membership-insert-failed')
  const manifest=blankManifest(), now=new Date().toISOString().slice(0,10)
  for (const [index, section] of manifest.sections.entries()) {
    sections.push({id:section.id}); await save()
    ok(await admin.from('vault_sections').insert({id:section.id,number:index+1,title:`Synthetic ${index+1}`,subtitle:`Test run ${runId}`,overview:'Synthetic only',narrative:[],evidence:[],verification:'DEMONSTRATION',disclosure:index===1?'COMMERCIAL':'PRIVATE',approved:true}), 'synthetic-section-insert-failed')
  }
  for (const classification of classes) {
    for (const state of ['approved','draft','rejected','awaiting']) {
      manifest.sections[0].records.push({id:randomUUID(),kind:'narrative',classification,verification:state==='awaiting'?'awaiting-verification':'reported',approval:state==='awaiting'?'draft':state,provenance:{originalFilename:'synthetic.md',sourceDate:now,citation:'Synthetic fixture lines 1-3',sourceReference:`synthetic:${runId}`,reviewedBy:state==='approved'?'Synthetic test reviewer':null,reviewedOn:state==='approved'?now:null,conflictNote:null},payload:{heading:'Synthetic acceptance only',body:'Synthetic paragraph one.\n\nSynthetic paragraph two.'},file:null})
    }
    for (const approval of ['approved','draft']) {
      const id=randomUUID(), bytes=pdf(), hash=sha(bytes)
      fileBytes.set(id,bytes)
      manifest.sections[0].records.push({id,kind:'pdf',classification,verification:'documented',approval,provenance:{originalFilename:'synthetic.pdf',sourceDate:now,citation:'Synthetic page 1',sourceReference:`synthetic:${runId}`,reviewedBy:approval==='approved'?'Synthetic test reviewer':null,reviewedOn:approval==='approved'?now:null,conflictNote:null},payload:{title:'Synthetic PDF only'},file:{relativePath:`sources/${id}.pdf`,sha256:hash,mimeType:'application/pdf'}})
    }
    const id=randomUUID(), bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
    fileBytes.set(id,bytes)
    manifest.sections[0].records.push({id,kind:'photograph',classification,verification:'documented',approval:'approved',provenance:{originalFilename:'synthetic.png',sourceDate:now,citation:'Generated one-pixel fixture',sourceReference:`synthetic:${runId}`,reviewedBy:'Synthetic test reviewer',reviewedOn:now,conflictNote:null},payload:{caption:'Synthetic image',alt:'Synthetic one-pixel image'},file:{relativePath:`sources/${id}.png`,sha256:sha(bytes),mimeType:'image/png'}})
  }
  parseManifest(manifest)
  await writeFile(path.join(directory,'synthetic-manifest.private.json'),JSON.stringify(manifest,null,2),{mode:0o600})
  for(const section of manifest.sections) for(const record of section.records) {
    const storage=record.file ? `${record.classification}/${record.id}/${record.file.sha256}` : null
    const row={...record,section_id:section.id,storage_path:storage,sha256:record.file?.sha256??null,mime_type:record.file?.mimeType??null}; delete row.file
    records.push({id:row.id,classification:row.classification,approval:row.approval,verification:row.verification,kind:row.kind}); await save()
    ok(await admin.from('vault_content_records').insert(row), 'synthetic-content-insert-failed')
    if(storage) {
      const item={bucket:'vault-evidence',path:storage,recordId:row.id,hash:row.sha256}; objects.push(item); await save()
      ok(await admin.storage.from(item.bucket).upload(item.path,fileBytes.get(row.id),{contentType:row.mime_type,cacheControl:privateCacheControl,upsert:false}), 'synthetic-storage-upload-failed')
    }
  }
  const legacyId=randomUUID(), legacyPath=`synthetic-${runId}/legacy.pdf`, bytes=pdf()
  documents.push({id:legacyId}); await save()
  ok(await admin.from('vault_documents').insert({id:legacyId,section_id:'introduction',title:`Synthetic ${runId}`,storage_path:legacyPath,approved:true,disclosure:'PRIVATE',verification:'DEMONSTRATION'}),'synthetic-legacy-document-failed')
  objects.push({bucket:'vault-documents',path:legacyPath,hash:sha(bytes),documentId:legacyId}); fileBytes.set(legacyId,bytes); await save()
  ok(await admin.storage.from('vault-documents').upload(legacyPath,bytes,{contentType:'application/pdf',cacheControl:privateCacheControl,upsert:false}),'synthetic-legacy-upload-failed')
  const orphan=`synthetic-${runId}/orphan.pdf`; objects.push({bucket:'vault-evidence',path:orphan,hash:sha(bytes)}); await save()
  ok(await admin.storage.from('vault-evidence').upload(orphan,bytes,{contentType:'application/pdf',cacheControl:privateCacheControl,upsert:false}),'synthetic-orphan-upload-failed')
  const commercialId=randomUUID(), commercialPath=`synthetic-${runId}/commercial.pdf`
  documents.push({id:commercialId}); await save()
  ok(await admin.from('vault_documents').insert({id:commercialId,section_id:manifest.sections[1].id,title:`Synthetic ${runId}`,storage_path:commercialPath,approved:true,disclosure:'COMMERCIAL',verification:'DEMONSTRATION'}),'synthetic-commercial-document-failed')
  objects.push({bucket:'vault-documents',path:commercialPath,documentId:commercialId,hash:sha(bytes)}); fileBytes.set(commercialId,bytes); await save()
  ok(await admin.storage.from('vault-documents').upload(commercialPath,bytes,{contentType:'application/pdf',cacheControl:privateCacheControl,upsert:false}),'synthetic-commercial-upload-failed')
  results.push({name:'four_synthetic_password_signins_and_verified_users',result:'PASS',at:new Date().toISOString()})
}
async function seedFocused() {
  fixturesStarted=true
  const tag=`vault-focused-${runId}`, password=`Va!${randomBytes(48).toString('base64url')}9z`
  const user=ok(await admin.auth.admin.createUser({email:`${tag}@example.invalid`,password,email_confirm:true,user_metadata:{vault_test_run:runId}}),'focused-user-create-failed').user
  requireThat(user?.id&&user.user_metadata?.vault_test_run===runId,'focused-user-ownership-failed')
  users.push({id:user.id,tag}); await save()
  const client=createClient(URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,options)
  ok(await client.auth.signInWithPassword({email:user.email,password}),'focused-sign-in-failed'); clients.push(client)
  ok(await admin.from('vault_memberships').insert({user_id:user.id,access_level:'PRIVATE'}),'focused-membership-insert-failed')
  sections.push({id:'introduction'}); await save()
  ok(await admin.from('vault_sections').insert({id:'introduction',number:1,title:'Synthetic focused fixture',subtitle:`Test run ${runId}`,overview:'Synthetic only',narrative:[],evidence:[],verification:'DEMONSTRATION',disclosure:'PRIVATE',approved:true}),'focused-section-insert-failed')
  const manifest=blankManifest(), today=new Date().toISOString().slice(0,10), bytes=pdf(), hash=sha(bytes)
  for(const classification of classes) manifest.sections[0].records.push({id:randomUUID(),kind:'pdf',classification,verification:'documented',approval:'approved',provenance:{originalFilename:'synthetic-focused.pdf',sourceDate:today,citation:'Synthetic page 1',sourceReference:`synthetic:${runId}`,reviewedBy:'Synthetic reviewer',reviewedOn:today,conflictNote:null},payload:{title:'Synthetic revocation fixture'},file:{relativePath:`sources/${classification}.pdf`,sha256:hash,mimeType:'application/pdf'}})
  parseManifest(manifest)
  await writeFile(path.join(directory,'synthetic-manifest.private.json'),JSON.stringify(manifest,null,2),{mode:0o600})
  for(const record of manifest.sections[0].records) {
    const storage=`${record.classification}/${record.id}/${hash}`
    const row={...record,section_id:'introduction',storage_path:storage,sha256:hash,mime_type:'application/pdf'}; delete row.file
    records.push({id:row.id,classification:row.classification,approval:row.approval,verification:row.verification,kind:row.kind}); await save()
    ok(await admin.from('vault_content_records').insert(row),'focused-record-insert-failed')
    objects.push({bucket:'vault-evidence',path:storage,recordId:row.id,hash}); await save()
    ok(await admin.storage.from('vault-evidence').upload(storage,bytes,{contentType:'application/pdf',cacheControl:privateCacheControl,upsert:false}),'focused-object-upload-failed')
  }
  const id=randomUUID(), legacyPath=`synthetic-${runId}/legacy.pdf`
  documents.push({id}); await save()
  ok(await admin.from('vault_documents').insert({id,section_id:'introduction',title:`Synthetic ${runId}`,storage_path:legacyPath,approved:true,disclosure:'PRIVATE',verification:'DEMONSTRATION'}),'focused-document-insert-failed')
  objects.push({bucket:'vault-documents',path:legacyPath,documentId:id,hash}); await save()
  ok(await admin.storage.from('vault-documents').upload(legacyPath,bytes,{contentType:'application/pdf',cacheControl:privateCacheControl,upsert:false}),'focused-legacy-upload-failed')
}
async function cleanup() {
  if (!admin || !fixturesStarted && !gatesTouched) return
  await closeGates()
  for(const user of users) {
    const found=await admin.auth.admin.getUserById(user.id)
    requireThat(!found.error && found.data.user.user_metadata?.vault_test_run===runId, 'cleanup-user-ownership-failed')
  }
  // Establish ownership of every row before deleting *any* related object or grant.
  for(const record of records) {
    const found=ok(await admin.from('vault_content_records').select('id,provenance').eq('id',record.id).maybeSingle(),'cleanup-record-ownership-read-failed')
    if(found)requireThat(found.provenance.sourceReference===`synthetic:${runId}`,'cleanup-record-ownership-failed')
  }
  for(const doc of documents) {
    const found=ok(await admin.from('vault_documents').select('title,storage_path').eq('id',doc.id).maybeSingle(),'cleanup-document-ownership-read-failed')
    if(found)requireThat(found.title===`Synthetic ${runId}`&&found.storage_path.startsWith(`synthetic-${runId}/`),'cleanup-document-ownership-failed')
  }
  for(const section of sections) {
    const found=ok(await admin.from('vault_sections').select('subtitle').eq('id',section.id).maybeSingle(),'cleanup-section-ownership-read-failed')
    if(found)requireThat(found.subtitle===`Test run ${runId}`,'cleanup-section-ownership-failed')
  }
  for(const user of users) {
    ok(await admin.from('vault_content_grants').delete().eq('user_id',user.id),'cleanup-grants-failed')
    ok(await admin.from('vault_memberships').delete().eq('user_id',user.id),'cleanup-membership-failed')
  }
  for(const client of clients) await client.auth.signOut({scope:'global'})
  for(const item of objects) {
    const download=await admin.storage.from(item.bucket).download(item.path)
    if(!download.error && download.data) requireThat(sha(Buffer.from(await download.data.arrayBuffer()))===item.hash,'cleanup-object-hash-mismatch')
    else requireThat(['404','400'].includes(String(download.error?.statusCode)),'cleanup-object-ownership-unverified')
    ok(await admin.storage.from(item.bucket).remove([item.path]),'cleanup-object-remove-failed')
  }
  for(const record of records) {
    const found=ok(await admin.from('vault_content_records').select('id,provenance').eq('id',record.id).maybeSingle(),'cleanup-record-lookup-failed')
    if(found) requireThat(found.provenance.sourceReference===`synthetic:${runId}`,'cleanup-record-ownership-failed')
    ok(await admin.from('vault_content_records').delete().eq('id',record.id),'cleanup-record-remove-failed')
  }
  for(const doc of documents) ok(await admin.from('vault_documents').delete().eq('id',doc.id).like('title',`Synthetic ${runId}`),'cleanup-doc-failed')
  for(const section of sections) ok(await admin.from('vault_sections').delete().eq('id',section.id).eq('subtitle',`Test run ${runId}`),'cleanup-section-failed')
  for(const user of users) ok(await admin.auth.admin.deleteUser(user.id),'cleanup-user-delete-failed')
  await closed()
  results.push({name:'cleanup_gates_first_and_owned_fixtures_removed',result:'PASS',at:new Date().toISOString()})
  log('PASS cleanup_gates_first_and_owned_fixtures_removed')
}

let blocked = null, critical = false
try {
  requireThat(process.argv.includes('--execute-synthetic'),'explicit-execution-flag-required')
  const allowedFlags=new Set(['--execute-synthetic','--focus-expiry','--exercise-cache-history','--reproduce-cache-defaults',`--gateway-origin=${GATEWAY_ORIGIN}`])
  requireThat(process.argv.slice(2).every(arg=>allowedFlags.has(arg))&&process.argv.includes(`--gateway-origin=${GATEWAY_ORIGIN}`),'exact-gateway-invocation-required')
  requireThat(focused||exerciseCache&&privateCacheControl==='3600','full-cache-challenge-required')
  loadEnvFile('.env.local')
  requireThat(process.env.VITE_SUPABASE_URL===URL,'project-url-mismatch')
  const projects=JSON.parse(cli(['projects','list','--output','json']))
  requireThat(projects.some(project=>project.id===REF && project.name==="JB3Ai's Command Dash" && project.linked && project.status==='ACTIVE_HEALTHY'),'linked-project-mismatch')
  requireThat((await readFile('supabase/.temp/project-ref','utf8')).trim()===REF,'local-project-link-mismatch')
  admin=createClient(URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,options)
  ok(await admin.auth.admin.listUsers({page:1,perPage:1}),'admin-auth-prerequisite-failed')
  authBefore=hostedAuth(); await closed()
  const initial=await inventory()
  requireThat(initial.migrations.length===14,'unexpected-migration-history-count')
  requireThat(exactStorageGuard(initial.policies),'exact-storage-guard-required-before-fixtures')
  requireThat(sha(await readFile('supabase/proposals/vault_gateway_storage_guard.sql'))===GUARD_SHA256,'guard-proposal-checksum-mismatch')
  requireThat(Object.values(initial.vault_counts).every(value=>value===0),'vault-not-empty')
  const base=path.resolve(process.env.LOCALAPPDATA,'JB3Vault/private-content/security-acceptance')
  directory=path.join(base,runId); requireThat(directory.startsWith(base+path.sep),'private-audit-path-invalid')
  await mkdir(directory,{recursive:true}); await save()
  baseline=await snapshot()
  await writeFile(path.join(directory,'baseline.json'),JSON.stringify({baseline,auth:authBefore,installation:initial},null,2),{mode:0o600})
  log('PASS phase_1_auth_hooks_password_session_credentials_and_baseline')
  results.push({name:'phase_1_auth_hooks_password_session_credentials_and_baseline',result:'PASS',at:new Date().toISOString()})
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
  const privilegedHeaders={apikey:key,...(!key.startsWith('sb_secret_')?{Authorization:`Bearer ${key}`}:{})}
  probes=createGatewayProbes({key:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,runId,owned:objects,privilegedHeaders,
    sign:async item=>ok(await admin.storage.from(item.bucket).createSignedUrl(item.path,5),'synthetic-sign-failed').signedUrl,
    observe:async(id,passed,expected,actual)=>{const record=assertionRecord(id,passed,expected,actual);results.push(record);log(JSON.stringify(record));await saveEvidence()},
  })
  function annotateObjects() {
    for(const item of objects){item.syntheticRun=runId;item.size=fileBytes.get(item.recordId??item.documentId)?.length??pdf().length;item.mimeType=records.find(r=>r.id===item.recordId)?.kind==='photograph'?'image/png':'application/pdf'}
    return save()
  }
  if(focused) {
    await seedFocused()
    await annotateObjects()
    await focusedRetest({admin,clients,users,records,objects,results,window,sql,ok,requireThat,saveEvidence,sha,URL,classes,options,probes})
  } else {
  await seed()
  await annotateObjects()
  await check('incorrect_password_denied',async()=>{
    const user=ok(await admin.auth.admin.getUserById(users[0].id),'synthetic-user-lookup-failed').user
    const client=createClient(URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,options)
    const attempt=await client.auth.signInWithPassword({email:user.email,password:`Wrong!${randomBytes(24).toString('hex')}`})
    requireThat(attempt.error?.code==='invalid_credentials' && !attempt.data.session,'incorrect-password-not-denied')
  })
  await check('session_refresh',async()=>{ok(await clients[0].auth.refreshSession(),'refresh-failed')})
  const anonymous=createClient(URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,options)
  for(const [legacy,content] of [[false,false],[false,true],[true,false],[true,true]]) {
    await window(legacy,content,()=>check(`release_gates_${legacy}_${content}`,async()=>{
      for(let index=0;index<4;index++) {
        const rows=await contentRows(clients[index]); const expected=legacy&&content&&index<3 ? records.filter(r=>r.classification===classes[index]&&r.approval==='approved').length : 0
        requireThat(rows.length===expected && rows.every(r=>r.classification===classes[index]&&r.approval==='approved'),'gate-classification-result-mismatch')
      }
      for(const item of objects.filter(o=>o.recordId)) {
        const record=records.find(r=>r.id===item.recordId)
        if(!legacy||!content||record.approval!=='approved') await deniedAsset(clients[classes.indexOf(record.classification)],item)
      }
      await probes.checkGateway(`legacy.gates.${legacy}_${content}`,clients[0],objects.find(o=>o.bucket==='vault-documents'),!legacy||!content)
    }))
  }
  await window(true,true,async()=>{
    await check('anonymous_unassigned_direct_rest_denial',async()=>{
      for(const client of [anonymous,clients[3]]) for(const record of records) await deniedRead(client,record.id)
    })
    await check('exact_grants_cross_class_and_draft_rejection',async()=>{
      for(let index=0;index<3;index++) for(const record of records) {
        if(record.classification!==classes[index]||record.approval!=='approved') await deniedRead(clients[index],record.id)
      }
    })
  })
  for(let index=0;index<3;index++) for(const [objectIndex,item] of objects.entries()) {
    await window(true,true,()=>check(`gateway_asset_matrix_${index}_${objectIndex}`,async()=>{
      const record=records.find(r=>r.id===item.recordId)
      if(record?.classification===classes[index]&&record.approval==='approved') {
        await probes.checkGateway(`classified.${index}.${objectIndex}.gateway`,clients[index],item,false)
        await probes.directDenied(`classified.${index}.${objectIndex}.direct`,clients[index],item)
      } else if(item.bucket==='vault-evidence') await deniedAsset(clients[index],item)
    }))
  }
  for(const [objectIndex,item] of objects.entries()) await window(true,true,()=>check(`outsider_asset_${objectIndex}`,async()=>{
    await deniedAsset(anonymous,item);await deniedAsset(clients[3],item)
  }))
  for(const [index,item] of objects.filter(o=>o.recordId&&records.find(r=>r.id===o.recordId)?.approval==='approved').entries()) {
    const record=records.find(r=>r.id===item.recordId), client=clients[classes.indexOf(record.classification)]
    await window(true,true,()=>check(`gateway_protocol_${index}`,()=>probes.protocol(`protocol.${index}`,client,item)))
  }
  for(const [index,item] of objects.filter(o=>o.documentId).entries()) await window(true,true,()=>check(`legacy_gateway_${index}`,async()=>{
    await probes.protocol(`legacy.${index}.private`,clients[0],item)
    await probes.checkGateway(`legacy.${index}.commercial`,clients[1],item,index===0)
    await probes.directDenied(`legacy.${index}.direct`,clients[0],item)
  }))
  const cacheItems=[objects.find(o=>o.recordId&&records.find(r=>r.id===o.recordId)?.approval==='approved'),objects.find(o=>o.documentId)]
  for(const [i,item] of cacheItems.entries()) await window(true,true,()=>check(`cache_history_prime_${i}`,()=>probes.warmHistory(`cache.${i}`,item)))
  for(const [legacy,content] of [[false,false],[false,true],[true,false],[true,true]]) await window(legacy,content,()=>check(`cached_urls_gates_${legacy}_${content}`,()=>probes.historyDenied(`cache.gates.${legacy}_${content}`,clients[0])))
  await window(true,true,()=>check('concurrent_gateway_classification_isolation',async()=>{
    await Promise.all([probes.checkGateway('concurrent.owner',clients[0],cacheItems[0],false),probes.checkGateway('concurrent.other',clients[1],cacheItems[0],true)])
  }))
  await window(true,true,async()=>{
    await check('client_writes_self_grants_and_release_changes_denied',async()=>{
      const client=clients[0], own=users[0].id, record=records[0]
      const probes=[
        client.from('vault_content_grants').insert({user_id:own,classification:'LEGAL_RESTRICTED'}),
        client.from('vault_memberships').insert({user_id:users[3].id,access_level:'PRIVATE'}),
        client.from('vault_content_records').update({approval:'approved'}).eq('id',records.find(r=>r.approval==='draft').id),
        client.from('vault_content_records').delete().eq('id',record.id),
        client.from('vault_settings').update({access_enabled:false}).eq('id',1),
        client.from('vault_content_settings').update({access_enabled:false}).eq('id',1),
        client.from('vault_sections').update({title:'Client injection'}).eq('id','introduction'),
        client.from('vault_documents').delete().eq('id',documents[0].id),
      ]
      for(const result of await Promise.all(probes)) requireThat(!!result.error,'client-write-not-rejected')
      for(const bucket of ['vault-documents','vault-evidence']) {
        const item=objects.find(o=>o.bucket===bucket), bytes=pdf()
        requireThat(!!(await client.storage.from(bucket).upload(`synthetic-${runId}/client-injection.pdf`,bytes,{contentType:'application/pdf'})).error,'client-upload-allowed')
        requireThat(!!(await client.storage.from(bucket).update(item.path,bytes,{contentType:'application/pdf'})).error,'client-overwrite-allowed')
        const removal=await client.storage.from(bucket).remove([item.path])
        requireThat(removal.error||removal.data.length===0,'client-delete-allowed')
        const retained=ok(await admin.storage.from(bucket).download(item.path),'client-delete-mutated-object')
        requireThat(sha(Buffer.from(await retained.arrayBuffer()))===item.hash,'client-write-changed-object')
      }
      requireThat(ok(await admin.from('vault_content_grants').select('classification').eq('user_id',own),'grant-recheck-failed').length===1,'client-grant-mutated')
    })
  })
  await window(true,true,async()=>{
    await check('expired_and_revoked_exact_grants',async()=>{
      for(let index=0;index<3;index++) {
        const item=objects.find(o=>o.recordId&&records.find(r=>r.id===o.recordId)?.classification===classes[index]&&records.find(r=>r.id===o.recordId)?.approval==='approved')
        for(const update of [{expires_at:new Date(Date.now()-60000).toISOString()},{expires_at:null,active:false}]) {
          ok(await admin.from('vault_content_grants').update(update).eq('user_id',users[index].id).eq('classification',classes[index]),'grant-revocation-failed')
          requireThat((await contentRows(clients[index])).length===0,'revoked-grant-content-returned'); await deniedAsset(clients[index],item)
          await probes.denyProtocol(`grant.${index}.${update.active===false?'revoked':'expired'}`,clients[index],item)
          if(index===0)await probes.historyDenied(`cache.grant.${update.active===false?'revoked':'expired'}`,clients[index])
        }
        ok(await admin.from('vault_content_grants').update({active:true,expires_at:null}).eq('user_id',users[index].id).eq('classification',classes[index]),'grant-restore-failed')
      }
    })
    await check('legacy_membership_does_not_grant_new_classification',async()=>{
      ok(await admin.from('vault_memberships').insert({user_id:users[3].id,access_level:'PRIVATE'}),'legacy-only-setup-failed')
      requireThat((await contentRows(clients[3])).length===0,'legacy-membership-promoted-content')
      ok(await admin.from('vault_memberships').delete().eq('user_id',users[3].id),'legacy-only-cleanup-failed')
    })
    await check('legacy_membership_expiry_revocation',async()=>{
      const item=objects.find(o=>o.bucket==='vault-documents')
      for(const update of [{expires_at:new Date(Date.now()-60000).toISOString()},{expires_at:null,active:false}]) {
        ok(await admin.from('vault_memberships').update(update).eq('user_id',users[0].id),'membership-revoke-failed'); await deniedAsset(clients[0],item)
        await probes.denyProtocol(`membership.${update.active===false?'revoked':'expired'}`,clients[0],item)
        await probes.historyDenied(`cache.membership.${update.active===false?'revoked':'expired'}`,clients[0])
      }
      ok(await admin.from('vault_memberships').update({active:true,expires_at:null}).eq('user_id',users[0].id),'membership-restore-failed')
    })
  })
  await check('sign_out_and_refresh_invalidation',async()=>{
    for(const [index,client] of clients.entries()) {
      const session=ok(await client.auth.getSession(),'session-read-failed').session
      requireThat(!!session,'session-missing')
      ok(await client.auth.signOut({scope:'local'}),'sign-out-failed')
      requireThat(ok(await client.auth.getSession(),'signed-out-read-failed').session===null,'session-not-cleared')
      const refresh=await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),signal:AbortSignal.timeout(10000)})
      requireThat(!refresh.ok,'signed-out-refresh-accepted')
      await window(true,true,async()=>{
        await probes.checkGateway(`signout.${index}.anonymous`,client,cacheItems[0],true)
        ok(await admin.from('vault_content_grants').update({active:false}).eq('user_id',users[index].id),'signout-grant-revoke-failed')
        ok(await admin.from('vault_memberships').update({active:false}).eq('user_id',users[index].id),'signout-membership-revoke-failed')
        const captured={auth:{getSession:async()=>({data:{session:{access_token:session.access_token}}})}}
        await probes.denyProtocol(`signout.${index}.captured`,captured,cacheItems[0])
      })
    }
  })
  }
} catch(error) {
  blocked=/^[a-z0-9_.:-]+$/i.test(error.message??'')?error.message:'operator-test-failed'
  log(`STOP ${blocked}`)
} finally {
  try { await cleanup() } catch { critical=true; results.push({name:'cleanup_and_gate_restoration',result:'CRITICAL',at:new Date().toISOString()}); log('CRITICAL cleanup_or_gate_restoration_unverified') }
  if(admin) {
    try {
      await closed()
      const final=await inventory()
      requireThat(Object.values(final.vault_counts).every(v=>v===0),'residual-vault-fixtures')
      results.push({name:'final_gates_false_and_vault_empty',result:'PASS',at:new Date().toISOString()})
      if(baseline) {
        const after=await snapshot(), authAfter=hostedAuth()
        const same=JSON.stringify(after)===JSON.stringify(baseline)&&authAfter.auth_config_sha256===authBefore.auth_config_sha256
        await writeFile(path.join(directory,'after.json'),JSON.stringify({baseline:after,auth:authAfter},null,2),{mode:0o600})
        requireThat(same,'shared-resource-baseline-mismatch')
        results.push({name:'shared_data_storage_users_policies_acl_history_auth_unchanged',result:'PASS',at:new Date().toISOString()})
      }
    } catch { critical=true; results.push({name:'final_state_or_shared_baseline_verification',result:'CRITICAL',at:new Date().toISOString()}); log('CRITICAL final_state_or_baseline_unverified') }
  }
  if(probes?.historyCount()&&!critical) try {
    const anonymous={auth:{getSession:async()=>({data:{session:null}})}}
    await probes.historyDenied('cache.after_cleanup',anonymous,true)
  } catch { blocked ||= 'historical-cache-denial-unverified';log('STOP historical-cache-denial-unverified') }
  const evidence={runId,projectRef:REF,gatewayOrigin:GATEWAY_ORIGIN,overallAcceptance:!focused&&!blocked&&!critical,mode:focused?'focused-expiry-membership-signout':'full-gateway',assetCacheControl:privateCacheControl,finishedAt:new Date().toISOString(),blocked,critical,fixturesStarted,results,counts:{users:users.length,records:records.length,objects:objects.length}}
  if(directory) await writeFile(path.join(directory,'results.json'),JSON.stringify(evidence,null,2),{mode:0o600})
  await mkdir('tmp',{recursive:true});await writeFile('tmp/latest-security-results.json',JSON.stringify(evidence,null,2),{mode:0o600})
  log(JSON.stringify({blocked,critical,fixturesStarted,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result!=='PASS').length}))
  process.exitCode=blocked||critical?1:0
}
