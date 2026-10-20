import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Synthetic shell only; no investor content, external Auth or privileged bindings.
const origin='http://127.0.0.1:5185',folder=path.join(tmpdir(),'JB3Vault-boot-review')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5185','--strictPort'],{env:{...process.env,VITE_VAULT_MODE:'demo',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SECRET_KEY:''},windowsHide:true,stdio:'ignore'})
let browser
try{
 await mkdir(folder,{recursive:true})
 let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Isolated boot server unavailable');try{ready=(await fetch(origin)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,500))}assert(ready)
 browser=await chromium.launch()
 for(const[name,width,height]of[['desktop',1440,960],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(30000)
  await page.addInitScript(()=>{
   window.bootRuns=[];let running=false,trigger=0
   new MutationObserver(()=>{
    if(document.querySelector('.vault-landing--init')&&!running)trigger=performance.now()
    const shell=document.querySelector('.landing-boot');if(!shell||running)return
    const run={trigger,started:performance.now(),frames:[],finished:0};window.bootRuns.push(run);running=true
    const sample=()=>{
     if(!shell.isConnected){run.finished=performance.now();running=false;return}
     const faces=[...shell.querySelectorAll('.knob-face')]
     if(!run.effects)run.effects=faces.map(face=>{const a=face.getAnimations().find(a=>a.animationName==='landing-calibration');return {timing:a.effect.getTiming(),keyframes:a.effect.getKeyframes().map(k=>({offset:k.offset,transform:k.transform}))}})
     const angles=faces.map(face=>{const pointer=face.querySelector('.knob-pointer'),matrix=new DOMMatrix(getComputedStyle(face).transform).multiply(new DOMMatrix(getComputedStyle(pointer).transform));return Math.atan2(matrix.b,matrix.a)*180/Math.PI})
     run.frames.push({t:performance.now()-run.started,angles,oled:Number(getComputedStyle(shell.querySelector('.oled-content')).opacity)})
     requestAnimationFrame(sample)
    };sample()
   }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})
  })
  await page.goto(origin);await page.getByRole('button',{name:'Enter vault',exact:true}).click()
  await page.waitForFunction(()=>window.bootRuns.at(-1)?.frames.at(-1)?.angles.every(angle=>angle>80.9))
  const visible=await page.locator('.landing-boot .knob').evaluateAll(knobs=>knobs.every(knob=>{const r=knob.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.left>=0&&r.right<=innerWidth}))
  assert(visible,'Both calibration knobs remain in view')
  await page.screenshot({path:path.join(folder,name+'-peak.png')})
  await page.getByRole('navigation',{name:'Section index'}).waitFor()
  await page.waitForFunction(()=>window.bootRuns.at(-1)?.finished>0)
  const run=await page.evaluate(()=>window.bootRuns.at(-1)),duration=(run.finished-run.trigger)/1000
  await writeFile(path.join(folder,name+'-samples.json'),JSON.stringify(run))
  assert(duration>=10.6&&duration<=12,'Triggered boot duration')
  const peaks=[],holds=[]
  for(let knob=0;knob<2;knob++){
   const angles=run.frames.map(frame=>frame.angles[knob]),max=Math.max(...angles),peakFrames=run.frames.filter(frame=>frame.angles[knob]>80.99)
   assert(Math.abs(angles[0]+135)<.1,'Original resting angle')
   assert(Math.abs(max-81)<.1,'80 percent of available dial travel')
   assert(Math.abs(angles.at(-1)+135)<.01,'Exact return to original orientation')
   const hold=(peakFrames.at(-1).t-peakFrames[0].t)/1000;assert(peakFrames.length>=2&&hold>=.2,'Visible peak hold sampled across multiple frames')
   const effect=run.effects[knob],duration=effect.timing.duration,keys=effect.keyframes
   assert.equal(effect.timing.delay,knob===0?300:600)
   assert(Math.abs(keys[1].offset*duration-3000)<.01,'Rendered three second ascent')
   assert(Math.abs((keys[2].offset-keys[1].offset)*duration-500)<.01,'Rendered half-second peak hold')
   assert(Math.abs((keys[3].offset-keys[2].offset)*duration-3000)<.01,'Rendered three second return')
   for(let index=1;index<run.frames.length;index++){const a=run.frames[index-1],b=run.frames[index],delta=Math.abs(b.angles[knob]-a.angles[knob]);assert(delta<.15*(b.t-a.t+32)+.5,'No angular snap (allow compositor/main-thread frame skew)')}
   peaks.push(peakFrames[0].t);holds.push(Number(hold.toFixed(2)))
  }
  assert.equal(run.effects[1].timing.delay-run.effects[0].timing.delay,300,'Rendered staggered calibration')
  assert(run.frames.find(frame=>frame.t>6500&&frame.angles.every(angle=>Math.abs(angle+135)<.01)).oled>.995,'OLED fully ready with final return')
  const faces=page.locator('.console-page .knob-face');assert(await faces.evaluateAll(items=>items.every(item=>getComputedStyle(item).animationName==='none')),'Normal controls have no boot animation')
  const dial=page.getByRole('slider',{name:'Context section'});await dial.focus();await dial.press('ArrowRight');assert.equal(await dial.getAttribute('aria-valuenow'),'2')
  await page.getByRole('button',{name:'Replay introduction',exact:true}).click();await page.getByRole('button',{name:'Enter vault',exact:true}).click();await page.locator('.landing-boot').waitFor();await page.waitForFunction(()=>window.bootRuns.at(-1)?.frames.at(-1)?.t>1100)
  await page.getByRole('button',{name:'Skip intro',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).waitFor({timeout:1000});assert.equal(await page.locator('.landing-boot').count(),0)
  const normalAngles=()=>page.locator('.console-page .knob-pointer').evaluateAll(items=>items.map(item=>getComputedStyle(item).transform));const settled=await normalAngles();await page.waitForTimeout(900);assert.deepEqual(await normalAngles(),settled,'Skip leaves no residual rotation')
  await page.getByRole('button',{name:'Replay introduction',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Enter vault',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).waitFor({timeout:1000});assert.equal(await page.locator('.landing-boot').count(),0)
  console.log(JSON.stringify({device:name,durationSeconds:Number(duration.toFixed(2)),peakDegrees:81,travelPercent:80,holdSeconds:.5,sampledHoldSeconds:holds,staggerMs:300,restoredDegrees:-135,skipCleanup:true,reducedMotion:true,normalKeyboardControl:true}))
  await context.close()
 }
 console.log('Boot calibration PASS; screenshots in OS Temp/JB3Vault-boot-review')
}finally{await browser?.close();server.kill()}
