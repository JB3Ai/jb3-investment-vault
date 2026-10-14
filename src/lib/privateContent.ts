import type { SupabaseClient } from '@supabase/supabase-js'
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
async function requireReleasedUser(client: SupabaseClient) {
  const user = await client.auth.getUser()
  if (user.error || !user.data.user || user.data.user.is_anonymous) throw new Error('Authenticated access required')
  for (const table of ['vault_settings', 'vault_content_settings']) {
    const state = await client.from(table).select('access_enabled').eq('id', 1).single()
    if (state.error || state.data?.access_enabled !== true) throw new Error('Confidential release remains disabled')
  }
  return user.data.user.id
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
export async function downloadApprovedAsset(client: SupabaseClient, recordId: string) {
  await requireReleasedUser(client)
  const result = await client.from('vault_content_records').select('*').eq('id', recordId).eq('approval', 'approved').maybeSingle()
  if (result.error || !result.data) throw new Error('Asset unavailable for this account')
  const record = approved(result.data as ApprovedContent)
  if (!record.storage_path || !['pdf', 'photograph'].includes(record.kind)) throw new Error('Record has no downloadable asset')
  const file = await client.storage.from('vault-evidence').download(record.storage_path)
  if (file.error || !file.data) throw new Error('Private asset access denied')
  return { blob: file.data, record }
}
