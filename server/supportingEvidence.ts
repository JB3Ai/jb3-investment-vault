import { readFile } from 'node:fs/promises'
import { privateFile } from '../content-migration/local-importer.ts'
import { sectionIds, type ContentManifest } from '../content-migration/ingestion-schema.ts'
import type { EvidenceReview } from '../src/lib/localReview.ts'

/** Review annotations reference the existing manifest; never a second asset registry. */
export function supportingEvidenceReview(input: unknown, manifest: ContentManifest) {
  const value = input as { format?: string; records?: (EvidenceReview & {sourcePath: string;sha256: string})[]; legacyLocalPreviewIds?: string[]; ownerLocalPreview?: {recordId:string;sha256:string;scope:string;requestedBy:string;recordedOn:string}[] }
  if (!value || value.format !== 'JB3_SUPPORTING_EVIDENCE_REVIEW_V1' || !Array.isArray(value.records) || !Array.isArray(value.legacyLocalPreviewIds)) throw Error('Invalid supporting evidence review')
  const records = new Map(manifest.sections.flatMap(section => section.records.map(record => [record.id, {record, sectionId:section.id}] as const)))
  const seen = new Set<string>()
  const text = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0
  const reviews = value.records.map(entry => {
    const stored = records.get(entry.recordId), record = stored?.record
    if (!record || record.kind !== 'pdf' || record.approval !== 'draft' || !['LEGAL_RESTRICTED','BRUCE_PRIVATE'].includes(record.classification) || record.verification !== 'awaiting-verification' || entry.sha256 !== record.file?.sha256 || seen.has(entry.recordId) || entry.downloadAllowed !== false || entry.reviewStatus !== 'DRAFT / OWNER REVIEW REQUIRED' || !Number.isInteger(entry.pageCount) || entry.pageCount < 1 || !text(entry.sourcePath) || !text(entry.summary) || !Array.isArray(entry.sectionIds) || !entry.sectionIds.includes(stored!.sectionId) || entry.sectionIds.some(id => !(sectionIds as readonly string[]).includes(id)) || !entry.metadata || typeof entry.metadata !== 'object' || Object.values(entry.metadata).some(item=>item!==null&&typeof item!=='string') || [entry.assertions,entry.independentlyVerifiedFacts,entry.verificationHolds].some(items=>!Array.isArray(items)||!items.length||!items.every(text))) throw Error('Supporting evidence review does not match its draft manifest record')
    seen.add(entry.recordId)
    // Original absolute custody paths and extraction files stay server-side.
    return {recordId:entry.recordId,sectionIds:entry.sectionIds,pageCount:entry.pageCount,metadata:entry.metadata,summary:entry.summary,assertions:entry.assertions,independentlyVerifiedFacts:entry.independentlyVerifiedFacts,verificationHolds:entry.verificationHolds,downloadAllowed:false as const,reviewStatus:entry.reviewStatus}
  })
  const allowed = value.legacyLocalPreviewIds
  if (new Set(allowed).size !== allowed.length || allowed.some(id => seen.has(id) || records.get(id)?.record.kind !== 'pdf' || records.get(id)?.record.classification !== 'BRUCE_PRIVATE')) throw Error('Invalid existing local PDF preview allowance')
  const local = value.ownerLocalPreview ?? []
  if (!Array.isArray(local)) throw Error('Invalid owner-local preview requests')
  const ownerIds = new Set<string>()
  for (const entry of local) {
    const record = records.get(entry.recordId)?.record
    if (!record || record.kind !== 'pdf' || record.classification !== 'BRUCE_PRIVATE' || record.approval !== 'draft' || !seen.has(entry.recordId) || ownerIds.has(entry.recordId) || allowed.includes(entry.recordId) || entry.sha256 !== record.file?.sha256 || entry.scope !== 'loopback-owner-review-only' || !text(entry.requestedBy) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.recordedOn)) throw Error('Owner-local preview request does not match draft source')
    ownerIds.add(entry.recordId)
  }
  return { reviews, allowed: [...allowed, ...ownerIds] }
}
export async function loadSupportingEvidence(root:string,manifest:ContentManifest) {
  try {
    return supportingEvidenceReview(JSON.parse((await readFile(await privateFile(root,'supporting-evidence-review.json'),'utf8')).replace(/^\uFEFF/,'')),manifest)
  } catch(error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {reviews:[],allowed:[]}
    throw error
  }
}
export function localAssetAllowed(recordId:string,kind:string,allowedPdfIds:readonly string[],thumbnails:readonly {recordId:string;parentId:string}[]=[]){
  const thumbnail=thumbnails.find(item=>item.recordId===recordId)
  if(thumbnail)return kind==='photograph'&&allowedPdfIds.includes(thumbnail.parentId)
  return kind==='photograph'||kind==='pdf'&&allowedPdfIds.includes(recordId)
}
