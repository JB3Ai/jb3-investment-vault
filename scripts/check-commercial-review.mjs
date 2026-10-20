import {enterPrivate} from './private-preview-browser.mjs'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
const origin='http://127.0.0.1:5174',headers={'X-Vault-Local-Review':'1'}
const response=await fetch(origin+'/api/vault/local-review/content',{headers});assert.equal(response.status,200);const data=await response.json()
const folder=path.join(tmpdir(),'JB3Vault-commercial');await mkdir(folder,{recursive:true})
await writeFile(path.join(folder,'review-data.private.json'),JSON.stringify(data))
let passed=0,stage='startup';function check(value,label){assert.ok(value,label);passed++}
const browser=await chromium.launch({headless:true})
try{
 for(const[name,width,height]of[['desktop',1536,1024],['tablet',834,1112],['mobile',390,844]]){
  stage=name+' commercial summary';const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:name==='mobile',isMobile:name==='mobile',acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(60000)
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.name));page.on('request',request=>requests.push(request.url()))
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'||['blob:','data:'].includes(url.protocol)?route.continue():route.abort()})
  await page.goto(origin);await enterPrivate(page);await page.getByRole('button',{name:'Open Commercial Pipeline',exact:true}).click()
  const register=page.getByRole('region',{name:'Commercial Capability & Opportunity Register'})
  await register.waitFor();check(await register.locator('[data-commercial-record]').count()===5,'Five corrected commercial entries')
  check(!/Sunday[\s_-]*World/i.test(await register.textContent()),'No excluded opportunity in commercial summary')
  check((await register.locator('.commercial-basis strong').textContent()).replace(/\s/g,'')==='R0','Conservative uncontracted forecast contribution')
  check(await register.locator('.commercial-revenue').count()===5,'Every opportunity explicitly contributes zero forecast revenue')
  const originalNarrative=await page.locator('.narrative').innerHTML(),evidence=await page.locator('.evidence-aside').innerHTML()
  for(const entry of data.commercial.entries){const card=register.locator('[data-commercial-record="'+entry.recordId+'"]');check((await card.textContent()).includes(entry.positioning),'Owner-confirmed positioning is preserved');check((await card.locator('.commercial-category').textContent()).trim().length>0,'Commercial category present');await card.locator('summary').click();check((await card.textContent()).includes(entry.limitations[0]),'Verification limits remain visible on expansion')}
  check((await register.locator('.commercial-ip').textContent()).includes(data.commercial.entries.find(entry=>entry.thirdPartyIp).ownershipNote),'Third-party IP separated from JB3 assets')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No commercial register horizontal overflow')
  await register.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,name+'-commercial.png')})
  const linked=data.commercial.entries.find(entry=>entry.sourceDocuments.length).sourceDocuments[0]
  const entry=register.locator('[data-commercial-record="'+data.commercial.entries.find(entry=>entry.sourceDocuments.length).recordId+'"]')
  await entry.locator('.commercial-document-links button').first().click()
  const card=page.locator('[data-brochure-record="'+linked.recordId+'"]');await card.waitFor();check(await card.getAttribute('data-selected')==='true','Supporting brochure card targeted');check(await card.evaluate(element=>document.activeElement===element),'Brochure card receives keyboard focus')
  check((await card.locator('.portfolio-association').textContent()).includes('SNG'),'Corrected source association visible in Brochures')
  check(!/Sunday[\s_-]*World/i.test(await page.locator('.brochures-library').textContent()),'Brochures exclude Sunday World')
  check(await card.getByRole('button',{name:/^View document:/}).count()===1,'Existing local owner preview remains available')
  await page.screenshot({path:path.join(folder,name+'-brochure-association.png')})
  await page.getByRole('button',{name:'Back to Console',exact:true}).click();await page.getByRole('button',{name:'Open Commercial Pipeline',exact:true}).click()
  check(await page.locator('.narrative').innerHTML()===originalNarrative,'Approved Section 07 rendering unchanged')
  check(await page.locator('.evidence-aside').innerHTML()===evidence,'Evidence/provenance unchanged')
  check(requests.every(url=>!/storage\/v1|\/docs\/.*\.pdf/i.test(url)),'No direct Storage or public source links')
  check(errors.length===0,'No browser runtime errors');await context.close();console.log(name+' commercial checks passed')
 }
 stage='Master PDF generation'
 const pdf=await fetch(origin+'/api/vault/local-review/master-pdf',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({scope:'combined',zarPerGbp:25}),signal:AbortSignal.timeout(180000)})
 check(pdf.status===200,'Master PDF generated');check(pdf.headers.get('cache-control').includes('no-store'),'PDF private response is not cacheable')
 const bytes=Buffer.from(await pdf.arrayBuffer());check(bytes.subarray(0,5).toString()==='%PDF-','Master export is a PDF');await writeFile(path.join(folder,'master-commercial-review.pdf'),bytes)
 console.log(JSON.stringify({passed,viewports:3,privateArtifacts:folder,pdfBytes:bytes.length}))
}catch(error){console.error('Commercial check failed at '+stage+': '+error.message);process.exitCode=1}finally{await browser.close()}
