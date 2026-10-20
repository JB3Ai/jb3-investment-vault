import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { createGatewayProbes, exactStorageGuard, GATEWAY_ORIGIN, PROJECT_URL, gatewayHeadersSafe, type TestAsset } from '../supabase/acceptance/gateway-probes'
const runId='10000000-0000-4000-8000-000000000001', id='20000000-0000-4000-8000-000000000002'
const bytes=Buffer.from('%PDF synthetic operator test'), hash=createHash('sha256').update(bytes).digest('hex')
const headers=()=>new Headers({'Cache-Control':'private, no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store',Pragma:'no-cache',Expires:'0',Vary:'Authorization','Content-Length':String(bytes.length)})
const client=(token:string|null='synthetic-user-token')=>({auth:{getSession:async()=>({data:{session:token?{access_token:token}:null}})}})
function fixture() {
  const item:TestAsset={bucket:'vault-evidence',path:`BRUCE_PRIVATE/${id}/${hash}`,recordId:id,hash,syntheticRun:runId,size:bytes.length,mimeType:'application/pdf'}
  const reports:Record<string,unknown>[]=[], calls:{url:string;init:RequestInit}[]=[]
  let now=100000, leakDirect=false, cached=true, signedExpired=false, badHeaders=false
  const token=`e30.${Buffer.from(JSON.stringify({exp:105})).toString('base64url')}.synthetic`
  const signed=`${PROJECT_URL}/storage/v1/object/sign/${item.bucket}/${item.path}?token=${token}`
  const fetcher=vi.fn(async (url:RequestInfo|URL,init:RequestInit={})=>{
    const u=String(url);calls.push({url:u,init})
    if(u.startsWith(GATEWAY_ORIGIN)) {
      const h=headers(), authorized=!!new Headers(init.headers).get('Authorization')
      if(badHeaders)h.set('CF-Cache-Status','HIT')
      if(!authorized)return new Response(null,{status:401,headers:h})
      if(init.method==='HEAD')return new Response(null,{headers:h})
      if(new Headers(init.headers).has('Range')){h.set('Content-Range',`bytes 0-3/${bytes.length}`);return new Response(bytes.subarray(0,4),{status:206,headers:h})}
      return new Response(bytes,{headers:h})
    }
    const privileged=new Headers(init.headers).has('apikey')&&new Headers(init.headers).get('apikey')==='synthetic-admin-key'
    if(privileged||u===signed&&!signedExpired||leakDirect)return new Response(bytes,{headers:cached?{'CF-Cache-Status':'HIT'}:{}})
    return Response.json({error:'Synthetic denied'},{status:403})
  }) as typeof fetch
  const options={key:'synthetic-public-key',runId,owned:[item],fetcher,privilegedHeaders:{apikey:'synthetic-admin-key'},sign:async()=>signed,
    observe:async(name:string,passed:boolean,expected:Record<string,unknown>,actual:Record<string,unknown>)=>{reports.push({name,passed,expected,actual})},
    now:()=>now,wait:async(ms:number)=>{now+=ms;signedExpired=true}}
  return {item,options,probes:createGatewayProbes(options),calls,reports,setLeak:()=>{leakDirect=true},setCached:(v:boolean)=>{cached=v},badHeaders:()=>{badHeaders=true},expire:()=>{signedExpired=true;now=110000}}
}
describe('operator gateway acceptance probes (mock transport, never hosted fixtures)',()=>{
  it('pins origin before any request and never sends privileged keys to the gateway',async()=>{
    const f=fixture();expect(()=>createGatewayProbes({...f.options,origin:'https://foreign.example'})).toThrow('origin-mismatch')
    await expect(f.probes.checkGateway('key',client('sb_secret_synthetic-fixture-only'),f.item,false)).rejects.toThrow('privileged-gateway-token')
    expect(f.calls).toHaveLength(0)
  })
  it('uses UUID gateway requests and verifies bytes and privacy headers',async()=>{
    const f=fixture();await f.probes.checkGateway('allowed',client(),f.item,false)
    expect(f.calls[0].url).toBe(`${GATEWAY_ORIGIN}/api/vault/assets/${id}`)
    expect(f.calls[0].init.cache).toBe('no-store');expect(new Headers(f.calls[0].init.headers).has('apikey')).toBe(false)
    expect(f.reports[0].passed).toBe(true)
  })
  it('checks HEAD, authenticated range prefixes and conditional GET without 304',async()=>{
    const f=fixture();await f.probes.protocol('protocol',client(),f.item)
    expect(f.reports).toHaveLength(4);expect(f.reports.every(r=>r.passed)).toBe(true)
  })
  it('requires empty non-cacheable errors for every HTTP variant',async()=>{
    const f=fixture();await f.probes.denyProtocol('closed',client(null),f.item)
    expect(f.reports).toHaveLength(4);expect(f.reports.every(r=>r.passed)).toBe(true)
  })
  it('rejects cached gateway success rather than accepting valid cached hashes',async()=>{
    const f=fixture();f.badHeaders();await expect(f.probes.checkGateway('cache',client(),f.item,false)).rejects.toThrow('assertion-failed:cache')
  })
  it.each(['HIT','STALE','UPDATING','REVALIDATED','EXPIRED'])('rejects %s metadata on gateway responses',state=>{
    const h=headers();h.set('CF-Cache-Status',state);expect(gatewayHeadersSafe(h)).toBe(false)
  })
  it.each(['Location','ETag','Last-Modified','Set-Cookie','Authorization','apikey','Age'])('rejects unsafe %s response headers',name=>{
    const h=headers();h.set(name,'1');expect(gatewayHeadersSafe(h)).toBe(false)
  })
  it('allows the internal Cloudflare CDN header to be consumed, but not weakened',()=>{
    const h=headers();expect(gatewayHeadersSafe(h)).toBe(true);h.set('Cloudflare-CDN-Cache-Control','public');expect(gatewayHeadersSafe(h)).toBe(false)
  })
  it('tests raw generic/authenticated/public/signing routes as denials',async()=>{
    const f=fixture();await f.probes.directDenied('direct',client(),f.item)
    expect(f.calls).toHaveLength(4);expect(f.calls[0].init.cache).toBe('default')
    expect(f.calls.at(-1)?.init.method).toBe('POST')
    f.setLeak();await expect(f.probes.directDenied('leak',client(),f.item)).rejects.toThrow('assertion-failed:leak.route0')
  })
  it('replays identical warmed URLs after expiry and deletion without URL/token diagnostics',async()=>{
    const f=fixture();await f.probes.warmHistory('warm',f.item);const warmUrls=f.calls.map(c=>c.url)
    await f.probes.historyDenied('expired',client(),true)
    expect(f.calls.slice(-3).every(c=>warmUrls.includes(c.url))).toBe(true)
    expect(f.calls.every(c=>!c.url.includes('cache_bust'))).toBe(true)
    expect(JSON.stringify(f.reports)).not.toContain('token=');expect(JSON.stringify(f.reports)).not.toContain(PROJECT_URL)
    f.setLeak();await expect(f.probes.historyDenied('leak',client())).rejects.toThrow('assertion-failed:leak.historical0')
  })
  it('never marks a challenge with no observed cache hit as passing coverage',async()=>{
    const f=fixture();f.setCached(false);await f.probes.warmHistory('warm',f.item);f.expire()
    await expect(f.probes.historyDenied('cold',client(),true)).rejects.toThrow('assertion-failed:cold.cache_was_observed')
  })
  it('refuses non-owned objects even with a supplied privileged credential',async()=>{
    const f=fixture();await expect(f.probes.warmHistory('foreign',{...f.item})).rejects.toThrow('non-owned-probe-object');expect(f.calls).toHaveLength(0)
  })
})
describe('exact live policy precondition',()=>{
  const guard={schemaname:'storage',tablename:'objects',policyname:'Vault downloads require trusted gateway',permissive:'RESTRICTIVE',cmd:'SELECT',roles:['authenticated','anon'],qual:"(bucket_id <> ALL (ARRAY['vault-documents'::text, 'vault-evidence'::text]))",with_check:null}
  it('requires the exact two-bucket restrictive SELECT definition and roles',()=>{
    expect(exactStorageGuard([guard])).toBe(true);expect(exactStorageGuard([])).toBe(false)
    for(const mutation of [{permissive:'PERMISSIVE'},{roles:['authenticated']},{cmd:'ALL'},{qual:guard.qual+' OR true'},{qual:guard.qual.replace('vault-evidence','media')}])expect(exactStorageGuard([{...guard,...mutation}])).toBe(false)
    expect(exactStorageGuard([guard,guard])).toBe(false)
  })
})
