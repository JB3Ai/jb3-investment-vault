// Run with node --experimental-transform-types scripts/check-release-privacy.mjs
// Local release audit only. No uploads, database writes or credential output.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {loadLocalReview} from '../server/localReview.ts'
const git=args=>execFileSync('git',['--no-optional-locks',...args],{stdio:['pipe','pipe','pipe'],maxBuffer:512*1024*1024})
const role=value=>{try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url')).role}catch{return null}}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
try{
 const root=process.env.JB3_PRIVATE_CONTENT_ROOT;if(!root)throw Error('External private-content root required')
 const {data,records}=await loadLocalReview(root),all=[...records.values()]
 const privateHashes=new Set(all.filter(r=>r.file).map(r=>r.file.sha256))
 const privateText=[...new Set(all.flatMap(r=>[r.id,...(r.kind==='narrative'?String(r.payload.body).split(/\n\s*\n/).filter(s=>s.length>=100):[])]).flatMap(s=>[s,JSON.stringify(s).slice(1,-1)]))]
 privateText.push(...(data.assets?.ownerEstimates?.briefing.paragraphs??[]).flatMap(s=>[s,JSON.stringify(s).slice(1,-1)]))
 const secrets=[...new Set(Object.entries(process.env).filter(([name,value])=>value&&!/^VITE_/.test(name)&&/(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE)/i.test(name)).map(([,value])=>value))]
 // Compare the current native Cloudflare credential in memory as well as signatures.
 try{const raw=execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','auth','token','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,windowsHide:true});const a=JSON.parse(raw.slice(raw.indexOf('{')));if(a.token)secrets.push(a.token);else if(a.key)secrets.push(a.key)}catch{}
 const findings=[];let blobs=0,worktreeFiles=0,artifactFiles=0
 function inspect(bytes,location,frontend=false){
  const text=bytes.toString('utf8')
  if(privateHashes.has(digest(bytes))||privateText.some(value=>text.includes(value)))findings.push({location,kind:'private-content'})
  const tokens=text.match(/sb_secret_[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)??[]
  if(secrets.some(value=>bytes.includes(Buffer.from(value)))||tokens.some(value=>role(value)==='service_role'||(/^(sb_secret_|sbp_|gh[pousr]_|github_pat_)/.test(value)&&!/^sb_secret_(synthetic|fixture|test)|^sbp_(synthetic|fixture|test)/.test(value)))||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({location,kind:'credential'})
  if(frontend&&/JB3_(PRIVATE_CONTENT|APPROVED_MASTER|MASTER_INTAKE|SUPPORTING_EVIDENCE_REVIEW|FUNDING_PROPOSAL|ASSET_REVIEW|COMMERCIAL_REVIEW)_V1|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|JB3_LOCAL_PRESENTATION_PIN|local-review\/financial-export|artifact-tool/.test(text))findings.push({location,kind:'frontend-boundary'})
 }
 const names=git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean)
 const tracked=git(['ls-files','-z']).toString().split('\0').filter(Boolean)
 for(const file of tracked)if(/\.(pdf|xlsx?|xlsm|xlsb|ods|jpe?g)$/i.test(file)||/(^|\/)(?:\.env(?:\..*)?|private-content|master-intake\.json|manifest\.json)(?:$|\/)/.test(file)&&file!=='.env.example'||/(^|\/)docs\/(?:audit|GTR3|house|kidscustody|kula|resume)\.png$/i.test(file))findings.push({location:file,kind:'tracked-private-path'})
 for(const file of names){if(fs.lstatSync(file).isSymbolicLink())throw Error('Symlink in candidate');if(fs.statSync(file).isFile()){inspect(fs.readFileSync(file),file);worktreeFiles++}}
 const objects=git(['cat-file','--batch-all-objects','--batch']);let offset=0
 while(offset<objects.length){const newline=objects.indexOf(10,offset),header=objects.subarray(offset,newline).toString().split(' '),size=Number(header[2]),start=newline+1,end=start+size;if(newline<0||!Number.isSafeInteger(size)||end>=objects.length)throw Error('Incomplete Git object audit');if(header[1]==='blob'){blobs++;inspect(objects.subarray(start,end),'git-object:'+header[0])}offset=end+1}
 const publicTokens=[...data.documents.map(r=>r.provenance.originalFilename),...(data.thumbnailPreviews??[]).flatMap(r=>[r.sha256,r.originalFilename]),...(data.evidenceReviews??[]).flatMap(r=>[r.summary,...r.assertions,...r.verificationHolds])].filter(s=>s&&s.length>8)
 function walk(dir,frontend){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in release artifacts');if(entry.isDirectory())walk(file,frontend);else{const bytes=fs.readFileSync(file);artifactFiles++;inspect(bytes,file,frontend);if(frontend&&(publicTokens.some(value=>bytes.includes(Buffer.from(value)))||/\.(pdf|xlsx?|xlsm|jpe?g|zip|docx?)$/i.test(file)))findings.push({location:file,kind:'private-public-asset'})}}}
 walk('dist',true);walk('public',true);walk(process.argv[2]??'tmp/manual-deploy-worker',false)
 const passed=findings.length===0
 console.log(JSON.stringify({check:'release-privacy',passed,worktreeFiles,gitBlobs:blobs,artifactFiles,privateRecords:all.length,credentialComparisons:secrets.length,findings}))
 if(!passed)process.exitCode=1
}catch{console.log(JSON.stringify({check:'release-privacy',passed:false,error:'scan-incomplete; no private values printed'}));process.exitCode=1}
