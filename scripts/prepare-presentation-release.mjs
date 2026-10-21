import {presentationVisuals,privateSourcePath} from '../server/presentationScreening.ts'
// Deployment projection of the established intake. Originals and approvals are never mutated.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {loadLocalReview} from '../server/localReview.ts'
import {privateFile} from '../content-migration/local-importer.ts'
import {commercialDocumentVisible} from '../src/lib/commercialReview.ts'
import {brochureDocument} from '../src/lib/brochures.ts'
const root=process.env.JB3_PRIVATE_CONTENT_ROOT
if(!root)throw Error('External intake root required')
const {data:original,records}=await loadLocalReview(root),data=structuredClone(original),out=path.join(root,'presentation-release')
await fs.mkdir(out,{recursive:true});const excluded=[],assets={},uploads=[]
let publicationApprovals={}
try{publicationApprovals=JSON.parse(await fs.readFile(path.join(out,'deployment.private.json'),'utf8')).approval?.files??{}}catch{}
const hash=b=>createHash('sha256').update(b).digest('hex')
let release='presentation-20261020-'+hash(Buffer.from(JSON.stringify(original.sections))).slice(0,12)
const family=/\b(children|daughters?|girls|custody|school(?:ing)?|therapy|counselling|medical|minor child|parenting)\b/i
const childTokens=new Set()
const common=new Set('Bruce Jono Jonathan Blackburn JB My The This That These Those There Their They Them We Our You Your It Its All Both However Although Since Before After While During As At In On For To From And But Not Rather Some Each Any With Without What When Where How If No Yes School Schooling Medical Therapy Personal Business Funding Financial Household Family South African Africa ZAR GBP October February COVID KULA'.split(' '))
let redactedParagraphs=0
for(const s of data.sections){
 const lines=s.narrative.payload.body.split('\n')
 for(const line of lines.filter(p=>family.test(p))){
  for(const match of line.matchAll(/(?:daughters?|girls|children)\s*(?:called|named|are|[:,(])?\s+([A-Z][a-z]+)(?:\s*(?:and|&|,)\s*([A-Z][a-z]+))?/g))for(const token of match.slice(1))if(token&&!common.has(token))childTokens.add(token)
  for(const match of line.matchAll(/\b([A-Z][a-z]+)\s+Blackburn\b/g))if(!common.has(match[1]))childTokens.add(match[1])
 }
}
const sensitive=s=>[...childTokens].some(t=>new RegExp('\\b'+t+'\\b').test(s))
// Retain generic family-funding wording; withhold identifying names, ages and school details.
for(const s of data.sections)s.narrative.payload.body=s.narrative.payload.body.split('\n').filter(line=>{
 if(sensitive(line)||family.test(line)&&/\b\d{1,2}[ -]year|\bage[ds]?\s*\d|\bDOB\b|\bID\s*(?:number|no\.)/i.test(line)){redactedParagraphs++;return false}return true
}).join('\n')
function scrub(value,key=''){
 if(typeof value==='string'){
  if(key==='reconciliationNote'){try{return JSON.stringify(scrub(JSON.parse(value),'financial-note'))}catch{throw Error('Financial notes invalid')}}
  if(/relativePath|originalPath|sourcePath/i.test(key)||privateSourcePath(value))return '[Private source path withheld]'
  if(sensitive(value))return '[Personal detail withheld]'
  return value
 }
 if(Array.isArray(value))return value.map(v=>scrub(v,key))
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v,k)]))
 return value
}
const python=`import pymupdf,re,json,sys\nd=pymupdf.open(sys.argv[1]); t='\\n'.join(p.get_text() for p in d)\nprint(json.dumps({'confidential':bool(re.search(r'confidential|non.disclosure|not for distribution|internal use only',t,re.I)),'legalOrChild':bool(re.search(r'custody|minor child|children.s court|identity number|date of birth',t,re.I)),'childNameContext':bool(re.search(r'(?i:daughter|daughters|children|girls)\\s+(?:(?i:called|named|are)\\s+)?[A-Z][a-z]{2,}',t)),'credential':bool(re.search(r'sb_secret_[A-Za-z0-9_-]{15,}|sbp_[A-Za-z0-9_-]{15,}|PRIVATE KEY',t)),'sensitiveNames':any(re.search(r'\\b'+re.escape(x)+r'\\b',t,re.I) for x in json.loads(sys.stdin.read() or '[]')),'pages':len(d)}))`
async function bytesFor(record){const file=await privateFile(root,record.file.relativePath),bytes=await fs.readFile(file);if(hash(bytes)!==record.file.sha256)throw Error('Source integrity failed');return {file,bytes}}
async function add(record,mime){const {bytes}=await bytesFor(record);const dest=path.join(out,record.id);await fs.writeFile(dest,bytes);const sha256=hash(bytes),key=release+'/assets/'+record.id;assets[record.id]={key,mime,filename:record.provenance.originalFilename,sha256};uploads.push({key,file:dest,sha256})}
// Owner-requested public catalogue corrections; never change original draft records.
const clientSpecs=[
 {match:n=>n==='SSG_FINAL_DRAFT.pdf',association:'SSG Mining / Security',title:'SSG Mining / Security',order:1,status:'Proposal'},
 {match:n=>n==='Exec Deck (SNG Grant Thornton) (Presentation).pdf',association:'SNG Grant Thornton',title:'SNG Grant Thornton',order:2,status:'Prototype'},
 {match:n=>n==='prd_app_kidnapv2.pdf',association:'PTN Security',title:'Kidnap Response Application PRD',order:3,status:'Proposal',label:'Requirements / proposed application'},
 {match:n=>n.startsWith('Dual-Layer Intelligence for Eagle Star'),association:'Eagle Star Security',title:'Eagle Star Security',order:4,status:'Proposal',label:'Technical proposal / architecture showcase'},
]
for(const spec of clientSpecs){const record=data.documents.find(r=>spec.match(r.provenance.originalFilename)),review=data.evidenceReviews?.find(r=>r.recordId===record?.id);if(review){Object.assign(review.metadata,{'portfolio.collection':'client-engagements','portfolio.title':spec.title,'portfolio.association':spec.association,'portfolio.order':String(spec.order),'portfolio.status':spec.status});if(spec.label)review.metadata['portfolio.statusLabel']=spec.label}}
const documentNotices=[]
for(const spec of [
 {title:'KULA',filename:'dd_kula.pdf',section:'assets-claims'},
 {title:'Micore',filename:'3MICORE DOSSIER DRAFT - Copy.pdf',section:'assets-claims'},
 {title:"Children's Custody",filename:'URGENT_APPLICATION_2025.07.28.11.45.pdf',section:'current-position'},
 {title:'Blackburn House',filename:'Master_Litigation_Dossier_Blackburn.pdf',section:'assets-claims'},
]){const record=spec.filename?original.documents.find(r=>r.provenance.originalFilename===spec.filename):null;documentNotices.push({recordId:record?.id??null,title:spec.title,association:spec.title,filename:record?.provenance.originalFilename??null,classification:'LEGAL_RESTRICTED',sectionIds:[spec.section],collection:'legal',status:record?'Draft / unpublished':'Source missing',reason:record?'Sensitive legal and third-party material. Explicit publication review and appropriate authorisation are required before original bytes can be served.':'No separate canonical Micore PDF was found in the existing intake. The Blackburn house dossier is a different matter and has not been substituted.'})}
const allowed=new Set(original.localDocumentPreviewIds??[]),documents=[]
for(const record of original.documents){
 let reason=null
 if(original.evidenceReviews?.find(review=>review.recordId===record.id)?.metadata['publication.scope']==='loopback-owner-review-only')reason='Local owner review only; no public publication approval'
 else if(record.classification==='LEGAL_RESTRICTED')reason='Restricted legal dossier'
 else if(/Cyber-Noir Music Console Magazine/i.test(record.provenance.originalFilename))reason='Identifiable family name on cover; publication held for review'
 else if(!allowed.has(record.id))reason='No existing document viewing approval'
 else if(!commercialDocumentVisible(brochureDocument(record,original.evidenceReviews?.find(r=>r.recordId===record.id)?.metadata)))reason='Excluded from featured presentation'
 else{const {file}=await bytesFor(record);const run=spawnSync('python',['-c',python,file],{encoding:'utf8',windowsHide:true,input:JSON.stringify([...childTokens]),stdio:['pipe','pipe','pipe']});if(run.status!==0)throw Error('PDF screening unavailable');const scan=JSON.parse(run.stdout);if(scan.confidential)reason='Confidential marking; separate publication approval required';else if(scan.sensitiveNames)reason='Child-identifying name match; original withheld'
 else if(scan.childNameContext)reason='Possible child-identifying text; original withheld'
 else if(scan.legalOrChild)reason='Legal or personal-identification content';else if(scan.credential)reason='Credential-like content requires review'}
 if(reason){excluded.push({filename:record.provenance.originalFilename,reason});const spec=clientSpecs.find(spec=>spec.match(record.provenance.originalFilename));if(spec)documentNotices.push({recordId:record.id,title:spec.title,association:spec.association,filename:record.provenance.originalFilename,classification:'BRUCE_PRIVATE',sectionIds:['commercial-pipeline'],collection:'client-engagements',status:spec.label??spec.status,reason:reason==='Confidential marking; separate publication approval required'?'The source is marked confidential. Original bytes remain unpublished pending explicit publication approval.':'Sensitive personal, safety or legal source material requires a separate publication review. Original bytes remain unpublished.'});continue}
 documents.push(record);await add(record,'application/pdf')
}
data.documentNotices=documentNotices;data.documents=documents;const visible=new Set(documents.map(r=>r.id));data.localDocumentPreviewIds=[...visible]
data.evidenceReviews=(data.evidenceReviews??[]).filter(r=>visible.has(r.recordId))
data.thumbnailPreviews=(data.thumbnailPreviews??[]).filter(r=>visible.has(r.parentId)&&r.classification!=='LEGAL_RESTRICTED')
for(const thumbnail of data.thumbnailPreviews){const record=records.get(thumbnail.recordId);if(record)await add(record,'image/png')}
// Only the established laboratory mapping, never unrelated evidence imagery.
for(const photo of data.laboratory.photographs)await add(photo,photo.file.mimeType??'image/jpeg')
data.sectionVisuals=presentationVisuals(data.sectionVisuals,publicationApprovals)
for(const {record} of data.sectionVisuals)await add(record,record.file.mimeType)
if(data.commercial)for(const entry of data.commercial.entries){entry.sourceDocuments=entry.sourceDocuments.filter(s=>visible.has(s.recordId));entry.quotedValues=entry.quotedValues.filter(s=>visible.has(s.sourceDocumentId))}
if(data.assets)data.assets.entries=data.assets.entries.filter(entry=>entry.classification!=='LEGAL_RESTRICTED')
for(const record of [...data.finances.personal,...data.finances.business]){
 const note=JSON.parse(String(record.payload.reconciliationNote))
 if(family.test(String(record.payload.label)+' '+note.note)){
  const old=String(record.payload.label)
  record.payload.label=/school|education/i.test(old)?'Schooling requirement':/therapy|counselling/i.test(old)?'Counselling allowance':/medical|dental|health/i.test(old)?'Medical and health estimate':'Family essentials estimate'
  note.note='Personal identifiers withheld from this presentation copy. Source amounts, formulas, draft status and reconciliation requirements are unchanged.'
  record.payload.reconciliationNote=JSON.stringify(note)
  const decision=data.finances.funding?.rows.find(r=>r.recordId===record.id);if(decision)decision.note=note.note
 }
}
data.finances.findings=data.finances.findings.map(f=>family.test(f.source+' '+f.note)?{source:'Personal schedule verification',note:'Personal source details retained privately; reconciliation and approval remain outstanding.'}:f)
const clean=scrub(data)
const text=JSON.stringify(clean)
if(clean.documents.some(r=>r.classification==='LEGAL_RESTRICTED')||/sb_secret_[A-Za-z0-9_-]{15,}|sbp_[A-Za-z0-9_-]{15,}|PRIVATE KEY/.test(text))throw Error('Release privacy boundary failed')
const initialRelease=release
release='presentation-20261021-'+hash(Buffer.from(JSON.stringify({data:clean,assets:Object.entries(assets).map(([id,a])=>[id,a.sha256])}))).slice(0,16)
for(const asset of Object.values(assets))asset.key=asset.key.replace(initialRelease+'/',release+'/')
for(const upload of uploads)upload.key=upload.key.replace(initialRelease+'/',release+'/')
const content=path.join(out,'content.private.json');await fs.writeFile(content,JSON.stringify({data:clean,assets}))
const ledger={release,content,uploads,excluded,redactedParagraphs,approval:{files:publicationApprovals,owner:'Jonathan Blackburn',date:'2026-10-21',basis:'Owner-requested five corrections to temporary presentation; restricted original files remain withheld; original record statuses retained'},sections:clean.sections.length,documents:documents.length,photos:clean.laboratory.photographs.length}
await fs.writeFile(path.join(out,'deployment.private.json'),JSON.stringify(ledger,null,2))
console.log(JSON.stringify({prepared:true,sections:ledger.sections,documents:ledger.documents,photographs:ledger.photos,financialRows:clean.finances.personal.length+clean.finances.business.length,withheldPersonalParagraphs:redactedParagraphs,excludedFiles:excluded},null,2))
