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
