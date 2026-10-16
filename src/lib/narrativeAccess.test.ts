import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadApprovedNarratives, type ApprovedNarrative } from './privateContent'

function narrative(): ApprovedNarrative {
  return { id: '11111111-1111-4111-8111-111111111111', section_id: 'introduction', kind: 'narrative', classification: 'BRUCE_PRIVATE', approval: 'approved', verification: 'reported', provenance: { originalFilename: 'synthetic.md', sourceDate: null, citation: 'Source Section 1; lines 10-20', sourceReference: 'sha256:synthetic', reviewedBy: 'Test owner', reviewedOn: '2026-10-15', conflictNote: null }, payload: { heading: 'Synthetic only', body: 'Exact fixture wording.\n\n  Indented paragraph. <script>fixture</script>' }, storage_path: null, sha256: null, mime_type: null }
}
function fixture(options: { gates?: boolean[]; granted?: boolean; user?: boolean; rows?: unknown[]; errorCode?: string } = {}) {
  const queries: { table: string; filters: [string, unknown][] }[] = []
  const from = vi.fn((table: string) => {
    const captured = { table, filters: [] as [string, unknown][] }; queries.push(captured)
    const result = table.endsWith('settings') ? { data: { access_enabled: options.gates?.[table === 'vault_settings' ? 0 : 1] ?? true }, error: null } : table === 'vault_content_grants' ? { data: options.granted === false ? null : { classification: 'BRUCE_PRIVATE' }, error: null } : { data: options.rows ?? [], error: options.errorCode ? { code: options.errorCode } : null }
    const query = { select: () => query, eq: (key: string, value: unknown) => { captured.filters.push([key, value]); return query }, single: async () => result, maybeSingle: async () => result, order: async () => result }
    return query
  })
  const download = vi.fn()
  const client = { auth: { getUser: async () => ({ data: { user: options.user === false ? null : { id: 'test', is_anonymous: false } }, error: null }) }, from, storage: { from: () => ({ download }) } } as unknown as SupabaseClient
  return { client, queries, download }
}
describe('narrative-only authenticated adapter', () => {
  it.each([[false, true], [true, false]])('blocks content queries when either release gate is disabled: %s %s', async (first, second) => {
    const mock = fixture({ gates: [first, second] })
    await expect(loadApprovedNarratives(mock.client, 'introduction')).rejects.toMatchObject({ code: 'release-disabled' })
    expect(mock.queries.some(query => query.table === 'vault_content_records')).toBe(false)
  })
  it('requires authentication and the exact Bruce-private grant', async () => {
    const anonymous = fixture({ user: false })
    await expect(loadApprovedNarratives(anonymous.client, 'introduction')).rejects.toMatchObject({ code: 'access-denied' })
    expect(anonymous.queries).toEqual([])
    const unassigned = fixture({ granted: false })
    await expect(loadApprovedNarratives(unassigned.client, 'introduction')).rejects.toMatchObject({ code: 'access-denied' })
    expect(unassigned.queries.some(query => query.table === 'vault_content_records')).toBe(false)
  })
  it('loads only approved narrative records without assets and preserves reported wording/provenance', async () => {
    const record = narrative(), mock = fixture({ rows: [record] })
    expect(await loadApprovedNarratives(mock.client, 'introduction')).toEqual([record])
    expect(mock.queries.find(query => query.table === 'vault_content_records')?.filters).toEqual(expect.arrayContaining([['kind', 'narrative'], ['classification', 'BRUCE_PRIVATE'], ['approval', 'approved'], ['section_id', 'introduction']]))
    expect(mock.download).not.toHaveBeenCalled()
  })
  it.each([{ approval: 'draft' }, { verification: 'awaiting-verification' }, { verification: 'disputed' }, { kind: 'financial' }, { classification: 'LEGAL_RESTRICTED' }, { section_id: 'closing' }, { provenance: { ...narrative().provenance, conflictNote: 'Unresolved' } }])('rejects unexpected or unresolved records: %o', async changes => {
    await expect(loadApprovedNarratives(fixture({ rows: [{ ...narrative(), ...changes }] }).client, 'introduction')).rejects.toMatchObject({ code: 'unavailable' })
  })
  it('distinguishes empty availability and explicit database denial without fallback', async () => {
    expect(await loadApprovedNarratives(fixture().client, 'introduction')).toEqual([])
    await expect(loadApprovedNarratives(fixture({ errorCode: '42501' }).client, 'introduction')).rejects.toMatchObject({ code: 'access-denied' })
  })
  it('preserves multiple narrative source order and rejects missing ordering metadata', async () => {
    const first = narrative(), second = { ...narrative(), id: '22222222-2222-4222-8222-222222222222', provenance: { ...narrative().provenance, citation: 'Source Section 1; lines 30-40' } }
    expect((await loadApprovedNarratives(fixture({ rows: [second, first] }).client, 'introduction')).map(record => record.id)).toEqual([first.id, second.id])
    second.provenance.citation = 'Unordered source'
    await expect(loadApprovedNarratives(fixture({ rows: [first, second] }).client, 'introduction')).rejects.toMatchObject({ code: 'unavailable' })
  })
})
