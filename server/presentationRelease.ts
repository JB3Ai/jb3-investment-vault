import { presentationWorkbook, presentationPdf } from './presentationExports'
import { validExchangeRate } from '../src/lib/financialSchedules'
import { validSustainable, emptySustainable } from '../src/lib/financialScenarios'
import type { LocalReview } from '../src/lib/localReview'

export interface PresentationStore {
 get(key: string, type: 'text'): Promise<string | null>
 get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
}
export interface PresentationEnv { VAULT_PRESENTATION?: PresentationStore; VAULT_PRESENTATION_RELEASE?: string }
interface Release { data: LocalReview; assets: Record<string, {key:string;mime:string;filename:string;sha256:string}> }
const headers = {'Cache-Control':'private, no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Cloudflare-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}
// Deliberately published presentation copies only. This is not an Auth or RLS bypass.
// Supabase's classified gateway and its release gates remain separate and unchanged.
export async function presentationRelease(request:Request, env:PresentationEnv):Promise<Response> {
 const reply=(body:BodyInit|null,status:number,extra:Record<string,string>={})=>new Response(body,{status,headers:{...headers,...extra}})
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/vault\/presentation\//,'')
  if(url.search || !['content','financial-export','master-pdf'].includes(path)&&!/^assets\/[0-9a-f-]{36}$/.test(path))return reply(null,404)
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return reply(null,403)
  if(!env.VAULT_PRESENTATION || !/^presentation-[a-z0-9-]+$/.test(env.VAULT_PRESENTATION_RELEASE??''))return reply(null,503)
  const raw=await env.VAULT_PRESENTATION.get(env.VAULT_PRESENTATION_RELEASE+'/content','text')
  if(!raw)return reply(null,503)
  const release=JSON.parse(raw) as Release
  if(release.data.documents.some(r=>r.classification==='LEGAL_RESTRICTED'))return reply(null,503)
  if(path==='content'){
   if(request.method!=='GET')return reply(null,405)
   return reply(JSON.stringify(release.data),200,{'Content-Type':'application/json'})
  }
  if(path.startsWith('assets/')){
   if(!['GET','HEAD'].includes(request.method))return reply(null,405)
   const asset=release.assets[path.slice(7)]
   if(!asset || !asset.key.startsWith(env.VAULT_PRESENTATION_RELEASE+'/assets/'))return reply(null,404)
   if(request.headers.has('Range'))return reply(null,416)
   const data=await env.VAULT_PRESENTATION.get(asset.key,'arrayBuffer')
   if(!data)return reply(null,404)
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('')
   if(hash!==asset.sha256)return reply(null,503)
   return reply(request.method==='HEAD'?null:data,200,{'Content-Type':asset.mime,'Content-Length':String(data.byteLength),'Content-Disposition':'inline; filename="'+asset.filename.replace(/[^a-zA-Z0-9._ -]/g,'_')+'"'})
  }
  if(request.method!=='POST' || request.headers.get('content-type')!=='application/json')return reply(null,405)
  const text=await request.text();if(text.length>2048)return reply(null,400)
  const options=JSON.parse(text)
  if(!options || !['combined','personal','business'].includes(options.scope)||!validExchangeRate(options.zarPerGbp)||Object.keys(options).some(k=>!['scope','zarPerGbp','scenario'].includes(k)))return reply(null,400)
  const scenario=options.scenario?validSustainable(options.scenario):emptySustainable
  const bytes=path==='financial-export'?presentationWorkbook(release.data.finances,options.scope,options.zarPerGbp,scenario):await presentationPdf(release.data,options.zarPerGbp,scenario)
  return reply(bytes as BodyInit,200,{'Content-Type':path==='financial-export'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf','Content-Disposition':'attachment; filename="JB3-'+(path==='financial-export'?options.scope+'-draft.xlsx':'investment-presentation.pdf')+'"'})
 }catch{return reply(null,400)}
}
