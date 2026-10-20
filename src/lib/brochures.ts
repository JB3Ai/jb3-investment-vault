import {presentationText} from './presentationCopy.ts'
import { commercialDocumentVisible } from './commercialReview.ts'
import type { Classification, ContentRecord } from '../../content-migration/ingestion-schema.ts'
import type { ApprovedContent } from './privateContent.ts'
export const brochureCategories = ['Client Proposals', 'JB\u00b3 Products & Technical Briefs', 'Corporate / Investment Presentations', 'Education & Social Impact'] as const
export type BrochureCategory = typeof brochureCategories[number]
export interface BrochureDocument {
  id: string; title: string; originalFilename: string; classification: Classification; approval: ContentRecord['approval']; verification: ContentRecord['verification']; sourceDate: string | null; citation: string; sourceReference: string; sha256: string | null; association?: string; category?: BrochureCategory; documentType?: string; versionGroup?: string; editionRole?: string; excludedFromCommercial?: boolean
}
export function brochureDocument(record: ContentRecord | ApprovedContent, metadata?: Record<string,string|null>): BrochureDocument {
  const sourceTitle = String(record.payload.title)
  const title = /\.pdf$/i.test(sourceTitle) ? sourceTitle.replace(/\.pdf$/i, '').replace(/^\d+[_ ]+v\d+[_ ]+/i, '').replace(/_/g, ' ') : sourceTitle
  return { id: record.id, title:presentationText(title), originalFilename: record.provenance.originalFilename, classification: record.classification, approval: record.approval, verification: record.verification, sourceDate: record.provenance.sourceDate, citation: record.provenance.citation, sourceReference: record.provenance.sourceReference, sha256: 'file' in record ? record.file?.sha256 ?? null : record.sha256,
    association: metadata?.['brochure.association'] ?? undefined, category: brochureCategories.find(category => category === metadata?.['brochure.category']), documentType: metadata?.['brochure.type'] ?? undefined, versionGroup: metadata?.['brochure.versionGroup'] ?? undefined, editionRole: metadata?.['brochure.editionRole'] ?? undefined, excludedFromCommercial: metadata?.['brochure.excludeFromCommercial'] === 'true' }
}
export function brochureEdition(document: BrochureDocument) {
  const file=document.originalFilename.replace(/\.pdf$/i,'').replace(/_/g,' ').toLowerCase()
  const pattern=/(?:^|[\s.-]|(?<=[a-z]))v(?:ersion)?[\s.-]*(\d+(?:\.\d+)*)(?=$|[\s.-])/g
  const versionText=[...file.matchAll(pattern)][0]?.[1]
  const version=versionText?.split('.').map(Number)??[0]
  const key=file.replace(/^\d+\s+/,'').replace(pattern,' ').replace(/\b(?:compressed|uncompressed|original|superseded)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
  return {key,version,label:versionText?'v'+versionText+' (filename)':null,compressed:/\bcompressed\b/.test(file),superseded:/\bsuperseded\b/.test(file)}
}
function compareEditions(a: BrochureDocument,b: BrochureDocument) {
 const av=brochureEdition(a),bv=brochureEdition(b)
 for(let index=0;index<Math.max(av.version.length,bv.version.length);index++){const diff=(bv.version[index]??0)-(av.version[index]??0);if(diff)return diff}
 return 0
}
export function brochureCategory(document: BrochureDocument): BrochureCategory {
  if (document.category) return document.category
  const text = document.title + ' ' + document.originalFilename
  if (/education|school|learning|social impact|community/i.test(text)) return brochureCategories[3]
  if (/proposal|quotation|quote|tender/i.test(text)) return brochureCategories[0]
  if (/technical|product|asset.?audit|github|software|architecture brief/i.test(text)) return brochureCategories[1]
  return brochureCategories[2]
}
export function brochureType(document: BrochureDocument) {
  if (document.documentType) return document.documentType
  const text = document.title + ' ' + document.originalFilename
  if (/proposal|quotation|tender/i.test(text)) return 'Proposal / not a signed contract'
  if (/resume|curriculum|professional experience|\bcv\b/i.test(text)) return 'Professional background'
  if (/audit/i.test(text)) return 'Technical review / evidence'
  return 'Presentation / background document'
}
export function brochureAssociation(document: BrochureDocument) {
  if (document.association) return document.association
  const text = document.title + ' ' + document.originalFilename
  const subject = text.match(/\bGTR[\d\u00b2\u00b3]*\b/i)?.[0] ?? text.match(/\bJB[\d\u00b3]*/i)?.[0]
  return subject ? presentationText(subject) + ' / source-identified subject; commercial status unverified' : 'Not separately recorded; see source title.'
}
export interface BrochureEntry<T extends BrochureDocument = BrochureDocument> { document: T; category: BrochureCategory; versions: T[] }
export function brochureEntries<T extends BrochureDocument>(documents: T[]): BrochureEntry<T>[] {
  const groups: T[][] = []
  for (const document of documents) {
    // Filter before grouping so neither restricted titles nor versions enter the collection.
    if (!['BRUCE_PRIVATE', 'COMMERCIAL'].includes(document.classification) || document.approval === 'rejected' || !commercialDocumentVisible(document)) continue
    const match = groups.find(group => group.some(item => item.classification === document.classification && ((item.sha256 && item.sha256 === document.sha256) || (item.versionGroup && item.versionGroup === document.versionGroup) || (!!brochureEdition(item).key && brochureEdition(item).key === brochureEdition(document).key))))
    if (match) match.push(document); else groups.push([document])
  }
  return groups.map(group => {
    const versions = [...group].sort((a,b) => Number(a.editionRole === 'superseded' || brochureEdition(a).superseded)-Number(b.editionRole === 'superseded' || brochureEdition(b).superseded) || Number(a.editionRole === 'cover-only')-Number(b.editionRole === 'cover-only') || compareEditions(a,b) || Number(brochureEdition(a).compressed)-Number(brochureEdition(b).compressed) || a.id.localeCompare(b.id))
    return { document: versions[0], category: brochureCategory(versions[0]), versions }
  }).sort((a,b) => a.document.title.localeCompare(b.document.title))
}
