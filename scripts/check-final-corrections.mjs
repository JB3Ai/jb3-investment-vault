import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
const origin=process.argv[2]??'http://127.0.0.1:5190',folder='tmp/final-corrections'
await fs.mkdir(folder,{recursive:true})
async function get(resource){let last;for(let i=0;i<3;i++){try{return await fetch(origin+resource,{signal:AbortSignal.timeout(30000)})}catch(e){last=e}}throw last}
const data=await (await get('/api/vault/presentation/content')).json(),notices=data.documentNotices??[]
const legal=notices.filter(n=>n.collection==='legal'),clientHolds=notices.filter(n=>n.collection==='client-engagements')
assert.deepEqual(legal.map(n=>n.title),['KULA','Micore',"Children's Custody",'Blackburn House'])
assert.equal(legal.find(n=>n.title==='Micore').recordId,null)
assert.equal(new Set(legal.filter(n=>n.recordId).map(n=>n.recordId)).size,3)
for(const notice of notices.filter(n=>n.recordId)){assert.equal((await get('/api/vault/presentation/assets/'+notice.recordId)).status,404)}
assert.equal(clientHolds.length,2)
const hardware=data.documents.find(r=>data.evidenceReviews.find(e=>e.recordId===r.id)?.metadata['documents.category']==='hardware-investment')
assert(hardware);assert.equal(hardware.approval,'draft')
assert(data.documents.some(r=>r.provenance.originalFilename==='SSG_FINAL_DRAFT.pdf'))
assert(data.documents.some(r=>r.provenance.originalFilename==='Exec Deck (SNG Grant Thornton) (Presentation).pdf'))
assert.equal(data.documents.filter(r=>r.classification==='LEGAL_RESTRICTED').length,0)
const browser=await chromium.launch();let stage='start',activePage
try{
 for(const[device,width,height]of (process.argv[3]?[[process.argv[3],process.argv[3]==='desktop'?1440:process.argv[3]==='tablet'?1024:390,process.argv[3]==='desktop'?960:process.argv[3]==='tablet'?900:844]]:[['desktop',1440,960],['tablet',1024,900],['mobile',390,844]])){
  stage=device+' entry';const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(45000)
  activePage=page;const errors=[];page.on('pageerror',()=>errors.push('browser error'))
  await page.goto(origin);await page.getByRole('button',{name:'Enter vault',exact:true}).click();await page.getByLabel('Presentation PIN').fill('2323');await page.getByRole('button',{name:'Enter',exact:true}).click();await page.getByRole('heading',{name:'Conviction, made tangible.'}).waitFor()
  assert.equal(await page.locator('input[type=email],input[type=password]').count(),0)
  stage=device+' chapter navigation';await page.getByRole('button',{name:'Open Introduction',exact:true}).click()
  const nav=page.getByRole('complementary',{name:'Reader contents'}),selector=page.getByLabel('Investment chapter',{exact:true})
  assert.equal(await nav.getByRole('navigation',{name:'Investment chapters'}).isVisible(),width>=1200)
  assert.equal(await selector.isVisible(),width<1200)
  assert.equal(await selector.locator('option').count(),12)
  async function chapter(id){const section=data.sections.find(s=>s.id===id),index=data.sections.indexOf(section);if(width>=1200)await nav.locator('.chapter-list li').filter({has:page.locator('button[aria-current]')}).count();if(width>=1200)await nav.locator('.chapter-list li').filter({hasNot:page.locator('.chapter-interlude')}).getByRole('button').filter({hasText:String(index+1).padStart(2,'0')}).click();else await selector.selectOption(id);await page.waitForFunction(id=>location.hash==='#chapter/'+id,id);assert.equal(await page.locator('.reader h1').count(),1);assert((await page.locator('.narrative').textContent()).trim().length>50)}
  for(const s of data.sections)await chapter(s.id)
  await chapter('history-evidence');await page.screenshot({path:folder+'/'+device+'-chapters.png',fullPage:false})
  await page.getByRole('button',{name:'Next: Laboratory development',exact:true}).click();await page.locator('.laboratory-review').waitFor();assert.equal(new URL(page.url()).hash,'#laboratory')
  stage=device+' laboratory';await page.waitForFunction(()=>document.querySelector('.laboratory-review img')?.naturalWidth>0)
  const seen=new Set();const review=data.laboratory.review
  if(review){for(const slot of review.slots){await page.getByRole('button',{name:new RegExp('^Show position '+slot.position+',')}).click();if(slot.recordId){await page.waitForFunction(id=>document.querySelector('.laboratory-review img')?.getAttribute('data-record-id')===id&&document.querySelector('.laboratory-review img')?.naturalWidth>0,slot.recordId);seen.add(slot.recordId)}else assert.equal(await page.locator('.laboratory-review .gallery-empty').count(),1)}for(const item of review.unplaced){await page.getByRole('button',{name:new RegExp('^Review original photo '+item.originalNumber+' ')}).click();await page.waitForFunction(id=>document.querySelector('.laboratory-review img')?.getAttribute('data-record-id')===id&&document.querySelector('.laboratory-review img')?.naturalWidth>0,item.recordId);seen.add(item.recordId)}}
  assert.equal(seen.size,12);await page.getByLabel('Laboratory text size').selectOption('large');assert.equal(await page.locator('.laboratory-review').getAttribute('data-text-size'),'large');await page.getByLabel('Laboratory text size').selectOption('standard')
  await page.getByRole('button',{name:/^Show position 1,/}).click();await page.locator('.gallery-figure').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('.gallery-figure figcaption').textContent().then(t=>t.includes('02 / 12')))
  if(device==='mobile'){await page.locator('.gallery-figure').evaluate(figure=>{const first=new Touch({identifier:1,target:figure,clientX:300,clientY:200}),last=new Touch({identifier:1,target:figure,clientX:100,clientY:200});figure.dispatchEvent(new TouchEvent('touchstart',{touches:[first],bubbles:true}));figure.dispatchEvent(new TouchEvent('touchend',{changedTouches:[last],bubbles:true}))});assert(await page.locator('.gallery-figure figcaption').textContent().then(t=>t.includes('03 / 12')))}
  await page.screenshot({path:folder+'/'+device+'-laboratory.png',fullPage:true});await page.getByRole('button',{name:'Continue to Section 04',exact:true}).click();assert.equal(new URL(page.url()).hash,'#chapter/assets-claims');await page.goBack();await page.locator('.laboratory-interlude-page').waitFor();await nav.getByRole('button',{name:'Back to Console',exact:true}).click()
  stage=device+' hardware';await page.getByRole('button',{name:/^Financial schedules$/i}).click();await page.getByRole('tab',{name:/Business schedule/}).click();await page.locator('.hardware-options').waitFor();assert((await page.locator('.hardware-options').textContent()).includes('Turnkey AI Infrastructure'))
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download Server Upgrade Proposal',exact:true}).click();const downloaded=await pending;const bytes=await fs.readFile(await downloaded.path());assert.equal(createHash('sha256').update(bytes).digest('hex'),hardware.file.sha256)
  await page.screenshot({path:folder+'/'+device+'-hardware.png',fullPage:true})
  stage=device+' legal library';await page.getByRole('button',{name:'Documents',exact:true}).click();const group=page.getByRole('region',{name:'Legal & supporting records',exact:true});assert.equal(await group.locator('.document-hold-card').count(),4);assert.equal(await group.getByRole('button').count(),0)
  const hardwareCard=page.locator('[data-evidence-record="'+hardware.id+'"]');await hardwareCard.getByRole('button',{name:/Open document:/}).click();await page.locator('.react-pdf__Page__canvas').waitFor();await page.getByRole('button',{name:'Back to library',exact:true}).click()
  stage=device+' four clients';await page.getByRole('button',{name:'Portfolio',exact:true}).click();await page.getByRole('heading',{name:'JB³ Business Intelligence Reports',exact:true}).waitFor();await page.getByRole('tab',{name:/Client Engagements/}).click();const cards=page.locator('.portfolio-grid>.portfolio-card');assert.equal(await cards.count(),4);assert.deepEqual(await cards.locator('h3').allTextContents(),['SSG Mining / Security','SNG Grant Thornton','Kidnap Response Application PRD','Eagle Star Security']);assert.equal(await cards.locator('button').count(),4);assert.equal(await page.getByText('Sunday World',{exact:true}).count(),0)
  await page.screenshot({path:folder+'/'+device+'-clients.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[])
  await context.close();console.log(JSON.stringify({device,passed:true,chapters:11,laboratoryOriginals:12,legalEntries:4,clientCards:4,hardwareDownloadHash:true,blockedDownloads:5}))
 }
 console.log(JSON.stringify({passed:true,origin,restrictedSourceBytesPublished:false}))
}catch(e){if(activePage)await activePage.screenshot({path:folder+'/failure.png',fullPage:true}).catch(()=>{});console.log(JSON.stringify({passed:false,stage,error:e.message.split('\n').slice(0,4).join(' ')}));process.exitCode=1}finally{await browser.close()}
