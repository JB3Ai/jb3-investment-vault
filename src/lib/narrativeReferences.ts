import {narrativeBlocks} from './narrativePresentation.ts'
import {presentationText} from './presentationCopy.ts'
import {brochureDocument,brochureEntries} from './brochures.ts'
import type {LocalReview} from './localReview.ts'
import type {ContentRecord} from '../../content-migration/ingestion-schema.ts'

export interface NarrativeReference {
 id:string; title:string; afterBlock:number; kind:'pdf'|'gallery'; record?:ContentRecord; available:boolean
}
/** Resolve only existing intake identities and reviewed associations; this grants no access. */
export function narrativeReferences(data:LocalReview,sectionId:string,body:string):NarrativeReference[]{
 const blocks=narrativeBlocks(presentationText(body)),paragraphs=blocks.flatMap((block,index)=>block.type==='paragraph'?[{index,body:block.body}]:[])
 if(!paragraphs.length)return []
 const after=(pattern:RegExp)=>paragraphs.find(block=>pattern.test(block.body))?.index??paragraphs[paragraphs.length-1].index
 const result:NarrativeReference[]=[],reviews=new Map(data.evidenceReviews?.map(review=>[review.recordId,review]))
 const documents=data.documents.filter(record=>record.kind==='pdf'&&record.approval!=='rejected')
 const described=(record:ContentRecord)=>[String(record.payload.title),reviews.get(record.id)?.metadata['documents.association']??''].join(' ')
 function add(record:ContentRecord|undefined,anchor:RegExp){if(!record||result.some(ref=>ref.id===record.id))return;result.push({id:record.id,title:brochureDocument(record,reviews.get(record.id)?.metadata).title,afterBlock:after(anchor),kind:'pdf',record,available:record.classification!=='LEGAL_RESTRICTED'&&!!data.localDocumentPreviewIds?.includes(record.id)})}
 const associated=documents.filter(record=>reviews.get(record.id)?.sectionIds.includes(sectionId))
 if(sectionId==='current-position')add(associated.find(record=>record.classification==='LEGAL_RESTRICTED'&&/custody/i.test(described(record))),/girls|daughters|children|parent|family responsibilities|family circumstances/i)
 if(sectionId==='history-evidence')result.push({id:'laboratory',title:'23-Day Laboratory Photographs',afterBlock:after(/photographic showcase|separate.*photograph|photograph.*showcase/i),kind:'gallery',available:true})
 if(sectionId==='assets-claims'){
  add(associated.find(record=>record.classification==='LEGAL_RESTRICTED'&&/micore/i.test(described(record))),/micore/i)
  add(associated.find(record=>record.classification==='LEGAL_RESTRICTED'&&/kula/i.test(described(record))),/kula/i)
  add(associated.find(record=>record.classification==='LEGAL_RESTRICTED'&&/blackburn house/i.test(described(record))),/family.{0,50}property|property.{0,50}family|property exposure|collateral|trust|house/i)
  add(associated.find(record=>reviews.get(record.id)?.metadata['documents.category']==='technical-assets'),/audit|github/i)
 }
 if(sectionId==='financial-requirements')add(associated.find(record=>reviews.get(record.id)?.metadata['documents.category']==='hardware-investment'),/computing upgrades|hardware|server|computing/i)
 const brochures=brochureEntries(associated.map(record=>brochureDocument(record,reviews.get(record.id)?.metadata))).map(entry=>documents.find(record=>record.id===entry.document.id)!)
 if(sectionId==='beobacht-alignment')add(brochures.find(record=>reviews.get(record.id)?.metadata['documents.category']==='corporate-investment'),/software|technology/i)
 if(sectionId==='commercial-pipeline')add(brochures.find(record=>/\bssg\b/i.test(described(record))),/\bssg\b/i)
 if(sectionId==='southern-african-strategy')add(brochures.find(record=>/isikolo/i.test(described(record))),/education|learning|technology/i)
 return result
}
