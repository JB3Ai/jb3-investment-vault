import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbToGain, VaultAudioManager } from './audioManager'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const starts = vi.fn(), stops = vi.fn(), constructors = vi.fn()
class FakeContext {
  state = 'running'; currentTime = 0; destination = {}
  constructor() { constructors() }
  async resume() {}
  async decodeAudioData() { return { duration: .1 } }
  createBufferSource() { return { buffer: null, loop: false, onended: null, connect: vi.fn(), disconnect: vi.fn(), start: starts, stop: stops } }
  createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { AudioContext: FakeContext })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())
describe('gesture-unlocked cancellable intro audio', () => {
  it('ships six distinct non-silent WAV effects with clean endpoints and headroom', () => {
    const hashes = new Set<string>()
    for (const name of ['ambient-pad', 'shutter-whoosh', 'mechanism-click', 'whir-engage', 'confirmation-chime', 'power-hum']) {
      const bytes = readFileSync(new URL(`../assets/audio/${name}.wav`, import.meta.url))
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString()).toBe('WAVE')
      expect(bytes.readUInt32LE(40)).toBe(bytes.length - 44)
      expect(bytes.readInt16LE(44)).toBe(0)
      expect(bytes.readInt16LE(bytes.length - 2)).toBe(0)
      let energy = 0, peak = 0
      for (let offset = 44; offset < bytes.length; offset += 2) { const value = bytes.readInt16LE(offset) / 32768; energy += value * value; peak = Math.max(peak, Math.abs(value)) }
      expect(Math.sqrt(energy / ((bytes.length - 44) / 2))).toBeGreaterThan(.01)
      expect(peak).toBeLessThanOrEqual(.501)
      hashes.add(createHash('sha256').update(bytes).digest('hex'))
    }
    expect(hashes.size).toBe(6)
  })
  it('creates no audio context or network request until explicitly initialised', async () => {
    const manager = new VaultAudioManager()
    await manager.playSound('ambient-pad')
    expect(constructors).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('plays through the unlocked context with bounded dB gain', async () => {
    const manager = new VaultAudioManager()
    await manager.init(); await manager.playSound('confirmation-chime', 0, -28)
    expect(starts).toHaveBeenCalledOnce()
    expect(dbToGain(-40)).toBeCloseTo(.01)
    expect(dbToGain(20)).toBe(1)
  })
  it('cancels pending decode/playback when the phase changes', async () => {
    const manager = new VaultAudioManager()
    await manager.init()
    const pending = manager.playSound('whir-engage', .5)
    manager.stopAll(); await pending
    expect(starts).not.toHaveBeenCalled()
  })
  it('mute stops scheduled sources immediately and prevents future playback', async () => {
    const manager = new VaultAudioManager()
    await manager.init(); await manager.playSound('power-hum', .5, -40, 2)
    const previousStops = stops.mock.calls.length
    manager.setMuted(true)
    expect(stops.mock.calls.length).toBeGreaterThan(previousStops)
    starts.mockClear(); await manager.playSound('ambient-pad')
    expect(starts).not.toHaveBeenCalled()
  })
  it('network/decode failure degrades to silence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')))
    const manager = new VaultAudioManager()
    await manager.init()
    await expect(manager.playSound('mechanism-click')).resolves.toBeUndefined()
    expect(starts).not.toHaveBeenCalled()
  })
  it('unsupported audio does not prevent continuing to existing authentication', async () => {
    vi.stubGlobal('window', {})
    expect(await new VaultAudioManager().init()).toBe(false)
  })
})
