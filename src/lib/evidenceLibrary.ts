import type { ContentRecord } from '../../content-migration/ingestion-schema'
import type { EvidenceReview } from './localReview'

export const evidenceCategories = ['Founder Profile & Credentials','Financial Requirements','Technical Assets','Corporate / Investment Presentations','Supporting evidence','Legal & supporting records'] as const
export function evidenceCategory(record:ContentRecord,review?:EvidenceReview):string {
 if(record.classification==='LEGAL_RESTRICTED')return evidenceCategories[5]
 const category=review?.metadata['documents.category']
 if(category==='founder-profile')return evidenceCategories[0]
 if(category==='hardware-investment')return evidenceCategories[1]
 if(category==='technical-assets')return evidenceCategories[2]
 return /investor|investment deck/i.test(String(record.payload.title)+' '+record.provenance.originalFilename)?evidenceCategories[3]:evidenceCategories[4]
}
export function evidenceGroups(records:ContentRecord[],reviews:EvidenceReview[]=[]):[string,ContentRecord[]][] {
 return evidenceCategories.map(category=>[category,records.filter(record=>evidenceCategory(record,reviews.find(review=>review.recordId===record.id))===category)])
}
