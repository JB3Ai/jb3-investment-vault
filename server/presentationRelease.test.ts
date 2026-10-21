import {emptyCashFlow} from '../src/lib/cashFlow'
import {it,expect} from 'vitest'
import {presentationRelease} from './presentationRelease'
import {presentationWorkbook,presentationPdf} from './presentationExports'
import {unzipSync,strFromU8} from 'fflate'
import {PDFDocument} from 'pdf-lib'
import {emptySustainable} from '../src/lib/financialScenarios'
import type {LocalReview} from '../src/lib/localReview'
const row={id:'00000000-0000-4000-8000-000000000001',kind:'financial',classification:'BRUCE_PRIVATE',approval:'draft',verification:'awaiting-verification',file:null,provenance:{originalFilename:'synthetic.xlsx',sourceDate:null,citation:'Personal!A1',sourceReference:'synthetic',reviewedBy:null,reviewedOn:null,conflictNote:null},payload:{label:'Synthetic operating estimate',amountMinor:50000,currency:'ZAR',reconciliationNote:JSON.stringify({monthlyZar:'100',oneOffZar:null,formula:'monthly * 5',note:'Synthetic estimate',optionalHardware:false,cachedTotalZar:'500'})}}
const data={sections:[{id:'introduction',narrative:{payload:{heading:'01 | Introduction',body:'Approved synthetic text only.'}}}],documents:[],finances:{personal:[row],business:[],exchangeRate:{zarPerGbp:25,source:'Synthetic assumption',asOf:null},findings:[]}} as unknown as LocalReview
const env={VAULT_PRESENTATION_RELEASE:'presentation-synthetic',VAULT_PRESENTATION:{get:async()=>JSON.stringify({data,assets:{}})}} as never
it('serves only the published projection and refuses arbitrary resources or bucket selectors',async()=>{
 const response=await presentationRelease(new Request('https://example.test/api/vault/presentation/content'),env)
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store')
 expect((await response.json()).sections).toHaveLength(1)
 for(const url of ['content?bucket=media','assets/../../secret','assets/00000000-0000-4000-8000-000000000099'])expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/'+url),env)).status).toBe(404)
 expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/content',{headers:{Origin:'https://other.test'}}),env)).status).toBe(403)
})
it('does not substitute the published projection for the protected Supabase gateway',async()=>{
 expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/content'),{})).status).toBe(503)
 const blocked={...env as object,VAULT_PRESENTATION:{get:async()=>JSON.stringify({data:{...data,documents:[{classification:'LEGAL_RESTRICTED'}]},assets:{}})}} as never
 expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/content'),blocked)).status).toBe(503)
})
it('exports consistent selected-rate formulas without converting unknown draft amounts into zero',async()=>{
 const bytes=presentationWorkbook(data.finances,'personal',20,emptySustainable),files=unzipSync(bytes)
 const assumptions=strFromU8(files['xl/worksheets/sheet2.xml']),personal=strFromU8(files['xl/worksheets/sheet3.xml'])
 expect(assumptions).toContain('<v>20</v>');expect(personal).toContain('<v>25</v>');expect(personal).toContain('Assumptions!$B$2');expect(personal).toContain('draft')
 const pdf=await presentationPdf(data,20,emptySustainable);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0)
})

it('publishes catalogue notices without granting access even if a held asset is accidentally indexed',async()=>{
 const id='00000000-0000-4000-8000-000000000077'
 const notice={recordId:id,title:'Synthetic legal evidence',association:'Synthetic matter',filename:'synthetic.pdf',classification:'LEGAL_RESTRICTED',sectionIds:['assets-claims'],collection:'legal',status:'Draft / unpublished',reason:'Publication approval absent'}
 const held={...env as object,VAULT_PRESENTATION:{get:async()=>JSON.stringify({data:{...data,documentNotices:[notice]},assets:{[id]:{key:'presentation-synthetic/assets/'+id,mime:'application/pdf'}}})}} as never
 const content=await presentationRelease(new Request('https://example.test/api/vault/presentation/content'),held)
 expect(content.status).toBe(200);expect((await content.json()).documentNotices).toHaveLength(1)
 for(const method of ['GET','HEAD']){const denied=await presentationRelease(new Request('https://example.test/api/vault/presentation/assets/'+id,{method}),held);expect(denied.status).toBe(404);expect(denied.headers.get('cache-control')).toContain('no-store')}
})

it('rejects loopback-only PDF records and covers from the public presentation',async()=>{
 const id='00000000-0000-4000-8000-000000000088',review={recordId:id,metadata:{'publication.scope':'loopback-owner-review-only'}}
 const localOnly={...env as object,VAULT_PRESENTATION:{get:async()=>JSON.stringify({data:{...data,evidenceReviews:[review]},assets:{[id]:{key:'presentation-synthetic/assets/'+id,mime:'application/pdf'}}})}} as never
 for(const resource of ['content','assets/'+id])for(const method of ['GET','HEAD']){const response=await presentationRelease(new Request('https://example.test/api/vault/presentation/'+resource,{method}),localOnly);expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toContain('no-store')}
})

it('exports only a validated cash-flow assumption set against the approved projection',async()=>{const request=(body:unknown,headers:Record<string,string>={})=>new Request('https://example.test/api/vault/presentation/financial-model-export',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});const response=await presentationRelease(request({zarPerGbp:25,input:{...emptyCashFlow(),zeroIncome:true,openingCash:0}}),env);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');const files=unzipSync(new Uint8Array(await response.arrayBuffer()));expect(strFromU8(files['xl/workbook.xml'])).toContain('Cash Flow');expect((await presentationRelease(request({zarPerGbp:25,input:emptyCashFlow(),records:[]}),env)).status).toBe(400);expect((await presentationRelease(request({zarPerGbp:25,input:emptyCashFlow()},{Origin:'https://other.test'}),env)).status).toBe(403);expect((await presentationRelease(request({zarPerGbp:25,input:emptyCashFlow()}),{})).status).toBe(503)})

it('serves safe catalogue cover bytes while all methods keep the unpublished original closed',async()=>{
 const parent='00000000-0000-4000-8000-000000000088',cover='00000000-0000-4000-8000-000000000089',bytes=new Uint8Array([137,80,78,71,13,10,26,10]),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
 const release={data:{...data,documentNotices:[{recordId:parent,title:'Synthetic restricted original',collection:'legal'}]},assets:{[cover]:{key:'presentation-synthetic/assets/'+cover,mime:'image/png',filename:'safe-cover.png',sha256:sha}}}
 const config={VAULT_PRESENTATION_RELEASE:'presentation-synthetic',VAULT_PRESENTATION:{get:async(_key:string,type:string)=>type==='text'?JSON.stringify(release):bytes.buffer}} as never
 const preview=await presentationRelease(new Request('https://example.test/api/vault/presentation/assets/'+cover),config);expect(preview.status).toBe(200);expect(preview.headers.get('cache-control')).toContain('no-store');expect(new Uint8Array(await preview.arrayBuffer())).toEqual(bytes)
 for(const method of ['GET','HEAD'])expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/assets/'+parent,{method}),config)).status).toBe(404)
 expect((await presentationRelease(new Request('https://example.test/api/vault/presentation/assets/'+parent,{headers:{Range:'bytes=0-3'}}),config)).status).toBe(404)
})
