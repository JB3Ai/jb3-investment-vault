import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { protectedDownload } from './protectedDownloads'
const id = '10000000-0000-4000-8000-000000000001'
const noStore = 'private, no-store, max-age=0, must-revalidate'
const session = (token: string | null) => ({ data: { session: token ? { access_token: token } : null }, error: null })
afterEach(() => vi.unstubAllGlobals())
describe('protected PDF/image browser transport', { timeout: 30000 }, () => {
  it.each(['assets', 'documents'] as const)('uses only UUID %s endpoint, header Auth and no-store', async kind => {
    const getSession = vi.fn().mockResolvedValue(session('synthetic-token'))
    const fetcher = vi.fn().mockResolvedValue(new Response('synthetic', { headers: { 'Cache-Control': noStore } }))
    vi.stubGlobal('fetch', fetcher)
    const blob = await protectedDownload({ auth: { getSession } } as unknown as SupabaseClient, kind, id)
    expect(await blob.text()).toBe('synthetic')
    expect(fetcher).toHaveBeenCalledWith(`/api/vault/${kind}/${id}`, expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-token' }, cache: 'no-store', credentials: 'omit', redirect: 'error' }))
  })
  it('discards an in-flight download after sign-out or a token change', async () => {
    const getSession = vi.fn().mockResolvedValueOnce(session('synthetic-token')).mockResolvedValueOnce(session(null))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('synthetic', { headers: { 'Cache-Control': noStore } })))
    await expect(protectedDownload({ auth: { getSession } } as unknown as SupabaseClient, 'assets', id)).rejects.toThrow(/Session changed/)
  })
  it('rejects a cached/non-protected response and has no Storage fallback', async () => {
    const getSession = vi.fn().mockResolvedValue(session('synthetic-token'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('synthetic', { headers: { 'Cache-Control': 'public, max-age=3600' } })))
    await expect(protectedDownload({ auth: { getSession } } as unknown as SupabaseClient, 'documents', id)).rejects.toThrow(/denied/)
  })
})
