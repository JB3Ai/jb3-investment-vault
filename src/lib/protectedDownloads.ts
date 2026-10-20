import type { SupabaseClient } from '@supabase/supabase-js'
/** No signed URLs, object paths or direct Storage fallback. Auth stays in a request header. */
export async function protectedDownload(client: SupabaseClient, kind: 'assets' | 'documents', id: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('Protected asset unavailable')
  const session = await client.auth.getSession()
  const token = session.data.session?.access_token
  if (session.error || !token) throw new Error('Authenticated access required')
  const response = await fetch(`/api/vault/${kind}/${id}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
  })
  if (!response.ok || response.status !== 200 || response.headers.get('Cache-Control') !== 'private, no-store, max-age=0, must-revalidate') throw new Error('Protected asset access denied')
  const blob = await response.blob()
  const current = await client.auth.getSession()
  if (signal?.aborted || current.error || current.data.session?.access_token !== token) throw new Error('Session changed; retry protected download')
  return blob
}
