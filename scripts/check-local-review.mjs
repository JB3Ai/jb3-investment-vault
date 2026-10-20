// Focused owner-review check. No traces, snapshots or private payloads are saved in Git.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const origin = 'http://127.0.0.1:5174'
const response = await fetch(`${origin}/api/vault/local-review/content`, { headers: { 'X-Vault-Local-Review': '1' } })
assert.equal(response.status, 200)
const data = await response.json()
const output = path.join(tmpdir(), 'JB3Vault-local-review')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
let stage = 'initialise'
try {
  for (const [name, viewport] of [['desktop', { width: 1536, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile', reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(45000)
    const failures = []
    page.on('pageerror', error => failures.push(error.name))
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort()
    })
    stage = `${name}: console`
    await page.goto(origin)
    await page.getByRole('button', { name: 'Enter vault', exact: true }).click()
    await page.getByRole('navigation', { name: 'Section index' }).waitFor()
    assert.equal(await page.getByRole('navigation', { name: 'Section index' }).locator('.index-open').count(), 11)
    await page.screenshot({ path: path.join(output, `${name}-console.png`), fullPage: true })
    for (const [index, record] of data.sections.entries()) {
      stage = `${name}: section ${index + 1}`
      const button = page.getByRole('navigation', { name: 'Section index' }).locator('.index-open').nth(index)
      await button.click()
      await page.locator('.reader h1').waitFor()
      assert.equal(await page.locator('.narrative h2').first().textContent(), record.narrative.payload.heading)
      assert.equal(await page.locator('.evidence-aside .metadata').first().textContent(), `${record.narrative.classification} / approved / ${record.narrative.verification}`)
      if (index === 2) {
        stage = `${name}: laboratory gallery`
        const gallery = page.getByRole('region', { name: '23-day laboratory interlude' })
        await gallery.locator('.gallery-figure img').waitFor()
        const positions = data.laboratory.review?.slots ?? data.laboratory.photographs.map((record, index) => ({ position: index + 1, recordId: record.id }))
        for (let photo = 0; photo < positions.length; photo++) {
          const source = data.laboratory.photographs.find(record => record.id === positions[photo].recordId)
          if (!source) {
            assert.ok((await gallery.locator('.gallery-empty').textContent()).includes('awaiting owner confirmation'))
            if (photo < positions.length - 1) await gallery.getByRole('button', { name: 'Next image' }).click()
            continue
          }
          await page.waitForFunction(() => {
            const image = document.querySelector('.gallery-figure img')
            return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
          })
          assert.equal(await gallery.locator('.gallery-figure img').getAttribute('alt'), source.payload.alt)
          if (photo < positions.length - 1) await gallery.getByRole('button', { name: 'Next image' }).click()
        }
        for (const unplaced of data.laboratory.review?.unplaced ?? []) {
          await gallery.getByRole('button', { name: `Review original photo ${unplaced.originalNumber} · unplaced` }).click()
          assert.equal(await gallery.locator('.gallery-figure img').getAttribute('data-record-id'), unplaced.recordId)
        }
        await gallery.screenshot({ path: path.join(output, `${name}-gallery.png`) })
        stage = `${name}: PDF evidence`
        for (const doc of data.documents) {
          await page.getByRole('button', { name: new RegExp(doc.payload.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click()
          await page.locator('.react-pdf__Page canvas').waitFor({ timeout: 90000 })
          assert.equal(await page.locator('.react-pdf__Page canvas').evaluate(canvas => canvas.width > 0), true)
          await page.getByRole('button', { name: 'Back to library' }).click()
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true)
      await page.getByRole('button', { name: 'Back to Console' }).click()
    }
    stage = `${name}: financial schedules`
    await page.getByRole('button', { name: 'Financial schedules', exact: true }).click()
    for (const schedule of ['personal', 'business']) {
      await page.getByRole('tab', { name: `${schedule === 'personal' ? 'Personal' : 'Business'} schedule` }).click()
      const panel = page.locator(`#finance-panel-${schedule}`)
      assert.equal(await panel.locator('tbody tr').count(), data.finances[schedule].length)
      assert.ok((await panel.textContent()).includes('Awaiting confirmation'))
      const first = data.finances[schedule].find(record => record.payload.amountMinor !== null)
      assert.ok((await panel.textContent()).includes(first.payload.label))
      const before = await panel.textContent()
      await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill('25')
      assert.notEqual(await panel.textContent(), before)
      await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill(String(data.finances.exchangeRate.zarPerGbp))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true)
    }
    await page.screenshot({ path: path.join(output, `${name}-financials.png`), fullPage: true })
    assert.equal(failures.length, 0)
    console.log(`${name}: 11 sections, 2 schedules, 12 images, 2 PDFs, layout and browser errors PASS`)
    await context.close()
  }
  console.log(`Private review screenshots: ${output}`)
} catch {
  console.error(`Focused local review FAILED at ${stage}; private content omitted`)
  process.exitCode = 1
} finally { await browser.close() }
