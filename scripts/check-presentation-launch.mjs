import {chromium} from 'playwright'
import {unzipSync,strFromU8} from 'fflate'
import {PDFDocument} from 'pdf-lib'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
async function checkedFetch(url){let failure;for(let i=0;i<3;i++){try{return await fetch(url,{signal:AbortSignal.timeout(45000)})}catch(e){failure=e}}throw failure}
const origin=process.argv[2]??'http://127.0.0.1:5189',folder='tmp/launch-review'
await fs.mkdir(folder,{recursive:true});const browser=await chromium.launch()
let stage='start'
try{
 const response=await checkedFetch(origin+'/api/vault/presentation/content');assert.equal(response.status,200);const data=await response.json()
 assert.equal(data.sections.length,11);assert(data.sections.every(s=>s.narrative.payload.body.trim()));assert(data.documents.every(r=>r.classification!=='LEGAL_RESTRICTED'))
 let assets=0
 for(const item of [...data.documents,...data.laboratory.photographs,...(data.thumbnailPreviews??[]).map(r=>({id:r.recordId}))]){const r=await checkedFetch(origin+'/api/vault/presentation/assets/'+item.id);assert.equal(r.status,200);assert(r.headers.get('cache-control').includes('no-store'));const b=new Uint8Array(await r.arrayBuffer());assert(b.length>50);if(item.kind==='pdf')assert.equal(Buffer.from(b.subarray(0,5)).toString(),'%PDF-');assets++}
 const titles=['Introduction','Current Position','History & Evidence','Assets & Claims','Financial Requirements','Beobacht Alignment','Commercial Pipeline','Southern African Strategy','Financial Forecast','Investment Structures','Closing']
 for(const[device,width,height]of[['desktop',1440,960],['mobile',390,844]]){
  stage=device+' entry';const context=await browser.newContext({viewport:{width,height},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(60000)
  const errors=[];page.on('pageerror',()=>errors.push('browser error'));let authRequests=0;page.on('request',r=>{if(/supabase\.co\/(auth|rest|storage)\//.test(r.url()))authRequests++})
  await page.goto(origin);await page.locator('#landing-title').waitFor();await page.getByRole('button',{name:'Enter vault',exact:true}).click();await page.getByLabel('Presentation PIN').fill('0000');await page.getByRole('button',{name:'Enter',exact:true}).click();await page.getByRole('status').filter({hasText:'That PIN was not accepted.'}).waitFor();await page.getByLabel('Presentation PIN').fill('2323');const started=Date.now();await page.getByRole('button',{name:'Enter',exact:true}).click();await page.locator('.landing-boot').waitFor();await page.getByRole('heading',{name:'Conviction, made tangible.'}).waitFor();const elapsed=(Date.now()-started)/1000
  assert.equal(await page.locator('input[type="email"],input[type="password"]').count(),0);assert.equal(await page.getByText('Demonstration edition',{exact:true}).count(),0);await page.screenshot({path:folder+'/'+device+'-console.png',fullPage:true})
  stage=device+' all chapters'
  for(const title of titles){await page.getByRole('button',{name:'Open '+title,exact:true}).click();await page.locator('.reader h1').waitFor();assert((await page.locator('.narrative').count())>0);assert.equal(await page.getByText('Narrative access pending.',{exact:true}).count(),0);if(title==='History & Evidence'){await page.getByRole('button',{name:'Next: Laboratory development',exact:true}).click();await page.waitForFunction(()=>[...document.images].some(i=>i.src.startsWith('blob:')&&i.naturalWidth>0));assert.equal(await page.locator('iframe').count(),0)}await page.getByRole('button',{name:'Back to Console',exact:true}).click()}
  stage=device+' finance and exports'
  await page.getByRole('button',{name:/^Financial schedules$/i}).click();await page.getByRole('region',{name:'Private financial schedules'}).waitFor().catch(async()=>{await page.locator('.financial-workspace').waitFor()});assert.equal(await page.locator('.financial-workspace').count(),1)
  await page.getByLabel('ZAR per GBP',{exact:true}).fill('20')
  for(const label of ['Combined workbook','Personal schedule','Business schedule']){const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await pending,bytes=new Uint8Array(await fs.readFile(await download.path())),z=unzipSync(bytes);const assumptions=strFromU8(z['xl/worksheets/sheet2.xml']);assert(assumptions.includes('<v>20</v>'))}
  await page.getByRole('tab',{name:/Business schedule/}).click();assert((await page.locator('.finance-ledger').count())>=2);await page.getByRole('tab',{name:'Repayment scenarios',exact:true}).click();assert((await page.locator('.financial-workspace').textContent()).includes('GBP'))
  stage=device+' portfolio'
  await page.getByRole('button',{name:'Portfolio',exact:true}).click();await page.getByRole('tab',{name:/Showcase/}).waitFor();await page.screenshot({path:folder+'/'+device+'-portfolio.png',fullPage:true})
  for(const tab of [/Showcase/,/Client Engagements/]){await page.getByRole('tab',{name:tab}).click();const card=page.locator('.portfolio-card').first();if(await card.count()){const view=card.getByRole('button',{name:/View document:/});if(await view.count()){await view.click();await page.locator('.react-pdf__Page__canvas').waitFor();await page.getByRole('button',{name:'Back to library',exact:true}).click()}const dl=page.locator('.portfolio-card').first().getByRole('button',{name:/Download PDF:/});if(await dl.count()){const pending=page.waitForEvent('download');await dl.click();const downloaded=await pending;assert.equal((await fs.readFile(await downloaded.path())).subarray(0,5).toString(),'%PDF-')}}}
  stage=device+' master PDF'
  await page.getByRole('button',{name:/^Executive briefing$/i}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download Master PDF',exact:true}).click();const download=await pending,bytes=await fs.readFile(await download.path());assert((await PDFDocument.load(bytes)).getPageCount()>5)
  if(process.env.JB3_PRIVATE_CONTENT_ROOT)await fs.writeFile(path.join(process.env.JB3_PRIVATE_CONTENT_ROOT,'presentation-release',device+'-review.pdf'),bytes)
  assert.equal(authRequests,0);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close()
  console.log(JSON.stringify({device,passed:true,bootSeconds:elapsed,sections:11,excelExports:3,masterPdf:true,pdfViewer:true,authenticationRequests:0}))
 }
 const old=await checkedFetch(origin+'/api/vault/assets/00000000-0000-4000-8000-000000000001');assert.equal(old.status,401)
 console.log(JSON.stringify({passed:true,origin,assetsChecked:assets,documents:data.documents.length,restrictedLegalRecords:0,originalProtectedGatewayStatus:old.status}))
}catch(e){console.log(JSON.stringify({passed:false,stage,error:e.message.split('\n').slice(0,5).join(' ')}));process.exitCode=1}finally{await browser.close()}
