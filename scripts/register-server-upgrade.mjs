// Register an owner-supplied PDF in the established external intake. Never writes originals.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {parseManifest} from '../content-migration/ingestion-schema.ts'
import {parseMasterIntake} from '../content-migration/master-content.ts'
import {validateLocal,privateRoot} from '../content-migration/local-importer.ts'
import {supportingEvidenceReview} from '../server/supportingEvidence.ts'
const root=await privateRoot(process.env.JB3_PRIVATE_CONTENT_ROOT??''),source=process.argv[2]
if(!source||path.basename(source)!=='07_server_upgrade.pdf')throw Error('Expected owner-supplied server upgrade PDF')
const input=await fs.readFile(source),sha256=createHash('sha256').update(input).digest('hex')
if(input.subarray(0,5).toString()!=='%PDF-')throw Error('PDF signature required')
const manifestPath=path.join(root,'manifest.json'),intakePath=path.join(root,'master-intake.json'),reviewPath=path.join(root,'supporting-evidence-review.json')
const originals=await Promise.all([manifestPath,intakePath,reviewPath].map(p=>fs.readFile(p,'utf8')))
const [manifest,intake,review]=originals.map(s=>JSON.parse(s.replace(/^\uFEFF/,'')))
if(JSON.stringify(manifest)!==JSON.stringify(intake.content))throw Error('Existing manifests disagree')
let record=manifest.sections.flatMap(s=>s.records).find(r=>r.provenance.originalFilename===path.basename(source))
if(record&&record.file.sha256!==sha256)throw Error('Existing source differs; version review required')
const relativePath='sources/financial-requirements/07_server_upgrade.pdf',destination=path.join(root,relativePath)
await fs.mkdir(path.dirname(destination),{recursive:true})
try{const previous=await fs.readFile(destination);if(!previous.equals(input))throw Error('Private copy differs')}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(destination,input,{flag:'wx'})}
if(createHash('sha256').update(await fs.readFile(destination)).digest('hex')!==sha256)throw Error('Copy integrity failed')
if(!record){record={id:randomUUID(),kind:'pdf',classification:'BRUCE_PRIVATE',verification:'awaiting-verification',approval:'draft',provenance:{originalFilename:path.basename(source),sourceDate:'2026-09-22',citation:'Server upgrade proposal, pp. 1-4; prices stated as checked 21 September 2026.',sourceReference:'sha256:'+sha256,reviewedBy:null,reviewedOn:null,conflictNote:'Dated proposal options differ from existing schedule stage estimates. Neither replaces the other; current quotes and compatibility require confirmation.'},payload:{title:'Server Upgrade Proposal'},file:{relativePath,sha256,mimeType:'application/pdf'}};manifest.sections.find(s=>s.id==='financial-requirements').records.push(record)}
if(!review.records.some(r=>r.recordId===record.id))review.records.push({recordId:record.id,sourcePath:source,sha256,sectionIds:['financial-requirements','financial-forecast'],pageCount:4,metadata:{'documents.category':'hardware-investment','portfolio.collection':'evidence-only','brochure.association':'JB³ local AI infrastructure','brochure.type':'Optional capital investment proposal'},summary:'A dated four-page proposal sets out three alternative server-upgrade routes, retaining the existing workstation. Prices and stock are historical planning information, not current quotations or approved obligations.',assertions:['The proposal compares used-GPU, expanded-capacity and turnkey routes. Capability, supplier availability and compatibility are document assertions.'],independentlyVerifiedFacts:['The registered source is a four-page PDF and the external copy matches the original SHA-256 checksum. This does not independently verify supplier pricing or capability.'],verificationHolds:['Obtain current written quotes, confirm compatible ECC Registered RAM, test used GPUs and reconcile the dated proposal against retained schedule estimates before funding.'],downloadAllowed:false,reviewStatus:'DRAFT / OWNER REVIEW REQUIRED'})
review.ownerLocalPreview??=[]
if(!review.ownerLocalPreview.some(r=>r.recordId===record.id))review.ownerLocalPreview.push({recordId:record.id,sha256,scope:'loopback-owner-review-only',requestedBy:'Jonathan Blackburn',recordedOn:'2026-10-21'})
intake.content=manifest;parseManifest(manifest);parseMasterIntake(intake);supportingEvidenceReview(review,manifest)
const backup=path.join(root,'review-backups','server-upgrade-'+Date.now());await fs.mkdir(backup,{recursive:true})
for(const [i,p]of [manifestPath,intakePath,reviewPath].entries())await fs.writeFile(path.join(backup,path.basename(p)),originals[i],{flag:'wx'})
try{for(const [p,value]of [[manifestPath,manifest],[intakePath,intake],[reviewPath,review]])await fs.writeFile(p,JSON.stringify(value,null,2)+'\n');await validateLocal(root,'master-intake.json')}catch(e){for(const [i,p]of [manifestPath,intakePath,reviewPath].entries())await fs.writeFile(p,originals[i]);throw e}
await fs.writeFile(path.join(backup,'registration.private.json'),JSON.stringify({source,relativePath,sha256,recordId:record.id,owner:'Jonathan Blackburn',recordedOn:'2026-10-21',action:'Register draft optional hardware evidence; owner requested presentation download; no financial or narrative records changed'}))
console.log(JSON.stringify({registered:true,filename:path.basename(source),classification:record.classification,approval:record.approval,copyHashMatches:true,manifestsValidated:true,originalUnchanged:true}))
