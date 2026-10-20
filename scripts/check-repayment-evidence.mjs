// Private evidence is fetched only from the loopback owner adapter; never saved in Git.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const origin = 'http://127.0.0.1:5174'
const headers = { 'X-Vault-Local-Review': '1' }
const data = await (await fetch(`${origin}/api/vault/local-review/content`, { headers })).json()
const review = data.laboratory.review
let checks = 0, stage = 'private metadata'
const check = (condition, message) => { assert.ok(condition, message); checks++ }
check(review?.classification === 'BRUCE_PRIVATE' && review.approval === 'draft' && review.verification === 'awaiting-verification', 'Evidence remains classified and unapproved')
check(review.slots.length === 12 && review.slots.filter(s => s.recordId === null).map(s => s.position).join(',') === '10,11', 'Two unresolved positions retained')
check(review.unplaced.map(item => item.originalNumber).sort((a,b) => a-b).join(',') === '2,12', 'Both unplaced originals retained')
const represented = [...review.slots.filter(slot => slot.recordId), ...review.unplaced]
check(new Set(represented.map(item => item.recordId)).size === 12, 'Every original represented once')
for (const photo of data.laboratory.photographs) {
  const response = await fetch(`${origin}/api/vault/local-review/assets/${photo.id}`, { headers })
  check(response.ok && response.headers.get('cache-control').includes('no-store'), 'Private asset access and no-cache')
  const sha = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
  check(sha === photo.file.sha256 && sha === represented.find(item => item.recordId === photo.id).sha256, 'Original file hash and provenance retained')
}
const output = path.join(tmpdir(), 'JB3Vault-local-review'); await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const pound = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
try {
  for (const [name, viewport] of [['desktop', { width: 1536, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
    stage = `${name} initial load`
    const context = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile', reducedMotion: 'reduce' })
    const page = await context.newPage(); page.setDefaultTimeout(90000)
    const external = [], errors = []
    page.on('pageerror', error => errors.push(error.name))
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['blob:', 'data:'].includes(url.protocol)) return route.continue()
      external.push(url)
      if (url.hostname === 'www.youtube-nocookie.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic provider response</title>' })
      return route.abort()
    })
    await page.goto(origin); await page.getByRole('button', { name: 'Enter vault', exact: true }).click()
    await page.getByRole('navigation', { name: 'Section index' }).waitFor()
    stage = `${name} repayment`
    await page.getByRole('button', { name: 'Financial schedules', exact: true }).click()
    await page.getByRole('tab', { name: 'Repayment scenarios', exact: true }).click()
    const calculator = page.getByRole('region', { name: 'Illustrative repayment calculator' })
    check((await calculator.textContent()).includes('Enter illustrative terms'), 'No invented loan terms')
    await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill('25')
    await calculator.getByRole('spinbutton', { name: 'Illustrative principal ZAR' }).fill('12000')
    await calculator.getByRole('spinbutton', { name: 'Illustrative annual interest percent' }).fill('12')
    await calculator.getByRole('spinbutton', { name: 'Illustrative repayment months' }).fill('12')
    const payment = 12000 * .01 / (1 - 1.01 ** -12)
    const expected = { Principal: 12000, 'Monthly repayment': payment, 'Total interest': payment * 12 - 12000, 'Total repayment': payment * 12 }
    for (const rate of [25, 24]) {
      await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill(String(rate))
      for (const [label, value] of Object.entries(expected)) {
        const card = calculator.locator(`[data-repayment="${label}"]`)
        check((await card.locator('strong').textContent()).includes('ZAR'), 'ZAR primary')
        check((await card.locator('small').textContent()).includes(pound(value / rate)), 'All repayment figures use selected GBP rate')
      }
    }
    await calculator.getByRole('spinbutton', { name: 'Illustrative annual interest percent' }).fill('0')
    check((await calculator.locator('[data-repayment="Total interest"] small').textContent()).includes('£0.00'), 'Zero-interest GBP correct')
    await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill('0')
    check(await calculator.locator('.repayment-results small').filter({ hasText: 'requires valid' }).count() === 4, 'Invalid FX never produces misleading GBP')
    await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill(String(data.finances.exchangeRate.zarPerGbp))
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Repayment mobile/desktop layout')
    await calculator.screenshot({ path: path.join(output, `${name}-repayment.png`) })
    await page.getByRole('button', { name: 'Back to Console', exact: true }).click()
    await page.getByRole('navigation', { name: 'Section index' }).locator('.index-open').nth(2).click()
    stage = `${name} photo sequence`
    const gallery = page.getByRole('region', { name: '23-day laboratory interlude' })
    await gallery.locator('.gallery-figure img').waitFor()
    for (const slot of review.slots) {
      await gallery.getByRole('button', { name: new RegExp(`^Show position ${slot.position},`) }).click()
      if (slot.recordId) {
        check(await gallery.locator('.gallery-figure img').getAttribute('data-record-id') === slot.recordId, 'Founder position resolves to original UUID')
        check((await gallery.locator('.gallery-original-number').textContent()).includes(`Original photo ${slot.originalNumber}`), 'Original photo identity displayed')
      } else check((await gallery.locator('.gallery-empty').textContent()).includes(`Position ${slot.position} awaiting owner confirmation`), 'No guessed image at unresolved position')
    }
    for (const item of review.unplaced) {
      await gallery.getByRole('button', { name: `Review original photo ${item.originalNumber} · unplaced` }).click()
      check(await gallery.locator('.gallery-figure img').getAttribute('data-record-id') === item.recordId, 'Unplaced original still reviewable')
      check((await gallery.locator('figcaption').textContent()).includes('UNPLACED'), 'Review does not assign an unresolved position')
    }
    check((await gallery.textContent()).includes('not independently verified chronology'), 'Founder sequencing distinct from verified chronology')
    stage = `${name} deferred video`
    const videos = page.getByRole('region', { name: 'Original Video Evidence' })
    check(await videos.locator('iframe').count() === 0 && external.length === 0, 'No initial iframe or third-party request')
    check(await videos.getByRole('link', { name: 'Open on YouTube' }).count() === 2, 'Two external fallbacks available')
    for (let index = 0; index < review.videos.length; index++) {
      check(await videos.getByRole('link', { name: 'Open on YouTube' }).nth(index).getAttribute('href') === review.videos[index].url, 'Original source URL retained')
      await videos.getByRole('button', { name: `Load original video ${index + 1}`, exact: false }).click()
      const frame = videos.locator('iframe').first()
      await frame.waitFor()
      const url = new URL(await frame.getAttribute('src'))
      check(url.hostname === 'www.youtube-nocookie.com' && url.searchParams.get('autoplay') === '0', 'Privacy-enhanced embed with no autoplay')
      check(!(await frame.getAttribute('allow')).includes('autoplay') && await frame.getAttribute('referrerpolicy') === 'no-referrer', 'No autoplay permission or referring private path')
      await videos.getByRole('button', { name: `Unload video ${index + 1}` }).click()
      check(await videos.locator('iframe').count() === 0, 'Player unloads')
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Evidence mobile/desktop layout')
    check(errors.length === 0, 'No browser errors')
    await gallery.screenshot({ path: path.join(output, `${name}-evidence-updated.png`) })
    console.log(`${name}: repayment ZAR/GBP, 12 positions, two unplaced originals, deferred video controls PASS`)
    await context.close()
  }
  const after = await (await fetch(`${origin}/api/vault/local-review/content`, { headers })).json()
  check(JSON.stringify([after.sections, after.finances, after.documents, after.laboratory.photographs]) === JSON.stringify([data.sections, data.finances, data.documents, data.laboratory.photographs]), 'Narratives, schedules, documents and original photo records unchanged')
  console.log(`Repayment/evidence focused checks PASS (${checks} assertions). Video provider responses were intercepted; recording content and playback availability are not independently verified.`)
} catch (error) {
  console.error(`Repayment/evidence check FAILED at ${stage}: ${error instanceof assert.AssertionError ? error.message : error.name}; private payload omitted`)
  process.exitCode = 1
} finally { await browser.close() }
