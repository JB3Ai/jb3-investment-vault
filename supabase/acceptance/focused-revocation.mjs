import { assertionRecord, safeObservation } from './diagnostics.mjs'

export const publicRestHeaders = (key,token) => ({apikey:key,Authorization:`Bearer ${token}`,'Accept-Profile':'public'})

export async function focusedRetest(ctx) {
  const {admin,clients,users,records,objects,results,window,sql,ok,requireThat,saveEvidence,sha,URL,classes,probes} = ctx
  const client=clients[0], user=users[0], trace=[]
  let transport=null
  async function observedFetch(url, opts={}) {
    const response=await fetch(url,{...opts,signal:AbortSignal.timeout(10000)})
    transport=safeObservation({status:response.status,cacheStatus:response.headers.get('cf-cache-status')??'unknown'})
    return response
  }
  const assertResult=async(id,passed,expected,actual)=>{
    const record=assertionRecord(id,passed,expected,actual)
    results.push(record); console.log(JSON.stringify(record)); await saveEvidence()
    requireThat(passed,`assertion-failed:${id}`)
  }
  const session=()=>client.auth.getSession().then(r=>ok(r,'session-read-failed').session)
  async function rawRows(id, token) {
    const response=await observedFetch(`${URL}/rest/v1/vault_content_records?select=id&id=eq.${id}`,{headers:publicRestHeaders(process.env.VITE_SUPABASE_PUBLISHABLE_KEY,token),cache:'no-store'})
    const data=await response.json()
    return safeObservation({status:response.status,rows:Array.isArray(data)?data.length:null,errorCode:response.ok?'none':data.code})
  }
  async function checkAsset(id,item,denied) {
    await probes.checkGateway(id.replace('storage','gateway'),client,item,denied)
    await probes.directDenied(id.replace('storage','direct'),client,item)
  }
  async function grantState(classification) {
    const data=await sql(`select active, expires_at, expires_at < now() as expired, now() as server_now from public.vault_content_grants where user_id='${user.id}' and classification='${classification}'`)
    return {row:data[0],safe:safeObservation({rows:data.length,active:data[0]?.active,expired:data[0]?.expired??false,expiresAt:data[0]?.expires_at?new Date(data[0].expires_at).toISOString():null,serverNow:new Date(data[0].server_now).toISOString()})}
  }
  for(const classification of classes) {
    const token=(await session()).access_token
    const record=records.find(r=>r.classification===classification), item=objects.find(o=>o.recordId===record.id)
    await window(true,true,async()=>{
      ok(await admin.from('vault_content_grants').delete().eq('user_id',user.id),'focused-grant-reset-failed')
      const inserted=await admin.from('vault_content_grants').insert({user_id:user.id,classification,active:true}).select('active,expires_at')
      await assertResult(`${classification}.setup`,!inserted.error&&inserted.data?.length===1,{rows:1,active:true},{status:inserted.status,rows:inserted.data?.length??0,active:inserted.data?.[0]?.active??false})
      const initial=await rawRows(record.id,token)
      await assertResult(`${classification}.baseline.rest`,initial.status===200&&initial.rows===1,{status:200,rows:1},initial)
      const initialSdk=await client.from('vault_content_records').select('id,classification,approval')
      await assertResult(`${classification}.baseline.sdk_rest`,!initialSdk.error&&initialSdk.data?.length===1,{status:200,rows:1},{status:initialSdk.status,rows:initialSdk.data?.length??null})
      await checkAsset(`${classification}.baseline.storage`,item,false)
    })
    for(const mode of ['expiry','revocation']) await window(true,true,async()=>{
        const patch=mode==='expiry'?{active:true,expires_at:new Date(Date.now()-60000).toISOString()}:{active:false,expires_at:null}
        const update=await admin.from('vault_content_grants').update(patch).eq('user_id',user.id).eq('classification',classification).select('active,expires_at')
        await assertResult(`${classification}.${mode}.update`,!update.error&&update.data?.length===1,{rows:1},{status:update.status,rows:update.data?.length??0})
        const state=await grantState(classification)
        await assertResult(`${classification}.${mode}.database`,state.safe.rows===1&&(mode==='expiry'?state.safe.expired:state.safe.active===false),mode==='expiry'?{expired:true}:{active:false},state.safe)
        // Same listing query used by the original failed group, to preserve cache/sequencing behavior.
        const sdk=await client.from('vault_content_records').select('id,classification,approval')
        const actual=safeObservation({status:sdk.status,rows:sdk.data?.length??null,errorCode:sdk.error?.code??'none'})
        await assertResult(`${classification}.${mode}.sdk_rest`,!sdk.error&&actual.rows===0,{status:200,rows:0},actual)
        const fresh=await rawRows(record.id,token)
        await assertResult(`${classification}.${mode}.fresh_rest`,fresh.status===200&&fresh.rows===0,{status:200,rows:0},fresh)
        await checkAsset(`${classification}.${mode}.storage`,item,true)
        await assertResult(`${classification}.${mode}.same_session`,(await session()).access_token===token,{tokenUnchanged:true},{tokenUnchanged:(await session()).access_token===token})
        ok(await admin.from('vault_content_grants').update({active:true,expires_at:null}).eq('user_id',user.id).eq('classification',classification),'focused-grant-restore-failed')
    })
  }
  const legacy=objects.find(item=>item.bucket==='vault-documents')
  await window(true,true,async()=>{
    ok(await admin.from('vault_content_grants').delete().eq('user_id',user.id),'focused-no-grants-setup-failed')
    const result=await client.from('vault_content_records').select('id')
    await assertResult('membership.legacy_only_no_new_content',!result.error&&result.data.length===0,{rows:0},{status:result.status,rows:result.data?.length??null})
    await checkAsset('membership.baseline.storage',legacy,false)
  })
  for(const mode of ['expiry','revocation']) await window(true,true,async()=>{
    const patch=mode==='expiry'?{active:true,expires_at:new Date(Date.now()-60000).toISOString()}:{active:false,expires_at:null}
    const update=await admin.from('vault_memberships').update(patch).eq('user_id',user.id).select('active,expires_at')
    await assertResult(`membership.${mode}.update`,!update.error&&update.data?.length===1,{rows:1},{status:update.status,rows:update.data?.length??0})
    const rows=await sql(`select active, expires_at < now() as expired from public.vault_memberships where user_id='${user.id}'`)
    await assertResult(`membership.${mode}.database`,rows.length===1&&(mode==='expiry'?rows[0].expired:rows[0].active===false),mode==='expiry'?{expired:true}:{active:false},{rows:rows.length,active:rows[0]?.active,expired:rows[0]?.expired??false})
    const sections=await client.from('vault_sections').select('id')
    await assertResult(`membership.${mode}.rest`,!sections.error&&sections.data.length===0,{rows:0},{status:sections.status,rows:sections.data?.length??null})
    await checkAsset(`membership.${mode}.storage`,legacy,true)
    ok(await admin.from('vault_memberships').update({active:true,expires_at:null}).eq('user_id',user.id),'focused-membership-restore-failed')
  })
  const captured=await session()
  await assertResult('signout.session_before',!!captured,{sessionPresent:true},{sessionPresent:!!captured})
  const signedOut=await client.auth.signOut({scope:'local'})
  await assertResult('signout.sdk_success',!signedOut.error,{errorPresent:false},{errorPresent:!!signedOut.error,status:signedOut.error?.status??200})
  await assertResult('signout.memory_cleared',!(await session()),{sessionPresent:false},{sessionPresent:!!(await session())})
  const refreshed=await observedFetch(`${URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:captured.refresh_token})})
  const refreshBody=await refreshed.json()
  await assertResult('signout.refresh_denied',[400,401,403].includes(refreshed.status),{allowed:false},{status:refreshed.status,allowed:refreshed.ok,errorCode:refreshBody.error_code??refreshBody.code??'unknown'})
  await saveEvidence({trace})
}
