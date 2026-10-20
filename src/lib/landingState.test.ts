import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioSessionKey, landingSessionKey, landingTiming, rememberFlag, sessionFlag } from './landingState'
afterEach(() => vi.unstubAllGlobals())
describe('intro timing and optional presentation state', () => {
  it('uses the supplied device-specific reveal and boot timing', () => {
    expect(landingTiming(1440).reveals).toEqual([.5, 1.2, 1.9, 2.6])
    expect(landingTiming(768).init).toBe(1500)
    expect(landingTiming(375).skipPowerup).toBe(0)
  })
  it('keeps the total authored sequence within six to eight seconds', () => {
    for (const width of [375, 768, 1440]) {
      const timing = landingTiming(width)
      const total = timing.landing + (timing.init + timing.powerup) / 1000
      expect(total).toBeGreaterThanOrEqual(6)
      expect(total).toBeLessThanOrEqual(8)
    }
  })
  it('removes automatic animation delays for reduced motion', () => {
    const timing = landingTiming(1440, true)
    expect([...timing.reveals, timing.init, timing.powerup, timing.skipPowerup]).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
  it('handles unavailable storage without blocking access checks', () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw Error('unavailable') }, setItem() { throw Error('unavailable') } })
    expect(sessionFlag(landingSessionKey)).toBe(false)
    expect(() => rememberFlag(landingSessionKey, true)).not.toThrow()
  })
  it('stores only presentation preferences independently', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) })
    rememberFlag(landingSessionKey, true); rememberFlag(audioSessionKey, false)
    expect(sessionFlag(landingSessionKey)).toBe(true)
    expect(sessionFlag(audioSessionKey)).toBe(false)
    expect([...values.keys()]).toEqual([landingSessionKey, audioSessionKey])
  })
})
