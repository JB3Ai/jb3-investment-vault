import {createPrivateThumbnailQueue} from './privateThumbnailQueue'
import type { CommercialReview } from './commercialReview'
import type { FundingProposal } from './fundingProposal'
import type { AssetReview } from './assetReview'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
import type { ApprovedNarrative } from './privateContent'
import type { LaboratoryEvidenceReview } from './laboratoryEvidence'
import type { SustainableInput } from './financialScenarios'
export interface EvidenceReview {
  recordId: string
  sectionIds: string[]
  pageCount: number
  metadata: Record<string, string | null>
  summary: string
  assertions: string[]
  independentlyVerifiedFacts: string[]
  verificationHolds: string[]
  downloadAllowed: false
  reviewStatus: 'DRAFT / OWNER REVIEW REQUIRED'
}

/** Transport types only. Populated records are fetched from the local Node process. */
/** Safe catalogue notices only; these never grant file access or carry extracted source text. */
export interface DocumentNotice {
  recordId: string | null
  title: string
  association: string
  filename: string | null
  classification: 'LEGAL_RESTRICTED' | 'BRUCE_PRIVATE'
  sectionIds: string[]
  collection: 'legal' | 'client-engagements'
  status: string
  reason: string
}
export interface LocalReview {
  documentNotices?: DocumentNotice[]
  sections: { id: string; narrative: ApprovedNarrative }[]
  laboratory: { title: string; records: ContentRecord[]; photographs: ContentRecord[]; review?: LaboratoryEvidenceReview | null }
  documents: ContentRecord[]
  evidenceReviews?: EvidenceReview[]
  localDocumentPreviewIds?: string[]
  thumbnailPreviews?: {recordId:string;parentId:string;sha256:string;originalFilename:string;classification:string;approval:string;available:boolean}[]
  commercial?: CommercialReview
  assets?: AssetReview
  finances: {
    funding?: FundingProposal
    personal: ContentRecord[]; business: ContentRecord[]
    exchangeRate: { zarPerGbp: number; source: string; asOf: string | null } | null
    findings: { source: string; note: string }[]
    revision?: { owner: string; recordedOn: string; source: string; workbook: string; workbookSha256: string; therapy: { sessionZar: number; sessionsPerMonth: number; fortnightlyAverageMonthlyZar: number } }
  }
}
export const presentationReleaseMode = import.meta.env.VITE_VAULT_MODE === 'presentation'
export const localReviewMode = presentationReleaseMode || import.meta.env.DEV && import.meta.env.MODE === 'private-local'
export async function localReviewFetch(resource: string, signal?: AbortSignal, init: RequestInit = {}): Promise<Response> {
  if (!localReviewMode) throw new Error('Local owner review is unavailable')
  if(presentationReleaseMode && init.method === 'POST' && ['financial-export','master-pdf'].includes(resource)){
    const options=JSON.parse(String(init.body)),content=await localReviewFetch('content',signal),data=await content.json() as LocalReview
    const {presentationWorkbook,presentationPdf}=await import('./presentationExports')
    const {validSustainable,emptySustainable}=await import('./financialScenarios')
    const {validExchangeRate}=await import('./financialSchedules')
    if(!['combined','personal','business'].includes(options.scope)||!validExchangeRate(options.zarPerGbp))throw Error('Invalid export assumption')
    const scenario=options.scenario?validSustainable(options.scenario):emptySustainable
    const bytes=resource==='financial-export'?presentationWorkbook(data.finances,options.scope,options.zarPerGbp,scenario):await presentationPdf(data,options.zarPerGbp,scenario,async id=>new Uint8Array(await (await localReviewFetch('assets/'+id,signal)).arrayBuffer()))
    return new Response(bytes as BodyInit,{headers:{'Cache-Control':'no-store','Content-Type':resource==='financial-export'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf'}})
  }
  const response = await fetch(`${presentationReleaseMode ? '/api/vault/presentation/' : '/api/vault/local-review/'}${resource}`, {
    ...init, headers: { ...(presentationReleaseMode ? {} : { 'X-Vault-Local-Review': '1' }), ...init.headers }, cache: 'no-store', credentials: 'omit', signal,
  })
  if (!response.ok) throw new Error('Private local content could not be loaded. Check the local intake and source files.')
  return response
}

export async function localFinancialExport(scope: 'combined' | 'personal' | 'business', zarPerGbp: number, scenario?: SustainableInput) {
  if (!localReviewMode) throw new Error('Local owner export is unavailable')
  const response = await localReviewFetch('financial-export', undefined, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, zarPerGbp, ...(scenario?{scenario}:{}) }), cache: 'no-store', credentials: 'omit', redirect: 'error',
  })
  if (!response.ok || !response.headers.get('cache-control')?.includes('no-store') || response.headers.get('content-type') !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error('Private workbook export unavailable. Check the local workbook runtime and source validation.')
  return response.blob()
}

const queuePrivateThumbnail = createPrivateThumbnailQueue(2)
export async function loadPrivateThumbnail(recordId: string, signal: AbortSignal): Promise<Blob> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) throw new Error('Invalid private cover')
  return queuePrivateThumbnail(async () => {
    const response = await localReviewFetch('assets/' + recordId)
    if (response.headers.get('content-type') !== 'image/png' || !response.headers.get('cache-control')?.includes('no-store')) throw new Error('Private cover unavailable')
    return response.blob()
  }, signal)
}
