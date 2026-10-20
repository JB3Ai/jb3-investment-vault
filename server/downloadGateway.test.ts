import { describe, expect, it, vi } from 'vitest'
import { downloadGateway } from './downloadGateway'
import worker from './worker'

const id = '10000000-0000-4000-8000-000000000001'
const users = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002']
const env = { SUPABASE_URL: 'https://uxeolplwhtyyefpmwktw.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'synthetic-public', SUPABASE_SECRET_KEY: 'sb_secret_synthetic-fixture-only' }
const bytes = new TextEncoder().encode('%PDF-1.4 synthetic gateway fixture')
const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')
function fixture(content = bytes, objectHash = hash) {
  const state = {
    gates: [true, true], active: true, expires: null as string | null, membership: true,
    anonymous: false, approval: 'approved', classification: 'BRUCE_PRIVATE', kind: 'pdf', mime: 'application/pdf',
    memberRole: 'PRIVATE', parentApproved: true, documentApproved: true, documentClass: 'COMMERCIAL',
    path: `BRUCE_PRIVATE/${id}/${objectHash}`, hash: objectHash, objectStatus: 200, badHash: false,
    legacyPath: 'synthetic/test.pdf', backendFailure: false, cachedMetadata: false, unassigned: false, adminKey: env.SUPABASE_SECRET_KEY,
    afterStorage: () => {},
  }
  const calls: { path: string; token: string; cache: RequestCache | undefined }[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), h = new Headers(init?.headers), token = h.get('Authorization') ?? ''
    calls.push({ path: url.pathname, token, cache: init?.cache })
    if (state.backendFailure) throw new Error('upstream sensitive detail must never be echoed')
    if (url.pathname.includes('/storage/')) {
      expect(h.get('apikey')).toBe(state.adminKey)
      expect(h.get('Authorization')).toBe(state.adminKey.startsWith('sb_secret_') ? null : `Bearer ${state.adminKey}`)
      state.afterStorage()
      return new Response(state.badHash ? 'wrong file' : content, { status: state.objectStatus, headers: { 'cf-cache-status': 'HIT', 'Cache-Control': 'public, max-age=3600', ETag: 'upstream-must-not-escape' } })
    }
    expect(h.get('apikey')).toBe(env.SUPABASE_PUBLISHABLE_KEY)
    expect(h.get('Accept-Profile')).toBe('public')
    const user = token === 'Bearer second' ? users[1] : users[0]
    let data: unknown
    switch (url.pathname.split('/').at(-1)) {
      case 'user': return Response.json({ id: user, is_anonymous: state.anonymous }, { status: token === 'Bearer invalid' ? 401 : 200 })
      case 'vault_settings': data = [{ access_enabled: state.gates[0] }]; break
      case 'vault_content_settings': data = [{ access_enabled: state.gates[1] }]; break
      case 'vault_content_records': data = [{ id, approval: state.approval, verification: 'documented', classification: state.classification, kind: state.kind, mime_type: state.mime, storage_path: state.path, sha256: state.hash }]; break
      case 'vault_content_grants': data = state.unassigned ? [] : [{ user_id: user, classification: token === 'Bearer legal' ? 'LEGAL_RESTRICTED' : token === 'Bearer second' ? 'COMMERCIAL' : 'BRUCE_PRIVATE', active: state.active, expires_at: state.expires }]; break
      case 'vault_memberships': data = state.membership ? [{ user_id: user, active: state.active, expires_at: state.expires, access_level: state.memberRole }] : []; break
      case 'vault_documents': data = [{ id, section_id: 'history-evidence', disclosure: state.documentClass, approved: state.documentApproved, storage_path: state.legacyPath }]; break
      case 'vault_sections': data = [{ id: 'history-evidence', disclosure: state.documentClass, approved: state.parentApproved }]; break
      default: throw new Error('Unexpected endpoint')
    }
    return Response.json(data, { headers: state.cachedMetadata ? { 'CF-Cache-Status': 'HIT', Age: '3' } : {} })
  }) as unknown as typeof fetch
  const request = (options: { kind?: string; token?: string; range?: string; method?: string; extra?: Record<string, string> } = {}) => new Request(`https://vault.example/api/vault/${options.kind ?? 'assets'}/${id}`, {
    method: options.method ?? 'GET', headers: { Authorization: `Bearer ${options.token ?? 'bruce'}`, ...(options.range ? { Range: options.range } : {}), ...options.extra },
  })
  const run = (options?: Parameters<typeof request>[0]) => downloadGateway(request(options), { ...env, SUPABASE_SECRET_KEY: state.adminKey }, fetcher)
  const reads = () => calls.filter(c => c.path.includes('/storage/')).length
  return { state, calls, fetcher, request, run, reads }
}
function uncached(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
  for (const h of ['CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) expect(response.headers.get(h)).toBe('no-store')
  expect(response.headers.get('Vary')).toBe('Authorization')
  for (const h of ['ETag', 'Last-Modified', 'Location', 'cf-cache-status', 'Access-Control-Allow-Origin']) expect(response.headers.has(h)).toBe(false)
}
describe('protected gateway: local HTTP contracts, no hosted mutations', { timeout: 30000 }, () => {
  it('checks Auth and public-schema metadata twice; only the server reads a bound object', async () => {
    const f = fixture(), response = await f.run()
    expect(response.status).toBe(200); expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(f.calls.filter(c => c.path.endsWith('/user'))).toHaveLength(2)
    expect(f.reads()).toBe(1); expect(f.calls.every(c => c.cache === 'no-store')).toBe(true)
    uncached(response)
  })
  it('supports legacy service-role JWTs but rejects other roles and projects', async () => {
    const f = fixture()
    const key = (role: string, ref = 'uxeolplwhtyyefpmwktw') => `${btoa('{}')}.${btoa(JSON.stringify({ role, ref }))}.synthetic-signature`
    f.state.adminKey = key('service_role'); expect((await f.run()).status).toBe(200)
    f.state.adminKey = key('authenticated'); expect((await f.run()).status).toBe(503)
    f.state.adminKey = key('service_role', 'wrong-project'); expect((await f.run()).status).toBe(503)
  })
  it.each(['BRUCE_PRIVATE', 'COMMERCIAL', 'LEGAL_RESTRICTED'])('does not widen exact grants to %s', async classification => {
    const f = fixture(); f.state.classification = classification; f.state.path = `${classification}/${id}/${hash}`
    expect((await f.run()).status).toBe(classification === 'BRUCE_PRIVATE' ? 200 : 403)
  })
  it.each([['COMMERCIAL', 'second'], ['LEGAL_RESTRICTED', 'legal']])('allows an approved %s asset only with the matching grant', async (classification, token) => {
    const f = fixture(); f.state.classification = classification; f.state.path = `${classification}/${id}/${hash}`
    expect((await f.run({ token })).status).toBe(200)
  })
  it.each(['expired', 'revoked'])('denies %s grants before any Storage access', async reason => {
    const f = fixture()
    if (reason === 'expired') f.state.expires = new Date(Date.now() - 1000).toISOString()
    else f.state.active = false
    expect((await f.run()).status).toBe(403); expect(f.reads()).toBe(0)
  })
  it.each([[false, false], [false, true], [true, false]])('denies both protected routes with gate state %j/%j', async (a, b) => {
    const f = fixture(); f.state.gates = [a, b]
    for (const kind of ['assets', 'documents']) { const res = await f.run({ kind }); expect(res.status).toBe(403); uncached(res) }
    expect(f.reads()).toBe(0)
  })
  it('denies missing, anonymous and invalid authentication', async () => {
    const f = fixture()
    expect((await downloadGateway(new Request(`https://vault.example/api/vault/assets/${id}`), env, f.fetcher)).status).toBe(401)
    f.state.anonymous = true; expect((await f.run()).status).toBe(403)
    expect((await f.run({ token: 'invalid' })).status).toBe(401); expect(f.reads()).toBe(0)
  })
  it('rejects unassigned users and cached permission snapshots', async () => {
    const f = fixture(); f.state.unassigned = true
    expect((await f.run()).status).toBe(403)
    f.state.unassigned = false; f.state.cachedMetadata = true
    expect((await f.run()).status).toBe(503); expect(f.reads()).toBe(0)
  })
  it('denies drafts, wrong MIME/kind, path substitution and digest mismatches', async () => {
    for (const change of [{ approval: 'draft' }, { kind: 'narrative' }, { mime: 'text/html' }, { path: 'another/file.pdf' }, { badHash: true }]) {
      const f = fixture(); Object.assign(f.state, change)
      expect((await f.run()).status).toBe(403)
    }
  })
  it('preserves permitted legacy rules and rejects revoked, expired or absent memberships', async () => {
    const f = fixture(); f.state.documentApproved = false
    expect((await f.run({ kind: 'documents' })).status).toBe(200)
    f.state.memberRole = 'COMMERCIAL'; expect((await f.run({ kind: 'documents' })).status).toBe(403)
    f.state.documentApproved = true; expect((await f.run({ kind: 'documents' })).status).toBe(200)
    f.state.parentApproved = false; expect((await f.run({ kind: 'documents' })).status).toBe(403)
    f.state.memberRole = 'PRIVATE'; f.state.active = false; expect((await f.run({ kind: 'documents' })).status).toBe(403)
    f.state.active = true; f.state.expires = new Date(Date.now() - 1).toISOString(); expect((await f.run({ kind: 'documents' })).status).toBe(403)
    f.state.expires = null; f.state.membership = false; expect((await f.run({ kind: 'documents' })).status).toBe(403)
  })
  it('rejects unsafe legacy paths', async () => {
    for (const path of ['../test', '/test', 'a//test', 'a/%2e%2e/test', 'https://example/file', 'a\\test', 'a?x=1']) {
      const f = fixture(); f.state.legacyPath = path
      expect((await f.run({ kind: 'documents' })).status).toBe(403); expect(f.reads()).toBe(0)
    }
  })
  it.each(['grant', 'membership', 'gate', 'metadata'])('discards buffered bytes when %s changes during retrieval', async reason => {
    const f = fixture(); f.state.afterStorage = () => {
      if (reason === 'grant') f.state.active = false
      if (reason === 'membership') f.state.membership = false
      if (reason === 'gate') f.state.gates[1] = false
      if (reason === 'metadata') f.state.path = `COMMERCIAL/${id}/${hash}`
    }
    const res = await f.run({ kind: reason === 'membership' ? 'documents' : 'assets' })
    expect(res.status).toBe(403); expect(await res.text()).toBe('')
  })
  it.each(['bytes=0-3', 'bytes=5-', 'bytes=-4'])('reauthorizes each range %s', async range => {
    const f = fixture(), res = await f.run({ range })
    expect(res.status).toBe(206); uncached(res)
    expect(res.headers.get('Content-Range')).toMatch(new RegExp(`^bytes \\d+-\\d+/${bytes.length}$`))
    f.state.active = false
    expect((await f.run({ range })).status).toBe(403); expect(f.reads()).toBe(1)
  })
  it.each(['bytes=0-1,3-4', 'bytes=-0', 'bytes=999-', 'bytes=2-1', 'junk'])('rejects unsupported range %s without bytes', async range => {
    const f = fixture(), res = await f.run({ range })
    expect(res.status).toBe(416); expect(await res.text()).toBe(''); uncached(res)
  })
  it('ignores conditional cache validators and never reuses authorized bytes after revocation', async () => {
    const f = fixture()
    const res = await f.run({ extra: { 'If-None-Match': 'old', 'If-Modified-Since': new Date().toUTCString() } })
    expect(res.status).toBe(200); uncached(res)
    f.state.active = false
    expect((await f.run()).status).toBe(403); expect(f.reads()).toBe(1)
  })
  it('isolates concurrent users, including a revoked request during a shared cached object read', async () => {
    const f = fixture()
    const responses = await Promise.all([f.run(), f.run({ token: 'second' }), f.run(), f.run({ token: 'second' })])
    expect(responses.map(r => r.status)).toEqual([200, 403, 200, 403]); expect(f.reads()).toBe(2)
  })
  it('fails closed on missing/wrong project configuration, backend faults and unexpected storage responses', async () => {
    const f = fixture()
    expect((await downloadGateway(f.request(), { ...env, SUPABASE_SECRET_KEY: undefined }, f.fetcher)).status).toBe(503)
    expect((await downloadGateway(f.request(), { ...env, SUPABASE_URL: 'https://wrong.supabase.co' }, f.fetcher)).status).toBe(503)
    f.state.backendFailure = true
    const res = await f.run(); expect(res.status).toBe(503); expect(await res.text()).toBe(''); uncached(res)
    f.state.backendFailure = false; f.state.objectStatus = 302; expect((await f.run()).status).toBe(502)
  })
  it('supports HEAD without bytes and rejects client writes, cross-origin requests and arbitrary selectors', async () => {
    const f = fixture(), head = await f.run({ method: 'HEAD' })
    expect(head.status).toBe(200); expect(await head.text()).toBe(''); uncached(head)
    expect((await f.run({ method: 'POST' })).status).toBe(405)
    expect((await f.run({ extra: { Origin: 'https://foreign.example' } })).status).toBe(403)
    expect((await downloadGateway(new Request(`https://vault.example/api/vault/assets/${id}?bucket=media&path=other`), env, f.fetcher)).status).toBe(404)
  })
  it('runs API routes before SPA assets; unknown API requests never fall through', async () => {
    const assets = { fetch: vi.fn(async () => new Response('public shell')) }
    expect((await worker.fetch(new Request('https://vault.example/api/vault/unknown'), { ASSETS: assets })).status).toBe(404)
    expect(assets.fetch).not.toHaveBeenCalled()
    expect(await (await worker.fetch(new Request('https://vault.example/'), { ASSETS: assets })).text()).toBe('public shell')
  })
  it('serves hash-verified photograph bytes through the same protected boundary', async () => {
    const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'))
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png)), n => n.toString(16).padStart(2, '0')).join('')
    const f = fixture(png, digest); f.state.kind = 'photograph'; f.state.mime = 'image/png'
    const response = await f.run()
    expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png); uncached(response)
    f.state.active = false; expect((await f.run({ range: 'bytes=0-3' })).status).toBe(403)
  })

})
