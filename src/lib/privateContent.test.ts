import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadApprovedSection, downloadApprovedAsset } from './privateContent'

function fixture(user: boolean, enabled: boolean, rows: unknown[] = []) {
  const from = vi.fn((table: string) => {
    const result = table.endsWith('settings') ? { data: { access_enabled: enabled }, error: null } : { data: rows, error: null }
    const query = { select: () => query, eq: () => query, single: async () => result, order: async () => result, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }) }
    return query
  })
  const download = vi.fn()
  const client = { auth: { getUser: async () => ({ data: { user: user ? { id: 'test', is_anonymous: false } : null }, error: null }) }, from, storage: { from: () => ({ download }) } } as unknown as SupabaseClient
  return { client, from, download }
}
describe('authenticated private content adapters', () => {
  it('performs no content query when unauthenticated', async () => {
    const f = fixture(false, true)
    await expect(loadApprovedSection(f.client, 'introduction')).rejects.toThrow(/Authenticated/)
    expect(f.from).not.toHaveBeenCalled()
  })
  it('fails closed while release is disabled', async () => {
    const f = fixture(true, false)
    await expect(loadApprovedSection(f.client, 'introduction')).rejects.toThrow(/disabled/)
    expect(f.from).not.toHaveBeenCalledWith('vault_content_records')
  })
  it('never downloads an object when metadata is inaccessible', async () => {
    const f = fixture(true, true)
    await expect(downloadApprovedAsset(f.client, 'unknown')).rejects.toThrow(/unavailable/)
    expect(f.download).not.toHaveBeenCalled()
  })
  it('returns no demo fallback when RLS returns no rows', async () => {
    const f = fixture(true, true)
    expect(await loadApprovedSection(f.client, 'introduction')).toEqual([])
  })
})
