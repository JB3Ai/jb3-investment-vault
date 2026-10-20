import { commercialDocumentVisible } from './commercialReview'
import { thumbnailReference } from './thumbnailReference'
import type { SupabaseClient } from '@supabase/supabase-js'
import { protectedDownload } from './protectedDownloads'
// Types only: the importer and manifest parser must never enter the browser graph.
import type { Classification, ContentRecord, ContentSectionId, Provenance } from '../../content-migration/ingestion-schema'

export interface ApprovedContent {
  id: string
  section_id: ContentSectionId
  kind: ContentRecord['kind']
  classification: Classification
  verification: ContentRecord['verification']
  approval: 'approved'
  provenance: Provenance
  payload: ContentRecord['payload']
  storage_path: string | null
  sha256: string | null
  mime_type: string | null
}
export interface ApprovedNarrative extends ApprovedContent {
  kind: 'narrative'
  classification: 'BRUCE_PRIVATE'
  verification: 'documented' | 'reported'
  payload: { heading: string; body: string }
}
export class PrivateNarrativeError extends Error {
  code: 'access-denied' | 'release-disabled' | 'unavailable'
  constructor(code: PrivateNarrativeError['code'], message: string) { super(message); this.code = code }
}
async function requireReleasedUser(client: SupabaseClient) {
  const user = await client.auth.getUser()
  if (user.error || !user.data.user || user.data.user.is_anonymous) throw new PrivateNarrativeError('access-denied', 'Authenticated access required')
  for (const table of ['vault_settings', 'vault_content_settings']) {
    const state = await client.from(table).select('access_enabled').eq('id', 1).single()
    if (state.error || state.data?.access_enabled !== true) throw new PrivateNarrativeError('release-disabled', 'Confidential release remains disabled')
  }
  return user.data.user.id
}
export async function loadApprovedNarratives(client: SupabaseClient, sectionId: ContentSectionId): Promise<ApprovedNarrative[]> {
  const userId = await requireReleasedUser(client)
  const grant = await client.from('vault_content_grants').select('classification').eq('user_id', userId).eq('classification', 'BRUCE_PRIVATE').maybeSingle()
  if (grant.error || grant.data?.classification !== 'BRUCE_PRIVATE') throw new PrivateNarrativeError('access-denied', 'This account has not been granted Bruce-private narrative access.')
  const result = await client.from('vault_content_records').select('*').eq('section_id', sectionId).eq('kind', 'narrative').eq('classification', 'BRUCE_PRIVATE').eq('approval', 'approved').order('id')
  if (result.error) throw new PrivateNarrativeError(result.error.code === '42501' ? 'access-denied' : 'unavailable', 'Approved narrative content is unavailable.')
  const records = (result.data ?? []) as ApprovedNarrative[]
  for (const record of records) {
    const provenance = record.provenance
    if (record.approval !== 'approved' || record.kind !== 'narrative' || record.section_id !== sectionId || record.classification !== 'BRUCE_PRIVATE' || !['reported', 'documented'].includes(record.verification) || record.storage_path !== null || !provenance || provenance.conflictNote !== null || !provenance.reviewedBy || !/^\d{4}-\d{2}-\d{2}$/.test(provenance.reviewedOn ?? '') || !provenance.originalFilename || !provenance.citation || !provenance.sourceReference || typeof record.payload?.heading !== 'string' || !record.payload.heading.trim() || typeof record.payload.body !== 'string' || !record.payload.body.trim()) throw new PrivateNarrativeError('unavailable', 'Narrative review metadata is incomplete or unresolved.')
  }
  if (records.length > 1) {
    const positions = records.map(record => Number(record.provenance.citation.match(/\blines (\d+)-\d+\b/i)?.[1]))
    if (positions.some(position => !Number.isSafeInteger(position) || position < 1) || new Set(positions).size !== records.length || new Set(records.map(record => record.provenance.sourceReference)).size !== 1) throw new PrivateNarrativeError('unavailable', 'Narrative source order requires review.')
    records.sort((left, right) => Number(left.provenance.citation.match(/\blines (\d+)-\d+\b/i)![1]) - Number(right.provenance.citation.match(/\blines (\d+)-\d+\b/i)![1]))
  }
  return records
}
function approved(row: ApprovedContent) {
  if (row.approval !== 'approved' || row.verification === 'awaiting-verification' || !['BRUCE_PRIVATE', 'COMMERCIAL', 'LEGAL_RESTRICTED'].includes(row.classification)) throw new Error('Unapproved content response rejected')
  return row
}
/** RLS is authoritative. No service keys, cached content or demo fallback. */
export async function loadApprovedSection(client: SupabaseClient, sectionId: ContentSectionId) {
  await requireReleasedUser(client)
  const result = await client.from('vault_content_records').select('*').eq('section_id', sectionId).eq('approval', 'approved').order('id')
  if (result.error) throw new Error('Approved private content is unavailable')
  return ((result.data ?? []) as ApprovedContent[]).map(approved)
}
/** Rechecks metadata on every download; caller cannot provide an arbitrary object path. */
export async function downloadApprovedAsset(client: SupabaseClient, recordId: string, signal?: AbortSignal) {
  await requireReleasedUser(client)
  const result = await client.from('vault_content_records').select('*').eq('id', recordId).eq('approval', 'approved').maybeSingle()
  if (result.error || !result.data) throw new Error('Asset unavailable for this account')
  const record = approved(result.data as ApprovedContent)
  if (!record.storage_path || !['pdf', 'photograph'].includes(record.kind)) throw new Error('Record has no downloadable asset')
  const blob = await protectedDownload(client, 'assets', recordId, signal)
  return { blob, record }
}


/** General collection excludes restricted legal evidence even for a legal-granted user. */
export async function loadApprovedBrochures(client: SupabaseClient) {
  await requireReleasedUser(client)
  const result = await client.from('vault_content_records').select('*').eq('kind', 'pdf').eq('approval', 'approved').in('classification', ['BRUCE_PRIVATE', 'COMMERCIAL']).order('id')
  if (result.error) throw new PrivateNarrativeError('unavailable', 'The private brochure collection is unavailable.')
  const documents = ((result.data ?? []) as ApprovedContent[]).map(row => {
    approved(row)
    if (row.kind !== 'pdf' || !['BRUCE_PRIVATE', 'COMMERCIAL'].includes(row.classification) || typeof row.payload.title !== 'string' || !row.payload.title.trim() || !row.storage_path || row.mime_type !== 'application/pdf') throw new Error('Invalid brochure response rejected')
    return row
  }).filter(row=>commercialDocumentVisible({title:String(row.payload.title),originalFilename:row.provenance.originalFilename}))
  if (!documents.length) return { documents, thumbnails: [] as ApprovedContent[] }
  const images = await client.from('vault_content_records').select('*').eq('kind', 'photograph').eq('approval', 'approved').in('classification', ['BRUCE_PRIVATE', 'COMMERCIAL']).order('id')
  if (images.error) throw new Error('Private cover metadata unavailable')
  const thumbnails = ((images.data ?? []) as ApprovedContent[]).filter(row => {
    const link = thumbnailReference(row.provenance?.sourceReference)
    if (!link) return false
    const parent = documents.find(document => document.id === link.parentId)
    return !!parent && row.kind === 'photograph' && row.approval === 'approved' && row.verification !== 'awaiting-verification' && row.classification === parent.classification && row.mime_type === 'image/png' && !!row.storage_path && link.parentSha256 === parent.sha256 && link.imageSha256 === row.sha256
  })
  return { documents, thumbnails }
}
