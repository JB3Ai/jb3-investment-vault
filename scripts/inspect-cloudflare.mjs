// Read-only inventory. Native Wrangler credentials stay in memory, never in evidence.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const hash=value=>createHash('sha256').update(String(value)).digest('hex')
const account='18ab41342b712e6d2a83057299705832', name='jb3-private-investment-vault'
try {
  const raw=execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','auth','token','--json'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:240000})
  const auth=JSON.parse(raw.slice(raw.indexOf('{')))
  if(!auth.token && !(auth.type==='api_key'&&auth.key&&auth.email))throw new Error()
  const headers=auth.type==='api_key'?{'X-Auth-Key':auth.key,'X-Auth-Email':auth.email}:{Authorization:`Bearer ${auth.token}`}
  async function get(resource) {
    try {
      const r=await fetch(`https://api.cloudflare.com/client/v4${resource}`,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(30000)})
      const j=await r.json()
      return {status:r.status,ok:r.ok&&j.success===true,result:j.success?j.result:null,codes:(j.errors??[]).map(e=>e.code),page:j.result_info}
    } catch {return {status:null,ok:false,codes:['NETWORK'],result:null}}
  }
  const [identity,scripts,subdomain,domains,zones,settings,secrets]=await Promise.all([
    get(`/accounts/${account}`),get(`/accounts/${account}/workers/scripts`),get(`/accounts/${account}/workers/subdomain`),get(`/accounts/${account}/workers/domains`),get(`/zones?account.id=${account}&per_page=50`),
    get(`/accounts/${account}/workers/scripts/${name}/settings`),get(`/accounts/${account}/workers/scripts/${name}/secrets`),
  ])
  const pages=[];let pagesComplete=false,pagesFailure=null
  for(let page=1;page<=100;page++) {
    const r=await get(`/accounts/${account}/pages/projects?page=${page}`)
    if(!r.ok){pagesFailure={status:r.status,codes:r.codes};break}
    pages.push(...r.result.map(p=>({name:p.name,subdomain:p.subdomain,domains:p.domains,repository:p.source?.config?.repo_name,productionBranch:p.production_branch,automaticProductionDeployments:p.source?.config?.production_deployments_enabled,bindings:Object.fromEntries(Object.entries(p.deployment_configs??{}).map(([env,cfg])=>[env,Object.entries(cfg.env_vars??{}).map(([key,v])=>({name:key,type:v.type}))]))})))
    if(page>=(r.page?.total_pages??1)){pagesComplete=true;break}
  }
  const zoneResults=[]
  for(const z of zones.result??[]) {
    if(!/^[a-f0-9]{32}$/.test(z.id))throw new Error()
    const [routes,cache,pageRules]=await Promise.all([get(`/zones/${z.id}/workers/routes`),get(`/zones/${z.id}/rulesets/phases/http_request_cache_settings/entrypoint`),get(`/zones/${z.id}/pagerules?status=active`)])
    zoneResults.push({id:z.id,name:z.name,routes:{status:routes.status,codes:routes.codes,items:routes.result},cache:{status:cache.status,codes:cache.codes,rules:cache.result?.rules?.map(r=>({id:r.id,action:r.action,expressionSha256:hash(r.expression),mentionsVaultApi:String(r.expression).includes('/api/vault/'),enabled:r.enabled,cacheEnabled:r.action_parameters?.cache,edgeTtl:r.action_parameters?.edge_ttl?.default,browserTtl:r.action_parameters?.browser_ttl?.default}))},pageRules:{status:pageRules.status,codes:pageRules.codes,items:pageRules.result?.map(r=>({id:r.id,targetsSha256:hash(JSON.stringify(r.targets)),actions:r.actions?.map(a=>({id:a.id}))}))}})
  }
  const exists=scripts.ok? scripts.result.some(s=>s.id===name):null
  const bindings=settings.result?.bindings?.map(b=>({name:b.name,type:b.type}))??[]
  const output={checkedAt:new Date().toISOString(),account,accountVerified:identity.ok&&identity.result.id===account,worker:name,workerExists:exists,
    existingWorkers:scripts.ok?scripts.result.map(s=>s.id):null,workersReadStatus:scripts.status,subdomain:subdomain.result?.subdomain,
    prospectiveOrigin:subdomain.ok?`https://${name}.${subdomain.result.subdomain}.workers.dev`:null,
    domains:{status:domains.status,items:domains.result?.map(d=>({hostname:d.hostname,service:d.service,environment:d.environment,enabled:d.enabled}))},
    runtime:{settingsStatus:settings.status,settingsCodes:settings.codes,bindings,cacheEnabled:settings.result?.cache?.enabled??null,secretsStatus:secrets.status,secretsCodes:secrets.codes,secretNames:secrets.result?.map(s=>s.name)??[],privilegedPlaintext:bindings.some(b=>b.name==='SUPABASE_SECRET_KEY'&&b.type!=='secret_text')},
    pages:{complete:pagesComplete,failure:pagesFailure,items:pages},zones:{complete:zones.ok&&(zones.page?.total_pages??1)===1,status:zones.status,items:zoneResults}}
  mkdirSync('tmp/production-preparation',{recursive:true});writeFileSync('tmp/production-preparation/cloudflare.json',JSON.stringify(output,null,2))
  console.log(JSON.stringify(output,null,2))
  if(!output.accountVerified||exists!==false||!pagesComplete||!zones.ok)process.exitCode=1
} catch {
  console.log(JSON.stringify({check:'cloudflare-read-only-inventory',passed:false,failure:'authentication-or-read-unavailable'}));process.exitCode=1
}
