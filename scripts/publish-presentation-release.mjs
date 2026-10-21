// Publishes only the screened projection, never raw intake or original legal records.
import fs from 'node:fs/promises'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const account='18ab41342b712e6d2a83057299705832',worker='jb3-private-investment-vault',title=worker+'-presentation'
const root=process.env.JB3_PRIVATE_CONTENT_ROOT
if(!root)throw Error('External intake root required')
const ledger=JSON.parse(await fs.readFile(path.join(root,'presentation-release/deployment.private.json'),'utf8'))
const raw=execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','auth','token','--json'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})
const a=JSON.parse(raw.slice(raw.indexOf('{'))),auth=a.type==='api_key'?{'X-Auth-Key':a.key,'X-Auth-Email':a.email}:{Authorization:'Bearer '+a.token}
async function api(resource,method='GET',body){const response=await fetch('https://api.cloudflare.com/client/v4'+resource,{method,headers:{...auth,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});const j=await response.json();if(!response.ok||!j.success)throw Error('Cloudflare publication API rejected '+response.status+' codes '+(j.errors??[]).map(e=>e.code).join(','));return j.result}
const domains=await api('/accounts/'+account+'/workers/domains')
if(!domains.some(d=>d.hostname==='bruce.jb3ai.com'&&d.service===worker&&d.environment==='production'))throw Error('Existing target mapping mismatch')
let receipt;try{receipt=JSON.parse(await fs.readFile('tmp/presentation-publication.json','utf8'))}catch{}
const namespaces=await api('/accounts/'+account+'/storage/kv/namespaces?per_page=100')
let namespace=namespaces.find(n=>n.title===title)
if(namespace&&namespace.id!==receipt?.namespaceId)throw Error('Unowned existing namespace; no changes made')
if(!namespace){namespace=await api('/accounts/'+account+'/storage/kv/namespaces','POST',{title});await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/presentation-publication.json',JSON.stringify({namespaceId:namespace.id,title,account,worker}))}
const content=JSON.parse(await fs.readFile(ledger.content,'utf8'))
if(content.data.documents.some(d=>d.classification==='LEGAL_RESTRICTED'))throw Error('Restricted content cannot be published')
if(content.data.evidenceReviews?.some(review=>review.metadata['publication.scope']==='loopback-owner-review-only'))throw Error('Loopback owner review content cannot be published')
const serverProposal=Object.values(content.assets).find(asset=>asset.filename==='07_server_upgrade.pdf')
if(serverProposal&&ledger.approval?.files?.[serverProposal.sha256]?.scope!=='public-presentation-download')throw Error('Explicit server proposal publication approval required')
for(const {record} of content.data.sectionVisuals??[]){const asset=content.assets[record.id];if(record.classification!=='BRUCE_PRIVATE'||record.approval==='rejected'||!asset||asset.sha256!==record.file?.sha256||ledger.approval?.files?.[asset.sha256]?.scope!=='public-presentation-visual')throw Error('Unapproved presentation visual cannot be published')}
for(const cover of content.data.thumbnailPreviews??[]){const parentPublished=content.data.documents.some(r=>r.id===cover.parentId),asset=content.assets[cover.recordId],approval=ledger.approval?.files?.[cover.sha256];if(!asset||asset.sha256!==cover.sha256||asset.mime!=='image/png')throw Error('Cover index mismatch');if(cover.previewKind||!parentPublished){if(approval?.scope!=='public-presentation-cover'||approval.parentId!==cover.parentId||approval.parentSha256!==cover.parentSha256||approval.previewKind!==cover.previewKind||!parentPublished&&cover.previewKind!=='neutral')throw Error('Unsafe unpublished-parent cover');if(!parentPublished&&content.assets[cover.parentId])throw Error('Unpublished original indexed with safe cover')}}
if(Object.values(content.assets).some(asset=>ledger.approval?.files?.[asset.sha256]?.scope==='withhold-original'))throw Error('Review-held original cannot be published')
const entries=[]
for(const upload of ledger.uploads){const b=await fs.readFile(upload.file);if(createHash('sha256').update(b).digest('hex')!==upload.sha256)throw Error('Prepared file changed');entries.push({key:upload.key,value:b.toString('base64'),base64:true})}
// Assets first, versioned index last. Incomplete copies cannot become the selected release.
for(let i=0;i<entries.length;i+=8)await api('/accounts/'+account+'/storage/kv/namespaces/'+namespace.id+'/bulk','PUT',entries.slice(i,i+8))
await api('/accounts/'+account+'/storage/kv/namespaces/'+namespace.id+'/bulk','PUT',[{key:ledger.release+'/content',value:JSON.stringify(content)}])
const config=JSON.parse(await fs.readFile('wrangler.jsonc','utf8'))
if(config.name!==worker||config.account_id!==account)throw Error('Local Worker configuration mismatch')
config.kv_namespaces=[...(config.kv_namespaces??[]).filter(n=>n.binding!=='VAULT_PRESENTATION'),{binding:'VAULT_PRESENTATION',id:namespace.id}]
config.vars={...config.vars,VAULT_PRESENTATION_RELEASE:ledger.release}
await fs.writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n')
console.log(JSON.stringify({publishedProjection:true,account,worker,namespaceId:namespace.id,release:ledger.release,assets:entries.length,sections:ledger.sections,documents:ledger.documents,sourceFilesInGit:false,workerDeploymentExecuted:false}))
