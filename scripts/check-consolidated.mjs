import {presentationView,textQualityIssues} from '../src/lib/presentationCopy.ts'
import {enterPrivate} from './private-preview-browser.mjs'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {workbookRuntime} from '../server/financialExport.ts'
// Workbook recalculation can block the test process past Node's idle socket
// lifetime. Fresh test connections avoid reusing a closed keep-alive socket.
const origin='http://127.0.0.1:5174',headers={'X-Vault-Local-Review':'1','Content-Type':'application/json',Connection:'close'}
const data=await(await fetch(origin+'/api/vault/local-review/content',{headers})).json()
const notes=row=>JSON.parse(row.payload.reconciliationNote)
const sum=rows=>rows.reduce((value,row)=>value+(row.payload.amountMinor??0),0)
const proposal=data.finances.funding
const essential=row=>!notes(row).optionalHardware&&(!proposal||proposal.rows.find(item=>item.recordId===row.id)?.treatment==='essential-business')
const baseline=proposal?proposal.household.minimumMonthlyMinor*proposal.household.periods.length+sum(data.finances.business.filter(essential)):sum([...data.finances.personal,...data.finances.business].filter(row=>!notes(row).optionalHardware))
const oneOff=data.finances.personal.reduce((value,row)=>value+Math.round(Number(notes(row).oneOffZar)*100),0)
const operating=sum(data.finances.business.filter(essential))
const format=minor=>(minor/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
let assertions=0,stage='initial'
const check=(condition,message)=>{assert.ok(condition,message);assertions++}
const folder=path.join(tmpdir(),'JB3Vault-consolidated');await mkdir(folder,{recursive:true})
const browser=await chromium.launch({headless:true})
try{
 for(const [name,viewport] of [['desktop',{width:1536,height:1024}],['tablet',{width:834,height:1112}],['mobile',{width:390,height:844}]].filter(([name])=>!process.env.JB3_CHECK_DEVICE||name===process.env.JB3_CHECK_DEVICE)){
  const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion:'reduce',acceptDownloads:true})
  const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(error.name))
  await context.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)||['blob:','data:'].includes(url.protocol)?route.continue():route.abort()})
  stage=name+' financial workspace';await page.goto(origin);await enterPrivate(page);await page.getByRole('navigation',{name:'Section index'}).waitFor()
  await page.getByRole('button',{name:'Financial schedules',exact:true}).click()
  check((await page.locator('.finance-card').first().textContent()).includes(format(baseline)),'Revised baseline from canonical source')
  check(await page.locator('#finance-panel-personal tbody tr').count()===17,'Original personal rows plus one therapy adjustment')
  check((await page.locator('.financial-ledger-table thead th').allTextContents()).join('|')==='Expenditure|One-off ZAR|Monthly ZAR|Five-month ZAR|GBP|Verification','Accounting column order')
  check((await page.locator('#finance-panel-personal tbody tr').first().locator('td').first().textContent()).includes('Awaiting reconciliation'),'One-off priority items precede household detail without fabricated amounts')
  check(await page.locator('.household-months tbody tr').count()===5,'Five owner-specified household months')
  check((await page.locator('.household-months tfoot').textContent()).includes(format(proposal.household.minimumMonthlyMinor*5)),'Household amount counted once')
  check(await page.locator('.confirmation-list>details').count()===29,'All revised rows have practical confirmation actions')
  const missing=data.finances.personal.find(row=>row.payload.amountMinor===null)
  const confirmation=page.locator('.confirmation-list>details').filter({has:page.locator('summary',{hasText:missing.payload.label})}).first()
  await confirmation.locator('summary').first().click();check((await confirmation.textContent()).includes('Excluded from current baseline'),'Unknown amount excluded explicitly');check((await confirmation.textContent()).includes('Next action:'),'Confirmation action available')
  await page.getByRole('spinbutton',{name:'ZAR per GBP'}).fill('25')
  stage=name+' budget scenarios';await page.getByRole('tab',{name:'Budget scenarios',exact:true}).click()
  check((await page.getByRole('region',{name:'Minimum and sustainable budget scenarios'}).textContent()).includes('Owner input required'),'No invented salary')
  await page.getByRole('combobox',{name:'Sustainable budget basis'}).selectOption('salary')
  await page.getByRole('spinbutton',{name:'Monthly salary / consulting allowance'}).fill('20000')
  check((await page.locator('.scenario-comparison').textContent()).includes(format(2000000*5+oneOff+operating)),'Sustainable allowance replaces monthly minimum')
  check((await page.locator('.finance-card').first().textContent()).includes(format(baseline)),'Sustainable edits do not overwrite baseline')
  await page.screenshot({path:path.join(folder,name+'-budget.png'),fullPage:true})
  stage=name+' repayment scenarios';await page.getByRole('tab',{name:'Repayment scenarios',exact:true}).click()
  const calculator=page.getByRole('region',{name:'Illustrative repayment calculator'})
  await calculator.getByRole('spinbutton',{name:'Illustrative principal ZAR'}).fill('12000');await calculator.getByRole('spinbutton',{name:'Illustrative annual interest percent'}).fill('12');await calculator.getByRole('spinbutton',{name:'Illustrative repayment months'}).fill('12')
  await calculator.getByRole('spinbutton',{name:'Grace period months'}).fill('2');await calculator.getByRole('spinbutton',{name:'Monthly repayment amount ZAR'}).fill('50')
  check((await calculator.getByRole('status').textContent()).includes('Repayment shortfall'),'Repayment shortfall disclosed')
  await calculator.getByRole('tab',{name:'Actual available cash flow'}).click()
  check((await calculator.textContent()).includes('Enter illustrative terms'),'Cash-flow route requires actual inputs')
  await calculator.getByRole('spinbutton',{name:'Realised monthly income ZAR'}).fill('2000');await calculator.getByRole('spinbutton',{name:'Available monthly cash ZAR'}).fill('500')
  check((await calculator.locator('[data-repayment="Monthly repayment"]').textContent()).includes('£2.00'),'Cash-flow route uses entered payment and selected FX')
  await calculator.getByRole('combobox',{name:'Repayment income route'}).selectOption('beobacht')
  check((await calculator.textContent()).includes('Enter illustrative terms'),'Beobacht route does not assume a corporate agreement')
  await calculator.getByRole('checkbox').check();check((await calculator.textContent()).includes('does not automatically become a Beobacht corporate liability'),'Personal and corporate liability remain distinct')
  await page.getByRole('button',{name:'Back to Console',exact:true}).click()
  stage=name+' office supplement';await page.getByRole('navigation',{name:'Section index'}).locator('.index-open').nth(7).click()
  check(await page.locator('.office-grid article').count()===3,'Three supplementary office options')
  await page.getByRole('button',{name:'Back to Console',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).locator('.index-open').nth(3).click()
  stage=name+' asset register';const assets=page.getByRole('region',{name:'Assets and potential recoveries',exact:true});check(await assets.locator('article').count()===5,'Five qualified asset review entries');check(await assets.locator('.asset-restricted').count()===2,'Restricted legal entries identified');check((await assets.textContent()).includes('No verified amount supplied'),'Unknown availability is not presented as zero cash');check(await assets.getByRole('button').count()===0,'Asset registration grants no document access');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Asset register fits viewport')
  await page.screenshot({path:path.join(folder,name+'-assets.png'),fullPage:true})
  await page.getByRole('button',{name:'Back to Console',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).locator('.index-open').nth(2).click()
  stage=name+' laboratory controls';const lab=page.getByRole('region',{name:'23-day laboratory interlude'});await lab.locator('.gallery-figure img').waitFor()
  await lab.getByRole('combobox',{name:'Laboratory text size'}).selectOption('large')
  check(await page.evaluate(()=>localStorage.getItem('jb3-lab-text-size'))==='large','Only the text-size preference persists')
  stage=name+' gallery keyboard';const viewer=lab.getByLabel('Laboratory image viewer');await viewer.focus();await viewer.press('ArrowRight')
  check((await lab.locator('.gallery-figure figcaption .mono').textContent())==='02 / 12','Keyboard picture selector and padded index')
  stage=name+' gallery swipe';if(name==='mobile'){
   await viewer.scrollIntoViewIfNeeded();const box=await viewer.boundingBox(),y=Math.max(40,Math.min(viewport.height-80,box.y+box.height/2)),cdp=await context.newCDPSession(page)
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.75,y}]})
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.25,y}]})
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach()
   await page.waitForFunction(()=>document.querySelector('.gallery-figure figcaption .mono')?.textContent==='03 / 12')
   check((await lab.locator('.gallery-figure figcaption .mono').textContent())==='03 / 12','Touch swipe picture selector')
  }
  stage=name+' gallery touch target'
  check(await lab.getByRole('button',{name:'Next image',exact:true}).evaluate(button=>button.getBoundingClientRect().height>=44),'Tactile image controls are touch-sized')
  stage=name+' gallery provenance';await lab.getByText('Original photograph provenance',{exact:true}).click();check((await lab.locator('.gallery-provenance').textContent()).includes('SHA-256'),'Original provenance retained')
  await page.screenshot({path:path.join(folder,name+'-laboratory.png'),fullPage:true})
  await page.getByRole('button',{name:'Executive briefing',exact:true}).click()
  stage=name+' executive briefing';check(await page.locator('.briefing-section').count()===11,'All approved narratives in briefing')
  const font=await page.locator('.briefing-section>p').first().evaluate(p=>({size:parseFloat(getComputedStyle(p).fontSize),line:parseFloat(getComputedStyle(p).lineHeight)}))
  check(font.size>=16&&font.line/font.size>=1.6,'Briefing readable typography')
  check(!(await page.locator('.executive-briefing').textContent()).includes('###'),'No Markdown heading markers visible')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No desktop/mobile page overflow')
  await page.evaluate(()=>{window.print=()=>{window.__printCalled=true}});await page.getByRole('button',{name:'Print executive briefing',exact:true}).click();check(await page.evaluate(()=>window.__printCalled===true),'Print action remains independent')
  if(name==='desktop'){
   stage='private master PDF download';const downloadPromise=page.waitForEvent('download',{timeout:180000});downloadPromise.catch(()=>{})
   await page.getByRole('button',{name:'Download Master PDF',exact:true}).click();const download=await downloadPromise
   check(download.suggestedFilename()==='JB3-private-master.pdf','Separate protected Master PDF download')
   const file=path.join(folder,'master-final-review.pdf');await download.saveAs(file);await download.delete()
   console.log(execFileSync('python',['scripts/check-master-pdf.py',file],{input:JSON.stringify(presentationView({...data,reviewFx:25})),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'},windowsHide:true}).trim())
   await page.emulateMedia({media:'print'});check(await page.locator('.reader-toolbar').evaluate(el=>getComputedStyle(el).display)==='none','Print hides navigation controls');await page.emulateMedia({media:'screen'})
  }
  await page.screenshot({path:path.join(folder,name+'-briefing.png'),fullPage:true});check(errors.length===0,'No browser errors');await context.close();console.log(name+': revised finance, scenarios, repayments, offices, gallery and briefing PASS')
 }
 stage='scenario workbook reconciliation';const {FileBlob,SpreadsheetFile}=await workbookRuntime()
 const scenario={basis:'salary',food:null,health:null,transport:null,other:null,salary:20000}
 for(const scope of ['combined','personal','business']){
  stage=scope+' scenario export request';console.log('Workbook '+scope+': authorised request')
  const response=await fetch(origin+'/api/vault/local-review/financial-export',{method:'POST',headers,body:JSON.stringify({scope,zarPerGbp:25,scenario})})
  check(response.ok&&response.headers.get('cache-control').includes('no-store'),'Private scenario workbook response')
  stage=scope+' scenario workbook import'
  const file=path.join(folder,'scenario-'+scope+'.xlsx');await writeFile(file,Buffer.from(await response.arrayBuffer()));const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(file));workbook.recalculate()
  stage=scope+' scenario formula reconciliation'
  check(Math.abs(workbook.worksheets.getItem('Budget scenarios').getRange('B12').values[0][0]*100-(scope==='business'?operating:2000000*5+oneOff+(scope==='combined'?operating:0)))<.01,'Scenario workbook formula reconciles and respects scope')
  if(scope==='business')check(workbook.worksheets.getItem('Budget scenarios').getRange('B5:B9').values.every(row=>row[0]===null||row[0]===''),'Business export does not include private personal scenario inputs')
  const expectedCore=(scope==='business'?0:proposal.household.minimumMonthlyMinor*proposal.household.periods.length)+(scope==='personal'?0:operating),expectedKnown=expectedCore+(scope==='business'?0:oneOff),summary=workbook.worksheets.getItem('Summary');check(Math.abs(summary.getRange('B10').values[0][0]*100-expectedCore)<.01,'Workbook core excludes source household double-counting and conditional business');check(Math.abs(summary.getRange('B12').values[0][0]*100-expectedKnown)<.01,'Workbook indicative total excludes optional hardware and unresolved amounts');workbook.worksheets.getItem('Assumptions').getRange('B2').values=[[30]];workbook.recalculate();check(Math.abs(summary.getRange('C10').values[0][0]-Math.round(expectedCore/30)/100)<.001,'Workbook FX remains editable and formula-linked');workbook.worksheets.getItem('Assumptions').getRange('B2').values=[[25]];workbook.recalculate()
  const other=scope==='business'?data.finances.personal:scope==='personal'?data.finances.business:[];const exportedIds=workbook.worksheets.getItem('Source notes').getRange('A3:A'+(2+(scope==='combined'?29:data.finances[scope].length))).values.flat();check(!other.some(row=>exportedIds.includes(row.id)),'Schedule-only export excludes other schedule records')
  for(const sheetName of ['Summary','Assumptions','Budget scenarios',...(scope==='combined'?['Personal','Business']:[scope==='personal'?'Personal':'Business'])])for(const row of workbook.worksheets.getItem(sheetName).getUsedRange().values)for(const cell of row)if(typeof cell==='string')check(textQualityIssues(cell,{verbatimQuotes:true}).length===0,'Generated workbook presentation copy; raw Source notes remain verbatim');
  console.log('Workbook '+scope+': formulas, scope and editable FX PASS');
  if(scope==='combined'){for(const [sheetName,range] of [['Summary','A2:D17'],['Budget scenarios','A18:D27'],['Assumptions','A24:B34'],['Personal','A4:I10'],['Business','A4:I10']]){console.log('Workbook render: '+sheetName);const preview=await workbook.render({sheetName,range,scale:1,format:'png'});await writeFile(path.join(folder,'workbook-'+sheetName.toLowerCase().replaceAll(' ','-')+'.png'),new Uint8Array(await preview.arrayBuffer()))}}

 }
 for(const config of [{method:'GET',headers},{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'}]){const response=await fetch(origin+'/api/vault/local-review/master-pdf',config);check([403,405].includes(response.status),'Unauthorised Master PDF denied');check(response.headers.get('cache-control').includes('no-store'),'Denied PDF never cached')}
 console.log(`Consolidated checks PASS (${assertions} assertions); all private QA files are in OS temporary storage.`)
}catch(error){console.error(`Consolidated check FAILED at ${stage}: ${error instanceof assert.AssertionError?error.message:error.name}; code=${error.cause?.code??'none'}; ${error.stack?.split('\n').find(line=>line.includes('check-consolidated.mjs'))??''}; private payload omitted`);process.exitCode=1}finally{await browser.close()}
