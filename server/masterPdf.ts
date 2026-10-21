import {calculateCashFlow,type CashFlowInput} from '../src/lib/cashFlow.ts'
import {narrativeBlocks} from '../src/lib/narrativePresentation.ts'
import {presentationView} from '../src/lib/presentationCopy.ts'
import { brochureDocument } from '../src/lib/brochures.ts'
import { commercialDocumentVisible, commercialCategories, commercialForecastMinor } from '../src/lib/commercialReview.ts'
import { fundingSummary, fundingRow, orderedFinancialRows } from '../src/lib/fundingProposal.ts'
import { recipientAssetSummaries } from '../src/lib/assetReview.ts'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { privateFile } from '../content-migration/local-importer.ts'
import { financialNote, totals } from '../src/lib/financialSchedules.ts'
import { financialScenarios, emptySustainable, type SustainableInput } from '../src/lib/financialScenarios.ts'
import type { LocalReview } from '../src/lib/localReview.ts'
/** Private metadata-only module. Never embeds source PDFs, paths, signed URLs or restricted records. */
export function commercialPdfSource(data: LocalReview) {
 if(!data.commercial)return undefined
 const visible = (id:string) => {const document=data.documents.find(record=>record.id===id);return document && document.classification==='BRUCE_PRIVATE' && commercialDocumentVisible(brochureDocument(document,data.evidenceReviews?.find(review=>review.recordId===id)?.metadata))?document:null}
 return {owner:data.commercial.owner,recordedOn:data.commercial.recordedOn,forecastMinor:commercialForecastMinor(data.commercial),entries:data.commercial.entries.map(entry=>({...entry,categoryLabel:commercialCategories[entry.category],sourceDocuments:entry.sourceDocuments.flatMap(source=>{const document=visible(source.recordId);return document?[{...source,title:String(document.payload.title),filename:document.provenance.originalFilename,sha256:document.file?.sha256,approval:document.approval,verification:document.verification,inAppendix:!!data.localDocumentPreviewIds?.includes(document.id)}]:[]})}))}
}
export async function generateMasterPdf(root:string,data:LocalReview,rate:number,scenario:SustainableInput=emptySustainable,cashFlow?:CashFlowInput) {
 const review=data.laboratory.review
 const placement=review?[...review.slots.filter(slot=>slot.recordId),...review.unplaced.map(item=>({...item,position:null}))]:data.laboratory.photographs.map((r,index)=>({recordId:r.id,position:index+1,originalNumber:index+1}))
 const images=await Promise.all(placement.map(async item=>{const record=data.laboratory.photographs.find(r=>r.id===item.recordId)!;return {...item,path:await privateFile(root,record.file!.relativePath),caption:record.payload.caption,filename:record.provenance.originalFilename,sha256:record.file!.sha256,approval:record.approval,verification:record.verification}}))
 const rows=[...orderedFinancialRows(data.finances,data.finances.personal),...orderedFinancialRows(data.finances,data.finances.business)].map(record=>({id:record.id,label:record.payload.label,schedule:data.finances.personal.some(row=>row.id===record.id)?'Personal':'Business',amountMinor:record.payload.amountMinor,optional:financialNote(record).optionalHardware,note:financialNote(record).note,source:record.provenance.citation,originalFilename:record.provenance.originalFilename,approval:record.approval,funding:fundingRow(data.finances,record)}))
 const all=totals([...data.finances.personal,...data.finances.business])
 const payload={cashFlow:cashFlow?calculateCashFlow(data.finances,cashFlow):undefined,ownerAssetEstimates:data.assets?.ownerEstimates,sections:data.sections.map(section=>({...section,narrativeBlocks:narrativeBlocks(section.narrative.payload.body)})),commercial:commercialPdfSource(data),assets:recipientAssetSummaries(data.assets).map(entry=>({...entry,sourceReferences:entry.sourceDocumentIds.flatMap(id=>{const record=data.documents.find(r=>r.id===id&&r.classification==='BRUCE_PRIVATE');return record?[{filename:record.provenance.originalFilename,citation:record.provenance.citation,sha256:record.file?.sha256,approval:record.approval,verification:record.verification}]:[]})})),hasAssetReview:!!data.assets,laboratory:{title:data.laboratory.title,records:data.laboratory.records,images,videos:review?.videos??[],pending:review?.slots.filter(slot=>slot.recordId===null).map(slot=>slot.position)??[]},finances:{rows,all,funding:fundingSummary(data.finances),proposal:data.finances.funding,personal:totals(data.finances.personal),business:totals(data.finances.business),rate,revision:data.finances.revision,scenarios:financialScenarios(data.finances,scenario),scenarioInput:scenario,findings:data.finances.findings},documents:data.documents.filter(record=>record.classification==='BRUCE_PRIVATE' && data.localDocumentPreviewIds?.includes(record.id) && commercialDocumentVisible(brochureDocument(record,data.evidenceReviews?.find(review=>review.recordId===record.id)?.metadata))).map(record=>({id:record.id,title:record.payload.title,...record.provenance,approval:record.approval,verification:record.verification}))}
 const python=process.env.JB3_PDF_PYTHON??path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 const script=fileURLToPath(new URL('./master_pdf.py',import.meta.url))
 return new Promise<Buffer>((resolve,reject)=>{const child=spawn(python,[script],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1'},stdio:['pipe','pipe','pipe']}),chunks:Buffer[]=[];let size=0;const timer=setTimeout(()=>{child.kill();reject(Error('Private PDF generation timed out'))},180000);child.stdout.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>50*1024*1024){child.kill();return}chunks.push(chunk)});child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error('Private PDF runtime unavailable'))});child.on('close',code=>{clearTimeout(timer);const bytes=Buffer.concat(chunks);if(code!==0||!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))reject(Error('Private PDF generation failed'));else resolve(bytes)});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(presentationView(payload)))})
}
