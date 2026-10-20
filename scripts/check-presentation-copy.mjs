// Private browser QA. Source copy is kept in process memory; output contains counts only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {chromium} from 'playwright'
import {presentationText,presentationView,textQualityIssues} from '../src/lib/presentationCopy.ts'
import {enterPrivate} from './private-preview-browser.mjs'
const origin='http://127.0.0.1:5174',headers={'X-Vault-Local-Review':'1','Content-Type':'application/json'}
const response=await fetch(origin+'/api/vault/local-review/content',{headers});assert.equal(response.status,200);const raw=await response.json(),view=presentationView(raw)
const folder=path.join(os.tmpdir(),'JB3Vault-typography');fs.mkdirSync(folder,{recursive:true})
const verbatim=new Set()
function originals(value,key=''){if(typeof value==='string'){if(['originalFilename','filename','citation','sourceReference','reconciliationNote'].includes(key))verbatim.add(value);return}if(Array.isArray(value)){if(['assertions','independentlyVerifiedFacts'].includes(key))for(const item of value)verbatim.add(item);else for(const item of value)originals(item,key);return}if(value&&typeof value==='object')for(const [name,item]of Object.entries(value)){if(name==='metadata'){for(const [k,v]of Object.entries(item))if(v&&!/^(portfolio|brochure)\./.test(k))verbatim.add(String(v))}else originals(item,name)}}originals(raw)
const clean=text=>{for(const value of verbatim)if(value.length>3)text=text.replaceAll(value,'');return text}
const words=text=>text.match(/[\p{L}\p{N}]+/gu)??[]
for(let index=0;index<11;index++)assert.deepEqual(words(view.sections[index].narrative.payload.body),words(raw.sections[index].narrative.payload.body),'Only approved punctuation changed; no narrative words may change')
let checks=11,stage='start';const browser=await chromium.launch({headless:true})
try{for(const[name,width,height]of[['desktop',1440,960],['mobile',390,844]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:width<600,hasTouch:width<600}),page=await context.newPage();page.setDefaultTimeout(90000)
 async function audit(label){stage=name+' '+label;const texts=await page.evaluate(()=>{const out=[document.title];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement?.closest('script,style,code,pre,.react-pdf__Page,[data-copy-verbatim]'))out.push(node.textContent??'')}for(const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))for(const attr of ['aria-label','title','placeholder','alt'])if(el.hasAttribute(attr))out.push(el.getAttribute(attr));return out});const count=texts.reduce((sum,text)=>sum+textQualityIssues(clean(text),{verbatimQuotes:true}).length,0);assert.equal(count,0,'Visible copy issue at '+stage+'; private text omitted');checks++}
 await page.goto(origin);await audit('landing');await page.getByRole('button',{name:'Enter vault',exact:true}).click();await page.getByRole('dialog').waitFor();await audit('PIN');await page.getByLabel('Presentation PIN',{exact:true}).fill(process.env.JB3_LOCAL_PRESENTATION_PIN??'2323');await page.getByRole('dialog').getByRole('button',{name:'Enter',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).waitFor();await audit('console')
 await page.getByRole('button',{name:'Open Introduction',exact:true}).click();for(let index=0;index<11;index++){if(width>1359)await page.locator('.chapter-list button').nth(index).click();else await page.getByRole('combobox',{name:'Investment chapter'}).selectOption(raw.sections[index].id);await audit('chapter '+(index+1))}await page.getByRole('button',{name:'Back to Console',exact:true}).click()
 const tools=page.getByRole('navigation',{name:'Vault tools'});await tools.getByRole('button',{name:'Documents',exact:true}).click();await audit('evidence')
 await tools.getByRole('button',{name:'Portfolio',exact:true}).click();await page.getByRole('heading',{name:'Portfolio',exact:true}).waitFor();const carousel=page.getByRole('region',{name:'JB³ Showcase brochures'});for(let i=0;i<9;i++){await audit('showcase '+(i+1));await carousel.getByRole('button',{name:'Next Showcase brochure',exact:true}).click()}await page.getByRole('tab',{name:/Client Engagements/}).click();await audit('clients')
 await tools.getByRole('button',{name:'Financial schedules',exact:true}).click();for(const tab of ['Personal','Business']){await page.locator('#finance-tab-'+tab.toLowerCase()).click();await audit('finance '+tab)}for(const tab of ['Budget scenarios','Repayment scenarios']){await page.getByRole('tab',{name:tab,exact:true}).click();await audit(tab)}
 await tools.getByRole('button',{name:'Executive briefing',exact:true}).click();await audit('briefing');await page.emulateMedia({media:'print'});await audit('print');await page.emulateMedia({media:'screen'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;await page.screenshot({path:path.join(folder,name+'-briefing.png'),fullPage:true});await context.close();console.log(name+' visible-copy checks PASS')
 }
 stage='Master PDF';const pdf=await fetch(origin+'/api/vault/local-review/master-pdf',{method:'POST',headers,body:JSON.stringify({scope:'combined',zarPerGbp:25})});assert.equal(pdf.status,200);assert(pdf.headers.get('cache-control')?.includes('no-store'));const file=path.join(folder,'typography-master.pdf');fs.writeFileSync(file,Buffer.from(await pdf.arrayBuffer()));console.log(execFileSync('python',['scripts/check-master-pdf.py',file],{input:JSON.stringify({...view,reviewFx:25}),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'},windowsHide:true}).trim());checks++
 // Protect the canonical originals and populated manifests byte for byte.
 const root=path.join(os.homedir(),'AppData/Local/JB3Vault/private-content'),hashes=JSON.parse(fs.readFileSync('tmp/typography-source-hashes.json','utf8'));for(const [name,digest]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),digest);checks++
 console.log(JSON.stringify({typographyBrowserChecks:checks,narratives:11,originalsUnchanged:true,privateArtifacts:folder}))
}catch(error){console.error('Typography verification FAILED at '+stage+': '+error.name+'; private text omitted');process.exitCode=1}finally{await browser.close()}
