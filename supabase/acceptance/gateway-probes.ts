// Operator-only, side-effect-free probes. Importing this module performs no I/O.
import { createHash } from 'node:crypto'

export const GATEWAY_ORIGIN = 'https://jb3-private-investment-vault.jono-18a.workers.dev'
export const PROJECT_URL = 'https://uxeolplwhtyyefpmwktw.supabase.co'
export const GUARD_SHA256 = '4580938cf404d1552a7c75f46bb84b27b27908b5c8e694b3be0e93cf4894f57d'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const assert = (ok: unknown, code: string): void => { if (!ok) throw new Error(code) }
type Policy = { schemaname: string; tablename: string; policyname: string; permissive: string; cmd: string; roles: string[]; qual: string; with_check: string | null }
export function exactStorageGuard(policies: Policy[]): boolean {
  const found = policies.filter(p => p.policyname === 'Vault downloads require trusted gateway')
  if (found.length !== 1) return false
  const p = found[0]
  const expression = p.qual?.replace(/::text|[\s()]/g, '')
  return p.schemaname === 'storage' && p.tablename === 'objects' && p.permissive === 'RESTRICTIVE' && p.cmd === 'SELECT' && p.with_check === null &&
    JSON.stringify([...p.roles].sort()) === JSON.stringify(['anon', 'authenticated']) &&
    expression === "bucket_id<>ALLARRAY['vault-documents','vault-evidence']"
}
interface SessionClient { auth: { getSession(): Promise<{ data: { session: { access_token: string } | null }; error?: unknown }> } }
export interface TestAsset { bucket: string; path: string; hash: string; recordId?: string; documentId?: string; syntheticRun?: string; size?: number; mimeType?: string }
export interface Observation { status: number; bytes: number; bytesReturned: boolean; hashMatches: boolean; headersSafe: boolean; cacheStatus: string }
interface ProbeOptions {
  origin?: string; key: string; runId: string; owned: TestAsset[]; fetcher?: typeof fetch;
  privilegedHeaders: Record<string, string>;
  sign: (item: TestAsset) => Promise<string>;
  observe: (id: string, passed: boolean, expected: Record<string, unknown>, actual: Record<string, unknown>) => Promise<void>;
  now?: () => number; wait?: (ms: number) => Promise<void>;
}
export function gatewayHeadersSafe(h: Headers): boolean {
  // Cloudflare consumes its own CDN header; its absence at the browser is expected.
  return h.get('Cache-Control') === 'private, no-store, max-age=0, must-revalidate' && h.get('CDN-Cache-Control') === 'no-store' &&
    (!h.has('Cloudflare-CDN-Cache-Control') || h.get('Cloudflare-CDN-Cache-Control') === 'no-store') &&
    h.get('Pragma') === 'no-cache' && h.get('Expires') === '0' &&
    (h.get('Vary') ?? '').toLowerCase().split(/,\s*/).includes('authorization') &&
    !['Location', 'ETag', 'Last-Modified', 'Set-Cookie', 'apikey', 'Authorization'].some(name => h.has(name)) &&
    (!h.has('Age') || h.get('Age') === '0') &&
    !['HIT', 'STALE', 'UPDATING', 'REVALIDATED', 'EXPIRED'].includes((h.get('CF-Cache-Status') ?? '').toUpperCase())
}
async function body(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader(), chunks: Uint8Array[] = []
  let size = 0
  if (reader) try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      size += part.value.byteLength; assert(size <= 26214400, 'probe-response-too-large'); chunks.push(part.value)
    }
  } finally { await reader.cancel() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}
export function createGatewayProbes(options: ProbeOptions) {
  const origin = options.origin ?? GATEWAY_ORIGIN
  assert(origin === GATEWAY_ORIGIN, 'gateway-origin-mismatch')
  assert(uuid.test(options.runId), 'invalid-synthetic-run')
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now
  const wait = options.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const histories: { url: string; item: TestAsset; signed: boolean; warmed: boolean; expires?: number }[] = []
  async function report(id: string, passed: boolean, expected: Record<string, unknown>, actual: Record<string, unknown>) {
    await options.observe(id, passed, expected, actual)
    assert(passed, `assertion-failed:${id}`)
  }
  function own(item: TestAsset) {
    assert(options.owned.includes(item) && item.syntheticRun === options.runId && /^[a-f0-9]{64}$/.test(item.hash), 'non-owned-probe-object')
    assert(['vault-documents', 'vault-evidence'].includes(item.bucket), 'non-vault-probe-bucket')
    const canonical = /^(BRUCE_PRIVATE|COMMERCIAL|LEGAL_RESTRICTED)\/[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(item.path)
    assert(canonical || item.path.startsWith(`synthetic-${options.runId}/`) && !/\.\.|[\\%?#:]/.test(item.path), 'non-synthetic-probe-path')
  }
  function encoded(item: TestAsset) { own(item); return `${item.bucket}/${item.path.split('/').map(encodeURIComponent).join('/')}` }
  async function request(url: string, init: RequestInit = {}) {
    try { return await fetcher(url, { ...init, cache: init.cache ?? 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) }) }
    catch { throw new Error('probe-transport-failed') }
  }
  async function bearer(client: SessionClient): Promise<Record<string, string>> {
    const session = await client.auth.getSession(); assert(!session.error, 'probe-session-unavailable')
    const token = session.data.session?.access_token
    if (token) {
      let role: unknown
      try { role = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role } catch { /* opaque synthetic test token */ }
      assert(!token.startsWith('sb_secret_') && !token.startsWith('sbp_') && role !== 'service_role', 'privileged-gateway-token-rejected')
    }
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  async function gateway(client: SessionClient, item: TestAsset, opts: { method?: 'GET' | 'HEAD'; range?: string; conditional?: boolean } = {}) {
    own(item)
    const id = item.recordId ?? item.documentId ?? '00000000-0000-4000-8000-000000000000'
    assert(uuid.test(id), 'invalid-gateway-record-id')
    const response = await request(`${origin}/api/vault/${item.bucket === 'vault-documents' ? 'documents' : 'assets'}/${id}`, {
      method: opts.method ?? 'GET', headers: { ...await bearer(client), ...(opts.range ? { Range: opts.range } : {}), ...(opts.conditional ? { 'If-None-Match': '*', 'If-Modified-Since': 'Wed, 01 Jan 2025 00:00:00 GMT' } : {}) },
    })
    const bytes = await body(response)
    return { observation: { status: response.status, bytes: bytes.length, bytesReturned: response.ok && bytes.length > 0, hashMatches: digest(bytes) === item.hash, headersSafe: gatewayHeadersSafe(response.headers), cacheStatus: response.headers.get('CF-Cache-Status') ?? 'unknown' } satisfies Observation, response, bytes }
  }
  async function checkGateway(id: string, client: SessionClient, item: TestAsset, denied: boolean) {
    const { observation: a } = await gateway(client, item)
    await report(id, a.headersSafe && (denied ? [401, 403, 404].includes(a.status) && a.bytes === 0 : a.status === 200 && a.hashMatches && a.bytes === item.size),
      { allowed: !denied, bytes: denied ? 0 : item.size, headersSafe: true }, a)
  }
  async function directDenied(id: string, client: SessionClient, item: TestAsset) {
    const suffix = encoded(item), headers = { apikey: options.key, ...await bearer(client) }
    const routes = [`object/${suffix}`, `object/authenticated/${suffix}`, `object/public/${suffix}`]
    if (item.mimeType?.startsWith('image/')) routes.push(`render/image/authenticated/${suffix}?width=1`)
    for (const [i, route] of routes.entries()) {
      const r = await request(`${PROJECT_URL}/storage/v1/${route}`, { headers, cache: 'default' }), bytes = await body(r)
      await report(`${id}.route${i}`, [400, 401, 403, 404].includes(r.status) && !(r.ok && bytes.length), { allowed: false }, { status: r.status, bytesReturned: r.ok && !!bytes.length, cacheStatus: r.headers.get('CF-Cache-Status') ?? 'unknown' })
    }
    const signed = await request(`${PROJECT_URL}/storage/v1/object/sign/${suffix}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 2 }) })
    const bytes = await body(signed)
    let issued = false
    try { const json = JSON.parse(Buffer.from(bytes).toString()); issued = !!(json.signedURL || json.signedUrl || json.token) } catch { /* no capability */ }
    await report(`${id}.sign`, [400, 401, 403, 404].includes(signed.status) && !issued, { allowed: false }, { status: signed.status, allowed: issued })
  }
  async function protocol(id: string, client: SessionClient, item: TestAsset) {
    await checkGateway(`${id}.get`, client, item, false)
    const head = await gateway(client, item, { method: 'HEAD' })
    await report(`${id}.head`, head.observation.status === 200 && head.observation.bytes === 0 && head.observation.headersSafe && head.response.headers.get('Content-Length') === String(item.size), { status: 200, bytes: 0, headersSafe: true }, head.observation)
    const range = await gateway(client, item, { range: 'bytes=0-3' })
    const prefix = item.mimeType === 'application/pdf' ? '%PDF' : '\u0089PNG'
    await report(`${id}.range`, range.observation.status === 206 && range.observation.bytes === 4 && range.observation.headersSafe && Buffer.from(range.bytes).toString('latin1') === prefix && range.response.headers.get('Content-Range') === `bytes 0-3/${item.size}`, { status: 206, bytes: 4, headersSafe: true }, range.observation)
    const conditional = await gateway(client, item, { conditional: true })
    await report(`${id}.conditional`, conditional.observation.status === 200 && conditional.observation.hashMatches && conditional.observation.headersSafe, { status: 200, headersSafe: true }, conditional.observation)
  }
  async function denyProtocol(id: string, client: SessionClient, item: TestAsset) {
    for (const [label, opts] of Object.entries({ get: {}, head: { method: 'HEAD' as const }, range: { range: 'bytes=0-3' }, conditional: { conditional: true } })) {
      const { observation: a } = await gateway(client, item, opts)
      await report(`${id}.${label}`, [401, 403, 404].includes(a.status) && a.bytes === 0 && a.headersSafe, { allowed: false, bytes: 0, headersSafe: true }, a)
    }
  }
  async function warmHistory(id: string, item: TestAsset) {
    const suffix = encoded(item)
    for (const [i, route] of [`object/${suffix}`, `object/authenticated/${suffix}`].entries()) {
      const url = `${PROJECT_URL}/storage/v1/${route}`
      let warmed = false
      for (let n = 0; n < 2; n++) {
        const r = await request(url, { headers: options.privilegedHeaders, cache: 'default' }), bytes = await body(r)
        await report(`${id}.prime${i}_${n}`, r.status === 200 && digest(bytes) === item.hash, { status: 200, hashMatches: true }, { status: r.status, hashMatches: digest(bytes) === item.hash })
        warmed ||= r.headers.get('CF-Cache-Status')?.toUpperCase() === 'HIT' || Number(r.headers.get('Age')) > 0
      }
      histories.push({ url, item, signed: false, warmed })
    }
    // Only the operator creates a short synthetic capability, never the application.
    const signedUrl = new URL(await options.sign(item))
    assert(signedUrl.origin === PROJECT_URL && signedUrl.pathname === `/storage/v1/object/sign/${suffix}` && [...signedUrl.searchParams.keys()].every(k => k === 'token'), 'unexpected-signed-fixture-url')
    let expires: number
    try { expires = JSON.parse(Buffer.from(signedUrl.searchParams.get('token')!.split('.')[1], 'base64url').toString()).exp * 1000 } catch { throw new Error('synthetic-expiry-unreadable') }
    assert(Number.isFinite(expires) && expires > now() - 5000 && expires < now() + 10000, 'synthetic-expiry-clock-out-of-range')
    let warmed = false
    for (let n = 0; n < 2; n++) {
      const r = await request(signedUrl.href, { cache: 'default' }), bytes = await body(r)
      await report(`${id}.signed_prime${n}`, r.status === 200 && digest(bytes) === item.hash, { status: 200, hashMatches: true }, { status: r.status, hashMatches: digest(bytes) === item.hash })
      warmed ||= r.headers.get('CF-Cache-Status')?.toUpperCase() === 'HIT' || Number(r.headers.get('Age')) > 0
    }
    histories.push({ url: signedUrl.href, item, signed: true, warmed, expires })
  }
  async function historyDenied(id: string, client: SessionClient, afterDeletion = false) {
    assert(histories.length > 0, 'cache-history-not-prepared')
    for (const [i, h] of histories.entries()) {
      if (h.signed) { const delay = Math.max(0, h.expires! + 2000 - now()); assert(delay <= 12000, 'synthetic-expiry-wait-out-of-range'); if (delay) await wait(delay) }
      const r = await request(h.url, { headers: h.signed ? {} : { apikey: options.key, ...await bearer(client) }, cache: 'default' }), bytes = await body(r)
      await report(`${id}.historical${i}`, [400, 401, 403, 404].includes(r.status) && !(r.ok && bytes.length), { allowed: false }, { status: r.status, bytesReturned: r.ok && !!bytes.length, cacheStatus: r.headers.get('CF-Cache-Status') ?? 'unknown' })
    }
    // No observed cache HIT is an inconclusive challenge, never an overall PASS.
    if (afterDeletion) await report(`${id}.cache_was_observed`, histories.some(h => h.warmed), { prewarmed: true }, { prewarmed: histories.some(h => h.warmed) })
  }
  return { gateway, checkGateway, directDenied, protocol, denyProtocol, warmHistory, historyDenied, historyCount: () => histories.length }
}
