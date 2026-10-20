import { thumbnailReference } from '../src/lib/thumbnailReference.ts'
/** Server-only. Never import this module from src/. No user/content cache. */
export interface GatewayEnv {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SECRET_KEY?: string
}
type Fetch = typeof globalThis.fetch
type Row = Record<string, unknown>
const project = 'https://uxeolplwhtyyefpmwktw.supabase.co'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const classes = ['BRUCE_PRIVATE', 'COMMERCIAL', 'LEGAL_RESTRICTED']
const limit = 26214400
const protection = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache', Expires: '0', Vary: 'Authorization',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
}
class Denial extends Error { constructor(readonly status: number) { super('Protected download unavailable') } }
function requireValue(value: unknown): asserts value { if (!value) throw new Denial(403) }
function current(row: Row | undefined) {
  return row?.active === true && (row.expires_at === null ||
    (typeof row.expires_at === 'string' && Date.parse(row.expires_at) > Date.now()))
}
function safePath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 1024 &&
    !/[\\%?#:\x00-\x1f\x7f]/.test(path) && path.split('/').every(s => s && s !== '.' && s !== '..')
}
interface Asset { bucket: string; path: string; mime: string; hash: string | null; parentId?:string; parentHash?:string }
/** The only accepted resource selector is a UUID; buckets/paths always come from RLS metadata. */
export async function downloadGateway(request: Request, env: GatewayEnv, fetcher: Fetch = fetch): Promise<Response> {
  const respond = (body: BodyInit | null, status: number, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers: { ...protection, ...headers } })
  try {
    const url = new URL(request.url)
    const match = /^\/api\/vault\/(assets|documents)\/([0-9a-f-]+)$/.exec(url.pathname)
    if (!match || !uuid.test(match[2]) || url.search) throw new Denial(404)
    if (!['GET', 'HEAD'].includes(request.method)) return respond(null, 405, { Allow: 'GET, HEAD' })
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) throw new Denial(403)
    const bearer = request.headers.get('Authorization')
    if (!bearer || !/^Bearer [A-Za-z0-9._-]+$/.test(bearer)) throw new Denial(401)
    if (env.SUPABASE_URL !== project || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY === env.SUPABASE_SECRET_KEY) throw new Denial(503)
    const storageHeaders: Record<string, string> = { apikey: env.SUPABASE_SECRET_KEY, 'Cache-Control': 'no-store' }
    // Opaque modern secret keys are API keys, not bearer JWTs. Legacy keys need both.
    if (!env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
      try {
        const parts = env.SUPABASE_SECRET_KEY.split('.')
        const payload = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')))
        if (parts.length !== 3 || !parts[2] || payload.role !== 'service_role' || payload.ref !== 'uxeolplwhtyyefpmwktw') throw new Error()
      } catch { throw new Denial(503) }
      storageHeaders.Authorization = `Bearer ${env.SUPABASE_SECRET_KEY}`
    }
    // Limit the entire operation, including both fresh authorization rounds and object buffering.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
    const userHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: bearer, 'Accept-Profile': 'public', 'Cache-Control': 'no-store' }
    async function userJson(path: string): Promise<unknown> {
      const res = await fetcher(`${project}${path}`, { headers: userHeaders, cache: 'no-store', redirect: 'error', signal })
      if (!res.ok) throw new Denial(res.status === 401 ? 401 : 403)
      // A cached identity or permission snapshot is not a fresh authorization decision.
      if (['HIT', 'STALE', 'UPDATING', 'REVALIDATED'].includes(res.headers.get('CF-Cache-Status')?.toUpperCase() ?? '') || Number(res.headers.get('Age')) > 0) throw new Denial(503)
      return res.json()
    }
    async function rows(table: string, query: string): Promise<Row[]> {
      const data = await userJson(`/rest/v1/${table}?${query}`)
      if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object')) throw new Denial(403)
      return data
    }
    async function one(table: string, query: string): Promise<Row> {
      const result = await rows(table, query)
      requireValue(result.length === 1)
      return result[0]
    }
    async function authorize(): Promise<Asset> {
      // Auth is verified remotely; no JWT payload/user_metadata is trusted as authorization.
      const user = await userJson('/auth/v1/user') as Row
      requireValue(typeof user?.id === 'string' && uuid.test(user.id) && user.is_anonymous === false)
      for (const table of ['vault_settings', 'vault_content_settings']) {
        requireValue((await one(table, 'select=access_enabled&id=eq.1')).access_enabled === true)
      }
      const id = match![2]
      if (match![1] === 'assets') {
        const r = await one('vault_content_records', `select=id,kind,classification,approval,verification,storage_path,sha256,mime_type,provenance&id=eq.${id}`)
        requireValue(r.id === id && r.approval === 'approved' && ['documented', 'reported', 'disputed'].includes(String(r.verification)) && classes.includes(String(r.classification)))
        const g = await one('vault_content_grants', `select=user_id,classification,active,expires_at&user_id=eq.${user.id}&classification=eq.${r.classification}`)
        requireValue(g.user_id === user.id && g.classification === r.classification && current(g))
        requireValue(typeof r.sha256 === 'string' && /^[a-f0-9]{64}$/.test(r.sha256) && r.storage_path === `${r.classification}/${id}/${r.sha256}`)
        requireValue((r.kind === 'pdf' && r.mime_type === 'application/pdf') || (r.kind === 'photograph' && ['image/jpeg', 'image/png', 'image/webp'].includes(String(r.mime_type))))
        const link=thumbnailReference((r.provenance as Row|undefined)?.sourceReference)
        if(link){
          requireValue(r.kind==='photograph'&&link.imageSha256===r.sha256)
          const parent=await one('vault_content_records',`select=id,kind,classification,approval,verification,storage_path,sha256,mime_type&id=eq.${link.parentId}`)
          requireValue(parent.id===link.parentId&&parent.kind==='pdf'&&parent.mime_type==='application/pdf'&&parent.approval==='approved'&&['documented','reported','disputed'].includes(String(parent.verification))&&parent.classification===r.classification&&parent.sha256===link.parentSha256&&parent.storage_path===`${parent.classification}/${link.parentId}/${link.parentSha256}`)
        }
        return { bucket: 'vault-evidence', path: r.storage_path as string, hash: r.sha256 as string, mime: r.mime_type as string,...(link?{parentId:link.parentId,parentHash:link.parentSha256}:{}) }
      }
      const m = await one('vault_memberships', `select=user_id,access_level,active,expires_at&user_id=eq.${user.id}`)
      requireValue(m.user_id === user.id && current(m) && ['PRIVATE', 'COMMERCIAL'].includes(String(m.access_level)))
      const d = await one('vault_documents', `select=id,section_id,disclosure,approved,storage_path&id=eq.${id}`)
      requireValue(d.id === id && typeof d.section_id === 'string' && ['PRIVATE', 'COMMERCIAL'].includes(String(d.disclosure)))
      const s = await one('vault_sections', `select=id,disclosure,approved&id=eq.${encodeURIComponent(d.section_id as string)}`)
      requireValue(s.id === d.section_id && ['PRIVATE', 'COMMERCIAL'].includes(String(s.disclosure)))
      // Preserve legacy PRIVATE membership's draft permission; commercial needs both approvals.
      requireValue(m.access_level === 'PRIVATE' || (d.disclosure === 'COMMERCIAL' && d.approved === true && s.disclosure === 'COMMERCIAL' && s.approved === true))
      requireValue(safePath(d.storage_path))
      return { bucket: 'vault-documents', path: d.storage_path as string, hash: null, mime: 'application/pdf' }
    }
    const asset = await authorize()
    // Fetch full bounded object so SHA-256 is checked even for range requests. No upstream URL is returned.
    const storage = await fetcher(`${project}/storage/v1/object/authenticated/${asset.bucket}/${asset.path.split('/').map(encodeURIComponent).join('/')}`, {
      headers: storageHeaders,
      cache: 'no-store', redirect: 'error', signal,
    })
    if (storage.status !== 200 || !storage.body || (Number(storage.headers.get('Content-Length')) > limit)) throw new Denial(502)
    const reader = storage.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > limit) throw new Denial(502)
        chunks.push(value)
      }
    } finally { await reader.cancel() }
    requireValue(size > 0)
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    if (asset.hash) {
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
      requireValue(digest === asset.hash)
    }
    const final = await authorize()
    requireValue(JSON.stringify(final) === JSON.stringify(asset))
    if (signal.aborted) throw new Denial(503)
    let start = 0, end = size - 1, status = 200
    const range = request.headers.get('Range')
    if (range) {
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!parts || (!parts[1] && !parts[2])) return respond(null, 416, { 'Content-Range': `bytes */${size}` })
      start = parts[1] ? Number(parts[1]) : Math.max(0, size - Number(parts[2]))
      end = parts[1] ? (parts[2] ? Math.min(Number(parts[2]), size - 1) : size - 1) : size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!parts[1] && Number(parts[2]) === 0)) return respond(null, 416, { 'Content-Range': `bytes */${size}` })
      status = 206
    }
    return respond(request.method === 'HEAD' ? null : status === 206 ? bytes.slice(start, end + 1) : bytes, status, {
      'Content-Type': asset.mime, 'Content-Disposition': 'inline', 'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1), ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    })
  } catch (error) {
    // Do not echo upstream responses, identities, object paths, JWTs or credentials.
    return respond(null, error instanceof Denial ? error.status : 503)
  }
}
