// Private review data and Excel binaries remain in memory. Screenshots use OS temp only.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const origin = 'http://127.0.0.1:5174'
const headers = { 'X-Vault-Local-Review': '1', 'Content-Type': 'application/json' }
const data = await (await fetch(`${origin}/api/vault/local-review/content`, { headers })).json()
const output = path.join(tmpdir(), 'JB3Vault-local-review'); await mkdir(output, { recursive: true })
const notes = row => JSON.parse(row.payload.reconciliationNote)
const known = rows => rows.reduce((sum, row) => sum + (row.payload.amountMinor ?? 0), 0)
const money = minor => (minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const runtime = process.env.JB3_WORKBOOK_RUNTIME ?? path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')
const require = createRequire(path.join(runtime, 'package.json'))
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href)
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }
function noCache(response) {
  check(response.headers.get('cache-control')?.includes('private') && response.headers.get('cache-control')?.includes('no-store'), 'Browser cache denied')
  check(response.headers.get('cdn-cache-control') === 'no-store' && response.headers.get('cloudflare-cdn-cache-control') === 'no-store', 'Shared caches denied')
}
async function validateWorkbook(file, scope, rate) {
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(file))
  wb.recalculate()
  const included = scope === 'combined' ? ['personal', 'business'] : [scope]
  const rows = included.flatMap(name => data.finances[name])
  check(Array.from({ length: wb.worksheets.getSheetCount() }, (_, i) => wb.worksheets.getSheetNameByIndex(i)).join(',') === ['Summary', 'Assumptions', ...included.map(n => n === 'personal' ? 'Personal' : 'Business'), 'Source notes','Budget scenarios'].join(','), 'Scope-specific sheets')
  const source = wb.worksheets.getItem('Source notes').getRange(`A3:T${rows.length + 2}`).values
  check(JSON.stringify(source.map(row => row[0])) === JSON.stringify(rows.map(row => row.id)), 'All source UUIDs in order')
  rows.forEach((row, i) => {
    check(source[i][4] === row.approval && source[i][5] === row.verification, 'Draft and verification status preserved')
    check(source[i][10] === notes(row).formula, 'Original formula retained as literal text')
    check(source[i][9] === row.provenance.sourceReference, 'Source hash retained')
    check(source[i][19] === JSON.stringify(row), 'Complete unchanged source record preserved')
  })
  for (const name of included) {
    const sheet = wb.worksheets.getItem(name === 'personal' ? 'Personal' : 'Business')
    data.finances[name].forEach((record, i) => {
      const cell = sheet.getRange(`D${i + 5}`), result = cell.values[0][0]
      check(cell.formulas[0][0].includes('Assumptions!$B$3'), 'Editable horizon in formula')
      check(record.payload.amountMinor === null ? result === '' || result === null : Math.abs(result * 100 - record.payload.amountMinor) < .01, 'Source row total/unknown retained')
    })
  }
  const summary = wb.worksheets.getItem('Summary'), total = known(rows)
  check(Math.abs(summary.getRange('B12').values[0][0] * 100 - total) < .01, 'Known total reconciles to source')
  const optional = known(rows.filter(row => notes(row).optionalHardware))
  check(Math.abs(summary.getRange('B10').values[0][0] * 100 - (total - optional)) < .01, 'Baseline excludes optional hardware')
  check(summary.getRange('B13').values[0][0] === rows.filter(row => row.payload.amountMinor === null).length, 'Unknowns excluded and counted')
  check(wb.worksheets.getItem('Assumptions').getRange('B2').values[0][0] === rate, 'Current selected FX exported')
  check(Math.abs(summary.getRange('C12').values[0][0] * 100 - Math.round(total / rate)) < .01, 'GBP total consistent with UI')
  wb.worksheets.getItem('Assumptions').getRange('B2').values = [[26.5]]; wb.recalculate()
  check(Math.abs(summary.getRange('C12').values[0][0] * 100 - Math.round(total / 26.5)) < .01, 'Workbook FX remains editable and recalculates')
}
const browser = await chromium.launch({ headless: true })
let stage = 'authorisation'
try {
  for (const test of [
    { method: 'GET', headers },
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { method: 'POST', headers: { ...headers, Origin: 'https://other.example' } },
    { method: 'POST', headers, body: JSON.stringify({ scope: 'combined', zarPerGbp: 25, path: '/private' }) },
    { method: 'POST', headers, body: JSON.stringify({ scope: 'combined', zarPerGbp: 0 }) },
  ]) {
    const response = await fetch(`${origin}/api/vault/local-review/financial-export`, test)
    check([400, 403, 405].includes(response.status), 'Invalid/unauthorised export denied'); noCache(response)
  }
  for (const [name, viewport] of [['desktop', { width: 1536, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
    stage = `${name} browser`
    const context = await browser.newContext({ viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile', reducedMotion: 'reduce', acceptDownloads: true })
    const page = await context.newPage(); page.setDefaultTimeout(180000)
    const errors = []; page.on('pageerror', error => errors.push(error.name))
    await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) || /^(blob|data):/.test(route.request().url()) ? route.continue() : route.abort())
    await page.goto(origin); await page.getByRole('button', { name: 'Enter vault', exact: true }).click()
    await page.getByRole('navigation', { name: 'Section index' }).waitFor()
    const nav = page.getByRole('navigation', { name: 'Vault tools' })
    check(await nav.getByRole('button').count() === 3, 'Three matching navigation controls')
    await nav.getByRole('button', { name: 'Financial schedules', exact: true }).click()
    check(await nav.getByRole('button', { name: 'Financial schedules', exact: true }).getAttribute('aria-current') === 'page', 'Active navigation indicator')
    await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).fill('25')
    for (const schedule of ['personal', 'business']) {
      await page.getByRole('tab', { name: new RegExp(`^${schedule === 'personal' ? 'Personal' : 'Business'} schedule`) }).click()
      const panel = page.locator(`#finance-panel-${schedule}`)
      check(await panel.locator('tbody tr').count() === data.finances[schedule].length, 'All schedule rows displayed')
      check((await panel.textContent()).includes('Awaiting confirmation'), 'Unknown amounts visible')
      const rows = data.finances[schedule]
      for (const row of rows) check(await panel.locator(`[data-record-id="${row.id}"]`).count() === 1, 'No row lost or duplicated')
      const detail = panel.locator('details').first()
      check(!(await detail.getAttribute('open')), 'Technical provenance collapsed by default')
      await detail.locator('summary').click(); check(await detail.getAttribute('open') !== null, 'Verification notes expand')
      await detail.locator('summary').click()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'No horizontal page overflow')
    }
    check(await page.getByRole('region', { name: 'Optional hardware & capital investment' }).count() === 1, 'Optional hardware separate')
    const base = known([...data.finances.personal, ...data.finances.business].filter(row => !notes(row).optionalHardware))
    check((await page.locator('.finance-card').first().textContent()).includes(money(base)), 'Combined baseline correct')
    await nav.getByRole('button', { name: 'Documents', exact: true }).click()
    await nav.getByRole('button', { name: 'Financial schedules', exact: true }).click()
    check(await page.getByRole('spinbutton', { name: 'ZAR per GBP' }).inputValue() === '25', 'Selected rate survives navigation')
    const sizes = await nav.getByRole('button').evaluateAll(buttons => buttons.map(b => ({ width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })))
    check(sizes.every(s => Math.abs(s.width - sizes[0].width) < 1 && s.height >= 44), 'Matching dimensions and touch targets')
    await page.keyboard.press('Tab')
    await nav.getByRole('button').first().focus()
    check(await nav.getByRole('button').first().evaluate(b => getComputedStyle(b).outlineStyle !== 'none'), 'Keyboard focus visible')
    check(await nav.getByRole('button').first().evaluate(b => getComputedStyle(b).transitionDuration.split(',').every(value => parseFloat(value) <= .001)), 'Reduced motion respected')
    await page.screenshot({ path: path.join(output, `${name}-finance-workspace.png`), fullPage: true })
    if (name === 'desktop') {
      for (const scope of ['combined', 'personal', 'business']) {
        stage = `Excel ${scope}`
        const responsePromise = page.waitForResponse(r => r.url().endsWith('/financial-export') && r.request().method() === 'POST')
        responsePromise.catch(() => {})
        const downloadPromise = page.waitForEvent('download', { timeout: 180000 }); downloadPromise.catch(() => {})
        stage = `Excel ${scope}: click`
        await page.getByRole('button', { name: scope === 'combined' ? 'Combined workbook' : `${scope === 'personal' ? 'Personal' : 'Business'} schedule`, exact: true }).click()
        stage = `Excel ${scope}: HTTP response`
        const response = await responsePromise
        check(response.status() === 200, 'Authorised workbook exported')
        check((await response.allHeaders())['cache-control'].includes('no-store'), 'Successful exports are not cached')
        stage = `Excel ${scope}: browser download`
        const download = await downloadPromise
        check(download.suggestedFilename() === `JB3-${scope}-draft.xlsx`, 'Safe fixed filename')
        stage = `Excel ${scope}: formulas and source records`
        await validateWorkbook(await download.path(), scope, 25)
        await download.delete()
        console.log(`Excel ${scope}: download, formulas, source records and rate PASS`)
      }
    }
    await page.screenshot({ path: path.join(output, `${name}-finance-workspace.png`), fullPage: true })
    check(errors.length === 0, 'No browser errors')
    console.log(`${name}: financial workspace, navigation, responsive layout PASS`)
    await context.close()
  }
  console.log(`Private Excel validation, scope, formulas, selected/editable FX, ${data.finances.personal.length+data.finances.business.length} draft records and download restrictions: PASS (${checks} assertions)`)
  console.log(`Private screenshots: ${output}`)
} catch (error) {
  console.error(`Financial workspace check FAILED at ${stage}: ${error instanceof assert.AssertionError ? error.message : error.name}; private payload omitted`)
  process.exitCode = 1
} finally { await browser.close() }
