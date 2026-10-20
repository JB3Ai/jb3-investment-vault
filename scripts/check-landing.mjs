import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Synthetic public shells only. No hosted authentication, credentials or private content.
const ports = { demo: 5181, secure: 5182 }, children = []
const output = path.join(tmpdir(), 'JB3Vault-landing-review')
await mkdir(output, { recursive: true })
let browser, stage = 'start isolated Vite shells'
async function start(mode) {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(ports[mode]), '--strictPort'], {
    env: { ...process.env, VITE_VAULT_MODE: mode, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SECRET_KEY: '' }, stdio: 'ignore', windowsHide: true,
  })
  children.push(child)
  const origin = `http://127.0.0.1:${ports[mode]}`
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw Error('Isolated server failed')
    try { const response = await fetch(origin); if (response.ok) return origin } catch { /* Server starting. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw Error('Isolated server did not start')
}
try {
  const demo = await start('demo'), secure = await start('secure')
  browser = await chromium.launch({ headless: true })
  for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['tablet', { width: 768, height: 1024 }], ['mobile', { width: 375, height: 812 }]]) {
    stage = `${device} landing and entry`
    const context = await browser.newContext({ viewport })
    const page = await context.newPage(), errors = []
    page.setDefaultTimeout(90000)
    page.on('pageerror', () => errors.push('browser error'))
    let audioContexts = 0
    await page.exposeFunction('noteAudioContext', () => { audioContexts++ })
    await page.addInitScript(() => {
      const original = window.AudioContext
      window.introAudio = { decoded: [], started: 0, gains: [] }
      if (original) window.AudioContext = new Proxy(original, { construct(target, args) {
        void window.noteAudioContext()
        const context = Reflect.construct(target, args)
        const decode = context.decodeAudioData.bind(context), source = context.createBufferSource.bind(context), gain = context.createGain.bind(context)
        context.decodeAudioData = async bytes => {
          const buffer = await decode(bytes), samples = buffer.getChannelData(0)
          let peak = 0
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
          window.introAudio.decoded.push({ duration: buffer.duration, peak })
          return buffer
        }
        context.createBufferSource = () => {
          const node = source(), start = node.start.bind(node)
          node.start = (...args) => { window.introAudio.started++; return start(...args) }
          return node
        }
        context.createGain = () => {
          const node = gain(), ramp = node.gain.linearRampToValueAtTime.bind(node.gain)
          node.gain.linearRampToValueAtTime = (value, at) => { window.introAudio.gains.push(value); return ramp(value, at) }
          return node
        }
        return context
      } })
    })
    await page.goto(demo)
    await page.getByRole('button', { name: 'Skip intro', exact: true }).waitFor()
    assert.equal(audioContexts, 0)
    assert.equal(await page.locator('.console-page').count(), 0)
    const reveal = await page.locator('.landing-block--1').evaluate(element => getComputedStyle(element).animationDelay)
    assert.equal(reveal, device === 'desktop' ? '0.5s' : device === 'tablet' ? '0.4s' : '0.3s')
    stage = `${device}: mute and layout`
    const mute = page.getByRole('button', { name: 'Mute audio', exact: true })
    await mute.click()
    assert.equal(await page.getByRole('button', { name: 'Unmute audio', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.reload()
    await page.getByRole('button', { name: 'Unmute audio', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Unmute audio', exact: true }).click()
    await page.screenshot({ path: path.join(output, `${device}-landing.png`), fullPage: true, animations: 'disabled' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    stage = `${device}: full entry sequence`
    await page.evaluate(() => {
      window.introPhases = []
      window.introObserver = new MutationObserver(() => {
        const element = document.querySelector('.vault-landing')
        const phase = element?.className ?? 'ready'
        if (window.introPhases.at(-1) !== phase) window.introPhases.push(phase)
        const shell = document.querySelector('.landing-boot')
        if (shell && !shell.hasAttribute('inert')) window.introUnsafeShell = true
      })
      window.introObserver.observe(document.body, { subtree: true, attributes: true, childList: true })
    })
    await page.getByRole('button', { name: 'Enter vault', exact: true }).click()
    await page.getByRole('heading', { name: 'Conviction, made tangible.' }).waitFor()
    const flow = await page.evaluate(() => { window.introObserver.disconnect(); return { phases: window.introPhases, unsafe: window.introUnsafeShell === true } })
    assert.ok(flow.phases.includes('vault-landing vault-landing--init'))
    assert.ok(flow.phases.includes('vault-landing vault-landing--powerup'))
    assert.equal(flow.unsafe, false)
    const audio = await page.evaluate(() => window.introAudio)
    assert.equal(audio.decoded.length, 6)
    assert.ok(audio.decoded.every(cue => cue.peak > .01 && cue.peak <= .501))
    assert.ok(audio.started >= 6)
    assert.ok(audio.gains.every(gain => gain <= .101))
    assert.equal(await page.getByRole('navigation', { name: 'Section index' }).locator('li').count(), 11)
    stage = `${device}: reload and replay`
    await page.reload()
    await page.getByRole('heading', { name: 'Conviction, made tangible.' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Enter vault', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Replay introduction' }).click()
    await page.getByRole('button', { name: 'Mute audio', exact: true }).waitFor()
    stage = `${device}: skip sequence`
    await page.getByRole('button', { name: 'Skip intro', exact: true }).click()
    assert.equal(await page.locator('.vault-landing--init').count(), 0)
    await page.getByRole('heading', { name: 'Conviction, made tangible.' }).waitFor()
    assert.equal(errors.length, 0)
    await context.close()
    console.log(`${device}: six real effects decoded, quiet playback, no autoplay, mute, ENTER, immediate SKIP, session reload, replay and layout PASS`)
  }
  stage = 'secure-mode presentation flags do not grant access'
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(90000)
  await page.goto(secure)
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click()
  await page.getByLabel('Presentation PIN').fill('2323')
  await page.getByRole('button', { name: 'Enter', exact: true }).click()
  await page.getByRole('heading', { name: 'Conviction, made tangible.' }).waitFor()
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByText('Document access pending.', { exact: true }).first().waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click()
  await page.getByLabel('Presentation PIN').fill('2323')
  await page.getByRole('button', { name: 'Enter', exact: true }).click()
  await page.getByRole('navigation', { name: 'Section index' }).waitFor()
  assert.equal(await page.locator('input[type=email]').count(), 0)
  await context.close()
  const blocked = await browser.newContext({ reducedMotion: 'reduce' })
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw Error('Storage blocked') } })
    Object.defineProperty(window, 'AudioContext', { value: undefined })
  })
  const blockedPage = await blocked.newPage()
  await blockedPage.goto(demo)
  await blockedPage.getByRole('button', { name: 'Enter vault', exact: true }).click()
  await blockedPage.getByRole('heading', { name: 'Conviction, made tangible.' }).waitFor()
  await blocked.close()
  console.log('Reduced motion, storage/audio unavailable, and secure-mode access denial PASS')
  console.log(`Non-confidential landing screenshots: ${output}`)
} catch (error) {
  console.error(`Landing verification FAILED at ${stage}; no credentials or content logged`)
  console.error(`${error.name}: ${error.message.split('\n').slice(0, 4).join(' ')}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  for (const child of children) child.kill()
}
