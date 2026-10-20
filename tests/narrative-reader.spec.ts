import { test, expect, type Page } from '@playwright/test'
import { createDemoPdf } from '../src/lib/demoPdf'

const accountId = '00000000-0000-4000-8000-000000000001'
const body = 'Synthetic approved fixture only.\n\n  Preserve this paragraph.\n<script>window.fixtureExecuted=true</script>'
const pendingResponses = new WeakMap<Page, () => void>()
test.afterEach(({ page }) => { pendingResponses.get(page)?.() })
async function setup(page: Page, options: { granted?: boolean; released?: boolean; empty?: boolean; delayed?: boolean; financialSection?: boolean; documents?: boolean } = {}) {
  // Intro presentation state never substitutes for fixture authentication.
  await page.addInitScript(() => sessionStorage.setItem('vaultLandingShown', 'true'))
  let releaseResponse: (() => void) | undefined
  const waiting = new Promise<void>(resolve => { releaseResponse = resolve })
  pendingResponses.set(page, () => releaseResponse!())
  let recordRequests = 0, tokenRequests = 0
  const sectionId = options.financialSection ? 'financial-requirements' : 'introduction'
  const sectionTitle = options.financialSection ? 'Financial Requirements' : 'Introduction'
  const user = { id: accountId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: '2026-10-15T00:00:00Z' }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: accountId, aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.synthetic-signature`
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url())
    let response: unknown
    if (url.pathname === '/auth/v1/token') { tokenRequests++; response = { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user } }
    else if (url.pathname === '/auth/v1/user') response = user
    else if (url.pathname === '/auth/v1/logout') response = {}
    else if (url.pathname.endsWith('/vault_memberships')) response = { access_level: 'PRIVATE' }
    else if (url.pathname.endsWith('/vault_settings')) response = { access_enabled: true }
    else if (url.pathname.endsWith('/vault_content_settings')) response = { access_enabled: options.released !== false }
    else if (url.pathname.endsWith('/vault_content_grants')) response = options.granted === false ? null : { classification: 'BRUCE_PRIVATE' }
    else if (url.pathname.endsWith('/vault_documents')) response = options.documents ? [{ id: '11111111-1111-4111-8111-111111111111', title: 'Synthetic protected PDF', section_id: sectionId, disclosure: 'PRIVATE', verification: 'PENDING', storage_path: 'synthetic/not-a-browser-selector.pdf' }] : []
    else if (url.pathname.endsWith('/vault_sections')) response = [{ id: sectionId, number: options.financialSection ? 5 : 1, title: sectionTitle, subtitle: 'Synthetic reader fixture.', overview: 'Synthetic section metadata only.', disclosure: 'PRIVATE', verification: 'PENDING', updated_at: '2026-10-15', narrative: [{ heading: 'Legacy heading', body: 'Legacy narrative must stay hidden.' }], evidence: [], images: [], documents: [] }]
    else if (url.pathname.endsWith('/vault_content_records')) {
      recordRequests += 1
      expect(url.searchParams.get('kind')).toBe('eq.narrative')
      expect(url.searchParams.get('approval')).toBe('eq.approved')
      expect(url.searchParams.get('classification')).toBe('eq.BRUCE_PRIVATE')
      if (options.delayed) await waiting
      response = options.empty ? [] : [{ id: '11111111-1111-4111-8111-111111111111', section_id: sectionId, kind: 'narrative', classification: 'BRUCE_PRIVATE', approval: 'approved', verification: 'reported', payload: { heading: 'Approved synthetic narrative', body }, provenance: { originalFilename: 'synthetic-source.md', sourceDate: null, citation: 'Source Section 1; lines 10-20', sourceReference: 'sha256:' + 'a'.repeat(64), reviewedBy: 'Synthetic owner', reviewedOn: '2026-10-15', conflictNote: null }, storage_path: null, sha256: null, mime_type: null }]
    } else { await route.fulfill({ status: 404, json: { message: 'Unexpected fixture request' } }); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click()
  await page.getByLabel('Presentation PIN').fill('2323')
  await page.getByRole('button', { name: 'Enter', exact: true }).click()
  // Establish an existing synthetic Auth session through the SDK, never through UI.
  // The mocked Auth user endpoint verifies it independently before RLS reads.
  await page.evaluate(async ({ token }) => {
    const modulePath = '/src/lib/supabase.ts'
    const { supabase } = await import(modulePath)
    const result = await supabase.auth.setSession({ access_token: token, refresh_token: 'synthetic-refresh' })
    if (result.error) throw Error('Synthetic session fixture failed')
  }, { token })
  await expect(page.getByRole('navigation', { name: 'Section index' })).toBeVisible()
  await page.getByRole('button', { name: 'Open ' + sectionTitle, exact: true }).click()
  return { release: () => releaseResponse!(), recordRequests: () => recordRequests, tokenRequests: () => tokenRequests }
}

test('approved narratives load with exact paragraphs, provenance and no asset modules', async ({ page }, testInfo) => {
  const fixture = await setup(page, { delayed: true, financialSection: true })
  await expect(page.getByRole('status')).toContainText('Checking approved narrative access')
  await expect(page.getByText('Legacy narrative must stay hidden.')).toHaveCount(0)
  fixture.release()
  await expect(page.getByRole('heading', { name: 'Approved synthetic narrative' })).toBeVisible()
  expect(await page.locator('.narrative p').textContent()).toBe(body)
  await expect(page.locator('.narrative p')).toHaveCSS('white-space', 'pre-wrap')
  await expect(page.locator('.evidence-aside')).toContainText('BRUCE_PRIVATE / approved / reported')
  await expect(page.locator('.evidence-aside')).toContainText('synthetic-source.md')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => 'fixtureExecuted' in window)).toBe(false)
  await expect(page.getByLabel('Starting monthly revenue')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('narrative-reader.png'), fullPage: true })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
})
test('empty approved narratives show unavailable without legacy fallback', async ({ page }) => {
  await setup(page, { empty: true })
  await expect(page.getByRole('heading', { name: 'Narrative unavailable.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Owner review may still be pending')
  await expect(page.getByText('Legacy narrative must stay hidden.')).toHaveCount(0)
})
test('missing exact grant denies narrative access without querying records', async ({ page }) => {
  const fixture = await setup(page, { granted: false })
  await expect(page.getByRole('heading', { name: 'Narrative access denied.' })).toBeVisible()
  expect(fixture.recordRequests()).toBe(0)
})
test('closed content release gate denies narrative reads', async ({ page }) => {
  const fixture = await setup(page, { released: false })
  await expect(page.getByRole('alert')).toHaveText('Confidential release remains disabled')
  expect(fixture.recordRequests()).toBe(0)
})
test('pending narrative response cannot reappear after sign-out', async ({ page }) => {
  const fixture = await setup(page, { delayed: true })
  await expect.poll(fixture.recordRequests).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  fixture.release()
  await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Approved synthetic narrative' })).toHaveCount(0)
})

test('protected PDF uses same-origin bearer transport and retains the existing viewer', async ({ page }) => {
  let gatewayCalls = 0, storageCalls = 0
  page.on('request', request => { if (request.url().includes('/storage/v1/')) storageCalls++ })
  await page.route('**/api/vault/documents/*', async route => {
    gatewayCalls++
    expect(new URL(route.request().url()).search).toBe('')
    expect(route.request().headers().authorization).toMatch(/^Bearer /)
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' }, body: Buffer.from(createDemoPdf()) })
  })
  await setup(page, { documents: true })
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic protected PDF/ }).click()
  await expect(page.locator('.react-pdf__Page__canvas')).toBeVisible({ timeout: 45000 })
  expect(gatewayCalls).toBe(1); expect(storageCalls).toBe(0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
  await expect(page.locator('.react-pdf__Page__canvas')).toHaveCount(0)
})

test('protected PDF access denial does not fall back to a signed Storage link', async ({ page }) => {
  await page.route('**/api/vault/documents/*', route => route.fulfill({ status: 403, headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } }))
  await setup(page, { documents: true })
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic protected PDF/ }).click()
  await expect(page.getByRole('alert')).toContainText('Your access may have changed')
  await expect(page.locator('.react-pdf__Page__canvas')).toHaveCount(0)
})

test('a pending protected PDF cannot appear after sign-out', async ({ page }) => {
  let release!: () => void, requested = false
  const waiting = new Promise<void>(resolve => { release = resolve })
  pendingResponses.set(page, () => release())
  await page.route('**/api/vault/documents/*', async route => {
    requested = true
    await waiting
    await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' }, body: Buffer.from(createDemoPdf()) }).catch(() => {})
  })
  await setup(page, { documents: true })
  pendingResponses.set(page, () => release())
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic protected PDF/ }).click()
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Conviction, made tangible.' })).toBeVisible()
  await expect(page.locator('.react-pdf__Page__canvas')).toHaveCount(0)
})


test('local API fails closed over HTTP without exposing the SPA or server credentials', async ({ request }) => {
  const endpoint = '/api/vault/assets/11111111-1111-4111-8111-111111111111'
  const anonymous = await request.get(endpoint)
  expect(anonymous.status()).toBe(401)
  expect(anonymous.headers()['cache-control']).toBe('private, no-store, max-age=0, must-revalidate')
  expect(await anonymous.text()).toBe('')
  // This project uses a deliberately incorrect, local-only Supabase URL fixture.
  const unconfigured = await request.get(endpoint, { headers: { Authorization: 'Bearer synthetic-loopback-only' } })
  expect(unconfigured.status()).toBe(503); expect(await unconfigured.text()).toBe('')
  const invalid = await request.get(endpoint + '?bucket=media&path=arbitrary')
  expect(invalid.status()).toBe(404); expect(await invalid.text()).toBe('')
})


test('replaying the invitation preserves a valid session and still rechecks protected access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fixture = await setup(page)
  expect(fixture.tokenRequests()).toBe(0)
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click()
  await expect(page.locator('#landing-title')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Approved synthetic narrative' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Enter vault', exact: true }).click()
  await page.getByLabel('Presentation PIN').fill('2323')
  await page.getByRole('button', { name: 'Enter', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Section index' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Private access pending.' })).toHaveCount(0)
  expect(fixture.tokenRequests()).toBe(0)
  await page.getByRole('button', { name: 'Open Introduction', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Approved synthetic narrative' })).toBeVisible()
})
